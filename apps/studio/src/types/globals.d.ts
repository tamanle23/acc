export {};

declare global {
  interface IdleDeadline {
    readonly didTimeout: boolean;
    timeRemaining(): number;
  }

  interface IdleRequestOptions {
    timeout?: number;
  }

  interface Window {
    requestIdleCallback(
      callback: (deadline: IdleDeadline) => void,
      options?: IdleRequestOptions
    ): number;
    cancelIdleCallback(handle: number): void;
  }
}
