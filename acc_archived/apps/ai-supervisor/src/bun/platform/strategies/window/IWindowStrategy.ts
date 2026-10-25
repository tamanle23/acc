export interface WindowOptions {
  readonly title: string;
  readonly url: string;
  readonly width?: number;
  readonly height?: number;
}

export interface WindowHandle {
  readonly pid: number;
  close(): Promise<void>;
}

export interface IWindowStrategy {
  readonly name: string;
  isSupported(): Promise<boolean>;
  launch(options: WindowOptions): Promise<WindowHandle>;
}
