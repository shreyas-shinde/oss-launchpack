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

export type DeploymentTier =
  | 'tiny-vps'
  | 'single-node'
  | 'single-node-heavy'
  | 'official-stack-heavy'

export type LaunchpackSizing = {
  tier: DeploymentTier
  minimumCpuCores: number
  minimumMemoryGb: number
  storage: string
  scaling: string
  notes: string[]
}

export type BackupTarget =
  | {
      type: 'mount'
      id: string
      service: string
      path: string
      description: string
    }
  | {
      type: 'postgres'
      id: string
      service: string
      databaseEnv: string
      userEnv: string
      description: string
    }
  | {
      type: 'command'
      id: string
      description: string
      backupCommands: string[]
      restoreCommands: string[]
    }

export type LaunchpackOperations = {
  healthcheckUrl: string
  backupTargets: BackupTarget[]
  upgrade: {
    command: string
    notes: string[]
  }
}

export type Launchpack = {
  id: string
  name: string
  category: string
  upstream: string
  defaultPort: number
  supportModel: SupportModel
  whyNow: string
  operationsFit: string
  licenseNote: string
  sizing: LaunchpackSizing
  operations: LaunchpackOperations
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
  operationsFit:
    'Open WebUI operations need OAuth, model routing, backups, upgrades, and GPU/CPU hosting choices documented in one inspectable pack.',
  licenseNote:
    'Unofficial launchpack. Open WebUI uses a custom permissive license with branding protection; keep upstream branding intact and do not imply official endorsement.',
  sizing: {
    tier: 'single-node',
    minimumCpuCores: 2,
    minimumMemoryGb: 4,
    storage: '20 GB+ for app data; add separate capacity for Ollama model caches if local models are used.',
    scaling:
      'Start as a single-node app. Move model serving to dedicated GPU hosts or external APIs before scaling the web UI.',
    notes: [
      'CPU-only inference is suitable for small tests but not production-like latency.',
      'Ollama model volume backups can become very large; decide whether models are cache or recoverable state.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://localhost:3000',
    backupTargets: [
      {
        type: 'mount',
        id: 'open-webui-data',
        service: 'open-webui',
        path: '/app/backend/data',
        description: 'Open WebUI users, settings, chat data, and uploaded files.',
      },
      {
        type: 'mount',
        id: 'ollama-models',
        service: 'ollama',
        path: '/root/.ollama',
        description: 'Ollama model cache and local model data.',
      },
    ],
    upgrade: {
      command: 'docker compose pull && docker compose up -d',
      notes: [
        'Back up open-webui-data before major upgrades.',
        'Ollama model backups can be large; decide whether model cache restore is required for your environment.',
      ],
    },
  },
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
  operationsFit:
    'n8n operations need customer-owned/internal deployment guidance, stable encryption keys, durable Postgres, and clear hosted-use license boundaries.',
  licenseNote:
    'n8n is fair-code under the Sustainable Use License and Enterprise License. Do not resell hosted n8n access, white-label n8n, or embed it for customers without confirming the required n8n agreement.',
  sizing: {
    tier: 'single-node',
    minimumCpuCores: 2,
    minimumMemoryGb: 4,
    storage: '20 GB+ for Postgres and local n8n files; increase quickly for high execution history retention.',
    scaling:
      'Start with one n8n container and Postgres. For higher workflow volume, use queue mode with Redis and workers.',
    notes: [
      'Execution history retention is the main storage driver.',
      'Keep N8N_ENCRYPTION_KEY stable before considering horizontal workers.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://localhost:5678/healthz',
    backupTargets: [
      {
        type: 'postgres',
        id: 'n8n-postgres',
        service: 'postgres',
        databaseEnv: 'POSTGRES_DB',
        userEnv: 'POSTGRES_USER',
        description: 'Workflow, execution, credential, and user data in Postgres.',
      },
      {
        type: 'mount',
        id: 'n8n-files',
        service: 'n8n',
        path: '/home/node/.n8n',
        description: 'n8n local files and instance-level configuration.',
      },
    ],
    upgrade: {
      command: 'docker compose pull && docker compose up -d',
      notes: [
        'Keep N8N_ENCRYPTION_KEY stable across restores and upgrades.',
        'Back up Postgres before every major version upgrade.',
      ],
    },
  },
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

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

APP_URL="\${APP_URL:-\${N8N_PROTOCOL:-http}://\${N8N_HOST:-localhost}:\${N8N_PORT:-5678}/healthz}"
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
  operationsFit:
    'Memos operations are a good starter shape for private notes, automatic backups, custom domains, and low-friction import/export.',
  licenseNote:
    'Memos is MIT-licensed upstream; preserve upstream copyright and license notices.',
  sizing: {
    tier: 'tiny-vps',
    minimumCpuCores: 1,
    minimumMemoryGb: 1,
    storage: '5 GB+ for SQLite data and uploaded resources.',
    scaling:
      'Best suited to a small single-node instance; move attachments to larger storage before sharing broadly.',
    notes: ['Resource use is usually modest unless uploaded files dominate the dataset.'],
  },
  operations: {
    healthcheckUrl: 'http://localhost:5230',
    backupTargets: [
      {
        type: 'mount',
        id: 'memos-data',
        service: 'memos',
        path: '/var/opt/memos',
        description: 'Memos database, uploaded resources, and runtime data.',
      },
    ],
    upgrade: {
      command: 'docker compose pull && docker compose up -d',
      notes: ['Back up memos-data before upgrades or host migrations.'],
    },
  },
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
  operationsFit:
    'Uptime Kuma operations need monitor setup, notification channels, incident routing, upgrades, and backup checks.',
  licenseNote:
    'Uptime Kuma is MIT-licensed upstream; preserve upstream copyright and license notices.',
  sizing: {
    tier: 'tiny-vps',
    minimumCpuCores: 1,
    minimumMemoryGb: 1,
    storage: '5 GB+ for monitor configuration, history, and notification settings.',
    scaling:
      'Run one small instance for personal or team monitoring; split checks by environment if probe volume grows.',
    notes: ['Probe interval and retained history drive database growth.'],
  },
  operations: {
    healthcheckUrl: 'http://localhost:3001',
    backupTargets: [
      {
        type: 'mount',
        id: 'uptime-kuma-data',
        service: 'uptime-kuma',
        path: '/app/data',
        description: 'Monitor configuration, history, and notification settings.',
      },
    ],
    upgrade: {
      command: 'docker compose pull && docker compose up -d',
      notes: ['Back up uptime-kuma-data before upgrades.'],
    },
  },
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

const sentry: Launchpack = {
  id: 'sentry',
  name: 'Sentry',
  category: 'Observability',
  upstream: 'https://github.com/getsentry/self-hosted',
  defaultPort: 9000,
  supportModel: 'customer-owned-only',
  whyNow:
    'Sentry is a high-demand observability app, but its self-hosted stack is intentionally complex and operationally heavy enough to need a wrapper around install, backups, upgrades, and support boundaries.',
  operationsFit:
    'Sentry operations should focus on customer-owned self-hosted installations, upgrade help, backup validation, and migration planning with clear upstream boundaries.',
  licenseNote:
    'Sentry self-hosted is Fair Source under FSL-1.1-Apache-2.0. Internal/customer-owned deployments and professional services can fit the license, but selling deployed self-hosted Sentry as SaaS or a similar commercial offering is prohibited by upstream terms.',
  sizing: {
    tier: 'official-stack-heavy',
    minimumCpuCores: 4,
    minimumMemoryGb: 16,
    storage:
      '100 GB+ recommended for test event ingestion; historical event retention can require much more.',
    scaling:
      'Use the official self-hosted topology for low-volume deployments. Treat higher event volume as a dedicated observability platform project.',
    notes: [
      'The generated backup delegates to upstream partial JSON export and does not cover historical events.',
      'Disk pressure and queue lag are common early bottlenecks.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://localhost:9000',
    backupTargets: [
      {
        type: 'command',
        id: 'sentry-partial-json',
        description:
          'Official self-hosted partial JSON backup for low-volume data such as users, organizations, projects, settings, alert rules, and monitors. It does not include historical event data.',
        backupCommands: [
          'if [ ! -d self-hosted ]; then echo "Run ./ops/install-official.sh before backing up Sentry." >&2; exit 1; fi',
          '(cd self-hosted && ./scripts/backup.sh global)',
          'cp self-hosted/sentry/backup.json "$BACKUP_DIR_ABS/sentry-partial-global.json"',
        ],
        restoreCommands: [
          'if [ ! -d self-hosted ]; then echo "Run ./ops/install-official.sh before restoring Sentry." >&2; exit 1; fi',
          'if [ ! -f "$BACKUP_DIR_ABS/sentry-partial-global.json" ]; then echo "Missing Sentry backup: $BACKUP_DIR_ABS/sentry-partial-global.json" >&2; exit 1; fi',
          'cp "$BACKUP_DIR_ABS/sentry-partial-global.json" self-hosted/sentry/backup.json',
          '(cd self-hosted && ./scripts/restore.sh global)',
        ],
      },
    ],
    upgrade: {
      command: 'cd self-hosted && git fetch --tags && git checkout <target-release> && ./install.sh',
      notes: [
        'Use official getsentry/self-hosted releases, not nightly builds, for production-like installations.',
        'Expect downtime during upgrades; Sentry runs migrations as part of install.sh.',
        'Restore partial JSON backups on the same Sentry version and a fresh migrated install.',
        'For full historical event recovery, follow upstream Docker volume backup guidance and test restores before relying on it.',
      ],
    },
  },
  files: [
    {
      path: '.env.example',
      content: `SENTRY_SELF_HOSTED_VERSION=latest
REPORT_SELF_HOSTED_ISSUES=0
SENTRY_URL=http://localhost:9000
`,
    },
    {
      path: 'README.md',
      content: `# Sentry Launchpack

This pack wraps the official \`getsentry/self-hosted\` repository instead of
forking Sentry's large Docker Compose stack. That keeps the operational surface
closer to upstream and avoids stale generated Compose files.

## Start

\`\`\`bash
cp .env.example .env
./ops/install-official.sh
cd self-hosted
docker compose up --wait
cd ..
./ops/healthcheck.sh
\`\`\`

Open http://localhost:9000.

## Operations

- Use official self-hosted releases for production-like installs.
- Sentry self-hosted is geared toward low-volume deployments and proofs of concept.
- The generated backup script delegates to upstream \`./scripts/backup.sh global\`.
- The official partial JSON backup excludes historical event data.
- Full historical-event backup requires Docker volume backup and restore testing.
- This pack is for customer-owned deployments and professional services; do not resell hosted Sentry access without upstream agreement.
`,
    },
    {
      path: 'ops/install-official.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

SENTRY_SELF_HOSTED_VERSION="\${SENTRY_SELF_HOSTED_VERSION:-latest}"
REPORT_SELF_HOSTED_ISSUES="\${REPORT_SELF_HOSTED_ISSUES:-0}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required to install Sentry self-hosted." >&2
  exit 1
fi

if [ "$SENTRY_SELF_HOSTED_VERSION" = "latest" ] && ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to resolve the latest Sentry self-hosted release. Set SENTRY_SELF_HOSTED_VERSION to a release tag to avoid this." >&2
  exit 1
fi

if [ ! -d self-hosted/.git ]; then
  git clone https://github.com/getsentry/self-hosted.git self-hosted
fi

cd self-hosted
git fetch --tags

if [ "$SENTRY_SELF_HOSTED_VERSION" = "latest" ]; then
  VERSION_URL="$(curl -Ls -o /dev/null -w '%{url_effective}' https://github.com/getsentry/self-hosted/releases/latest)"
  SENTRY_SELF_HOSTED_VERSION="\${VERSION_URL##*/}"
fi

git checkout "$SENTRY_SELF_HOSTED_VERSION"

if [ "$REPORT_SELF_HOSTED_ISSUES" = "1" ]; then
  ./install.sh --report-self-hosted-issues
else
  ./install.sh --no-report-self-hosted-issues
fi

echo "Sentry self-hosted $SENTRY_SELF_HOSTED_VERSION installed in ./self-hosted"
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

APP_URL="\${APP_URL:-\${SENTRY_URL:-http://localhost:9000}}"
curl -fsS "$APP_URL" >/dev/null
echo "Sentry is reachable at $APP_URL"
`,
    },
  ],
}

const posthog: Launchpack = {
  id: 'posthog',
  name: 'PostHog',
  category: 'Product analytics',
  upstream: 'https://github.com/PostHog/posthog',
  defaultPort: 80,
  supportModel: 'customer-owned-only',
  whyNow:
    'PostHog is a large open-source product-engineering platform, but its self-hosted hobby deployment has a real data stack behind it: Postgres, ClickHouse, Redis, Kafka, object storage, and proxy state.',
  operationsFit:
    'PostHog operations should focus on customer-owned hobby deployments, backup validation, upgrade help, and migration planning without implying upstream support.',
  licenseNote:
    'PostHog open-source self-hosted deployments are MIT licensed and provided without guarantee. The upstream repository also contains an ee/ directory under a separate Enterprise license; preserve upstream notices and do not assume paid features or upstream support are included.',
  sizing: {
    tier: 'official-stack-heavy',
    minimumCpuCores: 4,
    minimumMemoryGb: 16,
    storage:
      '100 GB+ for ClickHouse, Postgres, object storage, Kafka, Redis, and proxy state; event volume dominates.',
    scaling:
      'Use the upstream hobby deployment only for small deployments. Larger analytics workloads need a deliberate data-stack plan.',
    notes: [
      'ClickHouse and object storage usually become the first capacity constraints.',
      'Stop write-heavy ingestion before relying on volume-snapshot restores.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://localhost/_health',
    backupTargets: [
      {
        type: 'mount',
        id: 'posthog-postgres',
        service: 'db',
        path: '/var/lib/postgresql/data',
        description: 'PostHog relational data, teams, users, projects, and metadata.',
      },
      {
        type: 'mount',
        id: 'posthog-clickhouse',
        service: 'clickhouse',
        path: '/var/lib/clickhouse',
        description: 'High-volume analytics event data stored in ClickHouse.',
      },
      {
        type: 'mount',
        id: 'posthog-seaweedfs',
        service: 'seaweedfs',
        path: '/data',
        description: 'SeaweedFS object storage used for recordings and object-backed data.',
      },
      {
        type: 'mount',
        id: 'posthog-objectstorage',
        service: 'objectstorage',
        path: '/data',
        description: 'MinIO object storage retained for hobby deployment storage migrations.',
      },
      {
        type: 'mount',
        id: 'posthog-kafka',
        service: 'kafka',
        path: '/bitnami/kafka',
        description: 'Kafka/Redpanda broker state and queued ingestion data.',
      },
      {
        type: 'mount',
        id: 'posthog-redis',
        service: 'redis7',
        path: '/data',
        description: 'Redis cache and queue state used by the hobby deployment.',
      },
      {
        type: 'mount',
        id: 'posthog-caddy-data',
        service: 'proxy',
        path: '/data',
        description: 'Caddy certificate and proxy runtime data.',
      },
      {
        type: 'mount',
        id: 'posthog-caddy-config',
        service: 'proxy',
        path: '/config',
        description: 'Caddy proxy configuration state.',
      },
    ],
    upgrade: {
      command: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/posthog/posthog/HEAD/bin/upgrade-hobby)"',
      notes: [
        'Back up all stateful volumes before running the upstream upgrade script.',
        'PostHog does not publish tagged releases for self-hosted; the hobby deployment follows the upstream script and image tags.',
        'The open-source hobby deployment is intended for small deployments and is provided without commercial support or guarantees.',
        'Kubernetes self-hosting support has been sunset; use the Docker Compose hobby path unless you have a separate reason to operate your own stack.',
      ],
    },
  },
  files: [
    {
      path: '.env.example',
      content: `POSTHOG_DOMAIN=posthog.example.com
POSTHOG_APP_TAG=latest
POSTHOG_USE_STAGING_TLS=0
POSTHOG_HEALTH_URL=http://localhost/_health
`,
    },
    {
      path: 'README.md',
      content: `# PostHog Launchpack

This pack wraps PostHog's official Docker Compose hobby deployment instead of
copying the large upstream Compose stack. That keeps installs closer to current
upstream behavior while adding an inspectable operations manifest and backup
surface.

## Start

\`\`\`bash
cp .env.example .env
# Set POSTHOG_DOMAIN to a real domain with an A record pointing at this host.
./ops/install-official.sh
./ops/healthcheck.sh
\`\`\`

Open https://your-domain.example after the upstream installer finishes.

## Operations

- PostHog's hobby deployment is MIT licensed and provided without guarantees.
- The official installer requires Linux, sudo, Docker access, a public domain, and enough memory for a data-heavy stack.
- PostHog Cloud is the upstream-recommended path for most teams.
- Backups are Docker-volume snapshots of the current hobby deployment's stateful services.
- Stop write-heavy traffic before backup/restore when using this for production-like data.
- This pack is for customer-owned deployments and professional services; do not present it as PostHog Cloud or upstream-supported PostHog.
`,
    },
    {
      path: 'ops/install-official.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

POSTHOG_DOMAIN="\${POSTHOG_DOMAIN:-}"
POSTHOG_APP_TAG="\${POSTHOG_APP_TAG:-latest}"
POSTHOG_USE_STAGING_TLS="\${POSTHOG_USE_STAGING_TLS:-0}"

if [ -z "$POSTHOG_DOMAIN" ] || [ "$POSTHOG_DOMAIN" = "posthog.example.com" ]; then
  echo "Set POSTHOG_DOMAIN in .env to a real domain before installing PostHog." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to download PostHog's official hobby installer." >&2
  exit 1
fi

if ! command -v bash >/dev/null 2>&1; then
  echo "bash is required to run PostHog's official hobby installer." >&2
  exit 1
fi

tls_arg=""
if [ "$POSTHOG_USE_STAGING_TLS" = "1" ]; then
  tls_arg="staging"
fi

curl -fsSL https://raw.githubusercontent.com/posthog/posthog/HEAD/bin/deploy-hobby \\
  | SKIP_HEALTH_CHECK="\${SKIP_HEALTH_CHECK:-}" bash -s -- "$POSTHOG_APP_TAG" "$POSTHOG_DOMAIN" "$tls_arg"
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

APP_URL="\${APP_URL:-\${POSTHOG_HEALTH_URL:-http://localhost/_health}}"
curl -fsS "$APP_URL" >/dev/null
echo "PostHog is reachable at $APP_URL"
`,
    },
  ],
}

const grafana: Launchpack = {
  id: 'grafana',
  name: 'Grafana',
  category: 'Observability',
  upstream: 'https://github.com/grafana/grafana',
  defaultPort: 3000,
  supportModel: 'customer-owned-only',
  whyNow:
    'Grafana is the default dashboard layer for many self-hosted and platform teams, but durable installs still need a database, provisioning layout, plugin handling, backups, and upgrade discipline.',
  operationsFit:
    'Grafana operations should focus on customer-owned deployments: Postgres-backed state, provisioned dashboards and datasources, plugin compatibility, backups, and clean upgrade checks without implying Grafana Labs support.',
  licenseNote:
    'Grafana OSS is AGPL-3.0-only with Apache-2.0 exceptions. Use this pack for customer-owned self-managed deployments, preserve notices and source obligations, and do not use Grafana Labs marks as a product or service name or imply endorsement.',
  sizing: {
    tier: 'single-node',
    minimumCpuCores: 2,
    minimumMemoryGb: 2,
    storage:
      '10 GB+ for Postgres, plugins, snapshots, local images, and provisioned dashboards; connected telemetry stays in external data sources.',
    scaling:
      'Start as a single-node Grafana instance with Postgres. For HA, move Postgres to managed/external infrastructure and provision plugins, dashboards, and datasources consistently across replicas.',
    notes: [
      'Dashboard query cost usually lands on connected data sources, but Grafana still needs stable database and plugin state.',
      'Provision dashboards and datasources from files so restores can be audited and repeated.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://localhost:3000/api/health',
    backupTargets: [
      {
        type: 'postgres',
        id: 'grafana-postgres',
        service: 'postgres',
        databaseEnv: 'POSTGRES_DB',
        userEnv: 'POSTGRES_USER',
        description: 'Grafana users, organizations, folders, dashboards, datasources, alerts, and app metadata.',
      },
      {
        type: 'mount',
        id: 'grafana-data',
        service: 'grafana',
        path: '/var/lib/grafana',
        description: 'Grafana plugins, local images, snapshots, and runtime data outside the Postgres database.',
      },
      {
        type: 'mount',
        id: 'grafana-provisioning',
        service: 'grafana',
        path: '/etc/grafana/provisioning',
        description: 'Provisioned datasources, dashboards, alerting, and access-control files.',
      },
      {
        type: 'mount',
        id: 'grafana-dashboards',
        service: 'grafana',
        path: '/var/lib/grafana/dashboards',
        description: 'Provisioned dashboard JSON files mounted into Grafana.',
      },
    ],
    upgrade: {
      command: 'docker compose pull && docker compose up -d',
      notes: [
        'Back up Postgres, Grafana data, provisioning files, and dashboard JSON before major upgrades.',
        'Keep database credentials and admin credentials stable across container recreation.',
        'Review Grafana release notes and plugin compatibility before changing GRAFANA_VERSION.',
        'Use external Postgres and repeatable provisioning before running multiple Grafana replicas.',
      ],
    },
  },
  files: [
    {
      path: 'compose.yaml',
      content: `services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: "\${POSTGRES_DB:-grafana}"
      POSTGRES_USER: "\${POSTGRES_USER:-grafana}"
      POSTGRES_PASSWORD: "\${POSTGRES_PASSWORD:-replace-with-a-long-random-password}"
    volumes:
      - grafana-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-grafana} -d \${POSTGRES_DB:-grafana}"]
      interval: 10s
      timeout: 5s
      retries: 10

  grafana:
    image: grafana/grafana:\${GRAFANA_VERSION:-latest}
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "\${GRAFANA_PORT:-3000}:3000"
    environment:
      GF_DATABASE_TYPE: postgres
      GF_DATABASE_HOST: postgres:5432
      GF_DATABASE_NAME: "\${POSTGRES_DB:-grafana}"
      GF_DATABASE_USER: "\${POSTGRES_USER:-grafana}"
      GF_DATABASE_PASSWORD: "\${POSTGRES_PASSWORD:-replace-with-a-long-random-password}"
      GF_SECURITY_ADMIN_USER: "\${GRAFANA_ADMIN_USER:-admin}"
      GF_SECURITY_ADMIN_PASSWORD: "\${GRAFANA_ADMIN_PASSWORD:-replace-with-a-long-random-password}"
      GF_SERVER_ROOT_URL: "\${GRAFANA_ROOT_URL:-http://localhost:3000}"
      GF_USERS_ALLOW_SIGN_UP: "false"
      GF_PLUGINS_PREINSTALL: "\${GRAFANA_PLUGINS_PREINSTALL:-}"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./provisioning:/etc/grafana/provisioning:ro
      - ./dashboards:/var/lib/grafana/dashboards

volumes:
  grafana-postgres-data:
  grafana-data:
`,
    },
    {
      path: '.env.example',
      content: `GRAFANA_PORT=3000
GRAFANA_VERSION=latest
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=replace-with-a-long-random-password
GRAFANA_ROOT_URL=http://localhost:3000
GRAFANA_PLUGINS_PREINSTALL=
POSTGRES_DB=grafana
POSTGRES_USER=grafana
POSTGRES_PASSWORD=replace-with-a-long-random-password
`,
    },
    {
      path: 'README.md',
      content: `# Grafana Launchpack

## Start

\`\`\`bash
cp .env.example .env
# Edit passwords and GRAFANA_ROOT_URL before first production use.
docker compose up -d
./ops/healthcheck.sh
\`\`\`

Open http://localhost:3000 and sign in with \`GRAFANA_ADMIN_USER\` and
\`GRAFANA_ADMIN_PASSWORD\`.

## Operations

- Upgrade: \`docker compose pull && docker compose up -d\`
- Stop: \`docker compose down\`
- Grafana state uses Postgres instead of the default SQLite database so database backups can be consistent without stopping Grafana for file-copy safety.
- Provisioning files live under \`./provisioning\`; provisioned dashboard JSON lives under \`./dashboards\`.
- Add plugin IDs to \`GRAFANA_PLUGINS_PREINSTALL\` and test plugin compatibility before production upgrades.
- Set \`GRAFANA_ROOT_URL\` to the external HTTPS URL before putting Grafana behind a reverse proxy.
- This is an unofficial customer-owned deployment pack. It is not Grafana Cloud, does not include Enterprise features, and does not imply Grafana Labs support.
- Grafana OSS is AGPL-3.0-only with Apache-2.0 exceptions; preserve notices and review source/offering obligations before commercial use.
`,
    },
    {
      path: 'provisioning/dashboards/default.yaml',
      content: `apiVersion: 1

providers:
  - name: OSS Launchpack
    orgId: 1
    folder: OSS Launchpack
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /var/lib/grafana/dashboards
`,
    },
    {
      path: 'provisioning/datasources/.gitkeep',
      content: '',
    },
    {
      path: 'dashboards/.gitkeep',
      content: '',
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

APP_URL="\${APP_URL:-http://localhost:\${GRAFANA_PORT:-3000}/api/health}"
curl -fsS "$APP_URL" >/dev/null
echo "Grafana is reachable at $APP_URL"
`,
    },
  ],
}

const clickhouse: Launchpack = {
  id: 'clickhouse',
  name: 'ClickHouse',
  category: 'Analytics database',
  upstream: 'https://github.com/ClickHouse/ClickHouse',
  defaultPort: 8123,
  supportModel: 'permissive-hosting-fit',
  whyNow:
    'ClickHouse is a core data layer behind analytics, observability, events, and AI telemetry workloads, but operators need explicit storage, backup, restore, and upgrade boundaries before trusting it with production-like data.',
  operationsFit:
    'ClickHouse operations need native database backups, persistent data/log volumes, config and users files, high file-descriptor limits, and careful upgrade planning for storage-heavy analytical workloads.',
  licenseNote:
    'ClickHouse is Apache-2.0 licensed upstream. Preserve notices, use exact upstream binaries when referring to ClickHouse software, and follow the ClickHouse trademark policy for any product, service, or managed offering.',
  sizing: {
    tier: 'single-node-heavy',
    minimumCpuCores: 4,
    minimumMemoryGb: 8,
    storage:
      '100 GB+ SSD/NVMe for analytical data, native backups, merge overhead, and logs; event volume and retention dominate capacity.',
    scaling:
      'Start as a single-node analytical database. Move to a deliberate replicated or sharded design before multi-tenant, high-ingest, or high-retention workloads.',
    notes: [
      'ClickHouse is optimized for append-heavy analytical workloads, not OLTP-style row updates.',
      'Native BACKUP/RESTORE should be practiced on a spare stack before relying on it for incident recovery.',
    ],
  },
  operations: {
    healthcheckUrl: 'clickhouse://localhost:9000',
    backupTargets: [
      {
        type: 'mount',
        id: 'clickhouse-config',
        service: 'clickhouse',
        path: '/etc/clickhouse-server/config.d',
        description: 'ClickHouse server configuration overrides, including the launchpack backup disk.',
      },
      {
        type: 'mount',
        id: 'clickhouse-users',
        service: 'clickhouse',
        path: '/etc/clickhouse-server/users.d',
        description: 'ClickHouse user and access-management configuration overrides.',
      },
      {
        type: 'mount',
        id: 'clickhouse-initdb',
        service: 'clickhouse',
        path: '/docker-entrypoint-initdb.d',
        description: 'Optional database initialization scripts mounted into the official Docker image.',
      },
      {
        type: 'command',
        id: 'clickhouse-native-backup',
        description: 'Native ClickHouse BACKUP archive for the database named by CLICKHOUSE_DB.',
        backupCommands: [
          'clickhouse_database="${CLICKHOUSE_DB:-analytics}"',
          'case "$clickhouse_database" in *[!A-Za-z0-9_]*) echo "CLICKHOUSE_DB must contain only letters, numbers, and underscores." >&2; exit 1 ;; esac',
          'if [ "$clickhouse_database" = "default" ]; then echo "Set CLICKHOUSE_DB to a non-default database before using native restore." >&2; exit 1; fi',
          'clickhouse_user="${CLICKHOUSE_USER:-analytics}"',
          'clickhouse_password="${CLICKHOUSE_PASSWORD:-replace-with-a-long-random-password}"',
          'clickhouse_backup_file="clickhouse-$clickhouse_database.zip"',
          'compose exec -T clickhouse sh -lc "rm -f /backups/$clickhouse_backup_file"',
          'compose exec -T clickhouse clickhouse-client --user "$clickhouse_user" --password "$clickhouse_password" --query "BACKUP DATABASE $clickhouse_database TO Disk(\'launchpack_backups\', \'$clickhouse_backup_file\')"',
          'clickhouse_container_id="$(compose ps -q clickhouse)"',
          'if [ -z "$clickhouse_container_id" ]; then echo "ClickHouse service is not running." >&2; exit 1; fi',
          'docker cp "$clickhouse_container_id:/backups/$clickhouse_backup_file" "$BACKUP_DIR_ABS/clickhouse-native-backup.zip"',
        ],
        restoreCommands: [
          'if [ ! -f "$BACKUP_DIR_ABS/clickhouse-native-backup.zip" ]; then echo "Missing ClickHouse native backup: $BACKUP_DIR_ABS/clickhouse-native-backup.zip" >&2; exit 1; fi',
          'clickhouse_database="${CLICKHOUSE_DB:-analytics}"',
          'case "$clickhouse_database" in *[!A-Za-z0-9_]*) echo "CLICKHOUSE_DB must contain only letters, numbers, and underscores." >&2; exit 1 ;; esac',
          'if [ "$clickhouse_database" = "default" ]; then echo "Set CLICKHOUSE_DB to a non-default database before using native restore." >&2; exit 1; fi',
          'clickhouse_user="${CLICKHOUSE_USER:-analytics}"',
          'clickhouse_password="${CLICKHOUSE_PASSWORD:-replace-with-a-long-random-password}"',
          'clickhouse_backup_file="clickhouse-$clickhouse_database.zip"',
          'clickhouse_container_id="$(compose ps -q clickhouse)"',
          'if [ -z "$clickhouse_container_id" ]; then echo "ClickHouse service is not running. Start the stack before restoring." >&2; exit 1; fi',
          'compose exec -T clickhouse sh -lc "rm -f /backups/$clickhouse_backup_file"',
          'docker cp "$BACKUP_DIR_ABS/clickhouse-native-backup.zip" "$clickhouse_container_id:/backups/$clickhouse_backup_file"',
          'compose exec -T clickhouse clickhouse-client --user "$clickhouse_user" --password "$clickhouse_password" --query "DROP DATABASE IF EXISTS $clickhouse_database"',
          'compose exec -T clickhouse clickhouse-client --user "$clickhouse_user" --password "$clickhouse_password" --query "RESTORE DATABASE $clickhouse_database FROM Disk(\'launchpack_backups\', \'$clickhouse_backup_file\')"',
        ],
      },
    ],
    upgrade: {
      command: 'docker compose pull && docker compose up -d',
      notes: [
        'Take and restore-test a native backup before changing CLICKHOUSE_VERSION.',
        'Review ClickHouse release notes for backward-incompatible changes and storage format changes.',
        'Keep enough free disk for merges, mutations, and backup archives during upgrades.',
        'Move backups to S3 or another remote target before relying on this for high-retention production datasets.',
      ],
    },
  },
  files: [
    {
      path: 'compose.yaml',
      content: `services:
  clickhouse:
    image: clickhouse/clickhouse-server:\${CLICKHOUSE_VERSION:-latest}
    restart: unless-stopped
    ulimits:
      nofile:
        soft: 262144
        hard: 262144
    ports:
      - "\${CLICKHOUSE_HTTP_PORT:-8123}:8123"
      - "\${CLICKHOUSE_NATIVE_PORT:-9000}:9000"
    environment:
      CLICKHOUSE_DB: "\${CLICKHOUSE_DB:-analytics}"
      CLICKHOUSE_USER: "\${CLICKHOUSE_USER:-analytics}"
      CLICKHOUSE_PASSWORD: "\${CLICKHOUSE_PASSWORD:-replace-with-a-long-random-password}"
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: "1"
    volumes:
      - clickhouse-data:/var/lib/clickhouse
      - clickhouse-logs:/var/log/clickhouse-server
      - clickhouse-backups:/backups
      - ./config.d:/etc/clickhouse-server/config.d:ro
      - ./users.d:/etc/clickhouse-server/users.d
      - ./initdb.d:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "clickhouse-client --user \${CLICKHOUSE_USER:-analytics} --password \${CLICKHOUSE_PASSWORD:-replace-with-a-long-random-password} --query 'SELECT 1'"]
      interval: 10s
      timeout: 5s
      retries: 10

volumes:
  clickhouse-data:
  clickhouse-logs:
  clickhouse-backups:
`,
    },
    {
      path: '.env.example',
      content: `CLICKHOUSE_VERSION=latest
CLICKHOUSE_HTTP_PORT=8123
CLICKHOUSE_NATIVE_PORT=9000
CLICKHOUSE_DB=analytics
CLICKHOUSE_USER=analytics
CLICKHOUSE_PASSWORD=replace-with-a-long-random-password
`,
    },
    {
      path: 'README.md',
      content: `# ClickHouse Launchpack

## Start

\`\`\`bash
cp .env.example .env
# Edit CLICKHOUSE_PASSWORD before first production use.
docker compose up -d
./ops/healthcheck.sh
\`\`\`

ClickHouse HTTP is mapped to http://localhost:8123 and the native client port
is mapped to localhost:9000.

## Operations

- Upgrade: \`docker compose pull && docker compose up -d\`
- Stop: \`docker compose down\`
- Data lives in the \`clickhouse-data\` volume at \`/var/lib/clickhouse\`.
- Logs live in the \`clickhouse-logs\` volume at \`/var/log/clickhouse-server\`.
- Native backups use the configured \`launchpack_backups\` disk mounted at \`/backups\`, then copy \`clickhouse-native-backup.zip\` into the launchpack backup directory.
- Keep \`CLICKHOUSE_DB\` as a non-default database name so destructive restore can drop and recreate it safely.
- For large or business-critical datasets, move backup storage to S3 or another remote target and practice restore on a spare stack.
- This is an unofficial pack. It is not ClickHouse Cloud and does not imply ClickHouse, Inc. support or approval.
`,
    },
    {
      path: 'config.d/backup-disk.xml',
      content: `<clickhouse>
  <storage_configuration>
    <disks>
      <launchpack_backups>
        <type>local</type>
        <path>/backups/</path>
      </launchpack_backups>
    </disks>
  </storage_configuration>
  <backups>
    <allowed_disk>launchpack_backups</allowed_disk>
    <allowed_path>/backups/</allowed_path>
    <allow_concurrent_backups>false</allow_concurrent_backups>
    <allow_concurrent_restores>false</allow_concurrent_restores>
  </backups>
</clickhouse>
`,
    },
    {
      path: 'users.d/default-access.xml',
      content: `<clickhouse>
  <users>
    <default>
      <access_management>1</access_management>
    </default>
  </users>
</clickhouse>
`,
    },
    {
      path: 'initdb.d/.gitkeep',
      content: '',
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

APP_URL="\${APP_URL:-http://localhost:\${CLICKHOUSE_HTTP_PORT:-8123}/ping}"
compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return
  fi

  echo "Docker Compose is required. Install the Docker Compose plugin or docker-compose." >&2
  exit 1
}

compose exec -T clickhouse clickhouse-client \\
  --user "\${CLICKHOUSE_USER:-analytics}" \\
  --password "\${CLICKHOUSE_PASSWORD:-replace-with-a-long-random-password}" \\
  --query 'SELECT 1' >/dev/null

echo "ClickHouse is reachable through the native client; HTTP is mapped at $APP_URL"
`,
    },
  ],
}

const qdrant: Launchpack = {
  id: 'qdrant',
  name: 'Qdrant',
  category: 'Vector database',
  upstream: 'https://github.com/qdrant/qdrant',
  defaultPort: 6333,
  supportModel: 'permissive-hosting-fit',
  whyNow:
    'AI apps increasingly need a production vector store, and Qdrant is a popular Apache-2.0 vector database with an official Docker image and managed cloud path.',
  operationsFit:
    'Qdrant operations need durable vector storage, snapshot handling, API-key/TLS hardening, upgrade discipline, and restore checks for RAG/search workloads.',
  licenseNote:
    'Qdrant is Apache-2.0 licensed. Preserve upstream notices and trademarks, and do not present this launchpack as Qdrant Cloud or official Qdrant support.',
  sizing: {
    tier: 'single-node-heavy',
    minimumCpuCores: 2,
    minimumMemoryGb: 4,
    storage:
      '20 GB+ for small vector workloads; plan capacity around vector count, dimensions, payload indexes, snapshots, and compaction overhead.',
    scaling:
      'Start with one node for small RAG/search workloads. Move to Qdrant Cloud, Hybrid Cloud, Kubernetes, or a deliberately planned cluster before high-availability workloads.',
    notes: [
      'Vector dimensions, payload indexes, quantization, and write volume dominate CPU, RAM, and disk needs.',
      'Snapshots are written to /qdrant/snapshots in this pack, but volume backups should still stop writes before restore.',
      'Enable an API key and TLS or a trusted reverse proxy before exposing Qdrant outside a private network.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://localhost:6333/healthz',
    backupTargets: [
      {
        type: 'mount',
        id: 'qdrant-storage',
        service: 'qdrant',
        path: '/qdrant/storage',
        description: 'Qdrant collections, segments, payload indexes, and service state.',
      },
      {
        type: 'mount',
        id: 'qdrant-snapshots',
        service: 'qdrant',
        path: '/qdrant/snapshots',
        description: 'Qdrant local snapshot files used for collection recovery and migrations.',
      },
    ],
    upgrade: {
      command: 'docker compose pull && docker compose up -d',
      notes: [
        'Back up storage and snapshots before changing Qdrant versions.',
        'Review Qdrant release notes for storage, snapshot, and distributed-mode changes before major upgrades.',
        'Avoid writes during restore; restore volume state before restarting application traffic that depends on vectors.',
        'Keep API keys, TLS, and reverse-proxy configuration consistent across upgrades.',
      ],
    },
  },
  files: [
    {
      path: 'compose.yaml',
      content: `services:
  qdrant:
    image: qdrant/qdrant:\${QDRANT_VERSION:-latest}
    restart: unless-stopped
    ports:
      - "\${QDRANT_HTTP_PORT:-6333}:6333"
      - "\${QDRANT_GRPC_PORT:-6334}:6334"
    volumes:
      - qdrant-storage:/qdrant/storage
      - qdrant-snapshots:/qdrant/snapshots
      - ./config/production.yaml:/qdrant/config/production.yaml:ro

volumes:
  qdrant-storage:
  qdrant-snapshots:
`,
    },
    {
      path: '.env.example',
      content: `QDRANT_VERSION=latest
QDRANT_HTTP_PORT=6333
QDRANT_GRPC_PORT=6334
QDRANT_URL=http://localhost:6333
`,
    },
    {
      path: 'config/production.yaml',
      content: `storage:
  snapshots_path: /qdrant/snapshots

# Enable a service.api_key before exposing Qdrant outside a private network.
# Pair API keys with TLS or a trusted reverse proxy.
# Example:
# service:
#   api_key: replace-with-a-long-random-secret
#   read_only_api_key: replace-with-a-long-random-readonly-secret
`,
    },
    {
      path: 'README.md',
      content: `# Qdrant Launchpack

This pack runs the official Qdrant Docker image with persistent storage,
separate local snapshots, a generated operations manifest, and explicit
security/restore notes for self-hosted vector search workloads.

## Start

\`\`\`bash
cp .env.example .env
docker compose up -d
./ops/healthcheck.sh
\`\`\`

Open http://localhost:6333/dashboard for the local dashboard, or use the REST
API at http://localhost:6333.

## Operations

- Qdrant is Apache-2.0 licensed; preserve upstream notices and trademarks.
- Qdrant Cloud is the upstream managed path. Do not present this launchpack as Qdrant Cloud or official Qdrant support.
- Persistent vector data is stored in \`qdrant-storage\` at \`/qdrant/storage\`.
- Local snapshots are stored in \`qdrant-snapshots\` at \`/qdrant/snapshots\`.
- Enable API keys in \`config/production.yaml\` and put Qdrant behind TLS or a trusted reverse proxy before exposing it outside a private network.
- Stop writes before restoring volume backups for production-like workloads.
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

APP_URL="\${APP_URL:-\${QDRANT_URL:-http://localhost:6333}}"
curl -fsS "$APP_URL/healthz" >/dev/null
echo "Qdrant is reachable at $APP_URL"
`,
    },
  ],
}

const meilisearch: Launchpack = {
  id: 'meilisearch',
  name: 'Meilisearch',
  category: 'Search',
  upstream: 'https://github.com/meilisearch/meilisearch',
  defaultPort: 7700,
  supportModel: 'review-required',
  whyNow:
    'Search is a core feature in self-hosted apps, and Meilisearch is a popular search engine with a simple Docker path but important operator details around master keys, persistent indexes, dumps, snapshots, and upgrades.',
  operationsFit:
    'Meilisearch operations need a production master key, persistent /meili_data storage, health checks, backup/restore validation, and upgrade notes that separate volume restores from dump or snapshot migrations.',
  licenseNote:
    'Meilisearch includes Community Edition code under MIT and Enterprise Edition code under Business Source License 1.1. Keep the support model conservative, preserve upstream notices, and do not present this launchpack as Meilisearch Cloud or official Meilisearch support.',
  sizing: {
    tier: 'single-node',
    minimumCpuCores: 2,
    minimumMemoryGb: 2,
    storage:
      '10 GB+ for small search workloads; plan disk for indexes, task queue history, dumps, snapshots, and temporary staging during dump/snapshot creation.',
    scaling:
      'Start as a single-node search service. For high availability, managed cloud, sharding, or replication, follow upstream guidance instead of extending this starter pack casually.',
    notes: [
      'Production mode requires a master key of at least 16 bytes.',
      'Dumps are intended for migrations between different Meilisearch versions; snapshots are best suited for backup or same-version migrations.',
      'The generated backup is a stopped-service volume restore boundary for /meili_data, not a live-consistent database snapshot.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://localhost:7700/health',
    backupTargets: [
      {
        type: 'mount',
        id: 'meilisearch-data',
        service: 'meilisearch',
        path: '/meili_data',
        description:
          'Meilisearch database files, indexes, task queue state, generated dumps, and snapshots.',
      },
    ],
    upgrade: {
      command: 'docker compose pull && docker compose up -d',
      notes: [
        'Pin MEILISEARCH_VERSION in production so upgrades are intentional.',
        'Back up /meili_data and consider creating an upstream dump or snapshot before changing versions.',
        'Use dumps for migrations between different Meilisearch versions; use snapshots for same-version backup or migration paths.',
        'Keep MEILI_MASTER_KEY stable. Rotating it changes API access and should be handled deliberately.',
      ],
    },
  },
  files: [
    {
      path: 'compose.yaml',
      content: `services:
  meilisearch:
    image: getmeili/meilisearch:\${MEILISEARCH_VERSION:-latest}
    restart: unless-stopped
    ports:
      - "\${MEILISEARCH_PORT:-7700}:7700"
    environment:
      MEILI_ENV: "\${MEILI_ENV:-production}"
      MEILI_MASTER_KEY: "\${MEILI_MASTER_KEY:?Set MEILI_MASTER_KEY in .env}"
      MEILI_DB_PATH: /meili_data/data.ms
      MEILI_DUMP_DIR: /meili_data/dumps
      MEILI_SNAPSHOT_DIR: /meili_data/snapshots
      MEILI_SCHEDULE_SNAPSHOT: "\${MEILI_SCHEDULE_SNAPSHOT:-86400}"
    volumes:
      - meilisearch-data:/meili_data

volumes:
  meilisearch-data:
`,
    },
    {
      path: '.env.example',
      content: `MEILISEARCH_VERSION=latest
MEILISEARCH_PORT=7700
MEILISEARCH_URL=http://localhost:7700
MEILI_ENV=production
MEILI_MASTER_KEY=replace-with-a-long-random-master-key
MEILI_SCHEDULE_SNAPSHOT=86400
`,
    },
    {
      path: 'README.md',
      content: `# Meilisearch Launchpack

This pack runs the official Meilisearch Docker image with persistent
\`/meili_data\` storage, production-mode master-key configuration, generated
operations metadata, and explicit restore notes for self-hosted search.

## Start

\`\`\`bash
cp .env.example .env
# Edit MEILI_MASTER_KEY before first start. It must be at least 16 bytes in production mode.
docker compose up -d
./ops/healthcheck.sh
\`\`\`

Open http://localhost:7700 for the API. Most routes require
\`Authorization: Bearer <MEILI_MASTER_KEY>\`.

## Operations

- Meilisearch includes MIT-licensed Community Edition code and Business Source License 1.1 Enterprise Edition code; review upstream terms before commercial use.
- Meilisearch Cloud is the upstream managed path. Do not present this launchpack as Meilisearch Cloud or official Meilisearch support.
- Persistent data is stored in \`meilisearch-data\` at \`/meili_data\`, including \`data.ms\`, dumps, and snapshots.
- Dump and snapshot creation use temporary staging space. For large databases, configure \`TMPDIR\` deliberately on a volume with enough free space.
- Keep \`MEILI_MASTER_KEY\` stable and secret. Production mode requires a key of at least 16 bytes.
- Use upstream dumps for migrations between different Meilisearch versions and snapshots for backup or same-version migrations.
- Stop writes before restoring the generated volume backup for production-like workloads.
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

APP_URL="\${APP_URL:-\${MEILISEARCH_URL:-http://localhost:7700}}"
curl -fsS "$APP_URL/health" >/dev/null
echo "Meilisearch is reachable at $APP_URL"
`,
    },
  ],
}

const typesense: Launchpack = {
  id: 'typesense',
  name: 'Typesense',
  category: 'Search',
  upstream: 'https://github.com/typesense/typesense',
  defaultPort: 8108,
  supportModel: 'review-required',
  whyNow:
    'Fast typo-tolerant search is a common missing piece in self-hosted apps, and Typesense has an official Docker image plus a simple single-node shape that still needs careful API-key, snapshot, and restore handling.',
  operationsFit:
    'Typesense operations need a bootstrap API key, durable /data storage, health checks, official snapshot-based backups, stopped-service restores, and upgrade notes for search-heavy apps.',
  licenseNote:
    'Typesense is GPL-3.0 licensed upstream. Preserve upstream notices and trademarks, review commercial and hosted-service constraints for your use case, and do not present this launchpack as Typesense Cloud or official Typesense support.',
  sizing: {
    tier: 'single-node',
    minimumCpuCores: 2,
    minimumMemoryGb: 2,
    storage:
      '10 GB+ for small search workloads; plan extra space for snapshots, imports, compaction, and rebuilds after restore.',
    scaling:
      'Start as a single-node search service. For high availability, clustering, or managed operations, follow upstream guidance before extending this starter pack.',
    notes: [
      'Every endpoint except /health requires the bootstrap API key.',
      'The generated backup uses the official snapshot endpoint instead of archiving a live data directory directly.',
      'Restore stops Typesense, replaces /data with the snapshot contents, and restarts the service so in-memory indexes rebuild from disk.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://localhost:8108/health',
    backupTargets: [
      {
        type: 'command',
        id: 'typesense-snapshot',
        description:
          'Official Typesense server-side snapshot archived from /data/snapshots for same-version backup and restore.',
        backupCommands: [
          'TYPESENSE_URL="${TYPESENSE_URL:-http://localhost:${TYPESENSE_PORT:-8108}}"',
          'TYPESENSE_API_KEY="${TYPESENSE_API_KEY:-$(read_env_file_value .env TYPESENSE_API_KEY || true)}"',
          'if [ -z "$TYPESENSE_API_KEY" ]; then echo "Set TYPESENSE_API_KEY in .env before backing up Typesense." >&2; exit 1; fi',
          'snapshot_name="launchpack-$STAMP"',
          'snapshot_path="/data/snapshots/$snapshot_name"',
          'curl -fsS -X POST "$TYPESENSE_URL/operations/snapshot?snapshot_path=$snapshot_path" -H "X-TYPESENSE-API-KEY: $TYPESENSE_API_KEY" >/dev/null',
          'container_id="$(compose ps -q typesense)"',
          'if [ -z "$container_id" ]; then echo "Service typesense is not running. Start the stack before backing up Typesense." >&2; exit 1; fi',
          'source_path="$(docker inspect "$container_id" --format "{{range .Mounts}}{{if eq .Destination \\"/data\\"}}{{.Source}}{{end}}{{end}}")"',
          'if [ -z "$source_path" ]; then echo "Could not find /data mount on service typesense." >&2; exit 1; fi',
          'docker run --rm -v "$source_path:/data:ro" -v "$BACKUP_DIR_ABS:/backup" alpine:3.20 sh -c "test -d \\"/data/snapshots/$snapshot_name\\" && tar -C \\"/data/snapshots/$snapshot_name\\" -czf /backup/typesense-snapshot.tar.gz ."',
        ],
        restoreCommands: [
          'if [ ! -f "$BACKUP_DIR_ABS/typesense-snapshot.tar.gz" ]; then echo "Missing archive: $BACKUP_DIR_ABS/typesense-snapshot.tar.gz" >&2; exit 1; fi',
          'container_id="$(compose ps -a -q typesense | head -n 1)"',
          'if [ -z "$container_id" ]; then echo "Service typesense does not have a container. Create the stack before restoring Typesense." >&2; exit 1; fi',
          'source_path="$(docker inspect "$container_id" --format "{{range .Mounts}}{{if eq .Destination \\"/data\\"}}{{.Source}}{{end}}{{end}}")"',
          'if [ -z "$source_path" ]; then echo "Could not find /data mount on service typesense." >&2; exit 1; fi',
          'compose stop typesense >/dev/null',
          'docker run --rm -i -v "$source_path:/data" alpine:3.20 sh -c "set -eu; find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} +; tar -C /data -xzf -" < "$BACKUP_DIR_ABS/typesense-snapshot.tar.gz"',
          'compose up -d typesense',
        ],
      },
    ],
    upgrade: {
      command: 'docker compose pull && docker compose up -d',
      notes: [
        'Pin TYPESENSE_VERSION in production so upgrades are intentional.',
        'Create a snapshot backup before changing Typesense versions.',
        'Review upstream release notes for index format, snapshot, clustering, and API changes before major upgrades.',
        'Keep TYPESENSE_API_KEY stable and secret. Rotate API access deliberately through upstream key-management APIs.',
      ],
    },
  },
  files: [
    {
      path: 'compose.yaml',
      content: `services:
  typesense:
    image: typesense/typesense:\${TYPESENSE_VERSION:-30.2}
    restart: unless-stopped
    ports:
      - "\${TYPESENSE_PORT:-8108}:8108"
    command:
      - --data-dir
      - /data
      - --api-key=\${TYPESENSE_API_KEY:?Set TYPESENSE_API_KEY in .env}
      - --api-address
      - 0.0.0.0
      - --api-port
      - "8108"
    volumes:
      - typesense-data:/data

volumes:
  typesense-data:
`,
    },
    {
      path: '.env.example',
      content: `TYPESENSE_VERSION=30.2
TYPESENSE_PORT=8108
TYPESENSE_URL=http://localhost:8108
TYPESENSE_API_KEY=replace-with-a-long-random-api-key
`,
    },
    {
      path: 'README.md',
      content: `# Typesense Launchpack

This pack runs the official Typesense Docker image with persistent \`/data\`
storage, a required bootstrap API key, generated operations metadata, and
snapshot-based backup/restore scripts for self-hosted search workloads.

## Start

\`\`\`bash
cp .env.example .env
# Edit TYPESENSE_API_KEY before first start.
docker compose up -d
./ops/healthcheck.sh
\`\`\`

Open http://localhost:8108/health to verify the service. Other API routes
require \`X-TYPESENSE-API-KEY: <TYPESENSE_API_KEY>\`.

## Operations

- Typesense is GPL-3.0 licensed; review upstream terms before commercial use.
- Typesense Cloud is the upstream managed path. Do not present this launchpack as Typesense Cloud or official Typesense support.
- This pack defaults to \`TYPESENSE_VERSION=30.2\` because the upstream Docker repository does not publish a \`latest\` tag.
- Persistent data is stored in \`typesense-data\` at \`/data\`.
- Backups use the official \`/operations/snapshot\` endpoint, then archive the server-side snapshot directory.
- Restore stops Typesense, replaces \`/data\` with the snapshot archive contents, and restarts the service so indexes rebuild from disk.
- Keep \`TYPESENSE_API_KEY\` stable and secret. Rotate API keys deliberately through upstream key-management APIs.
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

APP_URL="\${APP_URL:-\${TYPESENSE_URL:-http://localhost:8108}}"
curl -fsS "$APP_URL/health" >/dev/null
echo "Typesense is reachable at $APP_URL"
`,
    },
  ],
}

const outline: Launchpack = {
  id: 'outline',
  name: 'Outline',
  category: 'Team knowledge',
  upstream: 'https://github.com/outline/outline',
  defaultPort: 3000,
  supportModel: 'customer-owned-only',
  whyNow:
    'Teams want a self-hosted Notion/Confluence alternative, but Outline needs a correct URL, durable Postgres, Redis, file storage, auth provider setup, and careful license boundaries.',
  operationsFit:
    'Outline operations should focus on customer-owned team deployments, SSO/OIDC setup, backups, upgrades, and migration help with clear BSL use boundaries.',
  licenseNote:
    'Outline is BSL-1.1 licensed. Current versions allow internal/customer-owned use but prohibit using the software for a commercial Document Service where third parties create teams and documents they control. Versions convert to Apache-2.0 on their BSL change date; review the upstream LICENSE for the exact version and date.',
  sizing: {
    tier: 'single-node',
    minimumCpuCores: 2,
    minimumMemoryGb: 4,
    storage: '20 GB+ for Postgres, Redis persistence, and local attachment storage.',
    scaling:
      'Start as a single-node team wiki; move file storage to S3-compatible storage before multi-host scaling.',
    notes: [
      'Attachment volume, not documents, usually drives storage growth.',
      'At least one auth provider is required before real team use.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://localhost:3000',
    backupTargets: [
      {
        type: 'postgres',
        id: 'outline-postgres',
        service: 'postgres',
        databaseEnv: 'POSTGRES_DB',
        userEnv: 'POSTGRES_USER',
        description: 'Outline documents, users, collections, permissions, and application metadata.',
      },
      {
        type: 'mount',
        id: 'outline-storage',
        service: 'outline',
        path: '/var/lib/outline/data',
        description: 'Local Outline attachment and image storage when FILE_STORAGE=local.',
      },
      {
        type: 'mount',
        id: 'outline-redis',
        service: 'redis',
        path: '/data',
        description: 'Redis cache, collaboration, and queue state for the single-node deployment.',
      },
    ],
    upgrade: {
      command: 'docker compose pull && docker compose up -d',
      notes: [
        'Pin image versions in production instead of relying on latest.',
        'Back up Postgres and local file storage before changing the Outline image tag.',
        'Migrations run automatically when the Outline container starts unless disabled upstream.',
        'Keep SECRET_KEY and UTILS_SECRET stable across restores.',
      ],
    },
  },
  files: [
    {
      path: 'compose.yaml',
      content: `services:
  outline:
    image: docker.getoutline.com/outlinewiki/outline:\${OUTLINE_VERSION:-latest}
    restart: unless-stopped
    env_file: ./.env
    ports:
      - "\${OUTLINE_PORT:-3000}:3000"
    environment:
      NODE_ENV: production
      URL: "\${OUTLINE_URL:-http://localhost:3000}"
      PORT: 3000
      DATABASE_URL: "postgres://\${POSTGRES_USER:-outline}:\${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}@postgres:5432/\${POSTGRES_DB:-outline}"
      REDIS_URL: redis://redis:6379
      PGSSLMODE: disable
      FILE_STORAGE: local
      FILE_STORAGE_LOCAL_ROOT_DIR: /var/lib/outline/data
      FORCE_HTTPS: "\${FORCE_HTTPS:-false}"
      SECRET_KEY: "\${SECRET_KEY:?set SECRET_KEY in .env}"
      UTILS_SECRET: "\${UTILS_SECRET:?set UTILS_SECRET in .env}"
    volumes:
      - storage-data:/var/lib/outline/data
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: "\${POSTGRES_DB:-outline}"
      POSTGRES_USER: "\${POSTGRES_USER:-outline}"
      POSTGRES_PASSWORD: "\${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}"
    volumes:
      - database-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-outline} -d \${POSTGRES_DB:-outline}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--save", "60", "1", "--loglevel", "warning"]
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  database-data:
  redis-data:
  storage-data:
`,
    },
    {
      path: '.env.example',
      content: `OUTLINE_VERSION=latest
OUTLINE_PORT=3000
OUTLINE_URL=http://localhost:3000
FORCE_HTTPS=false

POSTGRES_DB=outline
POSTGRES_USER=outline
POSTGRES_PASSWORD=replace-with-a-long-random-password

# Generate with: openssl rand -hex 32
SECRET_KEY=replace-with-a-32-byte-random-secret
UTILS_SECRET=replace-with-a-32-byte-random-secret

# Configure at least one auth provider before inviting users.
# Generic OIDC is usually the cleanest self-hosted path.
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_AUTH_URI=
OIDC_TOKEN_URI=
OIDC_USERINFO_URI=
OIDC_LOGOUT_URI=
OIDC_USERNAME_CLAIM=preferred_username
OIDC_DISPLAY_NAME=OpenID Connect
OIDC_SCOPES=openid profile email

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
`,
    },
    {
      path: 'README.md',
      content: `# Outline Launchpack

This pack follows Outline's official Docker Compose guidance and keeps the
operational surface explicit: Postgres, Redis, local file storage, secrets, URL,
and authentication provider configuration.

## Start

\`\`\`bash
cp .env.example .env
# Edit OUTLINE_URL, POSTGRES_PASSWORD, SECRET_KEY, UTILS_SECRET, and one auth provider.
docker compose up -d
./ops/healthcheck.sh
\`\`\`

Open http://localhost:3000 for local testing, or the URL configured in \`.env\`.

## Operations

- Pin \`OUTLINE_VERSION\` in production so upgrades are intentional.
- Keep \`SECRET_KEY\` and \`UTILS_SECRET\` stable. Changing them can break sessions and encrypted data.
- Back up Postgres and \`storage-data\` before upgrades.
- Local file storage is enabled by default. Use S3-compatible storage if you need distributed storage.
- At least one auth provider is required for a usable installation.
- This pack is for customer-owned deployments and professional services; do not resell Outline as a hosted document service without upstream agreement.
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

APP_URL="\${APP_URL:-\${OUTLINE_URL:-http://localhost:3000}}"
curl -fsS "$APP_URL" >/dev/null
echo "Outline is reachable at $APP_URL"
`,
    },
  ],
}

const supabase: Launchpack = {
  id: 'supabase',
  name: 'Supabase',
  category: 'Backend platform',
  upstream: 'https://github.com/supabase/supabase/tree/master/docker',
  defaultPort: 8000,
  supportModel: 'permissive-hosting-fit',
  whyNow:
    'Supabase is one of the clearest open-source backend platforms, but self-hosting means operating a coordinated stack: Postgres, Auth, PostgREST, Realtime, Storage, Studio, Kong, Supavisor, functions, secrets, and optional logs/S3 layers.',
  operationsFit:
    'Supabase operations need an official-stack wrapper, secret generation checklist, backup boundaries for Postgres/storage/functions/config, and upgrade notes that keep service versions coordinated.',
  licenseNote:
    'The Supabase repository is Apache-2.0 licensed. Self-hosted Supabase is community-supported and omits several managed-platform features; preserve upstream notices, review included service licenses, and do not imply official Supabase Cloud support.',
  sizing: {
    tier: 'official-stack-heavy',
    minimumCpuCores: 4,
    minimumMemoryGb: 8,
    storage:
      '40 GB+ for Postgres, local Storage, functions, snippets, and db-config secrets; database and object storage growth dominate.',
    scaling:
      'Use the official single-project Docker stack first. For serious workloads, move Storage to S3-compatible storage and plan Postgres capacity separately.',
    notes: [
      'Self-hosted Supabase is not the managed Supabase platform and omits managed backups/PITR.',
      'The pgsodium key and .env are recovery-critical configuration, not optional metadata.',
      'Generic restore covers project-owned public schema data and default Storage buckets/objects only; auth, vault, realtime, extension-owned, and advanced Storage internals need an operator-specific recovery plan.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://localhost:8000/rest/v1/',
    backupTargets: [
      {
        type: 'command',
        id: 'supabase-secrets-config',
        description:
          'Official Docker .env and db-config pgsodium root key. Losing the key can make vault secrets unrecoverable.',
        backupCommands: [
          'SUPABASE_PROJECT_DIR="${SUPABASE_PROJECT_DIR:-self-hosted}"',
          'if [ ! -d "$SUPABASE_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before backing up Supabase." >&2; exit 1; fi',
          'if [ -f "$SUPABASE_PROJECT_DIR/.env" ]; then cp "$SUPABASE_PROJECT_DIR/.env" "$BACKUP_DIR_ABS/supabase.env"; chmod 600 "$BACKUP_DIR_ABS/supabase.env"; fi',
          'if docker volume inspect supabase_db-config >/dev/null 2>&1; then docker run --rm -v supabase_db-config:/db-config:ro -v "$BACKUP_DIR_ABS:/backup" alpine:3.20 sh -c "if [ -f /db-config/pgsodium_root.key ]; then cp /db-config/pgsodium_root.key /backup/pgsodium_root.key; fi"; fi',
        ],
        restoreCommands: [
          'SUPABASE_PROJECT_DIR="${SUPABASE_PROJECT_DIR:-self-hosted}"',
          'mkdir -p "$SUPABASE_PROJECT_DIR"',
          'if [ -f "$BACKUP_DIR_ABS/supabase.env" ]; then cp "$BACKUP_DIR_ABS/supabase.env" "$SUPABASE_PROJECT_DIR/.env"; chmod 600 "$SUPABASE_PROJECT_DIR/.env"; fi',
          'if [ -f "$BACKUP_DIR_ABS/pgsodium_root.key" ]; then docker volume create supabase_db-config >/dev/null; docker run --rm -v supabase_db-config:/db-config -v "$BACKUP_DIR_ABS:/backup:ro" alpine:3.20 sh -c "mkdir -p /db-config && cp /backup/pgsodium_root.key /db-config/pgsodium_root.key"; fi',
        ],
      },
      {
        type: 'command',
        id: 'supabase-local-files',
        description:
          'Default local Storage files, Edge Functions, and Studio snippets from the official volumes directory.',
        backupCommands: [
          'SUPABASE_PROJECT_DIR="${SUPABASE_PROJECT_DIR:-self-hosted}"',
          'if [ ! -d "$SUPABASE_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before backing up Supabase." >&2; exit 1; fi',
          'for dir in storage functions snippets; do if [ -d "$SUPABASE_PROJECT_DIR/volumes/$dir" ]; then tar -C "$SUPABASE_PROJECT_DIR/volumes" -czf "$BACKUP_DIR_ABS/supabase-$dir.tar.gz" "$dir"; fi; done',
        ],
        restoreCommands: [
          'SUPABASE_PROJECT_DIR="${SUPABASE_PROJECT_DIR:-self-hosted}"',
          'mkdir -p "$SUPABASE_PROJECT_DIR/volumes"',
          'for dir in storage functions snippets; do if [ -f "$BACKUP_DIR_ABS/supabase-$dir.tar.gz" ]; then rm -rf "$SUPABASE_PROJECT_DIR/volumes/$dir"; tar -C "$SUPABASE_PROJECT_DIR/volumes" -xzf "$BACKUP_DIR_ABS/supabase-$dir.tar.gz"; fi; done',
        ],
      },
      {
        type: 'command',
        id: 'supabase-storage-metadata',
        description:
          'Logical export of default Storage bucket/object metadata needed to match local Storage files.',
        backupCommands: [
          'SUPABASE_PROJECT_DIR="${SUPABASE_PROJECT_DIR:-self-hosted}"',
          'if [ ! -d "$SUPABASE_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before backing up Supabase." >&2; exit 1; fi',
          'SUPABASE_ENV_FILE="$SUPABASE_PROJECT_DIR/.env"',
          'SUPABASE_POSTGRES_PASSWORD="$(read_env_file_value "$SUPABASE_ENV_FILE" POSTGRES_PASSWORD || true)"',
          'if [ -z "$SUPABASE_POSTGRES_PASSWORD" ]; then echo "Missing POSTGRES_PASSWORD in $SUPABASE_ENV_FILE." >&2; exit 1; fi',
          '(cd "$SUPABASE_PROJECT_DIR" && docker compose exec -T db env PGPASSWORD="$SUPABASE_POSTGRES_PASSWORD" pg_dump --data-only --table=storage.buckets --table=storage.objects -U supabase_admin -d postgres) > "$BACKUP_DIR_ABS/supabase-storage-metadata.sql"',
        ],
        restoreCommands: [
          'SUPABASE_PROJECT_DIR="${SUPABASE_PROJECT_DIR:-self-hosted}"',
          'if [ ! -d "$SUPABASE_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before restoring Supabase." >&2; exit 1; fi',
          'if [ ! -f "$BACKUP_DIR_ABS/supabase-storage-metadata.sql" ]; then echo "Missing dump: $BACKUP_DIR_ABS/supabase-storage-metadata.sql" >&2; exit 1; fi',
          'SUPABASE_ENV_FILE="$SUPABASE_PROJECT_DIR/.env"',
          'SUPABASE_POSTGRES_PASSWORD="$(read_env_file_value "$SUPABASE_ENV_FILE" POSTGRES_PASSWORD || true)"',
          'if [ -z "$SUPABASE_POSTGRES_PASSWORD" ]; then echo "Missing POSTGRES_PASSWORD in $SUPABASE_ENV_FILE." >&2; exit 1; fi',
          'for service in $(cd "$SUPABASE_PROJECT_DIR" && docker compose ps --services --filter status=running); do if [ "$service" != "db" ]; then (cd "$SUPABASE_PROJECT_DIR" && docker compose stop "$service" >/dev/null); fi; done',
          "(cd \"$SUPABASE_PROJECT_DIR\" && docker compose exec -T db env PGPASSWORD=\"$SUPABASE_POSTGRES_PASSWORD\" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \"begin; select set_config('storage.allow_delete_query', 'true', true); delete from storage.objects; delete from storage.buckets; commit;\")",
          '(cd "$SUPABASE_PROJECT_DIR" && docker compose exec -T db env PGPASSWORD="$SUPABASE_POSTGRES_PASSWORD" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1) < "$BACKUP_DIR_ABS/supabase-storage-metadata.sql"',
          '(cd "$SUPABASE_PROJECT_DIR" && docker compose up -d --wait)',
        ],
      },
      {
        type: 'command',
        id: 'supabase-public-schema',
        description:
          'Logical pg_dump export of the project-owned public schema from the official Supabase Postgres service.',
        backupCommands: [
          'SUPABASE_PROJECT_DIR="${SUPABASE_PROJECT_DIR:-self-hosted}"',
          'if [ ! -d "$SUPABASE_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before backing up Supabase." >&2; exit 1; fi',
          'SUPABASE_ENV_FILE="$SUPABASE_PROJECT_DIR/.env"',
          'SUPABASE_POSTGRES_PASSWORD="$(read_env_file_value "$SUPABASE_ENV_FILE" POSTGRES_PASSWORD || true)"',
          'if [ -z "$SUPABASE_POSTGRES_PASSWORD" ]; then echo "Missing POSTGRES_PASSWORD in $SUPABASE_ENV_FILE." >&2; exit 1; fi',
          '(cd "$SUPABASE_PROJECT_DIR" && docker compose exec -T db env PGPASSWORD="$SUPABASE_POSTGRES_PASSWORD" pg_dump --clean --if-exists --schema=public -U supabase_admin -d postgres) > "$BACKUP_DIR_ABS/supabase-public-schema.sql"',
        ],
        restoreCommands: [
          'SUPABASE_PROJECT_DIR="${SUPABASE_PROJECT_DIR:-self-hosted}"',
          'if [ ! -d "$SUPABASE_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before restoring Supabase." >&2; exit 1; fi',
          'if [ ! -f "$BACKUP_DIR_ABS/supabase-public-schema.sql" ]; then echo "Missing dump: $BACKUP_DIR_ABS/supabase-public-schema.sql" >&2; exit 1; fi',
          'SUPABASE_ENV_FILE="$SUPABASE_PROJECT_DIR/.env"',
          'SUPABASE_POSTGRES_PASSWORD="$(read_env_file_value "$SUPABASE_ENV_FILE" POSTGRES_PASSWORD || true)"',
          'if [ -z "$SUPABASE_POSTGRES_PASSWORD" ]; then echo "Missing POSTGRES_PASSWORD in $SUPABASE_ENV_FILE." >&2; exit 1; fi',
          'for service in $(cd "$SUPABASE_PROJECT_DIR" && docker compose ps --services --filter status=running); do if [ "$service" != "db" ]; then (cd "$SUPABASE_PROJECT_DIR" && docker compose stop "$service" >/dev/null); fi; done',
          '(cd "$SUPABASE_PROJECT_DIR" && docker compose exec -T db env PGPASSWORD="$SUPABASE_POSTGRES_PASSWORD" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1) < "$BACKUP_DIR_ABS/supabase-public-schema.sql"',
          '(cd "$SUPABASE_PROJECT_DIR" && docker compose up -d --wait)',
        ],
      },
    ],
    upgrade: {
      command: './ops/install-official.sh && (cd self-hosted && docker compose pull && docker compose down && docker compose up -d)',
      notes: [
        'Review the official docker/CHANGELOG.md and docker/versions.md before updating.',
        'Back up the public schema, Storage bucket/object metadata, .env, db-config/pgsodium key, Storage files, and functions before every upgrade.',
        'Pin SUPABASE_SOURCE_REF to a tested commit or tag for production-like installs.',
        'Follow Supabase Postgres upgrade guides for major Postgres changes instead of swapping the database image casually.',
        'Keep COMPOSE_FILE overrides such as logs, S3, HTTPS proxy, and Postgres 17 consistent across start, backup, restore, and upgrade commands.',
      ],
    },
  },
  files: [
    {
      path: '.env.example',
      content: `SUPABASE_SOURCE_REF=master
SUPABASE_PROJECT_DIR=self-hosted
SUPABASE_UPSTREAM_DIR=.upstream/supabase
SUPABASE_HEALTH_URL=http://localhost:8000/rest/v1/
`,
    },
    {
      path: 'README.md',
      content: `# Supabase Launchpack

This pack wraps the official \`supabase/supabase/docker\` setup instead of
copying Supabase's coordinated Compose stack into this generator. Supabase
ships multiple tightly-coupled services, so the launchpack keeps upstream files
intact and adds an inspectable operations manifest, install script, health
check, and backup/restore surface around them.

## Start

\`\`\`bash
cp .env.example .env
./ops/install-official.sh
cd self-hosted
sh utils/generate-keys.sh
sh utils/add-new-auth-keys.sh
# Edit .env before first start: passwords, URLs, dashboard auth, SMTP, OAuth, and storage.
docker compose config >/dev/null
sh run.sh start
cd ..
./ops/healthcheck.sh
\`\`\`

Open http://localhost:8000 for local testing, or the URL configured in the
official \`self-hosted/.env\`.

## Operations

- The official Docker setup is community-supported and not the managed Supabase platform.
- Self-hosted Supabase is a single-project stack; platform features such as managed backups, PITR, branching, and some analytics/vector features are not included.
- Change all default secrets before first start. The official \`.env.example\` is intentionally not production-secure.
- Back up the public schema, \`storage.buckets\`/\`storage.objects\` metadata, \`self-hosted/.env\`, the \`supabase_db-config\` pgsodium key, local Storage files, functions, and snippets before upgrades.
- The generated restore covers project-owned \`public\` data and default Storage bucket/object metadata. It intentionally does not rewrite \`auth\`, \`vault\`, realtime, extension-owned, or advanced Storage internals such as multipart uploads, vector indexes, or Iceberg tables.
- Use HTTPS through a reverse proxy before exposing auth, dashboard, or API traffic to real users.
- Prefer S3-compatible Storage for production-like file durability; the default file backend stores files on the host filesystem.
- Pin \`SUPABASE_SOURCE_REF\` to a tested upstream ref for repeatable installs.
`,
    },
    {
      path: 'ops/install-official.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

SUPABASE_SOURCE_REF="\${SUPABASE_SOURCE_REF:-master}"
SUPABASE_PROJECT_DIR="\${SUPABASE_PROJECT_DIR:-self-hosted}"
SUPABASE_UPSTREAM_DIR="\${SUPABASE_UPSTREAM_DIR:-.upstream/supabase}"
ROOT_DIR="$(pwd)"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required to install the official Supabase Docker setup." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is required before installing Supabase self-hosted." >&2
  exit 1
fi

mkdir -p "$(dirname "$SUPABASE_UPSTREAM_DIR")"

if [ ! -d "$SUPABASE_UPSTREAM_DIR/.git" ]; then
  git clone --filter=blob:none --sparse https://github.com/supabase/supabase.git "$SUPABASE_UPSTREAM_DIR"
fi

cd "$SUPABASE_UPSTREAM_DIR"
git fetch --depth 1 origin "$SUPABASE_SOURCE_REF"
git checkout --detach FETCH_HEAD
git sparse-checkout init --cone >/dev/null 2>&1 || true
git sparse-checkout set docker
cd "$ROOT_DIR"

mkdir -p "$SUPABASE_PROJECT_DIR"
cp -R "$SUPABASE_UPSTREAM_DIR/docker/." "$SUPABASE_PROJECT_DIR/"

if [ ! -f "$SUPABASE_PROJECT_DIR/.env" ]; then
  cp "$SUPABASE_PROJECT_DIR/.env.example" "$SUPABASE_PROJECT_DIR/.env"
fi

echo "Official Supabase Docker setup installed in $SUPABASE_PROJECT_DIR"
echo "Next: cd $SUPABASE_PROJECT_DIR && sh utils/generate-keys.sh && sh utils/add-new-auth-keys.sh"
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

SUPABASE_PROJECT_DIR="\${SUPABASE_PROJECT_DIR:-self-hosted}"
APP_URL="\${APP_URL:-\${SUPABASE_HEALTH_URL:-http://localhost:8000/rest/v1/}}"

if [ ! -d "$SUPABASE_PROJECT_DIR" ]; then
  echo "Run ./ops/install-official.sh before checking Supabase." >&2
  exit 1
fi

status="$(curl -sS -o /dev/null -w '%{http_code}' "$APP_URL" || true)"

case "$status" in
  2*|3*|401|403|404)
    echo "Supabase gateway is reachable at $APP_URL with HTTP $status"
    ;;
  *)
    echo "Supabase gateway check failed at $APP_URL with HTTP $status" >&2
    (cd "$SUPABASE_PROJECT_DIR" && docker compose ps)
    exit 1
    ;;
esac

(cd "$SUPABASE_PROJECT_DIR" && docker compose ps)
`,
    },
  ],
}

const dify: Launchpack = {
  id: 'dify',
  name: 'Dify',
  category: 'AI application platform',
  upstream: 'https://github.com/langgenius/dify/tree/main/docker',
  defaultPort: 80,
  supportModel: 'upstream-agreement-required',
  whyNow:
    'Dify is a high-demand agentic AI application platform, but self-hosting means operating API services, workers, plugin daemon, web, Postgres, Redis, Weaviate, sandboxing, SSRF proxying, nginx, secrets, uploads, and model-provider configuration.',
  operationsFit:
    'Dify operations need an official-stack wrapper, release pinning, secret rotation checklist, backup boundaries for Postgres/storage/plugins/vector data, and clear license boundaries around multi-tenant use.',
  licenseNote:
    'Dify uses a modified Apache-2.0 license. Commercial use is allowed, but operating a multi-tenant environment requires written Dify authorization; frontend logo/copyright notices must not be removed or modified. Review the upstream LICENSE before offering Dify to multiple tenants.',
  sizing: {
    tier: 'official-stack-heavy',
    minimumCpuCores: 4,
    minimumMemoryGb: 8,
    storage:
      '50 GB+ for Postgres, uploads, plugin daemon state, Redis, and the selected vector store; add capacity for local model or file workloads.',
    scaling:
      'Start with the official single-node Docker stack. Split workers, vector stores, and model providers as usage grows.',
    notes: [
      'Model-provider traffic and vector-store choice dominate runtime cost and capacity.',
      'Keep SECRET_KEY and plugin storage stable across restores.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://localhost',
    backupTargets: [
      {
        type: 'command',
        id: 'dify-postgres-databases',
        description:
          'Logical pg_dump exports of the official Dify Postgres service, including the main and plugin databases.',
        backupCommands: [
          'DIFY_PROJECT_DIR="${DIFY_PROJECT_DIR:-self-hosted}"',
          'if [ ! -d "$DIFY_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before backing up Dify." >&2; exit 1; fi',
          'DIFY_ENV_FILE="$DIFY_PROJECT_DIR/.env"',
          'DIFY_DB_USERNAME="$(read_env_file_value "$DIFY_ENV_FILE" DB_USERNAME || true)"',
          'DIFY_DB_PASSWORD="$(read_env_file_value "$DIFY_ENV_FILE" DB_PASSWORD || true)"',
          'DIFY_DB_DATABASE="$(read_env_file_value "$DIFY_ENV_FILE" DB_DATABASE || true)"',
          'DIFY_PLUGIN_DATABASE="$(read_env_file_value "$DIFY_ENV_FILE" DB_PLUGIN_DATABASE || true)"',
          'DIFY_DB_USERNAME="${DIFY_DB_USERNAME:-postgres}"',
          'DIFY_DB_PASSWORD="${DIFY_DB_PASSWORD:-difyai123456}"',
          'DIFY_DB_DATABASE="${DIFY_DB_DATABASE:-dify}"',
          'DIFY_PLUGIN_DATABASE="${DIFY_PLUGIN_DATABASE:-dify_plugin}"',
          '(cd "$DIFY_PROJECT_DIR" && docker compose exec -T db_postgres env PGPASSWORD="$DIFY_DB_PASSWORD" pg_dump --clean --if-exists -U "$DIFY_DB_USERNAME" "$DIFY_DB_DATABASE") > "$BACKUP_DIR_ABS/dify-main-database.sql"',
          '(cd "$DIFY_PROJECT_DIR" && docker compose exec -T db_postgres env PGPASSWORD="$DIFY_DB_PASSWORD" pg_dump --clean --if-exists -U "$DIFY_DB_USERNAME" "$DIFY_PLUGIN_DATABASE") > "$BACKUP_DIR_ABS/dify-plugin-database.sql"',
        ],
        restoreCommands: [
          'DIFY_PROJECT_DIR="${DIFY_PROJECT_DIR:-self-hosted}"',
          'if [ ! -d "$DIFY_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before restoring Dify." >&2; exit 1; fi',
          'if [ ! -f "$BACKUP_DIR_ABS/dify-main-database.sql" ]; then echo "Missing dump: $BACKUP_DIR_ABS/dify-main-database.sql" >&2; exit 1; fi',
          'if [ ! -f "$BACKUP_DIR_ABS/dify-plugin-database.sql" ]; then echo "Missing dump: $BACKUP_DIR_ABS/dify-plugin-database.sql" >&2; exit 1; fi',
          'DIFY_ENV_FILE="$DIFY_PROJECT_DIR/.env"',
          'DIFY_DB_USERNAME="$(read_env_file_value "$DIFY_ENV_FILE" DB_USERNAME || true)"',
          'DIFY_DB_PASSWORD="$(read_env_file_value "$DIFY_ENV_FILE" DB_PASSWORD || true)"',
          'DIFY_DB_DATABASE="$(read_env_file_value "$DIFY_ENV_FILE" DB_DATABASE || true)"',
          'DIFY_PLUGIN_DATABASE="$(read_env_file_value "$DIFY_ENV_FILE" DB_PLUGIN_DATABASE || true)"',
          'DIFY_DB_USERNAME="${DIFY_DB_USERNAME:-postgres}"',
          'DIFY_DB_PASSWORD="${DIFY_DB_PASSWORD:-difyai123456}"',
          'DIFY_DB_DATABASE="${DIFY_DB_DATABASE:-dify}"',
          'DIFY_PLUGIN_DATABASE="${DIFY_PLUGIN_DATABASE:-dify_plugin}"',
          'for service in $(cd "$DIFY_PROJECT_DIR" && docker compose ps --services --filter status=running); do if [ "$service" != "db_postgres" ]; then (cd "$DIFY_PROJECT_DIR" && docker compose stop "$service" >/dev/null); fi; done',
          '(cd "$DIFY_PROJECT_DIR" && docker compose exec -T db_postgres env PGPASSWORD="$DIFY_DB_PASSWORD" psql -U "$DIFY_DB_USERNAME" -d "$DIFY_DB_DATABASE" -v ON_ERROR_STOP=1) < "$BACKUP_DIR_ABS/dify-main-database.sql"',
          '(cd "$DIFY_PROJECT_DIR" && docker compose exec -T db_postgres env PGPASSWORD="$DIFY_DB_PASSWORD" psql -U "$DIFY_DB_USERNAME" -d "$DIFY_PLUGIN_DATABASE" -v ON_ERROR_STOP=1) < "$BACKUP_DIR_ABS/dify-plugin-database.sql"',
          '(cd "$DIFY_PROJECT_DIR" && docker compose up -d)',
        ],
      },
      {
        type: 'command',
        id: 'dify-env-config',
        description:
          'Official Docker .env, optional envs/*.env overrides, nginx SSL/config, and source ref marker.',
        backupCommands: [
          'DIFY_PROJECT_DIR="${DIFY_PROJECT_DIR:-self-hosted}"',
          'if [ ! -d "$DIFY_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before backing up Dify." >&2; exit 1; fi',
          'tar -C "$DIFY_PROJECT_DIR" -czf "$BACKUP_DIR_ABS/dify-config.tar.gz" --exclude=".git" .env envs nginx/ssl nginx/conf.d 2>/dev/null || true',
          'if [ -f "$DIFY_PROJECT_DIR/.dify-source-ref" ]; then cp "$DIFY_PROJECT_DIR/.dify-source-ref" "$BACKUP_DIR_ABS/dify-source-ref.txt"; fi',
          'if [ -f "$BACKUP_DIR_ABS/dify-config.tar.gz" ]; then chmod 600 "$BACKUP_DIR_ABS/dify-config.tar.gz"; fi',
        ],
        restoreCommands: [
          'DIFY_PROJECT_DIR="${DIFY_PROJECT_DIR:-self-hosted}"',
          'mkdir -p "$DIFY_PROJECT_DIR"',
          'if [ -f "$BACKUP_DIR_ABS/dify-config.tar.gz" ]; then tar -C "$DIFY_PROJECT_DIR" -xzf "$BACKUP_DIR_ABS/dify-config.tar.gz"; fi',
          'if [ -f "$BACKUP_DIR_ABS/dify-source-ref.txt" ]; then cp "$BACKUP_DIR_ABS/dify-source-ref.txt" "$DIFY_PROJECT_DIR/.dify-source-ref"; fi',
        ],
      },
      {
        type: 'command',
        id: 'dify-local-state',
        description:
          'Local app uploads/storage, plugin daemon storage, Redis data, and vector-store directories when local backends are used.',
        backupCommands: [
          'DIFY_PROJECT_DIR="${DIFY_PROJECT_DIR:-self-hosted}"',
          'if [ ! -d "$DIFY_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before backing up Dify." >&2; exit 1; fi',
          'state_paths="volumes/app/storage volumes/plugin_daemon volumes/redis/data volumes/weaviate volumes/qdrant volumes/pgvector/data volumes/pgvecto_rs/data volumes/chroma volumes/milvus volumes/opensearch/data volumes/elasticsearch/data volumes/minio/data"',
          'existing_paths=""',
          'for path in $state_paths; do if [ -e "$DIFY_PROJECT_DIR/$path" ]; then existing_paths="$existing_paths $path"; fi; done',
          'if [ -n "$existing_paths" ]; then tar -C "$DIFY_PROJECT_DIR" -czf "$BACKUP_DIR_ABS/dify-local-state.tar.gz" $existing_paths; fi',
        ],
        restoreCommands: [
          'DIFY_PROJECT_DIR="${DIFY_PROJECT_DIR:-self-hosted}"',
          'mkdir -p "$DIFY_PROJECT_DIR"',
          'if [ -f "$BACKUP_DIR_ABS/dify-local-state.tar.gz" ]; then tar -C "$DIFY_PROJECT_DIR" -xzf "$BACKUP_DIR_ABS/dify-local-state.tar.gz"; fi',
        ],
      },
    ],
    upgrade: {
      command: './ops/install-official.sh && (cd self-hosted && docker compose down && docker compose up -d)',
      notes: [
        'Use the official release notes for the target DIFY_SOURCE_REF; Dify upgrade steps can vary between releases.',
        'Back up Postgres, .env, env override files, app storage, plugin storage, Redis, and vector-store directories before upgrading.',
        'After upgrading, compare .env.example and envs/*.env.example with local .env/envs/*.env files for new or changed variables.',
        'Keep SECRET_KEY stable after first launch; changing it can invalidate sessions, file URLs, and encrypted OAuth/plugin credentials.',
        'Pin DIFY_SOURCE_REF to a tested release for production-like installs instead of leaving it on latest.',
      ],
    },
  },
  files: [
    {
      path: '.env.example',
      content: `DIFY_SOURCE_REF=latest
DIFY_PROJECT_DIR=self-hosted
DIFY_UPSTREAM_DIR=.upstream/dify
DIFY_HEALTH_URL=http://localhost
`,
    },
    {
      path: 'README.md',
      content: `# Dify Launchpack

This pack wraps Dify's official \`langgenius/dify/docker\` deployment instead of
copying the generated Compose stack. Dify's Docker files are release-coupled
and generated from upstream templates, so this launchpack keeps them intact and
adds an inspectable operations manifest, install script, health check, and
backup/restore surface around them.

## Start

\`\`\`bash
cp .env.example .env
./ops/install-official.sh
cd self-hosted
# Edit .env before first start: SECRET_KEY, DB/Redis passwords, URLs, storage, model providers, and OAuth.
docker compose config >/dev/null
docker compose up -d
docker compose ps
cd ..
./ops/healthcheck.sh
\`\`\`

Open http://localhost/install for local initialization, or the URL configured
for your server.

## Operations

- Dify requires Docker Compose 2.24.0+ and enough memory for API, workers, plugin daemon, Postgres, Redis, Weaviate, nginx, sandbox, and SSRF proxy services.
- Default Docker startup uses local Postgres, Redis, Weaviate, app storage, and plugin storage under \`self-hosted/volumes\`.
- Generate and set a strong \`SECRET_KEY\` before first launch. Changing it later can invalidate sessions, file URLs, and encrypted OAuth/plugin credentials.
- Back up Postgres, \`self-hosted/.env\`, optional \`envs/*.env\` overrides, app storage, plugin storage, Redis, and vector-store directories before upgrades.
- Review Dify release notes before changing \`DIFY_SOURCE_REF\`; upgrade steps can vary between releases.
- Review the modified Apache-2.0 license before operating Dify for multiple tenants. Written Dify authorization is required for multi-tenant environments.
`,
    },
    {
      path: 'ops/install-official.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

DIFY_SOURCE_REF="\${DIFY_SOURCE_REF:-latest}"
DIFY_PROJECT_DIR="\${DIFY_PROJECT_DIR:-self-hosted}"
DIFY_UPSTREAM_DIR="\${DIFY_UPSTREAM_DIR:-.upstream/dify}"
ROOT_DIR="$(pwd)"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required to install the official Dify Docker setup." >&2
  exit 1
fi

if [ "$DIFY_SOURCE_REF" = "latest" ] && ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to resolve the latest Dify release. Set DIFY_SOURCE_REF to a release tag to avoid this." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose 2.24.0 or later is required before installing Dify self-hosted." >&2
  exit 1
fi

mkdir -p "$(dirname "$DIFY_UPSTREAM_DIR")"

if [ ! -d "$DIFY_UPSTREAM_DIR/.git" ]; then
  git clone --filter=blob:none --sparse https://github.com/langgenius/dify.git "$DIFY_UPSTREAM_DIR"
fi

if [ "$DIFY_SOURCE_REF" = "latest" ]; then
  VERSION_URL="$(curl -Ls -o /dev/null -w '%{url_effective}' https://github.com/langgenius/dify/releases/latest)"
  DIFY_SOURCE_REF="\${VERSION_URL##*/}"
fi

cd "$DIFY_UPSTREAM_DIR"
git fetch --depth 1 origin "$DIFY_SOURCE_REF"
git checkout --detach FETCH_HEAD
git sparse-checkout init --cone >/dev/null 2>&1 || true
git sparse-checkout set docker
cd "$ROOT_DIR"

mkdir -p "$DIFY_PROJECT_DIR"
cp -R "$DIFY_UPSTREAM_DIR/docker/." "$DIFY_PROJECT_DIR/"
printf '%s\\n' "$DIFY_SOURCE_REF" > "$DIFY_PROJECT_DIR/.dify-source-ref"

if [ ! -f "$DIFY_PROJECT_DIR/.env" ]; then
  cp "$DIFY_PROJECT_DIR/.env.example" "$DIFY_PROJECT_DIR/.env"
fi

echo "Official Dify Docker setup $DIFY_SOURCE_REF installed in $DIFY_PROJECT_DIR"
echo "Next: cd $DIFY_PROJECT_DIR && edit .env && docker compose up -d"
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

DIFY_PROJECT_DIR="\${DIFY_PROJECT_DIR:-self-hosted}"
APP_URL="\${APP_URL:-\${DIFY_HEALTH_URL:-http://localhost}}"

if [ ! -d "$DIFY_PROJECT_DIR" ]; then
  echo "Run ./ops/install-official.sh before checking Dify." >&2
  exit 1
fi

status="$(curl -sS -o /dev/null -w '%{http_code}' "$APP_URL" || true)"

case "$status" in
  2*|3*|401|403|404)
    echo "Dify gateway is reachable at $APP_URL with HTTP $status"
    ;;
  *)
    echo "Dify gateway check failed at $APP_URL with HTTP $status" >&2
    (cd "$DIFY_PROJECT_DIR" && docker compose ps)
    exit 1
    ;;
esac

(cd "$DIFY_PROJECT_DIR" && docker compose ps)
`,
    },
  ],
}

const airbyte: Launchpack = {
  id: 'airbyte',
  name: 'Airbyte',
  category: 'Data integration',
  upstream: 'https://docs.airbyte.com/platform/deploying-airbyte',
  defaultPort: 8000,
  supportModel: 'customer-owned-only',
  whyNow:
    'Airbyte is one of the highest-demand open data movement platforms, but self-managed deployment has shifted from legacy Docker Compose to Kubernetes, Helm, and abctl.',
  operationsFit:
    'Airbyte operations need an official abctl/Helm wrapper, chart-version pinning, database/object-storage/secrets guidance, and recovery scripts for the Kubernetes state boundary.',
  licenseNote:
    'Airbyte Core and connectors are primarily Elastic License 2.0, while Airbyte Protocol is MIT. Use this pack for customer-owned/internal deployments; do not sell Airbyte as a managed ELT/ETL service or directly expose Airbyte UI/API to customers without an Airbyte agreement.',
  sizing: {
    tier: 'official-stack-heavy',
    minimumCpuCores: 4,
    minimumMemoryGb: 16,
    storage:
      '100 GB+ for low-scale abctl installs; database records, job logs, connector state, workload output, and internal MinIO/object storage dominate growth.',
    scaling:
      'Use abctl for local or single-machine Docker-managed installs. For production, deploy the official Helm chart into Kubernetes with external Postgres, object storage, and a secrets manager.',
    notes: [
      'Airbyte runs on Kubernetes even when installed with abctl; abctl creates and manages a local kind cluster.',
      'External Postgres and object storage are the cleanest production recovery boundary.',
      'Connector secrets stored in the default database are plaintext; use a supported external secrets manager for production-like deployments.',
      'Upgrades can temporarily turn off Airbyte and may touch connector versions; back up before changing chart versions.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://localhost:8000',
    backupTargets: [
      {
        type: 'command',
        id: 'airbyte-abctl-state',
        description:
          'abctl-managed Kubernetes state: generated config, kubeconfig, internal Postgres logical dump, internal MinIO object data, and Kubernetes secrets/configmaps.',
        backupCommands: [
          'AIRBYTE_PROJECT_DIR="${AIRBYTE_PROJECT_DIR:-self-hosted}"',
          'AIRBYTE_NAMESPACE="${AIRBYTE_NAMESPACE:-airbyte-abctl}"',
          'AIRBYTE_KUBECONFIG="${AIRBYTE_KUBECONFIG:-$HOME/.airbyte/abctl/abctl.kubeconfig}"',
          'AIRBYTE_DB_POD="${AIRBYTE_DB_POD:-airbyte-db-0}"',
          'AIRBYTE_DB_NAME="${AIRBYTE_DB_NAME:-db-airbyte}"',
          'AIRBYTE_DB_USER="${AIRBYTE_DB_USER:-airbyte}"',
          'AIRBYTE_MINIO_POD="${AIRBYTE_MINIO_POD:-airbyte-minio-0}"',
          'AIRBYTE_MINIO_DATA_PATH="${AIRBYTE_MINIO_DATA_PATH:-/data}"',
          'if [ ! -f "$AIRBYTE_KUBECONFIG" ]; then echo "Missing abctl kubeconfig: $AIRBYTE_KUBECONFIG. Run ./ops/install-official.sh first." >&2; exit 1; fi',
          'if [ -f .env ]; then cp .env "$BACKUP_DIR_ABS/airbyte.env"; chmod 600 "$BACKUP_DIR_ABS/airbyte.env"; fi',
          'config_paths=""',
          'for path in "$AIRBYTE_PROJECT_DIR" values.yaml secret.yaml secret.yaml.example; do if [ -e "$path" ]; then config_paths="$config_paths $path"; fi; done',
          'if [ -n "$config_paths" ]; then tar -czf "$BACKUP_DIR_ABS/airbyte-launchpack-config.tar.gz" $config_paths; chmod 600 "$BACKUP_DIR_ABS/airbyte-launchpack-config.tar.gz"; fi',
          'if [ -d "$HOME/.airbyte/abctl" ]; then tar -C "$HOME/.airbyte" -czf "$BACKUP_DIR_ABS/airbyte-abctl-state.tar.gz" abctl; chmod 600 "$BACKUP_DIR_ABS/airbyte-abctl-state.tar.gz"; fi',
          'kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" get secrets -n "$AIRBYTE_NAMESPACE" -o yaml > "$BACKUP_DIR_ABS/airbyte-k8s-secrets.yaml"',
          'kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" get configmaps -n "$AIRBYTE_NAMESPACE" -o yaml > "$BACKUP_DIR_ABS/airbyte-k8s-configmaps.yaml"',
          'chmod 600 "$BACKUP_DIR_ABS/airbyte-k8s-secrets.yaml" "$BACKUP_DIR_ABS/airbyte-k8s-configmaps.yaml"',
          'kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" exec -n "$AIRBYTE_NAMESPACE" "$AIRBYTE_DB_POD" -- sh -c "pg_dump --clean --if-exists -U \\"$AIRBYTE_DB_USER\\" \\"$AIRBYTE_DB_NAME\\" > /tmp/airbyte-launchpack-postgres.sql"',
          'kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" cp -n "$AIRBYTE_NAMESPACE" "$AIRBYTE_DB_POD:/tmp/airbyte-launchpack-postgres.sql" "$BACKUP_DIR_ABS/airbyte-postgres.sql"',
          'kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" exec -n "$AIRBYTE_NAMESPACE" "$AIRBYTE_DB_POD" -- rm -f /tmp/airbyte-launchpack-postgres.sql',
          'if kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" get pod -n "$AIRBYTE_NAMESPACE" "$AIRBYTE_MINIO_POD" >/dev/null 2>&1; then kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" exec -n "$AIRBYTE_NAMESPACE" "$AIRBYTE_MINIO_POD" -- sh -c "tar -C \\"$AIRBYTE_MINIO_DATA_PATH\\" -czf /tmp/airbyte-launchpack-minio.tar.gz ."; kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" cp -n "$AIRBYTE_NAMESPACE" "$AIRBYTE_MINIO_POD:/tmp/airbyte-launchpack-minio.tar.gz" "$BACKUP_DIR_ABS/airbyte-minio.tar.gz"; kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" exec -n "$AIRBYTE_NAMESPACE" "$AIRBYTE_MINIO_POD" -- rm -f /tmp/airbyte-launchpack-minio.tar.gz; else echo "No internal MinIO pod found; verify external object storage backup separately." > "$BACKUP_DIR_ABS/airbyte-external-storage-note.txt"; fi',
          'if command -v abctl >/dev/null 2>&1; then abctl images manifest > "$BACKUP_DIR_ABS/airbyte-images-manifest.txt" || true; fi',
        ],
        restoreCommands: [
          'AIRBYTE_PROJECT_DIR="${AIRBYTE_PROJECT_DIR:-self-hosted}"',
          'AIRBYTE_NAMESPACE="${AIRBYTE_NAMESPACE:-airbyte-abctl}"',
          'AIRBYTE_KUBECONFIG="${AIRBYTE_KUBECONFIG:-$HOME/.airbyte/abctl/abctl.kubeconfig}"',
          'AIRBYTE_DB_POD="${AIRBYTE_DB_POD:-airbyte-db-0}"',
          'AIRBYTE_DB_NAME="${AIRBYTE_DB_NAME:-db-airbyte}"',
          'AIRBYTE_DB_USER="${AIRBYTE_DB_USER:-airbyte}"',
          'AIRBYTE_MINIO_POD="${AIRBYTE_MINIO_POD:-airbyte-minio-0}"',
          'AIRBYTE_MINIO_DATA_PATH="${AIRBYTE_MINIO_DATA_PATH:-/data}"',
          'if [ ! -f "$BACKUP_DIR_ABS/airbyte-postgres.sql" ]; then echo "Missing dump: $BACKUP_DIR_ABS/airbyte-postgres.sql" >&2; exit 1; fi',
          'if [ -f "$BACKUP_DIR_ABS/airbyte-launchpack-config.tar.gz" ]; then tar -xzf "$BACKUP_DIR_ABS/airbyte-launchpack-config.tar.gz"; fi',
          'if [ -f "$BACKUP_DIR_ABS/airbyte.env" ]; then cp "$BACKUP_DIR_ABS/airbyte.env" .env; chmod 600 .env; fi',
          'if [ "${AIRBYTE_RESTORE_ABCTL_STATE:-}" = "yes" ] && [ -f "$BACKUP_DIR_ABS/airbyte-abctl-state.tar.gz" ]; then mkdir -p "$HOME/.airbyte"; tar -C "$HOME/.airbyte" -xzf "$BACKUP_DIR_ABS/airbyte-abctl-state.tar.gz"; fi',
          'if [ ! -f "$AIRBYTE_KUBECONFIG" ]; then echo "Missing abctl kubeconfig: $AIRBYTE_KUBECONFIG. Reinstall Airbyte with ./ops/install-official.sh before restoring." >&2; exit 1; fi',
          'kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" scale deployment -n "$AIRBYTE_NAMESPACE" --all --replicas=0 || true',
          'kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" cp -n "$AIRBYTE_NAMESPACE" "$BACKUP_DIR_ABS/airbyte-postgres.sql" "$AIRBYTE_DB_POD:/tmp/airbyte-launchpack-postgres.sql"',
          'kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" exec -n "$AIRBYTE_NAMESPACE" "$AIRBYTE_DB_POD" -- sh -c "psql -U \\"$AIRBYTE_DB_USER\\" -d \\"$AIRBYTE_DB_NAME\\" -v ON_ERROR_STOP=1 -c \\"DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;\\""',
          'kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" exec -n "$AIRBYTE_NAMESPACE" "$AIRBYTE_DB_POD" -- sh -c "psql -U \\"$AIRBYTE_DB_USER\\" -d \\"$AIRBYTE_DB_NAME\\" -v ON_ERROR_STOP=1 < /tmp/airbyte-launchpack-postgres.sql"',
          'kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" exec -n "$AIRBYTE_NAMESPACE" "$AIRBYTE_DB_POD" -- rm -f /tmp/airbyte-launchpack-postgres.sql',
          'if [ -f "$BACKUP_DIR_ABS/airbyte-minio.tar.gz" ] && kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" get pod -n "$AIRBYTE_NAMESPACE" "$AIRBYTE_MINIO_POD" >/dev/null 2>&1; then kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" cp -n "$AIRBYTE_NAMESPACE" "$BACKUP_DIR_ABS/airbyte-minio.tar.gz" "$AIRBYTE_MINIO_POD:/tmp/airbyte-launchpack-minio.tar.gz"; kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" exec -n "$AIRBYTE_NAMESPACE" "$AIRBYTE_MINIO_POD" -- sh -c "find \\"$AIRBYTE_MINIO_DATA_PATH\\" -mindepth 1 -maxdepth 1 -exec rm -rf {} +; tar -C \\"$AIRBYTE_MINIO_DATA_PATH\\" -xzf /tmp/airbyte-launchpack-minio.tar.gz; rm -f /tmp/airbyte-launchpack-minio.tar.gz"; fi',
          'kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" scale deployment -n "$AIRBYTE_NAMESPACE" --all --replicas=1 || true',
          'if command -v abctl >/dev/null 2>&1; then abctl local status || true; fi',
        ],
      },
    ],
    upgrade: {
      command: './ops/install-official.sh',
      notes: [
        'For abctl-managed installs, re-run abctl local install through ./ops/install-official.sh to upgrade Airbyte.',
        'Back up internal Postgres, internal MinIO/object state, Kubernetes secrets/configmaps, and ~/.airbyte/abctl before upgrading.',
        'Pin AIRBYTE_CHART_VERSION to a tested Helm chart version for production-like deployments.',
        'For Helm-managed production deployments, upgrade with helm upgrade using the reviewed values.yaml and the target chart version.',
        'Prefer external Postgres, external object storage, and external secret management before any serious production workload.',
      ],
    },
  },
  files: [
    {
      path: '.env.example',
      content: `AIRBYTE_HOST=localhost
AIRBYTE_PORT=8000
AIRBYTE_HEALTH_URL=http://localhost:8000
AIRBYTE_PUBLIC_URL=http://localhost:8000

AIRBYTE_PROJECT_DIR=self-hosted
AIRBYTE_NAMESPACE=airbyte-abctl
AIRBYTE_KUBECONFIG=
AIRBYTE_CHART_VERSION=latest
AIRBYTE_VALUES_FILE=values.yaml
AIRBYTE_SECRET_FILE=secret.yaml
AIRBYTE_LOW_RESOURCE_MODE=false
AIRBYTE_INSECURE_COOKIES=false
AIRBYTE_INSTALL_ABCTL=false
AIRBYTE_ABCTL_INSTALL_DIR=.tools/bin

AIRBYTE_DB_POD=airbyte-db-0
AIRBYTE_DB_NAME=db-airbyte
AIRBYTE_DB_USER=airbyte
AIRBYTE_MINIO_POD=airbyte-minio-0
AIRBYTE_MINIO_DATA_PATH=/data
`,
    },
    {
      path: 'values.yaml',
      content: `# Airbyte Helm chart V2 values for a local or VM install.
# For production, review the official deployment docs and configure external
# Postgres, object storage, secret management, ingress, and resource sizing.
global:
  edition: community
  airbyteUrl: http://localhost:8000

postgresql:
  enabled: true

ingress:
  enabled: false

# Production examples to adapt:
#
# postgresql:
#   enabled: false
# global:
#   database:
#     type: external
#     secretName: airbyte-config-secrets
#     host: ""
#     port: 5432
#     name: ""
#     userSecretKey: database-user
#     passwordSecretKey: database-password
#   storage:
#     type: S3
#     secretName: airbyte-config-secrets
#     bucket:
#       log: airbyte-bucket
#       state: airbyte-bucket
#       workloadOutput: airbyte-bucket
#       activityPayload: airbyte-bucket
#     s3:
#       region: us-east-1
#       authenticationType: instanceProfile
#   secretsManager:
#     enabled: true
#     type: AWS_SECRET_MANAGER
#     secretName: airbyte-config-secrets
#     awsSecretManager:
#       region: us-east-1
#       authenticationType: instanceProfile
`,
    },
    {
      path: 'secret.yaml.example',
      content: `apiVersion: v1
kind: Secret
metadata:
  name: airbyte-config-secrets
type: Opaque
stringData:
  database-user: ""
  database-password: ""
  s3-access-key-id: ""
  s3-secret-access-key: ""
  aws-secret-manager-access-key-id: ""
  aws-secret-manager-secret-access-key: ""
`,
    },
    {
      path: 'README.md',
      content: `# Airbyte Launchpack

This pack wraps Airbyte's current self-managed path instead of reviving the
legacy Docker Compose deployment. Airbyte runs on Kubernetes. For a single
machine, \`abctl\` creates a local kind cluster and installs Airbyte with Helm.
For production, use the official Helm chart in your Kubernetes cluster with
external Postgres, object storage, and secret management.

## Start with abctl

\`\`\`bash
cp .env.example .env
# Optional: set AIRBYTE_INSTALL_ABCTL=true if abctl is not already installed.
./ops/install-official.sh
./ops/healthcheck.sh
abctl local credentials
\`\`\`

Open http://localhost:8000, or the host and port configured in \`.env\`.

## Production Helm Direction

\`\`\`bash
helm repo add airbyte https://airbytehq.github.io/charts
helm repo update
kubectl create namespace airbyte
helm install airbyte airbyte/airbyte --namespace airbyte --values ./values.yaml
\`\`\`

Use \`secret.yaml.example\` as a starting point only. Create real Kubernetes
secrets with your cloud or cluster secret-management workflow.

## Operations

- This is an unofficial customer-owned deployment pack. It is not Airbyte Cloud, Airbyte Enterprise, Airbyte Agents, or official Airbyte support.
- Airbyte is primarily ELv2. Do not sell Airbyte as a managed ELT/ETL service or expose Airbyte's UI/API directly to customers without an Airbyte agreement.
- \`abctl\` is for machines with Docker but without an existing Kubernetes cluster. If you already have Kubernetes, deploy with Helm directly.
- Airbyte stores config, connections, job metadata, connector state, and auth data in Postgres.
- Default connector secrets can live in the Airbyte database in plaintext. Configure AWS Secrets Manager, Google Secret Manager, Azure Key Vault, or HashiCorp Vault for production-like use.
- Default abctl installs use internal MinIO for job logs, state, and workload output. Production deployments should use S3, GCS, Azure Blob, or compatible object storage.
- Back up Postgres, object storage, Kubernetes secrets/configmaps, generated values/secrets, and \`~/.airbyte/abctl\` before upgrades.
- Restore is destructive. Stop Airbyte traffic before restoring Postgres or internal MinIO state.
- Pin \`AIRBYTE_CHART_VERSION\` to a tested Helm chart version for repeatable upgrades.
`,
    },
    {
      path: 'ops/install-official.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

AIRBYTE_HOST="\${AIRBYTE_HOST:-localhost}"
AIRBYTE_PORT="\${AIRBYTE_PORT:-8000}"
AIRBYTE_PROJECT_DIR="\${AIRBYTE_PROJECT_DIR:-self-hosted}"
AIRBYTE_CHART_VERSION="\${AIRBYTE_CHART_VERSION:-latest}"
AIRBYTE_VALUES_FILE="\${AIRBYTE_VALUES_FILE:-values.yaml}"
AIRBYTE_SECRET_FILE="\${AIRBYTE_SECRET_FILE:-secret.yaml}"
AIRBYTE_LOW_RESOURCE_MODE="\${AIRBYTE_LOW_RESOURCE_MODE:-false}"
AIRBYTE_INSECURE_COOKIES="\${AIRBYTE_INSECURE_COOKIES:-false}"
AIRBYTE_INSTALL_ABCTL="\${AIRBYTE_INSTALL_ABCTL:-false}"
AIRBYTE_ABCTL_INSTALL_DIR="\${AIRBYTE_ABCTL_INSTALL_DIR:-.tools/bin}"
ROOT_DIR="$(pwd)"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required before installing Airbyte with abctl." >&2
  exit 1
fi

if ! command -v abctl >/dev/null 2>&1; then
  if [ "$AIRBYTE_INSTALL_ABCTL" != "true" ]; then
    echo "abctl is required. Install it first, or set AIRBYTE_INSTALL_ABCTL=true to use Airbyte's install script." >&2
    exit 1
  fi

  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required to install abctl with Airbyte's install script." >&2
    exit 1
  fi

  if ! command -v bash >/dev/null 2>&1; then
    echo "bash is required to run Airbyte's abctl install script." >&2
    exit 1
  fi

  mkdir -p "$AIRBYTE_ABCTL_INSTALL_DIR"
  curl -LsfS https://get.airbyte.com | DIR_INSTALL="$ROOT_DIR/$AIRBYTE_ABCTL_INSTALL_DIR" bash -
  PATH="$ROOT_DIR/$AIRBYTE_ABCTL_INSTALL_DIR:$PATH"
fi

if ! command -v abctl >/dev/null 2>&1; then
  echo "abctl was not found after installation. Add it to PATH and re-run." >&2
  exit 1
fi

mkdir -p "$AIRBYTE_PROJECT_DIR"
cp values.yaml "$AIRBYTE_PROJECT_DIR/values.yaml"
if [ -f "$AIRBYTE_SECRET_FILE" ]; then
  cp "$AIRBYTE_SECRET_FILE" "$AIRBYTE_PROJECT_DIR/secret.yaml"
  chmod 600 "$AIRBYTE_PROJECT_DIR/secret.yaml"
fi

set -- local install --no-browser --port "$AIRBYTE_PORT"

if [ -n "$AIRBYTE_HOST" ]; then
  set -- "$@" --host "$AIRBYTE_HOST"
fi

if [ "$AIRBYTE_CHART_VERSION" != "latest" ]; then
  set -- "$@" --chart-version "$AIRBYTE_CHART_VERSION"
fi

if [ -f "$AIRBYTE_VALUES_FILE" ]; then
  set -- "$@" --values "$AIRBYTE_VALUES_FILE"
fi

if [ -f "$AIRBYTE_SECRET_FILE" ]; then
  set -- "$@" --secret "$AIRBYTE_SECRET_FILE"
fi

if [ "$AIRBYTE_LOW_RESOURCE_MODE" = "true" ]; then
  set -- "$@" --low-resource-mode
fi

if [ "$AIRBYTE_INSECURE_COOKIES" = "true" ]; then
  set -- "$@" --insecure-cookies
fi

abctl "$@"
abctl local status > "$AIRBYTE_PROJECT_DIR/abctl-status.txt" || true
if abctl local credentials > "$AIRBYTE_PROJECT_DIR/abctl-credentials.json"; then
  chmod 600 "$AIRBYTE_PROJECT_DIR/abctl-credentials.json"
fi

echo "Airbyte installed or upgraded with abctl."
echo "Open http://$AIRBYTE_HOST:$AIRBYTE_PORT and retrieve credentials with: abctl local credentials"
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

AIRBYTE_NAMESPACE="\${AIRBYTE_NAMESPACE:-airbyte-abctl}"
AIRBYTE_KUBECONFIG="\${AIRBYTE_KUBECONFIG:-$HOME/.airbyte/abctl/abctl.kubeconfig}"
APP_URL="\${APP_URL:-\${AIRBYTE_HEALTH_URL:-http://localhost:8000}}"

if command -v abctl >/dev/null 2>&1; then
  abctl local status
fi

status="$(curl -sS -o /dev/null -w '%{http_code}' "$APP_URL" || true)"

case "$status" in
  2*|3*|401|403)
    echo "Airbyte is reachable at $APP_URL with HTTP $status"
    ;;
  *)
    echo "Airbyte check failed at $APP_URL with HTTP $status" >&2
    if [ -f "$AIRBYTE_KUBECONFIG" ] && command -v kubectl >/dev/null 2>&1; then
      kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" get pods -n "$AIRBYTE_NAMESPACE"
    fi
    exit 1
    ;;
esac

if [ -f "$AIRBYTE_KUBECONFIG" ] && command -v kubectl >/dev/null 2>&1; then
  kubectl --kubeconfig "$AIRBYTE_KUBECONFIG" get pods -n "$AIRBYTE_NAMESPACE"
fi
`,
    },
  ],
}

const langfuse: Launchpack = {
  id: 'langfuse',
  name: 'Langfuse',
  category: 'LLM observability',
  upstream: 'https://github.com/langfuse/langfuse',
  defaultPort: 3000,
  supportModel: 'customer-owned-only',
  whyNow:
    'LLM observability, prompt management, and evaluation are becoming core AI infrastructure, and Langfuse has a large self-hosted footprint with a data-heavy operational surface.',
  operationsFit:
    'Langfuse operations need an official-stack wrapper, secret rotation checklist, health/readiness checks, and backup boundaries across Postgres, ClickHouse, Redis/Valkey, and object storage.',
  licenseNote:
    'Langfuse core OSS features are MIT licensed, while enterprise features in ee paths require a Langfuse Enterprise license key. Preserve upstream notices, avoid implying Langfuse Cloud or official support, and keep this pack focused on customer-owned self-hosted deployments.',
  sizing: {
    tier: 'official-stack-heavy',
    minimumCpuCores: 4,
    minimumMemoryGb: 16,
    storage:
      '100 GB+ for low-scale Docker Compose deployments; trace volume, ClickHouse retention, Postgres metadata, Redis queue state, and object storage dominate growth.',
    scaling:
      'Use the official Docker Compose setup only for local, VM, and low-scale deployments. For high availability or high throughput, follow the upstream Kubernetes, Terraform, or managed-service guidance.',
    notes: [
      'Langfuse Web and Worker are separate application containers and should be monitored separately.',
      'ClickHouse stores observability data such as traces, observations, and scores.',
      'S3/blob storage is part of the recovery boundary because incoming events and multimodal data are persisted there before processing.',
      'ClickHouse and Postgres infrastructure should run in UTC to avoid query and reporting issues.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://localhost:3000/api/public/health',
    backupTargets: [
      {
        type: 'command',
        id: 'langfuse-official-state',
        description:
          'Official Docker Compose state: .env/source ref, Postgres logical dump, ClickHouse data/log volumes, MinIO object storage, and Redis queue/cache data.',
        backupCommands: [
          'LANGFUSE_PROJECT_DIR="${LANGFUSE_PROJECT_DIR:-self-hosted}"',
          'if [ ! -d "$LANGFUSE_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before backing up Langfuse." >&2; exit 1; fi',
          'LANGFUSE_ENV_FILE="$LANGFUSE_PROJECT_DIR/.env"',
          'LANGFUSE_POSTGRES_USER="$(read_env_file_value "$LANGFUSE_ENV_FILE" POSTGRES_USER || true)"',
          'LANGFUSE_POSTGRES_PASSWORD="$(read_env_file_value "$LANGFUSE_ENV_FILE" POSTGRES_PASSWORD || true)"',
          'LANGFUSE_POSTGRES_DB="$(read_env_file_value "$LANGFUSE_ENV_FILE" POSTGRES_DB || true)"',
          'LANGFUSE_POSTGRES_USER="${LANGFUSE_POSTGRES_USER:-postgres}"',
          'LANGFUSE_POSTGRES_PASSWORD="${LANGFUSE_POSTGRES_PASSWORD:-postgres}"',
          'LANGFUSE_POSTGRES_DB="${LANGFUSE_POSTGRES_DB:-postgres}"',
          'if [ -f "$LANGFUSE_ENV_FILE" ]; then cp "$LANGFUSE_ENV_FILE" "$BACKUP_DIR_ABS/langfuse.env"; chmod 600 "$BACKUP_DIR_ABS/langfuse.env"; fi',
          'if [ -f "$LANGFUSE_PROJECT_DIR/.langfuse-source-ref" ]; then cp "$LANGFUSE_PROJECT_DIR/.langfuse-source-ref" "$BACKUP_DIR_ABS/langfuse-source-ref.txt"; fi',
          '(cd "$LANGFUSE_PROJECT_DIR" && docker compose exec -T postgres env PGPASSWORD="$LANGFUSE_POSTGRES_PASSWORD" pg_dump --clean --if-exists -U "$LANGFUSE_POSTGRES_USER" "$LANGFUSE_POSTGRES_DB") > "$BACKUP_DIR_ABS/langfuse-postgres.sql"',
          '(cd "$LANGFUSE_PROJECT_DIR" && docker compose stop langfuse-web langfuse-worker clickhouse redis minio >/dev/null)',
          'container_id="$(cd "$LANGFUSE_PROJECT_DIR" && docker compose ps -a -q clickhouse | head -n 1)"',
          'source_path="$(docker inspect "$container_id" --format "{{range .Mounts}}{{if eq .Destination \\"/var/lib/clickhouse\\"}}{{.Source}}{{end}}{{end}}")"',
          'if [ -z "$source_path" ]; then echo "Could not find /var/lib/clickhouse mount on Langfuse clickhouse service." >&2; exit 1; fi',
          'docker run --rm -v "$source_path:/data:ro" -v "$BACKUP_DIR_ABS:/backup" alpine:3.20 sh -c "tar -C /data -czf /backup/langfuse-clickhouse-data.tar.gz ."',
          'source_path="$(docker inspect "$container_id" --format "{{range .Mounts}}{{if eq .Destination \\"/var/log/clickhouse-server\\"}}{{.Source}}{{end}}{{end}}")"',
          'if [ -z "$source_path" ]; then echo "Could not find /var/log/clickhouse-server mount on Langfuse clickhouse service." >&2; exit 1; fi',
          'docker run --rm -v "$source_path:/data:ro" -v "$BACKUP_DIR_ABS:/backup" alpine:3.20 sh -c "tar -C /data -czf /backup/langfuse-clickhouse-logs.tar.gz ."',
          'container_id="$(cd "$LANGFUSE_PROJECT_DIR" && docker compose ps -a -q minio | head -n 1)"',
          'source_path="$(docker inspect "$container_id" --format "{{range .Mounts}}{{if eq .Destination \\"/data\\"}}{{.Source}}{{end}}{{end}}")"',
          'if [ -z "$source_path" ]; then echo "Could not find /data mount on Langfuse minio service." >&2; exit 1; fi',
          'docker run --rm -v "$source_path:/data:ro" -v "$BACKUP_DIR_ABS:/backup" alpine:3.20 sh -c "tar -C /data -czf /backup/langfuse-minio-data.tar.gz ."',
          'container_id="$(cd "$LANGFUSE_PROJECT_DIR" && docker compose ps -a -q redis | head -n 1)"',
          'source_path="$(docker inspect "$container_id" --format "{{range .Mounts}}{{if eq .Destination \\"/data\\"}}{{.Source}}{{end}}{{end}}")"',
          'if [ -z "$source_path" ]; then echo "Could not find /data mount on Langfuse redis service." >&2; exit 1; fi',
          'docker run --rm -v "$source_path:/data:ro" -v "$BACKUP_DIR_ABS:/backup" alpine:3.20 sh -c "tar -C /data -czf /backup/langfuse-redis-data.tar.gz ."',
          '(cd "$LANGFUSE_PROJECT_DIR" && docker compose up -d)',
        ],
        restoreCommands: [
          'LANGFUSE_PROJECT_DIR="${LANGFUSE_PROJECT_DIR:-self-hosted}"',
          'if [ ! -d "$LANGFUSE_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before restoring Langfuse." >&2; exit 1; fi',
          'for file in langfuse-postgres.sql langfuse-clickhouse-data.tar.gz langfuse-clickhouse-logs.tar.gz langfuse-minio-data.tar.gz langfuse-redis-data.tar.gz; do if [ ! -f "$BACKUP_DIR_ABS/$file" ]; then echo "Missing Langfuse backup artifact: $BACKUP_DIR_ABS/$file" >&2; exit 1; fi; done',
          '(cd "$LANGFUSE_PROJECT_DIR" && docker compose stop langfuse-web langfuse-worker clickhouse redis minio >/dev/null)',
          'if [ -f "$BACKUP_DIR_ABS/langfuse.env" ]; then cp "$BACKUP_DIR_ABS/langfuse.env" "$LANGFUSE_PROJECT_DIR/.env"; chmod 600 "$LANGFUSE_PROJECT_DIR/.env"; fi',
          'if [ -f "$BACKUP_DIR_ABS/langfuse-source-ref.txt" ]; then cp "$BACKUP_DIR_ABS/langfuse-source-ref.txt" "$LANGFUSE_PROJECT_DIR/.langfuse-source-ref"; fi',
          'container_id="$(cd "$LANGFUSE_PROJECT_DIR" && docker compose ps -a -q clickhouse | head -n 1)"',
          'source_path="$(docker inspect "$container_id" --format "{{range .Mounts}}{{if eq .Destination \\"/var/lib/clickhouse\\"}}{{.Source}}{{end}}{{end}}")"',
          'docker run --rm -i -v "$source_path:/data" alpine:3.20 sh -c "set -eu; find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} +; tar -C /data -xzf -" < "$BACKUP_DIR_ABS/langfuse-clickhouse-data.tar.gz"',
          'source_path="$(docker inspect "$container_id" --format "{{range .Mounts}}{{if eq .Destination \\"/var/log/clickhouse-server\\"}}{{.Source}}{{end}}{{end}}")"',
          'docker run --rm -i -v "$source_path:/data" alpine:3.20 sh -c "set -eu; find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} +; tar -C /data -xzf -" < "$BACKUP_DIR_ABS/langfuse-clickhouse-logs.tar.gz"',
          'container_id="$(cd "$LANGFUSE_PROJECT_DIR" && docker compose ps -a -q minio | head -n 1)"',
          'source_path="$(docker inspect "$container_id" --format "{{range .Mounts}}{{if eq .Destination \\"/data\\"}}{{.Source}}{{end}}{{end}}")"',
          'docker run --rm -i -v "$source_path:/data" alpine:3.20 sh -c "set -eu; find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} +; tar -C /data -xzf -" < "$BACKUP_DIR_ABS/langfuse-minio-data.tar.gz"',
          'container_id="$(cd "$LANGFUSE_PROJECT_DIR" && docker compose ps -a -q redis | head -n 1)"',
          'source_path="$(docker inspect "$container_id" --format "{{range .Mounts}}{{if eq .Destination \\"/data\\"}}{{.Source}}{{end}}{{end}}")"',
          'docker run --rm -i -v "$source_path:/data" alpine:3.20 sh -c "set -eu; find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} +; tar -C /data -xzf -" < "$BACKUP_DIR_ABS/langfuse-redis-data.tar.gz"',
          'LANGFUSE_ENV_FILE="$LANGFUSE_PROJECT_DIR/.env"',
          'LANGFUSE_POSTGRES_USER="$(read_env_file_value "$LANGFUSE_ENV_FILE" POSTGRES_USER || true)"',
          'LANGFUSE_POSTGRES_PASSWORD="$(read_env_file_value "$LANGFUSE_ENV_FILE" POSTGRES_PASSWORD || true)"',
          'LANGFUSE_POSTGRES_DB="$(read_env_file_value "$LANGFUSE_ENV_FILE" POSTGRES_DB || true)"',
          'LANGFUSE_POSTGRES_USER="${LANGFUSE_POSTGRES_USER:-postgres}"',
          'LANGFUSE_POSTGRES_PASSWORD="${LANGFUSE_POSTGRES_PASSWORD:-postgres}"',
          'LANGFUSE_POSTGRES_DB="${LANGFUSE_POSTGRES_DB:-postgres}"',
          '(cd "$LANGFUSE_PROJECT_DIR" && docker compose up -d postgres)',
          'attempt=0; while [ "$attempt" -lt 60 ]; do if (cd "$LANGFUSE_PROJECT_DIR" && docker compose exec -T postgres pg_isready -U "$LANGFUSE_POSTGRES_USER" >/dev/null 2>&1); then break; fi; attempt=$((attempt + 1)); sleep 1; done; if [ "$attempt" -ge 60 ]; then echo "Timed out waiting for Langfuse Postgres." >&2; exit 1; fi',
          '(cd "$LANGFUSE_PROJECT_DIR" && docker compose exec -T postgres env PGPASSWORD="$LANGFUSE_POSTGRES_PASSWORD" psql -U "$LANGFUSE_POSTGRES_USER" -d "$LANGFUSE_POSTGRES_DB" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;")',
          '(cd "$LANGFUSE_PROJECT_DIR" && docker compose exec -T postgres env PGPASSWORD="$LANGFUSE_POSTGRES_PASSWORD" psql -U "$LANGFUSE_POSTGRES_USER" -d "$LANGFUSE_POSTGRES_DB" -v ON_ERROR_STOP=1) < "$BACKUP_DIR_ABS/langfuse-postgres.sql"',
          '(cd "$LANGFUSE_PROJECT_DIR" && docker compose up -d)',
        ],
      },
    ],
    upgrade: {
      command: './ops/install-official.sh && (cd self-hosted && docker compose up --pull always -d)',
      notes: [
        'Back up Postgres, ClickHouse, MinIO/blob storage, Redis, and .env before every upgrade.',
        'Pin LANGFUSE_SOURCE_REF to a tested release for production-like deployments.',
        'Review Langfuse release notes and migration notes before changing major versions.',
        'The Docker Compose setup lacks high availability, horizontal scaling, and built-in backup functionality; move to Helm/Terraform or managed infrastructure when load grows.',
        'Keep SALT, ENCRYPTION_KEY, NEXTAUTH_SECRET, database passwords, Redis auth, and object-storage credentials stable across restores.',
      ],
    },
  },
  files: [
    {
      path: '.env.example',
      content: `LANGFUSE_SOURCE_REF=latest
LANGFUSE_PROJECT_DIR=self-hosted
LANGFUSE_UPSTREAM_DIR=.upstream/langfuse
LANGFUSE_HEALTH_URL=http://localhost:3000/api/public/health?failIfDatabaseUnavailable=true

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-long-random-secret
SALT=replace-with-a-long-random-salt
ENCRYPTION_KEY=replace-with-64-hex-characters-from-openssl-rand-hex-32
TELEMETRY_ENABLED=false

POSTGRES_USER=postgres
POSTGRES_PASSWORD=replace-with-a-long-random-postgres-password
POSTGRES_DB=postgres
DATABASE_URL=postgresql://postgres:replace-with-a-long-random-postgres-password@postgres:5432/postgres

CLICKHOUSE_USER=clickhouse
CLICKHOUSE_PASSWORD=replace-with-a-long-random-clickhouse-password

REDIS_AUTH=replace-with-a-long-random-redis-password

MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=replace-with-a-long-random-minio-password
LANGFUSE_S3_EVENT_UPLOAD_ACCESS_KEY_ID=minio
LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY=replace-with-a-long-random-minio-password
LANGFUSE_S3_MEDIA_UPLOAD_ACCESS_KEY_ID=minio
LANGFUSE_S3_MEDIA_UPLOAD_SECRET_ACCESS_KEY=replace-with-a-long-random-minio-password
LANGFUSE_S3_BATCH_EXPORT_ACCESS_KEY_ID=minio
LANGFUSE_S3_BATCH_EXPORT_SECRET_ACCESS_KEY=replace-with-a-long-random-minio-password

LANGFUSE_S3_EVENT_UPLOAD_BUCKET=langfuse
LANGFUSE_S3_MEDIA_UPLOAD_BUCKET=langfuse
LANGFUSE_S3_BATCH_EXPORT_BUCKET=langfuse
LANGFUSE_S3_EVENT_UPLOAD_ENDPOINT=http://minio:9000
LANGFUSE_S3_MEDIA_UPLOAD_ENDPOINT=http://localhost:9090
LANGFUSE_S3_BATCH_EXPORT_ENDPOINT=http://minio:9000
LANGFUSE_S3_BATCH_EXPORT_EXTERNAL_ENDPOINT=http://localhost:9090
LANGFUSE_S3_EVENT_UPLOAD_FORCE_PATH_STYLE=true
LANGFUSE_S3_MEDIA_UPLOAD_FORCE_PATH_STYLE=true
LANGFUSE_S3_BATCH_EXPORT_FORCE_PATH_STYLE=true
`,
    },
    {
      path: 'README.md',
      content: `# Langfuse Launchpack

This pack wraps Langfuse's official \`docker-compose.yml\` instead of copying
the Compose stack into this generator. Langfuse's self-hosted surface includes
web and worker containers plus Postgres, ClickHouse, Redis/Valkey, and
S3-compatible object storage, so this launchpack keeps upstream deployment
files intact and adds an operations manifest, install script, health check, and
backup/restore surface around them.

## Start

\`\`\`bash
cp .env.example .env
# Edit all secret placeholders before first start.
./ops/install-official.sh
cd self-hosted
docker compose config >/dev/null
docker compose up -d
cd ..
./ops/healthcheck.sh
\`\`\`

Open http://localhost:3000 for local testing, or the URL configured in
\`NEXTAUTH_URL\`.

## Operations

- This is an unofficial customer-owned deployment pack. It is not Langfuse Cloud and does not imply Langfuse support.
- Langfuse core OSS features are MIT licensed; Enterprise features require a Langfuse Enterprise license key.
- The official Docker Compose setup is for local, VM, and low-scale deployments. It lacks high availability, horizontal scaling, and built-in backup functionality.
- Back up \`self-hosted/.env\`, Postgres, ClickHouse data/logs, MinIO object storage, and Redis queue/cache data before upgrades.
- Keep \`SALT\`, \`ENCRYPTION_KEY\`, \`NEXTAUTH_SECRET\`, Postgres credentials, Redis auth, and object-storage credentials stable across restores.
- Keep Postgres and ClickHouse on UTC.
- Expose only Langfuse Web on port 3000 and MinIO on port 9090 when needed; keep databases and queues bound to private networks.
- For high availability or higher throughput, follow upstream Kubernetes, Terraform, or managed-infrastructure guidance.
`,
    },
    {
      path: 'ops/install-official.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

LANGFUSE_SOURCE_REF="\${LANGFUSE_SOURCE_REF:-latest}"
LANGFUSE_PROJECT_DIR="\${LANGFUSE_PROJECT_DIR:-self-hosted}"
LANGFUSE_UPSTREAM_DIR="\${LANGFUSE_UPSTREAM_DIR:-.upstream/langfuse}"
ROOT_DIR="$(pwd)"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required to install the official Langfuse Docker Compose setup." >&2
  exit 1
fi

if [ "$LANGFUSE_SOURCE_REF" = "latest" ] && ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to resolve the latest Langfuse release. Set LANGFUSE_SOURCE_REF to a release tag to avoid this." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is required before installing Langfuse self-hosted." >&2
  exit 1
fi

mkdir -p "$(dirname "$LANGFUSE_UPSTREAM_DIR")"

if [ ! -d "$LANGFUSE_UPSTREAM_DIR/.git" ]; then
  git clone --filter=blob:none --no-checkout https://github.com/langfuse/langfuse.git "$LANGFUSE_UPSTREAM_DIR"
fi

if [ "$LANGFUSE_SOURCE_REF" = "latest" ]; then
  VERSION_URL="$(curl -Ls -o /dev/null -w '%{url_effective}' https://github.com/langfuse/langfuse/releases/latest)"
  LANGFUSE_SOURCE_REF="\${VERSION_URL##*/}"
fi

cd "$LANGFUSE_UPSTREAM_DIR"
git sparse-checkout init --no-cone >/dev/null 2>&1 || true
git sparse-checkout set docker-compose.yml
git fetch --depth 1 origin "$LANGFUSE_SOURCE_REF"
git checkout --detach FETCH_HEAD
cd "$ROOT_DIR"

mkdir -p "$LANGFUSE_PROJECT_DIR"
cp "$LANGFUSE_UPSTREAM_DIR/docker-compose.yml" "$LANGFUSE_PROJECT_DIR/docker-compose.yml"
printf '%s\\n' "$LANGFUSE_SOURCE_REF" > "$LANGFUSE_PROJECT_DIR/.langfuse-source-ref"

if [ ! -f "$LANGFUSE_PROJECT_DIR/.env" ]; then
  cp .env.example "$LANGFUSE_PROJECT_DIR/.env"
fi

echo "Official Langfuse Docker Compose setup $LANGFUSE_SOURCE_REF installed in $LANGFUSE_PROJECT_DIR"
echo "Next: cd $LANGFUSE_PROJECT_DIR && edit .env && docker compose up -d"
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

LANGFUSE_PROJECT_DIR="\${LANGFUSE_PROJECT_DIR:-self-hosted}"
APP_URL="\${APP_URL:-\${LANGFUSE_HEALTH_URL:-http://localhost:3000/api/public/health}}"

if [ ! -d "$LANGFUSE_PROJECT_DIR" ]; then
  echo "Run ./ops/install-official.sh before checking Langfuse." >&2
  exit 1
fi

status="$(curl -sS -o /dev/null -w '%{http_code}' "$APP_URL" || true)"

case "$status" in
  2*)
    echo "Langfuse health endpoint is reachable at $APP_URL with HTTP $status"
    ;;
  *)
    echo "Langfuse health check failed at $APP_URL with HTTP $status" >&2
    (cd "$LANGFUSE_PROJECT_DIR" && docker compose ps)
    exit 1
    ;;
esac

(cd "$LANGFUSE_PROJECT_DIR" && docker compose ps)
`,
    },
  ],
}

const temporal: Launchpack = {
  id: 'temporal',
  name: 'Temporal',
  category: 'Workflow orchestration',
  upstream: 'https://github.com/temporalio/samples-server/tree/main/compose',
  defaultPort: 8080,
  supportModel: 'permissive-hosting-fit',
  whyNow:
    'Durable execution is moving from advanced backend pattern to mainstream infrastructure for AI agents, payments, data workflows, and long-running business processes.',
  operationsFit:
    'Temporal operations need a current official Compose wrapper, clear public-network warnings, version pinning, namespace/bootstrap notes, and backup boundaries for persistence and visibility databases.',
  licenseNote:
    'Temporal Server and the official samples-server Compose files are MIT licensed. Preserve upstream notices and Temporal trademarks, and do not imply Temporal Cloud or official Temporal support.',
  sizing: {
    tier: 'official-stack-heavy',
    minimumCpuCores: 4,
    minimumMemoryGb: 8,
    storage:
      '50 GB+ for Temporal persistence and visibility history; increase based on workflow event history volume, retention, namespace count, and worker traffic.',
    scaling:
      'Use the official PostgreSQL Compose sample for local, VM, and low-scale customer-owned deployments. For production HA, split Temporal roles and move to managed PostgreSQL plus Helm/Kubernetes or another supported deployment pattern.',
    notes: [
      'Temporal Frontend on port 7233 should be treated like database infrastructure and kept off the public internet.',
      'The PostgreSQL-only sample keeps persistence and visibility in two logical databases: temporal and temporal_visibility.',
      'For higher visibility query volume, evaluate the upstream Elasticsearch or OpenSearch examples.',
      'Workers are not included in this pack; application teams run workers separately and point them at the Temporal Frontend.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://localhost:8080',
    backupTargets: [
      {
        type: 'command',
        id: 'temporal-postgres-state',
        description:
          'Official PostgreSQL Compose state: source ref, Compose/config files, and logical dumps of the temporal and temporal_visibility databases.',
        backupCommands: [
          'TEMPORAL_PROJECT_DIR="${TEMPORAL_PROJECT_DIR:-self-hosted}"',
          'TEMPORAL_COMPOSE_FILE="${TEMPORAL_COMPOSE_FILE:-docker-compose-postgres.yml}"',
          'if [ ! -d "$TEMPORAL_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before backing up Temporal." >&2; exit 1; fi',
          'TEMPORAL_ENV_FILE="$TEMPORAL_PROJECT_DIR/.env"',
          'TEMPORAL_POSTGRES_USER="$(read_env_file_value "$TEMPORAL_ENV_FILE" POSTGRES_USER || true)"',
          'TEMPORAL_POSTGRES_PASSWORD="$(read_env_file_value "$TEMPORAL_ENV_FILE" POSTGRES_PASSWORD || true)"',
          'TEMPORAL_POSTGRES_USER="${TEMPORAL_POSTGRES_USER:-temporal}"',
          'TEMPORAL_POSTGRES_PASSWORD="${TEMPORAL_POSTGRES_PASSWORD:-temporal}"',
          'if [ -f "$TEMPORAL_ENV_FILE" ]; then cp "$TEMPORAL_ENV_FILE" "$BACKUP_DIR_ABS/temporal.env"; chmod 600 "$BACKUP_DIR_ABS/temporal.env"; fi',
          'if [ -f "$TEMPORAL_PROJECT_DIR/.temporal-source-ref" ]; then cp "$TEMPORAL_PROJECT_DIR/.temporal-source-ref" "$BACKUP_DIR_ABS/temporal-source-ref.txt"; fi',
          'tar -C "$TEMPORAL_PROJECT_DIR" -czf "$BACKUP_DIR_ABS/temporal-config.tar.gz" .env "$TEMPORAL_COMPOSE_FILE" dynamicconfig scripts 2>/dev/null || true',
          '(cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" stop temporal temporal-ui >/dev/null || true)',
          '(cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" exec -T postgresql env PGPASSWORD="$TEMPORAL_POSTGRES_PASSWORD" pg_dump --clean --if-exists -U "$TEMPORAL_POSTGRES_USER" temporal) > "$BACKUP_DIR_ABS/temporal-database.sql"',
          '(cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" exec -T postgresql env PGPASSWORD="$TEMPORAL_POSTGRES_PASSWORD" pg_dump --clean --if-exists -U "$TEMPORAL_POSTGRES_USER" temporal_visibility) > "$BACKUP_DIR_ABS/temporal-visibility.sql"',
          '(cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" up -d)',
        ],
        restoreCommands: [
          'TEMPORAL_PROJECT_DIR="${TEMPORAL_PROJECT_DIR:-self-hosted}"',
          'TEMPORAL_COMPOSE_FILE="${TEMPORAL_COMPOSE_FILE:-docker-compose-postgres.yml}"',
          'if [ ! -d "$TEMPORAL_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before restoring Temporal." >&2; exit 1; fi',
          'for file in temporal-database.sql temporal-visibility.sql; do if [ ! -f "$BACKUP_DIR_ABS/$file" ]; then echo "Missing Temporal backup artifact: $BACKUP_DIR_ABS/$file" >&2; exit 1; fi; done',
          'if [ -f "$BACKUP_DIR_ABS/temporal-config.tar.gz" ]; then tar -C "$TEMPORAL_PROJECT_DIR" -xzf "$BACKUP_DIR_ABS/temporal-config.tar.gz"; fi',
          'if [ -f "$BACKUP_DIR_ABS/temporal.env" ]; then cp "$BACKUP_DIR_ABS/temporal.env" "$TEMPORAL_PROJECT_DIR/.env"; chmod 600 "$TEMPORAL_PROJECT_DIR/.env"; fi',
          'if [ -f "$BACKUP_DIR_ABS/temporal-source-ref.txt" ]; then cp "$BACKUP_DIR_ABS/temporal-source-ref.txt" "$TEMPORAL_PROJECT_DIR/.temporal-source-ref"; fi',
          'TEMPORAL_ENV_FILE="$TEMPORAL_PROJECT_DIR/.env"',
          'TEMPORAL_POSTGRES_USER="$(read_env_file_value "$TEMPORAL_ENV_FILE" POSTGRES_USER || true)"',
          'TEMPORAL_POSTGRES_PASSWORD="$(read_env_file_value "$TEMPORAL_ENV_FILE" POSTGRES_PASSWORD || true)"',
          'TEMPORAL_POSTGRES_USER="${TEMPORAL_POSTGRES_USER:-temporal}"',
          'TEMPORAL_POSTGRES_PASSWORD="${TEMPORAL_POSTGRES_PASSWORD:-temporal}"',
          '(cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" up -d postgresql)',
          'attempt=0; while [ "$attempt" -lt 60 ]; do if (cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" exec -T postgresql pg_isready -U "$TEMPORAL_POSTGRES_USER" >/dev/null 2>&1); then break; fi; attempt=$((attempt + 1)); sleep 1; done; if [ "$attempt" -ge 60 ]; then echo "Timed out waiting for Temporal Postgres." >&2; exit 1; fi',
          '(cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" stop temporal temporal-ui temporal-create-namespace >/dev/null || true)',
          '(cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" exec -T postgresql env PGPASSWORD="$TEMPORAL_POSTGRES_PASSWORD" psql -U "$TEMPORAL_POSTGRES_USER" -d temporal -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;")',
          '(cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" exec -T postgresql env PGPASSWORD="$TEMPORAL_POSTGRES_PASSWORD" psql -U "$TEMPORAL_POSTGRES_USER" -d temporal -v ON_ERROR_STOP=1) < "$BACKUP_DIR_ABS/temporal-database.sql"',
          '(cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" exec -T postgresql env PGPASSWORD="$TEMPORAL_POSTGRES_PASSWORD" psql -U "$TEMPORAL_POSTGRES_USER" -d temporal_visibility -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;")',
          '(cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" exec -T postgresql env PGPASSWORD="$TEMPORAL_POSTGRES_PASSWORD" psql -U "$TEMPORAL_POSTGRES_USER" -d temporal_visibility -v ON_ERROR_STOP=1) < "$BACKUP_DIR_ABS/temporal-visibility.sql"',
          '(cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" up -d)',
        ],
      },
    ],
    upgrade: {
      command: './ops/install-official.sh && (cd self-hosted && docker compose -f docker-compose-postgres.yml up -d)',
      notes: [
        'Back up both temporal and temporal_visibility databases before upgrading Temporal Server or changing schema tooling.',
        'Pin TEMPORAL_SOURCE_REF to a reviewed commit or release-compatible branch for production-like deployments.',
        'Review upstream Temporal Server release notes and schema migration guidance before changing TEMPORAL_VERSION.',
        'Keep Temporal Frontend, Postgres, and worker network access private; expose only the UI behind your own auth/proxy if needed.',
        'For production HA, move off the single-node Compose sample to the upstream Helm or separately managed service pattern.',
      ],
    },
  },
  files: [
    {
      path: '.env.example',
      content: `TEMPORAL_SOURCE_REF=main
TEMPORAL_PROJECT_DIR=self-hosted
TEMPORAL_UPSTREAM_DIR=.upstream/temporal-samples-server
TEMPORAL_COMPOSE_FILE=docker-compose-postgres.yml
TEMPORAL_HEALTH_URL=http://localhost:8080
TEMPORAL_ADDRESS=localhost:7233
`,
    },
    {
      path: 'README.md',
      content: `# Temporal Launchpack

This pack wraps the official \`temporalio/samples-server/compose\` examples
instead of copying a Compose file into this generator. The pack defaults to
\`docker-compose-postgres.yml\`, which runs Temporal Server, Temporal UI, and
PostgreSQL-backed persistence and visibility databases.

## Start

\`\`\`bash
cp .env.example .env
./ops/install-official.sh
cd self-hosted
docker compose -f docker-compose-postgres.yml config >/dev/null
docker compose -f docker-compose-postgres.yml up -d
cd ..
./ops/healthcheck.sh
\`\`\`

Open http://localhost:8080 for the Temporal UI. SDK workers should connect to
\`localhost:7233\` locally or the private Temporal Frontend address in your
environment.

## Operations

- This is an unofficial customer-owned deployment pack. It is not Temporal Cloud and does not imply Temporal support.
- Temporal Server and samples-server Compose files are MIT licensed.
- Temporal Frontend on port 7233 is a critical persistence/control-plane service. Do not expose it to the public internet.
- The generated backup script stops Temporal and UI containers before dumping PostgreSQL to reduce write activity during backup.
- Backups include \`temporal\`, \`temporal_visibility\`, \`.env\`, dynamic config, scripts, and the selected Compose file.
- The PostgreSQL-only sample is easier to back up than the Elasticsearch/OpenSearch variants. Evaluate upstream search-backed examples for higher visibility query load.
- Workers are application runtime state and are intentionally not bundled here.
- For production HA, follow upstream Helm/Kubernetes or separately managed Temporal service guidance.
`,
    },
    {
      path: 'ops/install-official.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

TEMPORAL_SOURCE_REF="\${TEMPORAL_SOURCE_REF:-main}"
TEMPORAL_PROJECT_DIR="\${TEMPORAL_PROJECT_DIR:-self-hosted}"
TEMPORAL_UPSTREAM_DIR="\${TEMPORAL_UPSTREAM_DIR:-.upstream/temporal-samples-server}"
TEMPORAL_COMPOSE_FILE="\${TEMPORAL_COMPOSE_FILE:-docker-compose-postgres.yml}"
ROOT_DIR="$(pwd)"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required to install the official Temporal samples-server Compose setup." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is required before installing Temporal self-hosted." >&2
  exit 1
fi

mkdir -p "$(dirname "$TEMPORAL_UPSTREAM_DIR")"

if [ ! -d "$TEMPORAL_UPSTREAM_DIR/.git" ]; then
  git clone --filter=blob:none --sparse https://github.com/temporalio/samples-server.git "$TEMPORAL_UPSTREAM_DIR"
fi

cd "$TEMPORAL_UPSTREAM_DIR"
git fetch --depth 1 origin "$TEMPORAL_SOURCE_REF"
git checkout --detach FETCH_HEAD
git sparse-checkout init --cone >/dev/null 2>&1 || true
git sparse-checkout set compose
cd "$ROOT_DIR"

mkdir -p "$TEMPORAL_PROJECT_DIR"
cp -R "$TEMPORAL_UPSTREAM_DIR/compose/." "$TEMPORAL_PROJECT_DIR/"
printf '%s\\n' "$TEMPORAL_SOURCE_REF" > "$TEMPORAL_PROJECT_DIR/.temporal-source-ref"

if [ ! -f "$TEMPORAL_PROJECT_DIR/$TEMPORAL_COMPOSE_FILE" ]; then
  echo "Selected Temporal compose file was not found: $TEMPORAL_PROJECT_DIR/$TEMPORAL_COMPOSE_FILE" >&2
  exit 1
fi

echo "Official Temporal samples-server Compose setup $TEMPORAL_SOURCE_REF installed in $TEMPORAL_PROJECT_DIR"
echo "Selected Compose file: $TEMPORAL_COMPOSE_FILE"
echo "Next: cd $TEMPORAL_PROJECT_DIR && docker compose -f $TEMPORAL_COMPOSE_FILE up -d"
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

TEMPORAL_PROJECT_DIR="\${TEMPORAL_PROJECT_DIR:-self-hosted}"
TEMPORAL_COMPOSE_FILE="\${TEMPORAL_COMPOSE_FILE:-docker-compose-postgres.yml}"
APP_URL="\${APP_URL:-\${TEMPORAL_HEALTH_URL:-http://localhost:8080}}"

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return
  fi

  echo "Docker Compose is required. Install the Docker Compose plugin or docker-compose." >&2
  exit 1
}

if [ ! -d "$TEMPORAL_PROJECT_DIR" ]; then
  echo "Run ./ops/install-official.sh before checking Temporal." >&2
  exit 1
fi

status="$(curl -sS -o /dev/null -w '%{http_code}' "$APP_URL" || true)"

case "$status" in
  2*|3*|401|403)
    echo "Temporal UI is reachable at $APP_URL with HTTP $status"
    ;;
  *)
    echo "Temporal UI check failed at $APP_URL with HTTP $status" >&2
    (cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" ps)
    exit 1
    ;;
esac

(cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" exec -T temporal nc -z localhost 7233)
echo "Temporal Frontend is reachable inside the temporal container on port 7233"
(cd "$TEMPORAL_PROJECT_DIR" && compose -f "$TEMPORAL_COMPOSE_FILE" ps)
`,
    },
  ],
}

const keycloak: Launchpack = {
  id: 'keycloak',
  name: 'Keycloak',
  category: 'Identity and access management',
  upstream: 'https://github.com/keycloak/keycloak',
  defaultPort: 8080,
  supportModel: 'permissive-hosting-fit',
  whyNow:
    'Identity is becoming core app infrastructure again as teams self-host internal tools, AI apps, and customer portals that need OIDC, SAML, realms, clients, and recovery plans.',
  operationsFit:
    'Keycloak operations need a production-mode container, explicit hostname/proxy settings, Postgres-backed state, private health/metrics access, and restore guidance that does not overstate realm JSON exports.',
  licenseNote:
    'Keycloak is Apache-2.0 licensed. Preserve upstream notices and trademarks, and do not imply official Keycloak support or affiliation.',
  sizing: {
    tier: 'single-node',
    minimumCpuCores: 2,
    minimumMemoryGb: 4,
    storage:
      '20 GB+ for Postgres realm, user, client, session, and event data; increase for audit/event retention and high login volume.',
    scaling:
      'Start with one Keycloak node and Postgres. For HA, move Postgres to managed or clustered infrastructure and run multiple Keycloak nodes behind a trusted reverse proxy/load balancer.',
    notes: [
      'Use production `start`, not `start-dev`, for real deployments.',
      'Keycloak requires an explicit hostname by default; set it before exposing users.',
      'Keep the management port private because it exposes health and metrics endpoints.',
      'Realm JSON export/import is supplemental. Postgres plus secrets/config is the primary recovery boundary.',
    ],
  },
  operations: {
    healthcheckUrl: 'http://127.0.0.1:9000/health/ready',
    backupTargets: [
      {
        type: 'command',
        id: 'keycloak-postgres-state',
        description:
          'Postgres-backed Keycloak realm/user/client/session state plus local Compose, image build, realm, theme, provider, and .env configuration.',
        backupCommands: [
          'KEYCLOAK_ENV_FILE="${KEYCLOAK_ENV_FILE:-.env}"',
          'KEYCLOAK_DB="$(read_env_file_value "$KEYCLOAK_ENV_FILE" KEYCLOAK_DB || true)"',
          'KEYCLOAK_DB_USER="$(read_env_file_value "$KEYCLOAK_ENV_FILE" KEYCLOAK_DB_USER || true)"',
          'KEYCLOAK_DB_PASSWORD="$(read_env_file_value "$KEYCLOAK_ENV_FILE" KEYCLOAK_DB_PASSWORD || true)"',
          'KEYCLOAK_DB="${KEYCLOAK_DB:-keycloak}"',
          'KEYCLOAK_DB_USER="${KEYCLOAK_DB_USER:-keycloak}"',
          'if [ -z "$KEYCLOAK_DB_PASSWORD" ]; then echo "Missing KEYCLOAK_DB_PASSWORD in $KEYCLOAK_ENV_FILE." >&2; exit 1; fi',
          'if [ -f "$KEYCLOAK_ENV_FILE" ]; then cp "$KEYCLOAK_ENV_FILE" "$BACKUP_DIR_ABS/keycloak.env"; chmod 600 "$BACKUP_DIR_ABS/keycloak.env"; fi',
          'config_paths=""',
          'for path in compose.yaml Containerfile realms themes providers; do if [ -e "$path" ]; then config_paths="$config_paths $path"; fi; done',
          'if [ -n "$config_paths" ]; then tar -czf "$BACKUP_DIR_ABS/keycloak-config.tar.gz" $config_paths; fi',
          'compose stop keycloak >/dev/null || true',
          'compose exec -T postgres env PGPASSWORD="$KEYCLOAK_DB_PASSWORD" pg_dump --clean --if-exists -U "$KEYCLOAK_DB_USER" "$KEYCLOAK_DB" > "$BACKUP_DIR_ABS/keycloak-postgres.sql"',
          'compose up -d keycloak',
        ],
        restoreCommands: [
          'if [ ! -f "$BACKUP_DIR_ABS/keycloak-postgres.sql" ]; then echo "Missing dump: $BACKUP_DIR_ABS/keycloak-postgres.sql" >&2; exit 1; fi',
          'if [ -f "$BACKUP_DIR_ABS/keycloak-config.tar.gz" ]; then tar -xzf "$BACKUP_DIR_ABS/keycloak-config.tar.gz"; fi',
          'if [ -f "$BACKUP_DIR_ABS/keycloak.env" ]; then cp "$BACKUP_DIR_ABS/keycloak.env" .env; chmod 600 .env; fi',
          'KEYCLOAK_ENV_FILE="${KEYCLOAK_ENV_FILE:-.env}"',
          'KEYCLOAK_DB="$(read_env_file_value "$KEYCLOAK_ENV_FILE" KEYCLOAK_DB || true)"',
          'KEYCLOAK_DB_USER="$(read_env_file_value "$KEYCLOAK_ENV_FILE" KEYCLOAK_DB_USER || true)"',
          'KEYCLOAK_DB_PASSWORD="$(read_env_file_value "$KEYCLOAK_ENV_FILE" KEYCLOAK_DB_PASSWORD || true)"',
          'KEYCLOAK_DB="${KEYCLOAK_DB:-keycloak}"',
          'KEYCLOAK_DB_USER="${KEYCLOAK_DB_USER:-keycloak}"',
          'if [ -z "$KEYCLOAK_DB_PASSWORD" ]; then echo "Missing KEYCLOAK_DB_PASSWORD in $KEYCLOAK_ENV_FILE." >&2; exit 1; fi',
          'compose up -d postgres',
          'attempt=0; while [ "$attempt" -lt 60 ]; do if compose exec -T postgres pg_isready -U "$KEYCLOAK_DB_USER" -d "$KEYCLOAK_DB" >/dev/null 2>&1; then break; fi; attempt=$((attempt + 1)); sleep 1; done; if [ "$attempt" -ge 60 ]; then echo "Timed out waiting for Keycloak Postgres." >&2; exit 1; fi',
          'compose stop keycloak >/dev/null || true',
          'compose exec -T postgres env PGPASSWORD="$KEYCLOAK_DB_PASSWORD" psql -U "$KEYCLOAK_DB_USER" -d "$KEYCLOAK_DB" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;"',
          'compose exec -T postgres env PGPASSWORD="$KEYCLOAK_DB_PASSWORD" psql -U "$KEYCLOAK_DB_USER" -d "$KEYCLOAK_DB" -v ON_ERROR_STOP=1 < "$BACKUP_DIR_ABS/keycloak-postgres.sql"',
          'compose up -d',
        ],
      },
    ],
    upgrade: {
      command: 'docker compose build --pull keycloak && docker compose up -d',
      notes: [
        'Back up Postgres and local config before changing KEYCLOAK_VERSION.',
        'Review Keycloak migration notes before major upgrades; schema changes happen on server start.',
        'Keep KC_HOSTNAME, reverse-proxy headers, TLS termination, and public URLs consistent before login traffic reaches the instance.',
        'Do not proxy the management port publicly; health and metrics should stay on localhost or a private monitoring network.',
        'Change the bootstrap admin password after first login and use normal admin users/groups afterward.',
      ],
    },
  },
  files: [
    {
      path: 'Containerfile',
      content: `ARG KEYCLOAK_VERSION=latest
FROM quay.io/keycloak/keycloak:\${KEYCLOAK_VERSION} AS builder

ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true
ENV KC_DB=postgres

WORKDIR /opt/keycloak
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:\${KEYCLOAK_VERSION}
COPY --from=builder /opt/keycloak/ /opt/keycloak/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
`,
    },
    {
      path: 'compose.yaml',
      content: `services:
  postgres:
    image: "postgres:\${POSTGRES_VERSION:-16-alpine}"
    restart: unless-stopped
    environment:
      POSTGRES_DB: "\${KEYCLOAK_DB:-keycloak}"
      POSTGRES_USER: "\${KEYCLOAK_DB_USER:-keycloak}"
      POSTGRES_PASSWORD: "\${KEYCLOAK_DB_PASSWORD:?Set KEYCLOAK_DB_PASSWORD in .env}"
    volumes:
      - keycloak-postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 12

  keycloak:
    build:
      context: .
      dockerfile: Containerfile
      args:
        KEYCLOAK_VERSION: "\${KEYCLOAK_VERSION:-latest}"
    image: "oss-launchpack-keycloak:\${KEYCLOAK_VERSION:-latest}"
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    command: ["start", "--optimized"]
    environment:
      KC_DB: postgres
      KC_DB_URL: "jdbc:postgresql://postgres:5432/\${KEYCLOAK_DB:-keycloak}"
      KC_DB_USERNAME: "\${KEYCLOAK_DB_USER:-keycloak}"
      KC_DB_PASSWORD: "\${KEYCLOAK_DB_PASSWORD:?Set KEYCLOAK_DB_PASSWORD in .env}"
      KC_HOSTNAME: "\${KEYCLOAK_HOSTNAME:?Set KEYCLOAK_HOSTNAME in .env}"
      KC_HTTP_ENABLED: "\${KEYCLOAK_HTTP_ENABLED:-true}"
      KC_PROXY_HEADERS: "\${KEYCLOAK_PROXY_HEADERS:-xforwarded}"
      KC_BOOTSTRAP_ADMIN_USERNAME: "\${KEYCLOAK_ADMIN:-admin}"
      KC_BOOTSTRAP_ADMIN_PASSWORD: "\${KEYCLOAK_ADMIN_PASSWORD:?Set KEYCLOAK_ADMIN_PASSWORD in .env}"
    ports:
      - "\${KEYCLOAK_HTTP_PORT:-8080}:8080"
      - "127.0.0.1:\${KEYCLOAK_MANAGEMENT_PORT:-9000}:9000"

volumes:
  keycloak-postgres:
`,
    },
    {
      path: '.env.example',
      content: `KEYCLOAK_VERSION=latest
POSTGRES_VERSION=16-alpine

KEYCLOAK_HTTP_PORT=8080
KEYCLOAK_MANAGEMENT_PORT=9000
KEYCLOAK_HOSTNAME=http://localhost:8080
KEYCLOAK_HTTP_ENABLED=true
KEYCLOAK_PROXY_HEADERS=xforwarded

KEYCLOAK_DB=keycloak
KEYCLOAK_DB_USER=keycloak
KEYCLOAK_DB_PASSWORD=replace-with-a-long-random-db-password

KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=replace-with-a-long-random-admin-password
`,
    },
    {
      path: 'README.md',
      content: `# Keycloak Launchpack

This pack runs Keycloak in production mode with a prebuilt optimized image,
Postgres persistence, explicit hostname/proxy settings, bootstrap admin
credentials, and a private management-port health check.

## Start

\`\`\`bash
cp .env.example .env
# Edit KEYCLOAK_HOSTNAME, KEYCLOAK_DB_PASSWORD, and KEYCLOAK_ADMIN_PASSWORD.
docker compose build
docker compose up -d
./ops/healthcheck.sh
\`\`\`

Open http://localhost:8080 for local testing, or the public hostname configured
in \`.env\`.

## Operations

- This is an unofficial Keycloak operations pack. It is not official Keycloak support and does not imply upstream affiliation.
- Keycloak is Apache-2.0 licensed; preserve upstream notices and trademarks.
- Do not use \`start-dev\` for production-like deployments. This pack uses \`start --optimized\`.
- Set \`KEYCLOAK_HOSTNAME\` to the externally visible URL before real users log in.
- If TLS terminates at a reverse proxy, keep \`KEYCLOAK_HTTP_ENABLED=true\` internally and set \`KEYCLOAK_PROXY_HEADERS\` for the forwarded header style your proxy sends.
- Do not expose management port 9000 publicly. The generated Compose file binds it to \`127.0.0.1\` for local health and metrics access.
- Backups use \`pg_dump\` against the Keycloak Postgres database and include local config such as \`.env\`, \`compose.yaml\`, \`Containerfile\`, and optional \`realms\`, \`themes\`, or \`providers\` directories.
- Realm JSON import/export is useful for promotion and migration workflows, but it is not a complete backup. It can miss events, sessions, revoked tokens, and other runtime state.
- Rotate or replace the bootstrap admin password after first login.
- For HA, run multiple Keycloak nodes behind a trusted reverse proxy/load balancer and move Postgres to managed or clustered infrastructure.
`,
    },
    {
      path: 'ops/healthcheck.sh',
      executable: true,
      content: `#!/usr/bin/env sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

KEYCLOAK_MANAGEMENT_PORT="\${KEYCLOAK_MANAGEMENT_PORT:-9000}"
KEYCLOAK_HTTP_PORT="\${KEYCLOAK_HTTP_PORT:-8080}"
MANAGEMENT_URL="\${MANAGEMENT_URL:-http://127.0.0.1:$KEYCLOAK_MANAGEMENT_PORT/health/ready}"
APP_URL="\${APP_URL:-http://localhost:$KEYCLOAK_HTTP_PORT}"

curl -fsS "$MANAGEMENT_URL" >/dev/null

status="$(curl -sS -o /dev/null -w '%{http_code}' "$APP_URL" || true)"

case "$status" in
  2*|3*|401|403)
    echo "Keycloak is reachable at $APP_URL with HTTP $status"
    ;;
  *)
    echo "Keycloak application check failed at $APP_URL with HTTP $status" >&2
    docker compose ps
    exit 1
    ;;
esac

echo "Keycloak readiness endpoint is healthy at $MANAGEMENT_URL"
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
  operationsFit:
    'Homepage operations need service discovery, curated dashboards, Docker integration, secret handling, and upgrade checks.',
  licenseNote:
    'Homepage is GPL-3.0-licensed upstream. Preserve notices and review GPL obligations before distributing modified versions or bundled distributions.',
  sizing: {
    tier: 'tiny-vps',
    minimumCpuCores: 1,
    minimumMemoryGb: 1,
    storage: '1 GB+ for YAML configuration and small static assets.',
    scaling:
      'Run as a tiny single-node dashboard. Keep Docker socket access disabled unless the host-risk tradeoff is understood.',
    notes: ['External service widgets can make network reachability more important than CPU or memory.'],
  },
  operations: {
    healthcheckUrl: 'http://localhost:3000',
    backupTargets: [
      {
        type: 'mount',
        id: 'homepage-config',
        service: 'homepage',
        path: '/app/config',
        description: 'Homepage YAML configuration files.',
      },
    ],
    upgrade: {
      command: 'docker compose pull && docker compose up -d',
      notes: [
        'Back up ./config before changing dashboard structure.',
        'Review release notes before enabling Docker socket integrations.',
      ],
    },
  },
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
  sentry,
  posthog,
  grafana,
  clickhouse,
  qdrant,
  meilisearch,
  typesense,
  outline,
  supabase,
  dify,
  airbyte,
  langfuse,
  temporal,
  keycloak,
  homepage,
] as const satisfies readonly Launchpack[]

export function listLaunchpacks(): readonly Launchpack[] {
  return launchpacks
}

export function getLaunchpack(id: string): Launchpack | undefined {
  return launchpacks.find((pack) => pack.id === id)
}
