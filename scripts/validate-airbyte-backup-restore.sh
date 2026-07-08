#!/usr/bin/env sh
set -eu
export LC_ALL=C

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/tmp/airbyte"
BACKUP_STAMP="validation-proof"
EXPECTED_DB_MARKER="before-backup-airbyte-postgres"
EXPECTED_MINIO_MARKER="before-backup-airbyte-minio"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required." >&2
    exit 1
  fi
}

assert_contains() {
  file="$1"
  expected="$2"

  if ! rg --fixed-strings "$expected" "$file" >/dev/null; then
    echo "Expected $file to contain: $expected" >&2
    exit 1
  fi
}

cleanup() {
  if [ "${KEEP_AIRBYTE_VALIDATION:-}" = "1" ]; then
    echo "Leaving Airbyte validation harness in $TARGET_DIR because KEEP_AIRBYTE_VALIDATION=1"
    return
  fi

  rm -rf "$TARGET_DIR"
}

write_fake_tools() {
  mkdir -p "$FAKE_BIN_DIR"

  cat > "$FAKE_BIN_DIR/kubectl" <<'SH'
#!/usr/bin/env sh
set -eu

state="${FAKE_AIRBYTE_STATE_DIR:?Set FAKE_AIRBYTE_STATE_DIR}"
log="${FAKE_KUBECTL_LOG:?Set FAKE_KUBECTL_LOG}"

printf '%s\n' "$*" >> "$log"

if [ "${1:-}" = "--kubeconfig" ]; then
  shift 2
else
  echo "validation kubectl requires an explicit --kubeconfig argument." >&2
  exit 1
fi

command="${1:-}"
case "$command" in
  get)
    resource="${2:-}"
    case "$resource" in
      secrets)
        cat "$state/k8s-secrets.yaml"
        ;;
      configmaps)
        cat "$state/k8s-configmaps.yaml"
        ;;
      pod)
        exit 0
        ;;
      pods)
        printf 'NAME READY STATUS\n'
        printf 'airbyte-db-0 1/1 Running\n'
        printf 'airbyte-minio-0 1/1 Running\n'
        ;;
      *)
        echo "unsupported kubectl get resource: $resource" >&2
        exit 1
        ;;
    esac
    ;;
  exec)
    shift
    if [ "${1:-}" = "-n" ]; then
      shift 2
    fi

    pod="${1:-}"
    shift
    if [ "${1:-}" = "--" ]; then
      shift
    fi

    exec_command="$*"
    case "$pod:$exec_command" in
      airbyte-db-0:*pg_dump*)
        cp "$state/postgres-current.sql" "$state/db-tmp-airbyte-launchpack-postgres.sql"
        ;;
      airbyte-db-0:*'DROP SCHEMA IF EXISTS public CASCADE'*)
        : > "$state/postgres-current.sql"
        ;;
      airbyte-db-0:*'/tmp/airbyte-launchpack-postgres.sql'*)
        cp "$state/db-tmp-airbyte-launchpack-postgres.sql" "$state/postgres-current.sql"
        ;;
      airbyte-db-0:*'rm -f /tmp/airbyte-launchpack-postgres.sql'*)
        rm -f "$state/db-tmp-airbyte-launchpack-postgres.sql"
        ;;
      airbyte-minio-0:*'-czf /tmp/airbyte-launchpack-minio.tar.gz'*)
        (cd "$state/minio-data" && tar -czf "$state/minio-tmp-airbyte-launchpack-minio.tar.gz" .)
        ;;
      airbyte-minio-0:*'-xzf /tmp/airbyte-launchpack-minio.tar.gz'*)
        find "$state/minio-data" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
        tar -C "$state/minio-data" -xzf "$state/minio-tmp-airbyte-launchpack-minio.tar.gz"
        rm -f "$state/minio-tmp-airbyte-launchpack-minio.tar.gz"
        ;;
      airbyte-minio-0:*'rm -f /tmp/airbyte-launchpack-minio.tar.gz'*)
        rm -f "$state/minio-tmp-airbyte-launchpack-minio.tar.gz"
        ;;
      *)
        echo "unsupported kubectl exec command for validation: $pod $exec_command" >&2
        exit 1
        ;;
    esac
    ;;
  cp)
    shift
    if [ "${1:-}" = "-n" ]; then
      shift 2
    fi

    source_path="${1:-}"
    destination_path="${2:-}"
    case "$source_path:$destination_path" in
      airbyte-db-0:/tmp/airbyte-launchpack-postgres.sql:*)
        cp "$state/db-tmp-airbyte-launchpack-postgres.sql" "$destination_path"
        ;;
      airbyte-minio-0:/tmp/airbyte-launchpack-minio.tar.gz:*)
        cp "$state/minio-tmp-airbyte-launchpack-minio.tar.gz" "$destination_path"
        ;;
      *:airbyte-db-0:/tmp/airbyte-launchpack-postgres.sql)
        cp "$source_path" "$state/db-tmp-airbyte-launchpack-postgres.sql"
        ;;
      *:airbyte-minio-0:/tmp/airbyte-launchpack-minio.tar.gz)
        cp "$source_path" "$state/minio-tmp-airbyte-launchpack-minio.tar.gz"
        ;;
      *)
        echo "unsupported kubectl cp command for validation: $source_path $destination_path" >&2
        exit 1
        ;;
    esac
    ;;
  scale)
    exit 0
    ;;
  *)
    echo "unsupported kubectl command for validation: $command" >&2
    exit 1
    ;;
esac
SH

  cat > "$FAKE_BIN_DIR/abctl" <<'SH'
#!/usr/bin/env sh
set -eu

log="${FAKE_ABCTL_LOG:?Set FAKE_ABCTL_LOG}"
printf '%s\n' "$*" >> "$log"

case "${1:-} ${2:-}" in
  "images manifest")
    printf 'airbyte/mock-platform:validation\n'
    printf 'airbyte/mock-worker:validation\n'
    ;;
  "local status")
    printf "Existing cluster 'airbyte-abctl' found\n"
    printf "Found helm chart 'airbyte-abctl'\n"
    printf "  Status: deployed\n"
    printf "Airbyte should be accessible via http://localhost:8000\n"
    ;;
  *)
    printf 'validation abctl stub ignored: %s\n' "$*" >&2
    ;;
esac
SH

  chmod +x "$FAKE_BIN_DIR/kubectl" "$FAKE_BIN_DIR/abctl"
}

assert_every_kubectl_call_used_test_kubeconfig() {
  while IFS= read -r line; do
    case "$line" in
      *"--kubeconfig $TEST_KUBECONFIG"*) ;;
      *)
        echo "kubectl call did not use the test kubeconfig: $line" >&2
        exit 1
        ;;
    esac
  done < "$KUBECTL_LOG"
}

need_command pnpm
need_command rg
need_command tar

if [ -d "$TARGET_DIR" ]; then
  rm -rf "$TARGET_DIR"
fi

cd "$ROOT_DIR"
pnpm build
node dist/cli.js init airbyte ./tmp/airbyte

cd "$TARGET_DIR"
trap cleanup EXIT INT TERM

FAKE_STATE_DIR="$TARGET_DIR/.fake-airbyte"
FAKE_BIN_DIR="$TARGET_DIR/.fake-bin"
FAKE_HOME="$TARGET_DIR/.fake-home"
KUBECTL_LOG="$FAKE_STATE_DIR/kubectl.log"
ABCTL_LOG="$FAKE_STATE_DIR/abctl.log"
TEST_KUBECONFIG="$FAKE_HOME/.airbyte/abctl/abctl.kubeconfig"

mkdir -p "$FAKE_STATE_DIR/minio-data/state" "$FAKE_HOME/.airbyte/abctl"
printf 'apiVersion: v1\nclusters: []\ncontexts: []\n' > "$TEST_KUBECONFIG"
printf 'apiVersion: v1\nkind: SecretList\nitems:\n- metadata:\n    name: airbyte-airbyte-secrets\n' > "$FAKE_STATE_DIR/k8s-secrets.yaml"
printf 'apiVersion: v1\nkind: ConfigMapList\nitems:\n- metadata:\n    name: airbyte-env\n' > "$FAKE_STATE_DIR/k8s-configmaps.yaml"
printf 'marker=%s\n' "$EXPECTED_DB_MARKER" > "$FAKE_STATE_DIR/postgres-current.sql"
printf '%s\n' "$EXPECTED_MINIO_MARKER" > "$FAKE_STATE_DIR/minio-data/state/oss-launchpack-marker.txt"
: > "$KUBECTL_LOG"
: > "$ABCTL_LOG"
write_fake_tools

cat > .env <<ENV
AIRBYTE_NAMESPACE=airbyte-abctl
AIRBYTE_KUBECONFIG=$TEST_KUBECONFIG
AIRBYTE_DB_POD=airbyte-db-0
AIRBYTE_DB_NAME=db-airbyte
AIRBYTE_DB_USER=airbyte
AIRBYTE_MINIO_POD=airbyte-minio-0
AIRBYTE_MINIO_DATA_PATH=/data
ENV

echo "Airbyte validation mode: lightweight abctl/Kubernetes harness."
echo "Proves: generated backup/restore scripts use explicit test kubeconfig, expected namespace/pod names, kubectl exec/cp flow, and documented backup artifacts."
echo "Does not prove: a full abctl local install, real kind networking, or real Airbyte application-level restore."

HOME="$FAKE_HOME" \
  PATH="$FAKE_BIN_DIR:$PATH" \
  FAKE_AIRBYTE_STATE_DIR="$FAKE_STATE_DIR" \
  FAKE_KUBECTL_LOG="$KUBECTL_LOG" \
  FAKE_ABCTL_LOG="$ABCTL_LOG" \
  STAMP="$BACKUP_STAMP" \
  ./ops/backup.sh

test -f "backups/$BACKUP_STAMP/airbyte.env"
test -f "backups/$BACKUP_STAMP/airbyte-launchpack-config.tar.gz"
test -f "backups/$BACKUP_STAMP/airbyte-abctl-state.tar.gz"
test -f "backups/$BACKUP_STAMP/airbyte-k8s-secrets.yaml"
test -f "backups/$BACKUP_STAMP/airbyte-k8s-configmaps.yaml"
test -f "backups/$BACKUP_STAMP/airbyte-postgres.sql"
test -f "backups/$BACKUP_STAMP/airbyte-minio.tar.gz"
test -f "backups/$BACKUP_STAMP/airbyte-images-manifest.txt"

printf 'marker=after-backup-airbyte-postgres\n' > "$FAKE_STATE_DIR/postgres-current.sql"
rm -f "$FAKE_STATE_DIR/minio-data/state/oss-launchpack-marker.txt"
printf 'after-backup-airbyte-minio\n' > "$FAKE_STATE_DIR/minio-data/state/after-backup-marker.txt"

HOME="$FAKE_HOME" \
  PATH="$FAKE_BIN_DIR:$PATH" \
  FAKE_AIRBYTE_STATE_DIR="$FAKE_STATE_DIR" \
  FAKE_KUBECTL_LOG="$KUBECTL_LOG" \
  FAKE_ABCTL_LOG="$ABCTL_LOG" \
  CONFIRM_RESTORE=yes \
  ./ops/restore.sh "backups/$BACKUP_STAMP"

assert_contains "$FAKE_STATE_DIR/postgres-current.sql" "$EXPECTED_DB_MARKER"
assert_contains "$FAKE_STATE_DIR/minio-data/state/oss-launchpack-marker.txt" "$EXPECTED_MINIO_MARKER"
if [ -f "$FAKE_STATE_DIR/minio-data/state/after-backup-marker.txt" ]; then
  echo "Airbyte MinIO restore did not remove post-backup marker." >&2
  exit 1
fi

assert_every_kubectl_call_used_test_kubeconfig
assert_contains "$KUBECTL_LOG" "get secrets -n airbyte-abctl -o yaml"
assert_contains "$KUBECTL_LOG" "get configmaps -n airbyte-abctl -o yaml"
assert_contains "$KUBECTL_LOG" "exec -n airbyte-abctl airbyte-db-0 -- sh -c pg_dump"
assert_contains "$KUBECTL_LOG" "cp -n airbyte-abctl airbyte-db-0:/tmp/airbyte-launchpack-postgres.sql"
assert_contains "$KUBECTL_LOG" "exec -n airbyte-abctl airbyte-minio-0 -- sh -c tar -C"
assert_contains "$KUBECTL_LOG" "scale deployment -n airbyte-abctl --all --replicas=0"
assert_contains "$ABCTL_LOG" "images manifest"
assert_contains "$ABCTL_LOG" "local status"

echo "Airbyte backup/restore validation harness passed."
