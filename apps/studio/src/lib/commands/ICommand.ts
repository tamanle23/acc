import type { VideoIRDocument } from '@acc/ir/client';

export interface ICommand {
  readonly id: string;
  readonly description: string;
  readonly timestamp: number;
  execute(doc: VideoIRDocument): VideoIRDocument;
  undo(doc: VideoIRDocument): VideoIRDocument;
  tryMerge(next: ICommand): boolean;
}
