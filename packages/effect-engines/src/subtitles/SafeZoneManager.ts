import { BoundingBox } from "../types";

export type SafeZonePlatform = 'tiktok' | 'reels' | 'shorts' | 'youtube' | 'custom';


export interface PlatformSafeMargins {
  topMarginPx: number;
  bottomMarginPx: number;
  leftMarginPx: number;
  rightMarginPx: number;
  uiOcclusionZones: BoundingBox[];
}

export class SafeZoneManager {
  private static platformMargins: Record<SafeZonePlatform, PlatformSafeMargins> = {
    tiktok: {
      topMarginPx: 120,
      bottomMarginPx: 220,
      leftMarginPx: 40,
      rightMarginPx: 140, // TikTok right action icons (like, comment, share, audio disc)
      uiOcclusionZones: [
        { x: 920, y: 800, width: 140, height: 800 }, // Right action buttons bar
        { x: 0, y: 1700, width: 900, height: 220 }, // Bottom caption & sound title area
      ],
    },
    reels: {
      topMarginPx: 100,
      bottomMarginPx: 200,
      leftMarginPx: 40,
      rightMarginPx: 120,
      uiOcclusionZones: [
        { x: 940, y: 900, width: 120, height: 700 },
        { x: 0, y: 1720, width: 920, height: 200 },
      ],
    },
    shorts: {
      topMarginPx: 90,
      bottomMarginPx: 180,
      leftMarginPx: 30,
      rightMarginPx: 120,
      uiOcclusionZones: [
        { x: 940, y: 950, width: 120, height: 650 },
        { x: 0, y: 1740, width: 940, height: 180 },
      ],
    },
    youtube: {
      topMarginPx: 40,
      bottomMarginPx: 60,
      leftMarginPx: 40,
      rightMarginPx: 40,
      uiOcclusionZones: [],
    },
    custom: {
      topMarginPx: 40,
      bottomMarginPx: 40,
      leftMarginPx: 40,
      rightMarginPx: 40,
      uiOcclusionZones: [],
    },
  };

  public static getMargins(platform: SafeZonePlatform): PlatformSafeMargins {
    return this.platformMargins[platform] || this.platformMargins.custom;
  }

  public static isBoxInSafeZone(box: BoundingBox, platform: SafeZonePlatform, canvasWidth = 1080, canvasHeight = 1920): boolean {
    const margins = this.getMargins(platform);

    // Check edge bounds
    if (box.y < margins.topMarginPx) return false;
    if (box.y + box.height > canvasHeight - margins.bottomMarginPx) return false;
    if (box.x < margins.leftMarginPx) return false;
    if (box.x + box.width > canvasWidth - margins.rightMarginPx) return false;

    // Check UI occlusion zone intersections
    for (const zone of margins.uiOcclusionZones) {
      const intersects =
        box.x < zone.x + zone.width &&
        box.x + box.width > zone.x &&
        box.y < zone.y + zone.height &&
        box.y + box.height > zone.y;
      if (intersects) return false;
    }

    return true;
  }

  public static clampPositionToSafeZone(
    box: BoundingBox,
    platform: SafeZonePlatform,
    canvasWidth = 1080,
    canvasHeight = 1920
  ): { x: number; y: number } {
    const margins = this.getMargins(platform);

    let clampedX = Math.max(margins.leftMarginPx, Math.min(box.x, canvasWidth - margins.rightMarginPx - box.width));
    let clampedY = Math.max(margins.topMarginPx, Math.min(box.y, canvasHeight - margins.bottomMarginPx - box.height));

    return { x: Math.round(clampedX), y: Math.round(clampedY) };
  }
}
