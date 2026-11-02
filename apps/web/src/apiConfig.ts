export type ApiConfigResult = { baseUrl: string; error: string };

export function resolveApiConfig(value: string | undefined, production: boolean): ApiConfigResult {
  const baseUrl = (value || '').trim().replace(/\/+$/, '');
  if (!production) return { baseUrl, error: '' };
  if (!baseUrl) {
    return { baseUrl: '', error: 'The production API URL is not configured. Set VITE_API_URL in Vercel and redeploy.' };
  }
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return { baseUrl: '', error: 'The production API URL must be an HTTPS origin without a path, credentials or query parameters.' };
    }
    if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname.toLowerCase())) {
      return { baseUrl: '', error: 'The production API URL cannot point to localhost. Deploy the API to a public HTTPS host.' };
    }
    return { baseUrl, error: '' };
  } catch {
    return { baseUrl: '', error: 'The production API URL is invalid. Set VITE_API_URL to the API HTTPS origin.' };
  }
}

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env || {};
export const apiConfig = resolveApiConfig(String(viteEnv.VITE_API_URL || ''), Boolean(viteEnv.PROD));
export const API_BASE_URL = apiConfig.baseUrl;
