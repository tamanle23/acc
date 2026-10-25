import {
  sandboxRegistry,
  defaultSandboxEngine,
  attachGlobalSandboxFetch,
  createSandboxFetch,
  SandboxRouteHandler,
} from '@acc/sandbox';
import { Post } from '../types';

/**
 * Baseline deterministic post records partitioned by tenant
 */
const SEED_POSTS: Record<string, Post[]> = {
  'tenant-us-east-1': [
    {
      id: 'post-1',
      author: {
        id: 'user-1',
        username: 'elena_roche',
        displayName: 'Elena Roche',
        avatarUrl:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      },
      content:
        'Chasing the neon sunsets in Tokyo 🌆✨ The interplay of glass facades and evening light is mesmerizing.',
      imageUrl:
        'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80',
      tags: ['photography', 'tokyo', 'cyberpunk', 'vibes'],
      timestamp: Date.now() - 1000 * 60 * 18,
      likes: 142,
      commentsCount: 19,
    },
    {
      id: 'post-2',
      author: {
        id: 'user-2',
        username: 'marcus_dev',
        displayName: 'Marcus Chen',
        avatarUrl:
          'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      },
      content:
        'Exploring frosted UI aesthetics today! What are your favorite design systems incorporating translucent glass and fluid gradients?',
      tags: ['design', 'uiux', 'reactnative', 'glassmorphism'],
      timestamp: Date.now() - 1000 * 60 * 65,
      likes: 88,
      commentsCount: 34,
    },
  ],
};

let inMemoryPosts: Record<string, Post[]> = JSON.parse(JSON.stringify(SEED_POSTS));

export const mobilePostsSandboxHandler: SandboxRouteHandler = {
  id: 'mobile-posts-handler',
  name: 'Mobile Dynamic Entity Posts Handler',
  priority: 50,
  matcher: (ctx) => {
    return (
      (ctx.pathname === '/api/v1/metadata/records' || ctx.pathname === '/v1/metadata/records') &&
      ctx.searchParams.get('entityType') === 'post'
    );
  },
  handler: (req, ctx) => {
    const tenantId =
      (ctx.headers['x-tenant-id'] as string) ||
      defaultSandboxEngine.getStore().getState().activeTenantId ||
      'tenant-us-east-1';

    if (!inMemoryPosts[tenantId]) {
      inMemoryPosts[tenantId] = JSON.parse(JSON.stringify(SEED_POSTS['tenant-us-east-1'] || []));
    }

    if (ctx.method === 'GET') {
      return {
        status: 200,
        data: {
          content: inMemoryPosts[tenantId],
          totalElements: inMemoryPosts[tenantId].length,
          totalPages: 1,
          number: 1,
          size: 50,
        },
      };
    }

    if (ctx.method === 'POST') {
      const payload = req.data || {};
      const newPost: Post = {
        id: payload.id || `post-${Date.now()}`,
        author: payload.author || { id: 'u-current', username: 'MobileOperator' },
        content: payload.content || '',
        imageUrl: payload.imageUrl,
        tags: payload.tags || [],
        timestamp: payload.timestamp || Date.now(),
        likes: payload.likes || 0,
        commentsCount: payload.commentsCount || 0,
      };

      inMemoryPosts[tenantId].unshift(newPost);

      return {
        status: 201,
        data: newPost,
      };
    }

    return {
      status: 405,
      data: { error: 'Method Not Allowed' },
    };
  },
};

/**
 * Resets mobile posts repository to initial seed state
 */
export function resetMobileSandboxPosts(tenantId?: string): void {
  if (tenantId) {
    inMemoryPosts[tenantId] = JSON.parse(JSON.stringify(SEED_POSTS['tenant-us-east-1'] || []));
  } else {
    inMemoryPosts = JSON.parse(JSON.stringify(SEED_POSTS));
  }
}

/**
 * Initializes mobile sandbox routing and attaches global fetch interceptor
 */
export function initMobileSandbox(): void {
  sandboxRegistry.register(mobilePostsSandboxHandler);
  attachGlobalSandboxFetch(defaultSandboxEngine);
}
