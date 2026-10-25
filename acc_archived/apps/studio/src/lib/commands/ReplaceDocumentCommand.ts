import type { VideoIRDocument } from '@acc/ir';
import type { ICommand } from './ICommand';

/**
 * ReplaceDocumentCommand:
 * Undoable full-document snapshot command used by the Visual VideoIR JSON Debugger
 * when applying validated JSON edits directly to the live Studio workspace.
 */
export class ReplaceDocumentCommand implements ICommand {
  public readonly id: string;
  public readonly description = 'Apply JSON Debugger Edits';
  public readonly timestamp: number;
  private previousDoc: VideoIRDocument | null = null;
  private nextDoc: VideoIRDocument;

  constructor(nextDoc: VideoIRDocument) {
    this.id = `cmd-replace-doc-${Date.now()}`;
    this.timestamp = Date.now();
    this.nextDoc = JSON.parse(JSON.stringify(nextDoc));
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    this.previousDoc = JSON.parse(JSON.stringify(doc));
    return JSON.parse(JSON.stringify(this.nextDoc));
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (!this.previousDoc) {
      return doc;
    }
    return JSON.parse(JSON.stringify(this.previousDoc));
  }

  public tryMerge(_next: ICommand): boolean {
    return false;
  }
}
