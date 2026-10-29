import { type AxiosError } from 'axios';

export interface ApiErrorResponse {
  error?: string;
  message?: string;
  status?: number;
  code?: string;
}

/**
 * Safely extract an informative error message from an unknown error or AxiosError.
 */
export function getErrorMessage(err: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  if (!err) return fallbackMessage;

  const axiosErr = err as AxiosError<ApiErrorResponse>;
  if (axiosErr.response?.data) {
    const data = axiosErr.response.data;
    if (typeof data.message === 'string' && data.message.trim().length > 0) {
      return data.message;
    }
    if (typeof data.error === 'string' && data.error.trim().length > 0) {
      return data.error;
    }
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return fallbackMessage;
}
