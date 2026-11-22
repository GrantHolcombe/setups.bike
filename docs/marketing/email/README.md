# Email

Marketing email goes out through Resend. Board card: "Email blasts: provider setup and Pro
announcement".

## Setup (2026-11-22)

- **Sending domain:** `mail.setups.bike`, verified (DKIM, SPF and CNAME records in Cloudflare,
  DNS only). It can only send.
- **From:** `Grant at Setups.Bike <grant@mail.setups.bike>`.
- **Reply-to:** `support@setups.bike`, which Cloudflare Email Routing forwards to Grant's inbox.
- **List:** the Resend segment "News and offers". The app's `marketing_emails` flag syncs to it,
  and unsubscribes, bounces and complaints flow back through the `resendWebhook` Lambda.
- **Tracking (on since 2026-11-22):** open tracking (a pixel) and click tracking (links go through
  `links.mail.setups.bike`, a CNAME to Resend in Cloudflare, DNS only). Per-recipient opens and
  clicks show on each broadcast in Resend. Opens are approximate: Apple Mail preloads images, and
  clients that block images hide real opens. The Privacy Policy describes it (live since 2026-11-22,
  https://setups.bike/privacy.html). The Pro launch email was sent before tracking was on.
- **Every send:** links tagged `?utm_source=email&utm_medium=email&utm_campaign=<name>`. Grant
  reviews a test send and gives a clear yes before anything goes to the list.
- **Sign-in in copy:** people can sign up with Google **or** their email (a 6-digit code), so
  never write "Google account required". The landing page says "Free. Sign in with Google or
  your email." Sign-in codes come from `signin@mail.setups.bike`, plain text, untracked.
- **Voice:** plain and factual by default. A pun only when it really fits, and never the same
  one twice.

## Before every broadcast

1. Send a test copy to Grant and check the message source (Gmail: Show original) for
   `dkim=pass`, `spf=pass` and `dmarc=pass`.
2. Grant reviews the test and gives a clear yes.
3. Any new service that sends as setups.bike (another email tool, a form provider) has to be
   added to SPF/DKIM first, or DMARC fails it. Tell the dev session before using it.
4. Report tracking as totals. Per-person opens and clicks stay in Resend.

DMARC: `_dmarc.setups.bike` is `p=none`, with reports in Cloudflare (setups.bike > Email > DMARC
Management). It covers `mail.setups.bike`. Board card "DMARC review: consider p=quarantine
(around 2026-12-06)".

## Base template: `setups-bike-base`

Published in Resend (alias `setups-bike-base`). The source is
[template-base.html](template-base.html). Fixed parts: the gold header (name left, logo right),
the red button, "Grant / Setups.Bike" under the sign-off, and the footer (Email preferences,
Resend's unsubscribe link, PO box). Each email fills in:

| Variable | What goes in it | Default |
|---|---|---|
| `BODY` | The message, as HTML (`<p>`, `<ul>`, `<strong>`) | "Hi there," |
| `CTA_TEXT` | Button text | Open Setups.Bike |
| `CTA_URL` | Button link, with utm tags | setups.bike with `utm_source=email` |
| `CTA_NOTE` | Small grey line under the button (optional) | empty |
| `CLOSING` | Line before the sign-off | "If something's missing or broken, just hit reply…" |
| `SIGN_OFF` | Sign-off line | "Thanks for your continued support," |

To change the shared look, edit `template-base.html`, update the template in Resend, and
re-publish it.

## Emails

- [pro-launch.md](pro-launch.md): Pro launch announcement, sent 2026-11-22 to 6 subscribed
  contacts (campaign `pro-launch`).
