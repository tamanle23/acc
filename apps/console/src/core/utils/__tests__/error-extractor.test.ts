import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import {
  isBackendEnvelopeFailure,
  extractEnvelopeErrorMessage,
  getErrorMessage,
} from '../error-extractor';

describe('error-extractor', () => {
  describe('isBackendEnvelopeFailure', () => {
    it('detects Spring Boot ResponseWrapper with FAIL status and errors', () => {
      const payload = {
        status: 'FAIL',
        headers: {},
        body: null,
        errors: [{ code: 'VALIDATION_FAILED', message: 'Field is required' }],
      };
      expect(isBackendEnvelopeFailure(payload)).toBe(true);
    });

    it('detects Spring Boot ResponseWrapper with ERROR status and body', () => {
      const payload = {
        status: 'ERROR',
        body: null,
      };
      expect(isBackendEnvelopeFailure(payload)).toBe(true);
    });

    it('handles lowercase status "fail" and "error"', () => {
      expect(isBackendEnvelopeFailure({ status: 'fail', errors: [] })).toBe(true);
      expect(isBackendEnvelopeFailure({ status: 'error', headers: {} })).toBe(true);
    });

    it('returns false for SUCCESS status envelopes', () => {
      const payload = {
        status: 'SUCCESS',
        body: { id: 1, name: 'Alice' },
      };
      expect(isBackendEnvelopeFailure(payload)).toBe(false);
    });

    it('returns false for domain entities that happen to have status field without envelope markers', () => {
      const entity = {
        id: 'task-123',
        status: 'FAILED',
        description: 'Rendering task',
      };
      expect(isBackendEnvelopeFailure(entity)).toBe(false);
    });

    it('returns false for null, undefined, and non-objects', () => {
      expect(isBackendEnvelopeFailure(null)).toBe(false);
      expect(isBackendEnvelopeFailure(undefined)).toBe(false);
      expect(isBackendEnvelopeFailure('some error')).toBe(false);
      expect(isBackendEnvelopeFailure(123)).toBe(false);
    });
  });

  describe('extractEnvelopeErrorMessage', () => {
    it('extracts and joins messages from errors array', () => {
      const payload = {
        errors: [
          { code: 'INVALID_FIRST_NAME', message: 'First name is required' },
          { code: 'INVALID_EMAIL', message: 'Email address is invalid' },
        ],
      };
      expect(extractEnvelopeErrorMessage(payload)).toBe(
        'First name is required; Email address is invalid'
      );
    });

    it('falls back to code or detail if message is absent in error item', () => {
      const payload = {
        errors: [
          { code: 'ACCOUNT_SUSPENDED' },
          { detail: 'IP rate limit hit' },
        ],
      };
      expect(extractEnvelopeErrorMessage(payload)).toBe('ACCOUNT_SUSPENDED; IP rate limit hit');
    });

    it('handles string items inside errors array', () => {
      const payload = {
        errors: ['Error string 1', 'Error string 2'],
      };
      expect(extractEnvelopeErrorMessage(payload)).toBe('Error string 1; Error string 2');
    });

    it('extracts top-level message if errors array is empty or absent', () => {
      expect(extractEnvelopeErrorMessage({ message: 'User not found' })).toBe('User not found');
    });

    it('extracts RFC 7807 detail property', () => {
      expect(extractEnvelopeErrorMessage({ detail: 'Unparseable JSON input' })).toBe(
        'Unparseable JSON input'
      );
    });

    it('extracts Spring standard error property', () => {
      expect(extractEnvelopeErrorMessage({ error: 'Unauthorized request' })).toBe(
        'Unauthorized request'
      );
    });

    it('extracts RFC 7807 title property', () => {
      expect(extractEnvelopeErrorMessage({ title: 'Method Not Allowed' })).toBe(
        'Method Not Allowed'
      );
    });

    it('handles raw string input', () => {
      expect(extractEnvelopeErrorMessage('Direct error message')).toBe('Direct error message');
    });

    it('returns null for empty or unparseable object', () => {
      expect(extractEnvelopeErrorMessage({})).toBeNull();
      expect(extractEnvelopeErrorMessage(null)).toBeNull();
    });
  });

  describe('getErrorMessage', () => {
    it('extracts message from AxiosError with backend ResponseWrapper in response.data', () => {
      const axiosErr = new AxiosError(
        'Request failed with status code 200',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        {
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
          data: {
            status: 'FAIL',
            errors: [{ code: 'VALIDATION', message: 'Invalid credentials provided' }],
          },
        }
      );

      expect(getErrorMessage(axiosErr)).toBe('Invalid credentials provided');
    });

    it('extracts message from AxiosError with RFC 7807 problem details in response.data', () => {
      const axiosErr = new AxiosError(
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
            title: 'Bad Request',
            detail: 'Field email must match standard format',
          },
        }
      );

      expect(getErrorMessage(axiosErr)).toBe('Field email must match standard format');
    });

    it('extracts error from raw response data payload passed directly', () => {
      const data = {
        errors: [{ message: 'Tenant quota exceeded' }],
      };
      expect(getErrorMessage(data)).toBe('Tenant quota exceeded');
    });

    it('extracts err.message from standard JS Error when no response.data', () => {
      const standardErr = new Error('Network connection timeout');
      expect(getErrorMessage(standardErr)).toBe('Network connection timeout');
    });

    it('returns raw string if err is a string', () => {
      expect(getErrorMessage('Explicit failure')).toBe('Explicit failure');
    });

    it('returns fallback message if err is undefined or uninformative', () => {
      expect(getErrorMessage(undefined, 'Custom fallback')).toBe('Custom fallback');
      expect(getErrorMessage(null)).toBe('An unexpected error occurred');
      expect(getErrorMessage({})).toBe('An unexpected error occurred');
    });
  });
});
