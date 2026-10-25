import type { EntityType, AttributeDefinition } from '../types';
import type { McpManifest, McpToolDefinition } from './types';

/**
 * Compiles a JSON Schema Draft-07 for an EntityType and its attributes.
 */
export function compileDraft07Schema(
  entityType: EntityType,
  attributes: AttributeDefinition[]
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const attr of attributes) {
    if (attr.isArchived) continue;

    const prop: Record<string, unknown> = {
      title: attr.name,
    };

    const uiComp = (attr.uiComponent || '').toLowerCase();
    const dataType = (attr.dataType || '').toLowerCase();
    const options = attr.options || {};

    switch (uiComp) {
      case 'switch':
        prop.type = 'boolean';
        break;
      case 'number':
        prop.type = dataType === 'integer' ? 'integer' : 'number';
        if (typeof options.min === 'number') prop.minimum = options.min;
        if (typeof options.max === 'number') prop.maximum = options.max;
        break;
      case 'select':
        prop.type = 'string';
        if (Array.isArray(options.choices)) prop.enum = options.choices;
        break;
      case 'multiselect':
        prop.type = 'array';
        prop.uniqueItems = true;
        prop.items = {
          type: 'string',
          ...(Array.isArray(options.choices) ? { enum: options.choices } : {}),
        };
        break;
      case 'datepicker':
        prop.type = 'string';
        prop.format = (options.format as string)?.toLowerCase() === 'date' ? 'date' : 'date-time';
        break;
      case 'json_editor':
        prop.type = 'object';
        break;
      case 'relation_picker':
        prop.type = dataType === 'integer' || dataType === 'number' ? 'integer' : 'string';
        break;
      case 'signature_pad':
      case 'barcode_scanner':
        prop.type = 'string';
        break;
      case 'geo_location':
        prop.type = 'object';
        prop.properties = {
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          address: { type: 'string' },
        };
        break;
      default:
        prop.type = 'string';
        if (options.pattern) prop.pattern = options.pattern;
        if (typeof options.min === 'number') prop.minLength = options.min;
        if (typeof options.max === 'number') prop.maxLength = options.max;
        break;
    }

    if (attr.defaultValue !== undefined && attr.defaultValue !== '') {
      prop.default = attr.defaultValue;
    }

    properties[attr.systemName] = prop;

    if (attr.isRequired) {
      required.push(attr.systemName);
    }
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: entityType.name,
    description: entityType.description || `Entity type ${entityType.systemName}`,
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

/**
 * Synthesizes dynamic Model Context Protocol (MCP) tool manifests directly from active tenant UNIPOST_ENTITY_TYPES.
 *
 * Implements the 4 core agent tools:
 * 1. acc_get_schema: Returns JSON Schema Draft-07 for specified entity type.
 * 2. acc_query_entities: RLS-scoped search with pagination and filtering.
 * 3. acc_execute_transition: Executes FSM lifecycle state machine transitions with parameter validation.
 * 4. acc_create_entity: Validates attributes against server schema and creates records.
 */
export function synthesizeMcpManifest(
  entityTypes: EntityType[],
  _attributeMap: Record<string | number, AttributeDefinition[]> = {},
  tenantId?: string
): McpManifest {
  const entityTypeEnum = entityTypes.map((et) => et.systemName);

  const tools: McpToolDefinition[] = [
    {
      name: 'acc_get_schema',
      description: 'Returns JSON Schema Draft-07 definition for a specified Unipost entity type.',
      inputSchema: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          entityType: {
            type: 'string',
            description: 'System name or ID of the entity type',
            ...(entityTypeEnum.length > 0 ? { enum: entityTypeEnum } : {}),
          },
        },
        required: ['entityType'],
        additionalProperties: false,
      },
    },
    {
      name: 'acc_query_entities',
      description: 'Performs RLS-scoped search, filtering, and pagination over Unipost entity records.',
      inputSchema: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          entityType: {
            type: 'string',
            description: 'System name or ID of the entity type to query',
            ...(entityTypeEnum.length > 0 ? { enum: entityTypeEnum } : {}),
          },
          page: {
            type: 'integer',
            description: '1-indexed page number (default: 1)',
            minimum: 1,
          },
          size: {
            type: 'integer',
            description: 'Number of records per page (default: 20)',
            minimum: 1,
            maximum: 100,
          },
          filters: {
            type: 'object',
            description: 'Map of field system names and values to filter by equality or criteria',
            additionalProperties: true,
          },
          sort: {
            type: 'string',
            description: 'Sort field and direction (e.g. "createdDate,desc")',
          },
        },
        required: ['entityType'],
        additionalProperties: false,
      },
    },
    {
      name: 'acc_create_entity',
      description: 'Validates attributes against server schema and creates an entity record.',
      inputSchema: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          entityType: {
            type: 'string',
            description: 'System name or ID of the entity type',
            ...(entityTypeEnum.length > 0 ? { enum: entityTypeEnum } : {}),
          },
          attributes: {
            type: 'object',
            description: 'Key-value map of dynamic entity record attributes matching the entity schema',
            additionalProperties: true,
          },
        },
        required: ['entityType', 'attributes'],
        additionalProperties: false,
      },
    },
    {
      name: 'acc_execute_transition',
      description: 'Executes an FSM lifecycle state machine transition on an entity record with 5-gate validation.',
      inputSchema: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          entityType: {
            type: 'string',
            description: 'System name or ID of the entity type',
            ...(entityTypeEnum.length > 0 ? { enum: entityTypeEnum } : {}),
          },
          recordId: {
            type: 'string',
            description: 'Target entity record ID',
          },
          action: {
            type: 'string',
            description: 'FSM transition trigger action (e.g., "SUBMIT", "APPROVE", "REJECT", "PUBLISH")',
          },
          additionalAttributes: {
            type: 'object',
            description: 'Optional field mutations or parameters persisted alongside the state transition',
            additionalProperties: true,
          },
        },
        required: ['entityType', 'recordId', 'action'],
        additionalProperties: false,
      },
    },
  ];

  return {
    name: 'acc-mcp-server',
    version: '1.0.0',
    description: `Dynamic MCP Agent Tools synthesized for Unipost tenant [${tenantId || 'default'}]`,
    tools,
  };
}
