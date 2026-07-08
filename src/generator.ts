import { chmod, mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getLaunchpack, type Launchpack } from './catalog.js'

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
- License/commercial-use note: ${pack.licenseNote}

Review the upstream project's current license, trademark policy, and commercial terms before offering this app as a hosted service or embedding it in another product.
`,
    },
    {
      path: '.launchpack.json',
      content: JSON.stringify(
        {
          schema: 'oss-launchpack/v1',
          pack: pack.id,
          name: pack.name,
          upstream: pack.upstream,
          licenseNote: pack.licenseNote,
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
