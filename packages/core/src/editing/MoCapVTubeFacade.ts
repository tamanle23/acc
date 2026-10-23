import { VTubingEngine, type FaceLandmarks } from './VTubingEngine';

export class MoCapVTubeFacade {
  public static renderAvatarFrameFromLandmarks(ctx: any, landmarks: FaceLandmarks): void {
    VTubingEngine.animateAvatarMesh(ctx, landmarks);
  }
}
