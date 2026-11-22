# Email: Pro launch announcement (draft)

Board card: "Email blasts: provider setup and Pro announcement". **Draft: not sent.** Grant
reviews and approves before anything goes out through Resend.

- **To:** the Resend segment "News and offers" (`536f03ac-fa68-49d6-90a8-36e6a7fd02fc`, set as
  `RESEND_SEGMENT_ID`). Per the dev session
  (2026-11-21), all 7 existing users have `marketing_emails` on (Grant's call: he knows them
  all). The e2e account is never synced. Unsubscribes, hard bounces and spam complaints turn
  the flag off through `/resendWebhook`. Test send to Grant's own address first.
- **From:** Grant at Setups.Bike, e.g. `grant@mail.setups.bike` (Resend domain `mail.setups.bike` added 2026-11-21, with its four DNS records in Cloudflare,
  DNS only). A real person's name, and replies go to a real inbox.
- **Links:** every link is tagged `?utm_source=email&utm_medium=email&utm_campaign=pro-launch`
  so sign-ups show in the weekly numbers.

## Subject line

**New in Setups.Bike: saved setups, ride notes and share links** (chosen 2026-11-21)

**Preview text** (the grey line after the subject): *Free stays free. Pro adds a few things
I kept wanting myself.*

## Body

> Hi there,
>
> Quick note from Grant, the rider and developer behind Setups.Bike. Thanks for keeping your
> tire pressure and suspension settings in the app.
>
> **Setups.Bike now has a Pro plan**, with three things I kept wanting on my own bikes:
>
> - **Saved setups per bike.** Keep "Dry", "Wet" and "Bike park" (or whatever you ride)
>   side by side, and switch in a tap instead of re-entering clicks.
> - **Ride notes.** Log the trail, conditions and how it rode, with a snapshot of that day's
>   settings, so you can see what worked last time.
> - **Share a setup.** Send a link to a riding buddy, group chat or forum. Anyone can view
>   it and copy it into their own garage.
>
> Pro also lifts the bike limit, so the whole quiver fits. It's **$2.99 a month or $24 a year**,
> and you can cancel any time.
>
> **Free isn't going anywhere.** Free still saves tire pressure, fork and shock settings,
> clicks and tokens for up to 3 bikes, with no card needed. If you already have more than 3
> bikes, you keep every one of them. You just can't add another on Free.
>
> **[Open Setups.Bike](https://setups.bike/?utm_source=email&utm_medium=email&utm_campaign=pro-launch)**
> and tap Go Pro to try it.
>
> I build this on my own, so if something's missing or broken, just hit reply. It comes
> straight to me.
>
> Thanks for your continued support,
> Grant
> Setups.Bike

## Footer (required)

> You're getting this because you have a Setups.Bike account. Change it any time in the app
> (bike menu > Email preferences) or [unsubscribe]({{{RESEND_UNSUBSCRIBE_URL}}}).
> Setups.Bike, 8030 La Mesa Blvd, Unit #3002, La Mesa, CA 91942

- **Unsubscribe:** `{{{RESEND_UNSUBSCRIBE_URL}}}` is Resend's broadcast placeholder (confirmed
  by the dev session). Resend's unsubscribe flows back to the database.
- **Postal address:** Grant's PO box (filled in 2026-11-21), required for US commercial email (CAN-SPAM).

## Checks before sending

Blocked until (from the dev session): Grant approves the app deploy with the email backend and
the Privacy Policy update; Grant creates the Resend account and domain and sets the three
Lambda environment variables in the console; the dev session runs `syncAll` to load the 7
contacts.

- [ ] Prices and plan details match the live app ($2.99/month, $24/year, Free = 3 bikes).
- [ ] "Go Pro" is the button's real name in the app, and the link lands somewhere sensible
      for a signed-out reader (the landing page).
- [ ] Nothing implies the app recommends settings (it doesn't).
- [ ] No user counts or claims we can't back up.
- [ ] Unsubscribe works and turns the database flag off (Dev card).
- [x] Postal address filled in.
- [ ] Test send looks right on a phone, in light and dark mode.
- [ ] Grant's clear yes to send.
