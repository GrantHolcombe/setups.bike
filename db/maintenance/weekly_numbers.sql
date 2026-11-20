-- weekly_numbers.sql: the numbers marketing needs, straight from the database. Read-only.
--
--   psql ... -f db/maintenance/weekly_numbers.sql                 last 7 days vs the 7 before
--   psql ... -v days=30 -f db/maintenance/weekly_numbers.sql      any other window
--
--   psql ... -v exclude=6,1 -f db/maintenance/weekly_numbers.sql  leave out other accounts too
--
-- The e2e test account (user 6) is left out of the activity counts by default: every test run
-- adds and deletes bikes, setups, notes and share links. Plan counts still include everyone.
-- Sign-up, bike-added and active counts start from migration 007 (2026-11-20); rows from before
-- it have no date and only show in the totals. Test and comped accounts are listed separately
-- so they don't inflate the paying numbers. Pair with Cloudflare Web Analytics for visits and
-- the Stripe Dashboard for revenue.

\set ON_ERROR_STOP on
\if :{?days}
\else
  \set days 7
\endif
\if :{?exclude}
\else
  \set exclude 6
\endif

BEGIN READ ONLY;

\echo
\echo '== This window vs the one before =='
WITH w AS (
  SELECT now() - make_interval(days => :days) AS since,
         now() - make_interval(days => :days * 2) AS before
),
u AS (SELECT * FROM app_user WHERE app_user_id NOT IN (:exclude)),
b AS (SELECT * FROM bike WHERE app_user_id NOT IN (:exclude)),
st AS (SELECT s.* FROM bike_setup s JOIN b USING (bike_id)),
rn AS (SELECT n.* FROM ride_note n JOIN b USING (bike_id)),
sh AS (SELECT * FROM shared_setup WHERE app_user_id NOT IN (:exclude))
SELECT metric, this_window, previous_window FROM (
  SELECT 1 AS o, 'new sign-ups' AS metric,
         (SELECT count(*) FROM u, w WHERE created_at >= since) AS this_window,
         (SELECT count(*) FROM u, w WHERE created_at >= before AND created_at < since) AS previous_window
  UNION ALL
  SELECT 2, 'active users (garage opened)',
         (SELECT count(*) FROM u, w WHERE last_active_at >= since), NULL
  UNION ALL
  SELECT 3, 'bikes added',
         (SELECT count(*) FROM b, w WHERE created_at >= since),
         (SELECT count(*) FROM b, w WHERE created_at >= before AND created_at < since)
  UNION ALL
  SELECT 4, 'saved setups created',
         (SELECT count(*) FROM st, w WHERE created_at >= since),
         (SELECT count(*) FROM st, w WHERE created_at >= before AND created_at < since)
  UNION ALL
  SELECT 5, 'ride notes logged',
         (SELECT count(*) FROM rn, w WHERE created_at >= since),
         (SELECT count(*) FROM rn, w WHERE created_at >= before AND created_at < since)
  UNION ALL
  SELECT 6, 'share links made',
         (SELECT count(*) FROM sh, w WHERE created_at >= since),
         (SELECT count(*) FROM sh, w WHERE created_at >= before AND created_at < since)
  UNION ALL
  SELECT 7, 'Pro changes (start, renew, cancel)',
         (SELECT count(*) FROM u, w WHERE plan_updated_at >= since AND plan_source = 'stripe'),
         (SELECT count(*) FROM u, w WHERE plan_updated_at >= before AND plan_updated_at < since AND plan_source = 'stripe')
) t ORDER BY o;
-- "active users" has no previous window: last_active_at only keeps the latest visit.

\echo
\echo '== Totals today (excluded accounts left out) =='
SELECT
  (SELECT count(*) FROM app_user WHERE app_user_id NOT IN (:exclude)) AS users,
  (SELECT count(*) FROM app_user WHERE app_user_id NOT IN (:exclude) AND last_active_at >= now() - interval '30 days') AS active_30d,
  (SELECT count(*) FROM bike WHERE app_user_id NOT IN (:exclude)) AS bikes,
  (SELECT count(*) FROM bike_setup s JOIN bike b USING (bike_id) WHERE b.app_user_id NOT IN (:exclude)) AS saved_setups,
  (SELECT count(*) FROM ride_note n JOIN bike b USING (bike_id) WHERE b.app_user_id NOT IN (:exclude)) AS ride_notes;

\echo
\echo '== Plans =='
-- paying = Stripe Pro that isn't set to cancel; comp = given free (owner, test account, partners)
SELECT
  count(*) FILTER (WHERE plan = 'free') AS free,
  count(*) FILTER (WHERE plan = 'pro' AND plan_source = 'stripe' AND plan_interval = 'month' AND NOT plan_cancel_at_period_end) AS pro_monthly,
  count(*) FILTER (WHERE plan = 'pro' AND plan_source = 'stripe' AND plan_interval = 'year' AND NOT plan_cancel_at_period_end) AS pro_yearly,
  count(*) FILTER (WHERE plan = 'pro' AND plan_source = 'stripe' AND plan_cancel_at_period_end) AS pro_cancelling,
  count(*) FILTER (WHERE plan = 'pro' AND plan_status = 'past_due') AS past_due,
  count(*) FILTER (WHERE plan = 'pro' AND plan_source = 'comp') AS comped
FROM app_user;

\echo
\echo '== Share links (live) =='
SELECT count(*) AS live_links, coalesce(sum(views), 0) AS total_views, coalesce(sum(copies), 0) AS total_copies,
       count(*) FILTER (WHERE views > 0) AS links_viewed, count(*) FILTER (WHERE copies > 0) AS links_copied
FROM shared_setup WHERE revoked_at IS NULL AND app_user_id NOT IN (:exclude);

\echo
\echo '== Most viewed share links =='
SELECT share_id, s.brand || ' ' || s.model AS bike, views, copies, to_char(s.created_at, 'YYYY-MM-DD') AS made
FROM shared_setup s WHERE revoked_at IS NULL AND app_user_id NOT IN (:exclude) ORDER BY views DESC, copies DESC LIMIT 5;

ROLLBACK;
