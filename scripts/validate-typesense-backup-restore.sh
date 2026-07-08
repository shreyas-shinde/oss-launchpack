#!/usr/bin/env sh
set -eu
export LC_ALL=C

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/tmp/typesense"
BACKUP_STAMP="validation-proof"
COLLECTION_NAME="oss_launchpack_validation"
EXPECTED_MARKER="before-backup-typesense"
TYPESENSE_VALIDATION_PORT="${TYPESENSE_VALIDATION_PORT:-18108}"
TYPESENSE_VALIDATION_URL="http://localhost:$TYPESENSE_VALIDATION_PORT"
TYPESENSE_VALIDATION_API_KEY="${TYPESENSE_VALIDATION_API_KEY:-oss-launchpack-typesense-api-key}"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required." >&2
    exit 1
  fi
}

typesense_api() {
  method="$1"
  path="$2"
  data="${3:-}"

  if [ -n "$data" ]; then
    curl -fsS -X "$method" "$TYPESENSE_VALIDATION_URL$path" \
      -H "X-TYPESENSE-API-KEY: $TYPESENSE_VALIDATION_API_KEY" \
      -H 'Content-Type: application/json' \
      --data "$data"
  else
    curl -fsS -X "$method" "$TYPESENSE_VALIDATION_URL$path" \
      -H "X-TYPESENSE-API-KEY: $TYPESENSE_VALIDATION_API_KEY"
  fi
}

wait_for_typesense() {
  attempt=0
  while [ "$attempt" -lt 60 ]; do
    if curl -fsS "$TYPESENSE_VALIDATION_URL/health" >/dev/null 2>&1; then
      return
    fi

    attempt=$((attempt + 1))
    sleep 1
  done

  (cd "$TARGET_DIR" && docker compose logs typesense) >&2
  echo "Timed out waiting for Typesense at $TYPESENSE_VALIDATION_URL." >&2
  exit 1
}

cleanup() {
  if [ "${KEEP_TYPESENSE_VALIDATION:-}" = "1" ]; then
    echo "Leaving validation stack in $TARGET_DIR because KEEP_TYPESENSE_VALIDATION=1"
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
node dist/cli.js init typesense ./tmp/typesense

cat > "$TARGET_DIR/.env" <<ENV
COMPOSE_PROJECT_NAME=osslaunchpacktypesensevalidation
TYPESENSE_VERSION=${TYPESENSE_VERSION:-30.2}
TYPESENSE_PORT=$TYPESENSE_VALIDATION_PORT
TYPESENSE_URL=$TYPESENSE_VALIDATION_URL
TYPESENSE_API_KEY=$TYPESENSE_VALIDATION_API_KEY
ENV

cd "$TARGET_DIR"
trap cleanup EXIT INT TERM

docker compose up -d
wait_for_typesense

./ops/healthcheck.sh

typesense_api POST /collections "{\"name\":\"$COLLECTION_NAME\",\"fields\":[{\"name\":\"title\",\"type\":\"string\"}]}" >/dev/null
typesense_api POST "/collections/$COLLECTION_NAME/documents" "{\"id\":\"1\",\"title\":\"$EXPECTED_MARKER\"}" >/dev/null

document="$(typesense_api GET "/collections/$COLLECTION_NAME/documents/1")"
printf '%s\n' "$document" | grep -q "$EXPECTED_MARKER"

STAMP="$BACKUP_STAMP" ./ops/backup.sh

test -f "backups/$BACKUP_STAMP/typesense-snapshot.tar.gz"
tar -tzf "backups/$BACKUP_STAMP/typesense-snapshot.tar.gz" >/dev/null

typesense_api DELETE "/collections/$COLLECTION_NAME" >/dev/null

if typesense_api GET "/collections/$COLLECTION_NAME/documents/1" >/dev/null 2>&1; then
  echo "Expected validation document to be absent before restore." >&2
  exit 1
fi

CONFIRM_RESTORE=yes ./ops/restore.sh "backups/$BACKUP_STAMP"
wait_for_typesense

restored_document="$(typesense_api GET "/collections/$COLLECTION_NAME/documents/1")"
printf '%s\n' "$restored_document" | grep -q "$EXPECTED_MARKER"

echo "Typesense backup/restore validation passed."
