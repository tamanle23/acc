import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { PreviewWorkerCoordinator } from '../apps/studio/src/renderer/PreviewWorkerCoordinator';
import { UniversalLogger as Logger, LogLevel, ConsoleLoggerSink, type IUniversalLoggerSink } from '@acc/core-isomorphic';

describe('PreviewWorkerCoordinator - Single Warmup Dispatch & Passive Barrier', () => {
  let originalWindow: any;
  let originalDocument: any;
  let originalWorker: any;

  beforeEach(() => {
    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;
    originalWorker = (globalThis as any).Worker;
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).Worker = originalWorker;
  });

  it('in-process fallback: marks warmed up immediately and resolves waitForWarmup', async () => {
    // In Bun/Node environment without window/Worker, coordinator falls back to in-process
    const coordinator = new PreviewWorkerCoordinator();
    expect(coordinator.getIsWarmedUp()).toBe(true);
    expect(coordinator.getIsWarmingUp()).toBe(false);

    const warmed = await coordinator.waitForWarmup(100);
    expect(warmed).toBe(true);

    // Repeated warmup call is a no-op
    coordinator.warmup();
    expect(coordinator.getIsWarmedUp()).toBe(true);
  });

  it('worker environment: initiates warmup exactly once during initWorker() and guards against duplicate dispatch', async () => {
    const messagesPosted: any[] = [];
    let workerInstance: any = null;

    class MockWorker {
      public onmessage: ((e: MessageEvent) => void) | null = null;
      public onerror: ((e: any) => void) | null = null;

      constructor(public url: URL, public options?: any) {
        workerInstance = this;
      }

      public postMessage(msg: any): void {
        messagesPosted.push(msg);
      }

      public terminate(): void {}
    }

    (globalThis as any).window = {};
    (globalThis as any).document = {};
    (globalThis as any).Worker = MockWorker;

    const dummyUrl = new URL('http://localhost/mock-worker.js');
    const coordinator = new PreviewWorkerCoordinator(dummyUrl);

    // 1. Worker created and warmup dispatched immediately in constructor
    expect(workerInstance).not.toBeNull();
    expect(messagesPosted.length).toBe(1);
    expect(messagesPosted[0]).toEqual({ type: 'WARMUP' });
    expect(coordinator.getIsWarmingUp()).toBe(true);
    expect(coordinator.getIsWarmedUp()).toBe(false);

    // 2. Calling warmup() while warming up is a no-op (no second postMessage)
    coordinator.warmup();
    expect(messagesPosted.length).toBe(1);

    // 3. waitForWarmup() is a passive barrier: does NOT dispatch another WARMUP message
    let resolved = false;
    const warmupPromise = coordinator.waitForWarmup(2000).then((res) => {
      resolved = true;
      return res;
    });

    expect(messagesPosted.length).toBe(1);
    expect(resolved).toBe(false);

    // Another caller also waits on the same barrier
    let secondResolved = false;
    const secondPromise = coordinator.waitForWarmup(2000).then((res) => {
      secondResolved = true;
      return res;
    });
    expect(messagesPosted.length).toBe(1);

    // 4. Worker finishes warming up and replies
    workerInstance.onmessage({
      data: { type: 'WARMED_UP' },
    } as MessageEvent);

    const [res1, res2] = await Promise.all([warmupPromise, secondPromise]);
    expect(res1).toBe(true);
    expect(res2).toBe(true);
    expect(resolved).toBe(true);
    expect(secondResolved).toBe(true);

    expect(coordinator.getIsWarmingUp()).toBe(false);
    expect(coordinator.getIsWarmedUp()).toBe(true);

    // 5. Subsequent warmup() call after being warmed up is a no-op
    coordinator.warmup();
    expect(messagesPosted.length).toBe(1);
  });

  it('worker environment: warns if duplicate WARMED_UP response is received from worker', async () => {
    let workerInstance: any = null;

    class MockWorker {
      public onmessage: ((e: MessageEvent) => void) | null = null;
      public onerror: ((e: any) => void) | null = null;

      constructor(public url: URL, public options?: any) {
        workerInstance = this;
      }

      public postMessage(_msg: any): void {}
      public terminate(): void {}
    }

    (globalThis as any).window = {};
    (globalThis as any).document = {};
    (globalThis as any).Worker = MockWorker;

    const dummyUrl = new URL('http://localhost/mock-worker.js');
    const coordinator = new PreviewWorkerCoordinator(dummyUrl);

    // Mock logger sink to observe warn logs
    const loggedEntries: Array<{ level: LogLevel; namespace: string; message: string }> = [];
    const testSink: IUniversalLoggerSink = {
      log: (level: LogLevel, namespace: string, message: string) => {
        loggedEntries.push({ level, namespace, message });
      },
    };
    Logger.setSink(testSink);

    try {
      // First WARMED_UP
      workerInstance.onmessage({
        data: { type: 'WARMED_UP' },
      } as MessageEvent);

      expect(coordinator.getIsWarmedUp()).toBe(true);
      expect(loggedEntries.some((e) => e.level === LogLevel.INFO && e.message.includes('Sidecar worker successfully warmed up.'))).toBe(true);
      expect(loggedEntries.some((e) => e.level === LogLevel.WARN && e.message.includes('Duplicate WARMED_UP'))).toBe(false);

      // Second duplicate WARMED_UP - should emit warning without crash
      workerInstance.onmessage({
        data: { type: 'WARMED_UP' },
      } as MessageEvent);

      expect(loggedEntries.some((e) => e.level === LogLevel.WARN && e.message.includes('Duplicate WARMED_UP response received'))).toBe(true);
    } finally {
      // Restore default console sink
      Logger.setSink(new ConsoleLoggerSink());
    }
  });
});
