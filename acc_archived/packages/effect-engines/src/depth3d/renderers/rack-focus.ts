import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawImageCover } from '../frame-breaker';

export class RackFocusRenderer implements IDepth3DRenderer {
  readonly mode = 'rack_focus';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, progress } = state;
    ctx.save();
    // Smooth Transition Shift: Background in focus -> Foreground in focus
    const focusShift = Math.sin(progress * Math.PI); // 0 -> 1 -> 0

    // Background Pass
    ctx.save();
    if (focusShift > 0.5) {
      ctx.filter = `blur(${Math.round((focusShift - 0.5) * 20)}px)`;
    }
    drawImageCover(ctx, img, 0, 0, width, height);
    ctx.restore();

    // Foreground Subject Pass
    if (subjectImg) {
      ctx.save();
      if (focusShift <= 0.5) {
        ctx.filter = `blur(${Math.round((0.5 - focusShift) * 20)}px)`;
      }
      drawImageCover(ctx, subjectImg, 0, 0, width, height);
      ctx.restore();
    }

    ctx.restore();
  }
}
