import { describe, it, expect } from 'bun:test';
import { TaskWorkerFactory } from '@acc/core';
import { BackendHypervisor } from '../apps/worker/src/hypervisor/BackendHypervisor.js';
import { OllamaBackendAdapter } from '../apps/worker/src/hypervisor/OllamaBackendAdapter.js';
import { PythonBackendAdapter } from '../apps/worker/src/hypervisor/PythonBackendAdapter.js';
import { StoryScriptTaskCommand } from '../apps/worker/src/tasks/StoryScriptTaskCommand.js';
import { TtsSynthesizeTaskCommand } from '../apps/worker/src/tasks/TtsSynthesizeTaskCommand.js';
import { IrComposeTaskCommand } from '../apps/worker/src/tasks/IrComposeTaskCommand.js';

describe('Worker Core Task Commands Suite', () => {
  const hypervisor = new BackendHypervisor();
  // Using high random ports where nothing is listening to test deterministic fallbacks
  hypervisor.registerAdapter(new OllamaBackendAdapter(64123));
  hypervisor.registerAdapter(new PythonBackendAdapter(64124));

  const storyCmd = new StoryScriptTaskCommand(hypervisor);
  const ttsCmd = new TtsSynthesizeTaskCommand(hypervisor);
  const irCmd = new IrComposeTaskCommand();

  TaskWorkerFactory.register(storyCmd);
  TaskWorkerFactory.register(ttsCmd);
  TaskWorkerFactory.register(irCmd);

  it('should register all 3 core task commands with TaskWorkerFactory', () => {
    const tasks = TaskWorkerFactory.getAllRegisteredTaskNames();
    expect(tasks).toContain('acc.story.generate_script');
    expect(tasks).toContain('acc.tts.synthesize_speech');
    expect(tasks).toContain('acc.ir.compose_video');
  });

  it('should execute StoryScriptTaskCommand and fallback gracefully if LLM is offline', async () => {
    const input = {
      taskId: 'story-task-1',
      workflowInstanceId: 'wf-1',
      taskDefName: 'acc.story.generate_script',
      inputData: { prompt: 'Epic saga in deep space' },
    };

    storyCmd.validate(input);
    const output = await storyCmd.execute(input);

    expect(output.status).toBe('COMPLETED');
    expect(output.outputData.script).toBeDefined();
    expect(output.outputData.scenesCount).toBe(2);
  });

  it('should execute TtsSynthesizeTaskCommand and fallback gracefully if Python backend is offline', async () => {
    const input = {
      taskId: 'tts-task-1',
      workflowInstanceId: 'wf-2',
      taskDefName: 'acc.tts.synthesize_speech',
      inputData: { text: 'In deep quiet of cosmos', voiceId: 'af_sky' },
    };

    ttsCmd.validate(input);
    const output = await ttsCmd.execute(input);

    expect(output.status).toBe('COMPLETED');
    expect(output.outputData.voiceId).toBe('af_sky');
    expect(output.outputData.bytesLength).toBeGreaterThan(0);
  });

  it('should execute IrComposeTaskCommand and produce valid Video IR AST', async () => {
    const input = {
      taskId: 'ir-task-1',
      workflowInstanceId: 'wf-3',
      taskDefName: 'acc.ir.compose_video',
      inputData: { title: 'Test Cosmic Story', fps: 30, aspectRatio: '16:9' },
    };

    irCmd.validate(input);
    const output = await irCmd.execute(input);

    expect(output.status).toBe('COMPLETED');
    expect(output.outputData.videoIrDocument).toBeDefined();
    expect(output.outputData.videoIrDocument.version).toBe('3.1.0');
    expect(output.outputData.videoIrDocument.meta.title).toBe('Test Cosmic Story');
    expect(output.outputData.videoIrDocument.tracks.length).toBe(1);
  });
});
