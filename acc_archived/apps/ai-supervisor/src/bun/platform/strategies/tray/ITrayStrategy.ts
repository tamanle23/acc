export type TrayColor = "green" | "yellow" | "red";

export interface TrayMenuItem {
  readonly id: string;
  readonly label: string;
  readonly enabled?: boolean;
}

export interface TrayCallbacks {
  readonly onOpenDashboard: () => void;
  readonly onMenuItemClick: (itemId: string) => void;
  readonly onQuit: () => void;
}

export interface TrayHandle {
  readonly pid: number;
  updateStatus(color: TrayColor, tooltip: string): Promise<void>;
  updateMenu(items: readonly TrayMenuItem[]): Promise<void>;
  stop(): Promise<void>;
}

export interface ITrayStrategy {
  readonly name: string;
  isSupported(): Promise<boolean>;
  start(callbacks: TrayCallbacks): Promise<TrayHandle>;
}
