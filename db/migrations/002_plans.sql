-- 002_plans.sql
-- Adds Free/Pro plans for Phase 1.
--   app_user gets plan columns. Everyone starts on 'free'.
--   stripe_event remembers which Stripe webhook events were already handled, so a
--   repeated delivery is ignored.
--
-- plan_source says where Pro came from ('stripe' now; 'apple' or 'google' once the
-- store apps exist), so the backend can accept Pro from more than one place.
--
-- Run it twice with psql:
--   1. Dry run (rolls everything back):   psql ... -f db/migrations/002_plans.sql
--   2. Apply (commits):                    psql ... -v apply=1 -f db/migrations/002_plans.sql

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE counts_before ON COMMIT DROP AS
SELECT (SELECT count(*) FROM app_user) AS users;

ALTER TABLE app_user
  ADD COLUMN plan                      text        NOT NULL DEFAULT 'free',
  ADD COLUMN plan_source               text,
  ADD COLUMN plan_status               text,
  ADD COLUMN plan_interval             text,
  ADD COLUMN plan_renews_at            timestamptz,
  ADD COLUMN plan_cancel_at_period_end boolean     NOT NULL DEFAULT false,
  ADD COLUMN plan_updated_at           timestamptz,
  ADD COLUMN stripe_customer_id        text,
  ADD COLUMN stripe_subscription_id    text;

ALTER TABLE app_user
  ADD CONSTRAINT app_user_plan_check          CHECK (plan IN ('free', 'pro')),
  ADD CONSTRAINT app_user_plan_source_check   CHECK (plan_source IS NULL OR plan_source IN ('stripe', 'apple', 'google')),
  ADD CONSTRAINT app_user_plan_interval_check CHECK (plan_interval IS NULL OR plan_interval IN ('month', 'year')),
  ADD CONSTRAINT app_user_stripe_customer_unique     UNIQUE (stripe_customer_id),
  ADD CONSTRAINT app_user_stripe_subscription_unique UNIQUE (stripe_subscription_id);

CREATE TABLE stripe_event (
  event_id    text        PRIMARY KEY,
  event_type  text        NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF (SELECT count(*) FROM app_user) <> (SELECT users FROM counts_before) THEN
    RAISE EXCEPTION 'User count changed; rolling back.';
  END IF;
  IF EXISTS (SELECT 1 FROM app_user WHERE plan <> 'free') THEN
    RAISE EXCEPTION 'Someone is not on free; rolling back.';
  END IF;
END $$;

SELECT plan, count(*) AS users FROM app_user GROUP BY plan;

\if :{?apply}
  COMMIT;
  \echo 'APPLIED: plan columns and stripe_event table added.'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: everything was rolled back. Re-run with -v apply=1 to apply.'
\endif
