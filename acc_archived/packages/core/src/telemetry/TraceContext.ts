import crypto from 'crypto';

/**
 * W3C Trace Context representation (RFC traceparent specification):
 * version (2 hex) - traceId (32 hex) - parentId / spanId (16 hex) - traceFlags (2 hex)
 * Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
 */
export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeMs: number;
  endTimeMs?: number;
  attributes: Record<string, string | number | boolean>;
}

export class TraceContext {
  public readonly traceId: string;
  public readonly spanId: string;
  public readonly parentSpanId?: string;
  public readonly traceFlags: string;

  public constructor(traceId?: string, spanId?: string, parentSpanId?: string, traceFlags = '01') {
    this.traceId = traceId || crypto.randomBytes(16).toString('hex');
    this.spanId = spanId || crypto.randomBytes(8).toString('hex');
    this.parentSpanId = parentSpanId;
    this.traceFlags = traceFlags;
  }

  /**
   * Serializes context to standard W3C `traceparent` header string.
   */
  public toTraceparent(): string {
    return `00-${this.traceId}-${this.spanId}-${this.traceFlags}`;
  }

  /**
   * Parses incoming W3C `traceparent` header string into a TraceContext.
   */
  public static fromTraceparent(header?: string | null): TraceContext {
    if (!header) {
      return new TraceContext();
    }

    const parts = header.trim().split('-');
    if (parts.length === 4 && parts[0] === '00' && parts[1].length === 32 && parts[2].length === 16) {
      return new TraceContext(parts[1], crypto.randomBytes(8).toString('hex'), parts[2], parts[3]);
    }

    return new TraceContext();
  }

  /**
   * Spawns a new child span inheriting the active traceId.
   */
  public createChildSpan(): TraceContext {
    return new TraceContext(
      this.traceId,
      crypto.randomBytes(8).toString('hex'),
      this.spanId,
      this.traceFlags
    );
  }
}
