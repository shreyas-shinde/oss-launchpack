#!/usr/bin/env node
import { generateLaunchpack } from './generator.js'
import { getLaunchpack, listLaunchpacks } from './catalog.js'

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv

  switch (command) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      printHelp()
      return
    case 'list':
      printList()
      return
    case 'show':
      printShow(rest[0])
      return
    case 'init':
      await runInit(rest)
      return
    case 'generate':
      await runGenerate(rest)
      return
    default:
      throw new Error(`Unknown command "${command}". Run "oss-launchpack help".`)
  }
}

function printHelp(): void {
  console.log(`oss-launchpack

Generate operations-ready Docker Compose launchpacks for popular OSS apps.

Commands:
  list                         List available launchpacks
  show <pack>                  Show launchpack details
  init <pack> [dir] [--force]  Generate files into a directory
  generate --app <pack> --output <dir> [--force]
  help                         Show this help

Examples:
  oss-launchpack list
  oss-launchpack show open-webui
  oss-launchpack init n8n ./deploy/n8n
  oss-launchpack generate --app supabase --output ./deploy/supabase
`)
}

function printList(): void {
  const packs = listLaunchpacks()
  const idWidth = Math.max(...packs.map((pack) => pack.id.length), 'Pack'.length)
  const nameWidth = Math.max(...packs.map((pack) => pack.name.length), 'Name'.length)
  const categoryWidth = Math.max(...packs.map((pack) => pack.category.length), 'Category'.length)
  const tierWidth = Math.max(...packs.map((pack) => pack.sizing.tier.length), 'Tier'.length)

  for (const pack of packs) {
    console.log(
      `${pack.id.padEnd(idWidth)} ${pack.name.padEnd(nameWidth)} ${pack.category.padEnd(
        categoryWidth,
      )} ${pack.sizing.tier.padEnd(tierWidth)} ${pack.supportModel}`,
    )
  }
}

function printShow(packId: string | undefined): void {
  if (!packId) {
    throw new Error('Missing pack id. Example: oss-launchpack show open-webui')
  }

  const pack = getLaunchpack(packId)
  if (!pack) {
    throw new Error(`Unknown launchpack "${packId}". Run "oss-launchpack list".`)
  }

  console.log(`${pack.name}

ID: ${pack.id}
Category: ${pack.category}
Upstream: ${pack.upstream}
Default port: ${pack.defaultPort}
Support model: ${pack.supportModel}
Sizing tier: ${pack.sizing.tier}
Minimum host: ${pack.sizing.minimumCpuCores} CPU cores, ${pack.sizing.minimumMemoryGb} GB RAM
Storage: ${pack.sizing.storage}
Scaling: ${pack.sizing.scaling}
Health check URL: ${pack.operations.healthcheckUrl}

License and use note:
${pack.licenseNote}

Why now:
${pack.whyNow}

Operations fit:
${pack.operationsFit}

Sizing notes:
${pack.sizing.notes.map((note) => `- ${note}`).join('\n')}

Backup targets:
${pack.operations.backupTargets
  .map((target) => `- ${target.id} (${target.type}): ${target.description}`)
  .join('\n')}

Upgrade:
${pack.operations.upgrade.command}
`)
}

async function runInit(args: string[]): Promise<void> {
  const force = args.includes('--force')
  const values = args.filter((arg) => arg !== '--force')
  const [packId, targetDir = packId] = values

  if (!packId) {
    throw new Error('Missing pack id. Example: oss-launchpack init open-webui')
  }

  await printGenerateResult(packId, targetDir, force)
}

async function runGenerate(args: string[]): Promise<void> {
  const force = args.includes('--force')
  const packId = getFlagValue(args, '--app')
  const targetDir = getFlagValue(args, '--output')

  if (!packId) {
    throw new Error('Missing --app. Example: oss-launchpack generate --app supabase --output ./deploy/supabase')
  }

  if (!targetDir) {
    throw new Error(
      'Missing --output. Example: oss-launchpack generate --app supabase --output ./deploy/supabase',
    )
  }

  await printGenerateResult(packId, targetDir, force)
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index === -1) {
    return undefined
  }

  return args[index + 1]
}

async function printGenerateResult(packId: string, targetDir: string, force: boolean): Promise<void> {
  const result = await generateLaunchpack(packId, targetDir, { force })
  console.log(`Generated ${result.pack.name} launchpack in ${result.targetDir}`)
  for (const file of result.files) {
    console.log(`- ${file}`)
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Error: ${message}`)
  process.exitCode = 1
})
