import { test, expect, describe } from 'bun:test';
import { ConductorPipelineAdapter, ConductorTaskInput } from '@acc/core';

describe('ConductorPipelineAdapter', () => {
    test('should create a UnifiedPipelineContext correctly', () => {
        const mockTaskInput: ConductorTaskInput = {
            taskId: 'test-task-123',
            workflowInstanceId: 'workflow-instance-456',
            taskDefName: 'test.task',
            inputData: { someKey: 'someValue' }
        };

        const ctx = ConductorPipelineAdapter.createContext(mockTaskInput);

        expect(ctx).toBeDefined();
        expect(ctx.input).toEqual({ someKey: 'someValue' });
        expect(ctx.metadata.taskId).toBe('test-task-123');
        expect(ctx.metadata.workflowInstanceId).toBe('workflow-instance-456');
        expect(ctx.metadata.taskDefName).toBe('test.task');
        expect(ctx.metadata.startTime).toBeDefined();

        expect(ctx.assetContext).toBeDefined();
        // AssetContext doesn't natively store storyId or workDir publicly as properties based on current implementation
        // But the context adapter successfully constructs it without error.
        expect(ctx.outputs).toEqual({});
    });
});
