import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { isMetadataFile } from '../apps/studio/src/components/debugger/opfs/OpfsTree';
import type { OpfsTreeNode } from '@acc/core-web';

describe('OpfsTree Metadata File Filter Architecture (Hide *.meta.json)', () => {
  describe('isMetadataFile Utility Function', () => {
    it('accurately identifies companion metadata files ending with .meta.json', () => {
      const node1: OpfsTreeNode = {
        name: 'video_asset_1080p.mp4.meta.json',
        path: 'acc_content_cache/video_asset_1080p.mp4.meta.json',
        kind: 'file',
        sizeBytes: 256,
        lastModified: Date.now(),
        isMetadata: false,
      };
      expect(isMetadataFile(node1)).toBe(true);

      const nodeUpper: OpfsTreeNode = {
        name: 'AUDIO_ASSET.WAV.META.JSON',
        path: 'acc_content_cache/AUDIO_ASSET.WAV.META.JSON',
        kind: 'file',
        sizeBytes: 128,
        lastModified: Date.now(),
        isMetadata: false,
      };
      expect(isMetadataFile(nodeUpper)).toBe(true);
    });

    it('accurately identifies nodes explicitly flagged with isMetadata: true', () => {
      const nodeFlagged: OpfsTreeNode = {
        name: 'custom_companion_store',
        path: 'acc_content_cache/custom_companion_store',
        kind: 'file',
        sizeBytes: 512,
        lastModified: Date.now(),
        isMetadata: true,
      };
      expect(isMetadataFile(nodeFlagged)).toBe(true);
    });

    it('preserves regular non-metadata files including standalone JSON and media assets', () => {
      const regularJson: OpfsTreeNode = {
        name: 'project_config.json',
        path: 'acc_content_cache/project_config.json',
        kind: 'file',
        sizeBytes: 1024,
        lastModified: Date.now(),
        isMetadata: false,
        mimeType: 'application/json',
      };
      expect(isMetadataFile(regularJson)).toBe(false);

      const generalMetadataName: OpfsTreeNode = {
        name: 'metadata.json',
        path: 'acc_content_cache/metadata.json',
        kind: 'file',
        sizeBytes: 512,
        lastModified: Date.now(),
        isMetadata: false,
      };
      expect(isMetadataFile(generalMetadataName)).toBe(false);

      const videoFile: OpfsTreeNode = {
        name: 'hero_scene.mp4',
        path: 'acc_content_cache/hero_scene.mp4',
        kind: 'file',
        sizeBytes: 1024 * 1024 * 15,
        lastModified: Date.now(),
        isMetadata: false,
        mimeType: 'video/mp4',
      };
      expect(isMetadataFile(videoFile)).toBe(false);
    });
  });

  describe('Static Code & Architecture Verification in OpfsTree.tsx', () => {
    const opfsTreePath = path.resolve(
      __dirname,
      '../apps/studio/src/components/debugger/opfs/OpfsTree.tsx'
    );
    const content = fs.readFileSync(opfsTreePath, 'utf8');

    it('exports isMetadataFile utility for reusable testing and modular inspection', () => {
      expect(content).toContain('export function isMetadataFile');
      expect(content).toContain('/\\.meta\\.json$/i.test(node.name)');
    });

    it('unconditionally filters out all metadata files in filterNode predicate', () => {
      expect(content).toContain('if (isMetadataFile(node))');
      expect(content).toContain('return false;');
    });

    it('removes obsolete meta chip from filter chips list so user only filters valid content', () => {
      expect(content).toContain("['all', 'media', 'json', 'other'] as OpfsFilterType[]");
      expect(content).not.toContain("['all', 'media', 'json', 'meta', 'other']");
    });

    it('handles filteredRoot edge case when rootNode itself is a metadata file', () => {
      expect(content).toContain('if (rootNode.kind === \'file\' && isMetadataFile(rootNode))');
    });
  });

  describe('Mock OPFS Tree Filtering Simulation', () => {
    it('filters companion metadata files out of directory children hierarchy', () => {
      const mockRoot: OpfsTreeNode = {
        name: 'acc_content_cache',
        path: 'acc_content_cache',
        kind: 'directory',
        sizeBytes: 1024 * 1024,
        lastModified: Date.now(),
        isMetadata: false,
        children: [
          {
            name: 'camera_take_01.mp4',
            path: 'acc_content_cache/camera_take_01.mp4',
            kind: 'file',
            sizeBytes: 800000,
            lastModified: 1700000000,
            isMetadata: false,
            mimeType: 'video/mp4',
          },
          {
            name: 'camera_take_01.mp4.meta.json',
            path: 'acc_content_cache/camera_take_01.mp4.meta.json',
            kind: 'file',
            sizeBytes: 340,
            lastModified: 1700000000,
            isMetadata: true,
            mimeType: 'application/json',
          },
          {
            name: 'ambience_loop.wav',
            path: 'acc_content_cache/ambience_loop.wav',
            kind: 'file',
            sizeBytes: 200000,
            lastModified: 1700000100,
            isMetadata: false,
            mimeType: 'audio/wav',
          },
          {
            name: 'ambience_loop.wav.meta.json',
            path: 'acc_content_cache/ambience_loop.wav.meta.json',
            kind: 'file',
            sizeBytes: 290,
            lastModified: 1700000100,
            isMetadata: true,
            mimeType: 'application/json',
          },
          {
            name: 'timeline_markers.json',
            path: 'acc_content_cache/timeline_markers.json',
            kind: 'file',
            sizeBytes: 1500,
            lastModified: 1700000200,
            isMetadata: false,
            mimeType: 'application/json',
          },
        ],
      };

      const visibleChildren = mockRoot.children?.filter((child) => !isMetadataFile(child)) || [];
      expect(visibleChildren.length).toBe(3);
      expect(visibleChildren.map((c) => c.name)).toEqual([
        'camera_take_01.mp4',
        'ambience_loop.wav',
        'timeline_markers.json',
      ]);
      expect(visibleChildren.some((c) => c.name.endsWith('.meta.json'))).toBe(false);
      expect(visibleChildren.some((c) => c.isMetadata)).toBe(false);
    });
  });
});
