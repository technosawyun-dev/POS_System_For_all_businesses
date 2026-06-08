import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useUIStore } from '@/store/ui.store'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
  withCredentials: true,
})

// Sentinel error thrown when the offline gate blocks a write request.
// Components can check `err instanceof OfflineError` or `err.name === 'OfflineError'`.
export class OfflineError extends Error {
  constructor() {
    super('Server is offline. Please reconnect to make changes.')
    this.name = 'OfflineError'
  }
}

// Block all non-GET requests when the server is unreachable.
// GET requests pass through so React Query can still serve cached data.
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toLowerCase()
  if (method !== 'get' && !useUIStore.getState().isOnline) {
    return Promise.reject(new OfflineError())
  }
  return config
})


const TOKEN_KEY = 'nexuspos_access_token'

export const tokenStorage = {
  getAccess:  ()           => localStorage.getItem(TOKEN_KEY),
  setAccess:  (t: string)  => localStorage.setItem(TOKEN_KEY, t),
  setTokens:  (a: string)  => localStorage.setItem(TOKEN_KEY, a),
  clear:      ()           => localStorage.removeItem(TOKEN_KEY),
}


// Auth token injection
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})


let isRefreshing = false
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(p => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

// Token refresh on 401
apiClient.interceptors.response.use(
  res => res,
  async (err: AxiosError) => {
    // Non-axios errors (e.g. OfflineError from request interceptor) pass straight through.
    if (!axios.isAxiosError(err)) return Promise.reject(err)

    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (err.response?.status === 402) {
      const code = (err.response?.data as any)?.error?.code
      if (code === 'SUBSCRIPTION_EXPIRED' || code === 'SUBSCRIPTION_SUSPENDED') {
        // Signal the in-app upgrade gate instead of hard-redirecting
        const { markExpired } = (await import('@/store/subscription.store')).useSubscriptionStore.getState()
        markExpired()
      }
      return Promise.reject(err)
    }

    if (err.response?.status === 403) {
      const code = (err.response?.data as any)?.error?.code
      const url  = (err.config?.url ?? '')
      const method = (err.config?.method ?? '').toLowerCase()

      // Don't hard-redirect for background infrastructure reads that may return 403
      // for lower-privilege roles. GET /tenants/{uuid} and /tenants/{uuid}/settings
      // are needed by every page layout and the POS checkout flow (tax/payment config).
      const isSilentEndpoint =
        code === 'FEATURE_DISABLED' ||
        (method === 'get' && /^\/tenants\/[0-9a-f-]{36}(\/settings)?$/.test(url))

      if (!isSilentEndpoint) {
        window.location.replace('/unauthorized')
      }
      return Promise.reject(err)
    }

    if (err.response?.status === 401 && !original._retry) {
      // Never intercept 401 from the login endpoint itself — the auth store
      // handles that error and shows it to the user. Intercepting it here
      // causes a hard page reload that wipes the error before it can render.
      const url = original.url ?? ''
      if (url.includes('/auth/login')) {
        return Promise.reject(err)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`
          return apiClient(original)
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        // The refresh token travels as an httponly cookie automatically
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
        tokenStorage.setTokens(data.access_token)
        processQueue(null, data.access_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return apiClient(original)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        tokenStorage.clear()
        window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(err)
  },
)

export default apiClient
