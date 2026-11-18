-- 004_ride_notes_and_shares.sql
-- Phase 2.2 ride notes and 2.3 shared setups (Pro to create; anyone can view a shared link).
--   ride_note:    how a bike rode on a given day. `settings` is a snapshot of the bike's 18
--                 values at the time, so the note stays true even after the bike changes.
--   shared_setup: a read-only public snapshot of one bike's settings, found by an
--                 unguessable id. Holds no name or email. Revoking hides it for good.
-- Both are deleted with their bike.
--
-- Run it twice with psql:
--   1. Dry run (rolls everything back):   psql ... -f db/migrations/004_ride_notes_and_shares.sql
--   2. Apply (commits):                    psql ... -v apply=1 -f db/migrations/004_ride_notes_and_shares.sql

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE counts_before ON COMMIT DROP AS
SELECT (SELECT count(*) FROM bike) AS bikes, (SELECT count(*) FROM bike_setup) AS setups;

CREATE TABLE ride_note (
  ride_note_id  bigint        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bike_id       bigint        NOT NULL REFERENCES bike(bike_id) ON DELETE CASCADE,
  ride_date     date          NOT NULL DEFAULT current_date,
  trail         varchar(80),
  conditions    varchar(12)   CHECK (conditions IN ('dry', 'tacky', 'wet', 'muddy', 'loose', 'snow')),
  rating        smallint      CHECK (rating BETWEEN 1 AND 5),
  note          varchar(2000),
  setup_name    varchar(40),
  settings      jsonb         NOT NULL,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX ride_note_by_bike ON ride_note (bike_id, ride_date DESC, ride_note_id DESC);

CREATE TABLE shared_setup (
  share_id      varchar(32)   PRIMARY KEY CHECK (share_id ~ '^[A-Za-z0-9_-]{16,32}$'),
  app_user_id   bigint        NOT NULL REFERENCES app_user(app_user_id) ON DELETE CASCADE,
  bike_id       bigint        NOT NULL REFERENCES bike(bike_id) ON DELETE CASCADE,
  brand         varchar(255)  NOT NULL,
  model         varchar(255)  NOT NULL,
  setup_name    varchar(40),
  settings      jsonb         NOT NULL,
  views         integer       NOT NULL DEFAULT 0,
  copies        integer       NOT NULL DEFAULT 0,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  revoked_at    timestamptz
);
CREATE INDEX shared_setup_by_owner ON shared_setup (app_user_id, created_at DESC);

DO $$
BEGIN
  IF (SELECT count(*) FROM bike) <> (SELECT bikes FROM counts_before)
     OR (SELECT count(*) FROM bike_setup) <> (SELECT setups FROM counts_before) THEN
    RAISE EXCEPTION 'Existing row counts changed; rolling back.';
  END IF;
END $$;

SELECT (SELECT count(*) FROM bike) AS bikes, (SELECT count(*) FROM bike_setup) AS setups,
       (SELECT count(*) FROM ride_note) AS ride_notes, (SELECT count(*) FROM shared_setup) AS shares;

\if :{?apply}
  COMMIT;
  \echo 'APPLIED: ride_note and shared_setup tables added.'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: everything was rolled back. Re-run with -v apply=1 to apply.'
\endif
