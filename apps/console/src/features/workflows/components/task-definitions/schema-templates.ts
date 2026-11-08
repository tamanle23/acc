export interface SchemaPresetTemplate {
  id: string;
  name: string;
  description: string;
  category: 'COMMERCE' | 'AI' | 'CONTENT' | 'SYSTEM' | 'CUSTOM';
  defaultTimeoutSeconds: number;
  defaultRetryCount: number;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export const SCHEMA_TEMPLATES: SchemaPresetTemplate[] = [
  {
    id: 'commerce_order',
    name: 'E-Commerce Order Validation',
    description: 'Validates cart items, sanctions screening, and credit threshold.',
    category: 'COMMERCE',
    defaultTimeoutSeconds: 30,
    defaultRetryCount: 3,
    inputSchema: {
      type: 'object',
      required: ['orderId', 'orderValue'],
      properties: {
        orderId: { type: 'string', description: 'Unique order identifier' },
        orderValue: { type: 'number', description: 'Total monetary checkout value' },
        customerTier: { type: 'string', description: 'VIP / STANDARD / TRIAL' },
        currency: { type: 'string', description: 'ISO-4217 Currency code', default: 'USD' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['valid', 'riskScore'],
      properties: {
        valid: { type: 'boolean', description: 'Whether the order passes fraud check' },
        riskScore: { type: 'number', description: '0 to 1 risk confidence score' },
        checkedAt: { type: 'string', description: 'ISO-8601 validation timestamp' },
      },
    },
  },
  {
    id: 'ai_prompt',
    name: 'AI Prompt & LLM Inference',
    description: 'Invokes foundation model with parameter tuning and static prompt extraction.',
    category: 'AI',
    defaultTimeoutSeconds: 60,
    defaultRetryCount: 2,
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'User input or instruction prompt' },
        systemInstruction: { type: 'string', description: 'System persona or constraint guidelines' },
        temperature: { type: 'number', description: 'Sampling temperature (0.0 to 1.0)', default: 0.7 },
        maxTokens: { type: 'integer', description: 'Maximum completion tokens to generate', default: 2048 },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['generatedText'],
      properties: {
        generatedText: { type: 'string', description: 'Raw generated response text' },
        tokensUsed: { type: 'integer', description: 'Total prompt + completion tokens billed' },
        model: { type: 'string', description: 'Exact inference model version used' },
      },
    },
  },
  {
    id: 'webhook_dispatch',
    name: 'HTTP / Webhook Dispatcher',
    description: 'POSTs payload to an external REST endpoint with retry backoff.',
    category: 'SYSTEM',
    defaultTimeoutSeconds: 45,
    defaultRetryCount: 3,
    inputSchema: {
      type: 'object',
      required: ['targetUrl'],
      properties: {
        targetUrl: { type: 'string', description: 'Full HTTPS target destination URL' },
        method: { type: 'string', description: 'HTTP method (POST, PUT, PATCH)', default: 'POST' },
        payload: { type: 'object', description: 'JSON request body payload' },
        headers: { type: 'object', description: 'Custom HTTP authorization or trace headers' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['statusCode'],
      properties: {
        statusCode: { type: 'integer', description: 'HTTP response status code' },
        responseBody: { type: 'string', description: 'Stringified HTTP response body' },
        durationMs: { type: 'number', description: 'Total network round-trip time in milliseconds' },
      },
    },
  },
  {
    id: 'simple_kv',
    name: 'Simple Key-Value Store / Cache',
    description: 'Sets or retrieves a value by key with TTL policy.',
    category: 'SYSTEM',
    defaultTimeoutSeconds: 15,
    defaultRetryCount: 2,
    inputSchema: {
      type: 'object',
      required: ['key', 'value'],
      properties: {
        key: { type: 'string', description: 'Unique storage or cache key' },
        value: { type: 'string', description: 'Serialized data payload' },
        ttlSeconds: { type: 'integer', description: 'Cache time-to-live in seconds', default: 3600 },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['success'],
      properties: {
        success: { type: 'boolean', description: 'True if key was successfully committed' },
        persistedAt: { type: 'string', description: 'ISO-8601 write timestamp' },
      },
    },
  },
  {
    id: 'blank',
    name: 'Blank Custom Task',
    description: 'Empty JSON Schema template ready for custom visual field configuration.',
    category: 'CUSTOM',
    defaultTimeoutSeconds: 30,
    defaultRetryCount: 3,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    outputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];
