export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
    $schema?: string;
  };
}

export interface McpManifest {
  name: string;
  version: string;
  description?: string;
  tools: McpToolDefinition[];
}

export interface McpJsonRpcRequest<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: T;
}

export interface McpJsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpToolCallResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}
