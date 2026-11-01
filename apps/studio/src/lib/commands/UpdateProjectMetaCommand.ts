import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRMeta, StandardAspectRatio } from '@acc/ir';
import { getCanonicalCanvasSize, inferAspectRatioFromCanvasSize } from '@acc/ir';

export interface UpdateProjectMetaProperties {
  contentId?: string;
  globalFps?: number;
  canvasSize?: { w: number; h: number };
  aspectRatio?: StandardAspectRatio;
  [key: string]: unknown;
}

export class UpdateProjectMetaCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private updates: UpdateProjectMetaProperties;
  private previousSnapshot: Partial<IRMeta> | null = null;
  private previousTracksSnapshot: any = null;

  constructor(updates: UpdateProjectMetaProperties) {
    this.id = `project_meta_${Date.now()}`;
    this.description = `Update project meta properties`;
    this.timestamp = Date.now();
    this.updates = JSON.parse(JSON.stringify(updates));
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    if (this.previousSnapshot === null) {
      this.previousSnapshot = {
        contentId: copy.meta.contentId,
        globalFps: copy.meta.globalFps,
        canvasSize: { ...copy.meta.canvasSize },
        aspectRatio: copy.meta.aspectRatio || inferAspectRatioFromCanvasSize(copy.meta.canvasSize.w, copy.meta.canvasSize.h),
      };
      this.previousTracksSnapshot = JSON.parse(JSON.stringify(copy.tracks));
    }

    if (this.updates.contentId !== undefined) copy.meta.contentId = this.updates.contentId;
    if (this.updates.globalFps !== undefined) copy.meta.globalFps = this.updates.globalFps;

    let targetRatio = this.updates.aspectRatio;
    let targetCanvas = this.updates.canvasSize;

    if (targetRatio !== undefined) {
      copy.meta.aspectRatio = targetRatio;
      if (!targetCanvas) {
        targetCanvas = getCanonicalCanvasSize(targetRatio);
      }
    }

    if (targetCanvas !== undefined) {
      const oldW = copy.meta.canvasSize.w;
      const oldH = copy.meta.canvasSize.h;
      const newW = Math.max(1, Math.round(targetCanvas.w));
      const newH = Math.max(1, Math.round(targetCanvas.h));

      copy.meta.canvasSize = { w: newW, h: newH };
      if (!copy.meta.aspectRatio) {
        copy.meta.aspectRatio = targetRatio || inferAspectRatioFromCanvasSize(newW, newH);
      }

      // Dynamic Re-centering: if aspect ratio changes, adjust visual clip offsets
      if (oldW !== newW || oldH !== newH) {
        for (const track of copy.tracks) {
          if (track.type === 'video' || track.type === 'overlay') {
            for (const seq of track.sequences) {
              const transMod = seq.modifiers?.find((m) => m.type === 'transform');
              if (transMod && transMod.params) {
                // Ensure anchor point stays centered
                if (transMod.params.normX === undefined) transMod.params.normX = 0.5;
                if (transMod.params.normY === undefined) transMod.params.normY = 0.5;
              }
            }
          }
        }
      }
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (!this.previousSnapshot) return doc;
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    if (this.previousSnapshot.contentId !== undefined) copy.meta.contentId = this.previousSnapshot.contentId;
    if (this.previousSnapshot.globalFps !== undefined) copy.meta.globalFps = this.previousSnapshot.globalFps;
    if (this.previousSnapshot.canvasSize !== undefined) copy.meta.canvasSize = { ...this.previousSnapshot.canvasSize };
    if (this.previousSnapshot.aspectRatio !== undefined) copy.meta.aspectRatio = this.previousSnapshot.aspectRatio;
    if (this.previousTracksSnapshot) copy.tracks = JSON.parse(JSON.stringify(this.previousTracksSnapshot));

    return copy;
  }

  public tryMerge(next: ICommand): boolean {
    if (next instanceof UpdateProjectMetaCommand) {
      if (next.timestamp - this.timestamp < 500) {
        this.updates = { ...this.updates, ...next.updates };
        return true;
      }
    }
    return false;
  }
}
