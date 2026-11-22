# End-to-end tests

Playwright drives the local app (`npm start`, localhost:3000) against the **live** API, Lambdas
and Neon database, signed in as a dedicated test account. The Jest tests in `src/` mock the API,
so they can't catch a broken Lambda, a missing database grant or a bad env var. These can.

| Spec | What it covers |
| --- | --- |
| `api.spec.ts` | Every endpoint rejects a bad token (401); an unknown share link is `NOT_FOUND`. No sign-in needed. |
| `smoke.spec.ts` | The garage loads and the menu opens, on desktop and a phone-sized screen. |
| `paths.spec.ts` | Everything else in the UI: the signed-out landing page; email sign-in (code screen, a wrong code, then the garage, with the addUser answers faked so no email is sent); every adjuster (None/Single/Dual) and token control saving through a reload, with the page staying put while a menu is open; saved setups (update, rename, delete, the "Save first / Switch anyway" prompt, and switching while an edit is still being typed); ride ratings and conditions; Delete account (menu placement and the type-"delete" guard, with the API answer faked so the test account survives); email preferences (the menu switch, and the one-time prompt via a faked never-asked account); logging out. |
| `garage.spec.ts` | One throwaway bike through the whole app: add, edit and reload, the adjuster menu, saved setups (save, edit, switch), ride notes (log, edit, reuse settings, delete), sharing (make a link, open it signed out, copy it into the garage, remove it), reorder and retire. It touches every app table, so it also checks the Lambdas' `setupsbike_app` grants. |

**Console guard:** every browser test fails if the page logs a console error or warning or throws
an uncaught exception (`fixtures.ts`). Known noise from outside the app (Google's sign-in popup,
Chrome's install-banner note, React's dev-mode hint) is listed there with the reason. Browser
extensions don't load in these runs, so their errors (e.g. `background.js`) never show up.

## Running

```powershell
npm run e2e          # starts npm start if it isn't running; about a minute
npm run e2e:report   # opens the HTML report (traces and screenshots of any failure)
```

Run it before batching a site deploy, and after any Lambda, env var or database change.

## The test account

- A separate Google account, comped to Pro (`db/maintenance/comp_user.sql`), so Pro features run.
  It's app user 6.
- The tests only touch bikes with the brand **E2E Test**, and delete them at the end (and at
  the start, in case a run failed part-way).
- `helpers.ts` refuses to run as Grant's real account (user 1).

## Signing in

Google won't let a test tool sign in by itself, so the session is saved once by hand:

```powershell
npm run e2e:login
```

It opens Chrome on the app; click **Clip in** and sign in with the test account. The session goes
to `e2e/.auth/session.json` and the Chrome profile to `e2e/.auth/chrome-profile/` (both
git-ignored; never commit them, the session holds a live app token). App tokens last 7 days, so
when the tests say the session has expired, run it again; Google remembers the account, so
it's one click.

This keeps sign-in honest: no test-only login path in the Lambdas and no secrets in the repo.

## Not in CI (yet)

The suite isn't part of CodePipeline: the saved session expires weekly and the run writes to
the production database. Moving it to CI would need a test-only way to get a token (or a Neon
branch plus its own API stage).
