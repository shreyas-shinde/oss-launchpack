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

  return `# Operations Guide

This guide is generated from the ${pack.name} launchpack metadata.

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

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

BACKUP_DIR_ABS="$(absolute_path "$BACKUP_DIR")"
mkdir -p "$BACKUP_DIR_ABS"

backup_mount() {
  service="$1"
  destination="$2"
  archive="$3"

  container_id="$(docker compose ps -q "$service")"
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

  docker compose exec -T "$service" sh -lc "db=\\$(printenv $database_env || true); user=\\$(printenv $user_env || true); PGPASSWORD=\\"\\\${POSTGRES_PASSWORD:-}\\" pg_dump --clean --if-exists -U \\"\\\${user:-postgres}\\" \\"\\\${db:-postgres}\\"" > "$BACKUP_DIR_ABS/$output"
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

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

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

  container_id="$(docker compose ps -q "$service")"
  if [ -z "$container_id" ]; then
    echo "Service $service is not running. Start the stack before restoring mount $destination." >&2
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

  docker compose exec -T "$service" sh -lc "db=\\$(printenv $database_env || true); user=\\$(printenv $user_env || true); PGPASSWORD=\\"\\\${POSTGRES_PASSWORD:-}\\" psql -U \\"\\\${user:-postgres}\\" -d \\"\\\${db:-postgres}\\" -v ON_ERROR_STOP=1" < "$BACKUP_DIR_ABS/$input"
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
