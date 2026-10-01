import { Depth3DRendererRegistry } from '../strategy';
import {
  FrameBreakerRenderer,
  ParallaxRenderer,
  SandwichRenderer,
  DepthMeshRenderer,
  WigglegramRenderer,
} from './core-renderers';
import { IsometricPodiumRenderer } from './isometric-podium';
import { CutoutPortalRenderer } from './cutout-portal';
import { GyroFocalTiltRenderer } from './gyro-focal-tilt';
import { FlythroughCarouselRenderer } from './flythrough-carousel';
import { DiffuseShadowRenderer } from './diffuse-shadow';
import { GlassmorphicFresnelRenderer } from './glassmorphic-fresnel';
import { SilhouetteRimLightRenderer } from './silhouette-rim-light';
import { PlaneCastShadowRenderer } from './plane-cast-shadow';
import { MacroBokehRenderer } from './macro-bokeh';
import { AerialMistRenderer } from './aerial-mist';
import { RackFocusRenderer } from './rack-focus';
import { VignetteTunnelRenderer } from './vignette-tunnel';
import { PerspectiveGridRenderer } from './perspective-grid';
import { ExtrudedText3DRenderer } from './extruded-text-3d';
import { IsometricBillboardRenderer } from './isometric-billboard';
import { TunnelingTextRenderer } from './tunneling-text';

export * from './core-renderers';
export * from './isometric-podium';
export * from './cutout-portal';
export * from './gyro-focal-tilt';
export * from './flythrough-carousel';
export * from './diffuse-shadow';
export * from './glassmorphic-fresnel';
export * from './silhouette-rim-light';
export * from './plane-cast-shadow';
export * from './macro-bokeh';
export * from './aerial-mist';
export * from './rack-focus';
export * from './vignette-tunnel';
export * from './perspective-grid';
export * from './extruded-text-3d';
export * from './isometric-billboard';
export * from './tunneling-text';

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
