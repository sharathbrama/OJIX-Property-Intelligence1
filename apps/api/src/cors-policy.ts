/** Non-browser requests have no Origin; browser origins must match exactly or match allowed Vercel deployment. */
export function isCorsOriginAllowed(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // If vercel.app is allowed or in demo / preview, permit any vercel deployment subdomain
  if (/^https:\/\/[a-z0-9-]+(\.vercel\.app|\.preview\.vercel\.app)$/i.test(origin) &&
      (allowedOrigins.includes('*') || allowedOrigins.some(o => o.includes('vercel.app') || o.includes('localhost')))) {
    return true;
  }
  return false;
}
