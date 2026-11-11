import type { SafeCanvas2D } from '@/lib/safe-canvas-2d';
import type { StudioState } from '@/types/studio';
import type { ChoreographyEnvelope } from '@/types/motion';
import { gltfMeshEngine, createIcosahedronMesh } from '@/engine/webgpu/gltf-mesh-engine';
import { resolve3DCameraShot } from '@/engine/choreography/camera-director-3d';

// ============================================================================
// STRATEGY PATTERN: HERO FOCAL SUBJECT RENDERERS (ALL SAFE-CANVAS-2D GUARDED)
// ============================================================================

export function renderHeroSubject(
  sctx: SafeCanvas2D,
  w: number,
  h: number,
  state: StudioState,
  theta: number,
  pulse: number,
  choreo: ChoreographyEnvelope
): void {
  const cx = w * 0.5;
  const cy = h * 0.52;
  const energy = state.heroBudget / 100;

  let bobY = 0;
  let tilt = 0;
  let scaleX = 1;

  if (state.heroMotion === 'turntable') {
    bobY = Math.sin(theta) * 8 * energy;
    scaleX = 0.86 + 0.14 * Math.cos(theta);
    tilt = Math.sin(theta) * 0.08 * energy;
  } else if (state.heroMotion === 'levitate') {
    bobY = Math.sin(theta * 2) * 14 * energy;
    tilt = Math.cos(theta) * 0.05 * energy;
  } else if (state.heroMotion === 'gyro') {
    bobY = Math.cos(theta) * 6 * energy;
    tilt = Math.sin(theta * 2) * 0.22 * energy;
  }

  sctx.save();
  sctx.translate(cx, cy + bobY);

  // Studio Act II Inspection Reticle
  if (choreo.heroScaleBoost > 1.08) {
    sctx.save();
    sctx.strokeStyle = state.palette.accent;
    sctx.globalAlpha = 0.45;
    sctx.lineWidth = 1;
    sctx.setLineDash([5, 5]);
    sctx.beginPath();
    sctx.arc(0, 0, 108 * pulse, 0, Math.PI * 2);
    sctx.stroke();
    sctx.restore();
  }

  // Contact Pedestal Shadow
  sctx.save();
  sctx.fillStyle = 'rgba(0,0,0,0.48)';
  sctx.beginPath();
  sctx.ellipse(0, 88 - bobY * 0.35, 76, 15, 0, 0, Math.PI * 2);
  sctx.fill();
  sctx.restore();

  const totalScale = state.heroScale * choreo.heroScaleBoost * pulse;
  sctx.scale(totalScale * scaleX, totalScale);
  sctx.rotate(tilt);

  const { accent, accent2, ink, surface } = state.palette;

  switch (state.heroId) {
    case 'sneaker': {
      sctx.rotate(-0.14);
      // Carbon Sole
      sctx.fillStyle = accent;
      sctx.beginPath();
      sctx.moveTo(-90, 28);
      sctx.quadraticCurveTo(-20, 40, 92, 22);
      sctx.lineTo(84, 44);
      sctx.quadraticCurveTo(-15, 54, -95, 42);
      sctx.closePath();
      sctx.fill();
      // Upper Chassis
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.2;
      sctx.beginPath();
      sctx.moveTo(-86, 28);
      sctx.lineTo(-68, -32);
      sctx.lineTo(-18, -38);
      sctx.lineTo(35, -8);
      sctx.quadraticCurveTo(75, 0, 90, 22);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();
      // Speed Vector Stripe
      sctx.strokeStyle = accent2;
      sctx.lineWidth = 4;
      sctx.beginPath();
      sctx.moveTo(-52, 8);
      sctx.quadraticCurveTo(0, -10, 62, 14);
      sctx.stroke();
      break;
    }

    case 'headphone': {
      sctx.strokeStyle = ink;
      sctx.lineWidth = 8;
      sctx.beginPath();
      sctx.arc(0, -10, 64, Math.PI * 0.95, Math.PI * 0.05, false);
      sctx.stroke();
      // Left & Right Ear Cups
      [-58, 58].forEach((xPos) => {
        sctx.fillStyle = surface;
        sctx.strokeStyle = accent;
        sctx.lineWidth = 2.5;
        sctx.beginPath();
        sctx.ellipse(xPos, 16, 20, 34, 0, 0, Math.PI * 2);
        sctx.fill();
        sctx.stroke();
      });
      break;
    }

    case 'perfume': {
      // Crystal Flacon Body
      sctx.fillStyle = surface + 'dd';
      sctx.strokeStyle = accent;
      sctx.lineWidth = 2.5;
      sctx.beginPath();
      sctx.roundRect(-48, -28, 96, 92, 12);
      sctx.fill();
      sctx.stroke();
      // Liquid Fill
      sctx.fillStyle = accent + '55';
      sctx.fillRect(-40, 8, 80, 48);
      // Gold Atomizer Cap
      sctx.fillStyle = accent;
      sctx.fillRect(-16, -48, 32, 20);
      sctx.strokeStyle = ink;
      sctx.strokeRect(-26, -72, 52, 24);
      // Label Plaque
      sctx.fillStyle = ink;
      sctx.fillRect(-28, -8, 56, 34);
      break;
    }

    case 'chronograph': {
      sctx.fillStyle = surface;
      sctx.strokeStyle = accent;
      sctx.lineWidth = 4;
      sctx.beginPath();
      sctx.arc(0, 0, 64, 0, Math.PI * 2);
      sctx.fill();
      sctx.stroke();
      // Tourbillon Cage
      sctx.strokeStyle = accent2;
      sctx.lineWidth = 1.5;
      sctx.beginPath();
      sctx.arc(0, 22, 18, 0, Math.PI * 2);
      sctx.stroke();
      // Hands
      sctx.strokeStyle = ink;
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.moveTo(0, 0);
      sctx.lineTo(Math.cos(theta) * 42, Math.sin(theta) * 42);
      sctx.moveTo(0, 0);
      sctx.lineTo(Math.cos(theta * 0.25) * 28, Math.sin(theta * 0.25) * 28);
      sctx.stroke();
      break;
    }

    case 'eyewear': {
      sctx.fillStyle = surface;
      sctx.strokeStyle = accent;
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.moveTo(-88, -18);
      sctx.lineTo(88, -18);
      sctx.lineTo(74, 24);
      sctx.lineTo(14, 18);
      sctx.lineTo(0, 4);
      sctx.lineTo(-14, 18);
      sctx.lineTo(-74, 24);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();
      // Laser Glint
      const scanX = Math.sin(theta) * 55;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.moveTo(scanX - 10, -14);
      sctx.lineTo(scanX + 10, 16);
      sctx.stroke();
      break;
    }

    case 'sculpture': {
      for (let i = 0; i < 4; i++) {
        const a = theta + (i * Math.PI) / 2;
        sctx.fillStyle = i % 2 === 0 ? accent : accent2;
        sctx.strokeStyle = ink;
        sctx.lineWidth = 1.8;
        sctx.beginPath();
        sctx.ellipse(
          Math.sin(a) * 18,
          (i - 1.5) * 24,
          44 - i * 5,
          18,
          Math.cos(a) * 0.35,
          0,
          Math.PI * 2
        );
        sctx.fill();
        sctx.stroke();
      }
      break;
    }

    case 'totem': {
      sctx.fillStyle = surface;
      sctx.strokeStyle = accent;
      sctx.lineWidth = 2.5;
      sctx.beginPath();
      sctx.arc(0, -14, 48, Math.PI * 0.85, Math.PI * 0.15, false);
      sctx.lineTo(28, 44);
      sctx.lineTo(-28, 44);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();
      // Visor Eyes
      sctx.fillStyle = accent;
      sctx.beginPath();
      sctx.arc(-18, -8, 10, 0, Math.PI * 2);
      sctx.arc(18, -8, 10, 0, Math.PI * 2);
      sctx.fill();
      break;
    }

    case 'vinyl': {
      sctx.fillStyle = '#09090b';
      sctx.strokeStyle = accent;
      sctx.lineWidth = 2.5;
      sctx.beginPath();
      sctx.arc(0, 0, 72, 0, Math.PI * 2);
      sctx.fill();
      sctx.stroke();
      for (let r = 34; r < 66; r += 8) {
        sctx.strokeStyle = 'rgba(255,255,255,0.14)';
        sctx.lineWidth = 1;
        sctx.beginPath();
        sctx.arc(0, 0, r, 0, Math.PI * 2);
        sctx.stroke();
      }
      sctx.fillStyle = accent;
      sctx.beginPath();
      sctx.arc(0, 0, 24, 0, Math.PI * 2);
      sctx.fill();
      sctx.fillStyle = '#09090b';
      sctx.beginPath();
      sctx.arc(0, 0, 5, 0, Math.PI * 2);
      sctx.fill();
      break;
    }

    case 'cyber-katana': {
      sctx.rotate(-0.55);
      // Katana Blade Spine & Core
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.moveTo(-110, -6);
      sctx.lineTo(85, -6);
      sctx.quadraticCurveTo(105, -5, 115, 0); // Kissaki tip
      sctx.lineTo(95, 6);
      sctx.lineTo(-110, 6);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Glowing Monofilament Hamon Edge
      sctx.strokeStyle = accent;
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.moveTo(-110, 6);
      for (let x = -110; x <= 95; x += 15) {
        const wave = Math.sin(x * 0.12 + theta * 3) * 2;
        sctx.lineTo(x, 6 + wave);
      }
      sctx.lineTo(115, 0);
      sctx.stroke();

      // Tsuba (Guard)
      sctx.fillStyle = ink;
      sctx.strokeStyle = accent2;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.ellipse(-110, 0, 8, 22, 0, 0, Math.PI * 2);
      sctx.fill();
      sctx.stroke();

      // Tsuka (Hilt / Handle)
      sctx.fillStyle = '#0f172a';
      sctx.fillRect(-165, -8, 55, 16);
      // Diamond wrap pattern
      sctx.strokeStyle = accent;
      sctx.lineWidth = 1.2;
      for (let hx = -160; hx <= -115; hx += 10) {
        sctx.strokeRect(hx, -8, 8, 16);
      }
      break;
    }

    case 'exo-hand': {
      // Articulated Bionic Cybernetic Hand
      // Palm Chassis
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.5;
      sctx.beginPath();
      sctx.roundRect(-42, -15, 84, 62, 10);
      sctx.fill();
      sctx.stroke();

      // Wrist Connector Bracket
      sctx.fillStyle = '#0f172a';
      sctx.fillRect(-30, 47, 60, 24);
      sctx.strokeStyle = accent2;
      sctx.lineWidth = 1.8;
      sctx.strokeRect(-30, 47, 60, 24);

      // 4 Articulated Fingers (Index, Middle, Ring, Pinky)
      const fingerXs = [-30, -10, 10, 30];
      const fingerLens = [62, 70, 64, 52];
      fingerXs.forEach((fx, idx) => {
        const fl = fingerLens[idx]!;
        const jointBend = Math.sin(theta * 2 + idx * 0.5) * 6;
        sctx.fillStyle = idx % 2 === 0 ? accent : surface;
        sctx.strokeStyle = ink;
        sctx.lineWidth = 2;
        sctx.beginPath();
        sctx.roundRect(fx - 7, -15 - fl * 0.55, 14, fl * 0.55, 4);
        sctx.fill();
        sctx.stroke();
        sctx.beginPath();
        sctx.roundRect(fx - 6 + jointBend, -15 - fl, 12, fl * 0.48, 4);
        sctx.fill();
        sctx.stroke();
      });

      // Opposable Thumb
      sctx.save();
      sctx.translate(-42, 20);
      sctx.rotate(-0.6 + Math.sin(theta * 2) * 0.15);
      sctx.fillStyle = accent;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2;
      sctx.roundRect(-10, -40, 16, 40, 5);
      sctx.fill();
      sctx.stroke();
      sctx.restore();

      // Palm Hydraulic LED Core
      sctx.fillStyle = accent2;
      sctx.beginPath();
      sctx.arc(0, 15, 10 * pulse, 0, Math.PI * 2);
      sctx.fill();
      break;
    }

    case 'quantum-core': {
      // Magnetic Confinement Singularity
      for (let r = 0; r < 3; r++) {
        const rAngle = theta * (r === 1 ? -1.2 : 1) + (r * Math.PI) / 3;
        sctx.save();
        sctx.rotate(rAngle);
        sctx.strokeStyle = r % 2 === 0 ? accent : accent2;
        sctx.lineWidth = 2.4;
        sctx.beginPath();
        sctx.ellipse(0, 0, 78 - r * 12, 32 + r * 6, 0, 0, Math.PI * 2);
        sctx.stroke();
        [-60, 60].forEach((mx) => {
          sctx.fillStyle = ink;
          sctx.fillRect(mx - 4, -6, 8, 12);
        });
        sctx.restore();
      }

      // Central Plasma Singularity
      const coreGrad = sctx.createRadialGradient(0, 0, 2, 0, 0, 26 * pulse);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.4, accent);
      coreGrad.addColorStop(0.85, accent2);
      coreGrad.addColorStop(1, 'transparent');
      sctx.fillStyle = coreGrad;
      sctx.beginPath();
      sctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
      sctx.fill();

      // Quantum Radiation Spikes
      for (let s = 0; s < 6; s++) {
        const sa = theta * 2 + (s * Math.PI) / 3;
        sctx.strokeStyle = '#ffffff';
        sctx.lineWidth = 1.5;
        sctx.beginPath();
        sctx.moveTo(0, 0);
        sctx.lineTo(Math.cos(sa) * 42 * pulse, Math.sin(sa) * 42 * pulse);
        sctx.stroke();
      }
      break;
    }

    case 'prism-crystal': {
      // 3D Faceted Diamond Crystal with Refractive Flares
      for (let ray = 0; ray < 8; ray++) {
        const rayAngle = (ray / 8) * Math.PI * 2 + theta * 0.5;
        const rayLen = 95 * pulse;
        sctx.strokeStyle = ray % 2 === 0 ? accent : accent2;
        sctx.lineWidth = 1.5;
        sctx.globalAlpha = 0.45;
        sctx.beginPath();
        sctx.moveTo(0, 0);
        sctx.lineTo(Math.cos(rayAngle) * rayLen, Math.sin(rayAngle) * rayLen);
        sctx.stroke();
      }
      sctx.globalAlpha = 1;

      // Crystal Facets (Stepped Octahedron)
      const topTip = { x: 0, y: -72 };
      const botTip = { x: 0, y: 72 };
      const midPoints = [
        { x: -55, y: -10 },
        { x: -25, y: 15 },
        { x: 25, y: 15 },
        { x: 55, y: -10 },
      ];

      midPoints.forEach((p, idx) => {
        if (idx < midPoints.length - 1) {
          const next = midPoints[idx + 1]!;
          sctx.fillStyle = idx % 2 === 0 ? accent + 'cc' : surface;
          sctx.strokeStyle = ink;
          sctx.lineWidth = 2;
          sctx.beginPath();
          sctx.moveTo(topTip.x, topTip.y);
          sctx.lineTo(p.x, p.y);
          sctx.lineTo(next.x, next.y);
          sctx.closePath();
          sctx.fill();
          sctx.stroke();
        }
      });

      midPoints.forEach((p, idx) => {
        if (idx < midPoints.length - 1) {
          const next = midPoints[idx + 1]!;
          sctx.fillStyle = idx % 2 === 1 ? accent2 + 'cc' : surface;
          sctx.strokeStyle = ink;
          sctx.lineWidth = 2;
          sctx.beginPath();
          sctx.moveTo(botTip.x, botTip.y);
          sctx.lineTo(p.x, p.y);
          sctx.lineTo(next.x, next.y);
          sctx.closePath();
          sctx.fill();
          sctx.stroke();
        }
      });

      // Specular Glint
      const glintX = Math.sin(theta * 2) * 20;
      sctx.fillStyle = '#ffffff';
      sctx.beginPath();
      sctx.arc(glintX, -25, 4 * pulse, 0, Math.PI * 2);
      sctx.fill();
      break;
    }

    case 'isometric-plinth': {
      // Stepped Brutalist Museum Monolith Pedestal
      const slabs = [
        { y: 55, w: 120, h: 22, color: '#18181b' },
        { y: 28, w: 90, h: 20, color: '#27272a' },
        { y: 4, w: 60, h: 18, color: '#3f3f46' },
      ];

      slabs.forEach((slab) => {
        sctx.fillStyle = slab.color;
        sctx.strokeStyle = ink;
        sctx.lineWidth = 1.8;
        sctx.beginPath();
        sctx.roundRect(-slab.w * 0.5, slab.y, slab.w, slab.h, 2);
        sctx.fill();
        sctx.stroke();
      });

      // Hovering Kinetic Polyhedron Above Pedestal
      sctx.save();
      const hoverY = -48 + Math.sin(theta * 2) * 12;
      sctx.translate(0, hoverY);
      sctx.rotate(theta);

      sctx.fillStyle = accent;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.2;
      sctx.beginPath();
      sctx.strokeRect(-26, -26, 52, 52);
      sctx.fillRect(-22, -22, 44, 44);

      sctx.strokeStyle = accent2;
      sctx.lineWidth = 1.5;
      sctx.beginPath();
      sctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2);
      sctx.stroke();
      sctx.restore();
      break;
    }

    case 'bio-heart': {
      // Cyber-Organic Vascular Heart with Beat Cadence
      const heartPulse = pulse > 1.05 ? pulse * 1.08 : 1.0;
      sctx.scale(heartPulse, heartPulse);

      // Heart Muscle Base Lobes
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.moveTo(0, 48);
      sctx.bezierCurveTo(-55, 15, -65, -35, -28, -52);
      sctx.bezierCurveTo(-10, -56, 0, -32, 0, -22);
      sctx.bezierCurveTo(0, -32, 10, -56, 28, -52);
      sctx.bezierCurveTo(65, -35, 55, 15, 0, 48);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Aortic Arch & Vena Cava Tubes
      sctx.fillStyle = '#1e293b';
      sctx.strokeStyle = accent;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.arc(-8, -62, 12, Math.PI * 0.2, Math.PI * 1.3, false);
      sctx.lineTo(-8, -50);
      sctx.stroke();
      sctx.beginPath();
      sctx.arc(14, -64, 10, Math.PI * 0.1, Math.PI * 1.2, false);
      sctx.lineTo(14, -50);
      sctx.stroke();

      // Bioluminescent Coronary Circuit Veins
      sctx.strokeStyle = accent;
      sctx.lineWidth = 2.2;
      sctx.beginPath();
      sctx.moveTo(0, -20);
      sctx.quadraticCurveTo(-18, 0, -24, 25);
      sctx.moveTo(0, -15);
      sctx.quadraticCurveTo(16, 5, 20, 28);
      sctx.stroke();

      // Glowing Cardiac Valve Node
      sctx.fillStyle = accent2;
      sctx.beginPath();
      sctx.arc(0, -5, 8 * pulse, 0, Math.PI * 2);
      sctx.fill();
      break;
    }

    case 'modular-synth': {
      // Eurorack Modular Synthesizer Console
      const mk = state.heroMicroKinetics;
      // Main Chassis Frame
      sctx.fillStyle = '#18181b';
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.5;
      sctx.beginPath();
      sctx.roundRect(-85, -65, 170, 130, 4);
      sctx.fill();
      sctx.stroke();

      // Top Rails Rack Screws
      sctx.fillStyle = '#71717a';
      for (const x of [-78, -35, 35, 78]) {
        for (const y of [-58, 58]) {
          sctx.beginPath();
          sctx.arc(x, y, 2.5, 0, Math.PI * 2);
          sctx.fill();
        }
      }

      // 1. Dual VU Meters
      sctx.fillStyle = '#09090b';
      sctx.strokeStyle = accent;
      sctx.lineWidth = 1.2;
      sctx.fillRect(-72, -48, 64, 30);
      sctx.strokeRect(-72, -48, 64, 30);
      // VU Meter scale
      sctx.strokeStyle = 'rgba(255,255,255,0.2)';
      sctx.beginPath();
      sctx.arc(-40, -18, 20, Math.PI * 1.15, Math.PI * 1.85);
      sctx.stroke();
      // VU Needle
      const needleAngle = mk
        ? -0.4 + Math.sin(theta * 4) * 0.45 * pulse
        : 0.1;
      sctx.strokeStyle = '#ef4444';
      sctx.lineWidth = 1.4;
      sctx.beginPath();
      sctx.moveTo(-40, -20);
      sctx.lineTo(-40 + Math.sin(needleAngle) * 22, -20 - Math.cos(needleAngle) * 22);
      sctx.stroke();

      // 2. Rotary Potentiometer Knobs
      const knobCols = [8, 36, 64];
      const knobRows = [-35, -5, 25];
      knobCols.forEach((kx, cIdx) => {
        knobRows.forEach((ky, rIdx) => {
          sctx.fillStyle = surface;
          sctx.strokeStyle = ink;
          sctx.lineWidth = 1.2;
          sctx.beginPath();
          sctx.arc(kx, ky, 8, 0, Math.PI * 2);
          sctx.fill();
          sctx.stroke();
          // Indicator notch
          const kAngle = mk ? theta * (cIdx + 1) + rIdx * 1.2 : 0.78;
          sctx.strokeStyle = cIdx === 1 ? accent : accent2;
          sctx.lineWidth = 1.5;
          sctx.beginPath();
          sctx.moveTo(kx, ky);
          sctx.lineTo(kx + Math.cos(kAngle) * 7, ky + Math.sin(kAngle) * 7);
          sctx.stroke();
        });
      });

      // 3. Patch Jack Sockets & Swinging Patch Cables
      const jacks = [
        { x: -65, y: 15 },
        { x: -40, y: 15 },
        { x: -15, y: 15 },
        { x: -65, y: 40 },
        { x: -40, y: 40 },
        { x: -15, y: 40 },
      ];
      jacks.forEach((j) => {
        sctx.fillStyle = '#27272a';
        sctx.strokeStyle = ink;
        sctx.lineWidth = 1;
        sctx.beginPath();
        sctx.arc(j.x, j.y, 5, 0, Math.PI * 2);
        sctx.fill();
        sctx.stroke();
        sctx.fillStyle = '#000000';
        sctx.beginPath();
        sctx.arc(j.x, j.y, 2.2, 0, Math.PI * 2);
        sctx.fill();
      });

      // Patch Cable 1: Yellow/Accent cable swinging with inertia
      const cable1Sag = mk ? 55 + Math.sin(theta * 2) * 8 : 55;
      sctx.strokeStyle = accent;
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.moveTo(-65, 15);
      sctx.bezierCurveTo(-50, cable1Sag, 10, cable1Sag, 8, -5);
      sctx.stroke();

      // Patch Cable 2: Magenta/Accent2 cable
      const cable2Sag = mk ? 68 + Math.cos(theta * 2.5) * 6 : 68;
      sctx.strokeStyle = accent2;
      sctx.lineWidth = 2.6;
      sctx.beginPath();
      sctx.moveTo(-40, 40);
      sctx.bezierCurveTo(-20, cable2Sag, 45, cable2Sag, 36, 25);
      sctx.stroke();
      break;
    }

    case 'drum-machine': {
      // 16-Step Beat Production Console
      const mk = state.heroMicroKinetics;
      sctx.rotate(0.08);

      // Chassis Body
      sctx.fillStyle = '#1c1917';
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.4;
      sctx.beginPath();
      sctx.roundRect(-85, -60, 170, 120, 6);
      sctx.fill();
      sctx.stroke();

      // Top Section: Backlit Matrix LCD
      sctx.fillStyle = '#0c0a09';
      sctx.strokeStyle = accent;
      sctx.lineWidth = 1;
      sctx.fillRect(-72, -48, 92, 24);
      sctx.strokeRect(-72, -48, 92, 24);
      // Simulated mini LCD wave lines
      sctx.strokeStyle = accent;
      sctx.lineWidth = 1.2;
      sctx.beginPath();
      for (let lx = -68; lx <= 12; lx += 8) {
        const barH = mk ? 4 + Math.abs(Math.sin(theta * 3 + lx * 0.2)) * 14 : 10;
        sctx.moveTo(lx, -36 - barH / 2);
        sctx.lineTo(lx, -36 + barH / 2);
      }
      sctx.stroke();

      // Large Data Wheel Encoder
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 1.5;
      sctx.beginPath();
      sctx.arc(52, -36, 15, 0, Math.PI * 2);
      sctx.fill();
      sctx.stroke();
      const dialTick = mk ? theta * 2 : 0.8;
      sctx.strokeStyle = accent2;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.moveTo(52, -36);
      sctx.lineTo(52 + Math.cos(dialTick) * 12, -36 + Math.sin(dialTick) * 12);
      sctx.stroke();

      // 4x4 Grid of 16 Silicone Pads
      const activeStep = mk ? Math.floor((theta / (Math.PI * 2)) * 16) % 16 : 4;
      const padSize = 18;
      const gap = 6;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
          const px = -68 + c * (padSize + gap);
          const py = -10 + r * (padSize + gap);
          const idx = r * 5 + c;
          const isActive = idx === activeStep;

          sctx.fillStyle = isActive ? accent : '#292524';
          sctx.strokeStyle = isActive ? '#ffffff' : '#44403c';
          sctx.lineWidth = 1;
          sctx.beginPath();
          sctx.roundRect(px, py, padSize, padSize, 2);
          sctx.fill();
          sctx.stroke();
        }
      }
      break;
    }

    case 'cyber-drone': {
      // Autonomous Quadcopter VTOL Drone
      const mk = state.heroMicroKinetics;

      // X-Frame Carbon Fiber Arms
      sctx.strokeStyle = '#27272a';
      sctx.lineWidth = 7;
      sctx.beginPath();
      sctx.moveTo(-65, -45);
      sctx.lineTo(65, 45);
      sctx.moveTo(65, -45);
      sctx.lineTo(-65, 45);
      sctx.stroke();

      // Central Aerodynamic Fuselage Pod
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.4;
      sctx.beginPath();
      sctx.ellipse(0, 0, 32, 22, 0, 0, Math.PI * 2);
      sctx.fill();
      sctx.stroke();

      // Forward Targeting Lidar Emitter & Sweep Cone
      sctx.fillStyle = accent;
      sctx.beginPath();
      sctx.arc(0, -18, 5 * pulse, 0, Math.PI * 2);
      sctx.fill();

      if (mk) {
        // Lidar cone
        sctx.strokeStyle = accent;
        sctx.lineWidth = 1;
        sctx.globalAlpha = 0.25 * pulse;
        sctx.setLineDash([4, 4]);
        sctx.beginPath();
        sctx.moveTo(0, -18);
        sctx.lineTo(-45, -75);
        sctx.moveTo(0, -18);
        sctx.lineTo(45, -75);
        sctx.stroke();
        sctx.setLineDash([]);
        sctx.globalAlpha = 1;
      }

      // 4 Rotor Hubs & Spinning Blade Blurs
      const rotors = [
        { x: -65, y: -45 },
        { x: 65, y: -45 },
        { x: -65, y: 45 },
        { x: 65, y: 45 },
      ];
      rotors.forEach((rot, rIdx) => {
        // Motor Pod
        sctx.fillStyle = '#09090b';
        sctx.strokeStyle = ink;
        sctx.lineWidth = 1.5;
        sctx.beginPath();
        sctx.arc(rot.x, rot.y, 8, 0, Math.PI * 2);
        sctx.fill();
        sctx.stroke();

        // Rotor Disc Blur
        if (mk) {
          sctx.strokeStyle = rIdx % 2 === 0 ? accent : accent2;
          sctx.lineWidth = 1.8;
          sctx.globalAlpha = 0.55;
          sctx.beginPath();
          sctx.ellipse(rot.x, rot.y, 26, 12, theta * 15 * (rIdx % 2 === 0 ? 1 : -1), 0, Math.PI * 2);
          sctx.stroke();
          sctx.globalAlpha = 1;
        } else {
          sctx.strokeStyle = accent;
          sctx.lineWidth = 2;
          sctx.beginPath();
          sctx.moveTo(rot.x - 22, rot.y);
          sctx.lineTo(rot.x + 22, rot.y);
          sctx.stroke();
        }
      });
      break;
    }

    case 'mecha-helmet': {
      // Cyber Samurai Armored Battle Visor
      const mk = state.heroMicroKinetics;

      // Outer Crest & Helmet Shell (Kabuto Shroud)
      sctx.fillStyle = '#0f172a';
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.8;
      sctx.beginPath();
      sctx.moveTo(0, -68);
      sctx.lineTo(48, -42);
      sctx.lineTo(58, 15);
      sctx.lineTo(42, 58);
      sctx.lineTo(0, 48);
      sctx.lineTo(-42, 58);
      sctx.lineTo(-58, 15);
      sctx.lineTo(-48, -42);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Samurai Front Crest Horn Horns (Maedate)
      sctx.fillStyle = accent;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 1.8;
      sctx.beginPath();
      sctx.moveTo(-18, -62);
      sctx.lineTo(0, -88);
      sctx.lineTo(18, -62);
      sctx.lineTo(0, -56);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Narrow Cylindrical Visor Aperture
      sctx.fillStyle = '#020617';
      sctx.strokeStyle = accent;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.roundRect(-42, -15, 84, 24, 3);
      sctx.fill();
      sctx.stroke();

      // Visor HUD Reflection & Holographic Scanline
      const sweepX = mk ? -35 + ((theta * 1.5) % 1) * 70 : 0;
      sctx.fillStyle = accent2;
      sctx.globalAlpha = 0.65;
      sctx.fillRect(sweepX - 4, -13, 8, 20);

      // HUD Targeting Crosshair
      sctx.strokeStyle = accent;
      sctx.lineWidth = 1.2;
      sctx.beginPath();
      sctx.arc(0, -3, 8 * pulse, 0, Math.PI * 2);
      sctx.moveTo(-12, -3);
      sctx.lineTo(12, -3);
      sctx.stroke();
      sctx.globalAlpha = 1;

      // Lower Jaw Faceplate & Intake Vents
      for (const vy of [18, 28, 38]) {
        sctx.strokeStyle = '#334155';
        sctx.lineWidth = 2;
        sctx.beginPath();
        sctx.moveTo(-18, vy);
        sctx.lineTo(18, vy);
        sctx.stroke();
      }
      break;
    }

    case 'couture-dress': {
      // Haute Couture Parametric Pleated Mannequin
      const mk = state.heroMicroKinetics;

      // Neck & Shoulder Torso Frame
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.moveTo(-28, -65);
      sctx.quadraticCurveTo(0, -70, 28, -65);
      sctx.lineTo(34, -40);
      sctx.lineTo(16, -10);
      sctx.lineTo(-16, -10);
      sctx.lineTo(-34, -40);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Polished Brass / Gold Corset Waist Rings
      sctx.strokeStyle = accent;
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.ellipse(0, -10, 18, 4, 0, 0, Math.PI * 2);
      sctx.ellipse(0, -3, 20, 4.5, 0, 0, Math.PI * 2);
      sctx.stroke();

      // Cascading Parametric Pleated Ribbons
      const numPleats = 9;
      for (let i = 0; i < numPleats; i++) {
        const frac = i / (numPleats - 1);
        const topX = -18 + frac * 36;
        const botSpread = 68;
        const wave = mk ? Math.sin(theta * 2 + i * 0.45) * 8 : 0;
        const botX = -botSpread + frac * (botSpread * 2) + wave;

        sctx.beginPath();
        sctx.strokeStyle = i % 2 === 0 ? accent2 : ink;
        sctx.lineWidth = i % 2 === 0 ? 2.5 : 1.5;
        sctx.globalAlpha = 0.55 + 0.45 * Math.cos(theta + i);
        sctx.moveTo(topX, -3);
        sctx.bezierCurveTo(
          topX * 1.4,
          25,
          botX * 0.8,
          50,
          botX,
          75 + Math.sin(frac * Math.PI) * 12
        );
        sctx.stroke();
      }
      sctx.globalAlpha = 1;
      break;
    }

    case 'anamorphic-lens': {
      // Cine Prime Anamorphic Lens Barrel
      const mk = state.heroMicroKinetics;

      // Outer Cylindrical Aluminum Lens Chassis
      sctx.fillStyle = '#0f172a';
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.4;
      sctx.beginPath();
      sctx.roundRect(-62, -58, 124, 116, 8);
      sctx.fill();
      sctx.stroke();

      // Knurled Focus Gear Ring Ticks
      sctx.fillStyle = '#334155';
      for (let x = -56; x <= 56; x += 6) {
        sctx.fillRect(x, -54, 3, 10);
        sctx.fillRect(x, 44, 3, 10);
      }

      // Front Front Glass Element Bezel
      sctx.fillStyle = '#020617';
      sctx.strokeStyle = accent;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.arc(0, 0, 42, 0, Math.PI * 2);
      sctx.fill();
      sctx.stroke();

      // Internal Multi-Blade Iris Aperture
      const irisR = mk ? 14 + Math.sin(theta * 2) * 6 * pulse : 16;
      sctx.strokeStyle = accent2;
      sctx.lineWidth = 1.4;
      sctx.beginPath();
      for (let b = 0; b < 7; b++) {
        const bAngle = (b / 7) * Math.PI * 2 + (mk ? theta * 0.5 : 0);
        sctx.moveTo(Math.cos(bAngle) * 36, Math.sin(bAngle) * 36);
        sctx.lineTo(Math.cos(bAngle + 1.2) * irisR, Math.sin(bAngle + 1.2) * irisR);
      }
      sctx.stroke();

      // Signature Horizontal Anamorphic Blue Flare Streak
      const flareLen = mk ? 78 * pulse : 70;
      sctx.save();
      sctx.strokeStyle = '#38bdf8';
      sctx.lineWidth = 2.2;
      sctx.shadowColor = '#0284c7';
      sctx.shadowBlur = 12 * pulse;
      sctx.beginPath();
      sctx.moveTo(-flareLen, 0);
      sctx.lineTo(flareLen, 0);
      sctx.stroke();
      sctx.restore();
      break;
    }

    case 'classical-bust': {
      // Classical Hellenistic / Roman Marble Sculpture Bust
      const parallax = Math.sin(theta) * 0.08;
      sctx.rotate(parallax);

      // Fluted Marble Pedestal Base
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 1.6;
      sctx.beginPath();
      sctx.roundRect(-36, 44, 72, 18, 2);
      sctx.fill();
      sctx.stroke();

      // Pedestal molding details
      sctx.strokeStyle = accent;
      sctx.lineWidth = 1.0;
      sctx.beginPath();
      sctx.moveTo(-32, 53);
      sctx.lineTo(32, 53);
      sctx.stroke();

      // Classical Torso & Draped Toga Folds
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 1.8;
      sctx.beginPath();
      sctx.moveTo(-48, 44);
      sctx.quadraticCurveTo(-38, 22, -18, 12);
      sctx.lineTo(-12, -4);
      sctx.lineTo(12, -4);
      sctx.lineTo(18, 12);
      sctx.quadraticCurveTo(38, 22, 48, 44);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Chiseled Toga Folds
      sctx.strokeStyle = accent;
      sctx.lineWidth = 1.4;
      sctx.beginPath();
      sctx.moveTo(-30, 42);
      sctx.quadraticCurveTo(-14, 28, -2, 14);
      sctx.moveTo(-16, 44);
      sctx.quadraticCurveTo(4, 32, 14, 20);
      sctx.moveTo(10, 44);
      sctx.quadraticCurveTo(24, 36, 32, 28);
      sctx.stroke();

      // Sculpted Neck & Head
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 1.6;
      sctx.beginPath();
      sctx.moveTo(-14, 10);
      sctx.lineTo(-16, -14);
      sctx.quadraticCurveTo(-22, -26, -20, -42);
      sctx.quadraticCurveTo(0, -62, 20, -42);
      sctx.quadraticCurveTo(22, -26, 16, -14);
      sctx.lineTo(14, 10);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Brow line & Nose bridge
      sctx.strokeStyle = ink;
      sctx.lineWidth = 1.2;
      sctx.beginPath();
      sctx.moveTo(-10, -36);
      sctx.lineTo(2, -36);
      sctx.lineTo(2, -22);
      sctx.lineTo(-4, -18);
      sctx.stroke();

      // Classical sculpted hair curls
      sctx.fillStyle = accent;
      sctx.beginPath();
      [-16, -8, 0, 8, 16].forEach((hx, i) => {
        const hy = -46 - Math.abs(Math.sin(i * 1.2)) * 6;
        sctx.arc(hx, hy, 5, 0, Math.PI * 2);
      });
      sctx.fill();
      break;
    }

    case 'architectural-monolith': {
      // Modernist Brutalist Tower Monolith (Isometric 3D Projection)
      const lightAngle = theta;
      const shadowLen = 42 * (1 + 0.2 * Math.sin(theta));

      // Cast Ground Shadow
      sctx.save();
      sctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      sctx.beginPath();
      sctx.moveTo(0, 52);
      sctx.lineTo(Math.cos(lightAngle) * shadowLen, 52 + Math.abs(Math.sin(lightAngle)) * 14);
      sctx.lineTo(Math.cos(lightAngle) * shadowLen + 34, 52 + Math.abs(Math.sin(lightAngle)) * 14);
      sctx.lineTo(28, 52);
      sctx.closePath();
      sctx.fill();
      sctx.restore();

      // Face 1: Left Facade (In Shadow)
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 1.8;
      sctx.beginPath();
      sctx.moveTo(-28, -52);
      sctx.lineTo(0, -66);
      sctx.lineTo(0, 52);
      sctx.lineTo(-28, 38);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Face 2: Right Facade (Light Surface)
      sctx.fillStyle = accent;
      sctx.globalAlpha = 0.88;
      sctx.beginPath();
      sctx.moveTo(0, -66);
      sctx.lineTo(32, -50);
      sctx.lineTo(32, 40);
      sctx.lineTo(0, 52);
      sctx.closePath();
      sctx.fill();
      sctx.globalAlpha = 1;
      sctx.stroke();

      // Face 3: Top Roof Slab
      sctx.fillStyle = accent2;
      sctx.beginPath();
      sctx.moveTo(0, -66);
      sctx.lineTo(32, -50);
      sctx.lineTo(4, -38);
      sctx.lineTo(-28, -52);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Vertical Architectural Window Louvers
      sctx.strokeStyle = ink;
      sctx.lineWidth = 1.0;
      for (let l = -36; l <= 24; l += 14) {
        sctx.beginPath();
        sctx.moveTo(-20, l + 5);
        sctx.lineTo(-6, l - 2);
        sctx.stroke();
      }
      break;
    }

    case 'botanical-flora': {
      // Blooming Organic Botanical Orchid / Flora
      const breath = 1 + Math.sin(theta * 1.5) * 0.08 * pulse;
      sctx.scale(breath, breath);

      // Organic Stem
      sctx.strokeStyle = accent;
      sctx.lineWidth = 3.2;
      sctx.beginPath();
      sctx.moveTo(0, 18);
      sctx.quadraticCurveTo(-8 + Math.sin(theta) * 4, 38, -4, 62);
      sctx.stroke();

      // Radiating Botanical Petals (Fibonacci bloom)
      const petalCount = 6;
      for (let p = 0; p < petalCount; p++) {
        const pAngle = (p / petalCount) * Math.PI * 2 + theta * 0.05;
        const pLen = 48 + (p % 2 === 0 ? 12 : 0);
        sctx.save();
        sctx.rotate(pAngle);

        sctx.fillStyle = p % 2 === 0 ? surface : accent2;
        sctx.strokeStyle = ink;
        sctx.lineWidth = 1.5;
        sctx.beginPath();
        sctx.moveTo(0, 0);
        sctx.quadraticCurveTo(-14, -pLen * 0.5, 0, -pLen);
        sctx.quadraticCurveTo(14, -pLen * 0.5, 0, 0);
        sctx.fill();
        sctx.stroke();

        // Central Vein
        sctx.strokeStyle = p % 2 === 0 ? accent : ink;
        sctx.lineWidth = 1.0;
        sctx.beginPath();
        sctx.moveTo(0, 0);
        sctx.lineTo(0, -pLen * 0.85);
        sctx.stroke();

        sctx.restore();
      }

      // Floral Stamen Core
      sctx.fillStyle = accent;
      sctx.beginPath();
      sctx.arc(0, 0, 9, 0, Math.PI * 2);
      sctx.fill();
      sctx.strokeStyle = ink;
      sctx.lineWidth = 1.4;
      sctx.stroke();
      break;
    }

    case 'book-folio': {
      // Hardcover Literary Folio / Journal Spread
      const flutter = Math.sin(theta * 2) * 3;

      // Hardcover Outer Casing Spine
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.4;
      sctx.beginPath();
      sctx.roundRect(-64, -40, 128, 80, 4);
      sctx.fill();
      sctx.stroke();

      // Left Page
      sctx.fillStyle = accent2;
      sctx.globalAlpha = 0.92;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 1.2;
      sctx.beginPath();
      sctx.moveTo(-4, -36);
      sctx.quadraticCurveTo(-34, -38 + flutter, -58, -34);
      sctx.lineTo(-58, 34);
      sctx.quadraticCurveTo(-34, 38 - flutter, -4, 36);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Right Page
      sctx.beginPath();
      sctx.moveTo(4, -36);
      sctx.quadraticCurveTo(34, -38 - flutter, 58, -34);
      sctx.lineTo(58, 34);
      sctx.quadraticCurveTo(34, 38 + flutter, 4, 36);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();
      sctx.globalAlpha = 1;

      // Center Book Gutter & Spine Foil
      sctx.strokeStyle = accent;
      sctx.lineWidth = 2.0;
      sctx.beginPath();
      sctx.moveTo(0, -38);
      sctx.lineTo(0, 38);
      sctx.stroke();

      // Dummy Literary Print Lines on Pages
      sctx.strokeStyle = ink;
      sctx.globalAlpha = 0.45;
      sctx.lineWidth = 1.0;
      for (let l = -24; l <= 20; l += 8) {
        sctx.beginPath();
        sctx.moveTo(-50, l);
        sctx.lineTo(-12, l);
        sctx.stroke();
        sctx.beginPath();
        sctx.moveTo(12, l);
        sctx.lineTo(50, l);
        sctx.stroke();
      }
      sctx.globalAlpha = 1;
      break;
    }

    case 'cinema-slate': {
      // 35mm Motion Picture Production Clapperboard Slate
      const clapAngle = pulse > 1.04 ? -0.04 : -0.22 - Math.abs(Math.sin(theta)) * 0.08;

      // Main Slate Plaque
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.0;
      sctx.beginPath();
      sctx.roundRect(-54, -14, 108, 68, 3);
      sctx.fill();
      sctx.stroke();

      // Slate Grid Fields (PROD, SCENE, TAKE, ROLL)
      sctx.strokeStyle = ink;
      sctx.lineWidth = 1.0;
      sctx.beginPath();
      sctx.moveTo(-54, 8);
      sctx.lineTo(54, 8);
      sctx.moveTo(-18, 8);
      sctx.lineTo(-18, 54);
      sctx.moveTo(18, 8);
      sctx.lineTo(18, 54);
      sctx.stroke();

      // Cine Metric Text in Accent / Ink
      sctx.fillStyle = accent;
      sctx.font = '700 9px monospace';
      sctx.fillText('SCENE 24A', -48, 24);
      sctx.fillText('TAKE 03', -12, 24);
      sctx.fillText('ROLL 01', 24, 24);
      sctx.font = '600 7px monospace';
      sctx.fillStyle = ink;
      sctx.fillText('A24 CINE // 24FPS', -48, 0);

      // Hinged Top Chevrons Stick (Zebra Diagonal Striping)
      sctx.save();
      sctx.translate(-54, -14);
      sctx.rotate(clapAngle);
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 1.8;
      sctx.beginPath();
      sctx.roundRect(0, -18, 108, 18, 2);
      sctx.fill();
      sctx.stroke();

      // Diagonal Contrast Zebra Stripes
      sctx.fillStyle = accent;
      for (let s = 12; s < 100; s += 22) {
        sctx.beginPath();
        sctx.moveTo(s, 0);
        sctx.lineTo(s + 10, -18);
        sctx.lineTo(s + 18, -18);
        sctx.lineTo(s + 8, 0);
        sctx.closePath();
        sctx.fill();
      }
      sctx.restore();
      break;
    }

    case 'bauhaus-geometry': {
      // Primary Constructivist Geometries
      sctx.save();
      sctx.fillStyle = 'rgba(0,0,0,0.2)';
      sctx.beginPath();
      sctx.ellipse(0, 52, 60, 14, 0, 0, Math.PI * 2);
      sctx.fill();

      // Red Circle
      sctx.fillStyle = accent;
      sctx.beginPath();
      sctx.arc(-22, -18, 38, 0, Math.PI * 2);
      sctx.fill();

      // Yellow Cone
      sctx.fillStyle = accent2;
      sctx.beginPath();
      sctx.moveTo(10, -56);
      sctx.lineTo(44, 18);
      sctx.lineTo(-24, 18);
      sctx.closePath();
      sctx.fill();

      // Isometric Charcoal Cube
      sctx.save();
      sctx.translate(12, 10);
      sctx.fillStyle = ink;
      sctx.beginPath();
      sctx.moveTo(0, -22);
      sctx.lineTo(26, -9);
      sctx.lineTo(0, 4);
      sctx.lineTo(-26, -9);
      sctx.closePath();
      sctx.fill();
      sctx.fillStyle = 'rgba(0,0,0,0.85)';
      sctx.beginPath();
      sctx.moveTo(-26, -9);
      sctx.lineTo(0, 4);
      sctx.lineTo(0, 36);
      sctx.lineTo(-26, 23);
      sctx.closePath();
      sctx.fill();
      sctx.fillStyle = 'rgba(0,0,0,0.6)';
      sctx.beginPath();
      sctx.moveTo(0, 4);
      sctx.lineTo(26, -9);
      sctx.lineTo(26, 23);
      sctx.lineTo(0, 36);
      sctx.closePath();
      sctx.fill();
      sctx.restore();

      sctx.restore();
      break;
    }

    case 'destijl-grid-plinth': {
      sctx.save();
      const sz = 110;
      sctx.fillStyle = surface;
      sctx.fillRect(-sz / 2, -sz / 2, sz, sz);

      sctx.fillStyle = accent2 || '#dc2626';
      sctx.fillRect(5, -sz / 2, sz / 2 - 5, 48);

      sctx.fillStyle = accent || '#004b9e';
      sctx.fillRect(-sz / 2, 12, 38, sz / 2 - 12);

      sctx.fillStyle = '#facc15';
      sctx.fillRect(sz / 2 - 24, sz / 2 - 24, 24, 24);

      sctx.strokeStyle = ink;
      sctx.lineWidth = 5;
      sctx.beginPath();
      sctx.moveTo(5, -sz / 2);
      sctx.lineTo(5, sz / 2);
      sctx.moveTo(-sz / 2 + 38, -sz / 2);
      sctx.lineTo(-sz / 2 + 38, sz / 2);
      sctx.moveTo(-sz / 2, 12);
      sctx.lineTo(sz / 2, 12);
      sctx.moveTo(-sz / 2, -sz / 2 + 48);
      sctx.lineTo(sz / 2, -sz / 2 + 48);
      sctx.stroke();

      sctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
      sctx.restore();
      break;
    }

    case 'secession-crest': {
      sctx.save();
      sctx.strokeStyle = accent;
      sctx.lineWidth = 2.5;

      sctx.beginPath();
      sctx.arc(0, 0, 56 * pulse, 0, Math.PI * 2);
      sctx.stroke();

      sctx.lineWidth = 1;
      sctx.setLineDash([4, 4]);
      sctx.beginPath();
      sctx.arc(0, 0, 48, 0, Math.PI * 2);
      sctx.stroke();
      sctx.setLineDash([]);

      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4 + theta * 0.2;
        sctx.save();
        sctx.rotate(ang);
        sctx.fillStyle = accent;
        sctx.beginPath();
        sctx.ellipse(0, 36, 5, 12, Math.PI / 12, 0, Math.PI * 2);
        sctx.fill();
        sctx.restore();
      }

      const gSize = 4;
      const bW = 6;
      sctx.fillStyle = accent;
      for (let gx = -gSize; gx <= gSize; gx++) {
        for (let gy = -gSize; gy <= gSize; gy++) {
          if (gx * gx + gy * gy <= gSize * gSize) {
            if ((gx + gy) % 2 === 0) {
              sctx.fillRect(gx * (bW + 2) - bW / 2, gy * (bW + 2) - bW / 2, bW, bW);
            }
          }
        }
      }
      sctx.restore();
      break;
    }

    case 'deco-ziggurat': {
      sctx.save();
      const tiers = 6;
      for (let t = 0; t < tiers; t++) {
        const tw = 110 - t * 16;
        const th = 14;
        const ty = 40 - t * 16;
        sctx.fillStyle = t % 2 === 0 ? accent : surface;
        sctx.strokeStyle = ink;
        sctx.lineWidth = 1.5;
        sctx.fillRect(-tw / 2, ty, tw, th);
        sctx.strokeRect(-tw / 2, ty, tw, th);

        sctx.strokeStyle = accent2 || ink;
        sctx.beginPath();
        sctx.moveTo(-tw / 4, ty);
        sctx.lineTo(0, ty + th / 2);
        sctx.lineTo(tw / 4, ty);
        sctx.stroke();
      }

      sctx.fillStyle = accent;
      sctx.beginPath();
      sctx.moveTo(0, -68);
      sctx.lineTo(5, -44);
      sctx.lineTo(-5, -44);
      sctx.closePath();
      sctx.fill();
      sctx.restore();
      break;
    }

    case 'cinema-lens': {
      sctx.save();
      sctx.fillStyle = ink;
      sctx.strokeStyle = accent;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.arc(0, 0, 54, 0, Math.PI * 2);
      sctx.fill();
      sctx.stroke();

      sctx.fillStyle = 'rgba(37, 99, 235, 0.35)';
      sctx.beginPath();
      sctx.arc(-8, -6, 42, 0, Math.PI * 2);
      sctx.fill();

      sctx.fillStyle = 'rgba(217, 119, 6, 0.25)';
      sctx.beginPath();
      sctx.arc(10, 8, 36, 0, Math.PI * 2);
      sctx.fill();

      sctx.strokeStyle = accent;
      sctx.lineWidth = 2;
      sctx.beginPath();
      const sides = 7;
      const rIris = 18 + Math.sin(theta * 2) * 5;
      for (let s = 0; s < sides; s++) {
        const a = (s * Math.PI * 2) / sides;
        const ix = Math.cos(a) * rIris;
        const iy = Math.sin(a) * rIris;
        if (s === 0) sctx.moveTo(ix, iy);
        else sctx.lineTo(ix, iy);
      }
      sctx.closePath();
      sctx.stroke();
      sctx.restore();
      break;
    }

    case 'vertigo-spiral': {
      sctx.save();
      sctx.strokeStyle = accent;
      sctx.lineWidth = 3;
      sctx.beginPath();
      const totalTurns = 4;
      const maxRad = 58;
      for (let a = 0; a < Math.PI * 2 * totalTurns; a += 0.1) {
        const rad = (a / (Math.PI * 2 * totalTurns)) * maxRad;
        const vx = Math.cos(a + theta * 1.5) * rad;
        const vy = Math.sin(a + theta * 1.5) * rad;
        if (a === 0) sctx.moveTo(vx, vy);
        else sctx.lineTo(vx, vy);
      }
      sctx.stroke();

      sctx.save();
      sctx.rotate(-theta * 0.8);
      sctx.fillStyle = ink;
      sctx.beginPath();
      sctx.moveTo(-6, -14);
      sctx.lineTo(4, -18);
      sctx.lineTo(12, -4);
      sctx.lineTo(18, 12);
      sctx.lineTo(6, 18);
      sctx.lineTo(-2, 8);
      sctx.lineTo(-12, 14);
      sctx.closePath();
      sctx.fill();
      sctx.restore();

      sctx.restore();
      break;
    }

    case 'factory-hazard-badge': {
      sctx.save();
      const bw = 55;
      sctx.fillStyle = '#0f172a';
      sctx.strokeStyle = accent;
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.rect(-bw, -bw, bw * 2, bw * 2);
      sctx.fill();
      sctx.stroke();

      sctx.save();
      sctx.beginPath();
      sctx.rect(-bw + 4, -bw + 4, bw * 2 - 8, bw * 2 - 8);
      sctx.clip();
      sctx.fillStyle = accent;
      for (let x = -bw * 2; x < bw * 2; x += 22) {
        sctx.beginPath();
        sctx.moveTo(x, -bw * 2);
        sctx.lineTo(x + 11, -bw * 2);
        sctx.lineTo(x + bw * 4 + 11, bw * 2);
        sctx.lineTo(x + bw * 4, bw * 2);
        sctx.closePath();
        sctx.fill();
      }
      sctx.restore();

      sctx.fillStyle = '#09090b';
      sctx.fillRect(-38, -14, 76, 28);
      sctx.fillStyle = accent;
      sctx.font = '800 13px "Space Mono", monospace';
      sctx.textAlign = 'center';
      sctx.textBaseline = 'middle';
      sctx.fillText('FAC 51', 0, 0);
      sctx.restore();
      break;
    }

    case 'molten-mandala': {
      sctx.save();
      const lobes = 12;
      const rOuter = 58 * pulse;
      for (let l = 0; l < lobes; l++) {
        const ang = (l * Math.PI * 2) / lobes + theta * 0.4;
        sctx.save();
        sctx.rotate(ang);
        sctx.fillStyle = l % 2 === 0 ? accent : accent2;
        sctx.beginPath();
        sctx.moveTo(0, 0);
        sctx.quadraticCurveTo(rOuter * 0.5, rOuter * 0.35, 0, rOuter);
        sctx.quadraticCurveTo(-rOuter * 0.5, rOuter * 0.35, 0, 0);
        sctx.fill();
        sctx.restore();
      }

      sctx.fillStyle = ink;
      sctx.beginPath();
      sctx.arc(0, 0, 16, 0, Math.PI * 2);
      sctx.fill();
      sctx.fillStyle = accent;
      sctx.beginPath();
      sctx.arc(0, 0, 8, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();
      break;
    }

    case 'ransom-badge': {
      sctx.save();
      sctx.rotate(0.08);
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 1.5;
      sctx.beginPath();
      sctx.moveTo(-52, -32);
      sctx.lineTo(48, -35);
      sctx.lineTo(54, 32);
      sctx.lineTo(-48, 36);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      const letters = ['D', 'A', 'D', 'A'];
      const bgColors = [accent, ink, accent2, '#09090b'];
      const txtColors = ['#ffffff', '#ffffff', '#ffffff', accent];
      letters.forEach((ltr, i) => {
        const lx = -36 + i * 24;
        const ly = -14 + (i % 2 === 0 ? -2 : 3);
        const lRot = i % 2 === 0 ? 0.08 : -0.06;
        sctx.save();
        sctx.translate(lx, ly);
        sctx.rotate(lRot);
        sctx.fillStyle = bgColors[i]!;
        sctx.fillRect(-9, -12, 18, 24);
        sctx.fillStyle = txtColors[i]!;
        sctx.font = '900 15px "Space Grotesk", sans-serif';
        sctx.textAlign = 'center';
        sctx.textBaseline = 'middle';
        sctx.fillText(ltr, 0, 0);
        sctx.restore();
      });

      sctx.strokeStyle = '#a1a1aa';
      sctx.lineWidth = 2.5;
      sctx.beginPath();
      sctx.moveTo(-45, -40);
      sctx.lineTo(50, -25);
      sctx.stroke();
      sctx.restore();
      break;
    }

    case 'wabi-bonsai': {
      sctx.save();
      sctx.fillStyle = ink;
      sctx.beginPath();
      sctx.ellipse(0, 48, 48, 10, -0.05, 0, Math.PI * 2);
      sctx.fill();

      sctx.strokeStyle = ink;
      sctx.lineWidth = 6;
      sctx.lineCap = 'round';
      sctx.beginPath();
      sctx.moveTo(4, 44);
      sctx.quadraticCurveTo(-14, 15, -4, -5);
      sctx.quadraticCurveTo(8, -18, -26, -34);
      sctx.stroke();

      sctx.lineWidth = 3.5;
      sctx.beginPath();
      sctx.moveTo(-4, -5);
      sctx.quadraticCurveTo(18, -12, 32, -18);
      sctx.stroke();

      sctx.fillStyle = accent;
      const clusters = [
        { x: -32, y: -38, r: 18 },
        { x: -14, y: -45, r: 14 },
        { x: 36, y: -22, r: 16 },
        { x: 18, y: -32, r: 12 },
      ];
      clusters.forEach((cl) => {
        sctx.save();
        sctx.translate(cl.x, cl.y);
        for (let n = 0; n < 8; n++) {
          const na = (n * Math.PI) / 8 + Math.PI;
          sctx.fillRect(Math.cos(na) * cl.r * 0.5, Math.sin(na) * cl.r * 0.5, 4, 4);
        }
        sctx.beginPath();
        sctx.arc(0, 0, cl.r * 0.8, 0, Math.PI * 2);
        sctx.globalAlpha = 0.85;
        sctx.fill();
        sctx.restore();
      });
      sctx.restore();
      break;
    }

    case 'biophilic-leaf-arch': {
      sctx.save();
      sctx.strokeStyle = accent;
      sctx.lineWidth = 4;
      sctx.lineCap = 'round';

      sctx.beginPath();
      sctx.moveTo(-45, 44);
      sctx.bezierCurveTo(-50, -40, 50, -40, 45, 44);
      sctx.stroke();

      sctx.lineWidth = 1.5;
      sctx.strokeStyle = accent2;
      for (let v = -3; v <= 3; v++) {
        const vy = v * 12;
        const vw = Math.sqrt(Math.max(0, 42 * 42 - vy * vy));
        sctx.beginPath();
        sctx.moveTo(0, vy);
        sctx.quadraticCurveTo(vw * 0.5, vy - 6, vw, vy);
        sctx.moveTo(0, vy);
        sctx.quadraticCurveTo(-vw * 0.5, vy - 6, -vw, vy);
        sctx.stroke();
      }

      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.5;
      sctx.beginPath();
      sctx.moveTo(0, 48);
      sctx.lineTo(0, -42);
      sctx.stroke();
      sctx.restore();
      break;
    }

    case 'cosmic-astrolabe': {
      sctx.save();
      sctx.strokeStyle = accent;
      sctx.lineWidth = 2.5;

      sctx.beginPath();
      sctx.arc(0, 0, 54 * pulse, 0, Math.PI * 2);
      sctx.stroke();

      for (let d = 0; d < 36; d++) {
        const da = (d * Math.PI * 2) / 36;
        const dlen = d % 9 === 0 ? 8 : 4;
        sctx.beginPath();
        sctx.moveTo(Math.cos(da) * 54, Math.sin(da) * 54);
        sctx.lineTo(Math.cos(da) * (54 - dlen), Math.sin(da) * (54 - dlen));
        sctx.stroke();
      }

      sctx.save();
      sctx.rotate(theta * 0.6);
      sctx.lineWidth = 1.8;
      sctx.beginPath();
      sctx.ellipse(0, 0, 50, 22, Math.PI / 4, 0, Math.PI * 2);
      sctx.stroke();
      sctx.beginPath();
      sctx.ellipse(0, 0, 50, 22, -Math.PI / 4, 0, Math.PI * 2);
      sctx.stroke();
      sctx.restore();

      sctx.fillStyle = accent;
      sctx.beginPath();
      sctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2);
      sctx.fill();
      sctx.fillStyle = ink;
      sctx.beginPath();
      sctx.arc(0, 0, 8, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();
      break;
    }

    case 'chrome-torus-pod': {
      sctx.save();
      sctx.rotate(theta * 0.5);
      const rMajor = 42 * pulse;
      const rMinor = 18;

      const grad = sctx.createRadialGradient(-15, -15, 6, 0, 0, 60);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, accent);
      grad.addColorStop(0.65, '#94a3b8');
      grad.addColorStop(1, '#0f172a');

      sctx.fillStyle = grad;
      sctx.beginPath();
      sctx.arc(0, 0, rMajor + rMinor, 0, Math.PI * 2);
      sctx.arc(0, 0, rMajor - rMinor, 0, Math.PI * 2, true);
      sctx.fill();

      sctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      sctx.lineWidth = 4;
      sctx.beginPath();
      sctx.arc(0, 0, rMajor, -Math.PI * 0.75, -Math.PI * 0.25);
      sctx.stroke();

      sctx.strokeStyle = accent2 || '#c084fc';
      sctx.lineWidth = 1.5;
      sctx.beginPath();
      sctx.arc(2, 2, rMajor + rMinor + 2, 0, Math.PI * 2);
      sctx.stroke();
      sctx.restore();
      break;
    }

    case 'holiday-evergreen-star': {
      sctx.save();
      // 3-Tiered Faceted Alpine Pine Tree
      const treeTiers = [
        { topY: -68, botY: -18, halfW: 24, insetY: -32 },
        { topY: -28, botY: 18, halfW: 44, insetY: 4 },
        { topY: 8, botY: 56, halfW: 64, insetY: 42 },
      ];

      // Trunk
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.rect(-10, 56, 20, 20);
      sctx.fill();
      sctx.stroke();

      // Boughs
      treeTiers.forEach((tier) => {
        // Left facet (lighter)
        sctx.fillStyle = surface;
        sctx.strokeStyle = ink;
        sctx.lineWidth = 2;
        sctx.beginPath();
        sctx.moveTo(0, tier.topY);
        sctx.lineTo(-tier.halfW, tier.botY);
        sctx.lineTo(0, tier.insetY);
        sctx.closePath();
        sctx.fill();
        sctx.stroke();

        // Right facet (accent/shadow)
        sctx.fillStyle = accent;
        sctx.beginPath();
        sctx.moveTo(0, tier.topY);
        sctx.lineTo(tier.halfW, tier.botY);
        sctx.lineTo(0, tier.insetY);
        sctx.closePath();
        sctx.fill();
        sctx.stroke();

        // Baubles at tips
        [-tier.halfW, tier.halfW].forEach((bx, bi) => {
          sctx.fillStyle = bi === 0 ? accent2 : '#ffffff';
          sctx.beginPath();
          sctx.arc(bx, tier.botY, 3.5, 0, Math.PI * 2);
          sctx.fill();
        });
      });

      // 8-Point Radiating Celestial Apex Star
      sctx.save();
      sctx.translate(0, -72);
      sctx.rotate(theta * 0.2);

      // Star Glow Aura
      sctx.fillStyle = (accent2 || '#eab308') + '33';
      sctx.beginPath();
      sctx.arc(0, 0, 18 * pulse, 0, Math.PI * 2);
      sctx.fill();

      // 8 Star Points
      sctx.fillStyle = accent2 || '#eab308';
      sctx.strokeStyle = '#ffffff';
      sctx.lineWidth = 1.2;
      sctx.beginPath();
      const points = 8;
      for (let p = 0; p < points * 2; p++) {
        const rad = p % 2 === 0 ? 18 : 7;
        const ang = (p * Math.PI) / points;
        const x = Math.cos(ang) * rad;
        const y = Math.sin(ang) * rad;
        if (p === 0) sctx.moveTo(x, y);
        else sctx.lineTo(x, y);
      }
      sctx.closePath();
      sctx.fill();
      sctx.stroke();
      sctx.restore();

      sctx.restore();
      break;
    }

    case 'midnight-champagne-crystal': {
      sctx.save();
      // Champagne Flute Plinth & Foot
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2;
      sctx.fillStyle = surface;
      sctx.beginPath();
      sctx.ellipse(0, 68, 28, 8, 0, 0, Math.PI * 2);
      sctx.fill();
      sctx.stroke();

      // Slender Stem
      sctx.strokeStyle = ink;
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.moveTo(0, 68);
      sctx.lineTo(0, 12);
      sctx.stroke();

      // Crystal Flute Bowl
      sctx.fillStyle = surface + 'bb';
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.2;
      sctx.beginPath();
      sctx.moveTo(-22, -48);
      sctx.quadraticCurveTo(-24, -10, 0, 12);
      sctx.quadraticCurveTo(24, -10, 22, -48);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Effervescent Champagne Liquid Fill
      sctx.fillStyle = accent + 'aa';
      sctx.beginPath();
      sctx.moveTo(-19, -32);
      sctx.quadraticCurveTo(-21, -6, 0, 10);
      sctx.quadraticCurveTo(21, -6, 19, -32);
      sctx.closePath();
      sctx.fill();

      // Rising Effervescent Bubbles (Micro-Kinetics)
      for (let b = 0; b < 6; b++) {
        const bubProgress = ((theta * 20 + b * 11) % 40) / 40;
        const bubY = 6 - bubProgress * 38;
        const bubX = Math.sin(theta * 3 + b * 2) * (8 * (1 - bubProgress));
        sctx.fillStyle = '#ffffff';
        sctx.beginPath();
        sctx.arc(bubX, bubY, 1.8 + (b % 2) * 0.8, 0, Math.PI * 2);
        sctx.fill();
      }

      // Midnight Countdown Dial Halo (12 ticks around rim)
      sctx.save();
      sctx.translate(0, -48);
      sctx.strokeStyle = accent2 || '#fbbf24';
      sctx.lineWidth = 1.5;
      for (let t = 0; t < 12; t++) {
        const tAng = (t * Math.PI * 2) / 12;
        const r1 = 34;
        const r2 = t === 0 ? 44 : 39;
        sctx.beginPath();
        sctx.moveTo(Math.cos(tAng) * r1, Math.sin(tAng) * r1 * 0.4);
        sctx.lineTo(Math.cos(tAng) * r2, Math.sin(tAng) * r2 * 0.4);
        sctx.stroke();
      }
      // Top 12-o'clock diamond beacon
      sctx.fillStyle = '#ffffff';
      sctx.beginPath();
      sctx.arc(0, -44 * 0.4, 3.5 * pulse, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();

      sctx.restore();
      break;
    }

    case 'tet-blossom-lantern': {
      sctx.save();
      // Hexagonal Silk Hoi An Lantern (Center)
      const lanternBreath = 1 + Math.sin(theta) * 0.04;
      sctx.scale(lanternBreath, lanternBreath);

      // Top & Bottom Wooden Caps
      sctx.fillStyle = ink;
      sctx.fillRect(-22, -48, 44, 8);
      sctx.fillRect(-18, 36, 36, 8);

      // Bulging Silk Body
      sctx.fillStyle = accent;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.2;
      sctx.beginPath();
      sctx.moveTo(-20, -40);
      sctx.quadraticCurveTo(-44, -2, -16, 36);
      sctx.lineTo(16, 36);
      sctx.quadraticCurveTo(44, -2, 20, -40);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Silk Ribbing Lines
      sctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      sctx.lineWidth = 1.5;
      [-10, 0, 10].forEach((rx) => {
        sctx.beginPath();
        sctx.moveTo(rx * 0.8, -40);
        sctx.quadraticCurveTo(rx * 1.8, -2, rx * 0.7, 36);
        sctx.stroke();
      });

      // Hanging Silk Tassel (Swaying with theta)
      const tasselSway = Math.sin(theta * 1.6) * 10;
      sctx.strokeStyle = accent2 || '#f59e0b';
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.moveTo(0, 44);
      sctx.quadraticCurveTo(tasselSway * 0.5, 62, tasselSway, 80);
      sctx.stroke();

      // Blooming Golden Apricot Branch (Hoa Mai)
      sctx.strokeStyle = surface === '#1c1917' ? '#94a3b8' : '#78350f';
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.moveTo(-54, 48);
      sctx.quadraticCurveTo(-38, 12, -46, -18);
      sctx.quadraticCurveTo(-50, -44, -32, -60);
      sctx.stroke();

      // 5-Petal Golden Flowers along Branch
      const blossomNodes = [
        { x: -50, y: 16, r: 12 },
        { x: -44, y: -22, r: 14 },
        { x: -30, y: -58, r: 11 },
      ];
      blossomNodes.forEach((node) => {
        sctx.save();
        sctx.translate(node.x, node.y);
        for (let p = 0; p < 5; p++) {
          const pAngle = (p * Math.PI * 2) / 5 + theta * 0.1;
          sctx.fillStyle = accent2 || '#facc15';
          sctx.strokeStyle = ink;
          sctx.lineWidth = 1;
          sctx.beginPath();
          sctx.arc(
            Math.cos(pAngle) * node.r * 0.55,
            Math.sin(pAngle) * node.r * 0.55,
            node.r * 0.45,
            0,
            Math.PI * 2
          );
          sctx.fill();
          sctx.stroke();
        }
        // Red Stamen Core
        sctx.fillStyle = '#dc2626';
        sctx.beginPath();
        sctx.arc(0, 0, 3, 0, Math.PI * 2);
        sctx.fill();
        sctx.restore();
      });

      sctx.restore();
      break;
    }

    case 'trung-thu-star-lantern': {
      sctx.save();
      // Traditional Vietnamese 5-Point Bamboo Star Lantern (Đèn Ông Sao)
      const lanternRot = Math.sin(theta * 0.8) * 0.12;
      sctx.rotate(lanternRot);

      // Outer Bamboo Ring
      sctx.strokeStyle = '#d97706';
      sctx.lineWidth = 3.5;
      sctx.beginPath();
      sctx.arc(0, 0, 48, 0, Math.PI * 2);
      sctx.stroke();

      // Bamboo Ring Joint Ties
      for (let j = 0; j < 5; j++) {
        const jAng = (j * Math.PI * 2) / 5 - Math.PI / 2;
        sctx.fillStyle = '#78350f';
        sctx.beginPath();
        sctx.arc(Math.cos(jAng) * 48, Math.sin(jAng) * 48, 3, 0, Math.PI * 2);
        sctx.fill();
      }

      // 5-Point Star Geometry
      const starOuterR = 64;
      const starInnerR = 24;
      const starPoints: Array<{ x: number; y: number }> = [];
      for (let p = 0; p < 10; p++) {
        const ang = (p * Math.PI) / 5 - Math.PI / 2;
        const rad = p % 2 === 0 ? starOuterR : starInnerR;
        starPoints.push({ x: Math.cos(ang) * rad, y: Math.sin(ang) * rad });
      }

      // Draw 5 Cellophane Star Points with alternating colors
      for (let s = 0; s < 5; s++) {
        const p1 = starPoints[(s * 2 + 9) % 10]!;
        const pApex = starPoints[s * 2]!;
        const p2 = starPoints[(s * 2 + 1) % 10]!;

        sctx.fillStyle = s % 2 === 0 ? accent : (accent2 || '#facc15');
        sctx.strokeStyle = ink;
        sctx.lineWidth = 1.8;
        sctx.beginPath();
        sctx.moveTo(0, 0);
        sctx.lineTo(p1.x, p1.y);
        sctx.lineTo(pApex.x, pApex.y);
        sctx.lineTo(p2.x, p2.y);
        sctx.closePath();
        sctx.fill();
        sctx.stroke();

        // Center spine bamboo strut to apex
        sctx.strokeStyle = '#b45309';
        sctx.lineWidth = 1.6;
        sctx.beginPath();
        sctx.moveTo(0, 0);
        sctx.lineTo(pApex.x, pApex.y);
        sctx.stroke();

        // Swaying Streamer Tassels at each of the 5 tips
        const sway = Math.sin(theta * 2 + s * 1.2) * 8;
        sctx.strokeStyle = s % 2 === 0 ? '#facc15' : '#059669';
        sctx.lineWidth = 1.5;
        sctx.beginPath();
        sctx.moveTo(pApex.x, pApex.y);
        sctx.quadraticCurveTo(pApex.x + sway * 0.5, pApex.y + 12, pApex.x + sway, pApex.y + 24);
        sctx.stroke();
      }

      // Central Candle Well (Internal Glow)
      const flameFlicker = Math.sin(theta * 8) * 3;
      sctx.fillStyle = '#ffffff';
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.arc(0, 0, 16, 0, Math.PI * 2);
      sctx.fill();
      sctx.stroke();

      // Flickering Candle Flame Core
      sctx.fillStyle = '#ea580c';
      sctx.beginPath();
      sctx.arc(0, -2 + flameFlicker * 0.3, 7 + flameFlicker * 0.2, 0, Math.PI * 2);
      sctx.fill();

      sctx.fillStyle = '#fef08a';
      sctx.beginPath();
      sctx.arc(0, -3 + flameFlicker * 0.3, 4, 0, Math.PI * 2);
      sctx.fill();

      sctx.restore();
      break;
    }

    case 'mid-autumn-moon-rabbit': {
      sctx.save();
      // Celestial Full Moon Disk
      const moonR = 56;
      const moonGlow = sctx.createRadialGradient(0, 0, moonR * 0.4, 0, 0, moonR * 1.25);
      moonGlow.addColorStop(0, '#ffffff');
      moonGlow.addColorStop(0.65, accent2 || '#fef08a');
      moonGlow.addColorStop(1, 'transparent');

      sctx.fillStyle = moonGlow;
      sctx.beginPath();
      sctx.arc(0, 0, moonR * 1.25, 0, Math.PI * 2);
      sctx.fill();

      // Solid Moon Core with Mare Markings
      sctx.fillStyle = '#fefce8';
      sctx.strokeStyle = accent;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.arc(0, 0, moonR, 0, Math.PI * 2);
      sctx.fill();
      sctx.stroke();

      // Lunar Mare Shadow Patches
      sctx.fillStyle = 'rgba(217, 119, 6, 0.12)';
      [
        { cx: -18, cy: -20, r: 16 },
        { cx: 22, cy: -14, r: 18 },
        { cx: -8, cy: 18, r: 14 },
      ].forEach((crater) => {
        sctx.beginPath();
        sctx.arc(crater.cx, crater.cy, crater.r, 0, Math.PI * 2);
        sctx.fill();
      });

      // Drifting Celestial Silk Ribbon / Cloud Band
      const cloudShift = Math.sin(theta * 0.6) * 12;
      sctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      sctx.lineWidth = 4;
      sctx.beginPath();
      sctx.moveTo(-70 + cloudShift, 18);
      sctx.quadraticCurveTo(-20 + cloudShift, 32, 20 + cloudShift, 14);
      sctx.quadraticCurveTo(55 + cloudShift, 2, 75 + cloudShift, 18);
      sctx.stroke();

      // Origami Jade Rabbit Silhouette (Looking upward)
      sctx.save();
      sctx.translate(6, 12);
      sctx.fillStyle = ink;
      // Body
      sctx.beginPath();
      sctx.ellipse(14, 16, 16, 12, -0.3, 0, Math.PI * 2);
      sctx.fill();
      // Head
      sctx.beginPath();
      sctx.ellipse(0, 2, 10, 8, -0.2, 0, Math.PI * 2);
      sctx.fill();
      // Upright Ears
      sctx.beginPath();
      sctx.ellipse(-4, -14, 4, 14, -0.25, 0, Math.PI * 2);
      sctx.fill();
      sctx.beginPath();
      sctx.ellipse(4, -13, 3.5, 13, 0.15, 0, Math.PI * 2);
      sctx.fill();
      // Fluffy Tail
      sctx.beginPath();
      sctx.arc(28, 16, 4.5, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();

      sctx.restore();
      break;
    }

    case 'halloween-gothic-skull': {
      sctx.save();
      // Carved Gothic Jack-o'-Lantern
      // Pumpkin Lobes
      const lobeWidths = [
        { ox: 0, rx: 22, ry: 40 },
        { ox: -24, rx: 18, ry: 36 },
        { ox: 24, rx: 18, ry: 36 },
        { ox: -42, rx: 14, ry: 30 },
        { ox: 42, rx: 14, ry: 30 },
      ];

      lobeWidths.forEach((lobe) => {
        sctx.fillStyle = accent;
        sctx.strokeStyle = ink;
        sctx.lineWidth = 2.2;
        sctx.beginPath();
        sctx.ellipse(lobe.ox, 8, lobe.rx, lobe.ry, 0, 0, Math.PI * 2);
        sctx.fill();
        sctx.stroke();
      });

      // Wooden Stem at top
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.moveTo(-6, -30);
      sctx.quadraticCurveTo(-12, -50, -4, -58);
      sctx.lineTo(6, -56);
      sctx.quadraticCurveTo(2, -48, 6, -30);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Gothic Wrought-Iron Arched Handle
      sctx.strokeStyle = ink;
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.arc(0, -18, 52, Math.PI * 1.1, Math.PI * 1.9);
      sctx.stroke();

      // Flickering Candlelight from carved face
      const flame = Math.sin(theta * 7) * 2;
      sctx.fillStyle = '#fef08a';

      // Left Eye
      sctx.beginPath();
      sctx.moveTo(-24, -4);
      sctx.lineTo(-12, -4);
      sctx.lineTo(-18, 8);
      sctx.closePath();
      sctx.fill();

      // Right Eye
      sctx.beginPath();
      sctx.moveTo(12, -4);
      sctx.lineTo(24, -4);
      sctx.lineTo(18, 8);
      sctx.closePath();
      sctx.fill();

      // Triangular Nose
      sctx.beginPath();
      sctx.moveTo(0, 10 + flame * 0.2);
      sctx.lineTo(-5, 18);
      sctx.lineTo(5, 18);
      sctx.closePath();
      sctx.fill();

      // Grinning Jagged Mouth
      sctx.beginPath();
      sctx.moveTo(-32, 24);
      sctx.lineTo(-24, 32);
      sctx.lineTo(-16, 26);
      sctx.lineTo(-8, 34);
      sctx.lineTo(0, 26);
      sctx.lineTo(8, 34);
      sctx.lineTo(16, 26);
      sctx.lineTo(24, 32);
      sctx.lineTo(32, 24);
      sctx.lineTo(20, 38);
      sctx.lineTo(0, 42);
      sctx.lineTo(-20, 38);
      sctx.closePath();
      sctx.fill();

      sctx.restore();
      break;
    }

    case 'diwali-diya-lamp': {
      sctx.save();
      // Scalloped Brass Diya Oil Lamp
      // Foot plinth
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.ellipse(0, 48, 26, 8, 0, 0, Math.PI * 2);
      sctx.fill();
      sctx.stroke();

      // Ornate Scalloped Brass Diya Vessel
      sctx.fillStyle = accent;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.4;
      sctx.beginPath();
      sctx.moveTo(-54, 18);
      sctx.quadraticCurveTo(-48, 42, 0, 44);
      sctx.quadraticCurveTo(48, 42, 54, 18);
      sctx.quadraticCurveTo(32, 24, 0, 24);
      sctx.quadraticCurveTo(-32, 24, -54, 18);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Beaded Rim Filigree
      for (let b = -5; b <= 5; b++) {
        const bx = b * 9;
        const by = 22 + Math.cos((b / 5) * (Math.PI / 2)) * 2;
        sctx.fillStyle = accent2 || '#fef08a';
        sctx.beginPath();
        sctx.arc(bx, by, 2.2, 0, Math.PI * 2);
        sctx.fill();
      }

      // Radiating Light Aura (Mandala Rays)
      const rays = 16;
      for (let r = 0; r < rays; r++) {
        const rAng = (r * Math.PI * 2) / rays + theta * 0.2;
        const rLen1 = 34 * pulse;
        const rLen2 = 46 * pulse;
        sctx.strokeStyle = (accent2 || '#fef08a') + '55';
        sctx.lineWidth = 1.5;
        sctx.beginPath();
        sctx.moveTo(Math.cos(rAng) * rLen1, -8 + Math.sin(rAng) * rLen1);
        sctx.lineTo(Math.cos(rAng) * rLen2, -8 + Math.sin(rAng) * rLen2);
        sctx.stroke();
      }

      // Dancing Sacred Flame
      const flameTipX = Math.sin(theta * 5) * 4;
      const flameH = 44 + Math.sin(theta * 6) * 4;

      // Outer Teardrop Flame
      sctx.fillStyle = '#ea580c';
      sctx.beginPath();
      sctx.moveTo(-16, 18);
      sctx.quadraticCurveTo(-18, -6, flameTipX, 18 - flameH);
      sctx.quadraticCurveTo(18, -6, 16, 18);
      sctx.closePath();
      sctx.fill();

      // Inner Core Flame
      sctx.fillStyle = '#fef08a';
      sctx.beginPath();
      sctx.moveTo(-9, 18);
      sctx.quadraticCurveTo(-10, 2, flameTipX * 0.7, 18 - flameH * 0.65);
      sctx.quadraticCurveTo(10, 2, 9, 18);
      sctx.closePath();
      sctx.fill();

      // Pure White Center Spark
      sctx.fillStyle = '#ffffff';
      sctx.beginPath();
      sctx.arc(0, 10, 3.5, 0, Math.PI * 2);
      sctx.fill();

      sctx.restore();
      break;
    }

    case 'carnival-feather-mask': {
      sctx.save();
      // Venetian / Rio Plumed Masquerade Mask
      const maskBob = Math.sin(theta * 2) * 5;
      sctx.translate(0, maskBob);

      // 5 Sweeping Plumes (Feathers fanning up from crown)
      const plumeAngles = [-0.65, -0.32, 0, 0.32, 0.65];
      plumeAngles.forEach((ang, idx) => {
        sctx.save();
        sctx.translate(0, -14);
        const plumeSway = ang + Math.sin(theta * 2.5 + idx * 0.8) * 0.08;
        sctx.rotate(plumeSway);

        const pLen = 65 + (idx === 2 ? 22 : idx % 2 === 1 ? 12 : 0);

        // Feather body
        sctx.fillStyle = idx % 2 === 0 ? accent : (accent2 || '#a855f7');
        sctx.strokeStyle = ink;
        sctx.lineWidth = 1.2;
        sctx.beginPath();
        sctx.moveTo(0, 0);
        sctx.quadraticCurveTo(-14, -pLen * 0.5, 0, -pLen);
        sctx.quadraticCurveTo(14, -pLen * 0.5, 0, 0);
        sctx.closePath();
        sctx.fill();
        sctx.stroke();

        // Quill spine
        sctx.strokeStyle = '#ffffff';
        sctx.lineWidth = 1.5;
        sctx.beginPath();
        sctx.moveTo(0, 0);
        sctx.lineTo(0, -pLen);
        sctx.stroke();
        sctx.restore();
      });

      // Arched Masquerade Mask Shell
      sctx.fillStyle = surface;
      sctx.strokeStyle = ink;
      sctx.lineWidth = 2.4;
      sctx.beginPath();
      sctx.moveTo(0, 14);
      sctx.quadraticCurveTo(-24, 28, -62, 8);
      sctx.quadraticCurveTo(-68, -14, -42, -18);
      sctx.quadraticCurveTo(-18, -12, 0, -4);
      sctx.quadraticCurveTo(18, -12, 42, -18);
      sctx.quadraticCurveTo(68, -14, 62, 8);
      sctx.quadraticCurveTo(24, 28, 0, 14);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      // Almond Eye Cutouts
      [-26, 26].forEach((ex) => {
        sctx.fillStyle = ink;
        sctx.beginPath();
        sctx.ellipse(ex, 4, 15, 7, ex < 0 ? -0.15 : 0.15, 0, Math.PI * 2);
        sctx.fill();
      });

      // Harlequin Diamond Filigree on Cheeks
      sctx.fillStyle = accent;
      [-44, 44].forEach((dx) => {
        sctx.beginPath();
        sctx.moveTo(dx, 0);
        sctx.lineTo(dx + 5, 5);
        sctx.lineTo(dx, 10);
        sctx.lineTo(dx - 5, 5);
        sctx.closePath();
        sctx.fill();
      });

      // Crown Jewel Emblem at Bridge
      sctx.fillStyle = accent2 || '#fbbf24';
      sctx.beginPath();
      sctx.arc(0, -10, 5 * pulse, 0, Math.PI * 2);
      sctx.fill();

      sctx.restore();
      break;
    }

    case 'custom-glb': {
      try {
        sctx.save();
        const baseScale = state.heroScale > 0 ? state.heroScale : 1.15;

        if (state.choreo3d && state.choreo3d.enabled) {
          const twoPi = Math.PI * 2;
          const localProgress = (((theta % twoPi) + twoPi) % twoPi) / twoPi;
          const resolved = resolve3DCameraShot(
            state.choreo3d,
            localProgress,
            theta,
            pulse,
            baseScale
          );
          const meshToRender = gltfMeshEngine.getMesh(resolved.meshKey) || createIcosahedronMesh(64);

          gltfMeshEngine.render3DMesh(sctx, {
            mesh: meshToRender,
            width: 0,
            height: 0,
            centerX: 0,
            centerY: 0,
            rotationX: resolved.rotationX,
            rotationY: resolved.rotationY,
            rotationZ: resolved.rotationZ,
            scale: resolved.scale,
            color: state.palette.accent,
            fill: resolved.fill,
            wireframe: resolved.wireframe,
            lightDirection: resolved.lightDirection,
          });
        } else {
          const customMesh = gltfMeshEngine.getCustomMesh();
          const meshToRender = customMesh || createIcosahedronMesh(64);

          // Turntable, Gyro, Levitate, or Monument 3D rotation
          let rx = 0.25;
          let ry = theta;
          let rz = 0;
          if (state.heroMotion === 'gyro') {
            rx = Math.sin(theta * 1.5) * 0.4 + 0.2;
            ry = theta;
            rz = Math.cos(theta * 0.8) * 0.3;
          } else if (state.heroMotion === 'levitate') {
            rx = Math.sin(theta * 0.5) * 0.15 + 0.1;
            ry = theta * 0.7;
          } else if (state.heroMotion === 'monument') {
            rx = 0.2;
            ry = 0.4;
            rz = 0;
          }

          gltfMeshEngine.render3DMesh(sctx, {
            mesh: meshToRender,
            width: 0,
            height: 0,
            centerX: 0,
            centerY: 0,
            rotationX: rx,
            rotationY: ry,
            rotationZ: rz,
            scale: baseScale * pulse,
            color: state.palette.accent,
            fill: true,
            wireframe: true,
          });
        }
        sctx.restore();
      } catch (err) {
        console.warn('Custom GLB render failure:', err);
      }
      break;
    }

    default: {
      // 1. If custom Bodymovin/Lottie JSON is loaded, render dynamic vector rig layers
      if (state.customLottieJson) {
        try {
          const lottieData = JSON.parse(state.customLottieJson);
          if (Array.isArray(lottieData.layers) && lottieData.layers.length > 0) {
            lottieData.layers.forEach((_layer: { nm?: string; ty?: number }, idx: number) => {
              sctx.save();
              const layerRot = theta * (idx % 2 === 0 ? 1 : -1) * (idx * 0.5 + 1);
              sctx.rotate(layerRot);
              sctx.strokeStyle = idx % 2 === 0 ? accent : accent2;
              sctx.lineWidth = 2;
              sctx.beginPath();
              const radius = 24 * (idx + 1) * pulse;
              sctx.arc(0, 0, radius, 0, Math.PI * 1.75);
              sctx.stroke();

              // Vector Anchor Nodes
              sctx.fillStyle = ink;
              sctx.fillRect(Math.cos(layerRot) * radius - 3, Math.sin(layerRot) * radius - 3, 6, 6);
              sctx.restore();
            });
            break;
          }
        } catch {
          // fallback to procedural rig
        }
      }

      // 2. Built-in Bodymovin Vector Rig Presets
      const rings = 3;
      for (let r = 1; r <= rings; r++) {
        sctx.strokeStyle = r % 2 === 0 ? accent : accent2;
        sctx.lineWidth = 2.2;
        sctx.setLineDash(r === 2 ? [8, 6] : []);
        sctx.beginPath();
        sctx.arc(0, 0, 24 * r, theta * (r % 2 === 0 ? 1 : -1), theta + Math.PI * 1.65);
        sctx.stroke();
      }
      sctx.setLineDash([]);
      if (state.heroId === 'lottie-eq') {
        for (let b = -4; b <= 4; b++) {
          const bh = 16 + Math.abs(Math.sin(theta * 2 + b * 0.6)) * 46;
          sctx.fillStyle = b % 2 === 0 ? accent : ink;
          sctx.fillRect(b * 12 - 4, -bh / 2, 8, bh);
        }
      } else {
        sctx.fillStyle = accent;
        sctx.beginPath();
        sctx.arc(0, 0, 12 * pulse, 0, Math.PI * 2);
        sctx.fill();
      }
      break;
    }
  }

  sctx.restore();
}

