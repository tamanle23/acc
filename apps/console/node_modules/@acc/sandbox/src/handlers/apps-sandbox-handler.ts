import type { SandboxRouteHandler, SandboxRequest } from '../types';
import { sandboxResetRegistry } from '../reset-registry';

class AppsSandboxRepository {
  private connectedProviders: Map<string, any> = new Map();

  constructor() {
    this.reset();
    sandboxResetRegistry.register(() => this.reset());
  }

  public reset(): void {
    this.connectedProviders.clear();
    this.connectedProviders.set('facebook', {
      connected: false,
      pages: [
        {
          id: '102938475610293',
          name: 'Acc Official Store',
          category: 'E-commerce & Retail',
          accessToken: 'EAAB_MOCK_PAGE_TOKEN_1',
          isLongLived: true,
          expiresAt: null,
        },
        {
          id: '584736291029384',
          name: 'Acc Community Hub',
          category: 'Community Organization',
          accessToken: 'EAAB_MOCK_PAGE_TOKEN_2',
          isLongLived: true,
          expiresAt: null,
        },
      ],
    });
    this.connectedProviders.set('tiktok', {
      connected: false,
      profile: {
        openId: 'tiktok_open_id_demo_888',
        displayName: 'Acc Creators Official',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        followerCount: 24800,
        followingCount: 142,
        likesCount: 382000,
      },
    });
    this.connectedProviders.set('youtube', {
      connected: false,
      channel: {
        id: 'UC_x123456789demoChannel',
        title: 'Acc Tech Broadcasts',
        description: 'Official developer tutorials, live streams, and product architecture walkthroughs.',
        customUrl: '@acc_official',
        publishedAt: '2023-01-15T08:00:00Z',
        thumbnails: {
          default: { url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150' },
          medium: { url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=240' },
          high: { url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=480' },
        },
        subscriberCount: '18400',
        videoCount: '96',
        viewCount: '1420500',
      },
    });
  }

  public getProvider(name: string) {
    return this.connectedProviders.get(name);
  }

  public setProvider(name: string, data: any) {
    this.connectedProviders.set(name, data);
  }
}

export const appsSandboxRepo = new AppsSandboxRepository();

export const appsSandboxHandler: SandboxRouteHandler = {
  id: 'apps-sandbox-handler',
  name: 'Social Apps Integration Sandbox Repository',
  description: 'In-memory OAuth token exchange and channel simulations for Meta, TikTok, and YouTube',
  priority: 80,
  matcher: (ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    return cleanPath.startsWith('/integrations');
  },
  handler: async (req: SandboxRequest, ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    const subPath = cleanPath.replace(/^\/integrations/, '');

    // GET /api/integrations/:provider
    const providerMatch = subPath.match(/^\/([^/]+)$/);
    if (providerMatch) {
      const provider = providerMatch[1];
      if (req.method === 'GET') {
        const data = appsSandboxRepo.getProvider(provider);
        if (!data) return { status: 404, data: { message: `Provider ${provider} not found` } };
        return { status: 200, data };
      }
      if (req.method === 'POST') {
        appsSandboxRepo.setProvider(provider, req.data);
        return { status: 200, data: { success: true, provider: req.data } };
      }
    }

    // Auth simulations: POST /api/integrations/:provider/exchange
    const exchangeMatch = subPath.match(/^\/([^/]+)\/exchange$/);
    if (exchangeMatch && req.method === 'POST') {
      const provider = exchangeMatch[1];
      const data = appsSandboxRepo.getProvider(provider);
      return {
        status: 200,
        data: {
          success: true,
          provider,
          accessToken: `mock_oauth_token_${provider}_${Date.now()}`,
          details: data,
        },
      };
    }

    return { status: 404, data: { message: 'Not found' } };
  },
};
