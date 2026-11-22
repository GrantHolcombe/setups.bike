// Sign-in providers. Each one is a small module:
//
//   name                      matches auth_identity.provider (google | email | apple)
//   verify(credential)        checks what the app sent and returns the person, or null if it can't
//                             be verified:
//                               { subject,   the provider's stable id for the person
//                                 email,     an address the provider has VERIFIED (required: it's
//                                            how a new method links to an existing account)
//                                 firstName, lastName }   (may be "")
//   onAccountDeleted(identity) optional cleanup when an account is deleted (card "Sign-in 4"),
//                             e.g. revoking Apple's token. Not called yet.
//
// The account matching, linking and the app token live in ../index.js and are shared by all of
// them, so adding a provider is a new module here plus its env vars.
//
// Planned:
//   email  one-time code sent through Resend (card "Sign-in 2")
//   apple  Sign in with Apple, once there's an Apple Developer account (card "Sign-in 3"); the
//          database already allows provider = 'apple'.

const providers = {
  google: require("./google")
};

module.exports = (name) => (Object.prototype.hasOwnProperty.call(providers, name) ? providers[name] : null);
