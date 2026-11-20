-- 006_app_role.sql
-- A least-privilege login role for the Lambdas: `setupsbike_app` can read and write rows in the
-- app's tables (and use their id sequences), and nothing else. It can't create, alter or drop
-- tables, create roles, or change grants. Migrations keep running as neondb_owner.
--
-- Tables created by future migrations (run as neondb_owner) get the same grants automatically
-- through ALTER DEFAULT PRIVILEGES, so new tables don't need their own GRANT lines.
--
-- The role is created WITHOUT a password here, so no secret is ever in this file or in chat.
-- After applying, set it at the psql prompt (it asks twice and never shows it):
--     \password setupsbike_app
--
--   1. Dry run (rolls back):  psql ... -f db/migrations/006_app_role.sql
--   2. Apply:                 psql ... -v apply=1 -f db/migrations/006_app_role.sql

\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'setupsbike_app') THEN
    CREATE ROLE setupsbike_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;

GRANT CONNECT ON DATABASE neondb TO setupsbike_app;
GRANT USAGE ON SCHEMA public TO setupsbike_app;
REVOKE CREATE ON SCHEMA public FROM setupsbike_app;

-- rows in every existing app table, and the sequences behind their ids
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO setupsbike_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO setupsbike_app;

-- and the same for tables and sequences that later migrations create
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO setupsbike_app;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO setupsbike_app;

-- what the role ends up with (expect the 7 app tables, DELETE/INSERT/SELECT/UPDATE each)
SELECT table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
  FROM information_schema.role_table_grants
 WHERE grantee = 'setupsbike_app'
 GROUP BY table_name ORDER BY table_name;

SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin
  FROM pg_roles WHERE rolname = 'setupsbike_app';

\if :{?apply}
  COMMIT;
  \echo 'APPLIED: setupsbike_app created. Now run: \password setupsbike_app'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: rolled back. Re-run with -v apply=1 to apply.'
\endif
