const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type RequestConfig = {
  params?: Record<string, string | number | boolean | undefined>;
};

class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  method: string,
  url: string,
  body: unknown,
  config?: RequestConfig
): Promise<{ data: T }> {
  let fullUrl = BASE_URL + url;

  if (config?.params) {
    const qs = new URLSearchParams(
      Object.entries(config.params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    if (qs) fullUrl += '?' + qs;
  }

  const hasBody = body !== undefined && body !== null;

  const response = await fetch(fullUrl, {
    method,
    credentials: 'include',
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  // /api/auth/me returning 401 is expected when unauthenticated — don't redirect
  if (response.status === 401 && !url.includes('/api/auth/me')) {
    window.location.href = '/login';
    throw new ApiError('Unauthorized', 401, null);
  }

  let payload: unknown;
  const contentType = response.headers.get('content-type') ?? '';
  if (response.status !== 204 && contentType.includes('application/json')) {
    payload = await response.json();
  }

  if (!response.ok) {
    const msg =
      (payload as Record<string, string> | null)?.error ?? response.statusText;
    throw new ApiError(msg, response.status, payload);
  }

  return { data: payload as T };
}

const apiClient = {
  get:    <T = unknown>(url: string, config?: RequestConfig) =>
    request<T>('GET',    url, undefined, config),
  post:   <T = unknown>(url: string, body?: unknown, config?: RequestConfig) =>
    request<T>('POST',   url, body, config),
  put:    <T = unknown>(url: string, body?: unknown, config?: RequestConfig) =>
    request<T>('PUT',    url, body, config),
  delete: <T = unknown>(url: string, config?: RequestConfig) =>
    request<T>('DELETE', url, undefined, config),
};

export default apiClient;
