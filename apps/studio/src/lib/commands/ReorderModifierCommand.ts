import type { ICommand } from './ICommand';
import type { VideoIRDocument, ModifierNode } from '@acc/ir';

export class ReorderModifierCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private modifierType: string;
  private direction: 'up' | 'down';
  private didReorder: boolean = false;

  constructor(sequenceId: string, modifierType: string, direction: 'up' | 'down') {
    this.id = `reorder_mod_${sequenceId}_${modifierType}_${direction}_${Date.now()}`;
    this.description = `Reorder modifier ${modifierType} ${direction} on ${sequenceId}`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
    this.modifierType = modifierType;
    this.direction = direction;
  }

  private reorderInArray(modifiers: ModifierNode[]): boolean {
    const idx = modifiers.findIndex((m) => m.type === this.modifierType);
    if (idx === -1) return false;

    const targetIdx = this.direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= modifiers.length) return false;

    // Swap positions
    const temp = modifiers[idx];
    modifiers[idx] = modifiers[targetIdx];
    modifiers[targetIdx] = temp;
    return true;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    // 1. Timeline / Project level modifier
    if (this.sequenceId === 'timeline' || this.sequenceId === copy.meta.contentId) {
      if (copy.modifiers && Array.isArray(copy.modifiers)) {
        this.didReorder = this.reorderInArray(copy.modifiers);
      }
      return copy;
    }

    // 2. Track & Sequence level modifier
    for (const track of copy.tracks) {
      if (track.id === this.sequenceId && track.modifiers) {
        this.didReorder = this.reorderInArray(track.modifiers);
        return copy;
      }

      for (const seq of track.sequences) {
        if (seq.id === this.sequenceId && seq.modifiers) {
          this.didReorder = this.reorderInArray(seq.modifiers);
          return copy;
        }
      }
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (!this.didReorder) return doc;

    // Swapping back in the opposite direction cleanly inverts the operation
    const inverseDirection = this.direction === 'up' ? 'down' : 'up';
    const inverseCmd = new ReorderModifierCommand(this.sequenceId, this.modifierType, inverseDirection);
    return inverseCmd.execute(doc);
  }
}
