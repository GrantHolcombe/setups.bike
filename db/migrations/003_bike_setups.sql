-- 003_bike_setups.sql
-- Phase 2.1: multiple saved setups per bike (Pro).
--   bike_setup holds named presets: a snapshot of a bike's 18 tire and suspension values.
--   The bike row stays the current setup; bike.active_setup_id says which preset was last
--   applied or saved. Presets are deleted with their bike; deleting a preset clears
--   active_setup_id on its bike. Names are unique per bike, ignoring case.
--
-- Run it twice with psql:
--   1. Dry run (rolls everything back):   psql ... -f db/migrations/003_bike_setups.sql
--   2. Apply (commits):                    psql ... -v apply=1 -f db/migrations/003_bike_setups.sql

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE counts_before ON COMMIT DROP AS
SELECT (SELECT count(*) FROM bike) AS bikes;

CREATE TABLE bike_setup (
  bike_setup_id           bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bike_id                 bigint       NOT NULL REFERENCES bike(bike_id) ON DELETE CASCADE,
  name                    varchar(40)  NOT NULL CHECK (length(btrim(name)) > 0),
  front_tire              integer      NOT NULL DEFAULT 0,
  front_sus_pressure      integer      NOT NULL DEFAULT 0,
  front_sus_comp_1        integer      NOT NULL DEFAULT 0,
  front_sus_comp_2        integer      NOT NULL DEFAULT 0,
  front_sus_comp_count    integer      NOT NULL DEFAULT 0,
  front_sus_rebound_1     integer      NOT NULL DEFAULT 0,
  front_sus_rebound_2     integer      NOT NULL DEFAULT 0,
  front_sus_rebound_count integer      NOT NULL DEFAULT 0,
  front_tokens            integer      NOT NULL DEFAULT 0,
  rear_tire               integer      NOT NULL DEFAULT 0,
  rear_sus_pressure       integer      NOT NULL DEFAULT 0,
  rear_sus_comp_1         integer      NOT NULL DEFAULT 0,
  rear_sus_comp_2         integer      NOT NULL DEFAULT 0,
  rear_sus_comp_count     integer      NOT NULL DEFAULT 0,
  rear_sus_rebound_1      integer      NOT NULL DEFAULT 0,
  rear_sus_rebound_2      integer      NOT NULL DEFAULT 0,
  rear_sus_rebound_count  integer      NOT NULL DEFAULT 0,
  rear_tokens             integer      NOT NULL DEFAULT 0,
  created_at              timestamptz  NOT NULL DEFAULT now(),
  updated_at              timestamptz  NOT NULL DEFAULT now()
);

-- "Bike park" and "bike park" count as the same name on one bike.
CREATE UNIQUE INDEX bike_setup_name_per_bike ON bike_setup (bike_id, lower(btrim(name)));

ALTER TABLE bike
  ADD COLUMN active_setup_id bigint REFERENCES bike_setup(bike_setup_id) ON DELETE SET NULL;

DO $$
BEGIN
  IF (SELECT count(*) FROM bike) <> (SELECT bikes FROM counts_before) THEN
    RAISE EXCEPTION 'Bike count changed; rolling back.';
  END IF;
  IF EXISTS (SELECT 1 FROM bike WHERE active_setup_id IS NOT NULL) THEN
    RAISE EXCEPTION 'active_setup_id should start empty; rolling back.';
  END IF;
END $$;

SELECT (SELECT count(*) FROM bike) AS bikes, (SELECT count(*) FROM bike_setup) AS setups;

\if :{?apply}
  COMMIT;
  \echo 'APPLIED: bike_setup table and bike.active_setup_id added.'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: everything was rolled back. Re-run with -v apply=1 to apply.'
\endif
