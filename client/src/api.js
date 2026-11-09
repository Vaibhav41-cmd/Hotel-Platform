const API_BASE = String(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const NO_AUTO_REFRESH = new Set(['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout']);
let currentAccessToken = '';
let refreshInFlight = null;
let accessTokenListener = () => {};

export function setAccessToken(token) {
  currentAccessToken = token || '';
  accessTokenListener(currentAccessToken);
}

export function subscribeAccessToken(listener) {
  accessTokenListener = listener;
  return () => { if (accessTokenListener === listener) accessTokenListener = () => {}; };
}

async function request(path, { token, method = 'GET', body, formData, signal } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    method,
    headers,
    credentials: 'include',
    body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
    signal,
  });
  const result = response.status === 204 ? {} : await response.json().catch(() => ({}));
  return { response, result };
}

function toApiError(result, response) {
  const error = new Error(result?.error?.message || 'Something went wrong. Please try again.');
  error.code = result?.error?.code;
  error.status = response.status;
  error.details = result?.error?.details;
  return error;
}

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = request('/auth/refresh', { method: 'POST' })
      .then(({ response, result }) => response.ok ? result.data : null)
      .catch(() => null)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function api(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const canRefresh = !NO_AUTO_REFRESH.has(normalizedPath);
  const token = NO_AUTO_REFRESH.has(normalizedPath) ? options.token : (currentAccessToken || options.token);
  let { response, result } = await request(normalizedPath, { ...options, token });
  if (response.status === 401 && token && canRefresh && !options._retried) {
    const session = await refreshAccessToken();
    if (session?.accessToken) {
      setAccessToken(session.accessToken);
      ({ response, result } = await request(normalizedPath, { ...options, token: session.accessToken, _retried: true }));
    } else {
      setAccessToken('');
    }
  }
  if (!response.ok) throw toApiError(result, response);
  return result.data;
}

export function assetUrl(path) {
  if (!path) return '/hotel-hero.jpg';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  // Site artwork is served by the frontend. Uploaded room/property images are API assets.
  if (path.startsWith('/api/uploads/') && API_BASE.startsWith('http')) {
    try { return new URL(path, new URL(API_BASE).origin).toString(); } catch { return path; }
  }
  return path;
}

export const API_ORIGIN = API_BASE.startsWith('http') ? new URL(API_BASE).origin : '';
