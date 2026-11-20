# Setups.Bike roadmap: Pro plan, new features, PWA, then app stores

Written 2026-11-17. Order of work: **Pro plan → Pro features → PWA → app stores.**
Each phase ships on its own, so the app keeps working between phases.

**Changed 2026-11-18:** Phase 1 is built and fully tested in Stripe test mode, but **Pro does
not launch yet**. Stripe stays in test mode and billing stays switched on only for Grant
(`BILLING_ENABLED_FOR=1`) while the Phase 2 features are built and tested one at a time, behind
the same Pro check. Pro launches (Phase 1's "Before switching to live keys" checklist, then
`BILLING_ENABLED_FOR=all`) once there are features worth buying. Everyone else keeps today's
app in the meantime, with no bike limit and no Go Pro.

> **Pro launched 2026-11-19 (UTC).** Live Stripe keys (restricted key) in the three Stripe
> Lambdas; `BILLING_ENABLED_FOR=all` on addBike, GetAccount, createCheckoutSession,
> bikeSetups, rideNotes and sharedSetups (set it back to `1` to turn billing off for everyone
> but Grant). A real $2.99 purchase and cancel were checked end to end first. Grant's account
> (user 1) is comped Pro (`plan_source = 'comp'`, see `db/maintenance/comp_user.sql`); his
> other accounts test the free side.

## Plans

| | Free | Pro |
|---|---|---|
| Price | $0, no card needed | $2.99/month or $24/year |
| Bikes | Up to **3** | Unlimited |
| Today's features: tire pressure, suspension settings, tokens, reordering | ✅ | ✅ |
| Multiple saved setups per bike | — | ✅ |
| Ride notes (how a setup rode on a trail) | — | ✅ |
| Suggested starting settings | — | Deferred (see 2.4) |
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
- [x] **Create a Stripe account** at stripe.com, in your name. Start in **test mode**.
      Done 2026-11-17: the "Setups.bike sandbox" is connected through Stripe's MCP server.
      You fill in the business and bank details. Claude never handles them.
- [x] **Lambda role for new functions.** Done 2026-11-17 with option (a):
      `setupsbike-lambda-role` (logs only), and `ClaudeOperatorPolicy` allows passing that
      role to Lambda and nothing else. The connector can't create IAM roles or pass them,
      and each new endpoint needs a new Lambda. Pick one:
  - (a) Create one role `setupsbike-lambda-role` with `AWSLambdaBasicExecutionRole`, and
        allow `iam:PassRole` on **only that role** in `ClaudeOperatorPolicy`. Claude can then
        create functions. **(Recommended.)**
  - (b) Create each new function yourself in the console as an empty shell. Claude deploys
        the code.
- [x] **Logs for every function.** Done 2026-11-17: GetBikes and reorderGarage were borrowing
      AddUser's and updateBike's roles, which could only log to those functions' log groups.
      Both now use `setupsbike-lambda-role`, and both write logs.
- [x] **All six app Lambdas on `setupsbike-lambda-role`.** Done 2026-11-17. AddUser's old
      role had full RDS Data and VPC access plus the old Aurora secret; that's gone now.
- [x] Delete the four old roles nothing uses any more (IAM, yours to do):
      `SetupDotBikes_AddUser-role-prmqlqlf`, `SetupsDotBike_addBike-role-x63taabc`,
      `SetupsDotBike_updateBike-role-295612hm`, `SetupsDotBike_DeleteBike-role-mz88xe3q`.
      Deleted by Grant 2026-11-20 (confirmed). Their ten leftover customer-managed policies
      (`AWSLambdaBasicExecutionRole-…`, `AWSLambdaVPCAccessExecutionRole-…`,
      `AWSLambdaRDSProxyExecutionRole-…`) are unattached and can be deleted.
      Second sweep 2026-11-20: removed the unused public `/getUsers` route (old function with no
      sign-in check, pointed at the deleted RDS proxy), deleted the 2024 functions
      `SetupsDotBike_GetUsers`, `SetupsDotBike_CORSResponse`, `SetupsDotBike_JWTLayer` and
      `NetworkAuth` with their logs, and Grant deleted their roles plus the RDS-era roles
      (`postgres`, `rds-monitoring-role`, two `rds-proxy-role-…`), the IAM user `postgres`, and
      the 2018-19 projects (two APIs, six Lambdas, a DynamoDB table, a test bucket, and the
      over-powered `write-db` role). Final IAM: 1 user, 4 roles, 4 policies, all in use.
      **Keep** `Setups.Bike_CD_Role` (the pipeline) and `SetupsDotBikeCodeBuildSR` (the build).
- [x] **Database migrations.** Set up 2026-11-17 (`000` and `001` applied). Schema changes go in `db/migrations/NNN_name.sql` in this repo.
      You run each one against the Neon **direct** host and type the password at the prompt:
      ```powershell
      & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h ep-shiny-mountain-bfjvu2jn.c-5.us-west-2.aws.neon.tech -U neondb_owner -d neondb -f db\migrations\002_plans.sql
      ```
      First, take a backup with `pg_dump` (same flags as the migration).
- [x] Check how `garage_order` rows get created. Done 2026-11-17: a trigger
      (`insert_garage_order`) adds one per new bike. The schema is in `db/schema.sql`:
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
- [x] **Legal pages and support email.** Done 2026-11-17: Terms, Privacy Policy and Refund
      Policy at `/terms.html`, `/privacy.html` and `/refunds.html`, linked from the app footer.
      Edit `legal/site.config.json` (support email, prices, refund window and so on) or
      `legal/templates/`; the build regenerates the pages. Worth a review by someone qualified
      before taking real money.

**Keeping the public repo safe** (the repo stays public as a portfolio piece; Pro is enforced
by the Lambdas, so readable code doesn't open a way around it):
- [x] **Decide on a license.** Done 2026-11-20: all rights reserved, with a `LICENSE` file
      saying so and a line in the README. With no `LICENSE` file, others can read the code but have no
      right to reuse it, which suits a portfolio project you sell. Don't add an open-source
      license (MIT and the like) unless you mean to allow reuse. Optionally add a README line:
      "Source shown for portfolio purposes. All rights reserved."
- [x] **Turn on GitHub secret scanning and push protection** (repo Settings > Code security).
      Confirmed on 2026-11-17.
      Free for public repos; it blocks a push that contains a Stripe or AWS key. The only secret
      ever committed is the old JWT secret, rotated twice on 2026-11-17 and now useless.
- [ ] **Optional: limit which IPs can reach Neon.** Low priority while the password stays
      private. The Lambdas have no fixed IPs, so this may need a paid Neon feature or a
      different network setup.
- [ ] **Later: keep curated data out of the repo.** If the Phase 2.4 suggested-settings table
      becomes valuable, store it only in the database rather than in a migration file.
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

- Every new Lambda uses `setupsbike-lambda-role`, and its log group gets **30-day retention**,
  as the privacy policy says (all six existing functions were set to 30 days on 2026-11-17).
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

**Before switching to live keys** (repeat in the live account; sandbox settings don't carry over):
- [x] Tax settings: head office address, SaaS (personal use) tax code, automatic tax off.
      Live account checked 2026-11-18: all set, threshold emails on.
- [x] Revenue recovery > Retries: Smart Retries on; "If all retries fail" = cancel the
      subscription. (Already set in the sandbox.)
- [x] Revenue recovery > Emails: turn on "Send emails when card payments fail" and
      "Send emails about expiring cards", both with **Link to a Stripe hosted page** (it lets
      the customer update their card without signing in to the app). Done in the sandbox on
      2026-11-17, live 2026-11-18.
- [x] Activate the live account (Stripe asks for identity and bank details; yours to do), then
      in Settings > Business > Business details set: privacy policy
      `https://setups.bike/privacy.html`, terms `https://setups.bike/terms.html`, support
      email `grant@hiregrant.today`. (Not available in the sandbox.) Done: account verified
      2026-11-19; the terms and privacy links show in the live Customer Portal.
- [x] Dashboard part done in live mode 2026-11-18: product "Setups.Bike Pro" with
      `pro_monthly` ($2.99) and `pro_yearly` ($24); default Customer Portal (email/address,
      cards, invoices, cancel at period end with survey, switch between both prices, prorate
      and invoice immediately, yearly->monthly at period end); webhook endpoint
      `setups-bike-live` (same URL, same 6 events, API 2026-10-28.endive).
- [x] Create the Pro product and prices (lookup keys `pro_monthly`, `pro_yearly`), the
      Customer Portal configuration (plan switches use **`always_invoice`**, so an upgrade is
      charged right away; `create_prorations` deferred the difference to the next renewal, as
      found in testing 2026-11-17), and the webhook endpoint again in live mode, then put
      the live `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the three Lambdas.
      Use a **restricted** key: Checkout Sessions write, Customer portal write, Customers
      read, Prices read, Subscriptions read (the only calls the code makes). Done 2026-11-19:
      restricted live key in all three Lambdas and the live webhook secret in stripeWebhook,
      checked by prefix; a real $2.99 purchase and cancel went through the live webhook.

- [x] **Stale test-mode Stripe ids** (only user 1 has any). Done 2026-11-18: createCheckoutSession
      and createPortalSession now check the stored customer still exists in the current mode;
      if not, checkout starts fresh with the user's email, the portal says "No subscription to
      manage yet", and the stale ids are cleared. Nothing to do by hand at go-live.

**Done when:** in Stripe test mode, a test card upgrades an account, a 4th bike can be added,
cancelling in the portal reverts to Free at period end, and a failed renewal is handled.
Then switch to live keys.

**Test results (sandbox, 2026-11-17/18), all passing:** checkout → Pro; more than 3 bikes
on Pro; monthly → yearly charges $21.01 at once; immediate cancel → Free; failed renewal
(test clock + declining card) → Pro past due with the "update your card" warning, then Free
after 2 weeks of retries; cancel in the portal → "Pro until" period end, no renewal charge,
then Free. Notes: in flexible billing mode a portal cancel sets `cancel_at` rather than
`cancel_at_period_end` (the webhook handles both); events can arrive out of order (handled by
re-reading the subscription); an event for an old subscription is ignored.

## Phase 2: Pro features (one release each, before the Pro launch)

Built and tested with Pro switched on only for Grant. Each feature checks Pro **in its Lambda**
(the same `plan = 'pro'` and `BILLING_ENABLED_FOR` rules as addBike), so it stays invisible
and unusable for everyone else until launch.

### 2.1 Multiple setups per bike: ✅ live 2026-11-18 (Grant only while billing is off for others)
Named presets per bike, such as "Bike park", "XC" or "Wet".
- `003_bike_setups.sql`: a `bike_setup` table (id, bike_id, name, all the suspension and tire
  columns, created_at).
- Today's settings on the `bike` row stay the **active** setup, so Free users and the current
  screens don't change. Saving a preset copies the bike's settings into `bike_setup`.
  Switching copies a preset back onto the bike.
- UI: a setup picker on each bike card, with "Save as new setup", rename and delete.
- Lambdas: list, save, apply, rename and delete setups, all checking ownership and Pro.
- **Names and settings are always the user's own** (decided 2026-11-18). "Save as new setup"
  snapshots the bike's current settings under any name the user types. A few optional name
  chips ("Trail", "Bike park", "XC", "Wet", "Race") just fill in the name box; they never
  carry settings. The app never suggests values.
- Design (agreed 2026-11-18): the bike row stays the current setup; `bike.active_setup_id`
  records which preset is applied; the picker shows "(edited)" when the bike no longer
  matches it (compared in the app); switching with unsaved changes asks first; presets
  cascade-delete with their bike; one Lambda `SetupsDotBike_bikeSetups` behind one route; if
  Pro lapses, presets are hidden, not deleted.

### 2.2 Ride notes: ✅ built 2026-11-18
Log how a setup rode: date, trail, conditions, a 1–5 rating, and free text.
- `004_ride_notes_and_shares.sql` (shared with 2.3): a `ride_note` table (id, bike_id, settings
  snapshot as `jsonb`, setup name if the bike matched one, ride date, trail, conditions, rating,
  note). The snapshot never changes, even when a note is edited.
- Lambda `SetupsDotBike_rideNotes` at `POST /rideNotes`: list, add, edit, delete, reuse. Pro only.
- UI: "Log ride", "Rides" (history, newest first, with each ride's settings) and "Use these
  settings again" on the bike card.
- Decisions (2026-11-18): conditions are one-tap chips (Dry, Tacky, Wet, Muddy, Loose,
  Snow/ice); every field is optional but a note needs at least one of trail, rating, conditions
  or text; up to 500 notes per bike; reusing a ride's settings asks first.

### 2.3 Share a setup: ✅ built 2026-11-18
- `shared_setup` table in migration 004: a random 16-character id (96 bits), owner, bike,
  brand/model, setup name, settings snapshot, view and copy counts, created_at, revoked_at.
- Lambda `SetupsDotBike_sharedSetups` at `POST /sharedSetups`: view (no sign-in), create (Pro),
  list and revoke (signed in, no Pro needed), copy (signed in; free plan's bike limit applies).
- Links are `setups.bike/?s=<id>` (decided 2026-11-18): works on S3 as-is, with no error-page
  or Cloudflare rule. A `/s/<id>` path can be added later if wanted.
- The public page shows brand, model, setup name and settings only, never the owner's name or
  email, plus a note that it's another rider's setup, not a recommendation.
- Sharing the same settings again returns the same link. Links survive a Pro lapse, and the
  Share button stays visible while a bike has links so they can always be removed. Links are
  deleted with their bike. Up to 100 active links per user.

### 2.4 Suggested starting settings (deferred, not part of the Pro launch)
**Deferred 2026-11-18:** without real data this is a guess, and Grant doesn't want the app (or
himself) to be blamed for a crash on a suggested setup. Pro launches with 2.1–2.3 only.
Revisit once there's enough anonymous, aggregated setup data from real users to show what
riders actually run (for example, "riders on this fork at your weight typically run X–Y psi"),
always framed as what others use rather than a recommendation, and after a legal review of
the wording. The notes below are kept for then.

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

Icons, manifest and link previews done 2026-11-18. Icons and the preview image come from
`scripts/make-icons.py` (Pillow), which builds them from `public/img/logos/Setups.png`; re-run it
after a logo or tagline change. There's no service worker yet.
- [x] Manifest: the name "Setups.Bike", icons (192, 512 and a maskable one) made from
      `public/img/logos`, theme and splash colour `#daa520` (the header gold), `start_url` `/`.
- [x] Head tags: real title and description, `theme-color`, home-screen app tags for iOS and
      Android, a 180px `apple-touch-icon` and a new favicon.
- [x] Link previews: Open Graph and Twitter card tags with a generated 1200x630
      `og-image.png` (logo tile on gold plus a tagline). The site is static, so every link,
      shared setups included, gets the same preview; per-setup previews would need a server
      (for example a Lambda@Edge or Cloudflare Worker that fills in the tags).
- [x] Service worker: cache the app shell (HTML, JS, CSS, images) so it opens fast and offline.
      **Never cache API responses**, so data is always fresh.
- [x] iOS: `apple-touch-icon` at the right size, the status bar style, and a splash colour.
- [x] An "Install app" prompt on Android and Chrome, and short "Add to Home Screen" help for iOS.
- [x] Check with Lighthouse's PWA audit. Done 2026-11-19 with Lighthouse 9 (v12 dropped the PWA
      category): PWA, accessibility and SEO 100; performance 37 -> 81 after replacing
      react-loader-spinner (local production build, simulated slow phone).
- Service worker notes: `src/service-worker.ts` precaches the app shell and same-origin images,
  never the API; updates wait for "A new version is ready · Reload"; `service-worker.js` and
  `manifest.json` are uploaded with no-cache (buildspec).

## Phase 3.5: Partner referrals and promo codes (after the Pro launch, web first)

Idea (2026-11-18): local pros, influencers and shops get their own code or link. A new
subscriber gets a discount, and the partner gets a finder's fee on what that subscriber pays.

**How it works on the web (Stripe; most of the pieces exist)**
- Each partner gets a Stripe **promotion code** (for example `SHOPNAME20`) on a shared coupon,
  such as 20% off the first 3 months or the first year. Checkout already has
  `allow_promotion_codes: true`, so typed codes already work.
- **Referral links** `setups.bike/?ref=SHOPNAME`: the app remembers the code (localStorage,
  about 30 days) and `createCheckoutSession` pre-applies that partner's promotion code, so
  link and code both lead to the same attribution. The share-preview Worker can give these
  links a partner-branded preview.
- **Attribution:** on `checkout.session.completed` the webhook reads which promotion code was
  used and records the partner on the user (first partner wins; it's never changed later).
- **Earnings ledger:** the webhook already receives `invoice.*` events. On each paid invoice
  for an attributed user, add a row to a `partner_earning` table (invoice, amount actually
  paid after the discount, fee %, fee owed). Refunds and chargebacks add a negative row.
- **New tables (migration 005):** `partner` (name, code, Stripe promotion code id, fee %,
  fee months, active, contact), `app_user.referred_by_partner_id` + `referred_at`,
  `partner_earning` (ledger, paid-out flag).
- **Partner view:** start with a monthly CSV/report Grant sends each partner (sign-ups, paid
  subscribers, fees). A self-serve partner dashboard can come later.

**Paying the finder's fee**
- **Start manual:** once a month, pay what's owed for invoices older than the refund window
  (14 days, plus a buffer for chargebacks) by PayPal, Venmo or check. Cheapest and simplest
  for a handful of partners.
- **Later, Stripe Connect (Express):** partners onboard with Stripe, which handles their
  identity, bank details and US tax forms, and payouts become automatic transfers. It costs
  about $2 per active partner per month plus a small per-payout fee, so it's worth it once
  there are more than a few partners.
- Off-the-shelf affiliate tools that plug into Stripe (Rewardful, FirstPromoter and similar)
  are an option too, but run about $49+/month.

**Before launching it (not legal or tax advice; check these)**
- A short **partner agreement**: the fee %, how long fees last (for example the first 12
  months of each subscriber), payout timing, clawback on refunds, and that partners must
  disclose the relationship (US FTC rules for endorsements).
- **Taxes:** paying a US partner $600+ in a year generally means collecting a W-9 and filing
  a 1099-NEC. Stripe Connect handles that; with manual payouts you'd track it yourself.
- Add a line about promotions and discounts to the Terms.

**App stores (Phase 4) caveats**
- Stripe codes and coupons don't apply to Apple or Google in-app purchases.
- **Apple** has its own **Offer Codes** for subscriptions, including custom codes like
  `SHOPNAME20` with redemption limits, and its server notifications say which offer was used,
  so attribution is possible. Apple still takes its cut, and the finder's fee would be paid by
  you outside Apple.
- **Google Play** has subscription promo codes and developer-defined offers, with similar
  attribution through its real-time notifications.
- **Simplest plan:** keep referrals on the web. A subscriber who signs up through a partner's
  link pays through Stripe, and Pro works in the apps too because Pro belongs to the account
  (`plan_source`), not to where it was bought. Store rules on linking from the app to web
  checkout have been changing (US apps may link out as of 2025), so check them in Phase 4.

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
1. ~~Whether Claude may create Lambdas~~ Decided 2026-11-17: option (a), the shared
   `setupsbike-lambda-role`.
2. Whether to keep using the `test` API Gateway stage for production, or add a `prod` stage.
   For now production runs on `test`; a `prod` stage would mean updating the app's API URL
   and the Stripe webhook URL together.
3. ~~A support email address and who writes the legal pages~~ Decided 2026-11-17:
   `grant@hiregrant.today` (set in `legal/site.config.json`); pages drafted, still worth a
   professional review (board card "Waiting on Grant").
4. Partner referrals (Phase 3.5): discount size and length, finder's fee % and how long it lasts, and manual payouts versus Stripe Connect.

## Done so far (Nov 2026)
- Database moved to Neon. Parameterized SQL in every Lambda.
- Sign-in verified with Google, a rotated JWT secret, 7-day tokens, and ownership checks on
  every function.
- Reorder is about 8× faster. Sessions survive a page refresh.
- Lambda source is in `lambdas/`, with a README for deploying.
- Pro plan with Stripe: built, tested in the sandbox, then launched live 2026-11-19 for everyone.
- Pro features: saved setups, ride notes and setup sharing (with per-link previews).
- PWA: icons, manifest, offline app shell, update notice, install option; Lighthouse PWA,
  accessibility and SEO 100, performance 76 on the live site.
- Batched saves, readable gold colors, dark mode, and one dialog style for every modal.
- Living docs: `docs/DATABASE.md` (generated diagram) and `docs/STYLE_GUIDE.md`.
- Progress board: GitHub Project "Setups.Bike" (private).
