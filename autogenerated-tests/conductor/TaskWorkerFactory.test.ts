import { test, expect, describe, beforeEach } from 'bun:test';
import { TaskWorkerFactory, IConductorTaskCommand, ConductorTaskInput, ConductorTaskOutput } from '@acc/core';

class MockCommand implements IConductorTaskCommand {
    readonly taskDefName = 'mock.test.command';
    validate(input: ConductorTaskInput): void {}
    async execute(input: ConductorTaskInput): Promise<ConductorTaskOutput> {
        return { status: 'COMPLETED', outputData: {} };
    }
}

describe('TaskWorkerFactory', () => {
    // Note: TaskWorkerFactory uses a static map. If other tests run in parallel,
    // it could theoretically be flaky, but for these unit tests it's generally fine.

    test('should register and retrieve a command', () => {
        const cmd = new MockCommand();
        TaskWorkerFactory.register(cmd);

        const retrievedCmd = TaskWorkerFactory.getCommand('mock.test.command');
        expect(retrievedCmd).toBeDefined();
        expect(retrievedCmd.taskDefName).toBe('mock.test.command');
    });

    test('should throw error for unregistered command', () => {
        expect(() => {
            TaskWorkerFactory.getCommand('unregistered.command');
        }).toThrow('[TaskWorkerFactory] Unregistered Conductor task command: unregistered.command');
    });

    test('should list all registered task names', () => {
        const cmd = new MockCommand();
        TaskWorkerFactory.register(cmd);

        const names = TaskWorkerFactory.getAllRegisteredTaskNames();
        expect(names).toContain('mock.test.command');
    });
});
