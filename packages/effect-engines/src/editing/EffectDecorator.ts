export interface IFrameProducer {
  renderFrame(ctx: any, width: number, height: number, frameIndex: number): void;
}

export abstract class FrameProducerDecorator implements IFrameProducer {
  protected wrappedProducer: IFrameProducer;

  constructor(producer: IFrameProducer) {
    this.wrappedProducer = producer;
  }

  public renderFrame(ctx: any, width: number, height: number, frameIndex: number): void {
    this.wrappedProducer.renderFrame(ctx, width, height, frameIndex);
  }
}

export class VignetteDecorator extends FrameProducerDecorator {
  public override renderFrame(ctx: any, width: number, height: number, frameIndex: number): void {
    super.renderFrame(ctx, width, height, frameIndex);
    ctx.save();
    const grad = ctx.createRadialGradient(
      width / 2, height / 2, width * 0.3,
      width / 2, height / 2, width * 0.7
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}
