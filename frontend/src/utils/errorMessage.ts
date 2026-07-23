export interface NormalizedError {
  message: string
  requestId?: string
  status?: number
  retryable: boolean
}

/**
 * Normalizes errors from the axios client (see api/backend.ts's response
 * interceptor) into a consistent shape so every component surfaces errors
 * the same way instead of re-deriving this per component.
 */
export function normalizeError(err: any, fallback = 'Something went wrong. Please try again.'): NormalizedError {
  const status: number | undefined = err?.status ?? err?.response?.status
  const requestId: string | undefined = err?.requestId ?? err?.response?.data?.requestId

  let message = fallback
  if (err?.message) {
    message = err.message
  } else if (err?.response?.data?.error) {
    message = err.response.data.error
  }

  // Retryable: transient/server-side issues, not client validation mistakes.
  const retryable = status === undefined || status >= 500 || err?.code === 'ECONNABORTED' || err?.code === 'ERR_NETWORK'

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error('[error]', { message, status, requestId, raw: err })
  }

  return { message, requestId, status, retryable }
}
