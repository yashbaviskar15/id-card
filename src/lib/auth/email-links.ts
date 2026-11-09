export function passwordResetRedirectUrl(siteUrl: string): string {
  const callback = new URL('/auth/callback', siteUrl);
  callback.searchParams.set('next', '/reset');
  return callback.toString();
}
