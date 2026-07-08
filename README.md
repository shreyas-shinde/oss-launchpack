# OSS Launchpack

Production-minded launchpacks for popular self-hosted open-source apps.

`oss-launchpack` generates Docker Compose starter packs with environment
examples, app-specific notes, and health checks. The project starts with a
small catalog and should grow into a trusted operational layer for OSS apps that
people want to run but do not want to babysit.

## Why This

Current GitHub momentum is concentrated around self-hosted AI, automation, and
personal-data apps. Examples include Open WebUI, n8n, Dify, Ollama, Memos,
Immich, Coolify, and Dokploy. The common pain is not discovering the app; it is
running it safely with domains, secrets, backups, upgrades, monitoring, and
incident response.

That gap is a natural managed-deployment business:

- Keep the deployment packs open source.
- Build trust by making the operational details inspectable.
- Monetize hosted deployments, backups, upgrades, monitoring, and support.

## Managed Deployments

This project is built to become a managed deployment business within 3 months,
not just an OSS utility.

If you want one of these apps deployed and maintained for you, open a
[managed deployment request](https://github.com/shreyas-shinde/oss-launchpack/issues/new?template=managed-deployment.yml).

Initial offer:

| Plan | Price target | For |
| --- | ---: | --- |
| Setup | $299 one-time | One app deployed to your cloud/VPS with handoff notes |
| Managed | $149/month per app | Hosting, updates, backups, uptime checks, and support |
| Team | $499/month+ | Multiple apps, custom domains, SSO/OAuth, priority support |

The first commercial milestone is 10 managed apps at $149/month, or $1,490 MRR.

## Initial Catalog

| Pack | Category | Upstream | Managed wedge |
| --- | --- | --- | --- |
| `open-webui` | AI interface | <https://github.com/open-webui/open-webui> | Private AI chat hosting, model routing, upgrades |
| `n8n` | Automation | <https://github.com/n8n-io/n8n> | Secure workflow hosting, webhook domains, backups |
| `memos` | Personal knowledge | <https://github.com/usememos/memos> | Private notes hosting, backups, custom domains |

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

- `compose.yaml`
- `.env.example`
- app-specific `README.md`
- `ops/healthcheck.sh`
- `.launchpack.json`

## Three-Month Product Bet

1. Week 1: Add 10 high-demand packs and validate them on clean VPS hosts.
2. Week 2: Add automated backup and restore checks per pack.
3. Weeks 3-4: Publish comparison pages and collect managed deployment requests.
4. Month 2: Close the first 3 paid managed deployments manually.
5. Month 3: Reach 10 managed apps or prove a specific vertical with repeatable demand.

Success metric: people open issues asking for new packs or asking you to run the
deployment for them.

## Development

```bash
pnpm install
pnpm check
```

`pnpm check` builds the TypeScript project and runs the Node test suite.

## License

MIT
