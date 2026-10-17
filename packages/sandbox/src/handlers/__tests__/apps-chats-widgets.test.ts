import { describe, it, expect, beforeEach } from 'vitest';
import { appsSandboxHandler, appsSandboxRepo } from '../apps-sandbox-handler';
import { chatsSandboxHandler, chatsSandboxRepo } from '../chats-sandbox-handler';
import { widgetSandboxHandler } from '../widget-handler';

describe('Apps, Chats, and Widgets Sandbox Handlers Suite', () => {
  beforeEach(() => {
    appsSandboxRepo.reset();
    chatsSandboxRepo.reset();
  });

  const createCtx = (path: string, method: string = 'GET') => ({
    pathname: path,
    method,
    headers: {},
    searchParams: new URLSearchParams(),
    url: path,
  });

  describe('Apps Sandbox Handler', () => {
    it('matches /api/v1/integrations routes', () => {
      expect(appsSandboxHandler.matcher(createCtx('/api/v1/integrations/facebook'))).toBe(true);
      expect(appsSandboxHandler.matcher(createCtx('/api/v1/integrations/tiktok/exchange'))).toBe(true);
      expect(appsSandboxHandler.matcher(createCtx('/api/v1/users'))).toBe(false);
    });

    it('retrieves integration provider details and simulates oauth exchange', async () => {
      // 1. GET /api/v1/integrations/facebook
      const getReq = { url: '/api/v1/integrations/facebook', method: 'GET', headers: {} };
      const getRes = await appsSandboxHandler.handler(getReq, createCtx('/api/v1/integrations/facebook', 'GET'));
      expect(getRes?.status).toBe(200);
      expect(getRes?.data?.pages).toBeDefined();

      // 2. POST /api/v1/integrations/facebook/exchange
      const exchangeReq = { url: '/api/v1/integrations/facebook/exchange', method: 'POST', headers: {} };
      const exchangeRes = await appsSandboxHandler.handler(
        exchangeReq,
        createCtx('/api/v1/integrations/facebook/exchange', 'POST')
      );
      expect(exchangeRes?.status).toBe(200);
      expect(exchangeRes?.data?.success).toBe(true);
      expect(exchangeRes?.data?.accessToken).toContain('mock_oauth_token_facebook');

      // 3. Mutate provider data
      const postReq = {
        url: '/api/v1/integrations/facebook',
        method: 'POST',
        headers: {},
        data: { connected: true, pages: [] },
      };
      const postRes = await appsSandboxHandler.handler(postReq, createCtx('/api/v1/integrations/facebook', 'POST'));
      expect(postRes?.status).toBe(200);
      expect(postRes?.data?.success).toBe(true);
    });
  });

  describe('Chats Sandbox Handler', () => {
    it('matches /api/v1/chats routes', () => {
      expect(chatsSandboxHandler.matcher(createCtx('/api/v1/chats'))).toBe(true);
      expect(chatsSandboxHandler.matcher(createCtx('/api/v1/chats/convo-1/messages'))).toBe(true);
    });

    it('lists conversations and appends messages', async () => {
      const listReq = { url: '/api/v1/chats', method: 'GET', headers: {} };
      const listRes = await chatsSandboxHandler.handler(listReq, createCtx('/api/v1/chats', 'GET'));
      expect(listRes?.status).toBe(200);
      expect(Array.isArray(listRes?.data)).toBe(true);
      expect(listRes?.data.length).toBeGreaterThan(0);

      const targetConvoId = listRes?.data[0].id;
      const msgReq = {
        url: `/api/v1/chats/${targetConvoId}/messages`,
        method: 'POST',
        headers: {},
        data: { sender: 'agent', message: 'Automated test message' },
      };
      const msgRes = await chatsSandboxHandler.handler(
        msgReq,
        createCtx(`/api/v1/chats/${targetConvoId}/messages`, 'POST')
      );
      expect(msgRes?.status).toBe(200);
      expect(msgRes?.data?.messages.some((m: any) => m.message === 'Automated test message')).toBe(true);
    });
  });

  describe('Widget Sandbox Handler', () => {
    it('matches /api/v1/widgets routes', () => {
      expect(widgetSandboxHandler.matcher(createCtx('/api/v1/widgets/barcode/lookup'))).toBe(true);
      expect(widgetSandboxHandler.matcher(createCtx('/api/v1/widgets/geocode/reverse'))).toBe(true);
      expect(widgetSandboxHandler.matcher(createCtx('/api/v1/widgets/signature/verify'))).toBe(true);
    });

    it('returns barcode lookup, reverse geocoding, and verifies signature', async () => {
      // 1. Barcode lookup
      const barcodeReq = { url: '/api/v1/widgets/barcode/lookup?code=VN-EAN13-998877', method: 'GET', headers: {} };
      const barcodeRes = await widgetSandboxHandler.handler(
        barcodeReq,
        createCtx('/api/v1/widgets/barcode/lookup?code=VN-EAN13-998877', 'GET')
      );
      expect(barcodeRes?.status).toBe(200);
      expect(barcodeRes?.data?.valid).toBe(true);
      expect(barcodeRes?.data?.format).toBe('EAN_13');

      // 2. Reverse Geocoding
      const geoReq = { url: '/api/v1/widgets/geocode/reverse', method: 'GET', headers: {} };
      const geoRes = await widgetSandboxHandler.handler(geoReq, createCtx('/api/v1/widgets/geocode/reverse', 'GET'));
      expect(geoRes?.status).toBe(200);
      expect(geoRes?.data?.city).toBe('Ho Chi Minh City');

      // 3. Signature verification
      const sigReq = {
        url: '/api/v1/widgets/signature/verify',
        method: 'POST',
        headers: {},
        data: { signatureData: 'data:image/png;base64,' + 'A'.repeat(80) },
      };
      const sigRes = await widgetSandboxHandler.handler(sigReq, createCtx('/api/v1/widgets/signature/verify', 'POST'));
      expect(sigRes?.status).toBe(200);
      expect(sigRes?.data?.verified).toBe(true);
    });
  });
});
