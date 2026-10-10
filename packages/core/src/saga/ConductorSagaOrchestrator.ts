import { Logger } from '../logger';

export interface SagaStep<TContext = any> {
  name: string;
  execute: (context: TContext) => Promise<any>;
  compensate: (context: TContext, error: Error) => Promise<void>;
}

export interface DeadLetterEntry {
  sagaId: string;
  stepName: string;
  timestamp: string;
  errorPayload: {
    message: string;
    stack?: string;
  };
  contextSnapshot: any;
  compensationStatus: 'COMPENSATED' | 'COMPENSATION_FAILED';
}

/**
 * DeadLetterQueue (DLQ):
 * In-memory & diagnostic dead letter storage for unrecoverable pipeline and SAGA failures.
 */
export class DeadLetterQueue {
  private static instance: DeadLetterQueue;
  private entries: DeadLetterEntry[] = [];
  private maxEntries: number = 100;

  public static getInstance(): DeadLetterQueue {
    if (!DeadLetterQueue.instance) {
      DeadLetterQueue.instance = new DeadLetterQueue();
    }
    return DeadLetterQueue.instance;
  }

  public enqueue(entry: DeadLetterEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    Logger.error(
      'DeadLetterQueue',
      `[DLQ RECORDED] Saga: ${entry.sagaId} at Step: ${entry.stepName} | Error: ${entry.errorPayload.message}`
    );
  }

  public getEntries(): DeadLetterEntry[] {
    return [...this.entries];
  }

  public clear(): void {
    this.entries = [];
  }
}

/**
 * ConductorSagaOrchestrator:
 * Distributed SAGA transaction coordinator providing automatic reverse compensation
 * on stage failures, resource rollback, and forwarding to Dead Letter Queue (DLQ).
 */
export class ConductorSagaOrchestrator<TContext = any> {
  private sagaId: string;
  private steps: SagaStep<TContext>[] = [];
  private executedSteps: SagaStep<TContext>[] = [];
  private dlq: DeadLetterQueue;

  public constructor(sagaId: string) {
    this.sagaId = sagaId;
    this.dlq = DeadLetterQueue.getInstance();
  }

  public addStep(step: SagaStep<TContext>): this {
    this.steps.push(step);
    return this;
  }

  public async execute(context: TContext): Promise<void> {
    Logger.info('ConductorSAGA', `Initiating SAGA [${this.sagaId}] with ${this.steps.length} step(s)`);

    for (const step of this.steps) {
      try {
        Logger.debug('ConductorSAGA', `Executing step [${step.name}]`);
        await step.execute(context);
        this.executedSteps.push(step);
      } catch (err: any) {
        Logger.error('ConductorSAGA', `Step [${step.name}] failed: ${err.message}. Triggering backward compensation...`);
        let compStatus: 'COMPENSATED' | 'COMPENSATION_FAILED' = 'COMPENSATED';

        // Backward rollback of all previously completed steps
        for (let i = this.executedSteps.length - 1; i >= 0; i--) {
          const compStep = this.executedSteps[i];
          try {
            Logger.info('ConductorSAGA', `Compensating step [${compStep.name}]...`);
            await compStep.compensate(context, err);
          } catch (compErr: any) {
            compStatus = 'COMPENSATION_FAILED';
            Logger.error('ConductorSAGA', `Failed compensating step [${compStep.name}]: ${compErr.message}`);
          }
        }

        // Also compensate the failing step itself
        try {
          await step.compensate(context, err);
        } catch (selfCompErr: any) {
          compStatus = 'COMPENSATION_FAILED';
          Logger.error('ConductorSAGA', `Failed compensating failing step [${step.name}]: ${selfCompErr.message}`);
        }

        // Enqueue diagnostic snapshot to Dead Letter Queue
        this.dlq.enqueue({
          sagaId: this.sagaId,
          stepName: step.name,
          timestamp: new Date().toISOString(),
          errorPayload: {
            message: err.message,
            stack: err.stack,
          },
          contextSnapshot: JSON.parse(JSON.stringify(context, (_, val) => (typeof val === 'bigint' ? val.toString() : val))),
          compensationStatus: compStatus,
        });

        throw err;
      }
    }

    Logger.info('ConductorSAGA', `SAGA [${this.sagaId}] completed successfully with all ${this.executedSteps.length} step(s)`);
  }
}
