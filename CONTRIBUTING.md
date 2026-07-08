# Contributing

Thanks for helping improve OSS Launchpack. This project is for operations-ready
self-hosting packs: each launchpack should make it clearer how to start, check,
back up, restore, and upgrade a popular open-source app.

## Add a Launchpack

1. Open or claim a launchpack request issue.
2. Review the upstream deployment docs, license, trademark policy, and release
   notes.
3. Add a `Launchpack` entry in `src/catalog.ts`.
4. Add or update tests in `test/generator.test.ts`.
5. Run verification:

```bash
pnpm check
pnpm generate -- --app <pack-id> --output .tmp/sample-<pack-id>
```

For direct Compose packs, also validate the generated sample:

```bash
cp .tmp/sample-<pack-id>/.env.example .tmp/sample-<pack-id>/.env
docker compose -f .tmp/sample-<pack-id>/compose.yaml config
```

For official-stack wrappers, run the generated installer, then validate the
official Compose directory without starting the stack:

```bash
cd .tmp/sample-<pack-id>
cp .env.example .env
./ops/install-official.sh
cd self-hosted
docker compose config
```

## Metadata Contract

Every `Launchpack` in `src/catalog.ts` must include:

| Field | What to include |
| --- | --- |
| `id` | Stable lowercase id used by the CLI, tests, and generated metadata. |
| `name` | Human-readable app name. |
| `category` | Short category such as `Monitoring`, `Backend platform`, or `AI interface`. |
| `upstream` | Canonical upstream project or official deployment URL. |
| `defaultPort` | Main local port users should expect for the app or gateway. |
| `supportModel` | One of the support-model values below. |
| `whyNow` | Why the app deserves an operations pack now. |
| `operationsFit` | The specific operations surface this pack helps clarify. |
| `licenseNote` | Contributor-facing note about upstream license and use boundaries. |
| `sizing` | Operator sizing guidance with tier, minimum CPU/RAM, storage notes, scaling constraints, and caveats. |
| `operations.healthcheckUrl` | Default URL used by `ops/healthcheck.sh` or documented as the expected endpoint. |
| `operations.backupTargets` | Durable state that must be backed up before upgrades or migrations. |
| `operations.upgrade` | Upgrade command plus notes about pre-upgrade backups, version pins, and upstream release notes. |
| `files` | Generated files for the pack, including README, env example, Compose or install wrapper, and health check. |

Support model values:

- `permissive-hosting-fit`: upstream license appears compatible with hosted
  support, subject to trademark and notice requirements.
- `customer-owned-only`: use for setup/support in the user's own environment;
  hosted resale may require upstream approval.
- `upstream-agreement-required`: do not offer hosted or embedded access without
  a separate upstream agreement.
- `review-required`: license, trademark, or business-model constraints need
  case-by-case review.

Sizing tier values:

- `tiny-vps`: small single-service app that can start on 1 CPU core and 1 GB RAM.
- `single-node`: normal single-node app that usually needs 2+ CPU cores and 4+ GB RAM.
- `single-node-heavy`: single-node app with meaningful database, queue, or model-serving load.
- `official-stack-heavy`: upstream-maintained multi-service stack where memory, disk, and restore ordering need extra validation.

## Backup Targets

Use `mount` when the state is a mounted filesystem path on a running service:

- app upload directories
- SQLite files
- local object storage directories
- dashboard/config directories
- model caches that users intentionally want to preserve

Use `postgres` when the app's durable state is in a PostgreSQL database exposed
by a Compose service and a logical `pg_dump`/`psql` restore is appropriate.
Set `service`, `databaseEnv`, and `userEnv` to the environment variables used by
that service.

Use `command` when the app has an official backup tool, a complex official stack,
or multiple state paths that are safer to back up with explicit shell commands.
Official-stack wrappers such as Sentry, PostHog, Supabase, and Dify should avoid
copying large generated Compose files into this repo.

Backups should name recovery boundaries plainly. If a secret is required to
decrypt data after restore, document and back it up as configuration.

## License and Trademark Checklist

Before adding or changing a launchpack, check:

- Upstream license file and any separate enterprise, fair-code, or source
  available license.
- Restrictions on hosted access, multi-tenant use, white-labeling, embedding,
  or using the app to provide a competing service.
- Trademark and logo rules.
- Whether generated docs imply official support or endorsement.
- Whether the pack preserves upstream copyright and license notices.
- Whether the `supportModel` and `licenseNote` match the current upstream terms.

Keep private business strategy out of public issues, docs, and generated
launchpack files.

## Pull Request Checklist

- The pack has a focused test in `test/generator.test.ts`.
- `pnpm check` passes.
- `pnpm generate -- --app <pack-id> --output .tmp/sample-<pack-id>` succeeds.
- Direct Compose packs pass `docker compose config` on the generated sample.
- Official-stack wrappers install the upstream deployment files and pass
  `docker compose config` in the installed official directory.
- README catalog and roadmap entries stay current.
- Public docs stay contributor-facing and avoid private project strategy.

## Real Backup/Restore Checks

Shell syntax tests do not prove a backup can restore real state. When changing
backup or restore behavior, run a real smoke test for an affected pack.

The n8n smoke test generates `tmp/n8n`, starts the Compose stack with test-only
secrets, writes a known Postgres row and n8n volume marker, backs them up,
destroys the volumes, stops n8n while Postgres is restored, restores both
targets, restarts n8n, and verifies both markers return:

```bash
scripts/validate-n8n-backup-restore.sh
```

Set `KEEP_N8N_VALIDATION=1` to leave the generated stack in place for manual
inspection. Otherwise the script removes its containers and volumes before it
exits.

The Supabase smoke test generates `tmp/supabase`, installs the official Docker
stack, generates upstream secrets, starts the stack on test-only ports, writes a
known `public` schema row, Storage bucket/object metadata row, and local Storage
marker, backs them up, deletes all markers, restores them, and verifies the
gateway is reachable:

```bash
scripts/validate-supabase-backup-restore.sh
```

Set `KEEP_SUPABASE_VALIDATION=1` to leave the generated stack in place for
manual inspection. Otherwise the script removes its containers and volumes
before it exits.

The Dify smoke test generates `tmp/dify`, installs the official Docker stack,
starts it on test-only ports, writes known rows into the main and plugin
Postgres databases, writes local app-storage and plugin-storage markers, backs
them up, deletes all markers, restores them, and verifies the Dify gateway is
reachable. Dify's official `worker_beat` service does not currently define a
Compose healthcheck, so the validator starts the stack without `--wait` and then
polls the gateway and Postgres directly:

```bash
scripts/validate-dify-backup-restore.sh
```

Set `KEEP_DIFY_VALIDATION=1` to leave the generated stack in place for manual
inspection. Otherwise the script removes its containers and volumes before it
exits.

The PostHog smoke test generates `tmp/posthog`, fetches the current upstream
hobby Compose files, verifies the official service names and durable mount
destinations still match the launchpack metadata, then starts a lightweight
stateful harness with those same services and mount paths. It writes known
markers into Postgres, ClickHouse, SeaweedFS, object storage, Kafka, Redis, and
Caddy volumes, backs them up, deletes all markers, restores them, and verifies
the markers return:

```bash
scripts/validate-posthog-backup-restore.sh
```

Set `POSTHOG_SOURCE_REF` to pin the upstream Compose files. Set
`KEEP_POSTHOG_VALIDATION=1` to leave the generated stack in place for manual
inspection. Otherwise the script removes its containers and volumes before it
exits.
