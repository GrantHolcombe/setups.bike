-- One-off, 2026-11-18: before the first live Stripe purchase, put user 1 (Grant) back on Free.
-- The row still pointed at a sandbox subscription (sub_1UdDTQ19IiCO7YFpTBYft7Is, cancelled in the
-- sandbox the same day), which the live keys can't see, so the app would have kept showing Pro.
-- Only changes user 1, and only if it still points at that sandbox subscription.
--
--   1. Dry run (rolls back):  psql ... -f db/maintenance/2026-11-18_reset_user1_sandbox_billing.sql
--   2. Apply:                 psql ... -v apply=1 -f db/maintenance/2026-11-18_reset_user1_sandbox_billing.sql

\set ON_ERROR_STOP on

BEGIN;

SELECT app_user_id, plan, plan_status, plan_interval, stripe_customer_id, stripe_subscription_id
  FROM app_user WHERE app_user_id = 1;

UPDATE app_user
   SET plan = 'free',
       plan_source = NULL,
       plan_status = NULL,
       plan_interval = NULL,
       plan_renews_at = NULL,
       plan_cancel_at_period_end = false,
       plan_updated_at = now(),
       stripe_customer_id = NULL,
       stripe_subscription_id = NULL
 WHERE app_user_id = 1
   AND stripe_subscription_id = 'sub_1UdDTQ19IiCO7YFpTBYft7Is';

SELECT app_user_id, plan, plan_status, plan_interval, stripe_customer_id, stripe_subscription_id
  FROM app_user WHERE app_user_id = 1;

\if :{?apply}
  COMMIT;
  \echo 'APPLIED: user 1 is back on Free with no Stripe ids.'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: rolled back. Re-run with -v apply=1 to apply.'
\endif
