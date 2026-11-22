-- delete_user.sql: permanently delete one account and everything it owns.
-- Used for account deletion requests and for broken rows (e.g. user 4, created by the
-- pre-2026 AddUser with "undefined" name and email). This can't be undone.
--
--   Dry run (shows what would go, then rolls back):
--     psql ... -v user=4 -f db/maintenance/delete_user.sql
--   Apply:
--     psql ... -v user=4 -v apply=1 -f db/maintenance/delete_user.sql
--
-- Deletes, in order: the user's bikes (their saved setups, ride notes, share links and garage
-- positions go with them through ON DELETE CASCADE), any leftover garage_order rows, the user's
-- share links, then the app_user row. If the account has a Stripe customer it refuses: cancel or
-- check the subscription in Stripe first, then pass -v force_stripe=1.
-- Afterwards, if the address was synced to Resend, remove the contact there too (unsubscribed
-- contacts can't be emailed anyway).

\set ON_ERROR_STOP on
\if :{?user}
\else
  \echo 'Pass -v user=<app_user_id>'
  \quit
\endif

BEGIN;

\echo
\echo '== The account =='
SELECT app_user_id, first_name, last_name, email_address, plan, plan_source,
       stripe_customer_id IS NOT NULL AS has_stripe, marketing_emails, created_at, last_active_at
  FROM app_user WHERE app_user_id = :user;

\echo
\echo '== What it owns (all of this is deleted) =='
SELECT
  (SELECT count(*) FROM bike WHERE app_user_id = :user) AS bikes,
  (SELECT count(*) FROM bike_setup s JOIN bike b USING (bike_id) WHERE b.app_user_id = :user) AS saved_setups,
  (SELECT count(*) FROM ride_note n JOIN bike b USING (bike_id) WHERE b.app_user_id = :user) AS ride_notes,
  (SELECT count(*) FROM shared_setup WHERE app_user_id = :user) AS share_links,
  (SELECT count(*) FROM garage_order WHERE app_user_id = :user) AS garage_rows;

SELECT (stripe_customer_id IS NOT NULL) AS has_stripe FROM app_user WHERE app_user_id = :user \gset
\if :{?has_stripe}
  \if :has_stripe
    \if :{?force_stripe}
    \else
      \echo 'STOPPED: this account has a Stripe customer. Check Stripe first, then re-run with -v force_stripe=1.'
      ROLLBACK;
      \quit
    \endif
  \endif
\else
  \echo 'No such user.'
  ROLLBACK;
  \quit
\endif

DELETE FROM bike WHERE app_user_id = :user;
DELETE FROM garage_order WHERE app_user_id = :user;
DELETE FROM shared_setup WHERE app_user_id = :user;
DELETE FROM app_user WHERE app_user_id = :user;

SELECT count(*) AS remaining_rows_for_user FROM app_user WHERE app_user_id = :user;

\if :{?apply}
  COMMIT;
  \echo 'APPLIED: the account and everything it owned are deleted.'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: nothing deleted. Re-run with -v apply=1 to delete for good.'
\endif
