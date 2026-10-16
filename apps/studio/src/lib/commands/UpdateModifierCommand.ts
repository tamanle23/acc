import type { ICommand } from './ICommand';
import type { VideoIRDocument, ModifierNode } from '@acc/ir/client';

export class UpdateModifierCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private modifierType: string;
  private params: Record<string, unknown>;
  private previousParamsSnapshot: Record<string, unknown> | null = null;
  private wasPreviouslyExisting: boolean = true;

  constructor(sequenceId: string, modifierType: string, params: Record<string, unknown>) {
    this.id = `mod_${sequenceId}_${modifierType}_${Date.now()}`;
    this.description = `Update modifier ${modifierType} on ${sequenceId}`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
    this.modifierType = modifierType;
    this.params = { ...params };
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      for (const seq of track.sequences) {
        if (seq.id === this.sequenceId) {
          if (!seq.modifiers) seq.modifiers = [];
          const existingMod = seq.modifiers.find((m) => m.type === this.modifierType);

          if (existingMod) {
            if (this.previousParamsSnapshot === null) {
              this.previousParamsSnapshot = JSON.parse(JSON.stringify(existingMod.params));
              this.wasPreviouslyExisting = true;
            }
            existingMod.params = { ...existingMod.params, ...this.params };
          } else {
            if (this.previousParamsSnapshot === null) {
              this.previousParamsSnapshot = null;
              this.wasPreviouslyExisting = false;
            }
            seq.modifiers.push({
              type: this.modifierType,
              params: { ...this.params },
            });
          }
          return copy;
        }
      }
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      for (const seq of track.sequences) {
        if (seq.id === this.sequenceId && seq.modifiers) {
          if (this.wasPreviouslyExisting && this.previousParamsSnapshot) {
            const existingMod = seq.modifiers.find((m) => m.type === this.modifierType);
            if (existingMod) {
              existingMod.params = JSON.parse(JSON.stringify(this.previousParamsSnapshot));
            }
          } else {
            // It was newly added, remove it completely
            seq.modifiers = seq.modifiers.filter((m) => m.type !== this.modifierType);
          }
          return copy;
        }
      }
    }

    return copy;
  }

  public tryMerge(next: ICommand): boolean {
    if (
      next instanceof UpdateModifierCommand &&
      next.sequenceId === this.sequenceId &&
      next.modifierType === this.modifierType
    ) {
      // Coalesce continuous slider tweaks in-place
      this.params = { ...this.params, ...next.params };
      return true;
    }
    return false;
  }
}
