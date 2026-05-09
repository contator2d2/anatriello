const ENV_API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const isBrowser = typeof window !== 'undefined';
const isLocalhost = isBrowser && ['localhost', '127.0.0.1'].includes(window.location.hostname);

const normalizeEndpoint = (endpoint: string) => {
  if (endpoint === '/api/rh/pdvs') return '/api/promotor/rh/pdvs';
  return endpoint;
};

const getBaseCandidates = (endpoint: string) => {
  const sameOriginBase = '';
  const supportsSameOrigin = endpoint.startsWith('/api/') || endpoint.startsWith('/uploads/');
  const shouldPreferSameOrigin = isBrowser && !isLocalhost && supportsSameOrigin;

  const ordered = shouldPreferSameOrigin
    ? [sameOriginBase, ENV_API_URL]
    : [ENV_API_URL, sameOriginBase];

  return [...new Set(ordered.filter((base) => base !== undefined && base !== null))];
};

const buildUrl = (base: string, endpoint: string) =>
  base ? `${base}${endpoint}` : endpoint;

export const API_URL = ENV_API_URL;
export const AUTH_INVALID_EVENT = 'app-auth-invalid';

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const MAX_GET_RETRIES = 2;
const ERROR_LOG_COOLDOWN_MS = 15000;
const AUTH_EVENT_COOLDOWN_MS = 3000;
const lastErrorLogByKey = new Map<string, number>();
let lastAuthEventAt = 0;
const LIVE_ROUTES_ENDPOINT = '/api/merch/routes/live';
const LIVE_ROUTES_COOLDOWN_MS = 10 * 60 * 1000;
const CHAT_UNREAD_ENDPOINT = '/api/chat/conversations/unread';
const CHAT_ALERTS_ENDPOINT = '/api/chat/alerts';
const CHAT_POLLING_COOLDOWN_MS = 60 * 1000;

interface EndpointResilienceConfig {
  cooldownMs: number;
  fallbackToOtherBases: boolean;
  fallbackValue: () => unknown;
  maxRetries?: number;
  silent?: boolean;
}

const ENDPOINT_RESILIENCE: Partial<Record<string, EndpointResilienceConfig>> = {
  [LIVE_ROUTES_ENDPOINT]: {
    cooldownMs: LIVE_ROUTES_COOLDOWN_MS,
    fallbackToOtherBases: false,
    fallbackValue: () => [],
    silent: true,
  },
  [CHAT_UNREAD_ENDPOINT]: {
    cooldownMs: CHAT_POLLING_COOLDOWN_MS,
    fallbackToOtherBases: false,
    fallbackValue: () => [],
    maxRetries: 0,
    silent: true,
  },
  [CHAT_ALERTS_ENDPOINT]: {
    cooldownMs: CHAT_POLLING_COOLDOWN_MS,
    fallbackToOtherBases: false,
    fallbackValue: () => [],
    maxRetries: 0,
    silent: true,
  },
  ['/api/merchandising/networks']: {
    cooldownMs: 60000,
    fallbackToOtherBases: false,
    fallbackValue: () => [],
    silent: true,
  },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getEndpointCooldownKey = (endpoint: string) => `api-cooldown:${endpoint}`;

const getEndpointCooldownUntil = (endpoint: string) => {
  if (!isBrowser) return 0;
  const raw = window.sessionStorage.getItem(getEndpointCooldownKey(endpoint));
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const setEndpointCooldown = (endpoint: string, ms: number) => {
  if (!isBrowser) return;
  window.sessionStorage.setItem(getEndpointCooldownKey(endpoint), String(Date.now() + ms));
};

const isEndpointOnCooldown = (endpoint: string) => getEndpointCooldownUntil(endpoint) > Date.now();

const shouldRetry = (method: string, status?: number) => {
  if (method !== 'GET') return false;
  if (!status) return true;
  return RETRYABLE_STATUS.has(status);
};

const shouldLogNow = (key: string) => {
  const now = Date.now();
  const last = lastErrorLogByKey.get(key) || 0;
  if (now - last < ERROR_LOG_COOLDOWN_MS) return false;
  lastErrorLogByKey.set(key, now);
  return true;
};

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
  silent?: boolean;
  fallbackToOtherBases?: boolean;
}

const getScopedAuthToken = (endpoint: string) => {
  if (!isBrowser) return null;

  if (endpoint.startsWith('/api/access-control/agency')) {
    return localStorage.getItem('agency_auth_token') || localStorage.getItem('auth_token');
  }

  if (endpoint.startsWith('/api/access-control/supermarket')) {
    return localStorage.getItem('supermarket_auth_token') || localStorage.getItem('auth_token');
  }

  if (endpoint.startsWith('/api/promotor')) {
    return localStorage.getItem('promotor_token') || localStorage.getItem('auth_token');
  }

  return localStorage.getItem('auth_token');
};

const clearScopedAuthTokens = () => {
  if (!isBrowser) return;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('agency_auth_token');
  localStorage.removeItem('supermarket_auth_token');
  localStorage.removeItem('promotor_token');
  window.sessionStorage.removeItem('user_org_id');
};

const notifyAuthInvalid = () => {
  if (!isBrowser) return;
  const now = Date.now();
  if (now - lastAuthEventAt < AUTH_EVENT_COOLDOWN_MS) return;
  lastAuthEventAt = now;
  clearScopedAuthTokens();
  window.dispatchEvent(new CustomEvent(AUTH_INVALID_EVENT));
};

export const api = async <T>(endpoint: string, options: ApiOptions = {}): Promise<T> => {
  const { method = 'GET', body, auth = true, headers: customHeaders, silent = false, fallbackToOtherBases = true } = options;
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  const endpointResilience = ENDPOINT_RESILIENCE[normalizedEndpoint];
  const effectiveSilent = silent || endpointResilience?.silent === true;
  const effectiveFallbackToOtherBases = endpointResilience?.fallbackToOtherBases ?? fallbackToOtherBases;

  if (endpointResilience && isEndpointOnCooldown(normalizedEndpoint)) {
    return endpointResilience.fallbackValue() as T;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth && !customHeaders?.Authorization) {
    const token = getScopedAuthToken(normalizedEndpoint);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  if (customHeaders) {
    Object.assign(headers, customHeaders);
  }

  const baseCandidates = getBaseCandidates(normalizedEndpoint);
  const retries = method === 'GET' ? endpointResilience?.maxRetries ?? MAX_GET_RETRIES : 0;
  let lastError: Error | null = null;

  for (let baseIndex = 0; baseIndex < baseCandidates.length; baseIndex++) {
    const base = baseCandidates[baseIndex];
    const url = buildUrl(base, normalizedEndpoint);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        const contentType = response.headers.get('content-type') || '';
        let data: any = null;

        // Read body as text first for safer parsing
        const rawText = await response.text().catch(() => '');

        if (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
          try {
            data = JSON.parse(rawText);
          } catch {
            data = { raw: rawText };
          }
        } else {
          if (!effectiveSilent && (rawText.trim().startsWith('<!') || rawText.includes('<html')) && shouldLogNow(`html:${url}:${response.status}`)) {
            // eslint-disable-next-line no-console
            console.error('[api] Got HTML instead of JSON', {
              url,
              status: response.status,
              preview: rawText.substring(0, 300),
            });
          }
          data = { raw: rawText };
        }

        if (!response.ok) {
          if (response.status === 401 && auth) {
            notifyAuthInvalid();
          }

          if (endpointResilience && response.status >= 500) {
            setEndpointCooldown(normalizedEndpoint, endpointResilience.cooldownMs);
            return endpointResilience.fallbackValue() as T;
          }

          if (attempt < retries && shouldRetry(method, response.status)) {
            await sleep(250 * Math.pow(2, attempt));
            continue;
          }

          const baseMsg = data?.error || data?.message || `Erro na requisição (${response.status})`;
          const detailValue = data?.details || data?.detail || '';
          const details = detailValue ? `: ${detailValue}` : '';
          const logKey = `fail:${url}:${response.status}`;
          if (!effectiveSilent && shouldLogNow(logKey)) {
            // eslint-disable-next-line no-console
            console.error('[api] request failed', {
              url,
              status: response.status,
              contentType,
              body,
              response: data,
            });
          }

          // Fallback para same-origin somente em GET, evitando duplicidade em mutações
          const shouldTryNextBase = effectiveFallbackToOtherBases && method === 'GET' && baseIndex < baseCandidates.length - 1 && (
            response.status >= 500 ||
            (base === '' && response.status === 404) ||
            (base === '' && typeof data?.raw === 'string' && (data.raw.trim().startsWith('<!') || data.raw.includes('<html')))
          );
          if (shouldTryNextBase) {
            lastError = new Error(`${baseMsg}${details}`);
            break;
          }

          const requestError = new Error(`${baseMsg}${details}`) as Error & {
            status?: number;
            response?: unknown;
            url?: string;
          };
          requestError.status = response.status;
          requestError.response = data;
          requestError.url = url;
          throw requestError;
        }

        return data as T;
      } catch (error: any) {
        if (typeof error?.status === 'number') {
          if (error.status === 401 && auth) {
            notifyAuthInvalid();
          }
          throw error;
        }

        if (endpointResilience) {
          setEndpointCooldown(normalizedEndpoint, endpointResilience.cooldownMs);
          return endpointResilience.fallbackValue() as T;
        }

        const canRetry = attempt < retries && shouldRetry(method);
        if (canRetry) {
          await sleep(250 * Math.pow(2, attempt));
          continue;
        }

        if (!effectiveSilent && shouldLogNow(`network:${url}`)) {
          // eslint-disable-next-line no-console
          console.error('[api] network failure', {
            url,
            method,
            message: error?.message || 'Erro de rede',
          });
        }

        const shouldTryNextBase = effectiveFallbackToOtherBases && method === 'GET' && baseIndex < baseCandidates.length - 1;
        if (shouldTryNextBase) {
          lastError = error instanceof Error ? error : new Error('Erro de rede');
          break;
        }

        throw error;
      }
    }
  }

  if (lastError) throw lastError;
  throw new Error('Falha inesperada na requisição');
};

// Auth helpers
export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: { id: string; email: string; name: string }; token: string }>(
      '/api/auth/login',
      { method: 'POST', body: { email, password }, auth: false }
    ),

  register: (email: string, password: string, name: string, plan_id?: string) =>
    api<{ user: { id: string; email: string; name: string }; token: string }>(
      '/api/auth/register',
      { method: 'POST', body: { email, password, name, plan_id }, auth: false }
    ),

  getMe: () =>
    api<{ user: { id: string; email: string; name: string } }>('/api/auth/me'),

  getSignupPlans: () =>
    api<Array<{
      id: string;
      name: string;
      description: string | null;
      max_connections: number;
      max_monthly_messages: number;
      max_users: number;
      price: number;
      billing_period: string;
      trial_days: number;
      has_chat: boolean;
      has_campaigns: boolean;
      has_asaas_integration: boolean;
    }>>('/api/auth/plans', { auth: false }),
};

export const setAuthToken = (token: string) => {
  localStorage.setItem('auth_token', token);
};

export const clearAuthToken = () => {
  localStorage.removeItem('auth_token');
};

export const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};
