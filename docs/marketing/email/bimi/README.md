# BIMI: the Setups.Bike logo in inboxes

Board card: "Configure app logo for BIMI in resend" (Marketing). The full plan is on the card.
Source: Resend's guide, https://resend.com/docs/dashboard/domains/bimi

## Logo file

[setups-bike-bimi.svg](setups-bike-bimi.svg) is made by [make_bimi_svg.py](make_bimi_svg.py),
which traces `public/logo512.png` (Grant's original design):

- SVG Tiny P/S (`version="1.2"`, `baseProfile="tiny-ps"`), with a `<title>`, a square 512
  viewBox, a solid red background, and the white mark as one path. No scripts, images or
  links. 9.6 KB (the limit is 32 KB).
- The mark is at 90% size, so it stays inside the circular crop some inboxes use.
- Checked 2026-11-23 against those rules and by eye next to the PNG. Before publishing, also
  run it through the BIMI group's checker (https://bimigroup.org/bimi-generator/).
- If an original vector file of the logo turns up, use it instead of the trace.

## Steps

1. **Host the SVG over HTTPS**, e.g. `https://setups.bike/bimi/logo.svg`. That's a file in
   `public/`, so it's dev session work and ships with a deploy.
2. **BIMI record (DNS, Cloudflare):** TXT `default._bimi.mail.setups.bike` =
   `v=BIMI1; l=https://setups.bike/bimi/logo.svg;` (add `a=<certificate .pem URL>` once there
   is a certificate). Harmless before DMARC is tightened.
3. **DMARC `p=quarantine; pct=100`** on both `setups.bike` and `mail.setups.bike`, after the
   DMARC review (card, around 2026-12-06). Yahoo can then show the logo.
4. **Later, when revenue covers it:** a CMC certificate (DigiCert, GlobalSign or SSL.com) for
   Gmail. Proof of more than a year of public use: the logo has been in the repo since
   2024-07-20, and the Wayback Machine has setups.bike from 2024-10-12. Issuers also want
   public proof the business exists (for example a Google Business Profile). Apple Mail needs a
   VMC, which needs a registered trademark.
