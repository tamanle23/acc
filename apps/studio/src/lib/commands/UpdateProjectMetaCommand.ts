import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRMeta } from '@acc/ir';

export interface UpdateProjectMetaProperties {
  contentId?: string;
  globalFps?: number;
  canvasSize?: { w: number; h: number };
  [key: string]: unknown;
}

export class UpdateProjectMetaCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private updates: UpdateProjectMetaProperties;
  private previousSnapshot: Partial<IRMeta> | null = null;

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
      };
    }

    if (this.updates.contentId !== undefined) copy.meta.contentId = this.updates.contentId;
    if (this.updates.globalFps !== undefined) copy.meta.globalFps = this.updates.globalFps;
    if (this.updates.canvasSize !== undefined) {
      copy.meta.canvasSize = {
        w: Math.max(1, Math.round(this.updates.canvasSize.w)),
        h: Math.max(1, Math.round(this.updates.canvasSize.h)),
      };
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (!this.previousSnapshot) return doc;
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    if (this.previousSnapshot.contentId !== undefined) copy.meta.contentId = this.previousSnapshot.contentId;
    if (this.previousSnapshot.globalFps !== undefined) copy.meta.globalFps = this.previousSnapshot.globalFps;
    if (this.previousSnapshot.canvasSize !== undefined) copy.meta.canvasSize = { ...this.previousSnapshot.canvasSize };

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
