/**
 * FetchEventSource - Zero-leak HTTP header-authenticated Server-Sent Events client.
 *
 * Replaces native browser EventSource to eliminate authentication tokens in URLs (RFC 6750 §2.3 / OWASP A02).
 * Transmits JWT credentials securely via standard HTTP Authorization: Bearer headers.
 */

export interface FetchEventSourceInit {
  headers?: Record<string, string>;
  token?: string | null;
  /** Base reconnection delay in ms (default 3000) */
  reconnectInterval?: number;
  /** Maximum reconnect attempts (default 5, set to 0 for infinite retry) */
  maxRetries?: number;
  /** Whether to simulate connected state in offline sandbox mode without making network calls */
  isSandbox?: boolean;
}

export interface SseEvent {
  type: string;
  data: string;
  lastEventId?: string;
}

export type SseEventListener = (event: SseEvent) => void;

export class FetchEventSource {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSED = 2;

  public url: string;
  public readyState: number = FetchEventSource.CONNECTING;
  public onopen: (() => void) | null = null;
  public onmessage: ((event: SseEvent) => void) | null = null;
  public onerror: ((error: Error) => void) | null = null;

  private listeners: Map<string, Set<SseEventListener>> = new Map();
  private abortController: AbortController | null = null;
  private isClosed: boolean = false;
  private retryCount: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private options: FetchEventSourceInit;

  constructor(url: string, options: FetchEventSourceInit = {}) {
    this.url = url;
    this.options = options;
    queueMicrotask(() => {
      if (!this.isClosed) {
        this.connect();
      }
    });
  }

  public addEventListener(type: string, listener: SseEventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  public removeEventListener(type: string, listener: SseEventListener): void {
    const set = this.listeners.get(type);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(type);
      }
    }
  }

  public dispatchEvent(event: SseEvent): boolean {
    const list = this.listeners.get(event.type);
    if (list) {
      list.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error(`FetchEventSource listener error for event '${event.type}':`, err);
        }
      });
    }
    if (event.type === 'message' && this.onmessage) {
      try {
        this.onmessage(event);
      } catch (err) {
        console.error('FetchEventSource onmessage error:', err);
      }
    }
    return true;
  }

  public close(): void {
    this.isClosed = true;
    this.readyState = FetchEventSource.CLOSED;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async connect(): Promise<void> {
    if (this.isClosed) return;

    // Offline sandbox mode bypass: simulate immediate successful connection
    if (this.options.isSandbox) {
      this.readyState = FetchEventSource.OPEN;
      if (this.onopen) this.onopen();
      const openListeners = this.listeners.get('open');
      if (openListeners) {
        openListeners.forEach((cb) => cb({ type: 'open', data: '' }));
      }
      return;
    }

    this.readyState = FetchEventSource.CONNECTING;
    this.abortController = new AbortController();

    const requestHeaders: Record<string, string> = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...(this.options.headers || {}),
    };

    if (this.options.token) {
      requestHeaders['Authorization'] = `Bearer ${this.options.token}`;
    }

    try {
      const response = await fetch(this.url, {
        method: 'GET',
        headers: requestHeaders,
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const error = new Error(`SSE HTTP error ${response.status}: ${response.statusText}`);
        // For authentication/authorization errors, halt immediately without spamming reconnects
        if (response.status === 401 || response.status === 403) {
          this.close();
          if (this.onerror) this.onerror(error);
          return;
        }
        throw error;
      }

      this.readyState = FetchEventSource.OPEN;
      this.retryCount = 0;
      if (this.onopen) this.onopen();
      const openListeners = this.listeners.get('open');
      if (openListeners) {
        openListeners.forEach((cb) => cb({ type: 'open', data: '' }));
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (!this.isClosed) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r\n\r\n|\n\n/);
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          if (!block.trim()) continue;
          this.parseBlock(block);
        }
      }

      if (!this.isClosed) {
        this.scheduleReconnect();
      }
    } catch (err: unknown) {
      if (this.isClosed) return;
      const isAbort =
        err instanceof DOMException
          ? err.name === 'AbortError'
          : (err as { name?: string })?.name === 'AbortError';
      if (isAbort) return;

      this.readyState = FetchEventSource.CLOSED;
      const errorObj = err instanceof Error ? err : new Error(String(err));
      if (this.onerror) this.onerror(errorObj);
      this.scheduleReconnect();
    }
  }

  private parseBlock(block: string): void {
    let eventType = 'message';
    const dataLines: string[] = [];
    let id: string | undefined;

    for (const rawLine of block.split(/\r\n|\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith(':')) {
        // SSE comment / heartbeat ping
        continue;
      }
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      } else if (line.startsWith('id:')) {
        id = line.slice(3).trim();
      }
    }

    if (dataLines.length > 0 || eventType !== 'message') {
      const event: SseEvent = {
        type: eventType,
        data: dataLines.join('\n'),
        lastEventId: id,
      };
      this.dispatchEvent(event);
    }
  }

  private scheduleReconnect(): void {
    if (this.isClosed) return;
    const maxRetries = this.options.maxRetries ?? 5;
    if (maxRetries > 0 && this.retryCount >= maxRetries) {
      this.close();
      return;
    }

    this.retryCount++;
    const baseInterval = this.options.reconnectInterval ?? 3000;
    const backoff = Math.min(baseInterval * Math.pow(1.5, this.retryCount - 1), 30000);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, backoff);
  }
}

export function createFetchEventSource(
  url: string,
  options?: FetchEventSourceInit
): FetchEventSource {
  return new FetchEventSource(url, options);
}
