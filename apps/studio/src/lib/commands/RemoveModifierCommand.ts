import type { ICommand } from './ICommand';
import type { VideoIRDocument, ModifierNode } from '@acc/ir/client';

export class RemoveModifierCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private modifierType: string;
  private removedModifier: ModifierNode | null = null;
  private removedIndex: number = -1;

  constructor(sequenceId: string, modifierType: string) {
    this.id = `rem_mod_${sequenceId}_${modifierType}_${Date.now()}`;
    this.description = `Remove modifier ${modifierType} from ${sequenceId}`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
    this.modifierType = modifierType;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      for (const seq of track.sequences) {
        if (seq.id === this.sequenceId && seq.modifiers) {
          const idx = seq.modifiers.findIndex((m: ModifierNode) => m.type === this.modifierType);
          if (idx !== -1) {
            this.removedModifier = seq.modifiers[idx];
            this.removedIndex = idx;
            seq.modifiers.splice(idx, 1);
          }
          return copy;
        }
      }
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (!this.removedModifier) return doc;

    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      for (const seq of track.sequences) {
        if (seq.id === this.sequenceId) {
          if (!seq.modifiers) seq.modifiers = [];
          if (this.removedIndex >= 0 && this.removedIndex <= seq.modifiers.length) {
            seq.modifiers.splice(this.removedIndex, 0, this.removedModifier);
          } else {
            seq.modifiers.push(this.removedModifier);
          }
          return copy;
        }
      }
    }

    return copy;
  }
}
