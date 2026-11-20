-- 007_activity_timestamps.sql
-- Dates the weekly numbers need (db/maintenance/weekly_numbers.sql):
--   app_user.created_at      when the account was made (sign-ups per week)
--   app_user.last_active_at  last time the garage loaded (getBikes stamps it, at most hourly)
--   bike.created_at          when the bike was added (bikes added per week)
--
-- Rows that already exist keep NULL ("before tracking") rather than a made-up date: each column
-- is added without a default, then the default is set, so only new rows get now(). Nothing in
-- the app writes these columns except the defaults and getBikes.
--
--   1. Dry run (rolls back):  psql ... -f db/migrations/007_activity_timestamps.sql
--   2. Apply:                 psql ... -v apply=1 -f db/migrations/007_activity_timestamps.sql

\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE app_user ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS last_active_at timestamp with time zone;

ALTER TABLE bike ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE bike ALTER COLUMN created_at SET DEFAULT now();

-- setupsbike_app already has SELECT/INSERT/UPDATE/DELETE on these tables (migration 006);
-- grants are per table, so new columns are covered.

SELECT table_name, column_name, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND ((table_name = 'app_user' AND column_name IN ('created_at', 'last_active_at'))
     OR (table_name = 'bike' AND column_name = 'created_at'))
 ORDER BY table_name, column_name;

SELECT (SELECT count(*) FROM app_user) AS users, (SELECT count(*) FROM bike) AS bikes,
       (SELECT count(*) FROM app_user WHERE created_at IS NOT NULL) AS users_dated;

\if :{?apply}
  COMMIT;
  \echo 'APPLIED: created_at on app_user and bike, last_active_at on app_user.'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: rolled back. Re-run with -v apply=1 to apply.'
\endif
