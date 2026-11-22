-- 010_validate_bike_owner_fk.sql
-- fk_bike_app_user_id (bike.app_user_id -> app_user) was added NOT VALID, so Postgres checked
-- new bikes but never the bikes that already existed. db/maintenance/check_orphans.sql showed
-- 0 orphans on 2026-11-22, so validate it: from now on every bike is guaranteed an owner.
-- VALIDATE only reads the table; it fails (and changes nothing) if an orphan has appeared since.
--
--   1. Dry run (rolls back):  psql ... -f db/migrations/010_validate_bike_owner_fk.sql
--   2. Apply:                 psql ... -v apply=1 -f db/migrations/010_validate_bike_owner_fk.sql

\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE bike VALIDATE CONSTRAINT fk_bike_app_user_id;

SELECT conname, convalidated FROM pg_constraint WHERE conname = 'fk_bike_app_user_id';

\if :{?apply}
  COMMIT;
  \echo 'APPLIED: fk_bike_app_user_id is validated.'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: rolled back. Re-run with -v apply=1 to apply.'
\endif
