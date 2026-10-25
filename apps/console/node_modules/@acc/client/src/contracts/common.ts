// ==========================================
// 1. Standard Response & Context Headers
// ==========================================

export interface ContextHeader {
  command?: string;
  sourceUid?: string;
  version?: number;
  tenantId?: string;
  workspaceId?: string;
  [key: string]: unknown;
}

export interface ResponseWrapper<H = ContextHeader, B = unknown> {
  header?: H;
  body: B;
}

// ==========================================
// 2. RFC 7807 Problem Detail
// ==========================================

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

// ==========================================
// 3. Pagination & Query Types
// ==========================================

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // 1-indexed in Acc PageRequest
  size: number;
}

export interface PageRequestParams {
  number?: number;
  size?: number;
  sort?: string;
  tenantId?: string;
  direction?: 'incoming' | 'outgoing' | 'both';
  filters?: Record<string, string | Record<string, string>>;
  [key: string]: unknown;
}

// ==========================================
// 4. Trace & Telemetry Context
// ==========================================

export interface TraceContext {
  traceparent?: string;
  tracestate?: string;
}
