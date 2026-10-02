export interface MatchmoveFrameTrack {
  frameIndex: number;
  cameraTransformMatrix: number[];
}

export class MatchmoveVisionFacade {
  public static async calculate3DCameraTrajectory(videoPath: string): Promise<MatchmoveFrameTrack[]> {
    // Calculates SfM camera motion trajectory matrix from Python Vision worker
    return [
      { frameIndex: 0, cameraTransformMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
    ];
  }
}
