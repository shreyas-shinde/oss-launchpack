import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { listLaunchpacks } from '../src/catalog.js'
import { generateLaunchpack } from '../src/generator.js'

test('catalog exposes the initial managed-deployment wedges', () => {
  const ids = listLaunchpacks().map((pack) => pack.id)
  assert.deepEqual(ids, ['open-webui', 'n8n', 'memos', 'uptime-kuma', 'homepage'])
  assert.equal(listLaunchpacks().every((pack) => pack.licenseNote.length > 0), true)
})

test('generates a launchpack without overwriting by default', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oss-launchpack-'))
  const result = await generateLaunchpack('open-webui', dir)

  assert.equal(result.pack.id, 'open-webui')
  assert.equal(result.files.length, 6)

  const compose = await readFile(path.join(dir, 'compose.yaml'), 'utf8')
  assert.match(compose, /ghcr\.io\/open-webui\/open-webui:main/)

  const healthcheck = await stat(path.join(dir, 'ops/healthcheck.sh'))
  assert.equal((healthcheck.mode & 0o111) > 0, true)

  await assert.rejects(
    () => generateLaunchpack('open-webui', dir),
    /Refusing to overwrite existing file/,
  )
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
  assert.match(manifest, /"licenseNote": "Memos is MIT-licensed upstream/)

  const upstream = await readFile(path.join(dir, 'UPSTREAM.md'), 'utf8')
  assert.match(upstream, /Upstream and License Notes/)
  assert.match(upstream, /MIT-licensed upstream/)
  assert.equal(result.pack.name, 'Memos')
})
