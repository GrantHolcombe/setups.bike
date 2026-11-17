-- 001_garage_order_cleanup.sql
-- Makes garage_order follow its bike:
--   1. deletes order rows left behind by deleted bikes (and rows with no bike at all)
--   2. adds an order row for any bike that's missing one (GetBikes joins on it, so such a
--      bike would be invisible in the app)
--   3. renumbers each user's garage positions to 1..n, keeping their current order
--   4. adds the missing primary key on bike.bike_id, then a foreign key
--      garage_order.bike_id -> bike.bike_id ON DELETE CASCADE, so
--      deleting a bike removes its order row automatically (no DeleteBike change needed)
--
-- Run it twice with psql:
--   1. Dry run (rolls everything back):   psql ... -f db/migrations/001_garage_order_cleanup.sql
--   2. Apply (commits):                    psql ... -v apply=1 -f db/migrations/001_garage_order_cleanup.sql

\set ON_ERROR_STOP on

BEGIN;

LOCK TABLE bike, garage_order IN ACCESS EXCLUSIVE MODE;

-- A bike with two order rows would show twice in the app; that needs a look, not a guess.
DO $$
DECLARE dupes bigint;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT bike_id FROM garage_order WHERE bike_id IS NOT NULL GROUP BY bike_id HAVING count(*) > 1
  ) d;
  IF dupes > 0 THEN
    RAISE EXCEPTION 'Stopping: % bike(s) have more than one garage_order row.', dupes;
  END IF;
END $$;

-- 1. Order rows whose bike no longer exists.
WITH gone AS (
  DELETE FROM garage_order g
   WHERE g.bike_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM bike b WHERE b.bike_id = g.bike_id)
  RETURNING 1
)
SELECT count(*) AS leftover_rows_deleted FROM gone;

-- 2. Bikes with no order row go to the end of their owner's garage.
WITH added AS (
  INSERT INTO garage_order (app_user_id, bike_id, garage_order)
  SELECT b.app_user_id, b.bike_id,
         COALESCE((SELECT max(g.garage_order) FROM garage_order g WHERE g.app_user_id = b.app_user_id), 0)
           + row_number() OVER (PARTITION BY b.app_user_id ORDER BY b.bike_id)
    FROM bike b
   WHERE b.app_user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM garage_order g WHERE g.bike_id = b.bike_id)
  RETURNING 1
)
SELECT count(*) AS missing_rows_added FROM added;

-- 3. Positions 1..n per user, same order as now.
WITH ranked AS (
  SELECT garage_order_id,
         row_number() OVER (PARTITION BY app_user_id ORDER BY garage_order, garage_order_id) AS pos
    FROM garage_order
)
UPDATE garage_order g SET garage_order = r.pos
  FROM ranked r
 WHERE g.garage_order_id = r.garage_order_id
   AND g.garage_order <> r.pos;

-- 4. Every order row belongs to a bike, and goes when the bike goes.
-- bike has no primary key yet, and a foreign key needs one to point at. bike_id comes from
-- an identity column so it should already be unique; if not, this fails and rolls back.
ALTER TABLE bike ADD CONSTRAINT bike_pkey PRIMARY KEY (bike_id);
ALTER TABLE garage_order ALTER COLUMN bike_id SET NOT NULL;
ALTER TABLE garage_order ADD CONSTRAINT fk_garage_order_bike
  FOREIGN KEY (bike_id) REFERENCES bike(bike_id) ON DELETE CASCADE;

-- Checks; any failure rolls the whole thing back.
DO $$
BEGIN
  IF (SELECT count(*) FROM garage_order)
     <> (SELECT count(*) FROM bike WHERE app_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'garage_order rows do not match bikes one to one; rolling back.';
  END IF;
  IF EXISTS (SELECT 1 FROM garage_order g JOIN bike b USING (bike_id)
              WHERE g.app_user_id IS DISTINCT FROM b.app_user_id) THEN
    RAISE EXCEPTION 'An order row belongs to a different user than its bike; rolling back.';
  END IF;
  IF EXISTS (SELECT app_user_id FROM garage_order GROUP BY app_user_id
              HAVING min(garage_order) <> 1 OR max(garage_order) <> count(*)
                  OR count(DISTINCT garage_order) <> count(*)) THEN
    RAISE EXCEPTION 'Garage positions are not 1..n for every user; rolling back.';
  END IF;
END $$;

-- Result: positions per user (ids and counts only).
SELECT app_user_id, count(*) AS bikes, string_agg(garage_order::text, ',' ORDER BY garage_order) AS positions
  FROM garage_order GROUP BY app_user_id ORDER BY app_user_id;

\if :{?apply}
  COMMIT;
  \echo 'APPLIED: garage_order cleaned up and now cascades on bike delete.'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: everything was rolled back. Re-run with -v apply=1 to apply.'
\endif
