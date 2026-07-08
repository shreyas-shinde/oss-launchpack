#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/tmp/meilisearch"
BACKUP_STAMP="validation-proof"
INDEX_NAME="oss_launchpack_validation"
EXPECTED_MARKER="before-backup-meilisearch"
MEILISEARCH_VALIDATION_PORT="${MEILISEARCH_VALIDATION_PORT:-17700}"
MEILISEARCH_VALIDATION_URL="http://localhost:$MEILISEARCH_VALIDATION_PORT"
MEILISEARCH_VALIDATION_MASTER_KEY="${MEILISEARCH_VALIDATION_MASTER_KEY:-oss-launchpack-meilisearch-master-key}"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required." >&2
    exit 1
  fi
}

json_field() {
  field="$1"
  node -e "let d=''; process.stdin.on('data', c => d += c); process.stdin.on('end', () => { const value = JSON.parse(d)[process.argv[1]]; if (value === undefined || value === null) process.exit(1); console.log(value); });" "$field"
}

meili_api() {
  method="$1"
  path="$2"
  data="${3:-}"

  if [ -n "$data" ]; then
    curl -fsS -X "$method" "$MEILISEARCH_VALIDATION_URL$path" \
      -H "Authorization: Bearer $MEILISEARCH_VALIDATION_MASTER_KEY" \
      -H 'Content-Type: application/json' \
      --data "$data"
  else
    curl -fsS -X "$method" "$MEILISEARCH_VALIDATION_URL$path" \
      -H "Authorization: Bearer $MEILISEARCH_VALIDATION_MASTER_KEY"
  fi
}

wait_for_meilisearch() {
  attempt=0
  while [ "$attempt" -lt 60 ]; do
    if curl -fsS "$MEILISEARCH_VALIDATION_URL/health" >/dev/null 2>&1; then
      return
    fi

    attempt=$((attempt + 1))
    sleep 1
  done

  (cd "$TARGET_DIR" && docker compose logs meilisearch) >&2
  echo "Timed out waiting for Meilisearch at $MEILISEARCH_VALIDATION_URL." >&2
  exit 1
}

wait_for_task() {
  task_uid="$1"
  attempt=0

  while [ "$attempt" -lt 60 ]; do
    task_json="$(meili_api GET "/tasks/$task_uid")"
    status="$(printf '%s' "$task_json" | json_field status)"

    case "$status" in
      succeeded)
        return
        ;;
      failed|canceled)
        printf '%s\n' "$task_json" >&2
        echo "Meilisearch task $task_uid did not succeed." >&2
        exit 1
        ;;
    esac

    attempt=$((attempt + 1))
    sleep 1
  done

  echo "Timed out waiting for Meilisearch task $task_uid." >&2
  exit 1
}

cleanup() {
  if [ "${KEEP_MEILISEARCH_VALIDATION:-}" = "1" ]; then
    echo "Leaving validation stack in $TARGET_DIR because KEEP_MEILISEARCH_VALIDATION=1"
    return
  fi

  if [ -f "$TARGET_DIR/compose.yaml" ]; then
    (cd "$TARGET_DIR" && docker compose down -v >/dev/null 2>&1) || true
  fi
}

need_command curl
need_command docker
need_command node
need_command pnpm
need_command tar

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is required." >&2
  exit 1
fi

if [ -f "$TARGET_DIR/compose.yaml" ]; then
  (cd "$TARGET_DIR" && docker compose down -v >/dev/null 2>&1) || true
fi

rm -rf "$TARGET_DIR"

cd "$ROOT_DIR"
pnpm build
node dist/cli.js init meilisearch ./tmp/meilisearch

cat > "$TARGET_DIR/.env" <<ENV
COMPOSE_PROJECT_NAME=osslaunchpackmeilisearchvalidation
MEILISEARCH_VERSION=${MEILISEARCH_VERSION:-latest}
MEILISEARCH_PORT=$MEILISEARCH_VALIDATION_PORT
MEILISEARCH_URL=$MEILISEARCH_VALIDATION_URL
MEILI_ENV=production
MEILI_MASTER_KEY=$MEILISEARCH_VALIDATION_MASTER_KEY
MEILI_SCHEDULE_SNAPSHOT=86400
ENV

cd "$TARGET_DIR"
trap cleanup EXIT INT TERM

docker compose up -d
wait_for_meilisearch

./ops/healthcheck.sh

task_uid="$(meili_api POST "/indexes/$INDEX_NAME/documents?primaryKey=id" "[{\"id\":1,\"title\":\"$EXPECTED_MARKER\"}]" | json_field taskUid)"
wait_for_task "$task_uid"

document="$(meili_api GET "/indexes/$INDEX_NAME/documents/1")"
printf '%s\n' "$document" | grep -q "$EXPECTED_MARKER"

STAMP="$BACKUP_STAMP" ./ops/backup.sh

test -f "backups/$BACKUP_STAMP/meilisearch-data.tar.gz"
tar -tzf "backups/$BACKUP_STAMP/meilisearch-data.tar.gz" | grep -q 'data.ms'

task_uid="$(meili_api DELETE "/indexes/$INDEX_NAME" | json_field taskUid)"
wait_for_task "$task_uid"

if meili_api GET "/indexes/$INDEX_NAME/documents/1" >/dev/null 2>&1; then
  echo "Expected validation document to be absent before restore." >&2
  exit 1
fi

docker compose stop meilisearch >/dev/null
CONFIRM_RESTORE=yes ./ops/restore.sh "backups/$BACKUP_STAMP"
docker compose up -d
wait_for_meilisearch

restored_document="$(meili_api GET "/indexes/$INDEX_NAME/documents/1")"
printf '%s\n' "$restored_document" | grep -q "$EXPECTED_MARKER"

echo "Meilisearch backup/restore validation passed."
