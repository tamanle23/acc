// ============================================================================
// KINETIX STUDIO v6.0 - 3D CAMERA DIRECTOR & CHOREOGRAPHER (ECMA-429)
// Pure functional mathematical camera director resolving cinematic 3D perspective
// angles, shot framing, focal zoom paths, and lighting vectors across scene progress.
// Conforms to WinterTC (ECMA-429), zero object allocation, and full Web Worker parity.
// ============================================================================

import type { Scene3DChoreography, CinematicShotType } from '@/types/storyboard';

export interface Resolved3DCamera {
  readonly rotationX: number; // radians
  readonly rotationY: number; // radians
  readonly rotationZ: number; // radians
  readonly scale: number;
  readonly lightDirection: [number, number, number];
  readonly wireframe: boolean;
  readonly fill: boolean;
  readonly meshKey: string;
}

const DEG2RAD = Math.PI / 180;

/**
 * Normalizes an angle into [0, 2*PI) radians.
 */
function normalizeRad(rad: number): number {
  const twoPi = Math.PI * 2;
  return ((rad % twoPi) + twoPi) % twoPi;
}

/**
 * Converts azimuth degrees into a normalized 3D Cartesian directional light vector.
 */
export function resolveLightDirection(azimuthDeg = 45, elevationDeg = 45): [number, number, number] {
  const az = azimuthDeg * DEG2RAD;
  const el = Math.max(5, Math.min(85, elevationDeg)) * DEG2RAD;

  const lx = Math.cos(el) * Math.sin(az);
  const ly = -Math.sin(el); // Downward light vector
  const lz = Math.cos(el) * Math.cos(az);

  const len = Math.hypot(lx, ly, lz) || 1;
  return [lx / len, ly / len, lz / len];
}

/**
 * Resolves mathematical 3D camera transforms for any scene choreography specification.
 *
 * @param choreo - The act's 3D choreography settings
 * @param localProgress - Normalized scene progress in [0, 1]
 * @param theta - Continuous audio/tempo-driven phase angle
 * @param pulse - Audio-reactive scale bounce factor
 * @param baseScale - Base viewport scaling factor
 */
export function resolve3DCameraShot(
  choreo: Scene3DChoreography | undefined,
  localProgress: number,
  theta: number,
  pulse = 1.0,
  baseScale = 1.15
): Resolved3DCamera {
  if (!choreo || !choreo.enabled) {
    // Default fallback: Classic turntable orbit
    return {
      rotationX: 0.25,
      rotationY: normalizeRad(theta),
      rotationZ: 0,
      scale: baseScale * pulse,
      lightDirection: [0.577, -0.577, 0.577],
      wireframe: true,
      fill: true,
      meshKey: 'custom-glb',
    };
  }

  const shotType: CinematicShotType = choreo.shotType ?? 'turntable-orbit';
  const speed = typeof choreo.rotationSpeed === 'number' ? Math.max(0, choreo.rotationSpeed) : 1.0;
  const zoom = typeof choreo.cameraZoom === 'number' && choreo.cameraZoom > 0 ? choreo.cameraZoom : 1.0;
  const elevOff = (choreo.cameraElevationDeg ?? 0) * DEG2RAD;
  const azOff = (choreo.cameraAzimuthDeg ?? 0) * DEG2RAD;
  const rollOff = (choreo.cameraRollDeg ?? 0) * DEG2RAD;

  // Clamped local scene progress [0, 1]
  const t = Math.max(0, Math.min(1, Number.isFinite(localProgress) ? localProgress : 0));

  let rx = 0;
  let ry = 0;
  let rz = 0;
  let computedScale = baseScale * zoom;

  switch (shotType) {
    case 'heroic-low-angle': {
      // Looking upward from below with low elevation and heroic grounding
      rx = 35 * DEG2RAD + Math.sin(theta * 0.5) * 0.05 + elevOff;
      ry = normalizeRad(azOff - 15 * DEG2RAD + theta * 0.3 * speed);
      rz = -5 * DEG2RAD + rollOff;
      computedScale = baseScale * 1.35 * zoom * pulse;
      break;
    }

    case 'bird-eye-high': {
      // High overhead view looking down into the stage
      rx = -50 * DEG2RAD + Math.cos(theta * 0.4) * 0.05 + elevOff;
      ry = normalizeRad(azOff + theta * 0.5 * speed);
      rz = 10 * DEG2RAD + rollOff;
      computedScale = baseScale * 1.1 * zoom * pulse;
      break;
    }

    case 'dutch-tilt-dynamic': {
      // Expressive cant angle with kinetic sway
      rx = 18 * DEG2RAD + elevOff;
      ry = normalizeRad(azOff + theta * 0.8 * speed);
      rz = 22 * DEG2RAD + Math.sin(theta * 1.2) * 0.06 + rollOff;
      computedScale = baseScale * 1.2 * zoom * pulse;
      break;
    }

    case 'macro-close-up': {
      // Tight focal zoom framing surface textures and geometric nodes
      rx = 10 * DEG2RAD + Math.sin(theta * 0.3) * 0.08 + elevOff;
      ry = normalizeRad(azOff + 45 * DEG2RAD + theta * 0.2 * speed);
      rz = rollOff;
      computedScale = baseScale * 2.2 * zoom * pulse;
      break;
    }

    case 'cinematic-dolly-zoom': {
      // Dynamic focal length shift (Hitchcock Vertigo dolly-zoom effect over scene progress t)
      const zoomProgress = 0.85 + t * 1.0; // 0.85x to 1.85x
      const rotationProgress = theta * speed + t * Math.PI * 0.5;
      rx = 20 * DEG2RAD * (1.0 - t * 0.3) + elevOff;
      ry = normalizeRad(azOff + rotationProgress);
      rz = Math.sin(t * Math.PI) * 0.08 + rollOff;
      computedScale = baseScale * zoomProgress * zoom * pulse;
      break;
    }

    case 'custom': {
      rx = elevOff;
      ry = normalizeRad(azOff + theta * speed);
      rz = rollOff;
      computedScale = baseScale * zoom * pulse;
      break;
    }

    case 'turntable-orbit':
    default: {
      rx = 15 * DEG2RAD + elevOff;
      ry = normalizeRad(azOff + theta * speed);
      rz = rollOff;
      computedScale = baseScale * zoom * pulse;
      break;
    }
  }

  const lightDirection = resolveLightDirection(choreo.lightAzimuthDeg ?? 45, 45);
  const wireframe = choreo.wireframe !== false;
  const fill = choreo.shadingMode !== 'wireframe-only';
  const meshKey = choreo.meshKey || 'custom-glb';

  return {
    rotationX: rx,
    rotationY: ry,
    rotationZ: rz,
    scale: computedScale,
    lightDirection,
    wireframe,
    fill,
    meshKey,
  };
}

export class CameraDirector3D {
  public static resolve(
    choreo: Scene3DChoreography | undefined,
    localProgress: number,
    theta: number,
    pulse = 1.0,
    baseScale = 1.15
  ): Resolved3DCamera {
    return resolve3DCameraShot(choreo, localProgress, theta, pulse, baseScale);
  }
}
