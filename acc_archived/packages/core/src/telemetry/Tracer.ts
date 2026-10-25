import { AsyncLocalStorage } from 'async_hooks';
import { TraceContext, type TraceSpan } from './TraceContext';

export interface SpanLifecycleListener {
  onSpanStart?: (span: TraceSpan) => void;
  onSpanEnd?: (span: TraceSpan) => void;
}

/**
 * Enterprise-grade, ambient Tracer powered by Node/Bun AsyncLocalStorage.
 * Provides non-invasive context propagation and lifecycle tracking without
 * polluting domain ASTs or mutating high-performance frame loops.
 */
export class Tracer {
  private static asyncLocalStorage = new AsyncLocalStorage<TraceContext>();
  private static listeners: SpanLifecycleListener[] = [];

  /**
   * Registers a global listener for span start/end lifecycle events (e.g. for metrics, exporters).
   */
  public static addListener(listener: SpanLifecycleListener): void {
    Tracer.listeners.push(listener);
  }

  /**
   * Clears registered lifecycle listeners.
   */
  public static clearListeners(): void {
    Tracer.listeners = [];
  }

  /**
   * Returns the currently active TraceContext from ambient AsyncLocalStorage, if any.
   */
  public static currentContext(): TraceContext | undefined {
    return Tracer.asyncLocalStorage.getStore();
  }

  /**
   * Executes a synchronous or asynchronous callback within the given TraceContext.
   */
  public static runWithContext<T>(context: TraceContext, fn: () => T | Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      Tracer.asyncLocalStorage.run(context, () => {
        try {
          const result = fn();
          if (result instanceof Promise) {
            result.then(resolve, reject);
          } else {
            resolve(result);
          }
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /**
   * Non-invasively wraps an execution phase in a child span (or root span if no context exists).
   * Automatically tracks execution duration, captures errors, and propagates trace identity.
   */
  public static async withSpan<T>(
    name: string,
    fn: (span: TraceSpan) => Promise<T> | T,
    attributes: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    const parent = Tracer.currentContext();
    const activeContext = parent ? parent.createChildSpan() : new TraceContext();

    const span: TraceSpan = {
      traceId: activeContext.traceId,
      spanId: activeContext.spanId,
      parentSpanId: activeContext.parentSpanId,
      name,
      startTimeMs: Date.now(),
      attributes: { ...attributes },
    };

    for (const listener of Tracer.listeners) {
      try {
        listener.onSpanStart?.(span);
      } catch {
        // Defensive: listeners must never crash caller
      }
    }

    try {
      const result = await Tracer.runWithContext(activeContext, () => fn(span));
      span.endTimeMs = Date.now();
      span.attributes['status'] = 'OK';
      return result;
    } catch (err: any) {
      span.endTimeMs = Date.now();
      span.attributes['status'] = 'ERROR';
      span.attributes['error.message'] = err?.message || String(err);
      throw err;
    } finally {
      if (span.endTimeMs === undefined) {
        span.endTimeMs = Date.now();
      }
      for (const listener of Tracer.listeners) {
        try {
          listener.onSpanEnd?.(span);
        } catch {
          // Defensive: listeners must never crash caller
        }
      }
    }
  }
}
