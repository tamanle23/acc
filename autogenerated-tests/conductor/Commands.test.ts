import { test, expect, describe } from 'bun:test';
import { ComposeVideoTaskCommand, RenderBarChartRaceTaskCommand, ConductorTaskInput } from '@acc/core';

describe('ComposeVideoTaskCommand', () => {
    const cmd = new ComposeVideoTaskCommand();

    test('should validate successfully with storyConfig', () => {
        const input: ConductorTaskInput = {
            taskId: 't1',
            workflowInstanceId: 'w1',
            taskDefName: 'acc.p4_story.compose_video',
            inputData: { storyConfig: { scene: 1 } }
        };
        expect(() => cmd.validate(input)).not.toThrow();
    });

    test('should throw validation error if storyConfig is missing', () => {
        const input: ConductorTaskInput = {
            taskId: 't1',
            workflowInstanceId: 'w1',
            taskDefName: 'acc.p4_story.compose_video',
            inputData: { someOtherData: true }
        };
        expect(() => cmd.validate(input)).toThrow('[ComposeVideoTaskCommand] Missing storyConfig in task inputData');
    });

    test('should execute and return COMPLETED status', async () => {
         const input: ConductorTaskInput = {
            taskId: 't1',
            workflowInstanceId: 'w1',
            taskDefName: 'acc.p4_story.compose_video',
            inputData: { storyConfig: { scene: 1 } }
        };
        const result = await cmd.execute(input);
        expect(result.status).toBe('COMPLETED');
        expect(result.outputData.videoPath).toContain('conductor_output_w1.mp4');
        expect(result.outputData.renderedScenesCount).toBe(3);
    });
});

describe('RenderBarChartRaceTaskCommand', () => {
    const cmd = new RenderBarChartRaceTaskCommand();

    test('should validate successfully with timeSeriesData', () => {
        const input: ConductorTaskInput = {
            taskId: 't2',
            workflowInstanceId: 'w2',
            taskDefName: 'acc.p2_db.render_barchart_race',
            inputData: { timeSeriesData: [] }
        };
        expect(() => cmd.validate(input)).not.toThrow();
    });

    test('should throw validation error if timeSeriesData is missing', () => {
        const input: ConductorTaskInput = {
            taskId: 't2',
            workflowInstanceId: 'w2',
            taskDefName: 'acc.p2_db.render_barchart_race',
            inputData: { config: true }
        };
        expect(() => cmd.validate(input)).toThrow('[RenderBarChartRaceTaskCommand] Missing timeSeriesData in task input');
    });

    test('should execute and return COMPLETED status', async () => {
         const input: ConductorTaskInput = {
            taskId: 't2',
            workflowInstanceId: 'w2',
            taskDefName: 'acc.p2_db.render_barchart_race',
            inputData: { timeSeriesData: [] }
        };
        const result = await cmd.execute(input);
        expect(result.status).toBe('COMPLETED');
        expect(result.outputData.artifactUrls).toEqual(['https://example.com/barchart1.mp4']);
    });
});
