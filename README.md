# OSS Launchpack

An open-source operations layer for popular self-hosted apps.

`oss-launchpack` generates Docker Compose starter packs with environment
examples, app-specific notes, health checks, backup/restore scripts, and an
operations manifest. The project starts with a small catalog and should grow
into a trusted operational layer for apps that people want to run but do not
want to babysit.

For complex upstream-maintained stacks, a launchpack may wrap the official
upstream deployment instead of generating a stale copy of its Compose file.

## Why This

Current GitHub momentum is concentrated around self-hosted AI, automation, and
personal-data apps. Examples include Open WebUI, n8n, Dify, Qdrant, Ollama, Memos,
Immich, Coolify, and Dokploy. The common pain is not discovering the app; it is
running it safely with domains, secrets, backups, upgrades, monitoring, and
incident response.

That gap is where launchpacks help:

- Keep the deployment packs open source.
- Build trust by making the operational details inspectable.
- Make it easier to run, audit, and maintain self-hosted apps.

## Upstream Licenses and Trademarks

OSS Launchpack is an unofficial community project. The MIT license in this
repository covers the launchpack templates and CLI code only. It does not grant
rights to upstream application code, names, logos, trademarks, hosted-service
rights, or enterprise features.

Before using a pack commercially, review the upstream license and terms. Some
apps are permissively licensed; others are source-available or fair-code and may
require a commercial agreement for hosted access, white-labeling, embedding, or
multi-customer use.

## Initial Catalog

| Pack | Category | Tier | Support model | Upstream | Operational wedge |
| --- | --- | --- | --- | --- | --- |
| `open-webui` | AI interface | `single-node` | `review-required` | <https://github.com/open-webui/open-webui> | Private AI chat hosting, model routing, upgrades |
| `n8n` | Automation | `single-node` | `customer-owned-only` | <https://github.com/n8n-io/n8n> | Customer-owned/internal deployments, backups, upgrade support |
| `memos` | Personal knowledge | `tiny-vps` | `permissive-hosting-fit` | <https://github.com/usememos/memos> | Private notes hosting, backups, custom domains |
| `uptime-kuma` | Monitoring | `tiny-vps` | `permissive-hosting-fit` | <https://github.com/louislam/uptime-kuma> | Monitor setup, notification channels, incident routing |
| `sentry` | Observability | `official-stack-heavy` | `customer-owned-only` | <https://github.com/getsentry/self-hosted> | Customer-owned self-hosted setup, backup validation, upgrade support |
| `posthog` | Product analytics | `official-stack-heavy` | `customer-owned-only` | <https://github.com/PostHog/posthog> | Customer-owned hobby deployment, backups, upgrade support |
| `grafana` | Observability | `single-node` | `customer-owned-only` | <https://github.com/grafana/grafana> | Postgres-backed dashboards, provisioning, plugin and upgrade support |
| `clickhouse` | Analytics database | `single-node-heavy` | `permissive-hosting-fit` | <https://github.com/ClickHouse/ClickHouse> | Native database backups, config/users, storage-heavy upgrade support |
| `qdrant` | Vector database | `single-node-heavy` | `permissive-hosting-fit` | <https://github.com/qdrant/qdrant> | Vector storage, snapshots, API-key/TLS hardening, AI search workloads |
| `outline` | Team knowledge | `single-node` | `customer-owned-only` | <https://github.com/outline/outline> | Customer-owned team wiki, SSO/OIDC setup, backups |
| `supabase` | Backend platform | `official-stack-heavy` | `permissive-hosting-fit` | <https://github.com/supabase/supabase/tree/master/docker> | Official Docker stack wrapper, public schema, Storage metadata/files, functions backup boundaries |
| `dify` | AI application platform | `official-stack-heavy` | `upstream-agreement-required` | <https://github.com/langgenius/dify/tree/main/docker> | Official Docker stack wrapper, Postgres/storage/plugin/vector backup boundaries |
| `homepage` | Dashboard | `tiny-vps` | `review-required` | <https://github.com/gethomepage/homepage> | Curated service dashboards, config, upgrade support |

Support model meanings:

- `permissive-hosting-fit`: upstream license appears compatible with hosted support, subject to trademark and notice requirements.
- `customer-owned-only`: use for setup/support in the customer's own environment; hosted resale may require upstream approval.
- `upstream-agreement-required`: do not offer hosted/embedded access without a separate upstream agreement.
- `review-required`: license, trademark, or business-model constraints need case-by-case review.

## Install From Source

```bash
git clone https://github.com/shreyas-shinde/oss-launchpack.git
cd oss-launchpack
corepack enable
pnpm install
pnpm build
```

Run locally:

```bash
node dist/cli.js list
node dist/cli.js show open-webui
node dist/cli.js init open-webui ./deploy/open-webui
```

After building, the compiled CLI is available at `dist/cli.js`.

## Commands

```bash
oss-launchpack list
oss-launchpack show open-webui
oss-launchpack init n8n ./deploy/n8n
oss-launchpack init memos ./deploy/memos --force
```

Generated packs include:

- `compose.yaml` for direct Compose packs, or an upstream wrapper for complex official stacks
- `.env.example`
- app-specific `README.md`
- `OPERATIONS.md`
- `UPSTREAM.md`
- `ops/healthcheck.sh`
- `ops/backup.sh`
- `ops/restore.sh`
- `ops/manifest.json`
- `.launchpack.json`

## Roadmap

1. Add more high-demand launchpacks.
2. Validate backup and restore flows on clean VPS hosts.
3. Document production hardening guides for domains, TLS, updates, and monitoring.
4. Add pack metadata for resource sizing and upgrade notes.
5. Add flagship operations packs for developer infrastructure and AI workflow platforms.

## Development

```bash
pnpm install
pnpm check
```

`pnpm check` builds the TypeScript project and runs the Node test suite.

New launchpacks should follow [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
