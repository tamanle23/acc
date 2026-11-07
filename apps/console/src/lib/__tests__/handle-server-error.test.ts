import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import { handleServerError } from '../handle-server-error';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('handleServerError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toasts 204 content not found', () => {
    handleServerError({ status: 204 });
    expect(toast.error).toHaveBeenCalledWith('Content not found.');
  });

  it('toasts 429 rate limit exceeded with retry-after header', () => {
    const error = new AxiosError(
      'Too Many Requests',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'retry-after': '30' },
        config: {} as any,
        data: {},
      }
    );

    handleServerError(error);
    expect(toast.error).toHaveBeenCalledWith(
      'Rate limit exceeded. Please wait 30 seconds before retrying.',
      { duration: 5000 }
    );
  });

  it('extracts and toasts backend envelope error messages', () => {
    const error = new AxiosError(
      'Request failed with status code 400',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
        data: {
          status: 'FAIL',
          errors: [
            { code: 'INVALID_FIELD', message: 'Username is already taken' },
          ],
        },
      }
    );

    handleServerError(error);
    expect(toast.error).toHaveBeenCalledWith('Username is already taken');
  });

  it('falls back to default message if error has no details', () => {
    handleServerError(null);
    expect(toast.error).toHaveBeenCalledWith('Something went wrong!');
  });
});
