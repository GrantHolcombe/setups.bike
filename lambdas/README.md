# Setups.Bike Lambdas

Source for the API's Lambda functions (us-west-1, Node 24: runtime `nodejs24.x`, async handlers only). App tokens are HS256 JWTs made
and checked with [`jose`](https://github.com/panva/jose) (since 2026-11-21; it replaced `jsonwebtoken`,
whose dependencies break on Node 26). jose is an ES module and Lambda's runtime can't `require()`
one, so the Lambdas load it with `const jose = import("jose")`. Each Lambda keeps one database connection per warm container and reuses it across calls
(`newClient()` at the top of each `index.js`): `connect()` reuses or reopens it (with a quick
`SELECT 1` if it has been idle over a minute), `end()` leaves it open, and a connection-level error
makes the next call reconnect; queries are never retried. This took `getBikes` from ~260 ms to
~90 ms (2026-11-21). Each folder is named after its
Lambda function and deploys on its own. These aren't part of the CodePipeline frontend build.

| Folder | API route | What it does |
|---|---|---|
| `SetupDotBikes_AddUser` | `addUser` | Sign-in for every method: a provider module in `providers/` (Google today) verifies the credential, then it finds, links or creates the account (`auth_identity`) and returns a JWT. Takes `?accessToken=` (Google, what the app sends) or `{provider, token}`. Unknown method 400, unverifiable token 401 |
| `SetupsDotBike_GetBikes` | `getBikes` | Lists a user's bikes in garage order |
| `SetupsDotBike_addBike` | `AddBike` | Adds a bike for the signed-in user |
| `SetupsDotBike_updateBike` | `updateBike` | Saves a bike's tire and suspension settings |
| `SetupsDotBike_DeleteBike` | `DeleteBike` | Deletes bikes by id |
| `setupsDotBike_reorderGarage` | `reorderGarage` | Saves the garage order |
| `SetupsDotBike_bikeSetups` | `POST bikeSetups` | Pro: named setups per bike |
| `SetupsDotBike_rideNotes` | `POST rideNotes` | Pro: ride notes with a settings snapshot |
| `SetupsDotBike_sharedSetups` | `POST sharedSetups` | Pro: share links (viewing needs no sign-in) |
| `SetupsDotBike_emailPrefs` | `POST emailPrefs` | Marketing email preference: get/set for the signed-in user, keeps the Resend contact in step. A direct invoke with `{"action": "syncAll"}` copies everyone to Resend. Env: `RESEND_API_KEY`, `RESEND_SEGMENT_ID` (Grant sets these in the console); optional `EXCLUDED_USER_IDS` (comma-separated user ids never sent to Resend; empty since 2026-11-22, so the e2e account syncs too and can be a test inbox) |
| `SetupsDotBike_resendWebhook` | `POST resendWebhook` | Called by Resend: unsubscribe, permanent bounce or spam complaint turns `marketing_emails` off (Svix signature checked with `RESEND_WEBHOOK_SECRET`) |

All DB access uses parameterized queries (`$1`, `$2`, ...). Keep it that way: never build SQL
by joining strings with request values.

## Config (Lambda environment variables)
`NEON_HOSTNAME` (Neon pooled host), `NEON_USERNAME` (`setupsbike_app`, the least-privilege role from
migration 006; never the owner), `NEON_PASSWORD`, `NEON_DATABASE`,
`PGSSLMODE=require`, and `JWT` on `addBike`. Secrets stay in the Lambda console, never in this repo.

## Deploy one function
```powershell
cd lambdas\SetupsDotBike_GetBikes
npm ci --omit=dev
Compress-Archive -Force -Path index.js,package.json,package-lock.json,node_modules -DestinationPath function.zip
aws lambda update-function-code --region us-west-1 --function-name SetupsDotBike_GetBikes --zip-file fileb://function.zip
```
Before deploying, publish a version (`aws lambda publish-version`) so you can roll back.

Zips uploaded to `s3://codepipeline-us-west-1-708924771225/lambda-deploys/` (the presigned-URL
deploy path) are deleted automatically after 7 days by the bucket's lifecycle rule
`expire-lambda-deploy-zips` (added 2026-11-19). Lambda keeps its own copy of each version.
