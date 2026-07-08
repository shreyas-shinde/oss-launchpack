#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/tmp/posthog"
UPSTREAM_DIR="$TARGET_DIR/.upstream/posthog"
BACKUP_STAMP="validation-proof"
POSTHOG_SOURCE_REF="${POSTHOG_SOURCE_REF:-HEAD}"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required." >&2
    exit 1
  fi
}

write_marker() {
  service="$1"
  path="$2"
  marker="$3"

  docker compose exec -T "$service" sh -lc "mkdir -p '$path' && printf '%s\n' '$marker' > '$path/oss-launchpack-marker.txt'"
}

assert_marker() {
  service="$1"
  path="$2"
  marker="$3"

  restored_marker="$(docker compose exec -T "$service" sh -lc "cat '$path/oss-launchpack-marker.txt'")"
  if [ "$restored_marker" != "$marker" ]; then
    echo "$service:$path marker was not restored." >&2
    exit 1
  fi
}

assert_archive_marker() {
  archive="$1"

  tar -tzf "backups/$BACKUP_STAMP/$archive" | grep -q 'oss-launchpack-marker.txt'
}

assert_official_service_path() {
  service="$1"
  path="$2"

  if ! rg "^[[:space:]]{4}$service:" "$UPSTREAM_DIR/docker-compose.hobby.yml" >/dev/null; then
    echo "Official PostHog hobby Compose no longer contains service: $service" >&2
    exit 1
  fi

  if ! rg --fixed-strings "$path" "$UPSTREAM_DIR/docker-compose.hobby.yml" "$UPSTREAM_DIR/docker-compose.base.yml" >/dev/null; then
    echo "Official PostHog hobby Compose no longer exposes $service path: $path" >&2
    exit 1
  fi
}

cleanup() {
  if [ "${KEEP_POSTHOG_VALIDATION:-}" = "1" ]; then
    echo "Leaving validation stack in $TARGET_DIR because KEEP_POSTHOG_VALIDATION=1"
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
node dist/cli.js init posthog ./tmp/posthog

mkdir -p "$UPSTREAM_DIR"
curl -fsSL "https://raw.githubusercontent.com/PostHog/posthog/$POSTHOG_SOURCE_REF/docker-compose.hobby.yml" > "$UPSTREAM_DIR/docker-compose.hobby.yml"
curl -fsSL "https://raw.githubusercontent.com/PostHog/posthog/$POSTHOG_SOURCE_REF/docker-compose.base.yml" > "$UPSTREAM_DIR/docker-compose.base.yml"
touch "$UPSTREAM_DIR/.env.services"
mkdir -p "$UPSTREAM_DIR/posthog/docker/temporal/dynamicconfig"
mkdir -p "$UPSTREAM_DIR/posthog/docker/livestream"
mkdir -p "$UPSTREAM_DIR/posthog/docker/clickhouse/config.d"
mkdir -p "$UPSTREAM_DIR/posthog/docker/clickhouse/docker-entrypoint-initdb.d"
mkdir -p "$UPSTREAM_DIR/posthog/posthog/idl"
mkdir -p "$UPSTREAM_DIR/posthog/posthog/user_scripts"
mkdir -p "$UPSTREAM_DIR/compose"
mkdir -p "$UPSTREAM_DIR/share"
touch "$UPSTREAM_DIR/posthog/docker/temporal/dynamicconfig/development-sql.yaml"
touch "$UPSTREAM_DIR/posthog/docker/livestream/configs-hobby.yml"
touch "$UPSTREAM_DIR/posthog/docker/clickhouse/config.xml"
touch "$UPSTREAM_DIR/posthog/docker/clickhouse/config.d/default.xml"
touch "$UPSTREAM_DIR/posthog/docker/clickhouse/users.xml"
touch "$UPSTREAM_DIR/posthog/docker/clickhouse/user_defined_function.xml"

(
  cd "$UPSTREAM_DIR"
  DOMAIN=localhost \
    POSTHOG_SECRET=oss-launchpack-posthog-secret \
    ENCRYPTION_SALT_KEYS=oss-launchpack-encryption-salt \
    BROWSERLESS_SECRET=oss-launchpack-browserless-secret \
    REGISTRY_URL=posthog/posthog \
    POSTHOG_APP_TAG=latest \
    TLS_BLOCK= \
    docker compose -f docker-compose.hobby.yml config --services >/dev/null
)

assert_official_service_path db /var/lib/postgresql/data
assert_official_service_path clickhouse /var/lib/clickhouse
assert_official_service_path seaweedfs /data
assert_official_service_path objectstorage /data
assert_official_service_path kafka /bitnami/kafka
assert_official_service_path redis7 /data
assert_official_service_path proxy /data
assert_official_service_path proxy /config

cat > "$TARGET_DIR/.env" <<'ENV'
COMPOSE_PROJECT_NAME=osslaunchpackposthogvalidation
POSTHOG_HEALTH_URL=http://localhost:18080/_health
ENV

cat > "$TARGET_DIR/compose.yaml" <<'YAML'
services:
  db:
    image: alpine:3.20
    command: sh -c "mkdir -p /var/lib/postgresql/data && sleep infinity"
    volumes:
      - posthog-postgres-data:/var/lib/postgresql/data

  clickhouse:
    image: alpine:3.20
    command: sh -c "mkdir -p /var/lib/clickhouse && sleep infinity"
    volumes:
      - posthog-clickhouse-data:/var/lib/clickhouse

  seaweedfs:
    image: alpine:3.20
    command: sh -c "mkdir -p /data && sleep infinity"
    volumes:
      - posthog-seaweedfs-data:/data

  objectstorage:
    image: alpine:3.20
    command: sh -c "mkdir -p /data && sleep infinity"
    volumes:
      - posthog-objectstorage-data:/data

  kafka:
    image: alpine:3.20
    command: sh -c "mkdir -p /bitnami/kafka && sleep infinity"
    volumes:
      - posthog-kafka-data:/bitnami/kafka

  redis7:
    image: alpine:3.20
    command: sh -c "mkdir -p /data && sleep infinity"
    volumes:
      - posthog-redis-data:/data

  proxy:
    image: alpine:3.20
    command: sh -c "mkdir -p /data /config && sleep infinity"
    volumes:
      - posthog-caddy-data:/data
      - posthog-caddy-config:/config

volumes:
  posthog-postgres-data:
  posthog-clickhouse-data:
  posthog-seaweedfs-data:
  posthog-objectstorage-data:
  posthog-kafka-data:
  posthog-redis-data:
  posthog-caddy-data:
  posthog-caddy-config:
YAML

cd "$TARGET_DIR"
trap cleanup EXIT INT TERM

docker compose config >/dev/null
docker compose up -d --wait

write_marker db /var/lib/postgresql/data before-backup-posthog-postgres
write_marker clickhouse /var/lib/clickhouse before-backup-posthog-clickhouse
write_marker seaweedfs /data before-backup-posthog-seaweedfs
write_marker objectstorage /data before-backup-posthog-objectstorage
write_marker kafka /bitnami/kafka before-backup-posthog-kafka
write_marker redis7 /data before-backup-posthog-redis
write_marker proxy /data before-backup-posthog-caddy-data
write_marker proxy /config before-backup-posthog-caddy-config

STAMP="$BACKUP_STAMP" ./ops/backup.sh

assert_archive_marker posthog-postgres.tar.gz
assert_archive_marker posthog-clickhouse.tar.gz
assert_archive_marker posthog-seaweedfs.tar.gz
assert_archive_marker posthog-objectstorage.tar.gz
assert_archive_marker posthog-kafka.tar.gz
assert_archive_marker posthog-redis.tar.gz
assert_archive_marker posthog-caddy-data.tar.gz
assert_archive_marker posthog-caddy-config.tar.gz

docker compose exec -T db sh -lc 'rm -f /var/lib/postgresql/data/oss-launchpack-marker.txt'
docker compose exec -T clickhouse sh -lc 'rm -f /var/lib/clickhouse/oss-launchpack-marker.txt'
docker compose exec -T seaweedfs sh -lc 'rm -f /data/oss-launchpack-marker.txt'
docker compose exec -T objectstorage sh -lc 'rm -f /data/oss-launchpack-marker.txt'
docker compose exec -T kafka sh -lc 'rm -f /bitnami/kafka/oss-launchpack-marker.txt'
docker compose exec -T redis7 sh -lc 'rm -f /data/oss-launchpack-marker.txt'
docker compose exec -T proxy sh -lc 'rm -f /data/oss-launchpack-marker.txt /config/oss-launchpack-marker.txt'

CONFIRM_RESTORE=yes ./ops/restore.sh "backups/$BACKUP_STAMP"

assert_marker db /var/lib/postgresql/data before-backup-posthog-postgres
assert_marker clickhouse /var/lib/clickhouse before-backup-posthog-clickhouse
assert_marker seaweedfs /data before-backup-posthog-seaweedfs
assert_marker objectstorage /data before-backup-posthog-objectstorage
assert_marker kafka /bitnami/kafka before-backup-posthog-kafka
assert_marker redis7 /data before-backup-posthog-redis
assert_marker proxy /data before-backup-posthog-caddy-data
assert_marker proxy /config before-backup-posthog-caddy-config

echo "PostHog backup/restore validation passed."
