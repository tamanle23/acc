export interface FaceLandmarks {
  mouthOpenRatio: number; // 0.0 to 1.0 (lip-sync mouth open)
  eyeBlinkLeft: boolean;
  eyeBlinkRight: boolean;
  headRotation: { pitch: number; yaw: number; roll: number };
}

export class VTubingEngine {
  public static animateAvatarMesh(
    ctx: any,
    landmarks: FaceLandmarks,
    avatarX = 540,
    avatarY = 960
  ): void {
    ctx.save();
    ctx.translate(avatarX, avatarY);
    ctx.rotate((landmarks.headRotation.roll * Math.PI) / 180);

    // Render Avatar Head Base
    ctx.beginPath();
    ctx.arc(0, 0, 180, 0, 2 * Math.PI);
    ctx.fillStyle = '#fde047';
    ctx.fill();

    // Render Left Eye
    ctx.beginPath();
    ctx.arc(-60, -40, landmarks.eyeBlinkLeft ? 4 : 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Render Right Eye
    ctx.beginPath();
    ctx.arc(60, -40, landmarks.eyeBlinkRight ? 4 : 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Render Mouth (Lip-synced)
    const mouthH = Math.max(8, Math.round(landmarks.mouthOpenRatio * 60));
    ctx.beginPath();
    ctx.ellipse(0, 50, 40, mouthH, 0, 0, 2 * Math.PI);
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    ctx.restore();
  }
}
