# Email: Pro launch announcement (draft)

Board card: "Email blasts: provider setup and Pro announcement". **Draft: not sent.** Grant
reviews and approves before anything goes out through Resend.

- **To:** existing users (only those allowed by the Dev card "Email list: marketing consent,
  unsubscribe sync, export"). Test send to Grant's own accounts first.
- **From:** Grant at Setups.Bike, e.g. `grant@mail.setups.bike` (once the Resend domain is
  verified). A real person's name, and replies go to a real inbox.
- **Links:** every link is tagged `?utm_source=email&utm_medium=email&utm_campaign=pro-launch`
  so sign-ups show in the weekly numbers.

## Subject line (pick one)

1. **New in Setups.Bike: saved setups, ride notes and share links**: plain, says what's new.
2. **Your bikes just got a quiver of setups**: on-brand pun, a little vaguer.
3. **Dry, wet, bike park: save a setup for each**: leads with the most useful feature.

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
> All trail's end,
> Grant
> Setups.Bike

## Footer (required)

> You're getting this because you have a Setups.Bike account.
> [Unsubscribe]({{{RESEND_UNSUBSCRIBE_URL}}}) · Setups.Bike, [postal address]

- **Unsubscribe:** Resend's unsubscribe placeholder for broadcasts (check the exact tag in
  Resend when setting up the broadcast).
- **Postal address:** required for US commercial email (CAN-SPAM). A PO box or virtual mailbox
  works if Grant would rather not use his home address. **Fill in before sending.**

## Checks before sending

- [ ] Prices and plan details match the live app ($2.99/month, $24/year, Free = 3 bikes).
- [ ] "Go Pro" is the button's real name in the app, and the link lands somewhere sensible
      for a signed-out reader (the landing page).
- [ ] Nothing implies the app recommends settings (it doesn't).
- [ ] No user counts or claims we can't back up.
- [ ] Unsubscribe works and turns the database flag off (Dev card).
- [ ] Postal address filled in.
- [ ] Test send looks right on a phone, in light and dark mode.
- [ ] Grant's clear yes to send.
