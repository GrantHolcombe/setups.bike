-- 012_email_login_code.sql
-- One-time sign-in codes for email sign-in (card "Sign-in 2: sign up and sign in with an emailed code").
--   email        the address the code was sent to (trimmed, lowercased)
--   code_hash    HMAC-SHA256 of the address and the 6-digit code; the code itself is never stored
--   request_ip   who asked, for the per-IP rate limit
--   attempts     wrong guesses so far; the code stops working after 5
--   expires_at   10 minutes after it was sent. Asking for a new code expires the older ones.
--   consumed_at  set when the code is used, so it works once
-- AddUser deletes rows older than a day whenever a code is requested.
-- New tables get the setupsbike_app grants automatically (see 006_app_role.sql).
--
--   1. Dry run (rolls back):  psql ... -f db/migrations/012_email_login_code.sql
--   2. Apply:                 psql ... -v apply=1 -f db/migrations/012_email_login_code.sql

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS email_login_code (
    email_login_code_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text NOT NULL,
    code_hash text NOT NULL,
    request_ip text,
    attempts integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS email_login_code_email_idx ON email_login_code (email, created_at DESC);
CREATE INDEX IF NOT EXISTS email_login_code_ip_idx ON email_login_code (request_ip, created_at);

\echo
\echo '== Grants for the Lambdas (expect DELETE, INSERT, SELECT, UPDATE) =='
SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type) AS setupsbike_app
  FROM information_schema.role_table_grants
 WHERE grantee = 'setupsbike_app' AND table_name = 'email_login_code';

\if :{?apply}
  COMMIT;
  \echo 'APPLIED: email_login_code created.'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: rolled back. Re-run with -v apply=1 to apply.'
\endif
