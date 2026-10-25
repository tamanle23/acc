import { describe, it, expect } from 'bun:test';
import {
  PipelineRunner,
  createUnifiedPipelineContext,
  createConcurrencyGate,
  createBoundedExecutionMiddleware,
  createDryRunValidatorMiddleware,
  XFadeTransitionCommand,
  Depth3DPopOutCommand,
} from '@acc/core';

describe('Phase 1: Core Orchestrator Enhancements Suite (@acc/core)', () => {
  describe('PipelineRunner Lifecycle Hooks & Tap', () => {
    it('fires onStageStart, onStageSuccess, and onStageError hooks in sequence', async () => {
      const runner = new PipelineRunner();
      const events: string[] = [];

      runner.setHooks({
        onStageStart: (name) => {
          events.push(`start:${name}`);
        },
        onStageSuccess: (name, duration) => {
          events.push(`success:${name}`);
        },
        onStageError: (name, err) => {
          events.push(`error:${name}:${err.message}`);
        },
      });

      runner.use({
        name: 'Stage1',
        execute: async (ctx, next) => {
          ctx.metadata.s1 = true;
          await next();
        },
      });

      runner.use({
        name: 'Stage2_Failing',
        execute: async () => {
          throw new Error('Simulated failure');
        },
      });

      runner.tap('Inspector', (ctx) => {
        ctx.metadata.tapped = true;
      });

      const ctx = createUnifiedPipelineContext({
        pipelineId: 'hooks-test',
        input: {},
      });

      const result = await runner.run(ctx);

      expect(events).toContain('start:Stage1');
      expect(events).toContain('success:Stage1');
      expect(events).toContain('start:Stage2_Failing');
      expect(events).toContain('error:Stage2_Failing:Simulated failure');
      expect(events).toContain('start:tap:Inspector');
      expect(events).toContain('success:tap:Inspector');
      expect(result.metadata.tapped).toBe(true);
    });

    it('handles AbortSignal cancellation defensively', async () => {
      const runner = new PipelineRunner();
      const controller = new AbortController();

      runner.use({
        name: 'Stage1',
        execute: async (ctx, next) => {
          controller.abort('User aborted task');
          await next();
        },
      });

      runner.use({
        name: 'Stage2',
        execute: async (ctx, next) => {
          ctx.metadata.shouldNotRun = true;
          await next();
        },
      });

      const ctx = createUnifiedPipelineContext({
        pipelineId: 'abort-test',
        input: {},
      });
      ctx.signal = controller.signal;

      expect(runner.run(ctx)).rejects.toThrow('Pipeline execution aborted');
    });
  });

  describe('Bounded Execution Middleware & Concurrency Gate', () => {
    it('restricts concurrent stage execution to maxConcurrency limit', async () => {
      const gate = createConcurrencyGate(2);
      let peakConcurrency = 0;
      let currentRunning = 0;

      const heavyMiddleware = {
        name: 'HeavyWorker',
        execute: async (ctx: any, next: any) => {
          currentRunning++;
          peakConcurrency = Math.max(peakConcurrency, currentRunning);
          await new Promise((res) => setTimeout(res, 30));
          currentRunning--;
          await next();
        },
      };

      const boundedMw = createBoundedExecutionMiddleware(heavyMiddleware, gate);

      const tasks = Array.from({ length: 6 }).map(async (_, idx) => {
        const runner = new PipelineRunner();
        runner.use(boundedMw);
        const ctx = createUnifiedPipelineContext({
          pipelineId: `concurrent-${idx}`,
          input: {},
        });
        return runner.run(ctx);
      });

      await Promise.all(tasks);

      expect(peakConcurrency).toBeLessThanOrEqual(2);
      expect(gate.activeCount()).toBe(0);
    });
  });

  describe('DryRunValidatorMiddleware', () => {
    it('validates VFX command queues and records issues without throwing', async () => {
      const runner = new PipelineRunner();
      const validator = createDryRunValidatorMiddleware();

      runner.use({
        name: 'CommandSetupStage',
        execute: async (ctx, next) => {
          // Register a valid and an invalid command
          ctx.vfxQueue.push(new Depth3DPopOutCommand('cmd_depth_1', 'scene_0')); // missing cutout -> invalid
          await next();
        },
      });

      runner.use(validator);

      const ctx = createUnifiedPipelineContext({
        pipelineId: 'dry-run-test',
        input: {},
      });

      const result = await runner.run(ctx);
      const report = result.metadata.validationReport;

      expect(report).toBeDefined();
      expect(report.valid).toBe(false);
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.errors[0]).toContain('Depth3D requires cutout');
      expect(report.commandCount).toBe(1);
    });
  });
});
