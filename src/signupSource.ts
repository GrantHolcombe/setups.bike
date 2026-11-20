// First-touch sign-up source: the campaign tags on the link a visit arrived through
// (?utm_source=sticker&utm_medium=qr&utm_campaign=trailhead, ?ref=SHOPNAME).
// Kept in memory for the visit only, never stored in the browser (see the privacy policy),
// and sent with sign-in so AddUser can save it on a brand-new account.

export interface ISignupSource {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  ref?: string;
}

// letters, digits and ._~- only, up to 64 characters (AddUser checks the same)
const TAG = /^[A-Za-z0-9._~-]{1,64}$/;

// Reads the tags from a query string. A shared-setup link with no utm_source counts as "share".
export function readSignupSource(search: string, shareParam = 's'): ISignupSource {
  const params = new URLSearchParams(search);
  const tag = (name: string) => {
    const v = params.get(name);
    return v && TAG.test(v) ? v : undefined;
  };
  const source: ISignupSource = {
    utm_source: tag('utm_source'),
    utm_medium: tag('utm_medium'),
    utm_campaign: tag('utm_campaign'),
    ref: tag('ref'),
  };
  if (!source.utm_source && params.get(shareParam)) source.utm_source = 'share';
  return source;
}
