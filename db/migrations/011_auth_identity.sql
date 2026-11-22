-- 011_auth_identity.sql
-- Sign-in methods per account (card "Sign-in 1: accounts that aren't tied to Google").
-- app_user stays the account; auth_identity says which ways a person can sign in to it:
--   provider          google | email | apple. apple is allowed now so adding it later needs no
--                     migration; nothing writes it until the Sign in with Apple card.
--   provider_subject  the provider's stable id for the person (Google's "sub", the lowercased
--                     address for email sign-in, Apple's "sub"). NULL only on the google rows this
--                     migration backfills: we never stored Google's id, so AddUser fills it in on
--                     each person's next Google sign-in.
--   email             the address the provider vouched for when the identity was added
--   last_used_at      last sign-in through this method
-- Deleting an account deletes its identities (ON DELETE CASCADE).
--
-- Every current account signed up with Google, so each gets one google row.
-- New tables get the setupsbike_app grants automatically (see 006_app_role.sql).
--
--   1. Dry run (rolls back):  psql ... -f db/migrations/011_auth_identity.sql
--   2. Apply:                 psql ... -v apply=1 -f db/migrations/011_auth_identity.sql

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS auth_identity (
    auth_identity_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_user_id bigint NOT NULL REFERENCES app_user (app_user_id) ON DELETE CASCADE,
    provider text NOT NULL CONSTRAINT auth_identity_provider_check
        CHECK (provider IN ('google', 'email', 'apple')),
    provider_subject text,
    email text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_used_at timestamp with time zone
);

-- One provider id maps to one account...
CREATE UNIQUE INDEX IF NOT EXISTS auth_identity_provider_subject_key
    ON auth_identity (provider, provider_subject) WHERE provider_subject IS NOT NULL;
-- ...and an account has at most one identity per provider.
CREATE UNIQUE INDEX IF NOT EXISTS auth_identity_user_provider_key
    ON auth_identity (app_user_id, provider);

INSERT INTO auth_identity (app_user_id, provider, provider_subject, email, created_at)
SELECT u.app_user_id, 'google', NULL, u.email_address, COALESCE(u.created_at, now())
  FROM app_user u
 WHERE NOT EXISTS (SELECT 1 FROM auth_identity i WHERE i.app_user_id = u.app_user_id AND i.provider = 'google');

\echo
\echo '== Accounts vs google identities (should match) =='
SELECT (SELECT count(*) FROM app_user) AS accounts,
       (SELECT count(*) FROM auth_identity WHERE provider = 'google') AS google_identities;

\echo
\echo '== Grants for the Lambdas (expect DELETE, INSERT, SELECT, UPDATE) =='
SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type) AS setupsbike_app
  FROM information_schema.role_table_grants
 WHERE grantee = 'setupsbike_app' AND table_name = 'auth_identity';

\if :{?apply}
  COMMIT;
  \echo 'APPLIED: auth_identity created and backfilled.'
\else
  ROLLBACK;
  \echo 'DRY RUN ONLY: rolled back. Re-run with -v apply=1 to apply.'
\endif
