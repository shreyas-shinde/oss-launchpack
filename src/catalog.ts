export type LaunchpackFile = {
  path: string
  content: string
  executable?: boolean
}

export type SupportModel =
  | 'permissive-hosting-fit'
  | 'customer-owned-only'
  | 'upstream-agreement-required'
  | 'review-required'

export type Launchpack = {
  id: string
  name: string
  category: string
  upstream: string
  defaultPort: number
  supportModel: SupportModel
  whyNow: string
  managedOpportunity: string
  licenseNote: string
  files: LaunchpackFile[]
}

const openWebUi: Launchpack = {
  id: 'open-webui',
  name: 'Open WebUI',
  category: 'AI interface',
  upstream: 'https://github.com/open-webui/open-webui',
  defaultPort: 3000,
  supportModel: 'review-required',
  whyNow:
    'Private AI chat is one of the clearest self-hosting pulls, but non-experts still need a sane compose file, health check, and upgrade path.',
  managedOpportunity:
    'Managed Open WebUI can bundle OAuth, model routing, backups, upgrades, and GPU/CPU hosting choices.',
  licenseNote:
    'Unofficial launchpack. Open WebUI uses a custom permissive license with branding protection; keep upstream branding intact and do not imply official endorsement.',
  files: [
    {
      path: 'compose.yaml',
      content: `services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    restart: unless-stopped
    ports:
      - "\${WEBUI_PORT:-3000}:8080"
    volumes:
      - open-webui-data:/app/backend/data
    environment:
      WEBUI_NAME: "\${WEBUI_NAME:-Open WebUI}"
      OPENAI_API_KEY: "\${OPENAI_API_KEY:-}"
      OLLAMA_BASE_URL: "\${OLLAMA_BASE_URL:-http://ollama:11434}"
    depends_on:
      - ollama

  ollama:
    image: ollama/ollama:latest
    restart: unless-stopped
    volumes:
      - ollama-data:/root/.ollama

volumes:
  open-webui-data:
  ollama-data:
`,
    },
    {
      path: '.env.example',
      content: `WEBUI_PORT=3000
WEBUI_NAME=Open WebUI
OPENAI_API_KEY=
OLLAMA_BASE_URL=http://ollama:11434
`,
    },
    {
      path: 'README.md',
      content: `# Open WebUI Launchpack

## Start

\`\`\`bash
cp .env.example .env
docker compose up -d
./ops/healthcheck.sh
\`\`\`

Open http://localhost:3000.

## Operations

- Upgrade: \`docker compose pull && docker compose up -d\`
- Stop: \`docker compose down\`
- Data lives in the \`open-webui-data\` and \`ollama-data\` Docker volumes.
- Back up the volumes before major upgrades.
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

APP_URL="\${APP_URL:-http://localhost:3000}"
curl -fsS "$APP_URL" >/dev/null
echo "Open WebUI is reachable at $APP_URL"
`,
    },
  ],
}

const n8n: Launchpack = {
  id: 'n8n',
  name: 'n8n',
  category: 'Automation',
  upstream: 'https://github.com/n8n-io/n8n',
  defaultPort: 5678,
  supportModel: 'customer-owned-only',
  whyNow:
    'Agentic workflow automation has mainstream pull, but production n8n needs durable Postgres storage and secure encryption defaults.',
  managedOpportunity:
    'n8n support should focus on customer-owned/internal deployments unless a separate upstream commercial agreement allows hosted or embedded access.',
  licenseNote:
    'n8n is fair-code under the Sustainable Use License and Enterprise License. Do not resell hosted n8n access, white-label n8n, or embed it for customers without confirming the required n8n agreement.',
  files: [
    {
      path: 'compose.yaml',
      content: `services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: "\${POSTGRES_DB:-n8n}"
      POSTGRES_USER: "\${POSTGRES_USER:-n8n}"
      POSTGRES_PASSWORD: "\${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-n8n} -d \${POSTGRES_DB:-n8n}"]
      interval: 10s
      timeout: 5s
      retries: 5

  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    ports:
      - "\${N8N_PORT:-5678}:5678"
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_DATABASE: "\${POSTGRES_DB:-n8n}"
      DB_POSTGRESDB_USER: "\${POSTGRES_USER:-n8n}"
      DB_POSTGRESDB_PASSWORD: "\${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}"
      N8N_ENCRYPTION_KEY: "\${N8N_ENCRYPTION_KEY:?set N8N_ENCRYPTION_KEY in .env}"
      N8N_HOST: "\${N8N_HOST:-localhost}"
      N8N_PORT: 5678
      N8N_PROTOCOL: "\${N8N_PROTOCOL:-http}"
      WEBHOOK_URL: "\${WEBHOOK_URL:-http://localhost:5678/}"
    volumes:
      - n8n-data:/home/node/.n8n
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres-data:
  n8n-data:
`,
    },
    {
      path: '.env.example',
      content: `N8N_PORT=5678
N8N_HOST=localhost
N8N_PROTOCOL=http
WEBHOOK_URL=http://localhost:5678/
POSTGRES_DB=n8n
POSTGRES_USER=n8n
POSTGRES_PASSWORD=replace-with-a-long-random-password
N8N_ENCRYPTION_KEY=replace-with-a-32-byte-random-secret
`,
    },
    {
      path: 'README.md',
      content: `# n8n Launchpack

## Start

\`\`\`bash
cp .env.example .env
# Edit POSTGRES_PASSWORD and N8N_ENCRYPTION_KEY before starting.
docker compose up -d
./ops/healthcheck.sh
\`\`\`

Open http://localhost:5678.

## Operations

- Keep \`N8N_ENCRYPTION_KEY\` stable. Changing it can make saved credentials unusable.
- Upgrade: \`docker compose pull && docker compose up -d\`
- Back up Postgres before upgrades.
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

APP_URL="\${APP_URL:-http://localhost:5678/healthz}"
curl -fsS "$APP_URL" >/dev/null
echo "n8n is reachable at $APP_URL"
`,
    },
  ],
}

const memos: Launchpack = {
  id: 'memos',
  name: 'Memos',
  category: 'Personal knowledge',
  upstream: 'https://github.com/usememos/memos',
  defaultPort: 5230,
  supportModel: 'permissive-hosting-fit',
  whyNow:
    'Personal knowledge tools are growing with the broader self-hosted movement, and Memos has a simple operational shape for new self-hosters.',
  managedOpportunity:
    'Managed Memos can sell private hosting, automatic backups, custom domains, and low-friction import/export.',
  licenseNote:
    'Memos is MIT-licensed upstream; preserve upstream copyright and license notices.',
  files: [
    {
      path: 'compose.yaml',
      content: `services:
  memos:
    image: neosmemo/memos:stable
    restart: unless-stopped
    ports:
      - "\${MEMOS_PORT:-5230}:5230"
    volumes:
      - memos-data:/var/opt/memos

volumes:
  memos-data:
`,
    },
    {
      path: '.env.example',
      content: `MEMOS_PORT=5230
`,
    },
    {
      path: 'README.md',
      content: `# Memos Launchpack

## Start

\`\`\`bash
cp .env.example .env
docker compose up -d
./ops/healthcheck.sh
\`\`\`

Open http://localhost:5230.

## Operations

- Upgrade: \`docker compose pull && docker compose up -d\`
- Data lives in the \`memos-data\` Docker volume.
- Back up the volume before major upgrades.
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

APP_URL="\${APP_URL:-http://localhost:5230}"
curl -fsS "$APP_URL" >/dev/null
echo "Memos is reachable at $APP_URL"
`,
    },
  ],
}

const uptimeKuma: Launchpack = {
  id: 'uptime-kuma',
  name: 'Uptime Kuma',
  category: 'Monitoring',
  upstream: 'https://github.com/louislam/uptime-kuma',
  defaultPort: 3001,
  supportModel: 'permissive-hosting-fit',
  whyNow:
    'Every self-hosted stack needs uptime checks before it becomes trusted infrastructure.',
  managedOpportunity:
    'Uptime Kuma support can bundle monitor setup, notification channels, incident routing, upgrades, and backup checks.',
  licenseNote:
    'Uptime Kuma is MIT-licensed upstream; preserve upstream copyright and license notices.',
  files: [
    {
      path: 'compose.yaml',
      content: `services:
  uptime-kuma:
    image: louislam/uptime-kuma:2
    restart: unless-stopped
    ports:
      - "\${UPTIME_KUMA_PORT:-3001}:3001"
    volumes:
      - uptime-kuma-data:/app/data

volumes:
  uptime-kuma-data:
`,
    },
    {
      path: '.env.example',
      content: `UPTIME_KUMA_PORT=3001
`,
    },
    {
      path: 'README.md',
      content: `# Uptime Kuma Launchpack

## Start

\`\`\`bash
cp .env.example .env
docker compose up -d
./ops/healthcheck.sh
\`\`\`

Open http://localhost:3001.

## Operations

- Upgrade: \`docker compose pull && docker compose up -d\`
- Stop: \`docker compose down\`
- Data lives in the \`uptime-kuma-data\` Docker volume.
- Back up the volume before major upgrades.
- Configure notification channels after first login.
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

APP_URL="\${APP_URL:-http://localhost:3001}"
curl -fsS "$APP_URL" >/dev/null
echo "Uptime Kuma is reachable at $APP_URL"
`,
    },
  ],
}

const homepage: Launchpack = {
  id: 'homepage',
  name: 'Homepage',
  category: 'Dashboard',
  upstream: 'https://github.com/gethomepage/homepage',
  defaultPort: 3000,
  supportModel: 'review-required',
  whyNow:
    'Self-hosters quickly accumulate services; a dashboard becomes the front door and status surface for the stack.',
  managedOpportunity:
    'Homepage support can bundle service discovery, curated dashboards, docker integration, secret handling, and upgrade checks.',
  licenseNote:
    'Homepage is GPL-3.0-licensed upstream. Preserve notices and review GPL obligations before distributing modified versions or bundled distributions.',
  files: [
    {
      path: 'compose.yaml',
      content: `services:
  homepage:
    image: ghcr.io/gethomepage/homepage:latest
    restart: unless-stopped
    ports:
      - "\${HOMEPAGE_PORT:-3000}:3000"
    volumes:
      - ./config:/app/config
    environment:
      HOMEPAGE_ALLOWED_HOSTS: "\${HOMEPAGE_ALLOWED_HOSTS:-localhost:3000}"
      PUID: "\${PUID:-1000}"
      PGID: "\${PGID:-1000}"
`,
    },
    {
      path: '.env.example',
      content: `HOMEPAGE_PORT=3000
HOMEPAGE_ALLOWED_HOSTS=localhost:3000
PUID=1000
PGID=1000
`,
    },
    {
      path: 'README.md',
      content: `# Homepage Launchpack

## Start

\`\`\`bash
cp .env.example .env
docker compose up -d
./ops/healthcheck.sh
\`\`\`

Open http://localhost:3000.

## Operations

- Upgrade: \`docker compose pull && docker compose up -d\`
- Stop: \`docker compose down\`
- Config lives in \`./config\`.
- Set \`HOMEPAGE_ALLOWED_HOSTS\` to your production domain, including port if needed.
- Docker socket integration is intentionally not enabled by default. Add it only if you understand the host-access implications.
`,
    },
    {
      path: 'config/settings.yaml',
      content: `title: OSS Launchpack
theme: dark
color: slate
`,
    },
    {
      path: 'config/services.yaml',
      content: `- Launchpacks:
    - OSS Launchpack:
        href: https://github.com/shreyas-shinde/oss-launchpack
        description: Production-minded self-hosted app launchpacks
`,
    },
    {
      path: 'config/bookmarks.yaml',
      content: `- Documentation:
    - Homepage:
        - abbr: HP
          href: https://gethomepage.dev/
`,
    },
    {
      path: 'config/widgets.yaml',
      content: `- resources:
    cpu: true
    memory: true
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

APP_URL="\${APP_URL:-http://localhost:3000}"
curl -fsS "$APP_URL" >/dev/null
echo "Homepage is reachable at $APP_URL"
`,
    },
  ],
}

export const launchpacks = [
  openWebUi,
  n8n,
  memos,
  uptimeKuma,
  homepage,
] as const satisfies readonly Launchpack[]

export function listLaunchpacks(): readonly Launchpack[] {
  return launchpacks
}

export function getLaunchpack(id: string): Launchpack | undefined {
  return launchpacks.find((pack) => pack.id === id)
}
