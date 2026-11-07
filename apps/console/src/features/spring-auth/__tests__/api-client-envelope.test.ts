import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { springApiClient } from '../api-client';
import { useSpringAuthStore } from '../store';
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store';

describe('springApiClient Backend Envelope Handling', () => {
  beforeEach(() => {
    localStorage.clear();
    useSandboxStore.setState({ enabled: false, activePersonaId: null });
    useSpringAuthStore.setState({
      accessToken: 'valid-token',
      refreshToken: 'valid-refresh',
      user: {
        id: 'usr-1',
        username: 'admin',
        email: 'admin@acc.io',
        roles: ['ROLE_SYSTEM_ROOT'],
        permissions: ['*'],
        isSovereign: true,
        tenantId: 'SYSTEM',
      },
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('rejects HTTP 200 responses with status "FAIL" as an AxiosError with backend message', async () => {
    const originalAdapter = springApiClient.defaults.adapter;
    springApiClient.defaults.adapter = async (config) => {
      return {
        data: {
          status: 'FAIL',
          headers: {},
          body: null,
          errors: [
            { code: 'VALIDATION_FAILED', message: 'Email already registered' },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    try {
      await expect(springApiClient.post('/v1/test/fail-envelope', {})).rejects.toThrow(
        'Email already registered'
      );
    } finally {
      springApiClient.defaults.adapter = originalAdapter;
    }
  });

  it('rejects HTTP 200 responses with status "ERROR"', async () => {
    const originalAdapter = springApiClient.defaults.adapter;
    springApiClient.defaults.adapter = async (config) => {
      return {
        data: {
          status: 'ERROR',
          body: null,
          errors: [{ message: 'Internal processing failure' }],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    try {
      await expect(springApiClient.get('/v1/test/error-envelope')).rejects.toThrow(
        'Internal processing failure'
      );
    } finally {
      springApiClient.defaults.adapter = originalAdapter;
    }
  });

  it('resolves HTTP 200 responses with status "SUCCESS"', async () => {
    const originalAdapter = springApiClient.defaults.adapter;
    springApiClient.defaults.adapter = async (config) => {
      return {
        data: {
          status: 'SUCCESS',
          headers: {},
          body: { userId: 'usr-123', status: 'ACTIVE' },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    try {
      const res = await springApiClient.get('/v1/test/success-envelope');
      expect(res.status).toBe(200);
      expect((res.data as any).status).toBe('SUCCESS');
      expect((res.data as any).body.userId).toBe('usr-123');
    } finally {
      springApiClient.defaults.adapter = originalAdapter;
    }
  });

  it('enriches HTTP 400 error.message with backend envelope errors', async () => {
    const originalAdapter = springApiClient.defaults.adapter;
    springApiClient.defaults.adapter = async (config) => {
      const axiosError = new (await import('axios')).AxiosError(
        'Request failed with status code 400',
        'ERR_BAD_REQUEST',
        config,
        null,
        {
          data: {
            status: 'FAIL',
            errors: [{ code: 'INVALID_NAME', message: 'Name must not be blank' }],
          },
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config,
        } as any
      );
      throw axiosError;
    };

    try {
      await expect(springApiClient.post('/v1/test/bad-request', {})).rejects.toThrow(
        'Name must not be blank'
      );
    } finally {
      springApiClient.defaults.adapter = originalAdapter;
    }
  });
});
