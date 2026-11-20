import { readSignupSource } from './signupSource';

test('reads utm tags and ref from a campaign link', () => {
  expect(readSignupSource('?utm_source=sticker&utm_medium=qr&utm_campaign=trailhead&ref=SHOP20')).toEqual({
    utm_source: 'sticker', utm_medium: 'qr', utm_campaign: 'trailhead', ref: 'SHOP20',
  });
});

test('no tags means nothing to save', () => {
  expect(readSignupSource('')).toEqual({});
  expect(readSignupSource('?checkout=success')).toEqual({});
});

test('a shared-setup link with no utm_source counts as "share"', () => {
  expect(readSignupSource('?s=nfhj8Tr5TYMgggeM').utm_source).toBe('share');
  // an explicit campaign wins over the share link
  expect(readSignupSource('?s=nfhj8Tr5TYMgggeM&utm_source=reddit').utm_source).toBe('reddit');
});

test('drops anything that is not a short plain tag', () => {
  const s = readSignupSource(`?utm_source=${encodeURIComponent('<script>')}&utm_medium=${'x'.repeat(65)}&utm_campaign=ok-1.2_~`);
  expect(s.utm_source).toBeUndefined();
  expect(s.utm_medium).toBeUndefined();
  expect(s.utm_campaign).toBe('ok-1.2_~');
});
