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
        'Back up the public schema, .env, db-config/pgsodium key, Storage files, and functions before every upgrade.',
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
- Back up the public schema, \`self-hosted/.env\`, the \`supabase_db-config\` pgsodium key, local Storage files, functions, and snippets before upgrades.
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
        id: 'dify-postgres-logical',
        description:
          'Logical pg_dumpall export of the official Dify Postgres service, including the main and plugin databases.',
        backupCommands: [
          'DIFY_PROJECT_DIR="${DIFY_PROJECT_DIR:-self-hosted}"',
          'if [ ! -d "$DIFY_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before backing up Dify." >&2; exit 1; fi',
          'if [ -f "$DIFY_PROJECT_DIR/.env" ]; then set -a; . "$DIFY_PROJECT_DIR/.env"; set +a; fi',
          '(cd "$DIFY_PROJECT_DIR" && docker compose exec -T db_postgres sh -c "PGPASSWORD=\\"${DB_PASSWORD:-difyai123456}\\" pg_dumpall -U \\"${DB_USERNAME:-postgres}\\"") > "$BACKUP_DIR_ABS/dify-pg_dumpall.sql"',
        ],
        restoreCommands: [
          'DIFY_PROJECT_DIR="${DIFY_PROJECT_DIR:-self-hosted}"',
          'if [ ! -d "$DIFY_PROJECT_DIR" ]; then echo "Run ./ops/install-official.sh before restoring Dify." >&2; exit 1; fi',
          'if [ ! -f "$BACKUP_DIR_ABS/dify-pg_dumpall.sql" ]; then echo "Missing dump: $BACKUP_DIR_ABS/dify-pg_dumpall.sql" >&2; exit 1; fi',
          'if [ -f "$DIFY_PROJECT_DIR/.env" ]; then set -a; . "$DIFY_PROJECT_DIR/.env"; set +a; fi',
          '(cd "$DIFY_PROJECT_DIR" && docker compose exec -T db_postgres sh -c "PGPASSWORD=\\"${DB_PASSWORD:-difyai123456}\\" psql -U \\"${DB_USERNAME:-postgres}\\" -v ON_ERROR_STOP=1") < "$BACKUP_DIR_ABS/dify-pg_dumpall.sql"',
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
  outline,
  supabase,
  dify,
  homepage,
] as const satisfies readonly Launchpack[]

export function listLaunchpacks(): readonly Launchpack[] {
  return launchpacks
}

export function getLaunchpack(id: string): Launchpack | undefined {
  return launchpacks.find((pack) => pack.id === id)
}
