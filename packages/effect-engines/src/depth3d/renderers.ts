import { IDepth3DRenderer, Depth3DFrameState, Depth3DRendererRegistry } from './strategy';
import { drawFrameBreakerFrame } from './frame-breaker';
import { drawParallaxFrame } from './parallax';
import { drawSandwichFrame } from './sandwich';
import { drawDepthMeshFrame } from './depth-mesh';
import { drawWigglegramFrame } from './wigglegram';
import { drawImageCover } from './frame-breaker';

// 1. Existing Core Renderers wrapped as Strategies
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

// 2. Category 1: Frame-Breaking & Occlusion
export class IsometricPodiumRenderer implements IDepth3DRenderer {
  readonly mode = 'isometric_podium';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec, progress } = state;
    ctx.save();
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, width, height);

    // Draw background plate
    ctx.save();
    ctx.globalAlpha = 0.35;
    drawImageCover(ctx, img, 0, 0, width, height, 1.05);
    ctx.restore();

    // Calculate 3D Podium Geometry
    const centerX = width / 2;
    const centerY = height * 0.72 + Math.sin(timeSec * Math.PI * 0.8) * 6;
    const radiusX = width * 0.28;
    const radiusY = height * 0.09;
    const podiumHeight = height * 0.12;

    // Draw 3D Podium Cylinder Base
    const podGrad = ctx.createLinearGradient(centerX - radiusX, centerY, centerX + radiusX, centerY);
    podGrad.addColorStop(0, '#1e2038');
    podGrad.addColorStop(0.5, '#3b3e66');
    podGrad.addColorStop(1, '#151628');

    ctx.fillStyle = podGrad;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + podiumHeight, radiusX, radiusY, 0, 0, Math.PI);
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();

    // Top Ellipse Ring
    const topGrad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radiusX);
    topGrad.addColorStop(0, '#555988');
    topGrad.addColorStop(0.85, '#2d304d');
    topGrad.addColorStop(1, '#888cc8');

    ctx.fillStyle = topGrad;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#a0a5e8';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw Subject sitting on podium
    const targetImg = subjectImg || img;
    const subH = height * 0.58;
    const subW = subH * (targetImg.width / targetImg.height);
    const subX = centerX - subW / 2;
    const subY = centerY - subH + radiusY * 0.6;

    // Contact Cast Shadow on Podium Top
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - 5, subW * 0.38, radiusY * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(targetImg, subX, subY, subW, subH);

    ctx.restore();
  }
}

export class CutoutPortalRenderer implements IDepth3DRenderer {
  readonly mode = 'cutout_portal';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec, progress } = state;
    ctx.save();
    // Inner Environment / Space beneath
    ctx.fillStyle = '#05050b';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    const bgScale = 1.0 + progress * 0.12;
    drawImageCover(ctx, img, 0, 0, width, height, bgScale);
    ctx.restore();

    // Draw Portal Cutout Outer Frame
    const portalRadius = (0.35 + Math.sin(timeSec * Math.PI * 0.5) * 0.03) * Math.min(width, height);
    const centerX = width / 2;
    const centerY = height * 0.48;

    // Outer Dark Vignette Frame with Portal Cutout Hole
    ctx.save();
    ctx.fillStyle = '#030306';
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.arc(centerX, centerY, portalRadius, 0, Math.PI * 2, true);
    ctx.fill();

    // Glowing Neon Portal Edge Ring
    ctx.lineWidth = 12;
    const ringGrad = ctx.createConicGradient(timeSec, centerX, centerY);
    ringGrad.addColorStop(0, '#ff0055');
    ringGrad.addColorStop(0.33, '#00e5ff');
    ringGrad.addColorStop(0.66, '#7600ff');
    ringGrad.addColorStop(1, '#ff0055');
    ctx.strokeStyle = ringGrad;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 24;
    ctx.stroke();
    ctx.restore();

    // Subject Popping OUT of the Portal Ring
    if (subjectImg) {
      ctx.save();
      const scale = 1.05 + Math.sin(timeSec * Math.PI * 0.6) * 0.02;
      const subH = height * 0.68 * scale;
      const subW = subH * (subjectImg.width / subjectImg.height);
      const subX = centerX - subW / 2;
      const subY = centerY - subH * 0.55;

      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 25;
      ctx.shadowOffsetY = 15;
      ctx.drawImage(subjectImg, subX, subY, subW, subH);
      ctx.restore();
    }

    ctx.restore();
  }
}

// 3. Category 2: Depth Motion
export class GyroFocalTiltRenderer implements IDepth3DRenderer {
  readonly mode = 'gyro_focal_tilt';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec, progress } = state;
    ctx.save();
    ctx.fillStyle = '#080810';
    ctx.fillRect(0, 0, width, height);

    // Simulated Gyro Mouse / Coordinate Tilt Orbit
    const tiltX = Math.sin(timeSec * Math.PI * 0.9) * 0.12; // radians rotateY
    const tiltY = Math.cos(timeSec * Math.PI * 0.7) * 0.08; // radians rotateX

    const cardW = width * 0.75;
    const cardH = height * 0.75;
    const cardX = (width - cardW) / 2;
    const cardY = (height - cardH) / 2;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    // Skew transformation mapping 3D rotational projection onto 2D matrix
    ctx.transform(Math.cos(tiltX), Math.sin(tiltY), -Math.sin(tiltX) * 0.5, Math.cos(tiltY), 0, 0);
    ctx.translate(-width / 2, -height / 2);

    // Card Multi-tier Drop Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 20;

    // Card White Frame
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cardX, cardY, cardW, cardH, 20);
    ctx.fill();

    // Inner Image
    ctx.save();
    roundRect(ctx, cardX + 12, cardY + 12, cardW - 24, cardH - 24, 14);
    ctx.clip();
    drawImageCover(ctx, img, cardX + 12, cardY + 12, cardW - 24, cardH - 24);
    ctx.restore();

    // Parallax Subject Floating Ahead of Tilted Card Plane
    if (subjectImg) {
      const subX = cardX + tiltX * 80;
      const subY = cardY + tiltY * 60;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 20;
      drawImageCover(ctx, subjectImg, subX, subY, cardW, cardH);
    }

    ctx.restore();
    ctx.restore();
  }
}

export class FlythroughCarouselRenderer implements IDepth3DRenderer {
  readonly mode = 'flythrough_carousel';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, width, height, timeSec, progress } = state;
    ctx.save();
    ctx.fillStyle = '#04040a';
    ctx.fillRect(0, 0, width, height);

    const cardCount = 5;
    for (let i = cardCount - 1; i >= 0; i--) {
      // Z-depth progression along fly-through timeline
      const zProgress = (progress * 1.5 + i / cardCount) % 1.0;
      const zScale = Math.pow(zProgress, 2.2) * 1.4 + 0.1;
      const alpha = Math.min(1.0, zProgress * 2.5) * (1.0 - Math.pow(zProgress, 4));

      if (alpha <= 0.02) continue;

      const cardW = width * 0.5 * zScale;
      const cardH = height * 0.5 * zScale;
      const offsetX = Math.sin((i * 1.8) + timeSec) * width * 0.25 * zScale;
      const cardX = (width - cardW) / 2 + offsetX;
      const cardY = (height - cardH) / 2;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 20 * zScale;

      ctx.fillStyle = '#ffffff';
      roundRect(ctx, cardX, cardY, cardW, cardH, 12 * zScale);
      ctx.fill();

      ctx.save();
      roundRect(ctx, cardX + 6 * zScale, cardY + 6 * zScale, cardW - 12 * zScale, cardH - 12 * zScale, 8 * zScale);
      ctx.clip();
      drawImageCover(ctx, img, cardX, cardY, cardW, cardH);
      ctx.restore();

      ctx.restore();
    }

    ctx.restore();
  }
}

// 4. Category 3: Lighting & Materiality
export class DiffuseShadowRenderer implements IDepth3DRenderer {
  readonly mode = 'diffuse_shadow';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec } = state;
    ctx.save();
    ctx.fillStyle = '#0b0c16';
    ctx.fillRect(0, 0, width, height);

    const floatY = Math.sin(timeSec * Math.PI * 1.0) * 12;
    const cardW = width * 0.72;
    const cardH = height * 0.72;
    const cardX = (width - cardW) / 2;
    const cardY = (height - cardH) / 2 + floatY;

    // Multi-tier Elevation Shadows (Tier 1: Ambient soft blur, Tier 2: Directional crisp shadow)
    ctx.save();
    // Shadow Tier 1
    ctx.shadowColor = 'rgba(0, 5, 25, 0.45)';
    ctx.shadowBlur = 45;
    ctx.shadowOffsetY = 30;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cardX, cardY, cardW, cardH, 24);
    ctx.fill();

    // Shadow Tier 2
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, cardX, cardY, cardW, cardH, 24);
    ctx.fill();
    ctx.restore();

    // Card Content
    ctx.save();
    roundRect(ctx, cardX + 10, cardY + 10, cardW - 20, cardH - 20, 18);
    ctx.clip();
    drawImageCover(ctx, img, cardX + 10, cardY + 10, cardW - 20, cardH - 20);
    if (subjectImg) {
      drawImageCover(ctx, subjectImg, cardX + 10, cardY + 10, cardW - 20, cardH - 20);
    }
    ctx.restore();

    ctx.restore();
  }
}

export class GlassmorphicFresnelRenderer implements IDepth3DRenderer {
  readonly mode = 'glassmorphic_fresnel';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec } = state;
    ctx.save();
    // Deep Background Plate
    drawImageCover(ctx, img, 0, 0, width, height, 1.08);

    const glassW = width * 0.78;
    const glassH = height * 0.62;
    const glassX = (width - glassW) / 2;
    const glassY = (height - glassH) / 2 + Math.sin(timeSec * Math.PI * 0.8) * 8;

    // Frosted Glass Plate Base
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    roundRect(ctx, glassX, glassY, glassW, glassH, 28);
    ctx.fill();

    // Fresnel Edge Glow Stroke
    const fresnelGrad = ctx.createLinearGradient(glassX, glassY, glassX + glassW, glassY + glassH);
    fresnelGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    fresnelGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.15)');
    fresnelGrad.addColorStop(0.8, 'rgba(0, 229, 255, 0.6)');
    fresnelGrad.addColorStop(1, 'rgba(255, 0, 128, 0.8)');

    ctx.strokeStyle = fresnelGrad;
    ctx.lineWidth = 3;
    roundRect(ctx, glassX, glassY, glassW, glassH, 28);
    ctx.stroke();
    ctx.restore();

    // Subject Popping Over Glass Surface
    if (subjectImg) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 12;
      drawImageCover(ctx, subjectImg, glassX + 20, glassY - 20, glassW - 40, glassH);
      ctx.restore();
    }

    ctx.restore();
  }
}

export class SilhouetteRimLightRenderer implements IDepth3DRenderer {
  readonly mode = 'silhouette_rim_light';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec } = state;
    ctx.save();
    ctx.fillStyle = '#040408';
    ctx.fillRect(0, 0, width, height);

    // Dim Background Plate
    ctx.save();
    ctx.globalAlpha = 0.30;
    drawImageCover(ctx, img, 0, 0, width, height);
    ctx.restore();

    const targetImg = subjectImg || img;
    const subH = height * 0.82;
    const subW = subH * (targetImg.width / targetImg.height);
    const subX = (width - subW) / 2;
    const subY = height - subH;

    // Render Backlight Rim Contour Glow
    ctx.save();
    const glowPulse = 18 + Math.sin(timeSec * Math.PI * 1.5) * 8;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = glowPulse;
    ctx.shadowOffsetX = -6;
    ctx.shadowOffsetY = -6;
    ctx.drawImage(targetImg, subX, subY, subW, subH);

    ctx.shadowColor = '#ff0077';
    ctx.shadowBlur = glowPulse;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(targetImg, subX, subY, subW, subH);
    ctx.restore();

    // Front Subject Pass
    ctx.save();
    ctx.drawImage(targetImg, subX, subY, subW, subH);
    ctx.restore();

    ctx.restore();
  }
}

export class PlaneCastShadowRenderer implements IDepth3DRenderer {
  readonly mode = 'plane_cast_shadow';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec } = state;
    ctx.save();
    ctx.fillStyle = '#10121e';
    ctx.fillRect(0, 0, width, height);

    // Ground Floor Plane Divider
    const groundY = height * 0.75;
    ctx.fillStyle = '#080910';
    ctx.fillRect(0, groundY, width, height - groundY);

    const targetImg = subjectImg || img;
    const subH = height * 0.65;
    const subW = subH * (targetImg.width / targetImg.height);
    const subX = (width - subW) / 2;
    const subY = groundY - subH + 15;

    // Perspective Cast Shadow Skewed onto Ground Plane
    ctx.save();
    ctx.translate(width / 2, groundY);
    ctx.transform(1, 0, -0.8, 0.28, 0, 0); // Skew shadow onto ground
    ctx.translate(-width / 2, -groundY);

    ctx.fillStyle = 'black';
    ctx.globalAlpha = 0.55;
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 15;
    ctx.drawImage(targetImg, subX, groundY - subH, subW, subH);
    ctx.restore();

    // Subject Stand Upright
    ctx.save();
    ctx.drawImage(targetImg, subX, subY, subW, subH);
    ctx.restore();

    ctx.restore();
  }
}

// 5. Category 4: Depth of Field & Atmospherics
export class MacroBokehRenderer implements IDepth3DRenderer {
  readonly mode = 'macro_bokeh';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec, frame } = state;
    ctx.save();
    // Crisp Subject & Background
    drawImageCover(ctx, img, 0, 0, width, height);
    if (subjectImg) drawImageCover(ctx, subjectImg, 0, 0, width, height);

    // Foreground Heavily Blurred Macro Light Orbs / Bokeh
    ctx.save();
    const orbCount = 12;
    for (let i = 0; i < orbCount; i++) {
      const bx = (Math.sin(i * 37 + frame * 0.02) * 0.5 + 0.5) * width;
      const by = (Math.cos(i * 73 + frame * 0.015) * 0.5 + 0.5) * height;
      const size = 45 + (i % 5) * 25;
      const opacity = 0.25 + (i % 4) * 0.12;

      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, size);
      grad.addColorStop(0, `rgba(255, 235, 180, ${opacity * 1.5})`);
      grad.addColorStop(0.6, `rgba(255, 180, 120, ${opacity * 0.6})`);
      grad.addColorStop(1, 'rgba(255, 180, 120, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }
}

export class AerialMistRenderer implements IDepth3DRenderer {
  readonly mode = 'aerial_mist';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec, progress } = state;
    ctx.save();
    // Distant Background Plate (Desaturated & Blue-tinted by Mist)
    drawImageCover(ctx, img, 0, 0, width, height, 1.05);

    // Aerial Mist Overlay
    ctx.fillStyle = 'rgba(180, 210, 240, 0.35)';
    ctx.fillRect(0, 0, width, height);

    // Foreground Subject Cuts Through Mist
    if (subjectImg) {
      ctx.save();
      const subScale = 1.0 + progress * 0.06;
      const subW = width * subScale;
      const subH = height * subScale;
      const subX = (width - subW) / 2;
      const subY = (height - subH) / 2;
      drawImageCover(ctx, subjectImg, subX, subY, subW, subH);
      ctx.restore();
    }

    ctx.restore();
  }
}

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

export class VignetteTunnelRenderer implements IDepth3DRenderer {
  readonly mode = 'vignette_tunnel';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec } = state;
    ctx.save();
    drawImageCover(ctx, img, 0, 0, width, height);
    if (subjectImg) drawImageCover(ctx, subjectImg, 0, 0, width, height);

    // Radial Volumetric Vignette & Spotlight
    const spotX = width / 2 + Math.sin(timeSec * Math.PI * 0.5) * width * 0.08;
    const spotY = height / 2;

    const vigGrad = ctx.createRadialGradient(spotX, spotY, width * 0.20, spotX, spotY, width * 0.75);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(0.7, 'rgba(5, 5, 12, 0.55)');
    vigGrad.addColorStop(1, 'rgba(2, 2, 8, 0.92)');

    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  }
}

// 6. Category 5: Spatial Architecture
export class PerspectiveGridRenderer implements IDepth3DRenderer {
  readonly mode = 'perspective_grid';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, subjectImg, width, height, timeSec, frame } = state;
    ctx.save();
    ctx.fillStyle = '#030308';
    ctx.fillRect(0, 0, width, height);

    // Draw Background Sky
    ctx.save();
    ctx.globalAlpha = 0.40;
    drawImageCover(ctx, img, 0, 0, width, height * 0.55);
    ctx.restore();

    // 3D Moving Perspective Ground Grid
    const horizonY = height * 0.52;
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;

    // Vanishing perspective lines radiating from horizon center
    const vanishX = width / 2;
    const lineCount = 18;
    for (let i = -lineCount / 2; i <= lineCount / 2; i++) {
      const targetX = vanishX + i * (width * 0.12);
      ctx.beginPath();
      ctx.moveTo(vanishX, horizonY);
      ctx.lineTo(targetX, height);
      ctx.stroke();
    }

    // Horizontal receding depth grid lines
    const speed = (frame * 3) % 40;
    for (let y = horizonY; y < height; y += (y - horizonY) * 0.18 + 4) {
      const drawY = y + speed * ((y - horizonY) / height);
      if (drawY > height) continue;
      ctx.beginPath();
      ctx.moveTo(0, drawY);
      ctx.lineTo(width, drawY);
      ctx.stroke();
    }
    ctx.restore();

    // Subject Standing on Grid Horizon
    const targetImg = subjectImg || img;
    const subH = height * 0.55;
    const subW = subH * (targetImg.width / targetImg.height);
    const subX = (width - subW) / 2;
    const subY = horizonY - subH + 20;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 20;
    ctx.drawImage(targetImg, subX, subY, subW, subH);
    ctx.restore();

    ctx.restore();
  }
}

export class ExtrudedText3DRenderer implements IDepth3DRenderer {
  readonly mode = 'extruded_text_3d';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, width, height, timeSec, captions = [] } = state;
    ctx.save();
    ctx.fillStyle = '#060610';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.25;
    drawImageCover(ctx, img, 0, 0, width, height);
    ctx.restore();

    const titleText = captions.length > 0 ? captions[0].text : '3D EXTRUDED';
    const fontSize = Math.round(width * 0.085);
    const centerX = width / 2;
    const centerY = height / 2 + Math.sin(timeSec * Math.PI * 0.8) * 10;

    ctx.font = `900 ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Render 3D Extrusion Stack
    const depthLayers = 16;
    for (let i = depthLayers; i >= 1; i--) {
      ctx.fillStyle = `rgb(${Math.round(15 + i * 8)}, ${Math.round(20 + i * 10)}, ${Math.round(40 + i * 12)})`;
      ctx.fillText(titleText.toUpperCase(), centerX + i * 1.5, centerY + i * 2.0);
    }

    // Front Face Pass with Metallic Gradient
    const frontGrad = ctx.createLinearGradient(0, centerY - fontSize / 2, 0, centerY + fontSize / 2);
    frontGrad.addColorStop(0, '#ffffff');
    frontGrad.addColorStop(0.5, '#00e5ff');
    frontGrad.addColorStop(1, '#7600ff');

    ctx.fillStyle = frontGrad;
    ctx.fillText(titleText.toUpperCase(), centerX, centerY);

    ctx.restore();
  }
}

export class IsometricBillboardRenderer implements IDepth3DRenderer {
  readonly mode = 'isometric_billboard';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, width, height, timeSec } = state;
    ctx.save();
    ctx.fillStyle = '#080914';
    ctx.fillRect(0, 0, width, height);

    // 30-degree Isometric Skew Matrix Transformation
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 6); // -30 deg
    ctx.transform(1, Math.tan(Math.PI / 6), 0, 1, 0, 0); // skewX 30 deg
    ctx.translate(-width / 2, -height / 2);

    const cardW = width * 0.55;
    const cardH = height * 0.55;
    const cardX = (width - cardW) / 2;
    const cardY = (height - cardH) / 2 + Math.sin(timeSec * Math.PI * 0.8) * 10;

    // Isometric 3D Slab Thickness
    ctx.fillStyle = '#1b1d36';
    roundRect(ctx, cardX + 18, cardY + 18, cardW, cardH, 16);
    ctx.fill();

    // Front Billboard Face
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fill();

    ctx.save();
    roundRect(ctx, cardX + 8, cardY + 8, cardW - 16, cardH - 16, 12);
    ctx.clip();
    drawImageCover(ctx, img, cardX + 8, cardY + 8, cardW - 16, cardH - 16);
    ctx.restore();

    ctx.restore();
    ctx.restore();
  }
}

export class TunnelingTextRenderer implements IDepth3DRenderer {
  readonly mode = 'tunneling_text';
  renderFrame(ctx: any, state: Depth3DFrameState): void {
    const { img, width, height, timeSec, progress, captions = [] } = state;
    ctx.save();
    ctx.fillStyle = '#020206';
    ctx.fillRect(0, 0, width, height);

    const activeText = captions.length > 0 ? captions[0].text : 'TUNNEL VISION';
    const ringCount = 7;

    for (let i = ringCount - 1; i >= 0; i--) {
      const ringProgress = (progress + i / ringCount) % 1.0;
      const scale = Math.pow(ringProgress, 2.5) * 1.8 + 0.05;
      const alpha = Math.sin(ringProgress * Math.PI);

      if (alpha <= 0.02) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      const fontSize = Math.round(width * 0.07 * scale);
      ctx.font = `900 ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillStyle = `hsl(${(i * 50 + timeSec * 100) % 360}, 100%, 70%)`;
      ctx.fillText(activeText.toUpperCase(), width / 2, height / 2);
      ctx.restore();
    }

    ctx.restore();
  }
}

// Helper: Round Rectangle
function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Register all 17 target subject 3D effects into singleton Depth3DRendererRegistry
 */
export function registerAll3DEffectStrategies(): void {
  const registry = Depth3DRendererRegistry.getInstance();

  // Core 5
  registry.register(new FrameBreakerRenderer());
  registry.register(new ParallaxRenderer());
  registry.register(new SandwichRenderer());
  registry.register(new DepthMeshRenderer());
  registry.register(new WigglegramRenderer());

  // Category 1
  registry.register(new IsometricPodiumRenderer());
  registry.register(new CutoutPortalRenderer());

  // Category 2
  registry.register(new GyroFocalTiltRenderer());
  registry.register(new FlythroughCarouselRenderer());

  // Category 3
  registry.register(new DiffuseShadowRenderer());
  registry.register(new GlassmorphicFresnelRenderer());
  registry.register(new SilhouetteRimLightRenderer());
  registry.register(new PlaneCastShadowRenderer());

  // Category 4
  registry.register(new MacroBokehRenderer());
  registry.register(new AerialMistRenderer());
  registry.register(new RackFocusRenderer());
  registry.register(new VignetteTunnelRenderer());

  // Category 5
  registry.register(new PerspectiveGridRenderer());
  registry.register(new ExtrudedText3DRenderer());
  registry.register(new IsometricBillboardRenderer());
  registry.register(new TunnelingTextRenderer());
}
