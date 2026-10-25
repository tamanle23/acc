export type TimelineMode = 'dom' | 'canvas';

export interface ITimelineRenderStrategy {
  readonly mode: TimelineMode;
  mount(): void;
  unmount(): void;
}
