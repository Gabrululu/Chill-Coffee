// Keep origin resolution static so metadata does not turn every route dynamic.
export function siteUrl(env: Record<string,string|undefined> = process.env): URL {
  const configured = env.SITE_URL || env.NEXT_PUBLIC_SITE_URL;
  const origin = configured || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : env.VERCEL_URL ? `https://${env.VERCEL_URL}` : env.NODE_ENV === 'production' ? 'https://chill-cafe.mintedinpe.workers.dev' : env.CODESPACE_NAME && env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ? `https://${env.CODESPACE_NAME}-3000.${env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}` : 'http://localhost:3000');
  const url = new URL(origin);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('SITE_URL must be the public HTTP(S) origin without credentials.');
  return new URL(url.origin);
}
