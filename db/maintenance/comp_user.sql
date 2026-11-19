-- Give a user free Pro ("comp"), or take it back. Needs migration 005.
--
--   Comp user 1:     psql ... -v user=1 -v comp=on  -v apply=1 -f db/maintenance/comp_user.sql
--   Back to Free:    psql ... -v user=1 -v comp=off -v apply=1 -f db/maintenance/comp_user.sql
--   Leave off -v apply=1 for a dry run (shows the change, then rolls back).
--
-- Comping clears the user's Stripe ids (a comped account has no subscription). "off" only
-- touches an account that is currently comped, never a paying one.

\set ON_ERROR_STOP on

\if :{?user}
\else
  \echo 'Pass -v user=<app_user_id>'
  \quit
\endif

BEGIN;

SELECT app_user_id, plan, plan_source, stripe_customer_id IS NOT NULL AS has_stripe
  FROM app_user WHERE app_user_id = :user;

SELECT :'comp' = 'on' AS turning_on \gset
\if :turning_on
  UPDATE app_user
     SET plan = 'pro', plan_source = 'comp', plan_status = 'active', plan_interval = NULL,
         plan_renews_at = NULL, plan_cancel_at_period_end = false, plan_updated_at = now(),
         stripe_customer_id = NULL, stripe_subscription_id = NULL
   WHERE app_user_id = :user;
\else
  UPDATE app_user
     SET plan = 'free', plan_source = NULL, plan_status = NULL, plan_updated_at = now()
   WHERE app_user_id = :user AND plan_source = 'comp';
\endif

SELECT app_user_id, plan, plan_source, stripe_customer_id IS NOT NULL AS has_stripe
  FROM app_user WHERE app_user_id = :user;

\if :{?apply}
  COMMIT;
  \echo 'APPLIED.'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: rolled back. Re-run with -v apply=1 to apply.'
\endif
