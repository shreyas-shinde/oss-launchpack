#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/tmp/supabase"
BACKUP_STAMP="validation-proof"
EXPECTED_DB_MARKER="before-backup-supabase-validation"
EXPECTED_FILE_MARKER="before-backup-supabase-storage-marker"
EXPECTED_STORAGE_BUCKET="oss-launchpack-validation"
EXPECTED_STORAGE_OBJECT="restored-object.txt"
EXPECTED_STORAGE_METADATA_MARKER="before-backup-supabase-storage-metadata"

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

wait_for_supabase() {
  attempt=0
  while [ "$attempt" -lt 120 ]; do
    status="$(curl -sS -o /dev/null -w '%{http_code}' http://localhost:18000/rest/v1/ || true)"
    case "$status" in
      2*|3*|401|403|404)
        return
        ;;
    esac

    attempt=$((attempt + 1))
    sleep 2
  done

  (cd "$TARGET_DIR/self-hosted" && docker compose ps) >&2
  echo "Timed out waiting for Supabase gateway." >&2
  exit 1
}

cleanup() {
  if [ "${KEEP_SUPABASE_VALIDATION:-}" = "1" ]; then
    echo "Leaving validation stack in $TARGET_DIR because KEEP_SUPABASE_VALIDATION=1"
    return
  fi

  if [ -f "$TARGET_DIR/self-hosted/docker-compose.yml" ]; then
    (cd "$TARGET_DIR/self-hosted" && docker compose down -v >/dev/null 2>&1) || true
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

existing_supabase_containers="$(docker ps -a --format '{{.Names}}' | grep -E '^(supabase-|realtime-dev\.supabase-realtime$)' || true)"
if [ -n "$existing_supabase_containers" ] && [ ! -f "$TARGET_DIR/self-hosted/docker-compose.yml" ]; then
  echo "Existing Supabase containers were found:" >&2
  printf '%s\n' "$existing_supabase_containers" >&2
  echo "Stop them first, or set KEEP_SUPABASE_VALIDATION=1 only after inspecting the conflict." >&2
  exit 1
fi

if [ -f "$TARGET_DIR/self-hosted/docker-compose.yml" ]; then
  (cd "$TARGET_DIR/self-hosted" && docker compose down -v >/dev/null 2>&1) || true
fi

rm -rf "$TARGET_DIR"

cd "$ROOT_DIR"
pnpm build
node dist/cli.js init supabase ./tmp/supabase

cat > "$TARGET_DIR/.env" <<ENV
SUPABASE_SOURCE_REF=${SUPABASE_SOURCE_REF:-master}
SUPABASE_PROJECT_DIR=self-hosted
SUPABASE_UPSTREAM_DIR=.upstream/supabase
SUPABASE_HEALTH_URL=http://localhost:18000/rest/v1/
ENV

cd "$TARGET_DIR"
trap cleanup EXIT INT TERM

./ops/install-official.sh

cd "$TARGET_DIR/self-hosted"
sh utils/generate-keys.sh --update-env >/dev/null
sh utils/add-new-auth-keys.sh --update-env >/dev/null

set_env .env COMPOSE_FILE docker-compose.yml
set_env .env SUPABASE_PUBLIC_URL http://localhost:18000
set_env .env API_EXTERNAL_URL http://localhost:18000/auth/v1
set_env .env SITE_URL http://localhost:18000
set_env .env KONG_HTTP_PORT 18000
set_env .env KONG_HTTPS_PORT 18443
set_env .env POSTGRES_PORT 15432
set_env .env POOLER_PROXY_PORT_TRANSACTION 16543
set_env .env POOLER_TENANT_ID osslaunchpack
set_env .env DASHBOARD_USERNAME osslaunchpack

docker compose config >/dev/null
docker compose up -d --wait
wait_for_supabase

mkdir -p "volumes/storage/$EXPECTED_STORAGE_BUCKET"
printf '%s\n' "$EXPECTED_FILE_MARKER" > "volumes/storage/$EXPECTED_STORAGE_BUCKET/marker.txt"

docker compose exec -T db sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' <<SQL
create table if not exists public.oss_launchpack_validation (
  id integer primary key,
  marker text not null
);
insert into public.oss_launchpack_validation (id, marker)
values (1, '$EXPECTED_DB_MARKER')
on conflict (id) do update set marker = excluded.marker;

insert into storage.buckets (id, name, public)
values ('$EXPECTED_STORAGE_BUCKET', '$EXPECTED_STORAGE_BUCKET', false)
on conflict (id) do update set name = excluded.name, public = excluded.public;

insert into storage.objects (bucket_id, name, metadata)
values ('$EXPECTED_STORAGE_BUCKET', '$EXPECTED_STORAGE_OBJECT', '{"marker":"$EXPECTED_STORAGE_METADATA_MARKER","mimetype":"text/plain"}'::jsonb)
on conflict (bucket_id, name) do update set metadata = excluded.metadata;
SQL

cd "$TARGET_DIR"
STAMP="$BACKUP_STAMP" ./ops/backup.sh

rg "$EXPECTED_DB_MARKER" "backups/$BACKUP_STAMP/supabase-public-schema.sql" >/dev/null
rg "$EXPECTED_STORAGE_METADATA_MARKER" "backups/$BACKUP_STAMP/supabase-storage-metadata.sql" >/dev/null
rg "$EXPECTED_STORAGE_OBJECT" "backups/$BACKUP_STAMP/supabase-storage-metadata.sql" >/dev/null
tar -tzf "backups/$BACKUP_STAMP/supabase-storage.tar.gz" | grep -q "storage/$EXPECTED_STORAGE_BUCKET/marker.txt"

rm -rf "self-hosted/volumes/storage/$EXPECTED_STORAGE_BUCKET"
(cd self-hosted && docker compose exec -T db sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' <<SQL
drop table if exists public.oss_launchpack_validation;
begin;
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = '$EXPECTED_STORAGE_BUCKET';
delete from storage.buckets where id = '$EXPECTED_STORAGE_BUCKET';
commit;
SQL
)

if [ -f "self-hosted/volumes/storage/$EXPECTED_STORAGE_BUCKET/marker.txt" ]; then
  echo "Expected storage marker to be absent before restore." >&2
  exit 1
fi

table_name="$(cd self-hosted && docker compose exec -T db sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d "$POSTGRES_DB" -tAc "select to_regclass('\'public.oss_launchpack_validation\'');"')"
if [ -n "$table_name" ]; then
  echo "Expected validation table to be absent before restore; got $table_name." >&2
  exit 1
fi

metadata_count="$(cd self-hosted && docker compose exec -T db sh -lc "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -U postgres -d \"\$POSTGRES_DB\" -tAc \"select count(*) from storage.objects where bucket_id = '$EXPECTED_STORAGE_BUCKET';\"")"
if [ "$metadata_count" != "0" ]; then
  echo "Expected validation storage metadata to be absent before restore; got $metadata_count." >&2
  exit 1
fi

CONFIRM_RESTORE=yes ./ops/restore.sh "backups/$BACKUP_STAMP"

restored_db_marker="$(cd self-hosted && docker compose exec -T db sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d "$POSTGRES_DB" -tAc "select marker from public.oss_launchpack_validation where id = 1;"')"
restored_file_marker="$(cat "self-hosted/volumes/storage/$EXPECTED_STORAGE_BUCKET/marker.txt")"
restored_storage_metadata_marker="$(cd self-hosted && docker compose exec -T db sh -lc "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -U postgres -d \"\$POSTGRES_DB\" -tAc \"select metadata->>'marker' from storage.objects where bucket_id = '$EXPECTED_STORAGE_BUCKET' and name = '$EXPECTED_STORAGE_OBJECT';\"")"

if [ "$restored_db_marker" != "$EXPECTED_DB_MARKER" ]; then
  echo "Database marker was not restored." >&2
  exit 1
fi

if [ "$restored_file_marker" != "$EXPECTED_FILE_MARKER" ]; then
  echo "Storage marker was not restored." >&2
  exit 1
fi

if [ "$restored_storage_metadata_marker" != "$EXPECTED_STORAGE_METADATA_MARKER" ]; then
  echo "Storage metadata marker was not restored." >&2
  exit 1
fi

./ops/healthcheck.sh

echo "Supabase backup/restore validation passed."
