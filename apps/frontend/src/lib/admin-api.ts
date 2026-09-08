import { getClientApiUrl } from './site-config';

export async function adminApiFetch<T = any>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<{ success: boolean; data?: T; error?: string; statusCode?: number }> {
  const apiBase = getClientApiUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('admin_access_token') : null);
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const res = await fetch(`${apiBase}${path.startsWith('/') ? path : `/${path}`}`, {
      ...options,
      headers,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: json.message || json.error || `HTTP error ${res.status}`,
        statusCode: res.status,
      };
    }

    return {
      success: true,
      data: json.data !== undefined ? json.data : json,
      statusCode: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error connecting to API',
      statusCode: 500,
    };
  }
}
