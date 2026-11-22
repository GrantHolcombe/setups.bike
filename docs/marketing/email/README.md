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
- **Every send:** links tagged `?utm_source=email&utm_medium=email&utm_campaign=<name>`. Grant
  reviews a test send and gives a clear yes before anything goes to the list.
- **Voice:** plain and factual by default. A pun only when it really fits, and never the same
  one twice.

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

- [pro-launch.md](pro-launch.md): Pro launch announcement (tested 2026-11-22, not yet sent to
  the list).
