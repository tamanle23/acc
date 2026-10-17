import type { ICommand } from './ICommand';
import type { VideoIRDocument } from '@acc/ir';

export interface IHistoryStrategy {
  maxDepth: number;
  shouldCoalesce(lastCommand: ICommand, incomingCommand: ICommand): boolean;
}

export class CoalescingHistoryStrategy implements IHistoryStrategy {
  public maxDepth: number;
  public coalesceWindowMs: number;

  constructor(maxDepth = 50, coalesceWindowMs = 500) {
    this.maxDepth = maxDepth;
    this.coalesceWindowMs = coalesceWindowMs;
  }

  public shouldCoalesce(last: ICommand, incoming: ICommand): boolean {
    if (this.coalesceWindowMs <= 0) {
      return false;
    }
    if (incoming.timestamp - last.timestamp > this.coalesceWindowMs) {
      return false;
    }
    return last.tryMerge(incoming);
  }
}

export class HistoryManager {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private strategy: IHistoryStrategy;

  constructor(strategy: IHistoryStrategy = new CoalescingHistoryStrategy()) {
    this.strategy = strategy;
  }

  public execute(command: ICommand, currentDoc: VideoIRDocument): VideoIRDocument {
    const lastCommand = this.undoStack[this.undoStack.length - 1];

    if (lastCommand && this.strategy.shouldCoalesce(lastCommand, command)) {
      // Merged in-place, execute directly on current state
      const newDoc = command.execute(currentDoc);
      this.redoStack = [];
      return newDoc;
    }

    const newDoc = command.execute(currentDoc);
    this.undoStack.push(command);
    this.redoStack = [];

    // Max depth eviction
    if (this.undoStack.length > this.strategy.maxDepth) {
      this.undoStack.shift();
    }

    return newDoc;
  }

  public undo(currentDoc: VideoIRDocument): VideoIRDocument | null {
    if (this.undoStack.length === 0) return null;

    const command = this.undoStack.pop()!;
    const rolledBackDoc = command.undo(currentDoc);
    this.redoStack.push(command);

    return rolledBackDoc;
  }

  public redo(currentDoc: VideoIRDocument): VideoIRDocument | null {
    if (this.redoStack.length === 0) return null;

    const command = this.redoStack.pop()!;
    const replayedDoc = command.execute(currentDoc);
    this.undoStack.push(command);

    return replayedDoc;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  public getUndoCount(): number {
    return this.undoStack.length;
  }

  public getRedoCount(): number {
    return this.redoStack.length;
  }
}
