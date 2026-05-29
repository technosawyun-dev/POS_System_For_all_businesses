import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})


const TOKEN_KEY = 'nexuspos_access_token'
const REFRESH_KEY = 'nexuspos_refresh_token'

export const tokenStorage = {
  getAccess:    ()            => localStorage.getItem(TOKEN_KEY),
  getRefresh:   ()            => localStorage.getItem(REFRESH_KEY),
  setAccess:    (t: string)   => localStorage.setItem(TOKEN_KEY, t),
  setRefresh:   (t: string)   => localStorage.setItem(REFRESH_KEY, t),
  setTokens:    (a: string, r: string) => {
    localStorage.setItem(TOKEN_KEY, a)
    localStorage.setItem(REFRESH_KEY, r)
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
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
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (err.response?.status === 402) {
      // Subscription expired or suspended — redirect to the expired wall
      const code = (err.response?.data as any)?.error?.code
      if (code === 'SUBSCRIPTION_EXPIRED' || code === 'SUBSCRIPTION_SUSPENDED') {
        window.location.replace('/trial-expired')
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

      const refreshToken = tokenStorage.getRefresh()

      if (!refreshToken) {
        tokenStorage.clear()
        window.location.href = '/login'
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
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        tokenStorage.setTokens(data.access_token, data.refresh_token)
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
