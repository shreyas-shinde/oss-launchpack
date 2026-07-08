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
  managedOpportunity: string
  licenseNote: string
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
  managedOpportunity:
    'Managed Open WebUI can bundle OAuth, model routing, backups, upgrades, and GPU/CPU hosting choices.',
  licenseNote:
    'Unofficial launchpack. Open WebUI uses a custom permissive license with branding protection; keep upstream branding intact and do not imply official endorsement.',
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
  managedOpportunity:
    'n8n support should focus on customer-owned/internal deployments unless a separate upstream commercial agreement allows hosted or embedded access.',
  licenseNote:
    'n8n is fair-code under the Sustainable Use License and Enterprise License. Do not resell hosted n8n access, white-label n8n, or embed it for customers without confirming the required n8n agreement.',
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
  managedOpportunity:
    'Uptime Kuma support can bundle monitor setup, notification channels, incident routing, upgrades, and backup checks.',
  licenseNote:
    'Uptime Kuma is MIT-licensed upstream; preserve upstream copyright and license notices.',
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
  managedOpportunity:
    'Sentry work should focus on customer-owned self-hosted installations, upgrade help, backup validation, and migration planning. Do not offer hosted Sentry resale or a competing Sentry-like service without an upstream agreement.',
  licenseNote:
    'Sentry self-hosted is Fair Source under FSL-1.1-Apache-2.0. Internal/customer-owned deployments and professional services can fit the license, but selling deployed self-hosted Sentry as SaaS or a similar commercial offering is prohibited by upstream terms.',
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
  managedOpportunity:
    'PostHog work should focus on customer-owned hobby deployments, backup validation, upgrade help, and migration planning. Do not market this as a PostHog Cloud replacement or imply upstream support.',
  licenseNote:
    'PostHog open-source self-hosted deployments are MIT licensed and provided without guarantee. The upstream repository also contains an ee/ directory under a separate Enterprise license; preserve upstream notices and do not assume paid features or upstream support are included.',
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
  homepage,
] as const satisfies readonly Launchpack[]

export function listLaunchpacks(): readonly Launchpack[] {
  return launchpacks
}

export function getLaunchpack(id: string): Launchpack | undefined {
  return launchpacks.find((pack) => pack.id === id)
}
