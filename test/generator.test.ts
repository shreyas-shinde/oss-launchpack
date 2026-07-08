import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { listLaunchpacks } from '../src/catalog.js'
import { generateLaunchpack } from '../src/generator.js'

const execFileAsync = promisify(execFile)

test('catalog exposes the operations-ready wedges', () => {
  const ids = listLaunchpacks().map((pack) => pack.id)
  assert.deepEqual(ids, [
    'open-webui',
    'n8n',
    'memos',
    'uptime-kuma',
    'sentry',
    'posthog',
    'grafana',
    'clickhouse',
    'qdrant',
    'meilisearch',
    'typesense',
    'outline',
    'supabase',
    'dify',
    'airbyte',
    'langfuse',
    'temporal',
    'keycloak',
    'homepage',
  ])
  assert.equal(listLaunchpacks().every((pack) => pack.licenseNote.length > 0), true)
  assert.equal(listLaunchpacks().every((pack) => pack.supportModel.length > 0), true)
  assert.equal(
    listLaunchpacks().every(
      (pack) =>
        pack.sizing.minimumCpuCores > 0 &&
        pack.sizing.minimumMemoryGb > 0 &&
        pack.sizing.storage.length > 0 &&
        pack.sizing.scaling.length > 0 &&
        pack.sizing.notes.length > 0,
    ),
    true,
  )
  assert.equal(listLaunchpacks().every((pack) => pack.operations.backupTargets.length > 0), true)
  assert.notEqual(
    listLaunchpacks().find((pack) => pack.id === 'n8n')?.supportModel,
    'permissive-hosting-fit',
  )
})

test('contribution guide documents launchpack requirements', async () => {
  const guide = await readFile('CONTRIBUTING.md', 'utf8')
  const readme = await readFile('README.md', 'utf8')
  const issueTemplate = await readFile('.github/ISSUE_TEMPLATE/pack-request.yml', 'utf8')
  const pullRequestTemplate = await readFile('.github/PULL_REQUEST_TEMPLATE.md', 'utf8')

  assert.match(readme, /CONTRIBUTING\.md/)
  assert.match(readme, /Contribute a Pack/)
  assert.match(readme, /good first issue/)
  assert.match(guide, /supportModel/)
  assert.match(guide, /licenseNote/)
  assert.match(guide, /sizing/)
  assert.match(guide, /operations\.healthcheckUrl/)
  assert.match(guide, /operations\.backupTargets/)
  assert.match(guide, /operations\.upgrade/)
  assert.match(guide, /Use `mount`/)
  assert.match(guide, /Use `postgres`/)
  assert.match(guide, /License and Trademark Checklist/)
  assert.match(guide, /pnpm check/)
  assert.match(guide, /Keep private business strategy out of public issues/)
  assert.match(guide, /scripts\/validate-n8n-backup-restore\.sh/)
  assert.match(guide, /stops n8n while Postgres is restored/)
  assert.match(guide, /scripts\/validate-supabase-backup-restore\.sh/)
  assert.match(guide, /known `public` schema row/)
  assert.match(guide, /Storage bucket\/object metadata row/)
  assert.match(guide, /scripts\/validate-dify-backup-restore\.sh/)
  assert.match(guide, /main and plugin/)
  assert.match(guide, /scripts\/validate-airbyte-backup-restore\.sh/)
  assert.match(guide, /lightweight abctl\/Kubernetes harness/)
  assert.match(guide, /does not prove a full `abctl local\s+install`/i)
  assert.match(guide, /KEEP_AIRBYTE_VALIDATION/)
  assert.match(guide, /scripts\/validate-posthog-backup-restore\.sh/)
  assert.match(guide, /upstream\s+hobby Compose files/)
  assert.match(guide, /Postgres, ClickHouse, SeaweedFS, object storage, Kafka, Redis, and/)
  assert.match(guide, /scripts\/validate-qdrant-backup-restore\.sh/)
  assert.match(guide, /known vector point/)
  assert.match(guide, /KEEP_QDRANT_VALIDATION/)
  assert.match(guide, /scripts\/validate-meilisearch-backup-restore\.sh/)
  assert.match(guide, /known document\s+marker/)
  assert.match(guide, /KEEP_MEILISEARCH_VALIDATION/)
  assert.match(guide, /scripts\/validate-typesense-backup-restore\.sh/)
  assert.match(guide, /official\s+snapshot\s+endpoint/)
  assert.match(guide, /KEEP_TYPESENSE_VALIDATION/)

  assert.match(issueTemplate, /Official deployment docs/)
  assert.match(issueTemplate, /Durable state and restore boundary/)
  assert.match(issueTemplate, /Expected support model/)
  assert.match(issueTemplate, /Validation idea/)
  assert.match(issueTemplate, /permissive-hosting-fit/)

  assert.match(pullRequestTemplate, /upstream license/)
  assert.match(pullRequestTemplate, /supportModel/)
  assert.match(pullRequestTemplate, /marker-based validator/)
  assert.match(pullRequestTemplate, /private revenue, acquisition, or customer-pipeline strategy/)
})

test('generates a launchpack without overwriting by default', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('open-webui', dir)

  assert.equal(result.pack.id, 'open-webui')
  assert.equal(result.files.length, 10)

  const compose = await readFile(path.join(dir, 'compose.yaml'), 'utf8')
  assert.match(compose, /ghcr\.io\/open-webui\/open-webui:main/)

  const healthcheck = await stat(path.join(dir, 'ops/healthcheck.sh'))
  assert.equal((healthcheck.mode & 0o111) > 0, true)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /backup_mount 'open-webui' '\/app\/backend\/data' 'open-webui-data\.tar\.gz'/)
  assert.match(backup, /backup_mount 'ollama' '\/root\/\.ollama' 'ollama-models\.tar\.gz'/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /CONFIRM_RESTORE=yes/)

  const operations = await readFile(path.join(dir, 'OPERATIONS.md'), 'utf8')
  assert.match(operations, /Backup targets/)
  assert.match(operations, /## Sizing/)
  assert.match(operations, /Minimum host: 2 CPU cores, 4 GB RAM/)

  await assert.rejects(
    () => generateLaunchpack('open-webui', dir),
    /Refusing to overwrite existing file/,
  )
})

test('generates database backup and restore scripts for Postgres-backed packs', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  await generateLaunchpack('n8n', dir)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /backup_postgres 'postgres' 'POSTGRES_USER' 'POSTGRES_DB' 'n8n-postgres\.sql'/)
  assert.match(backup, /pg_dump --clean --if-exists/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /restore_postgres 'postgres' 'POSTGRES_USER' 'POSTGRES_DB' 'n8n-postgres\.sql'/)
  assert.match(restore, /DROP SCHEMA IF EXISTS public CASCADE/)
  assert.match(restore, /compose ps -a -q/)
  assert.match(restore, /psql -U/)

  const healthcheck = await readFile(path.join(dir, 'ops/healthcheck.sh'), 'utf8')
  assert.match(healthcheck, /\. \.\/\.env/)
  assert.match(healthcheck, /N8N_PORT:-5678/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"schema": "oss-launchpack\/ops\/v1"/)
  assert.match(manifest, /"sizing":/)
  assert.match(manifest, /"tier": "single-node"/)
  assert.match(manifest, /"type": "postgres"/)
})

test('n8n backup restore validator is repeatable shell', async () => {
  const script = 'scripts/validate-n8n-backup-restore.sh'
  await execFileAsync('sh', ['-n', script])

  const content = await readFile(script, 'utf8')
  assert.match(content, /docker compose stop n8n/)

  const scriptStat = await stat(script)
  assert.equal((scriptStat.mode & 0o111) > 0, true)
})

test('Supabase backup restore validator is repeatable shell', async () => {
  const script = 'scripts/validate-supabase-backup-restore.sh'
  await execFileAsync('sh', ['-n', script])

  const content = await readFile(script, 'utf8')
  assert.match(content, /SUPABASE_SOURCE_REF/)
  assert.match(content, /docker compose up -d --wait/)
  assert.match(content, /supabase-public-schema\.sql/)
  assert.match(content, /supabase-storage-metadata\.sql/)
  assert.match(content, /storage\.buckets/)
  assert.match(content, /storage\.objects/)
  assert.match(content, /oss_launchpack_validation/)
  assert.match(content, /EXPECTED_STORAGE_METADATA_MARKER/)
  assert.match(content, /KEEP_SUPABASE_VALIDATION/)

  const scriptStat = await stat(script)
  assert.equal((scriptStat.mode & 0o111) > 0, true)
})

test('Dify backup restore validator is repeatable shell', async () => {
  const script = 'scripts/validate-dify-backup-restore.sh'
  await execFileAsync('sh', ['-n', script])

  const content = await readFile(script, 'utf8')
  assert.match(content, /DIFY_SOURCE_REF/)
  assert.match(content, /docker compose -f docker-compose\.yaml up -d/)
  assert.match(content, /dify-main-database\.sql/)
  assert.match(content, /dify-plugin-database\.sql/)
  assert.match(content, /oss_launchpack_validation/)
  assert.match(content, /oss_launchpack_plugin_validation/)
  assert.match(content, /KEEP_DIFY_VALIDATION/)

  const scriptStat = await stat(script)
  assert.equal((scriptStat.mode & 0o111) > 0, true)
})

test('Airbyte backup restore validator is repeatable shell', async () => {
  const script = 'scripts/validate-airbyte-backup-restore.sh'
  await execFileAsync('sh', ['-n', script])

  const content = await readFile(script, 'utf8')
  assert.match(content, /FAKE_AIRBYTE_STATE_DIR/)
  assert.match(content, /AIRBYTE_KUBECONFIG/)
  assert.match(content, /airbyte-postgres\.sql/)
  assert.match(content, /airbyte-minio\.tar\.gz/)
  assert.match(content, /KEEP_AIRBYTE_VALIDATION/)
  assert.match(content, /Does not prove: a full abctl local install/)

  const scriptStat = await stat(script)
  assert.equal((scriptStat.mode & 0o111) > 0, true)
})

test('PostHog backup restore validator is repeatable shell', async () => {
  const script = 'scripts/validate-posthog-backup-restore.sh'
  await execFileAsync('sh', ['-n', script])

  const content = await readFile(script, 'utf8')
  assert.match(content, /POSTHOG_SOURCE_REF/)
  assert.match(content, /docker-compose\.hobby\.yml/)
  assert.match(content, /assert_official_service_path db \/var\/lib\/postgresql\/data/)
  assert.match(content, /assert_official_service_path clickhouse \/var\/lib\/clickhouse/)
  assert.match(content, /posthog-clickhouse\.tar\.gz/)
  assert.match(content, /posthog-objectstorage\.tar\.gz/)
  assert.match(content, /KEEP_POSTHOG_VALIDATION/)

  const scriptStat = await stat(script)
  assert.equal((scriptStat.mode & 0o111) > 0, true)
})

test('Qdrant backup restore validator is repeatable shell', async () => {
  const script = 'scripts/validate-qdrant-backup-restore.sh'
  await execFileAsync('sh', ['-n', script])

  const content = await readFile(script, 'utf8')
  assert.match(content, /QDRANT_VALIDATION_HTTP_PORT/)
  assert.match(content, /oss_launchpack_validation/)
  assert.match(content, /qdrant-storage\.tar\.gz/)
  assert.match(content, /qdrant-snapshots\.tar\.gz/)
  assert.match(content, /CONFIRM_RESTORE=yes/)
  assert.match(content, /KEEP_QDRANT_VALIDATION/)

  const scriptStat = await stat(script)
  assert.equal((scriptStat.mode & 0o111) > 0, true)
})

test('Meilisearch backup restore validator is repeatable shell', async () => {
  const script = 'scripts/validate-meilisearch-backup-restore.sh'
  await execFileAsync('sh', ['-n', script])

  const content = await readFile(script, 'utf8')
  assert.match(content, /MEILISEARCH_VALIDATION_PORT/)
  assert.match(content, /oss_launchpack_validation/)
  assert.match(content, /meilisearch-data\.tar\.gz/)
  assert.match(content, /CONFIRM_RESTORE=yes/)
  assert.match(content, /KEEP_MEILISEARCH_VALIDATION/)

  const scriptStat = await stat(script)
  assert.equal((scriptStat.mode & 0o111) > 0, true)
})

test('Typesense backup restore validator is repeatable shell', async () => {
  const script = 'scripts/validate-typesense-backup-restore.sh'
  await execFileAsync('sh', ['-n', script])

  const content = await readFile(script, 'utf8')
  assert.match(content, /TYPESENSE_VALIDATION_PORT/)
  assert.match(content, /oss_launchpack_validation/)
  assert.match(content, /typesense-snapshot\.tar\.gz/)
  assert.match(content, /CONFIRM_RESTORE=yes/)
  assert.match(content, /KEEP_TYPESENSE_VALIDATION/)

  const scriptStat = await stat(script)
  assert.equal((scriptStat.mode & 0o111) > 0, true)
})

test('generates a Typesense pack with official snapshot backup commands', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  await generateLaunchpack('typesense', dir)

  const compose = await readFile(path.join(dir, 'compose.yaml'), 'utf8')
  assert.match(compose, /typesense\/typesense:\$\{TYPESENSE_VERSION:-30\.2\}/)
  assert.match(compose, /--data-dir/)
  assert.match(compose, /--api-key=\$\{TYPESENSE_API_KEY:\?Set TYPESENSE_API_KEY in \.env\}/)
  assert.match(compose, /typesense-data:\/data/)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /\/operations\/snapshot\?snapshot_path=\$snapshot_path/)
  assert.match(backup, /typesense-snapshot\.tar\.gz/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /compose stop typesense/)
  assert.match(restore, /typesense-snapshot\.tar\.gz/)
})

test('generates a Sentry wrapper around the official self-hosted repository', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('sentry', dir)

  assert.equal(result.files.some((file) => file.endsWith('compose.yaml')), false)

  const readme = await readFile(path.join(dir, 'README.md'), 'utf8')
  assert.match(readme, /wraps the official `getsentry\/self-hosted` repository/)
  assert.match(readme, /do not resell hosted Sentry access/)

  const install = await readFile(path.join(dir, 'ops/install-official.sh'), 'utf8')
  assert.match(install, /git clone https:\/\/github\.com\/getsentry\/self-hosted\.git/)
  assert.match(install, /--no-report-self-hosted-issues/)

  const installStat = await stat(path.join(dir, 'ops/install-official.sh'))
  assert.equal((installStat.mode & 0o111) > 0, true)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /\.\/scripts\/backup\.sh global/)
  assert.match(backup, /sentry-partial-global\.json/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /\.\/scripts\/restore\.sh global/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"type": "command"/)
  assert.match(manifest, /"supportModel": "customer-owned-only"/)
})

test('generates a PostHog wrapper with hobby deployment backup targets', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('posthog', dir)

  assert.equal(result.files.some((file) => file.endsWith('compose.yaml')), false)

  const readme = await readFile(path.join(dir, 'README.md'), 'utf8')
  assert.match(readme, /wraps PostHog's official Docker Compose hobby deployment/)
  assert.match(readme, /do not present it as PostHog Cloud/)

  const install = await readFile(path.join(dir, 'ops/install-official.sh'), 'utf8')
  assert.match(install, /raw\.githubusercontent\.com\/posthog\/posthog\/HEAD\/bin\/deploy-hobby/)
  assert.match(install, /POSTHOG_DOMAIN/)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /backup_mount 'db' '\/var\/lib\/postgresql\/data' 'posthog-postgres\.tar\.gz'/)
  assert.match(
    backup,
    /backup_mount 'clickhouse' '\/var\/lib\/clickhouse' 'posthog-clickhouse\.tar\.gz'/,
  )
  assert.match(backup, /backup_mount 'seaweedfs' '\/data' 'posthog-seaweedfs\.tar\.gz'/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /restore_mount 'objectstorage' '\/data' 'posthog-objectstorage\.tar\.gz'/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"pack": "posthog"/)
  assert.match(manifest, /"supportModel": "customer-owned-only"/)
  assert.match(manifest, /"id": "posthog-clickhouse"/)
})

test('generates a Grafana launchpack with Postgres and provisioning backups', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('grafana', dir)

  assert.equal(result.pack.id, 'grafana')

  const compose = await readFile(path.join(dir, 'compose.yaml'), 'utf8')
  assert.match(compose, /grafana\/grafana:\$\{GRAFANA_VERSION:-latest\}/)
  assert.match(compose, /postgres:16-alpine/)
  assert.match(compose, /GF_DATABASE_TYPE: postgres/)
  assert.match(compose, /\/var\/lib\/grafana/)
  assert.match(compose, /\/etc\/grafana\/provisioning/)
  assert.match(compose, /\/var\/lib\/grafana\/dashboards/)

  const env = await readFile(path.join(dir, '.env.example'), 'utf8')
  assert.match(env, /GRAFANA_ADMIN_PASSWORD=/)
  assert.match(env, /POSTGRES_PASSWORD=/)

  const readme = await readFile(path.join(dir, 'README.md'), 'utf8')
  assert.match(readme, /Grafana Cloud/)
  assert.match(readme, /AGPL-3\.0-only/)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /backup_postgres 'postgres' 'POSTGRES_USER' 'POSTGRES_DB' 'grafana-postgres\.sql'/)
  assert.match(backup, /backup_mount 'grafana' '\/var\/lib\/grafana' 'grafana-data\.tar\.gz'/)
  assert.match(
    backup,
    /backup_mount 'grafana' '\/etc\/grafana\/provisioning' 'grafana-provisioning\.tar\.gz'/,
  )
  assert.match(
    backup,
    /backup_mount 'grafana' '\/var\/lib\/grafana\/dashboards' 'grafana-dashboards\.tar\.gz'/,
  )

  const healthcheck = await readFile(path.join(dir, 'ops/healthcheck.sh'), 'utf8')
  assert.match(healthcheck, /\/api\/health/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"pack": "grafana"/)
  assert.match(manifest, /"supportModel": "customer-owned-only"/)

  const dashboardProvider = await readFile(
    path.join(dir, 'provisioning/dashboards/default.yaml'),
    'utf8',
  )
  assert.match(dashboardProvider, /\/var\/lib\/grafana\/dashboards/)
})

test('generates a ClickHouse launchpack with native backup disk', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('clickhouse', dir)

  assert.equal(result.pack.id, 'clickhouse')

  const compose = await readFile(path.join(dir, 'compose.yaml'), 'utf8')
  assert.match(compose, /clickhouse\/clickhouse-server:\$\{CLICKHOUSE_VERSION:-latest\}/)
  assert.match(compose, /nofile:/)
  assert.match(compose, /\/var\/lib\/clickhouse/)
  assert.match(compose, /\/var\/log\/clickhouse-server/)
  assert.match(compose, /\/backups/)
  assert.match(compose, /\/etc\/clickhouse-server\/config\.d/)
  assert.match(compose, /\/etc\/clickhouse-server\/users\.d/)

  const env = await readFile(path.join(dir, '.env.example'), 'utf8')
  assert.match(env, /CLICKHOUSE_DB=analytics/)
  assert.match(env, /CLICKHOUSE_PASSWORD=/)

  const backupDisk = await readFile(path.join(dir, 'config.d/backup-disk.xml'), 'utf8')
  assert.match(backupDisk, /<allowed_disk>launchpack_backups<\/allowed_disk>/)
  assert.match(backupDisk, /<allow_concurrent_restores>false<\/allow_concurrent_restores>/)

  const readme = await readFile(path.join(dir, 'README.md'), 'utf8')
  assert.match(readme, /ClickHouse Cloud/)
  assert.match(readme, /clickhouse-native-backup\.zip/)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /BACKUP DATABASE \$clickhouse_database TO Disk\('launchpack_backups'/)
  assert.match(backup, /clickhouse-native-backup\.zip/)
  assert.match(backup, /docker cp/)
  assert.match(backup, /backup_mount 'clickhouse' '\/etc\/clickhouse-server\/config\.d'/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /DROP DATABASE IF EXISTS \$clickhouse_database/)
  assert.match(restore, /RESTORE DATABASE \$clickhouse_database FROM Disk\('launchpack_backups'/)
  assert.match(restore, /clickhouse-native-backup\.zip/)

  const healthcheck = await readFile(path.join(dir, 'ops/healthcheck.sh'), 'utf8')
  assert.match(healthcheck, /clickhouse-client/)
  assert.match(healthcheck, /SELECT 1/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"pack": "clickhouse"/)
  assert.match(manifest, /"supportModel": "permissive-hosting-fit"/)
  assert.match(manifest, /"type": "command"/)
  assert.match(manifest, /clickhouse:\/\/localhost:9000/)
})

test('generates a Qdrant launchpack with durable storage and snapshots', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('qdrant', dir)

  assert.equal(result.pack.id, 'qdrant')

  const compose = await readFile(path.join(dir, 'compose.yaml'), 'utf8')
  assert.match(compose, /qdrant\/qdrant:\$\{QDRANT_VERSION:-latest\}/)
  assert.match(compose, /\$\{QDRANT_HTTP_PORT:-6333\}:6333/)
  assert.match(compose, /\$\{QDRANT_GRPC_PORT:-6334\}:6334/)
  assert.match(compose, /qdrant-storage:\/qdrant\/storage/)
  assert.match(compose, /qdrant-snapshots:\/qdrant\/snapshots/)
  assert.match(compose, /\.\/config\/production\.yaml:\/qdrant\/config\/production\.yaml:ro/)

  const env = await readFile(path.join(dir, '.env.example'), 'utf8')
  assert.match(env, /QDRANT_VERSION=latest/)
  assert.match(env, /QDRANT_URL=http:\/\/localhost:6333/)

  const config = await readFile(path.join(dir, 'config/production.yaml'), 'utf8')
  assert.match(config, /snapshots_path: \/qdrant\/snapshots/)
  assert.match(config, /service\.api_key/)
  assert.match(config, /#   api_key:/)
  assert.match(config, /#   read_only_api_key:/)

  const readme = await readFile(path.join(dir, 'README.md'), 'utf8')
  assert.match(readme, /Qdrant Cloud/)
  assert.match(readme, /TLS/)
  assert.match(readme, /Stop writes before restoring/)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /backup_mount 'qdrant' '\/qdrant\/storage' 'qdrant-storage\.tar\.gz'/)
  assert.match(
    backup,
    /backup_mount 'qdrant' '\/qdrant\/snapshots' 'qdrant-snapshots\.tar\.gz'/,
  )

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /restore_mount 'qdrant' '\/qdrant\/storage' 'qdrant-storage\.tar\.gz'/)
  assert.match(
    restore,
    /restore_mount 'qdrant' '\/qdrant\/snapshots' 'qdrant-snapshots\.tar\.gz'/,
  )

  const healthcheck = await readFile(path.join(dir, 'ops/healthcheck.sh'), 'utf8')
  assert.match(healthcheck, /\/healthz/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"pack": "qdrant"/)
  assert.match(manifest, /"supportModel": "permissive-hosting-fit"/)
  assert.match(manifest, /"id": "qdrant-snapshots"/)
})

test('generates a Meilisearch launchpack with master-key and data backups', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('meilisearch', dir)

  assert.equal(result.pack.id, 'meilisearch')

  const compose = await readFile(path.join(dir, 'compose.yaml'), 'utf8')
  assert.match(compose, /getmeili\/meilisearch:\$\{MEILISEARCH_VERSION:-latest\}/)
  assert.match(compose, /\$\{MEILISEARCH_PORT:-7700\}:7700/)
  assert.match(compose, /MEILI_ENV/)
  assert.match(compose, /MEILI_MASTER_KEY/)
  assert.match(compose, /MEILI_DB_PATH: \/meili_data\/data\.ms/)
  assert.match(compose, /MEILI_DUMP_DIR: \/meili_data\/dumps/)
  assert.match(compose, /MEILI_SNAPSHOT_DIR: \/meili_data\/snapshots/)
  assert.match(compose, /meilisearch-data:\/meili_data/)

  const env = await readFile(path.join(dir, '.env.example'), 'utf8')
  assert.match(env, /MEILISEARCH_VERSION=latest/)
  assert.match(env, /MEILISEARCH_URL=http:\/\/localhost:7700/)
  assert.match(env, /MEILI_MASTER_KEY=replace-with-a-long-random-master-key/)

  const readme = await readFile(path.join(dir, 'README.md'), 'utf8')
  assert.match(readme, /Meilisearch Cloud/)
  assert.match(readme, /Business Source License 1\.1/)
  assert.match(readme, /Stop writes before restoring/)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /backup_mount 'meilisearch' '\/meili_data' 'meilisearch-data\.tar\.gz'/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(
    restore,
    /restore_mount 'meilisearch' '\/meili_data' 'meilisearch-data\.tar\.gz'/,
  )

  const healthcheck = await readFile(path.join(dir, 'ops/healthcheck.sh'), 'utf8')
  assert.match(healthcheck, /\/health/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"pack": "meilisearch"/)
  assert.match(manifest, /"supportModel": "review-required"/)
  assert.match(manifest, /"id": "meilisearch-data"/)
})

test('generates an Outline launchpack with auth and durable storage guidance', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('outline', dir)

  assert.equal(result.files.some((file) => file.endsWith('compose.yaml')), true)

  const compose = await readFile(path.join(dir, 'compose.yaml'), 'utf8')
  assert.match(compose, /docker\.getoutline\.com\/outlinewiki\/outline/)
  assert.match(compose, /storage-data:\/var\/lib\/outline\/data/)
  assert.match(compose, /DATABASE_URL/)
  assert.match(compose, /redis:6379/)

  const env = await readFile(path.join(dir, '.env.example'), 'utf8')
  assert.match(env, /OIDC_CLIENT_ID=/)
  assert.match(env, /SECRET_KEY=replace-with-a-32-byte-random-secret/)

  const readme = await readFile(path.join(dir, 'README.md'), 'utf8')
  assert.match(readme, /do not resell Outline as a hosted document service/)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /backup_postgres 'postgres' 'POSTGRES_USER' 'POSTGRES_DB' 'outline-postgres\.sql'/)
  assert.match(backup, /backup_mount 'outline' '\/var\/lib\/outline\/data' 'outline-storage\.tar\.gz'/)
  assert.match(backup, /backup_mount 'redis' '\/data' 'outline-redis\.tar\.gz'/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"pack": "outline"/)
  assert.match(manifest, /"supportModel": "customer-owned-only"/)
})

test('generates a Supabase wrapper around the official Docker setup', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('supabase', dir)

  assert.equal(result.files.some((file) => file.endsWith('compose.yaml')), false)

  const readme = await readFile(path.join(dir, 'README.md'), 'utf8')
  assert.match(readme, /wraps the official `supabase\/supabase\/docker` setup/)
  assert.match(readme, /single-project stack/)
  assert.match(readme, /supabase_db-config/)
  assert.match(readme, /storage\.buckets/)
  assert.match(readme, /auth/)

  const operations = await readFile(path.join(dir, 'OPERATIONS.md'), 'utf8')
  assert.match(operations, /supabase-storage-metadata/)
  assert.match(operations, /advanced Storage internals/)
  assert.match(operations, /auth/)

  const env = await readFile(path.join(dir, '.env.example'), 'utf8')
  assert.match(env, /SUPABASE_SOURCE_REF=master/)
  assert.match(env, /SUPABASE_PROJECT_DIR=self-hosted/)

  const install = await readFile(path.join(dir, 'ops/install-official.sh'), 'utf8')
  assert.match(install, /git clone --filter=blob:none --sparse/)
  assert.match(install, /git sparse-checkout set docker/)
  assert.match(install, /utils\/generate-keys\.sh/)

  const healthcheck = await readFile(path.join(dir, 'ops/healthcheck.sh'), 'utf8')
  assert.match(healthcheck, /SUPABASE_HEALTH_URL/)
  assert.match(healthcheck, /docker compose ps/)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /supabase-public-schema\.sql/)
  assert.match(backup, /supabase-storage-metadata\.sql/)
  assert.match(backup, /pg_dump --clean --if-exists --schema=public -U supabase_admin/)
  assert.match(backup, /pg_dump --data-only --table=storage\.buckets --table=storage\.objects/)
  assert.match(backup, /supabase-\$dir\.tar\.gz/)
  assert.match(backup, /pgsodium_root\.key/)
  assert.match(backup, /read_env_file_value/)
  assert.match(backup, /SUPABASE_POSTGRES_PASSWORD/)
  assert.doesNotMatch(backup, /\. "\$SUPABASE_PROJECT_DIR\/\.env"/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /supabase-public-schema\.sql/)
  assert.match(restore, /supabase-storage-metadata\.sql/)
  assert.match(restore, /supabase_db-config/)
  assert.match(restore, /psql -U supabase_admin -d postgres/)
  assert.match(restore, /storage\.allow_delete_query/)
  assert.match(restore, /delete from storage\.objects/)
  assert.match(restore, /delete from storage\.buckets/)
  assert.match(restore, /docker compose ps --services --filter status=running/)
  assert.match(restore, /read_env_file_value/)
  assert.match(restore, /SUPABASE_POSTGRES_PASSWORD/)
  assert.doesNotMatch(restore, /\. "\$SUPABASE_PROJECT_DIR\/\.env"/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"pack": "supabase"/)
  assert.match(manifest, /"supportModel": "permissive-hosting-fit"/)
})

test('generates a Dify wrapper around the official Docker setup', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('dify', dir)

  assert.equal(result.files.some((file) => file.endsWith('compose.yaml')), false)

  const readme = await readFile(path.join(dir, 'README.md'), 'utf8')
  assert.match(readme, /wraps Dify's official `langgenius\/dify\/docker` deployment/)
  assert.match(readme, /multi-tenant environments/)
  assert.match(readme, /plugin storage/)

  const env = await readFile(path.join(dir, '.env.example'), 'utf8')
  assert.match(env, /DIFY_SOURCE_REF=latest/)
  assert.match(env, /DIFY_PROJECT_DIR=self-hosted/)

  const install = await readFile(path.join(dir, 'ops/install-official.sh'), 'utf8')
  assert.match(install, /git clone --filter=blob:none --sparse/)
  assert.match(install, /langgenius\/dify\.git/)
  assert.match(install, /git sparse-checkout set docker/)
  assert.match(install, /releases\/latest/)

  const healthcheck = await readFile(path.join(dir, 'ops/healthcheck.sh'), 'utf8')
  assert.match(healthcheck, /DIFY_HEALTH_URL/)
  assert.match(healthcheck, /docker compose ps/)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /dify-main-database\.sql/)
  assert.match(backup, /dify-plugin-database\.sql/)
  assert.match(backup, /pg_dump --clean --if-exists/)
  assert.match(backup, /read_env_file_value/)
  assert.match(backup, /dify-config\.tar\.gz/)
  assert.match(backup, /dify-local-state\.tar\.gz/)
  assert.match(backup, /volumes\/plugin_daemon/)
  assert.match(backup, /volumes\/weaviate/)
  assert.doesNotMatch(backup, /\. "\$DIFY_PROJECT_DIR\/\.env"/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /dify-main-database\.sql/)
  assert.match(restore, /dify-plugin-database\.sql/)
  assert.match(restore, /docker compose ps --services --filter status=running/)
  assert.match(restore, /psql -U "\$DIFY_DB_USERNAME" -d "\$DIFY_DB_DATABASE"/)
  assert.match(restore, /docker compose up -d\)/)
  assert.match(restore, /dify-local-state\.tar\.gz/)
  assert.match(restore, /read_env_file_value/)
  assert.doesNotMatch(restore, /\. "\$DIFY_PROJECT_DIR\/\.env"/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"pack": "dify"/)
  assert.match(manifest, /"supportModel": "upstream-agreement-required"/)
})

test('generates an Airbyte abctl and Helm operations wrapper', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('airbyte', dir)

  assert.equal(result.files.some((file) => file.endsWith('compose.yaml')), false)

  const env = await readFile(path.join(dir, '.env.example'), 'utf8')
  assert.match(env, /AIRBYTE_PORT=8000/)
  assert.match(env, /AIRBYTE_NAMESPACE=airbyte-abctl/)
  assert.match(env, /AIRBYTE_CHART_VERSION=latest/)
  assert.match(env, /AIRBYTE_INSTALL_ABCTL=false/)

  const values = await readFile(path.join(dir, 'values.yaml'), 'utf8')
  assert.match(values, /edition: community/)
  assert.match(values, /airbyteUrl: http:\/\/localhost:8000/)
  assert.match(values, /postgresql:/)
  assert.match(values, /storage:/)
  assert.match(values, /secretsManager:/)

  const secret = await readFile(path.join(dir, 'secret.yaml.example'), 'utf8')
  assert.match(secret, /airbyte-config-secrets/)
  assert.match(secret, /database-password/)
  assert.match(secret, /s3-secret-access-key/)

  const readme = await readFile(path.join(dir, 'README.md'), 'utf8')
  assert.match(readme, /legacy Docker Compose/)
  assert.match(readme, /not Airbyte Cloud/)
  assert.match(readme, /managed ELT\/ETL service/)
  assert.match(readme, /external Postgres, object storage, and secret management/)

  const install = await readFile(path.join(dir, 'ops/install-official.sh'), 'utf8')
  assert.match(install, /abctl "\$@"/)
  assert.match(install, /local install --no-browser --port "\$AIRBYTE_PORT"/)
  assert.match(install, /--chart-version/)
  assert.match(install, /--values/)
  assert.match(install, /--secret/)
  assert.match(install, /--low-resource-mode/)
  assert.match(install, /--insecure-cookies/)
  assert.match(install, /DIR_INSTALL/)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /airbyte-postgres\.sql/)
  assert.match(backup, /airbyte-minio\.tar\.gz/)
  assert.match(backup, /airbyte-abctl-state\.tar\.gz/)
  assert.match(backup, /airbyte-k8s-secrets\.yaml/)
  assert.match(backup, /kubectl --kubeconfig "\$AIRBYTE_KUBECONFIG"/)
  assert.match(backup, /pg_dump --clean --if-exists/)
  assert.match(backup, /abctl images manifest/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /airbyte-postgres\.sql/)
  assert.match(restore, /DROP SCHEMA IF EXISTS public CASCADE/)
  assert.match(restore, /airbyte-minio\.tar\.gz/)
  assert.match(restore, /AIRBYTE_RESTORE_ABCTL_STATE/)
  assert.match(restore, /scale deployment -n "\$AIRBYTE_NAMESPACE" --all --replicas=0/)

  const healthcheck = await readFile(path.join(dir, 'ops/healthcheck.sh'), 'utf8')
  assert.match(healthcheck, /abctl local status/)
  assert.match(healthcheck, /AIRBYTE_HEALTH_URL/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"pack": "airbyte"/)
  assert.match(manifest, /"supportModel": "customer-owned-only"/)
  assert.match(manifest, /"id": "airbyte-abctl-state"/)
})

test('generates a Langfuse wrapper around the official Docker Compose setup', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('langfuse', dir)

  assert.equal(result.files.some((file) => file.endsWith('compose.yaml')), false)

  const env = await readFile(path.join(dir, '.env.example'), 'utf8')
  assert.match(env, /LANGFUSE_SOURCE_REF=latest/)
  assert.match(env, /ENCRYPTION_KEY=/)
  assert.match(env, /DATABASE_URL=postgresql:\/\/postgres:/)
  assert.match(env, /LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY=/)

  const readme = await readFile(path.join(dir, 'README.md'), 'utf8')
  assert.match(readme, /wraps Langfuse's official `docker-compose\.yml`/)
  assert.match(readme, /Postgres, ClickHouse, Redis\/Valkey/)
  assert.match(readme, /not Langfuse Cloud/)

  const install = await readFile(path.join(dir, 'ops/install-official.sh'), 'utf8')
  assert.match(
    install,
    /git clone --filter=blob:none --no-checkout https:\/\/github\.com\/langfuse\/langfuse\.git/,
  )
  assert.match(install, /git sparse-checkout set docker-compose\.yml/)
  assert.match(install, /docker-compose\.yml/)
  assert.match(install, /LANGFUSE_SOURCE_REF/)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /langfuse-postgres\.sql/)
  assert.match(backup, /langfuse-clickhouse-data\.tar\.gz/)
  assert.match(backup, /langfuse-minio-data\.tar\.gz/)
  assert.match(backup, /langfuse-redis-data\.tar\.gz/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /docker compose stop langfuse-web langfuse-worker clickhouse redis minio/)
  assert.match(restore, /DROP SCHEMA IF EXISTS public CASCADE/)

  const healthcheck = await readFile(path.join(dir, 'ops/healthcheck.sh'), 'utf8')
  assert.match(healthcheck, /\/api\/public\/health/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"pack": "langfuse"/)
  assert.match(manifest, /"supportModel": "customer-owned-only"/)
  assert.match(manifest, /"id": "langfuse-official-state"/)
})

test('generates a Temporal wrapper around the official samples-server Compose setup', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('temporal', dir)

  assert.equal(result.files.some((file) => file.endsWith('compose.yaml')), false)

  const env = await readFile(path.join(dir, '.env.example'), 'utf8')
  assert.match(env, /TEMPORAL_SOURCE_REF=main/)
  assert.match(env, /TEMPORAL_COMPOSE_FILE=docker-compose-postgres\.yml/)
  assert.match(env, /TEMPORAL_ADDRESS=localhost:7233/)

  const readme = await readFile(path.join(dir, 'README.md'), 'utf8')
  assert.match(readme, /wraps the official `temporalio\/samples-server\/compose`/)
  assert.match(readme, /docker-compose-postgres\.yml/)
  assert.match(readme, /Do not expose it to the public internet/)

  const install = await readFile(path.join(dir, 'ops/install-official.sh'), 'utf8')
  assert.match(install, /git clone --filter=blob:none --sparse https:\/\/github\.com\/temporalio\/samples-server\.git/)
  assert.match(install, /git sparse-checkout set compose/)
  assert.match(install, /TEMPORAL_COMPOSE_FILE/)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /docker-compose-postgres\.yml/)
  assert.match(backup, /temporal-database\.sql/)
  assert.match(backup, /temporal-visibility\.sql/)
  assert.match(backup, /compose -f "\$TEMPORAL_COMPOSE_FILE" stop temporal temporal-ui/)
  assert.match(backup, /pg_dump --clean --if-exists -U "\$TEMPORAL_POSTGRES_USER" temporal/)
  assert.match(backup, /pg_dump --clean --if-exists -U "\$TEMPORAL_POSTGRES_USER" temporal_visibility/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /temporal-database\.sql/)
  assert.match(restore, /temporal-visibility\.sql/)
  assert.match(restore, /DROP SCHEMA IF EXISTS public CASCADE/)
  assert.match(restore, /pg_isready -U "\$TEMPORAL_POSTGRES_USER"/)

  const healthcheck = await readFile(path.join(dir, 'ops/healthcheck.sh'), 'utf8')
  assert.match(healthcheck, /TEMPORAL_HEALTH_URL/)
  assert.match(healthcheck, /nc -z localhost 7233/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"pack": "temporal"/)
  assert.match(manifest, /"supportModel": "permissive-hosting-fit"/)
  assert.match(manifest, /"id": "temporal-postgres-state"/)
})

test('generates a Keycloak launchpack with production-mode Postgres operations', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('keycloak', dir)

  assert.equal(result.pack.id, 'keycloak')

  const containerfile = await readFile(path.join(dir, 'Containerfile'), 'utf8')
  assert.match(containerfile, /FROM quay\.io\/keycloak\/keycloak:\$\{KEYCLOAK_VERSION\}/)
  assert.match(containerfile, /KC_HEALTH_ENABLED=true/)
  assert.match(containerfile, /KC_METRICS_ENABLED=true/)
  assert.match(containerfile, /KC_DB=postgres/)
  assert.match(containerfile, /kc\.sh build/)

  const compose = await readFile(path.join(dir, 'compose.yaml'), 'utf8')
  assert.match(compose, /postgres:\$\{POSTGRES_VERSION:-16-alpine\}/)
  assert.match(compose, /KC_DB_URL: "jdbc:postgresql:\/\/postgres:5432\/\$\{KEYCLOAK_DB:-keycloak\}"/)
  assert.match(compose, /KC_HOSTNAME: "\$\{KEYCLOAK_HOSTNAME:\?Set KEYCLOAK_HOSTNAME in \.env\}"/)
  assert.match(compose, /KC_PROXY_HEADERS: "\$\{KEYCLOAK_PROXY_HEADERS:-xforwarded\}"/)
  assert.match(compose, /KC_BOOTSTRAP_ADMIN_PASSWORD/)
  assert.match(compose, /command: \["start", "--optimized"\]/)
  assert.match(compose, /127\.0\.0\.1:\$\{KEYCLOAK_MANAGEMENT_PORT:-9000\}:9000/)

  const env = await readFile(path.join(dir, '.env.example'), 'utf8')
  assert.match(env, /KEYCLOAK_HOSTNAME=http:\/\/localhost:8080/)
  assert.match(env, /KEYCLOAK_DB_PASSWORD=replace-with-a-long-random-db-password/)
  assert.match(env, /KEYCLOAK_ADMIN_PASSWORD=replace-with-a-long-random-admin-password/)

  const readme = await readFile(path.join(dir, 'README.md'), 'utf8')
  assert.match(readme, /not official Keycloak support/)
  assert.match(readme, /Do not expose management port 9000 publicly/)
  assert.match(readme, /not a complete backup/)

  const backup = await readFile(path.join(dir, 'ops/backup.sh'), 'utf8')
  assert.match(backup, /keycloak-postgres\.sql/)
  assert.match(backup, /pg_dump --clean --if-exists/)
  assert.match(backup, /compose stop keycloak/)
  assert.match(backup, /keycloak-config\.tar\.gz/)
  assert.match(backup, /read_env_file_value/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /keycloak-postgres\.sql/)
  assert.match(restore, /DROP SCHEMA IF EXISTS public CASCADE/)
  assert.match(restore, /pg_isready -U "\$KEYCLOAK_DB_USER" -d "\$KEYCLOAK_DB"/)
  assert.match(restore, /compose stop keycloak/)

  const healthcheck = await readFile(path.join(dir, 'ops/healthcheck.sh'), 'utf8')
  assert.match(healthcheck, /\/health\/ready/)
  assert.match(healthcheck, /KEYCLOAK_MANAGEMENT_PORT/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"pack": "keycloak"/)
  assert.match(manifest, /"supportModel": "permissive-hosting-fit"/)
  assert.match(manifest, /"id": "keycloak-postgres-state"/)
})

test('generated operation scripts are valid shell syntax', async () => {
  for (const pack of listLaunchpacks()) {
    const dir = await mkdtemp(path.join(os.tmpdir(), `oss-launchpack-${pack.id}-`))
    const result = await generateLaunchpack(pack.id, dir)

    const shellFiles = result.files.filter((file) => file.endsWith('.sh'))
    for (const shellFile of shellFiles) {
      await execFileAsync('sh', ['-n', shellFile])
    }
  }
})

test('generates Homepage starter config files', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('homepage', dir)

  assert.equal(result.pack.id, 'homepage')

  const compose = await readFile(path.join(dir, 'compose.yaml'), 'utf8')
  assert.match(compose, /HOMEPAGE_ALLOWED_HOSTS/)

  const services = await readFile(path.join(dir, 'config/services.yaml'), 'utf8')
  assert.match(services, /OSS Launchpack/)
})

test('force mode regenerates an existing launchpack', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  await generateLaunchpack('memos', dir)
  const result = await generateLaunchpack('memos', dir, { force: true })

  const manifest = await readFile(path.join(dir, '.launchpack.json'), 'utf8')
  assert.match(manifest, /"pack": "memos"/)
  assert.match(manifest, /"supportModel": "permissive-hosting-fit"/)
  assert.match(manifest, /"licenseNote": "Memos is MIT-licensed upstream/)
  assert.match(manifest, /"sizing":/)
  assert.match(manifest, /"tier": "tiny-vps"/)
  assert.match(manifest, /"operations":/)

  const upstream = await readFile(path.join(dir, 'UPSTREAM.md'), 'utf8')
  assert.match(upstream, /Upstream and License Notes/)
  assert.match(upstream, /Sizing tier: tiny-vps/)
  assert.match(upstream, /MIT-licensed upstream/)
  assert.equal(result.pack.name, 'Memos')
})
