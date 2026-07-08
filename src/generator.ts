import { chmod, mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getLaunchpack, type BackupTarget, type Launchpack } from './catalog.js'

export type GenerateOptions = {
  force?: boolean
}

export type GenerateResult = {
  pack: Launchpack
  targetDir: string
  files: string[]
}

export async function generateLaunchpack(
  packId: string,
  targetDir: string,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const pack = getLaunchpack(packId)
  if (!pack) {
    throw new Error(`Unknown launchpack "${packId}". Run "oss-launchpack list".`)
  }

  const absoluteTarget = path.resolve(targetDir)
  await mkdir(absoluteTarget, { recursive: true })

  const files = [
    ...pack.files,
    {
      path: 'UPSTREAM.md',
      content: `# Upstream and License Notes

This launchpack is maintained by OSS Launchpack and is not an official upstream distribution.

- App: ${pack.name}
- Upstream: ${pack.upstream}
- Support model: ${pack.supportModel}
- Sizing tier: ${pack.sizing.tier}
- License/commercial-use note: ${pack.licenseNote}

Review the upstream project's current license, trademark policy, and commercial terms before offering this app as a hosted service or embedding it in another product.
`,
    },
    {
      path: 'OPERATIONS.md',
      content: renderOperationsGuide(pack),
    },
    {
      path: 'ops/manifest.json',
      content: renderOperationsManifest(pack),
    },
    {
      path: 'ops/backup.sh',
      executable: true,
      content: renderBackupScript(pack),
    },
    {
      path: 'ops/restore.sh',
      executable: true,
      content: renderRestoreScript(pack),
    },
    {
      path: '.launchpack.json',
      content: JSON.stringify(
        {
          schema: 'oss-launchpack/v1',
          pack: pack.id,
          name: pack.name,
          upstream: pack.upstream,
          supportModel: pack.supportModel,
          licenseNote: pack.licenseNote,
          sizing: pack.sizing,
          operations: pack.operations,
          generatedBy: 'oss-launchpack',
        },
        null,
        2,
      ),
    },
  ]

  const writtenFiles: string[] = []

  for (const file of files) {
    const destination = path.join(absoluteTarget, file.path)
    assertInsideTarget(absoluteTarget, destination)

    if (!options.force && (await exists(destination))) {
      throw new Error(`Refusing to overwrite existing file: ${destination}`)
    }

    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, ensureTrailingNewline(file.content), 'utf8')

    if ('executable' in file && file.executable) {
      await chmod(destination, 0o755)
    }

    writtenFiles.push(destination)
  }

  return {
    pack,
    targetDir: absoluteTarget,
    files: writtenFiles,
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`
}

function assertInsideTarget(targetDir: string, destination: string): void {
  const relative = path.relative(targetDir, destination)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside target directory: ${destination}`)
  }
}

function renderOperationsManifest(pack: Launchpack): string {
  return JSON.stringify(
    {
      schema: 'oss-launchpack/ops/v1',
      pack: pack.id,
      name: pack.name,
      upstream: pack.upstream,
      supportModel: pack.supportModel,
      sizing: pack.sizing,
      healthcheckUrl: pack.operations.healthcheckUrl,
      backupTargets: pack.operations.backupTargets,
      upgrade: pack.operations.upgrade,
    },
    null,
    2,
  )
}

function renderOperationsGuide(pack: Launchpack): string {
  const backupTargets = pack.operations.backupTargets
    .map((target) => `- \`${target.id}\` (${target.type}): ${target.description}`)
    .join('\n')
  const upgradeNotes = pack.operations.upgrade.notes.map((note) => `- ${note}`).join('\n')
  const sizingNotes = pack.sizing.notes.map((note) => `- ${note}`).join('\n')

  return `# Operations Guide

This guide is generated from the ${pack.name} launchpack metadata.

## Sizing

- Tier: \`${pack.sizing.tier}\`
- Minimum host: ${pack.sizing.minimumCpuCores} CPU cores, ${pack.sizing.minimumMemoryGb} GB RAM
- Storage: ${pack.sizing.storage}
- Scaling: ${pack.sizing.scaling}

Notes:

${sizingNotes}

## Health Check

\`\`\`bash
./ops/healthcheck.sh
\`\`\`

Default URL: ${pack.operations.healthcheckUrl}

## Backup

\`\`\`bash
./ops/backup.sh
\`\`\`

Backups are written under \`./backups/<timestamp>\` by default. Set \`BACKUP_DIR\`
to write to a specific directory.

Backup targets:

${backupTargets}

## Restore

Restore is destructive. Point the script at a backup directory and confirm the
operation explicitly:

\`\`\`bash
CONFIRM_RESTORE=yes ./ops/restore.sh ./backups/<timestamp>
\`\`\`

Stop write-heavy app traffic before restoring production data.
For Postgres-backed apps, stop application services that write to the database
while keeping the database service available for the restore.
PostgreSQL restores reset the target database's \`public\` schema before loading
the dump, so only run them against the intended restore target.

## Upgrade

\`\`\`bash
${pack.operations.upgrade.command}
\`\`\`

Notes:

${upgradeNotes}
`
}

function renderBackupScript(pack: Launchpack): string {
  const actions = pack.operations.backupTargets.map(renderBackupAction).join('\n')

  return `#!/usr/bin/env sh
set -eu

BACKUP_ROOT="\${BACKUP_ROOT:-./backups}"
STAMP="\${STAMP:-$(date +%Y%m%d-%H%M%S)}"
BACKUP_DIR="\${BACKUP_DIR:-$BACKUP_ROOT/$STAMP}"

absolute_path() {
  case "$1" in
    /*) printf '%s\\n' "$1" ;;
    *) printf '%s\\n' "$(pwd)/$1" ;;
  esac
}

read_env_file_value() {
  env_file="$1"
  key="$2"

  if [ ! -f "$env_file" ]; then
    return 1
  fi

  awk -v key="$key" '
    /^[[:space:]]*#/ || !/=/{ next }
    {
      line = $0
      split(line, pair, "=")
      if (pair[1] == key) {
        sub(/^[^=]*=/, "", line)
        print line
        exit
      }
    }
  ' "$env_file"
}

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return
  fi

  echo "Docker Compose is required. Install the Docker Compose plugin or docker-compose." >&2
  exit 1
}

BACKUP_DIR_ABS="$(absolute_path "$BACKUP_DIR")"
mkdir -p "$BACKUP_DIR_ABS"

backup_mount() {
  service="$1"
  destination="$2"
  archive="$3"

  container_id="$(compose ps -q "$service")"
  if [ -z "$container_id" ]; then
    echo "Service $service is not running. Start the stack before backing up mount $destination." >&2
    exit 1
  fi

  source_path="$(docker inspect "$container_id" --format "{{range .Mounts}}{{if eq .Destination \\"$destination\\"}}{{.Source}}{{end}}{{end}}")"
  if [ -z "$source_path" ]; then
    echo "Could not find mount $destination on service $service." >&2
    exit 1
  fi

  docker run --rm \\
    -v "$source_path:/data:ro" \\
    -v "$BACKUP_DIR_ABS:/backup" \\
    alpine:3.20 \\
    sh -c "tar -C /data -czf /backup/$archive ."
}

backup_postgres() {
  service="$1"
  user_env="$2"
  database_env="$3"
  output="$4"

  compose exec -T "$service" sh -lc "db=\\$(printenv $database_env || true); user=\\$(printenv $user_env || true); PGPASSWORD=\\"\\\${POSTGRES_PASSWORD:-}\\" pg_dump --clean --if-exists -U \\"\\\${user:-postgres}\\" \\"\\\${db:-postgres}\\"" > "$BACKUP_DIR_ABS/$output"
}

${actions}

cat > "$BACKUP_DIR_ABS/manifest.json" <<'JSON'
${renderOperationsManifest(pack)}
JSON

echo "Backup written to $BACKUP_DIR_ABS"
`
}

function renderRestoreScript(pack: Launchpack): string {
  const actions = pack.operations.backupTargets.map(renderRestoreAction).join('\n')

  return `#!/usr/bin/env sh
set -eu

if [ "\${CONFIRM_RESTORE:-}" != "yes" ]; then
  echo "Restore is destructive. Re-run with CONFIRM_RESTORE=yes." >&2
  exit 1
fi

BACKUP_DIR="\${1:-\${BACKUP_DIR:-}}"
if [ -z "$BACKUP_DIR" ]; then
  echo "Usage: CONFIRM_RESTORE=yes ./ops/restore.sh ./backups/<timestamp>" >&2
  exit 1
fi

absolute_path() {
  case "$1" in
    /*) printf '%s\\n' "$1" ;;
    *) printf '%s\\n' "$(pwd)/$1" ;;
  esac
}

read_env_file_value() {
  env_file="$1"
  key="$2"

  if [ ! -f "$env_file" ]; then
    return 1
  fi

  awk -v key="$key" '
    /^[[:space:]]*#/ || !/=/{ next }
    {
      line = $0
      split(line, pair, "=")
      if (pair[1] == key) {
        sub(/^[^=]*=/, "", line)
        print line
        exit
      }
    }
  ' "$env_file"
}

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return
  fi

  echo "Docker Compose is required. Install the Docker Compose plugin or docker-compose." >&2
  exit 1
}

BACKUP_DIR_ABS="$(absolute_path "$BACKUP_DIR")"
if [ ! -d "$BACKUP_DIR_ABS" ]; then
  echo "Backup directory does not exist: $BACKUP_DIR_ABS" >&2
  exit 1
fi

restore_mount() {
  service="$1"
  destination="$2"
  archive="$3"

  if [ ! -f "$BACKUP_DIR_ABS/$archive" ]; then
    echo "Missing archive: $BACKUP_DIR_ABS/$archive" >&2
    exit 1
  fi

  container_id="$(compose ps -a -q "$service" | head -n 1)"
  if [ -z "$container_id" ]; then
    echo "Service $service does not have a container. Create the stack before restoring mount $destination." >&2
    exit 1
  fi

  source_path="$(docker inspect "$container_id" --format "{{range .Mounts}}{{if eq .Destination \\"$destination\\"}}{{.Source}}{{end}}{{end}}")"
  if [ -z "$source_path" ]; then
    echo "Could not find mount $destination on service $service." >&2
    exit 1
  fi

  docker run --rm -i \\
    -v "$source_path:/data" \\
    alpine:3.20 \\
    sh -c 'set -eu; find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} +; tar -C /data -xzf -' \\
    < "$BACKUP_DIR_ABS/$archive"
}

restore_postgres() {
  service="$1"
  user_env="$2"
  database_env="$3"
  input="$4"

  if [ ! -f "$BACKUP_DIR_ABS/$input" ]; then
    echo "Missing dump: $BACKUP_DIR_ABS/$input" >&2
    exit 1
  fi

  compose exec -T "$service" sh -lc "db=\\$(printenv $database_env || true); user=\\$(printenv $user_env || true); PGPASSWORD=\\"\\\${POSTGRES_PASSWORD:-}\\" psql -U \\"\\\${user:-postgres}\\" -d \\"\\\${db:-postgres}\\" -v ON_ERROR_STOP=1 -c \\"DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;\\""
  compose exec -T "$service" sh -lc "db=\\$(printenv $database_env || true); user=\\$(printenv $user_env || true); PGPASSWORD=\\"\\\${POSTGRES_PASSWORD:-}\\" psql -U \\"\\\${user:-postgres}\\" -d \\"\\\${db:-postgres}\\" -v ON_ERROR_STOP=1" < "$BACKUP_DIR_ABS/$input"
}

${actions}

echo "Restore completed from $BACKUP_DIR_ABS"
`
}

function renderBackupAction(target: BackupTarget): string {
  switch (target.type) {
    case 'mount':
      return `backup_mount ${shellQuote(target.service)} ${shellQuote(target.path)} ${shellQuote(
        `${target.id}.tar.gz`,
      )}`
    case 'postgres':
      return `backup_postgres ${shellQuote(target.service)} ${shellQuote(
        target.userEnv,
      )} ${shellQuote(target.databaseEnv)} ${shellQuote(`${target.id}.sql`)}`
    case 'command':
      return [
        `echo ${shellQuote(`Running ${target.id}: ${target.description}`)}`,
        ...target.backupCommands,
      ].join('\n')
  }
}

function renderRestoreAction(target: BackupTarget): string {
  switch (target.type) {
    case 'mount':
      return `restore_mount ${shellQuote(target.service)} ${shellQuote(target.path)} ${shellQuote(
        `${target.id}.tar.gz`,
      )}`
    case 'postgres':
      return `restore_postgres ${shellQuote(target.service)} ${shellQuote(
        target.userEnv,
      )} ${shellQuote(target.databaseEnv)} ${shellQuote(`${target.id}.sql`)}`
    case 'command':
      return [
        `echo ${shellQuote(`Restoring ${target.id}: ${target.description}`)}`,
        ...target.restoreCommands,
      ].join('\n')
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`
}
