# Setups.Bike: notes for Claude sessions

- **`docs/marketing/` is owned by the marketing session; leave it out of dev commits.** Two
  Claude sessions share this checkout. Stage explicit paths (never `git add -A docs` or
  `git add .`), and let the marketing session commit its own files.
- Every push to `main` that touches app files starts a site deploy (GitHub Actions,
  `.github/workflows/deploy.yml`, about 1.5 minutes). Ask Grant before pushing; he batches deploys.
  Pushes that only touch the workflow's `paths-ignore` list (`docs/**`, `*.md`, `db/**`,
  `lambdas/**`, `infra/**`, `e2e/**`, `cloudflare/**`) don't deploy. Pull requests run tests and a
  build (`checks.yml`). The Lambdas still deploy by hand (`lambdas/README.md`).
- UI follows `docs/STYLE_GUIDE.md`. After a schema change, re-dump `db/schema.sql` and run
  `npm run db:diagram` (see `docs/DATABASE.md`).
- Before a deploy: `npm test`, and `npm run e2e` for anything touching the API or database
  (see `e2e/README.md`).
- Record Grant's engineering decisions in `docs/HUMAN_IN_THE_LOOP.md`.
