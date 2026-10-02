import { CanvasContext2D } from '../canvas-strategies/base';

export interface VFXSimulationParams {
  width: number;
  height: number;
  fps: number;
  duration: number;
  variant: string;
  bgTransparent: boolean;
  [key: string]: any;
}

export interface IVFXSimulatorStrategy {
  readonly name: string;
  init(params: VFXSimulationParams): void;
  update(dt: number, totalTime: number): void;
  draw(ctx: CanvasContext2D, totalTime?: number): void;
}

export abstract class BaseVFXSimulator implements IVFXSimulatorStrategy {
  abstract readonly name: string;
  protected params!: VFXSimulationParams;
  protected width: number = 1920;
  protected height: number = 1080;
  protected fps: number = 30;
  protected duration: number = 5;
  protected variant: string = 'default';
  protected currentTimeSec: number = 0;

  init(params: VFXSimulationParams): void {
    this.params = params;
    this.width = params.width;
    this.height = params.height;
    this.fps = params.fps;
    this.duration = params.duration;
    this.variant = params.variant;
    this.currentTimeSec = 0;
  }

  update(dt: number, totalTime: number): void {
    this.currentTimeSec = totalTime;
  }

  abstract draw(ctx: CanvasContext2D, totalTime?: number): void;
}
