import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  McpServer,
  synthesizeMcpManifest,
  compileDraft07Schema,
  type McpJsonRpcRequest,
} from '../mcp';
import { UnipostClient } from '../client';
import type { EntityType, AttributeDefinition } from '../types';

describe('MCP Dynamic Tool Synthesis & Server (Phase 17)', () => {
  let mockFetch: any;
  let client: UnipostClient;
  let mcpServer: McpServer;

  const sampleEntityTypes: EntityType[] = [
    {
      id: 1,
      name: 'Blog Article',
      systemName: 'article',
      description: 'Public articles and posts',
      schemaVersion: 2,
    },
    {
      id: 2,
      name: 'Comment',
      systemName: 'comment',
      description: 'Reader comments',
      schemaVersion: 1,
    },
  ];

  const sampleAttributes: Record<string | number, AttributeDefinition[]> = {
    1: [
      {
        id: 101,
        name: 'Title',
        systemName: 'title',
        dataType: 'STRING',
        uiComponent: 'text',
        isRequired: true,
        options: { min: 5, max: 100 },
      },
      {
        id: 102,
        name: 'Status',
        systemName: 'status',
        dataType: 'STRING',
        uiComponent: 'select',
        isRequired: true,
        options: { choices: ['DRAFT', 'SUBMITTED', 'PUBLISHED'] },
        defaultValue: 'DRAFT',
      },
      {
        id: 103,
        name: 'Views',
        systemName: 'views',
        dataType: 'INTEGER',
        uiComponent: 'number',
        isRequired: false,
        options: { min: 0 },
      },
    ],
    2: [
      {
        id: 201,
        name: 'Body',
        systemName: 'body',
        dataType: 'STRING',
        uiComponent: 'textarea',
        isRequired: true,
      },
    ],
  };

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new UnipostClient({
      baseURL: 'https://api.unipost.io/api',
      tenantId: 'tenant-enterprise',
      fetch: mockFetch,
    });
    mcpServer = new McpServer({ client, tenantId: 'tenant-enterprise' });
    mcpServer.setMetadata(sampleEntityTypes, sampleAttributes);
  });

  describe('synthesizeMcpManifest & compileDraft07Schema', () => {
    it('synthesizes Draft-07 JSON Schema for an EntityType and attributes', () => {
      const schema = compileDraft07Schema(sampleEntityTypes[0], sampleAttributes[1]);

      expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(schema.title).toBe('Blog Article');
      expect(schema.type).toBe('object');
      expect(schema.additionalProperties).toBe(false);

      const props = schema.properties as Record<string, any>;
      expect(props.title.type).toBe('string');
      expect(props.title.minLength).toBe(5);
      expect(props.title.maxLength).toBe(100);

      expect(props.status.type).toBe('string');
      expect(props.status.enum).toEqual(['DRAFT', 'SUBMITTED', 'PUBLISHED']);
      expect(props.status.default).toBe('DRAFT');

      expect(props.views.type).toBe('integer');
      expect(props.views.minimum).toBe(0);

      expect(schema.required).toEqual(['title', 'status']);
    });

    it('synthesizes dynamic MCP tool manifest containing all 4 core tools', () => {
      const manifest = synthesizeMcpManifest(sampleEntityTypes, sampleAttributes, 'tenant-enterprise');

      expect(manifest.name).toBe('unipost-mcp-server');
      expect(manifest.tools).toHaveLength(4);

      const toolNames = manifest.tools.map((t) => t.name);
      expect(toolNames).toContain('unipost_get_schema');
      expect(toolNames).toContain('unipost_query_entities');
      expect(toolNames).toContain('unipost_create_entity');
      expect(toolNames).toContain('unipost_execute_transition');

      // Check enum constraint in tool schema
      const getSchemaTool = manifest.tools.find((t) => t.name === 'unipost_get_schema');
      expect(getSchemaTool?.inputSchema.properties.entityType).toEqual({
        type: 'string',
        description: 'System name or ID of the entity type',
        enum: ['article', 'comment'],
      });
    });
  });

  describe('McpServer JSON-RPC 2.0 handling', () => {
    it('handles tools/list request', async () => {
      const request: McpJsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'tools/list',
      };

      const response = await mcpServer.handleJsonRpc(request);
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('req-1');
      expect((response.result as any).tools).toHaveLength(4);
    });

    it('executes unipost_get_schema tool call', async () => {
      const request: McpJsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'req-2',
        method: 'tools/call',
        params: {
          name: 'unipost_get_schema',
          arguments: { entityType: 'article' },
        },
      };

      const response = await mcpServer.handleJsonRpc(request);
      expect(response.error).toBeUndefined();
      const textContent = (response.result as any).content[0].text;
      const parsedSchema = JSON.parse(textContent);

      expect(parsedSchema.title).toBe('Blog Article');
      expect(parsedSchema.properties.title).toBeDefined();
    });

    it('executes unipost_query_entities tool call with RLS tenant context', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          body: {
            content: [{ id: 'rec-1', attributes: { title: 'First Post' } }],
            totalElements: 1,
            totalPages: 1,
            number: 1,
            size: 20,
          },
        }),
      });

      const request: McpJsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'req-3',
        method: 'tools/call',
        params: {
          name: 'unipost_query_entities',
          arguments: {
            entityType: 'article',
            page: 1,
            size: 10,
            filters: { status: 'PUBLISHED' },
          },
        },
      };

      const response = await mcpServer.handleJsonRpc(request);
      expect(response.error).toBeUndefined();
      const textContent = (response.result as any).content[0].text;
      const parsedRecords = JSON.parse(textContent);

      expect(parsedRecords.content[0].attributes.title).toBe('First Post');

      // Verify request to client carried headers and query parameters
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/metadata/entity-types/1/records');
      expect(url).toContain('size=10');
      expect(init.headers['X-Tenant-Id']).toBe('tenant-enterprise');
    });

    it('executes unipost_create_entity tool call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          body: {
            id: 'rec-100',
            entityTypeId: 1,
            attributes: { title: 'New Story', status: 'DRAFT' },
          },
        }),
      });

      const request: McpJsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'req-4',
        method: 'tools/call',
        params: {
          name: 'unipost_create_entity',
          arguments: {
            entityType: 'article',
            attributes: { title: 'New Story' },
          },
        },
      };

      const response = await mcpServer.handleJsonRpc(request);
      expect(response.error).toBeUndefined();
      const textContent = (response.result as any).content[0].text;
      const parsedResult = JSON.parse(textContent);

      expect(parsedResult.id).toBe('rec-100');
      expect(parsedResult.attributes.title).toBe('New Story');

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/metadata/entity-types/1/records');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ attributes: { title: 'New Story' } });
    });

    it('executes unipost_execute_transition tool call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          body: {
            id: 'rec-100',
            attributes: { title: 'New Story', status: 'PUBLISHED' },
          },
        }),
      });

      const request: McpJsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'req-5',
        method: 'tools/call',
        params: {
          name: 'unipost_execute_transition',
          arguments: {
            entityType: 'article',
            recordId: 'rec-100',
            action: 'PUBLISH',
            additionalAttributes: { publishDate: '2026-10-11' },
          },
        },
      };

      const response = await mcpServer.handleJsonRpc(request);
      expect(response.error).toBeUndefined();
      const textContent = (response.result as any).content[0].text;
      const parsedResult = JSON.parse(textContent);

      expect(parsedResult.attributes.status).toBe('PUBLISHED');

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/metadata/entity-types/1/records/rec-100/transition');
      expect(url).toContain('action=PUBLISH');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ publishDate: '2026-10-11' });
    });

    it('returns error when invalid jsonrpc protocol or unknown tool is invoked', async () => {
      // Invalid jsonrpc version
      const badRpcResponse = await mcpServer.handleJsonRpc({
        jsonrpc: '1.0' as any,
        id: 1,
        method: 'tools/list',
      });
      expect(badRpcResponse.error?.code).toBe(-32600);

      // Unknown method
      const unknownMethodResponse = await mcpServer.handleJsonRpc({
        jsonrpc: '2.0',
        id: 2,
        method: 'unknown/method',
      });
      expect(unknownMethodResponse.error?.code).toBe(-32601);

      // Unknown tool call
      const unknownToolResponse = await mcpServer.handleJsonRpc({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'non_existent_tool' },
      });
      expect((unknownToolResponse.result as any).isError).toBe(true);
    });
  });
});
