import { IDepth3DRenderer, Depth3DFrameState } from '../strategy';
import { drawFrameBreakerFrame } from '../frame-breaker';
import { drawParallaxFrame } from '../parallax';
import { drawSandwichFrame } from '../sandwich';
import { drawDepthMeshFrame } from '../depth-mesh';
import { drawWigglegramFrame } from '../wigglegram';

export class FrameBreakerRenderer implements IDepth3DRenderer {
  readonly mode = 'frame_breaker';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    drawFrameBreakerFrame(ctx, state as any);
  }
}

export class ParallaxRenderer implements IDepth3DRenderer {
  readonly mode = 'parallax_25d';
  readonly aliases = ['parallax_dolly'];
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    drawParallaxFrame(ctx, { ...state, particles: state.particles || [] } as any);
  }
}

export class SandwichRenderer implements IDepth3DRenderer {
  readonly mode = 'volumetric_sandwich';
  readonly aliases = ['sandwich'];
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    drawSandwichFrame(ctx, { ...state, dustParticles: state.dustParticles || [] } as any);
  }
}

export class DepthMeshRenderer implements IDepth3DRenderer {
  readonly mode = 'depth_map_3d';
  readonly aliases = ['mesh_displacement'];
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    if (state.srcCanvas) {
      drawDepthMeshFrame(ctx, { ...state, srcCanvas: state.srcCanvas, depthLayers: state.depthLayers || undefined } as any);
    }
  }
}

export class WigglegramRenderer implements IDepth3DRenderer {
  readonly mode = 'wigglegram';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    if (state.baseCanvas) {
      drawWigglegramFrame(ctx, { ...state, baseCanvas: state.baseCanvas } as any);
    }
  }
}
