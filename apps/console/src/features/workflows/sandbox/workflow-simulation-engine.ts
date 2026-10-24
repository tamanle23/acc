import {
  SIMULATION_SCENARIOS,
  type SimulationScenarioId,
  type SimulationStepEvent,
} from './simulation-scenarios';
import { sandboxResetRegistry } from '@unipost/sandbox';

export type SimulationSpeed = '1x' | '2x' | '5x' | 'step';

export interface WorkflowSimulationStatus {
  isRunning: boolean;
  isPaused: boolean;
  activeScenarioId: SimulationScenarioId;
  speed: SimulationSpeed;
  currentEventIndex: number;
  totalEvents: number;
  currentExecutionId: string | null;
}

export type SimulationEventCallback = (event: {
  type: string;
  data: string;
}) => void;

/**
 * High-fidelity browser Mock EventSource interceptor for workflow simulation.
 * Emits SSE frames matching Spring Boot broadaster schema directly into useWorkflowExecutionStream.
 */
export class WorkflowSimulationEngine {
  private static instance: WorkflowSimulationEngine | null = null;

  private activeScenarioId: SimulationScenarioId = 'HAPPY_PATH';
  private speed: SimulationSpeed = '2x';
  private currentEventIndex = 0;
  private isRunning = false;
  private isPaused = false;
  private currentExecutionId: string | null = null;
  private timerRef: ReturnType<typeof setTimeout> | null = null;

  // Active listeners by executionId
  private listeners: Map<string, Set<SimulationEventCallback>> = new Map();
  private statusSubscribers: Set<(status: WorkflowSimulationStatus) => void> = new Set();

  private originalEventSource: typeof EventSource | null = null;
  private isEventSourceIntercepted = false;

  private constructor() {
    sandboxResetRegistry.register(() => this.reset());
  }

  public static getInstance(): WorkflowSimulationEngine {
    if (!WorkflowSimulationEngine.instance) {
      WorkflowSimulationEngine.instance = new WorkflowSimulationEngine();
    }
    return WorkflowSimulationEngine.instance;
  }

  /**
   * Install the EventSource interceptor in window / globalThis.
   * Transparent fall-through: if URL doesn't match sim_order_ or /api/v1/workflow/executions/sim_,
   * it delegates seamlessly to the original browser EventSource.
   */
  public installInterceptor(): void {
    if (typeof window === 'undefined' || this.isEventSourceIntercepted) return;

    this.originalEventSource = window.EventSource;
    const self = this;

    // Custom Mock EventSource class
    class InterceptedEventSource implements EventSource {
      public url: string;
      public withCredentials = false;
      public readyState = 0;
      public CONNECTING = 0 as const;
      public OPEN = 1 as const;
      public CLOSED = 2 as const;

      public onopen: ((this: EventSource, ev: Event) => any) | null = null;
      public onmessage: ((this: EventSource, ev: MessageEvent) => any) | null = null;
      public onerror: ((this: EventSource, ev: Event) => any) | null = null;

      private isSimulated = false;
      private simExecutionId: string | null = null;
      private eventListeners: Map<string, Array<(e: MessageEvent) => void>> = new Map();
      private realInstance: EventSource | null = null;
      private unsubscribeFromEngine: (() => void) | null = null;

      constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
        const urlStr = url.toString();
        this.url = urlStr;

        // Check if this URL is for a simulated execution
        const simMatch = urlStr.match(/\/workflow\/executions\/(sim_[^/]+)\/events/);
        if (simMatch) {
          this.isSimulated = true;
          this.simExecutionId = simMatch[1];
          this.readyState = this.OPEN;

          // Connect to simulation engine
          setTimeout(() => {
            if (this.onopen) {
              this.onopen.call(this, new Event('open'));
            }
            this.dispatchToListeners('CONNECTED', { message: 'Simulation channel connected' });
          }, 20);

          this.unsubscribeFromEngine = self.subscribeToExecution(
            this.simExecutionId,
            (evt) => {
              this.dispatchToListeners(evt.type, JSON.parse(evt.data));
            }
          );
        } else if (self.originalEventSource) {
          // Transparent fallback to real browser EventSource
          this.realInstance = new self.originalEventSource(url, eventSourceInitDict);
          this.realInstance.onopen = (e) => this.onopen?.call(this, e);
          this.realInstance.onmessage = (e) => this.onmessage?.call(this, e);
          this.realInstance.onerror = (e) => this.onerror?.call(this, e);
        }
      }

      addEventListener(type: string, listener: any): void {
        if (this.isSimulated) {
          if (!this.eventListeners.has(type)) {
            this.eventListeners.set(type, []);
          }
          this.eventListeners.get(type)!.push(listener);
        } else if (this.realInstance) {
          this.realInstance.addEventListener(type, listener);
        }
      }

      removeEventListener(type: string, listener: any): void {
        if (this.isSimulated) {
          const arr = this.eventListeners.get(type);
          if (arr) {
            this.eventListeners.set(type, arr.filter((l) => l !== listener));
          }
        } else if (this.realInstance) {
          this.realInstance.removeEventListener(type, listener);
        }
      }

      dispatchEvent(event: Event): boolean {
        if (this.realInstance) {
          return this.realInstance.dispatchEvent(event);
        }
        return true;
      }

      close(): void {
        this.readyState = this.CLOSED;
        if (this.unsubscribeFromEngine) {
          this.unsubscribeFromEngine();
          this.unsubscribeFromEngine = null;
        }
        if (this.realInstance) {
          this.realInstance.close();
        }
      }

      private dispatchToListeners(eventType: string, payload: unknown) {
        const msgEvent = new MessageEvent(eventType, {
          data: JSON.stringify(payload),
        });
        const listeners = this.eventListeners.get(eventType) || [];
        listeners.forEach((l) => {
          try {
            l(msgEvent);
          } catch {
            // ignore handler error
          }
        });
      }
    }

    (window as any).EventSource = InterceptedEventSource;
    this.isEventSourceIntercepted = true;
  }

  public uninstallInterceptor(): void {
    if (this.originalEventSource && typeof window !== 'undefined') {
      window.EventSource = this.originalEventSource;
      this.isEventSourceIntercepted = false;
    }
  }

  public getStatus(): WorkflowSimulationStatus {
    const scenario = SIMULATION_SCENARIOS[this.activeScenarioId];
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      activeScenarioId: this.activeScenarioId,
      speed: this.speed,
      currentEventIndex: this.currentEventIndex,
      totalEvents: scenario ? scenario.events.length : 0,
      currentExecutionId: this.currentExecutionId,
    };
  }

  public subscribeStatus(callback: (status: WorkflowSimulationStatus) => void): () => void {
    this.statusSubscribers.add(callback);
    callback(this.getStatus());
    return () => {
      this.statusSubscribers.delete(callback);
    };
  }

  private notifyStatus(): void {
    const status = this.getStatus();
    this.statusSubscribers.forEach((cb) => cb(status));
  }

  /**
   * Start executing a simulation scenario.
   * Returns generated executionId (e.g. sim_order_pipeline_12345).
   */
  public start(scenarioId: SimulationScenarioId = 'HAPPY_PATH', speed: SimulationSpeed = '2x'): string {
    this.ensureInterceptorInstalled();
    this.resetTimer();

    this.activeScenarioId = scenarioId;
    this.speed = speed;
    this.currentEventIndex = 0;
    this.isRunning = true;
    this.isPaused = false;
    this.currentExecutionId = `sim_order_pipeline_${Date.now()}`;

    this.notifyStatus();

    if (this.speed !== 'step') {
      this.scheduleNextEvent();
    }

    return this.currentExecutionId;
  }

  public pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.resetTimer();
    this.notifyStatus();
  }

  public resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.notifyStatus();
    if (this.speed !== 'step') {
      this.scheduleNextEvent();
    }
  }

  public setSpeed(speed: SimulationSpeed): void {
    this.speed = speed;
    this.notifyStatus();
    if (this.isRunning && !this.isPaused && speed !== 'step') {
      this.resetTimer();
      this.scheduleNextEvent();
    }
  }

  /**
   * Trigger next event manually (for Step-by-Step mode or debug stepping)
   */
  public stepNext(): boolean {
    if (!this.isRunning) return false;
    return this.dispatchNextEvent();
  }

  public stop(): void {
    this.resetTimer();
    this.isRunning = false;
    this.isPaused = false;
    this.notifyStatus();
  }

  public reset(): void {
    this.stop();
    this.currentEventIndex = 0;
    this.currentExecutionId = null;
    this.notifyStatus();
  }

  private ensureInterceptorInstalled(): void {
    if (!this.isEventSourceIntercepted) {
      this.installInterceptor();
    }
  }

  private resetTimer(): void {
    if (this.timerRef) {
      clearTimeout(this.timerRef);
      this.timerRef = null;
    }
  }

  private getDelayForSpeed(): number {
    switch (this.speed) {
      case '1x':
        return 900;
      case '2x':
        return 450;
      case '5x':
        return 160;
      case 'step':
        return 0;
      default:
        return 450;
    }
  }

  private scheduleNextEvent(): void {
    this.resetTimer();
    if (!this.isRunning || this.isPaused || this.speed === 'step') return;

    const delay = this.getDelayForSpeed();
    this.timerRef = setTimeout(() => {
      const hasMore = this.dispatchNextEvent();
      if (hasMore && this.isRunning && !this.isPaused && this.speed !== 'step') {
        this.scheduleNextEvent();
      }
    }, delay);
  }

  private dispatchNextEvent(): boolean {
    const scenario = SIMULATION_SCENARIOS[this.activeScenarioId];
    if (!scenario || this.currentEventIndex >= scenario.events.length) {
      this.isRunning = false;
      this.isPaused = false;
      this.notifyStatus();
      return false;
    }

    const event = scenario.events[this.currentEventIndex];
    this.currentEventIndex++;
    this.notifyStatus();

    this.broadcastEvent(event);

    if (this.currentEventIndex >= scenario.events.length) {
      this.isRunning = false;
      this.isPaused = false;
      this.notifyStatus();
      return false;
    }

    return true;
  }

  private broadcastEvent(event: SimulationStepEvent): void {
    if (!this.currentExecutionId) return;

    const payload = {
      workflowId: 'order-fulfillment-pipeline',
      executionId: this.currentExecutionId,
      taskReferenceName: event.taskRef,
      taskId: event.taskRef ? `task_${event.taskRef}` : undefined,
      status: event.status,
      level: event.level,
      message: event.message,
      workerId: event.workerId,
      output: event.output,
      error: event.error,
      reason: event.reason,
      timestamp: Date.now(),
    };

    const listeners = this.listeners.get(this.currentExecutionId);
    if (listeners) {
      listeners.forEach((cb) => {
        try {
          cb({ type: event.eventType, data: JSON.stringify(payload) });
        } catch {
          // ignore error
        }
      });
    }
  }

  public subscribeToExecution(
    executionId: string,
    callback: SimulationEventCallback
  ): () => void {
    if (!this.listeners.has(executionId)) {
      this.listeners.set(executionId, new Set());
    }
    this.listeners.get(executionId)!.add(callback);

    return () => {
      const set = this.listeners.get(executionId);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.listeners.delete(executionId);
        }
      }
    };
  }
}

export const workflowSimulationEngine = WorkflowSimulationEngine.getInstance();
