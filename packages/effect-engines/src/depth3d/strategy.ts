import type { Image, Canvas } from '@napi-rs/canvas';
import type { Depth3DConfig, CaptionConfig } from '../types';
import type { DepthMeshLayers } from './depth-mesh';

export interface Depth3DFrameState {
  img: Image;
  subjectImg: Image | null;
  subjectBBox?: { x: number; y: number; width: number; height: number; minX?: number; maxX?: number; minY?: number; maxY?: number } | null;
  bgImg?: Image | null;
  bgCanvas?: Canvas | null;
  srcCanvas?: Canvas | null;
  baseCanvas?: Canvas | null;
  depthLayers?: DepthMeshLayers | null;
  width: number;
  height: number;
  frame: number;
  totalFrames: number;
  timeSec: number;
  progress: number;
  depthConfig: Depth3DConfig;
  captions?: CaptionConfig[];
  particles?: any[];
  dustParticles?: any[];
}

export interface IDepth3DRenderer {
  readonly mode: string;
  readonly aliases?: string[];
  renderFrame(ctx: any, state: Depth3DFrameState): void;
}

export class Depth3DRendererRegistry {
  private static instance: Depth3DRendererRegistry;
  private renderers = new Map<string, IDepth3DRenderer>();

  private constructor() {}

  public static getInstance(): Depth3DRendererRegistry {
    if (!Depth3DRendererRegistry.instance) {
      Depth3DRendererRegistry.instance = new Depth3DRendererRegistry();
    }
    return Depth3DRendererRegistry.instance;
  }

  public register(renderer: IDepth3DRenderer): void {
    this.renderers.set(renderer.mode, renderer);
    if (renderer.aliases) {
      for (const alias of renderer.aliases) {
        this.renderers.set(alias, renderer);
      }
    }
  }

  public get(mode: string): IDepth3DRenderer | undefined {
    return this.renderers.get(mode);
  }

  public has(mode: string): boolean {
    return this.renderers.has(mode);
  }

  public listModes(): string[] {
    return Array.from(this.renderers.keys());
  }
}
