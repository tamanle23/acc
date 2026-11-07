import { type AxiosError } from 'axios';

export interface BackendErrorItem {
  code?: string;
  message?: string;
  detail?: unknown;
  field?: string;
}

export interface ApiErrorResponse {
  status?: string | number;
  error?: string;
  message?: string;
  title?: string;
  detail?: string;
  code?: string;
  errors?: Array<BackendErrorItem | string>;
  headers?: unknown;
  body?: unknown;
}

/**
 * Returns true if the object matches the structure of a backend Spring Boot envelope with a failure/error status.
 */
export function isBackendEnvelopeFailure(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.status !== 'string') return false;
  const upper = d.status.trim().toUpperCase();
  if (upper !== 'FAIL' && upper !== 'ERROR') return false;
  return 'errors' in d || 'body' in d || 'headers' in d;
}

/**
 * Safely extract an informative error message from an unknown error or response payload.
 */
export function extractEnvelopeErrorMessage(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === 'string' && data.trim().length > 0) return data.trim();
  if (typeof data !== 'object') return null;

  const d = data as Record<string, unknown>;

  // 1. Check errors array (Spring Boot ResponseWrapper.errors)
  if (Array.isArray(d.errors) && d.errors.length > 0) {
    const messages = d.errors
      .map((errItem) => {
        if (typeof errItem === 'string') return errItem.trim();
        if (errItem && typeof errItem === 'object') {
          const item = errItem as Record<string, unknown>;
          if (typeof item.message === 'string' && item.message.trim().length > 0) {
            return item.message.trim();
          }
          if (typeof item.detail === 'string' && item.detail.trim().length > 0) {
            return item.detail.trim();
          }
          if (typeof item.code === 'string' && item.code.trim().length > 0) {
            return item.code.trim();
          }
        }
        return '';
      })
      .filter((msg) => msg.length > 0);

    if (messages.length > 0) {
      return messages.join('; ');
    }
  }

  // 2. Check message field
  if (typeof d.message === 'string' && d.message.trim().length > 0) {
    return d.message.trim();
  }

  // 3. Check detail field (RFC 7807)
  if (typeof d.detail === 'string' && d.detail.trim().length > 0) {
    return d.detail.trim();
  }

  // 4. Check error field (Spring standard error string)
  if (typeof d.error === 'string' && d.error.trim().length > 0) {
    return d.error.trim();
  }

  // 5. Check title field (RFC 7807)
  if (typeof d.title === 'string' && d.title.trim().length > 0) {
    return d.title.trim();
  }

  return null;
}

/**
 * Safely extract an informative error message from an unknown error or AxiosError.
 */
export function getErrorMessage(err: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  if (!err) return fallbackMessage;

  const axiosErr = err as AxiosError<ApiErrorResponse>;
  if (axiosErr.response?.data) {
    const extracted = extractEnvelopeErrorMessage(axiosErr.response.data);
    if (extracted) return extracted;
  }

  if (typeof err === 'object' && err !== null && !(err instanceof Error)) {
    const extracted = extractEnvelopeErrorMessage(err);
    if (extracted) return extracted;
  }

  if (err instanceof Error && err.message && err.message.trim().length > 0) {
    return err.message.trim();
  }

  if (typeof err === 'string' && err.trim().length > 0) {
    return err.trim();
  }

  return fallbackMessage;
}
