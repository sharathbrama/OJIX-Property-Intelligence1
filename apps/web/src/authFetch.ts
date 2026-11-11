export function getAuthToken() {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem('ojix_auth_token');
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  const workspaceId=typeof localStorage==='undefined'?null:localStorage.getItem('ojix_workspace_id');
  if(token&&workspaceId&&!headers.has('X-OJIX-Workspace-Id'))headers.set('X-OJIX-Workspace-Id',workspaceId);
  return fetch(input, { ...init, headers });
}
