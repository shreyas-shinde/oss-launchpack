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

test('catalog exposes the initial managed-deployment wedges', () => {
  const ids = listLaunchpacks().map((pack) => pack.id)
  assert.deepEqual(ids, ['open-webui', 'n8n', 'memos', 'uptime-kuma', 'homepage'])
  assert.equal(listLaunchpacks().every((pack) => pack.licenseNote.length > 0), true)
  assert.equal(listLaunchpacks().every((pack) => pack.supportModel.length > 0), true)
  assert.equal(listLaunchpacks().every((pack) => pack.operations.backupTargets.length > 0), true)
  assert.notEqual(
    listLaunchpacks().find((pack) => pack.id === 'n8n')?.supportModel,
    'permissive-hosting-fit',
  )
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
  assert.match(restore, /psql -U/)

  const manifest = await readFile(path.join(dir, 'ops/manifest.json'), 'utf8')
  assert.match(manifest, /"schema": "oss-launchpack\/ops\/v1"/)
  assert.match(manifest, /"type": "postgres"/)
})

test('generated operation scripts are valid shell syntax', async () => {
  for (const pack of listLaunchpacks()) {
    const dir = await mkdtemp(path.join(os.tmpdir(), `oss-launchpack-${pack.id}-`))
    await generateLaunchpack(pack.id, dir)

    await execFileAsync('sh', ['-n', path.join(dir, 'ops/backup.sh')])
    await execFileAsync('sh', ['-n', path.join(dir, 'ops/restore.sh')])
    await execFileAsync('sh', ['-n', path.join(dir, 'ops/healthcheck.sh')])
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
  assert.match(manifest, /"operations":/)

  const upstream = await readFile(path.join(dir, 'UPSTREAM.md'), 'utf8')
  assert.match(upstream, /Upstream and License Notes/)
  assert.match(upstream, /MIT-licensed upstream/)
  assert.equal(result.pack.name, 'Memos')
})
