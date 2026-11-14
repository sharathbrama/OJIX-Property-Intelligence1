// Same-origin requests are routed to Express by local proxies or Firebase Hosting.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '';
