/**
 * Pure Isomorphic Fast 32-bit FNV-1a Checksum
 * Operates on Uint8Array or string without Node.js crypto or WebCrypto async overhead.
 * Returns 8-character lowercase hexadecimal hash.
 */
export function fastChecksum(data: Uint8Array | string): string {
  let hash = 0x811c9dc5; // 2166136261 (FNV offset basis)

  if (typeof data === 'string') {
    for (let i = 0; i < data.length; i++) {
      const code = data.charCodeAt(i);
      // UTF-16 byte decomposition
      hash ^= code & 0xff;
      hash = Math.imul(hash, 0x01000193); // 16777619 (FNV prime)
      if (code > 0xff) {
        hash ^= (code >> 8) & 0xff;
        hash = Math.imul(hash, 0x01000193);
      }
    }
  } else {
    for (let i = 0; i < data.length; i++) {
      hash ^= data[i];
      hash = Math.imul(hash, 0x01000193);
    }
  }

  // Convert to unsigned 32-bit integer hex string, padded to 8 chars
  return (hash >>> 0).toString(16).padStart(8, '0');
}
