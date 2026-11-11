// ============================================================================
// OPFS (ORIGIN PRIVATE FILE SYSTEM) HIGH-PERFORMANCE STORAGE UTILITY
// Sandboxed persistent zero-copy binary storage for background textures & imagery
// Paired with synchronous HTMLImageElement preloader cache for Canvas2D parity.
// ============================================================================

import { MEDIA_CATALOG } from '@/constants/media-catalog';

const OPFS_DIR = 'kinetix_backgrounds';

// In-Memory synchronous cache for immediate, zero-latency Canvas2D draws
const imageElementCache = new Map<string, HTMLImageElement>();
// Fallback in-memory blob store for test/mock or unsupported environments
const fallbackBlobStore = new Map<string, Blob>();

/**
 * Checks whether Web-Standard Origin Private File System is supported in current environment.
 */
export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage !== 'undefined' &&
    typeof navigator.storage.getDirectory === 'function'
  );
}

/**
 * Retrieves the sandboxed OPFS directory handle for Kinetix backgrounds.
 */
async function getBackgroundsDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (!isOpfsSupported()) return null;
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(OPFS_DIR, { create: true });
  } catch (err) {
    console.warn('[OPFS] Unable to access Origin Private File System directory:', err);
    return null;
  }
}

/**
 * Persists an image Blob/File to OPFS and preloads its HTMLImageElement into synchronous memory.
 * Returns the unique key/filename.
 */
export async function saveImageToOpfs(
  blob: Blob | File,
  filename = `bg_${Date.now()}.png`
): Promise<string> {
  const dir = await getBackgroundsDirHandle();

  if (dir) {
    try {
      const fileHandle = await dir.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (err) {
      console.warn('[OPFS] Failed writing file to OPFS, falling back to memory store:', err);
      fallbackBlobStore.set(filename, blob);
    }
  } else {
    fallbackBlobStore.set(filename, blob);
  }

  // Preload into synchronous HTMLImageElement cache
  await preloadImage(filename, blob);
  return filename;
}

/**
 * Loads an image Blob from OPFS or fallback store.
 */
export async function loadImageFromOpfs(key: string): Promise<Blob | null> {
  const dir = await getBackgroundsDirHandle();
  if (dir) {
    try {
      const fileHandle = await dir.getFileHandle(key);
      return await fileHandle.getFile();
    } catch {
      // Check fallback store
      return fallbackBlobStore.get(key) ?? null;
    }
  }
  return fallbackBlobStore.get(key) ?? null;
}

/**
 * Deletes an image from OPFS and clears it from the memory cache.
 */
export async function deleteImageFromOpfs(key: string): Promise<void> {
  imageElementCache.delete(key);
  fallbackBlobStore.delete(key);

  const dir = await getBackgroundsDirHandle();
  if (dir) {
    try {
      await dir.removeEntry(key);
    } catch {
      // Entry may not exist or already removed
    }
  }
}

/**
 * Preloads an image into the synchronous cache from a Blob or URL.
 */
export async function preloadImage(key: string, blobOrUrl?: Blob | string): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return null;

  if (imageElementCache.has(key)) {
    return imageElementCache.get(key)!;
  }

  let srcUrl = '';
  let shouldRevoke = false;

  if (typeof blobOrUrl === 'string') {
    srcUrl = blobOrUrl;
  } else if (blobOrUrl instanceof Blob) {
    srcUrl = URL.createObjectURL(blobOrUrl);
    shouldRevoke = true;
  } else {
    // Attempt loading from OPFS
    const blob = await loadImageFromOpfs(key);
    if (!blob) {
      // Check MEDIA_CATALOG for curated asset fallback
      const catalogItem = MEDIA_CATALOG.find((m) => m.id === key);
      if (catalogItem) {
        srcUrl = catalogItem.url || catalogItem.thumbUrl || catalogItem.dataUriFallback || '';
      }
      if (!srcUrl) return null;
    } else {
      srcUrl = URL.createObjectURL(blob);
      shouldRevoke = true;
    }
  }

  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    const isRemote = srcUrl.startsWith('http://') || srcUrl.startsWith('https://');
    if (isRemote) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      imageElementCache.set(key, img);
      if (shouldRevoke) URL.revokeObjectURL(srcUrl);
      resolve(img);
    };
    img.onerror = () => {
      const catalogItem = MEDIA_CATALOG.find((m) => m.id === key);
      if (catalogItem?.dataUriFallback && srcUrl !== catalogItem.dataUriFallback) {
        srcUrl = catalogItem.dataUriFallback;
        img.removeAttribute('crossorigin');
        img.src = srcUrl;
        return;
      }
      if (shouldRevoke) URL.revokeObjectURL(srcUrl);
      resolve(null);
    };
    img.src = srcUrl;
  });
}

/**
 * Synchronous accessor for the rendered canvas loop.
 * Guarantees zero async frame drops during RAF rendering and export.
 */
export function getCachedImage(key: string | null): HTMLImageElement | null {
  if (!key) return null;
  return imageElementCache.get(key) ?? null;
}

/**
 * Injects a preloaded image directly into the cache (useful for testing and SSR mocks).
 */
export function setCachedImage(key: string, img: HTMLImageElement): void {
  imageElementCache.set(key, img);
}

/**
 * Clears the entire in-memory image cache.
 */
export function clearImageCache(): void {
  imageElementCache.clear();
  fallbackBlobStore.clear();
}
