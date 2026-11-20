-- 008_signup_source.sql
-- First-touch sign-up source: the campaign tags on the link a new user arrived through
-- (?utm_source=sticker&utm_medium=qr&utm_campaign=trailhead, ?ref=SHOPNAME), saved once when
-- AddUser creates the account and never changed afterwards. A sign-up from a shared-setup link
-- with no tags is recorded as source 'share'. The app keeps the tags in memory for that visit
-- only (nothing is stored in the browser; see the privacy policy).
--
-- Existing accounts stay NULL. Values are checked in the app and in AddUser (letters, digits
-- and ._~- only); the constraints here just cap the length.
--
--   1. Dry run (rolls back):  psql ... -f db/migrations/008_signup_source.sql
--   2. Apply:                 psql ... -v apply=1 -f db/migrations/008_signup_source.sql

\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS signup_source text,
  ADD COLUMN IF NOT EXISTS signup_medium text,
  ADD COLUMN IF NOT EXISTS signup_campaign text,
  ADD COLUMN IF NOT EXISTS signup_ref text;

ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_signup_source_len;
ALTER TABLE app_user ADD CONSTRAINT app_user_signup_source_len CHECK (
  char_length(signup_source) <= 64 AND char_length(signup_medium) <= 64 AND
  char_length(signup_campaign) <= 64 AND char_length(signup_ref) <= 64
);

SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'app_user' AND column_name LIKE 'signup_%'
 ORDER BY column_name;

\if :{?apply}
  COMMIT;
  \echo 'APPLIED: app_user.signup_source / _medium / _campaign / _ref.'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: rolled back. Re-run with -v apply=1 to apply.'
\endif
