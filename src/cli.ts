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
    default:
      throw new Error(`Unknown command "${command}". Run "oss-launchpack help".`)
  }
}

function printHelp(): void {
  console.log(`oss-launchpack

Generate production-minded Docker Compose launchpacks for popular OSS apps.

Commands:
  list                         List available launchpacks
  show <pack>                  Show launchpack details
  init <pack> [dir] [--force]  Generate files into a directory
  help                         Show this help

Examples:
  oss-launchpack list
  oss-launchpack show open-webui
  oss-launchpack init n8n ./deploy/n8n
`)
}

function printList(): void {
  for (const pack of listLaunchpacks()) {
    console.log(`${pack.id.padEnd(12)} ${pack.name.padEnd(14)} ${pack.category}`)
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

Why now:
${pack.whyNow}

Managed deployment opportunity:
${pack.managedOpportunity}
`)
}

async function runInit(args: string[]): Promise<void> {
  const force = args.includes('--force')
  const values = args.filter((arg) => arg !== '--force')
  const [packId, targetDir = packId] = values

  if (!packId) {
    throw new Error('Missing pack id. Example: oss-launchpack init open-webui')
  }

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
