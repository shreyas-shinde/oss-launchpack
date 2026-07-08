#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/tmp/n8n"
BACKUP_STAMP="validation-proof"
EXPECTED_DB_MARKER="before-backup-n8n-validation"
EXPECTED_FILE_MARKER="before-backup-n8n-volume-marker"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required." >&2
    exit 1
  fi
}

wait_for_postgres() {
  attempt=0
  while [ "$attempt" -lt 60 ]; do
    if docker compose exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
      return
    fi
    attempt=$((attempt + 1))
    sleep 2
  done

  docker compose ps >&2
  echo "Timed out waiting for Postgres." >&2
  exit 1
}

wait_for_n8n() {
  attempt=0
  while [ "$attempt" -lt 90 ]; do
    if curl -fsS "http://localhost:15678/healthz" >/dev/null 2>&1; then
      return
    fi
    attempt=$((attempt + 1))
    sleep 2
  done

  docker compose ps >&2
  echo "Timed out waiting for n8n." >&2
  exit 1
}

cleanup() {
  if [ "${KEEP_N8N_VALIDATION:-}" = "1" ]; then
    echo "Leaving validation stack in $TARGET_DIR because KEEP_N8N_VALIDATION=1"
    return
  fi

  if [ -f "$TARGET_DIR/compose.yaml" ]; then
    (cd "$TARGET_DIR" && docker compose down -v >/dev/null 2>&1) || true
  fi
}

need_command docker
need_command curl
need_command pnpm
need_command rg
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
node dist/cli.js init n8n ./tmp/n8n

cat > "$TARGET_DIR/.env" <<'ENV'
N8N_PORT=15678
N8N_HOST=localhost
N8N_PROTOCOL=http
WEBHOOK_URL=http://localhost:15678/
POSTGRES_DB=n8n
POSTGRES_USER=n8n
POSTGRES_PASSWORD=oss-launchpack-postgres-test-password
N8N_ENCRYPTION_KEY=oss-launchpack-n8n-encryption-key-32chars
COMPOSE_PROJECT_NAME=osslaunchpackn8nvalidation
ENV

cd "$TARGET_DIR"
trap cleanup EXIT INT TERM

docker compose config >/dev/null
docker compose up -d
wait_for_postgres
wait_for_n8n

docker compose exec -T postgres sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "create table if not exists oss_launchpack_validation (id int primary key, marker text not null); insert into oss_launchpack_validation (id, marker) values (1, '\''before-backup-n8n-validation'\'') on conflict (id) do update set marker = excluded.marker;"'

docker compose exec -T n8n sh -lc \
  'printf "%s\n" before-backup-n8n-volume-marker > /home/node/.n8n/oss-launchpack-marker.txt'

STAMP="$BACKUP_STAMP" ./ops/backup.sh

rg "$EXPECTED_DB_MARKER" "backups/$BACKUP_STAMP/n8n-postgres.sql" >/dev/null
tar -tzf "backups/$BACKUP_STAMP/n8n-files.tar.gz" | grep -q 'oss-launchpack-marker.txt'

docker compose down -v
docker compose up -d
wait_for_postgres
wait_for_n8n

table_count="$(docker compose exec -T postgres sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select count(*) from information_schema.tables where table_schema='\''public'\'' and table_name='\''oss_launchpack_validation'\'';"')"

if [ "$table_count" != "0" ]; then
  echo "Expected validation table to be absent before restore; got count $table_count." >&2
  exit 1
fi

docker compose exec -T n8n sh -lc 'test ! -f /home/node/.n8n/oss-launchpack-marker.txt'

docker compose stop n8n
CONFIRM_RESTORE=yes ./ops/restore.sh "backups/$BACKUP_STAMP"
docker compose up -d n8n
wait_for_n8n

restored_db_marker="$(docker compose exec -T postgres sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select marker from oss_launchpack_validation where id = 1;"')"

restored_file_marker="$(docker compose exec -T n8n sh -lc \
  'cat /home/node/.n8n/oss-launchpack-marker.txt')"

if [ "$restored_db_marker" != "$EXPECTED_DB_MARKER" ]; then
  echo "Database marker was not restored." >&2
  exit 1
fi

if [ "$restored_file_marker" != "$EXPECTED_FILE_MARKER" ]; then
  echo "Volume marker was not restored." >&2
  exit 1
fi

./ops/healthcheck.sh

echo "n8n backup/restore validation passed."
