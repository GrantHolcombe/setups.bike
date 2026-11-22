-- 009_marketing_emails.sql
-- Marketing email preference (news and offers, sent through Resend):
--   app_user.marketing_emails            true = on the list, false = not, NULL = never asked
--   app_user.marketing_emails_changed_at when it last changed
--   app_user.marketing_emails_source     how: existing_user (this migration), prompt (the one-time
--                                        question new users get), settings (bike menu > Email
--                                        preferences), resend (unsubscribed or resubscribed in an
--                                        email), bounce / complaint (Resend reported the address)
--
-- Decided 2026-11-21: existing users start ON (they're all people Grant knows, and every email
-- has an unsubscribe link); new users start NULL and get a one-time prompt in the app.
-- The e2e test account (user 6) starts OFF so tests never reach the real list.
--
--   1. Dry run (rolls back):  psql ... -f db/migrations/009_marketing_emails.sql
--   2. Apply:                 psql ... -v apply=1 -f db/migrations/009_marketing_emails.sql

\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS marketing_emails boolean;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS marketing_emails_changed_at timestamp with time zone;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS marketing_emails_source text;
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_marketing_emails_source_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_marketing_emails_source_check CHECK (
  marketing_emails_source IS NULL OR
  marketing_emails_source IN ('existing_user', 'prompt', 'settings', 'resend', 'bounce', 'complaint')
);

-- everyone who already has an account: on (only those never set, so a re-run changes nothing)
UPDATE app_user
   SET marketing_emails = (app_user_id <> 6),
       marketing_emails_source = CASE WHEN app_user_id = 6 THEN 'settings' ELSE 'existing_user' END,
       marketing_emails_changed_at = now()
 WHERE marketing_emails IS NULL;

SELECT marketing_emails, marketing_emails_source, count(*)
  FROM app_user GROUP BY 1, 2 ORDER BY 1 DESC, 2;

\if :{?apply}
  COMMIT;
  \echo 'APPLIED: marketing_emails added; existing users on (test user 6 off).'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: rolled back. Re-run with -v apply=1 to apply.'
\endif
