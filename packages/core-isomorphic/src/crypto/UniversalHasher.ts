/**
 * Isomorphic UniversalHasher:
 * Unified SHA-256 hash generator that dynamically selects Node crypto in server
 * environments and WebCrypto in browser/worker environments with zero static Node imports.
 */
export class UniversalHasher {
  private nodeHash: any | null = null;
  private chunks: (Uint8Array | string)[] = [];

  public static async create(): Promise<UniversalHasher> {
    const hasher = new UniversalHasher();
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).process?.versions?.node) {
        const cryptoModule = await import('crypto');
        if (cryptoModule && typeof cryptoModule.createHash === 'function') {
          hasher.nodeHash = cryptoModule.createHash('sha256');
        }
      }
    } catch {
      hasher.nodeHash = null;
    }
    return hasher;
  }

  public update(data: Uint8Array | string): void {
    if (this.nodeHash) {
      this.nodeHash.update(data);
    } else {
      this.chunks.push(typeof data === 'string' ? data : new Uint8Array(data));
    }
  }

  public async digest(): Promise<string> {
    if (this.nodeHash) {
      return this.nodeHash.digest('hex');
    }
    let totalLength = 0;
    const uint8Chunks: Uint8Array[] = [];
    for (const chunk of this.chunks) {
      const u8 = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
      uint8Chunks.push(u8);
      totalLength += u8.byteLength;
    }
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const u8 of uint8Chunks) {
      combined.set(u8, offset);
      offset += u8.byteLength;
    }
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', combined);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
