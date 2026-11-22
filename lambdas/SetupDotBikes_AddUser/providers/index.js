// Sign-in providers. Each one is a small module:
//
//   name                      matches auth_identity.provider (google | email | apple)
//   verify(input, ctx)        checks what the app sent (input = the request's fields; ctx = { db, ip })
//                             and returns the person, or null if it can't be verified:
//                               { subject,   the provider's stable id for the person
//                                 email,     an address the provider has VERIFIED (required: it's
//                                            how a new method links to an existing account)
//                                 firstName, lastName }   (may be "")
//   requestCode(input, ctx)   optional, for methods that send something first (email): answers
//                             action "requestCode" with { status, body }
//   onAccountDeleted(identity) optional cleanup when an account is deleted (card "Sign-in 4"),
//                             e.g. revoking Apple's token. Not called yet.
//
// The account matching, linking and the app token live in ../index.js and are shared by all of
// them, so adding a provider is a new module here plus its env vars.
//
// Planned:
//   apple  Sign in with Apple, once there's an Apple Developer account (card "Sign-in 3"); the
//          database already allows provider = 'apple'.

const providers = {
  google: require("./google"),
  email: require("./email")
};

module.exports = (name) => (Object.prototype.hasOwnProperty.call(providers, name) ? providers[name] : null);
