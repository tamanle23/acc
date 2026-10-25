import type { AccClient } from '../client';
import type { EntityType, AttributeDefinition, PageResponse, EntityRecord } from '../types';
import type {
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  McpManifest,
  McpToolCallParams,
  McpToolCallResult,
} from './types';
import { synthesizeMcpManifest, compileDraft07Schema } from './synthesizer';

export interface McpServerConfig {
  client: AccClient;
  tenantId?: string;
}

/**
 * Dynamic Model Context Protocol (MCP) Server for LLM Agent Interoperability.
 *
 * Implements JSON-RPC 2.0 protocol handling:
 * - "tools/list": Returns dynamic tool manifests synthesized from active tenant metadata.
 * - "tools/call": Dispatches tool invocations:
 *     - acc_get_schema
 *     - acc_query_entities
 *     - acc_create_entity
 *     - acc_execute_transition
 */
export class McpServer {
  private client: AccClient;
  private tenantId?: string;

  // Cached metadata for fast tool manifest synthesis
  private cachedEntityTypes: EntityType[] = [];
  private cachedAttributes: Record<string | number, AttributeDefinition[]> = {};

  constructor(config: McpServerConfig) {
    this.client = config.client;
    this.tenantId = config.tenantId;
  }

  /**
   * Refreshes or loads tenant metadata into server memory.
   */
  async refreshMetadata(): Promise<void> {
    try {
      const typesResponse = await this.client.get<PageResponse<EntityType> | EntityType[]>(
        '/v1/metadata/entity-types',
        { tenantId: this.tenantId }
      );
      this.cachedEntityTypes = Array.isArray(typesResponse)
        ? typesResponse
        : typesResponse?.content || [];

      for (const et of this.cachedEntityTypes) {
        try {
          const attrsResponse = await this.client.get<PageResponse<AttributeDefinition> | AttributeDefinition[]>(
            `/v1/metadata/entity-types/${et.id}/attributes`,
            { tenantId: this.tenantId }
          );
          this.cachedAttributes[et.id] = Array.isArray(attrsResponse)
            ? attrsResponse
            : attrsResponse?.content || [];
        } catch {
          this.cachedAttributes[et.id] = [];
        }
      }
    } catch {
      // Offline / sandbox fallback
    }
  }

  /**
   * Directly sets metadata cache (useful in tests or when loaded from store).
   */
  setMetadata(entityTypes: EntityType[], attributes: Record<string | number, AttributeDefinition[]> = {}): void {
    this.cachedEntityTypes = entityTypes;
    this.cachedAttributes = attributes;
  }

  /**
   * Returns current synthesized MCP Manifest.
   */
  getManifest(): McpManifest {
    return synthesizeMcpManifest(this.cachedEntityTypes, this.cachedAttributes, this.tenantId);
  }

  /**
   * Handles an incoming MCP JSON-RPC 2.0 request.
   */
  async handleJsonRpc(request: McpJsonRpcRequest): Promise<McpJsonRpcResponse> {
    if (!request || request.jsonrpc !== '2.0') {
      return {
        jsonrpc: '2.0',
        id: request?.id ?? null,
        error: {
          code: -32600,
          message: 'Invalid Request: jsonrpc must be "2.0"',
        },
      };
    }

    try {
      switch (request.method) {
        case 'tools/list': {
          const manifest = this.getManifest();
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: manifest.tools,
            },
          };
        }

        case 'tools/call': {
          const params = request.params as McpToolCallParams;
          if (!params || !params.name) {
            return {
              jsonrpc: '2.0',
              id: request.id,
              error: {
                code: -32602,
                message: 'Invalid params: tool name is required',
              },
            };
          }

          const callResult = await this.executeTool(params.name, params.arguments || {});
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: callResult,
          };
        }

        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`,
            },
          };
      }
    } catch (err: any) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: `Tool execution error: ${err.message || String(err)}`,
            },
          ],
          isError: true,
        },
      };
    }
  }

  /**
   * Dispatches execution of a named MCP tool.
   */
  private async executeTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    switch (name) {
      case 'acc_get_schema': {
        const entityTypeName = String(args.entityType || '');
        const entityType = this.findEntityType(entityTypeName);
        if (!entityType) {
          return {
            isError: true,
            content: [{ type: 'text', text: `EntityType '${entityTypeName}' not found.` }],
          };
        }

        const attributes = this.cachedAttributes[entityType.id] || [];
        const schema = compileDraft07Schema(entityType, attributes);

        return {
          content: [{ type: 'text', text: JSON.stringify(schema, null, 2) }],
        };
      }

      case 'acc_query_entities': {
        const entityTypeName = String(args.entityType || '');
        const entityType = this.findEntityType(entityTypeName);
        if (!entityType) {
          return {
            isError: true,
            content: [{ type: 'text', text: `EntityType '${entityTypeName}' not found.` }],
          };
        }

        const page = typeof args.page === 'number' ? args.page : 1;
        const size = typeof args.size === 'number' ? args.size : 20;
        const filters = args.filters as Record<string, string> | undefined;
        const sort = args.sort ? String(args.sort) : undefined;

        const result = await this.client.get<PageResponse<EntityRecord>>(
          `/v1/metadata/entity-types/${entityType.id}/records`,
          {
            params: {
              page,
              size,
              sort,
              ...(filters ? { filters: JSON.stringify(filters) } : {}),
            },
            tenantId: this.tenantId,
          }
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'acc_create_entity': {
        const entityTypeName = String(args.entityType || '');
        const entityType = this.findEntityType(entityTypeName);
        if (!entityType) {
          return {
            isError: true,
            content: [{ type: 'text', text: `EntityType '${entityTypeName}' not found.` }],
          };
        }

        const attributes = (args.attributes || {}) as Record<string, unknown>;
        const created = await this.client.post<EntityRecord>(
          `/v1/metadata/entity-types/${entityType.id}/records`,
          { attributes },
          { tenantId: this.tenantId }
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(created, null, 2) }],
        };
      }

      case 'acc_execute_transition': {
        const entityTypeName = String(args.entityType || '');
        const recordId = String(args.recordId || '');
        const action = String(args.action || '');
        const additionalAttributes = (args.additionalAttributes || {}) as Record<string, unknown>;

        const entityType = this.findEntityType(entityTypeName);
        if (!entityType) {
          return {
            isError: true,
            content: [{ type: 'text', text: `EntityType '${entityTypeName}' not found.` }],
          };
        }

        const transitioned = await this.client.post<EntityRecord>(
          `/v1/metadata/entity-types/${entityType.id}/records/${recordId}/transition`,
          additionalAttributes,
          {
            params: { action },
            tenantId: this.tenantId,
          }
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(transitioned, null, 2) }],
        };
      }

      default:
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        };
    }
  }

  private findEntityType(identifier: string | number): EntityType | undefined {
    return this.cachedEntityTypes.find(
      (et) =>
        String(et.id) === String(identifier) ||
        et.systemName.toLowerCase() === String(identifier).toLowerCase()
    );
  }
}
