import { UnipostClient, EntityRecord } from '@unipost/client'
import { sandboxRegistry, withSimulationDecorator } from '@unipost/sandbox'

/**
 * Configuration options for the Headless CMS Client in tekgo-ui.
 */
export interface UnipostCmsConfig {
  baseUrl: string
  publishableKey: string
  tenantId: string
  revalidateSeconds?: number
}

const DEFAULT_CONFIG: UnipostCmsConfig = {
  baseUrl: process.env.NEXT_PUBLIC_UNIPOST_API_URL || 'http://localhost:8000',
  publishableKey: process.env.NEXT_PUBLIC_UNIPOST_PUBLISHABLE_KEY || 'pk_live_default-tenant_pub123key',
  tenantId: process.env.NEXT_PUBLIC_UNIPOST_TENANT_ID || 'tenant-acme',
  revalidateSeconds: 60,
}

/**
 * Headless CMS Client for tekgo-ui.
 * Wraps @unipost/client with Next.js 15 cache tags and publishable key authentication.
 */
export class UnipostCmsClient {
  private config: UnipostCmsConfig
  private client: UnipostClient

  constructor(customConfig?: Partial<UnipostCmsConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...customConfig }

    // Intercept fetch with Unified Sandbox if running in dev simulation mode
    const customFetch: typeof fetch = async (input, init) => {
      // In dev mode, check sandbox registry first
      if (process.env.NODE_ENV !== 'production') {
        const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
        const method = init?.method || 'GET'
        const headers = (init?.headers as Record<string, string>) || {}
        const matched = sandboxRegistry.findHandler(urlStr, method, headers)
        if (matched) {
          const body = init?.body
          const response = await matched.handler.handler(
            {
              url: urlStr,
              method,
              headers,
              data: typeof body === 'string' ? JSON.parse(body) : body,
            },
            matched.context
          )
          if (response) {
            return new Response(JSON.stringify(response.data), {
              status: response.status,
              headers: { 'Content-Type': 'application/json' },
            })
          }
        }
      }

      // Live Next.js fetch with ISR revalidation tags
      const nextInit = init as RequestInit & { next?: { tags?: string[]; revalidate?: number } }
      return fetch(input, {
        ...nextInit,
        next: {
          tags: nextInit?.next?.tags || ['articles'],
          revalidate: nextInit?.next?.revalidate ?? this.config.revalidateSeconds,
        },
      })
    }

    this.client = new UnipostClient({
      baseURL: this.config.baseUrl,
      fetch: customFetch,
      tenantId: this.config.tenantId,
      headers: {
        'X-Publishable-Key': this.config.publishableKey,
      },
    })
  }

  /**
   * Fetches published CMS records for a specific entity type under the configured tenant.
   */
  async getPublishedRecords(
    entityType = 'article',
    params?: Record<string, string>
  ): Promise<EntityRecord[]> {
    const query = new URLSearchParams({
      entityType,
      ...(params || {}),
    })

    const path = `/api/v1/public/tenants/${encodeURIComponent(this.config.tenantId)}/cms/records?${query.toString()}`

    try {
      const response = await this.client.get<{ data?: { content?: EntityRecord[] } | EntityRecord[] } | EntityRecord[]>(path)
      // Unpack standard response wrappers (Page or content array)
      if (Array.isArray(response)) {
        return response
      }
      if ('data' in response && response.data) {
        if (Array.isArray(response.data)) {
          return response.data
        }
        if ('content' in response.data && Array.isArray(response.data.content)) {
          return response.data.content
        }
      }
      return []
    } catch (error) {
      console.warn(`[UnipostCmsClient] Failed to fetch published records for '${entityType}':`, error)
      return []
    }
  }

  /**
   * Fetches a single published record by ID.
   */
  async getPublishedRecord(recordId: number, entityType = 'article'): Promise<EntityRecord | null> {
    const path = `/api/v1/public/tenants/${encodeURIComponent(this.config.tenantId)}/cms/records/${recordId}?entityType=${encodeURIComponent(entityType)}`
    try {
      const response = await this.client.get<{ data?: EntityRecord } | EntityRecord>(path)
      if ('data' in response && response.data) {
        return response.data
      }
      return response as EntityRecord
    } catch (error) {
      console.warn(`[UnipostCmsClient] Failed to fetch record ${recordId}:`, error)
      return null
    }
  }
}

export const unipostCmsClient = new UnipostCmsClient()
