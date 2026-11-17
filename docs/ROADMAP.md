# Setups.Bike roadmap: Pro plan, new features, PWA, then app stores

Written 2026-11-17. Order of work: **Pro plan → Pro features → PWA → app stores.**
Each phase ships on its own, so the app keeps working between phases.

## Plans

| | Free | Pro |
|---|---|---|
| Price | $0, no card needed | $2.99/month or $24/year |
| Bikes | Up to **3** | Unlimited |
| Today's features: tire pressure, suspension settings, tokens, reordering | ✅ | ✅ |
| Multiple saved setups per bike | — | ✅ |
| Ride notes (how a setup rode on a trail) | — | ✅ |
| Suggested starting settings | — | ✅ |
| Share a setup with a friend | — | ✅ (anyone can view a shared link) |

Rules:
- Free stays exactly as it is today, apart from the 3-bike limit. No card, no trial.
- Limits are enforced **in the Lambdas**, not only in the UI, since the API is public.
- Users who already have more than 3 bikes keep them all. They just can't add another
  until they're under the limit or on Pro.
- If Pro lapses, nothing is deleted. Extra bikes and Pro data become read-only until the
  user upgrades again or deletes bikes to get back to 3.

---

## Phase 0: Prep (mostly you)

- [x] **Pricing:** $2.99/month or $24/year (decided 2026-11-17).
- [ ] **Create a Stripe account** at stripe.com, in your name. Start in **test mode**.
      You fill in the business and bank details. Claude never handles them.
- [ ] **Lambda role for new functions.** The connector can't create IAM roles or pass them,
      and each new endpoint needs a new Lambda. Pick one:
  - (a) Create one role `setupsbike-lambda-role` with `AWSLambdaBasicExecutionRole`, and
        allow `iam:PassRole` on **only that role** in `ClaudeOperatorPolicy`. Claude can then
        create functions. **(Recommended.)**
  - (b) Create each new function yourself in the console as an empty shell. Claude deploys
        the code.
- [ ] Attach `AWSLambdaBasicExecutionRole` to the GetBikes and reorderGarage roles so every
      function writes logs. Debugging payments without logs is painful.
- [ ] **Database migrations.** Schema changes go in `db/migrations/NNN_name.sql` in this repo.
      You run each one against the Neon **direct** host and type the password at the prompt:
      ```powershell
      & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h ep-shiny-mountain-bfjvu2jn.c-5.us-west-2.aws.neon.tech -U neondb_owner -d neondb -f db\migrations\002_plans.sql
      ```
      First, take a backup with `pg_dump` (same flags as the migration).
- [ ] Check how `garage_order` rows get created (addBike only inserts into `bike`, so there's
      probably a trigger). Dump the schema so migrations build on what's really there:
      ```powershell
      & "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h ep-shiny-mountain-bfjvu2jn.c-5.us-west-2.aws.neon.tech -U neondb_owner -d neondb --schema-only -f db\schema.sql
      ```
- [x] **Close the gaps in user ids.** Done 2026-11-17: 8 users renumbered from
      3, 29, 32, 40, 49, 54, 156, 157 to 1..8 on production (tested first on a Neon branch),
      then the JWT secret was rotated. The bug behind the gaps (AddUser using up an id on
      every sign-in) was fixed on 2026-11-13. Migration: `db/migrations/000_renumber_users.sql`.
- [x] **Clean up `garage_order`.** Done 2026-11-17 (`001_garage_order_cleanup.sql`): deleted
      3 rows left behind by deleted bikes, added the missing primary key on `bike.bike_id`,
      and made `garage_order.bike_id` a foreign key with `ON DELETE CASCADE`, so deleting a
      bike now removes its order row automatically.
- **How migrations run:** test on a Neon branch first, take a `pg_dump -Fc` backup of
  production, dry run (the default rolls back), then apply with `-v apply=1`. Re-dump
  `db/schema.sql` after each one so it stays current.
- [ ] Basic legal pages before taking money: **Terms**, **Privacy Policy** (also required by
      both app stores later), and a **refund policy**. Stripe also asks for a support email.
- [x] **Sales tax: not collected at launch** (decided 2026-11-17). Turn on Stripe Tax's free
      **threshold monitoring** instead: set the product's tax category and your head office
      address in the Dashboard. Stripe then alerts you before sales in any state or country
      reach a level where you'd have to register and collect. No code and no per-sale fee.
      Revisit when it alerts, or switch to Stripe Tax collection (paid per transaction) or
      Managed Payments, where Stripe acts as the seller and handles tax for a higher fee.

## Phase 1: Pro plan and payments

**Database** (`002_plans.sql`): add to `app_user`:
`plan` (`'free'`/`'pro'`, default `'free'`), `stripe_customer_id`, `plan_status`, `plan_renews_at`.

**Lambdas:**
| Function | New or changed | Does |
|---|---|---|
| `GetAccount` | new | Returns the signed-in user's plan, bike count and limit |
| `createCheckoutSession` | new | Creates a Stripe Checkout session for the signed-in user and returns its URL |
| `createPortalSession` | new | Opens Stripe's billing portal (change card, cancel) |
| `stripeWebhook` | new | Verifies Stripe's signature, then sets `plan`/`plan_status` on checkout, renewal, cancellation and failed payment |
| `addBike` | changed | Refuses a 4th bike on Free (403 with a clear message) |

- Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price ids) go in Lambda env vars.
  You enter them in the console. They never go in chat or the repo.
- The plan is read from the database on each gated call, not stored in the JWT, so upgrades
  and cancellations apply immediately.
- Use Stripe's hosted Checkout and Customer Portal, so no card form lives in the app.

**Stripe setup** (from Stripe's implementation planner, 2026-11-17: hosted Checkout, flat
rate, freemium, Customer Portal, Smart Retries):
- **Catalog:** one product, "Setups.Bike Pro", with two recurring USD prices: `299` cents
  monthly and `2400` cents yearly. Created in the sandbox first, then again in live mode.
- **Checkout:** `createCheckoutSession` creates a session with `mode: subscription`, the
  chosen price, `client_reference_id` = our `app_user_id` (so the webhook knows who paid),
  the Stripe customer if they already have one, and success/cancel URLs back to the app.
  The browser just redirects to the session's `url`. Use flexible billing mode, Stripe's
  default for new subscriptions.
- **Customer Portal:** configure it to allow updating the card, viewing invoices, switching
  between the monthly and yearly prices, and **cancelling at the end of the period** (keeps
  access until then, no refunds to work out). `createPortalSession` returns a short-lived URL
  for the signed-in user's customer.
- **Webhook events** for `stripeWebhook`, always after verifying the `Stripe-Signature`
  header against the raw request body:
  | Event | What we do |
  |---|---|
  | `checkout.session.completed` | Link the Stripe customer and subscription to the user (via `client_reference_id`), set Pro |
  | `invoice.paid` | Keep Pro active and update `plan_renews_at` |
  | `invoice.payment_failed` | Mark `past_due`. Stripe retries and emails the customer; the app shows "update your card" with a portal link |
  | `customer.subscription.updated` | Sync status, price (monthly or yearly), renewal date and a pending cancellation |
  | `customer.subscription.deleted` | Back to Free |

  Handle repeats and out-of-order delivery: save the subscription's current state from Stripe
  instead of toggling, and ignore events already processed (store the event id).
- **Failed payments:** turn on Smart Retries, failed-payment emails and automatic card updates
  in Billing > Revenue recovery. This is Dashboard setup, with no code.
- **API Gateway:** the webhook route must pass the **raw body** through unchanged, or
  signature checks fail.

**Frontend:**
- "Go Pro" in the menu, plus an upgrade prompt when a Free user tries to add a 4th bike.
- Return pages for checkout success and cancel. After success, refresh the plan.
- "Manage subscription" (the portal) for Pro users.

**Done when:** in Stripe test mode, a test card upgrades an account, a 4th bike can be added,
cancelling in the portal reverts to Free at period end, and a failed renewal is handled.
Then switch to live keys.

## Phase 2: Pro features (one release each)

### 2.1 Multiple setups per bike
Named presets per bike, such as "Bike park", "XC" or "Wet".
- `003_bike_setups.sql`: a `bike_setup` table (id, bike_id, name, all the suspension and tire
  columns, created_at).
- Today's settings on the `bike` row stay the **active** setup, so Free users and the current
  screens don't change. Saving a preset copies the bike's settings into `bike_setup`.
  Switching copies a preset back onto the bike.
- UI: a setup picker on each bike card, with "Save as new setup", rename and delete.
- Lambdas: list, save, apply, rename and delete setups, all checking ownership and Pro.

### 2.2 Ride notes
Log how a setup rode: date, trail, conditions, a 1–5 rating, and free text.
- `004_ride_notes.sql`: a `ride_note` table (id, bike_id, setup snapshot as `jsonb`, ride date,
  trail, conditions, rating, note). The snapshot keeps the exact settings even if the setup
  changes later.
- UI: "Log a ride" on a bike card and a history list. Optionally, "use these settings again".

### 2.3 Share a setup
- `005_shared_setups.sql`: a `shared_setup` table (random unguessable id, owner, bike
  brand/model, settings snapshot, created_at, revoked).
- A public read-only page `setups.bike/s/<id>` that works without signing in. This is the
  growth loop, so keep it free to view.
- "Copy to my garage" needs sign-in and counts toward the bike limit, so it works on Free too.
- The owner can see and revoke their links.
- Note: the site is served from S3, so `/s/<id>` needs the app to handle that path. That
  means a client-side route plus an S3/Cloudflare rule that serves `index.html` for it.

### 2.4 Suggested starting settings
A starting point from rider weight, riding style and fork/shock model.
- The hardest feature, because it needs **data**:
  - Start with general, well-known rules, such as setting air pressure to reach a target
    sag (around 25–30% rear, 15–20% front, varying by bike). The app shows the target sag and
    how to measure it.
  - Then add a small curated table of the most common fork and shock models, using
    manufacturers' published setup guides. Write the values yourself and link the source,
    rather than copying the guides.
- Always show it as a starting point with a "check your sag" disclaimer, never as the answer.
- `006_suggestions.sql` for the model table. Rider weight is stored on `app_user` (optional).

## Phase 3: PWA (installable web app)

Today the manifest is still Create React App's default ("React App", React logos, black
theme), and there's no service worker.
- [ ] Manifest: the name "Setups.Bike", proper icons (192, 512 and a maskable one) made from
      `public/img/logos`, the theme colour `#daa530`, `start_url` `/`.
- [ ] Service worker: cache the app shell (HTML, JS, CSS, images) so it opens fast and offline.
      **Never cache API responses**, so data is always fresh.
- [ ] iOS: `apple-touch-icon` at the right size, the status bar style, and a splash colour.
- [ ] An "Install app" prompt on Android and Chrome, and short "Add to Home Screen" help for iOS.
- [ ] Check with Lighthouse's PWA audit.

## Phase 4: App stores (later, when Pro has a few paying users)

- Wrap the same React code with **Capacitor** for iOS and Android. iOS builds on your Mac.
- Accounts: Apple Developer is $99/year, Google Play $25 once. New personal Google Play
  accounts must run a closed test with 12 testers for 14 days before going public.
- **Sign in with Apple** will be needed alongside Google sign-in for the iOS app.
- **Payments inside the apps:** Apple and Google expect digital upgrades bought inside their
  apps to use their own in-app purchases (about 15% fee at your size). The rules on linking
  out to web checkout have been changing, so check each store's current rules then. Plan for
  the backend to accept Pro from Stripe, Apple or Google.
- Add phone-only features so the app isn't "just a website" (Apple rejects those). For
  example: home-screen widgets, a sag-measuring helper with the camera, or reminders to log
  a ride.

---

## Open decisions
1. Whether Claude may create Lambdas (option a in Phase 0) or you create the shells (option b).
2. Whether to keep using the `test` API Gateway stage for production, or add a `prod` stage
   while adding the new routes.
3. A support email address and who writes the legal pages.

## Done so far (Nov 2026)
- Database moved to Neon. Parameterized SQL in every Lambda.
- Sign-in verified with Google, a rotated JWT secret, 7-day tokens, and ownership checks on
  every function.
- Reorder is about 8× faster. Sessions survive a page refresh.
- Lambda source is in `lambdas/`, with a README for deploying.
