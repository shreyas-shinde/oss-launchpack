#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/tmp/dify"
BACKUP_STAMP="validation-proof"
EXPECTED_MAIN_DB_MARKER="before-backup-dify-main-db"
EXPECTED_PLUGIN_DB_MARKER="before-backup-dify-plugin-db"
EXPECTED_APP_STORAGE_MARKER="before-backup-dify-app-storage-marker"
EXPECTED_PLUGIN_STORAGE_MARKER="before-backup-dify-plugin-storage-marker"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required." >&2
    exit 1
  fi
}

set_env() {
  file="$1"
  key="$2"
  value="$3"
  tmp="$file.tmp.$$"

  awk -v key="$key" -v value="$value" '
    BEGIN { replaced = 0 }
    $0 ~ "^" key "=" {
      print key "=" value
      replaced = 1
      next
    }
    { print }
    END {
      if (replaced == 0) {
        print key "=" value
      }
    }
  ' "$file" > "$tmp"

  mv "$tmp" "$file"
}

wait_for_postgres() {
  attempt=0
  while [ "$attempt" -lt 120 ]; do
    if (cd "$TARGET_DIR/self-hosted" && docker compose -f docker-compose.yaml exec -T db_postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d dify') >/dev/null 2>&1; then
      return
    fi
    attempt=$((attempt + 1))
    sleep 2
  done

  (cd "$TARGET_DIR/self-hosted" && docker compose -f docker-compose.yaml ps) >&2
  echo "Timed out waiting for Dify Postgres." >&2
  exit 1
}

wait_for_dify() {
  attempt=0
  while [ "$attempt" -lt 120 ]; do
    status="$(curl -sS -o /dev/null -w '%{http_code}' http://localhost:18080/ || true)"
    case "$status" in
      2*|3*|401|403|404)
        return
        ;;
    esac

    attempt=$((attempt + 1))
    sleep 2
  done

  (cd "$TARGET_DIR/self-hosted" && docker compose -f docker-compose.yaml ps) >&2
  echo "Timed out waiting for Dify gateway." >&2
  exit 1
}

cleanup() {
  if [ "${KEEP_DIFY_VALIDATION:-}" = "1" ]; then
    echo "Leaving validation stack in $TARGET_DIR because KEEP_DIFY_VALIDATION=1"
    return
  fi

  if [ -f "$TARGET_DIR/self-hosted/docker-compose.yaml" ]; then
    (cd "$TARGET_DIR/self-hosted" && docker compose -f docker-compose.yaml down -v >/dev/null 2>&1) || true
  fi
}

need_command awk
need_command curl
need_command docker
need_command git
need_command pnpm
need_command rg
need_command tar

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is required." >&2
  exit 1
fi

existing_dify_containers="$(docker ps -a --filter name=osslaunchpackdifyvalidation --format '{{.Names}}' || true)"
if [ -n "$existing_dify_containers" ] && [ ! -f "$TARGET_DIR/self-hosted/docker-compose.yaml" ]; then
  echo "Existing Dify validation containers were found:" >&2
  printf '%s\n' "$existing_dify_containers" >&2
  echo "Stop them first, or set KEEP_DIFY_VALIDATION=1 only after inspecting the conflict." >&2
  exit 1
fi

if [ -f "$TARGET_DIR/self-hosted/docker-compose.yaml" ]; then
  (cd "$TARGET_DIR/self-hosted" && docker compose -f docker-compose.yaml down -v >/dev/null 2>&1) || true
fi

rm -rf "$TARGET_DIR"

cd "$ROOT_DIR"
pnpm build
node dist/cli.js init dify ./tmp/dify

cat > "$TARGET_DIR/.env" <<ENV
DIFY_SOURCE_REF=${DIFY_SOURCE_REF:-latest}
DIFY_PROJECT_DIR=self-hosted
DIFY_UPSTREAM_DIR=.upstream/dify
DIFY_HEALTH_URL=http://localhost:18080
ENV

cd "$TARGET_DIR"
trap cleanup EXIT INT TERM

./ops/install-official.sh

cd "$TARGET_DIR/self-hosted"
set_env .env COMPOSE_PROJECT_NAME osslaunchpackdifyvalidation
set_env .env SECRET_KEY oss-launchpack-dify-secret-key-32chars
set_env .env INIT_PASSWORD oss-launchpack-dify-init-password
set_env .env EXPOSE_NGINX_PORT 18080
set_env .env EXPOSE_NGINX_SSL_PORT 18444
set_env .env EXPOSE_POSTGRES_PORT 15433
set_env .env EXPOSE_REDIS_PORT 16380
set_env .env EXPOSE_WEAVIATE_PORT 18081
set_env .env EXPOSE_PLUGIN_DAEMON_PORT 15002
set_env .env EXPOSE_PLUGIN_DEBUGGING_HOST 127.0.0.1
set_env .env EXPOSE_PLUGIN_DEBUGGING_PORT 15003
set_env .env CONSOLE_API_URL http://localhost:18080
set_env .env CONSOLE_WEB_URL http://localhost:18080
set_env .env SERVICE_API_URL http://localhost:18080
set_env .env APP_API_URL http://localhost:18080
set_env .env APP_WEB_URL http://localhost:18080
set_env .env FILES_URL http://localhost:18080

docker compose -f docker-compose.yaml config >/dev/null
docker compose -f docker-compose.yaml up -d
wait_for_postgres
wait_for_dify

mkdir -p volumes/app/storage/oss-launchpack-validation
printf '%s\n' "$EXPECTED_APP_STORAGE_MARKER" > volumes/app/storage/oss-launchpack-validation/marker.txt

mkdir -p volumes/plugin_daemon/oss-launchpack-validation
printf '%s\n' "$EXPECTED_PLUGIN_STORAGE_MARKER" > volumes/plugin_daemon/oss-launchpack-validation/marker.txt

docker compose -f docker-compose.yaml exec -T db_postgres sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d dify -v ON_ERROR_STOP=1 -c "create table if not exists public.oss_launchpack_validation (id int primary key, marker text not null); insert into public.oss_launchpack_validation (id, marker) values (1, '\''before-backup-dify-main-db'\'') on conflict (id) do update set marker = excluded.marker;"'

docker compose -f docker-compose.yaml exec -T db_postgres sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d dify_plugin -v ON_ERROR_STOP=1 -c "create table if not exists public.oss_launchpack_plugin_validation (id int primary key, marker text not null); insert into public.oss_launchpack_plugin_validation (id, marker) values (1, '\''before-backup-dify-plugin-db'\'') on conflict (id) do update set marker = excluded.marker;"'

cd "$TARGET_DIR"
STAMP="$BACKUP_STAMP" ./ops/backup.sh

rg "$EXPECTED_MAIN_DB_MARKER" "backups/$BACKUP_STAMP/dify-main-database.sql" >/dev/null
rg "$EXPECTED_PLUGIN_DB_MARKER" "backups/$BACKUP_STAMP/dify-plugin-database.sql" >/dev/null
tar -tzf "backups/$BACKUP_STAMP/dify-local-state.tar.gz" | grep -q 'volumes/app/storage/oss-launchpack-validation/marker.txt'
tar -tzf "backups/$BACKUP_STAMP/dify-local-state.tar.gz" | grep -q 'volumes/plugin_daemon/oss-launchpack-validation/marker.txt'

rm -rf self-hosted/volumes/app/storage/oss-launchpack-validation
rm -rf self-hosted/volumes/plugin_daemon/oss-launchpack-validation

(cd self-hosted && docker compose -f docker-compose.yaml exec -T db_postgres sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d dify -v ON_ERROR_STOP=1 -c "drop table if exists public.oss_launchpack_validation"')
(cd self-hosted && docker compose -f docker-compose.yaml exec -T db_postgres sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d dify_plugin -v ON_ERROR_STOP=1 -c "drop table if exists public.oss_launchpack_plugin_validation"')

if [ -f self-hosted/volumes/app/storage/oss-launchpack-validation/marker.txt ]; then
  echo "Expected app storage marker to be absent before restore." >&2
  exit 1
fi

if [ -f self-hosted/volumes/plugin_daemon/oss-launchpack-validation/marker.txt ]; then
  echo "Expected plugin storage marker to be absent before restore." >&2
  exit 1
fi

main_table_name="$(cd self-hosted && docker compose -f docker-compose.yaml exec -T db_postgres sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d dify -tAc "select to_regclass('\''public.oss_launchpack_validation'\'');"')"
if [ -n "$main_table_name" ]; then
  echo "Expected Dify main validation table to be absent before restore; got $main_table_name." >&2
  exit 1
fi

plugin_table_name="$(cd self-hosted && docker compose -f docker-compose.yaml exec -T db_postgres sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d dify_plugin -tAc "select to_regclass('\''public.oss_launchpack_plugin_validation'\'');"')"
if [ -n "$plugin_table_name" ]; then
  echo "Expected Dify plugin validation table to be absent before restore; got $plugin_table_name." >&2
  exit 1
fi

CONFIRM_RESTORE=yes ./ops/restore.sh "backups/$BACKUP_STAMP"
wait_for_postgres
wait_for_dify

restored_main_db_marker="$(cd self-hosted && docker compose -f docker-compose.yaml exec -T db_postgres sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d dify -tAc "select marker from public.oss_launchpack_validation where id = 1;"')"
restored_plugin_db_marker="$(cd self-hosted && docker compose -f docker-compose.yaml exec -T db_postgres sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d dify_plugin -tAc "select marker from public.oss_launchpack_plugin_validation where id = 1;"')"
restored_app_storage_marker="$(cat self-hosted/volumes/app/storage/oss-launchpack-validation/marker.txt)"
restored_plugin_storage_marker="$(cat self-hosted/volumes/plugin_daemon/oss-launchpack-validation/marker.txt)"

if [ "$restored_main_db_marker" != "$EXPECTED_MAIN_DB_MARKER" ]; then
  echo "Dify main database marker was not restored." >&2
  exit 1
fi

if [ "$restored_plugin_db_marker" != "$EXPECTED_PLUGIN_DB_MARKER" ]; then
  echo "Dify plugin database marker was not restored." >&2
  exit 1
fi

if [ "$restored_app_storage_marker" != "$EXPECTED_APP_STORAGE_MARKER" ]; then
  echo "Dify app storage marker was not restored." >&2
  exit 1
fi

if [ "$restored_plugin_storage_marker" != "$EXPECTED_PLUGIN_STORAGE_MARKER" ]; then
  echo "Dify plugin storage marker was not restored." >&2
  exit 1
fi

./ops/healthcheck.sh

echo "Dify backup/restore validation passed."
