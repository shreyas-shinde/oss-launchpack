#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/tmp/qdrant"
BACKUP_STAMP="validation-proof"
COLLECTION_NAME="oss_launchpack_validation"
EXPECTED_MARKER="before-backup-qdrant"
QDRANT_VALIDATION_HTTP_PORT="${QDRANT_VALIDATION_HTTP_PORT:-16333}"
QDRANT_VALIDATION_GRPC_PORT="${QDRANT_VALIDATION_GRPC_PORT:-16334}"
QDRANT_URL="http://localhost:$QDRANT_VALIDATION_HTTP_PORT"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required." >&2
    exit 1
  fi
}

wait_for_qdrant() {
  attempt=0
  while [ "$attempt" -lt 60 ]; do
    if curl -fsS "$QDRANT_URL/healthz" >/dev/null 2>&1; then
      return
    fi

    attempt=$((attempt + 1))
    sleep 1
  done

  (cd "$TARGET_DIR" && docker compose logs qdrant) >&2
  echo "Timed out waiting for Qdrant at $QDRANT_URL." >&2
  exit 1
}

wait_for_collection_absent() {
  attempt=0
  while [ "$attempt" -lt 30 ]; do
    if ! curl -fsS "$QDRANT_URL/collections/$COLLECTION_NAME" >/dev/null 2>&1; then
      return
    fi

    attempt=$((attempt + 1))
    sleep 1
  done

  echo "Timed out waiting for Qdrant collection deletion." >&2
  exit 1
}

cleanup() {
  if [ "${KEEP_QDRANT_VALIDATION:-}" = "1" ]; then
    echo "Leaving validation stack in $TARGET_DIR because KEEP_QDRANT_VALIDATION=1"
    return
  fi

  if [ -f "$TARGET_DIR/compose.yaml" ]; then
    (cd "$TARGET_DIR" && docker compose down -v >/dev/null 2>&1) || true
  fi
}

need_command curl
need_command docker
need_command pnpm
need_command rg

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
node dist/cli.js init qdrant ./tmp/qdrant

cd "$TARGET_DIR"
trap cleanup EXIT INT TERM

QDRANT_HTTP_PORT="$QDRANT_VALIDATION_HTTP_PORT" \
  QDRANT_GRPC_PORT="$QDRANT_VALIDATION_GRPC_PORT" \
  docker compose up -d
wait_for_qdrant

APP_URL="$QDRANT_URL" ./ops/healthcheck.sh

curl -fsS -X PUT "$QDRANT_URL/collections/$COLLECTION_NAME" \
  -H 'Content-Type: application/json' \
  --data '{"vectors":{"size":4,"distance":"Dot"}}' >/dev/null

curl -fsS -X PUT "$QDRANT_URL/collections/$COLLECTION_NAME/points?wait=true" \
  -H 'Content-Type: application/json' \
  --data "{\"points\":[{\"id\":1,\"vector\":[0.1,0.2,0.3,0.4],\"payload\":{\"marker\":\"$EXPECTED_MARKER\"}}]}" >/dev/null

STAMP="$BACKUP_STAMP" ./ops/backup.sh

test -f "backups/$BACKUP_STAMP/qdrant-storage.tar.gz"
test -f "backups/$BACKUP_STAMP/qdrant-snapshots.tar.gz"

curl -fsS -X DELETE "$QDRANT_URL/collections/$COLLECTION_NAME" >/dev/null
wait_for_collection_absent

docker compose stop qdrant >/dev/null
CONFIRM_RESTORE=yes ./ops/restore.sh "backups/$BACKUP_STAMP"

QDRANT_HTTP_PORT="$QDRANT_VALIDATION_HTTP_PORT" \
  QDRANT_GRPC_PORT="$QDRANT_VALIDATION_GRPC_PORT" \
  docker compose up -d
wait_for_qdrant

curl -fsS "$QDRANT_URL/collections/$COLLECTION_NAME/points/1" | rg "$EXPECTED_MARKER" >/dev/null

echo "Qdrant backup/restore validation passed."
