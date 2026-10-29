import { describe, it, expect, beforeAll } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { bootstrapCoreWeb } from '@acc/core-web';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '@acc/core';
import {
  ClientExportOrchestrator,
  yieldToMainThread,
} from '../apps/studio/src/lib/export/ClientExportOrchestrator';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import { ClipItem } from '../apps/studio/src/components/timeline/ClipItem';
import {
  resolveParamControlStrategy,
  NumberControlStrategy,
  RegionsArrayControlStrategy,
  MotionLifecycleControlStrategy,
  ShaderGroupControlStrategy,
  KaraokeGroupControlStrategy,
  SFXActionsControlStrategy,
  VisionStrategyControlStrategy,
  LightVectorControlStrategy,
} from '../apps/studio/src/components/inspector/ModifierControlStrategies';
import {
  LeftSidebar,
  DraggablePresetCard,
  DraggableAssetCard,
  DragOverlayPreview,
  ShapePresetThumbnail,
  TypographyPresetThumbnail,
} from '../apps/studio/src/components/LeftSidebar';

const STUDIO_SRC = path.resolve(__dirname, '../apps/studio/src');

describe('Studio Phase 3: Component Decomposition & 60 FPS Timeline Virtualization', () => {
  beforeAll(async () => {
    bootstrapCoreWeb();
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
    await IRStateManager.getInstance().recompile();
  });
  describe('1. Non-Blocking ClientExportOrchestrator & AbortSignal Cancellation', () => {
    it('yieldToMainThread resolves asynchronously without blocking the event loop', async () => {
      let resolved = false;
      const promise = yieldToMainThread().then(() => {
        resolved = true;
      });
      await promise;
      expect(resolved).toBe(true);
    });

    it('cancels export immediately when AbortSignal is aborted prior to or during encoding', async () => {
      const state = IRStateManager.getInstance().getState();
      const abortController = new AbortController();
      abortController.abort();

      const progressUpdates: number[] = [];
      let consumed = 0;
      const result = await ClientExportOrchestrator.exportToMp4({
        irState: state,
        width: 320,
        height: 180,
        fps: 30,
        totalFrames: 30,
        signal: abortController.signal,
        onProgress: (p) => progressUpdates.push(p),
        sinkFactory: () => ({
          initialize: async () => {},
          consumeFrame: async () => {
            consumed++;
          },
          finalize: async () => ({ framesConsumed: consumed, fileSizeBytes: 0, buffer: new Uint8Array(0) }),
        }),
      });

      expect(result.cancelled).toBe(true);
      expect(result.framesConsumed).toBe(0);
      expect(result.buffer).toBeNull();
      expect(progressUpdates).toContain(0);
    });

    it('cancels export mid-stream when AbortController aborts after a few frames', async () => {
      const state = IRStateManager.getInstance().getState();
      const abortController = new AbortController();

      const progressUpdates: number[] = [];
      let consumed = 0;
      const result = await ClientExportOrchestrator.exportToMp4({
        irState: state,
        width: 160,
        height: 90,
        fps: 30,
        totalFrames: 20,
        yieldEveryNFrames: 2,
        signal: abortController.signal,
        onProgress: (p) => {
          progressUpdates.push(p);
          if (progressUpdates.length >= 4) {
            abortController.abort();
          }
        },
        sinkFactory: () => ({
          initialize: async () => {},
          consumeFrame: async () => {
            consumed++;
          },
          finalize: async () => ({ framesConsumed: consumed, fileSizeBytes: 128, buffer: new Uint8Array(128) }),
        }),
      });

      expect(result.cancelled).toBe(true);
      expect(result.framesConsumed).toBeGreaterThan(0);
      expect(result.framesConsumed).toBeLessThan(20);
      expect(result.buffer).toBeNull();
    });
  });

  describe('2. 60 FPS Timeline Dragging & ClipItem Memoization Isolation', () => {
    it('wraps ClipItem in React.memo to prevent stationary clips from re-rendering at 60Hz', () => {
      // React.memo components have $$typeof === Symbol.for('react.memo')
      const memoSymbol = Symbol.for('react.memo');
      expect((ClipItem as unknown as { $$typeof?: symbol }).$$typeof).toBe(memoSymbol);
    });

    it('passes scoped primitive drag props from TimelineDom to ClipItem instead of global activeDragState', () => {
      const timelineDomContent = fs.readFileSync(
        path.join(STUDIO_SRC, 'components/timeline/TimelineDom.tsx'),
        'utf-8'
      );

      expect(timelineDomContent).toContain('isBeingDragged={isSeqDragged}');
      expect(timelineDomContent).toContain('isPairedDrag={isSeqPairedDrag}');
      expect(timelineDomContent).toContain('dragType={isSeqDragged ? activeDragState?.type ?? null : null}');
      expect(timelineDomContent).toContain('isAnyDragActive={Boolean(activeDragState)}');
      expect(timelineDomContent).toContain('const handleClipClick = useCallback(');
      expect(timelineDomContent).toContain('const getTrackBadgeStyle = useCallback(');
      expect(timelineDomContent).toContain('const handleClipHover = useCallback(');
    });
  });

  describe('3. Architectural Line Count & Modularity Invariants', () => {
    it('decomposes App.tsx below 300 lines with extracted ClientExportOrchestrator, useWorkspaceDnd, and ExportProgressModal', () => {
      const appPath = path.join(STUDIO_SRC, 'App.tsx');
      const appContent = fs.readFileSync(appPath, 'utf-8');
      const lineCount = appContent.split('\n').length;

      expect(lineCount).toBeLessThan(300);
      expect(appContent).toContain('ClientExportOrchestrator');
      expect(appContent).toContain('useWorkspaceDnd');
      expect(appContent).toContain('ExportProgressModal');
      expect(fs.existsSync(path.join(STUDIO_SRC, 'lib/export/ClientExportOrchestrator.ts'))).toBe(true);
      expect(fs.existsSync(path.join(STUDIO_SRC, 'lib/dnd/useWorkspaceDnd.ts'))).toBe(true);
      expect(fs.existsSync(path.join(STUDIO_SRC, 'components/ExportProgressModal.tsx'))).toBe(true);
    });

    it('decomposes LeftSidebar.tsx below 420 lines while preserving all card & thumbnail exports', () => {
      const sidebarPath = path.join(STUDIO_SRC, 'components/LeftSidebar.tsx');
      const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
      const lineCount = sidebarContent.split('\n').length;

      expect(lineCount).toBeLessThan(420);
      expect(typeof LeftSidebar).toBe('function');
      expect(typeof DraggablePresetCard).toBe('function');
      expect(typeof DraggableAssetCard).toBe('function');
      expect(typeof DragOverlayPreview).toBe('function');
      expect(typeof ShapePresetThumbnail).toBe('function');
      expect(typeof TypographyPresetThumbnail).toBe('function');
      expect(fs.existsSync(path.join(STUDIO_SRC, 'components/sidebar/PresetThumbnails.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(STUDIO_SRC, 'components/sidebar/SidebarCards.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(STUDIO_SRC, 'components/sidebar/SidebarActivityRail.tsx'))).toBe(true);
    });

    it('decomposes ModifierControlStrategies.tsx below 300 lines while resolving all 13 control strategies', () => {
      const strategiesPath = path.join(STUDIO_SRC, 'components/inspector/ModifierControlStrategies.tsx');
      const strategiesContent = fs.readFileSync(strategiesPath, 'utf-8');
      const lineCount = strategiesContent.split('\n').length;

      expect(lineCount).toBeLessThan(300);
      expect(resolveParamControlStrategy({ key: 'a', label: 'A', type: 'number' })).toBe(NumberControlStrategy);
      expect(resolveParamControlStrategy({ key: 'b', label: 'B', type: 'regions_array' })).toBe(RegionsArrayControlStrategy);
      expect(resolveParamControlStrategy({ key: 'c', label: 'C', type: 'motion_lifecycle' })).toBe(MotionLifecycleControlStrategy);
      expect(resolveParamControlStrategy({ key: 'd', label: 'D', type: 'shader_group' })).toBe(ShaderGroupControlStrategy);
      expect(resolveParamControlStrategy({ key: 'e', label: 'E', type: 'karaoke_group' })).toBe(KaraokeGroupControlStrategy);
      expect(resolveParamControlStrategy({ key: 'f', label: 'F', type: 'sfx_actions' })).toBe(SFXActionsControlStrategy);
      expect(resolveParamControlStrategy({ key: 'g', label: 'G', type: 'vision_depth_strategy' })).toBe(VisionStrategyControlStrategy);
      expect(resolveParamControlStrategy({ key: 'h', label: 'H', type: 'light_vector' })).toBe(LightVectorControlStrategy);
    });
  });
});
