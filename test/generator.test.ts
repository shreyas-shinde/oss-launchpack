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
    'outline',
    'supabase',
    'dify',
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

  assert.match(readme, /CONTRIBUTING\.md/)
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
  assert.match(content, /oss_launchpack_validation/)
  assert.match(content, /KEEP_SUPABASE_VALIDATION/)

  const scriptStat = await stat(script)
  assert.equal((scriptStat.mode & 0o111) > 0, true)
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
  assert.match(backup, /pg_dump --clean --if-exists --schema=public -U supabase_admin/)
  assert.match(backup, /supabase-\$dir\.tar\.gz/)
  assert.match(backup, /pgsodium_root\.key/)
  assert.match(backup, /read_env_file_value/)
  assert.match(backup, /SUPABASE_POSTGRES_PASSWORD/)
  assert.doesNotMatch(backup, /\. "\$SUPABASE_PROJECT_DIR\/\.env"/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /supabase-public-schema\.sql/)
  assert.match(restore, /supabase_db-config/)
  assert.match(restore, /psql -U supabase_admin -d postgres/)
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
  assert.match(backup, /dify-pg_dumpall\.sql/)
  assert.match(backup, /dify-config\.tar\.gz/)
  assert.match(backup, /dify-local-state\.tar\.gz/)
  assert.match(backup, /volumes\/plugin_daemon/)
  assert.match(backup, /volumes\/weaviate/)

  const restore = await readFile(path.join(dir, 'ops/restore.sh'), 'utf8')
  assert.match(restore, /dify-pg_dumpall\.sql/)
  assert.match(restore, /dify-local-state\.tar\.gz/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"pack": "dify"/)
  assert.match(manifest, /"supportModel": "upstream-agreement-required"/)
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
