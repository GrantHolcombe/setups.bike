-- 005_comp_plan_source.sql
-- Allows plan_source = 'comp': Pro given for free (the owner's own account, testers, partners).
-- A comped account has no Stripe subscription; the Stripe webhook leaves it alone.
--
--   1. Dry run (rolls back):  psql ... -f db/migrations/005_comp_plan_source.sql
--   2. Apply:                 psql ... -v apply=1 -f db/migrations/005_comp_plan_source.sql

\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE app_user DROP CONSTRAINT app_user_plan_source_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_plan_source_check
  CHECK (plan_source IS NULL OR plan_source IN ('stripe', 'apple', 'google', 'comp'));

SELECT plan, plan_source, count(*) FROM app_user GROUP BY 1, 2 ORDER BY 1, 2;

\if :{?apply}
  COMMIT;
  \echo 'APPLIED: plan_source may now be comp.'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: rolled back. Re-run with -v apply=1 to apply.'
\endif
