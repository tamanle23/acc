import { AccClient, type EntityRecord } from '@acc/client';
import { sandboxRegistry } from '@acc/sandbox';

export interface AccCmsConfig {
  baseUrl: string;
  publishableKey: string;
  tenantId: string;
  revalidateSeconds?: number;
}

const DEFAULT_CONFIG: AccCmsConfig = {
  baseUrl: process.env.PUBLIC_UNIPOST_API_URL || process.env.NEXT_PUBLIC_UNIPOST_API_URL || 'http://localhost:8000',
  publishableKey:
    process.env.PUBLIC_UNIPOST_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_UNIPOST_PUBLISHABLE_KEY ||
    'pk_live_default-tenant_pub123key',
  tenantId: process.env.PUBLIC_UNIPOST_TENANT_ID || process.env.NEXT_PUBLIC_UNIPOST_TENANT_ID || 'tenant-acme',
  revalidateSeconds: 60,
};

/**
 * Headless CMS Client for tekgo-ui.
 * Wraps @acc/client with publishable key authentication and WinterTC standard fetch.
 */
export class AccCmsClient {
  private config: AccCmsConfig;
  private client: AccClient;

  constructor(customConfig?: Partial<AccCmsConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...customConfig };

    const customFetch = (async (input: any, init?: any) => {
      // In dev mode, check sandbox registry first
      if (process.env.NODE_ENV !== 'production') {
        const urlStr =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        const method = init?.method || 'GET';
        const headers = (init?.headers as Record<string, string>) || {};
        const matched = sandboxRegistry.findHandler(urlStr, method, headers);
        if (matched) {
          const body = init?.body;
          const response = await matched.handler.handler(
            {
              url: urlStr,
              method,
              headers,
              data: typeof body === 'string' ? JSON.parse(body) : body,
            },
            matched.context
          );
          if (response) {
            return new Response(JSON.stringify(response.data), {
              status: response.status,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
      }

      return fetch(input, init);
    }) as typeof fetch;

    this.client = new AccClient({
      baseURL: this.config.baseUrl,
      fetch: customFetch,
      tenantId: this.config.tenantId,
      headers: {
        'X-Publishable-Key': this.config.publishableKey,
      },
    });
  }

  async getPublishedRecords(
    entityType = 'article',
    params?: Record<string, string>
  ): Promise<EntityRecord[]> {
    const query = new URLSearchParams({
      entityType,
      ...(params || {}),
    });

    const path = `/api/v1/public/tenants/${encodeURIComponent(this.config.tenantId)}/cms/records?${query.toString()}`;

    try {
      const records = await this.client.get<EntityRecord[]>(path);
      return records || [];
    } catch (error) {
      console.warn(`[AccCmsClient] Failed to fetch CMS published records for ${entityType}:`, error);
      return [];
    }
  }

  async getPublishedRecordBySlug(
    slug: string,
    entityType = 'article'
  ): Promise<EntityRecord | null> {
    const records = await this.getPublishedRecords(entityType, { slug });
    return records.find((r) => r.attributes?.slug === slug) || records[0] || null;
  }
}

export const accCmsClient = new AccCmsClient();
