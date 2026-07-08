## What Changed

- 

## Pack Checklist

- [ ] I reviewed the upstream license, trademark notes, and hosted-use terms.
- [ ] I chose the conservative `supportModel` for the upstream project.
- [ ] I documented sizing, durable state, health check, backup targets, and upgrade notes.
- [ ] I added or updated focused tests in `test/generator.test.ts`.
- [ ] I updated the README catalog when adding or removing a pack.

## Validation

- [ ] `pnpm check`
- [ ] `pnpm generate -- --app <pack-id> --output .tmp/sample-<pack-id>`
- [ ] Direct Compose packs: `docker compose -f .tmp/sample-<pack-id>/compose.yaml config`
- [ ] Backup/restore changes: ran or added a marker-based validator under `scripts/`

## Public Boundary

- [ ] Public docs stay operator/contributor-facing.
- [ ] This PR does not include private revenue, acquisition, or customer-pipeline strategy.
