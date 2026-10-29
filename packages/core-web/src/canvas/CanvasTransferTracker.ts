/**
 * Zero-mutation, memory-leak-safe registry for transferred HTMLCanvasElement handles.
 * Uses a WeakSet so garbage collection can cleanly reclaim detached canvas elements
 * across component unmounts and remounts without DOM monkey-patching.
 */
export class CanvasTransferTracker {
  private static readonly transferred = new WeakSet<HTMLCanvasElement | object>();

  public static markTransferred(canvas: HTMLCanvasElement | object): void {
    if (canvas && typeof canvas === 'object') {
      this.transferred.add(canvas);
    }
  }

  public static isTransferred(canvas: HTMLCanvasElement | object): boolean {
    if (!canvas || typeof canvas !== 'object') {
      return false;
    }
    return this.transferred.has(canvas);
  }
}
