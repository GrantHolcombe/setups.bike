-- check_orphans.sql: read-only check for rows pointing at something that no longer exists, and
-- for foreign keys Postgres has never verified against existing rows (NOT VALID).
--
--   psql ... -f db/maintenance/check_orphans.sql
--
-- All counts should be 0. If they are, any NOT VALID constraint listed can safely be validated
-- (ALTER TABLE ... VALIDATE CONSTRAINT ...), so the guarantee covers old rows too.

\set ON_ERROR_STOP on
BEGIN READ ONLY;

\echo
\echo '== Foreign keys not yet validated against existing rows =='
SELECT conrelid::regclass AS table_name, conname AS constraint_name
  FROM pg_constraint
 WHERE contype = 'f' AND NOT convalidated
 ORDER BY 1, 2;

\echo
\echo '== Orphaned rows (all should be 0) =='
SELECT 'bike -> app_user' AS link, count(*) AS orphans
  FROM bike b WHERE NOT EXISTS (SELECT 1 FROM app_user u WHERE u.app_user_id = b.app_user_id)
UNION ALL
SELECT 'garage_order -> app_user', count(*)
  FROM garage_order g WHERE NOT EXISTS (SELECT 1 FROM app_user u WHERE u.app_user_id = g.app_user_id)
UNION ALL
SELECT 'garage_order -> bike', count(*)
  FROM garage_order g WHERE NOT EXISTS (SELECT 1 FROM bike b WHERE b.bike_id = g.bike_id)
UNION ALL
SELECT 'bike_setup -> bike', count(*)
  FROM bike_setup s WHERE NOT EXISTS (SELECT 1 FROM bike b WHERE b.bike_id = s.bike_id)
UNION ALL
SELECT 'ride_note -> bike', count(*)
  FROM ride_note n WHERE NOT EXISTS (SELECT 1 FROM bike b WHERE b.bike_id = n.bike_id)
UNION ALL
SELECT 'shared_setup -> app_user', count(*)
  FROM shared_setup s WHERE NOT EXISTS (SELECT 1 FROM app_user u WHERE u.app_user_id = s.app_user_id)
UNION ALL
SELECT 'shared_setup -> bike', count(*)
  FROM shared_setup s WHERE NOT EXISTS (SELECT 1 FROM bike b WHERE b.bike_id = s.bike_id)
UNION ALL
SELECT 'bike.active_setup_id -> bike_setup', count(*)
  FROM bike b WHERE b.active_setup_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM bike_setup s WHERE s.bike_setup_id = b.active_setup_id)
UNION ALL
SELECT 'bike without a garage_order row', count(*)
  FROM bike b WHERE NOT EXISTS (SELECT 1 FROM garage_order g WHERE g.bike_id = b.bike_id);

\echo
\echo '== Bikes with a missing owner (details, if any) =='
SELECT b.bike_id, b.app_user_id, b.brand, b.model
  FROM bike b WHERE NOT EXISTS (SELECT 1 FROM app_user u WHERE u.app_user_id = b.app_user_id)
 ORDER BY b.bike_id;

ROLLBACK;
