import { QueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'

function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = (error as AxiosError)?.response?.status
  // Never retry on 4xx — those are definitive (auth, validation, not found, rate limit).
  // Only retry on network errors (no response) or 5xx server errors.
  if (status && status >= 400 && status < 500) return false
  return failureCount < 2
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
})
