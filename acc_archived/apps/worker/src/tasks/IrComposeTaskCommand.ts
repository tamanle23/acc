import { IConductorTaskCommand, ConductorTaskInput, ConductorTaskOutput, Logger } from '@acc/core';

export class IrComposeTaskCommand implements IConductorTaskCommand {
  public readonly taskDefName = 'acc.ir.compose_video';

  public validate(input: ConductorTaskInput): void {
    if (!input.inputData || typeof input.inputData !== 'object') {
      throw new Error(`[${this.taskDefName}] Missing inputData`);
    }
  }

  public async execute(input: ConductorTaskInput): Promise<ConductorTaskOutput> {
    Logger.info('IrComposeTaskCommand', `Composing Video IR AST for task ${input.taskId}`);
    const title = input.inputData.title || 'Untitled Composition';
    const fps = input.inputData.fps || 30;
    const aspectRatio = input.inputData.aspectRatio || '16:9';

    // Construct lightweight canonical VideoIR document structure
    const videoIrDocument = {
      version: '3.1.0',
      meta: {
        title,
        fps,
        aspectRatio,
        durationFrames: 300,
        renderEngine: 'bun-ffi',
      },
      tracks: [
        {
          id: 'track-visual-main',
          type: 'visual',
          clips: [
            {
              id: 'clip-001',
              assetId: 'cosmic-nebula.png',
              startFrame: 0,
              durationFrames: 300,
              effects: [{ type: 'depth3d', intensity: 1.0 }],
            },
          ],
        },
      ],
    };

    return {
      status: 'COMPLETED',
      outputData: {
        videoIrDocument,
        totalFrames: 300,
        tracksCount: 1,
      },
      logs: [`Video IR AST composed successfully (taskId: ${input.taskId})`],
    };
  }
}
