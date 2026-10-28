import { describe, it, expect, beforeEach } from 'bun:test';
import {
  OpfsCacheStrategy,
  formatOpfsBytes,
  type OpfsTreeNode,
  type OpfsEntryInfo,
} from '../packages/core-web/src/cache/OpfsCacheStrategy';

describe('OpfsCacheStrategy Inspector & Files/Folders Debugger Suite', () => {
  describe('formatOpfsBytes Utility', () => {
    it('formats 0 bytes correctly', () => {
      expect(formatOpfsBytes(0)).toBe('0 B');
    });

    it('formats bytes, kilobytes, megabytes, and gigabytes accurately', () => {
      expect(formatOpfsBytes(512)).toBe('512.00 B');
      expect(formatOpfsBytes(1024)).toBe('1.00 KB');
      expect(formatOpfsBytes(1024 * 1024 * 2.5)).toBe('2.50 MB');
      expect(formatOpfsBytes(1024 * 1024 * 1024 * 10.25)).toBe('10.25 GB');
    });
  });

  describe('Standalone Capacity without OPFS Runtime', () => {
    it('initializes with default directory name', () => {
      const strategy = new OpfsCacheStrategy();
      expect(strategy.getDirectoryName()).toBe('acc_content_cache');
    });

    it('initializes with custom directory name', () => {
      const strategy = new OpfsCacheStrategy({ directoryName: 'custom_studio_cache' });
      expect(strategy.getDirectoryName()).toBe('custom_studio_cache');
    });

    it('gracefully returns null or empty tree when OPFS is unsupported (SSR/Node/Bun without navigator.storage)', async () => {
      const strategy = new OpfsCacheStrategy();
      // In bun test without simulated navigator.storage, isSupported is false
      const tree = await strategy.inspectTree();
      expect(tree).toBeDefined();
      expect(tree.kind).toBe('directory');
      expect(tree.name).toBe('acc_content_cache');
      expect(tree.children).toEqual([]);

      const entries = await strategy.inspectEntries();
      expect(entries).toEqual([]);

      const blob = await strategy.readEntryBlob('non-existent');
      expect(blob).toBeNull();

      const text = await strategy.readEntryText('non-existent');
      expect(text).toBeNull();
    });
  });

  describe('Simulated OPFS Directory & File Handle Hierarchy', () => {
    let mockRoot: any;
    let mockCacheDir: any;
    let originalNavigator: any;

    beforeEach(() => {
      const files = new Map<string, { content: Uint8Array; mime: string; lastModified: number }>();
      const subdirs = new Map<string, any>();

      // Seed mock files
      files.set('video_clip_1.mp4', {
        content: new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112]),
        mime: 'video/mp4',
        lastModified: 1700000000000,
      });

      files.set('video_clip_1.mp4.meta.json', {
        content: new TextEncoder().encode(
          JSON.stringify({
            checksum: 'sha256-mock-1234',
            mimeType: 'video/mp4',
            createdAt: 1700000000000,
            sizeBytes: 8,
            metadata: { width: 1920, height: 1080, fps: 30 },
          })
        ),
        mime: 'application/json',
        lastModified: 1700000000000,
      });

      files.set('audio_track_ambient.wav', {
        content: new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69]),
        mime: 'audio/wav',
        lastModified: 1700000050000,
      });

      mockCacheDir = {
        name: 'acc_content_cache',
        kind: 'directory',
        async getFileHandle(name: string, opts?: { create?: boolean }) {
          if (!files.has(name)) {
            if (opts?.create) {
              const newFile = { content: new Uint8Array(0), mime: 'application/octet-stream', lastModified: Date.now() };
              files.set(name, newFile);
            } else {
              throw new Error(`File ${name} not found`);
            }
          }
          const fileRecord = files.get(name)!;
          return {
            name,
            kind: 'file',
            async getFile() {
              return new File([fileRecord.content], name, {
                type: fileRecord.mime,
                lastModified: fileRecord.lastModified,
              });
            },
            async createWritable() {
              const chunks: Uint8Array[] = [];
              return {
                async write(chunk: any) {
                  if (typeof chunk === 'string') {
                    chunks.push(new TextEncoder().encode(chunk));
                  } else if (chunk?.stream) {
                    const reader = chunk.stream().getReader();
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;
                      chunks.push(value);
                    }
                  } else {
                    chunks.push(new Uint8Array(chunk));
                  }
                },
                async close() {
                  const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
                  const merged = new Uint8Array(total);
                  let offset = 0;
                  for (const c of chunks) {
                    merged.set(c, offset);
                    offset += c.byteLength;
                  }
                  fileRecord.content = merged;
                  fileRecord.lastModified = Date.now();
                },
                async abort() {},
              };
            },
          };
        },
        async removeEntry(name: string) {
          if (!files.has(name) && !subdirs.has(name)) {
            throw new Error(`Entry ${name} not found`);
          }
          files.delete(name);
          subdirs.delete(name);
        },
        async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
          if (!subdirs.has(name)) {
            if (opts?.create) {
              const newDir = { name, kind: 'directory', async *values() {} };
              subdirs.set(name, newDir);
            } else {
              throw new Error(`Dir ${name} not found`);
            }
          }
          return subdirs.get(name);
        },
        async *values() {
          for (const [name, rec] of files.entries()) {
            yield {
              name,
              kind: 'file',
              async getFile() {
                return new File([rec.content], name, {
                  type: rec.mime,
                  lastModified: rec.lastModified,
                });
              },
            };
          }
          for (const [name] of subdirs.entries()) {
            yield {
              name,
              kind: 'directory',
            };
          }
        },
      };

      mockRoot = {
        name: 'root',
        async getDirectoryHandle(name: string) {
          if (name === 'acc_content_cache') {
            return mockCacheDir;
          }
          throw new Error('Directory not found');
        },
      };

      originalNavigator = globalThis.navigator;
      (globalThis as any).navigator = {
        storage: {
          getDirectory: async () => mockRoot,
          estimate: async () => ({
            usage: 1024 * 1024 * 45, // 45 MB
            quota: 1024 * 1024 * 1024 * 50, // 50 GB
          }),
        },
      };
    });

    it('reports isSupported as true in simulated environment', () => {
      const strategy = new OpfsCacheStrategy();
      expect(strategy.isSupported()).toBe(true);
    });

    it('estimates storage quota and percentage accurately', async () => {
      const strategy = new OpfsCacheStrategy();
      const estimate = await strategy.getStorageEstimate();
      expect(estimate).not.toBeNull();
      expect(estimate?.usage).toBe(1024 * 1024 * 45);
      expect(estimate?.quota).toBe(1024 * 1024 * 1024 * 50);
      expect(estimate?.formattedUsage).toBe('45.00 MB');
      expect(estimate?.formattedQuota).toBe('50.00 GB');
      expect(estimate?.usagePercent).toBeGreaterThan(0);
    });

    it('recursively inspects OPFS directory tree and maps companion metadata', async () => {
      const strategy = new OpfsCacheStrategy();
      const tree = await strategy.inspectTree();

      expect(tree.name).toBe('acc_content_cache');
      expect(tree.kind).toBe('directory');
      expect(tree.children?.length).toBe(3);

      const videoNode = tree.children?.find((c) => c.name === 'video_clip_1.mp4');
      expect(videoNode).toBeDefined();
      expect(videoNode?.kind).toBe('file');
      expect(videoNode?.sizeBytes).toBe(8);
      expect(videoNode?.isMetadata).toBe(false);
      expect(videoNode?.metadata).toBeDefined();
      expect(videoNode?.metadata?.checksum).toBe('sha256-mock-1234');
      expect(videoNode?.metadata?.metadata?.width).toBe(1920);

      const metaNode = tree.children?.find((c) => c.name === 'video_clip_1.mp4.meta.json');
      expect(metaNode).toBeDefined();
      expect(metaNode?.isMetadata).toBe(true);
      expect(metaNode?.mimeType).toContain('application/json');

      const audioNode = tree.children?.find((c) => c.name === 'audio_track_ambient.wav');
      expect(audioNode).toBeDefined();
      expect(audioNode?.sizeBytes).toBe(12);
    });

    it('inspects flat entries list with and without metadata files', async () => {
      const strategy = new OpfsCacheStrategy();

      const allEntries = await strategy.inspectEntries(true);
      expect(allEntries.length).toBe(3);

      const contentOnlyEntries = await strategy.inspectEntries(false);
      expect(contentOnlyEntries.length).toBe(2);
      expect(contentOnlyEntries.some((e) => e.isMetadata)).toBe(false);
    });

    it('reads entry as Blob and UTF-8 text', async () => {
      const strategy = new OpfsCacheStrategy();

      const blob = await strategy.readEntryBlob('audio_track_ambient.wav');
      expect(blob).not.toBeNull();
      expect(blob?.size).toBe(12);

      const text = await strategy.readEntryText('video_clip_1.mp4.meta.json');
      expect(text).not.toBeNull();
      expect(text).toContain('sha256-mock-1234');
    });

    it('writes custom test file and removes entries', async () => {
      const strategy = new OpfsCacheStrategy();

      await strategy.writeCustomFile('debug-test.json', JSON.stringify({ test: true }), 'application/json');
      const readBack = await strategy.readEntryText('debug-test.json');
      expect(readBack).toBe(JSON.stringify({ test: true }));

      const deleted = await strategy.removeCustomEntry('debug-test.json');
      expect(deleted).toBe(true);

      const afterDelete = await strategy.readEntryBlob('debug-test.json');
      expect(afterDelete).toBeNull();
    });
  });
});
