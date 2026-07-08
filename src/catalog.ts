export type LaunchpackFile = {
  path: string
  content: string
  executable?: boolean
}

export type Launchpack = {
  id: string
  name: string
  category: string
  upstream: string
  defaultPort: number
  whyNow: string
  managedOpportunity: string
  files: LaunchpackFile[]
}

const openWebUi: Launchpack = {
  id: 'open-webui',
  name: 'Open WebUI',
  category: 'AI interface',
  upstream: 'https://github.com/open-webui/open-webui',
  defaultPort: 3000,
  whyNow:
    'Private AI chat is one of the clearest self-hosting pulls, but non-experts still need a sane compose file, health check, and upgrade path.',
  managedOpportunity:
    'Managed Open WebUI can bundle OAuth, model routing, backups, upgrades, and GPU/CPU hosting choices.',
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
  whyNow:
    'Agentic workflow automation has mainstream pull, but production n8n needs durable Postgres storage and secure encryption defaults.',
  managedOpportunity:
    'Managed n8n can sell secure provisioning, backups, webhook domain setup, upgrades, and incident response.',
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
  whyNow:
    'Personal knowledge tools are growing with the broader self-hosted movement, and Memos has a simple operational shape for new self-hosters.',
  managedOpportunity:
    'Managed Memos can sell private hosting, automatic backups, custom domains, and low-friction import/export.',
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

export const launchpacks = [openWebUi, n8n, memos] as const satisfies readonly Launchpack[]

export function listLaunchpacks(): readonly Launchpack[] {
  return launchpacks
}

export function getLaunchpack(id: string): Launchpack | undefined {
  return launchpacks.find((pack) => pack.id === id)
}
