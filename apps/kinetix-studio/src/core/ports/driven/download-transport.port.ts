// ============================================================================
// KINETIX STUDIO - DRIVEN PORT: DOWNLOAD TRANSPORT PORT (ECMA-429)
// Pure architectural interface enforcing single-point download ownership
// across all export formats (MP4, WebM, GIF, PNG, SVG, PDF).
// ============================================================================

export interface IDownloadTransportPort {
  /**
   * Dispatches a single, non-colliding browser download anchor.
   */
  downloadBlob(blob: Blob, filename: string): void;

  /**
   * Saves to a user-selected FileSystemFileHandle if the File System Access API is active.
   */
  saveToFileHandle(blob: Blob, fileHandle: unknown): Promise<boolean>;
}
