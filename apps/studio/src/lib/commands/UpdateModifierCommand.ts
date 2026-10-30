import type { ICommand } from './ICommand';
import type { VideoIRDocument, ModifierNode, SequenceType } from '@acc/ir';

export class UpdateModifierCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private modifierType: string;
  private params: Record<string, unknown>;
  private target?: SequenceType | SequenceType[];
  private previousParamsSnapshot: Record<string, unknown> | null = null;
  private wasPreviouslyExisting: boolean = true;

  constructor(
    sequenceId: string,
    modifierType: string,
    params: Record<string, unknown>,
    target?: SequenceType | SequenceType[]
  ) {
    this.id = `mod_${sequenceId}_${modifierType}_${Date.now()}`;
    this.description = `Update modifier ${modifierType} on ${sequenceId}`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
    this.modifierType = modifierType;
    this.params = { ...params };
    this.target = target;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    // 1. Timeline / Project level modifier
    if (this.sequenceId === 'timeline' || this.sequenceId === copy.meta.contentId) {
      if (!copy.modifiers) copy.modifiers = [];
      const existingMod = copy.modifiers.find((m) => m.type === this.modifierType);

      if (existingMod) {
        if (this.previousParamsSnapshot === null) {
          this.previousParamsSnapshot = JSON.parse(JSON.stringify(existingMod.params));
          this.wasPreviouslyExisting = true;
        }
        if (!existingMod.id) {
          existingMod.id = `${this.modifierType}_${copy.modifiers.indexOf(existingMod)}`;
        }
        if (this.target && !existingMod.target) {
          existingMod.target = this.target;
        }
        existingMod.params = { ...existingMod.params, ...this.params };
      } else {
        if (this.previousParamsSnapshot === null) {
          this.previousParamsSnapshot = null;
          this.wasPreviouslyExisting = false;
        }
        copy.modifiers.push({
          id: `mod_${this.modifierType.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
          type: this.modifierType,
          target: this.target || 'video',
          params: { ...this.params },
        });
      }
      return copy;
    }

    // 2. Track & Sequence level modifiers
    for (const track of copy.tracks) {
      if (track.id === this.sequenceId) {
        if (!track.modifiers) track.modifiers = [];
        const existingMod = track.modifiers.find((m) => m.type === this.modifierType);

        if (existingMod) {
          if (this.previousParamsSnapshot === null) {
            this.previousParamsSnapshot = JSON.parse(JSON.stringify(existingMod.params));
            this.wasPreviouslyExisting = true;
          }
          if (!existingMod.id) {
            existingMod.id = `${this.modifierType}_${track.modifiers.indexOf(existingMod)}`;
          }
          if (this.target && !existingMod.target) {
            existingMod.target = this.target;
          }
          existingMod.params = { ...existingMod.params, ...this.params };
        } else {
          if (this.previousParamsSnapshot === null) {
            this.previousParamsSnapshot = null;
            this.wasPreviouslyExisting = false;
          }
          track.modifiers.push({
            id: `mod_${this.modifierType.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
            type: this.modifierType,
            target: this.target || (track.type === 'timed_text' ? 'text' : 'video'),
            params: { ...this.params },
          });
        }
        return copy;
      }

      for (const seq of track.sequences) {
        if (seq.id === this.sequenceId) {
          if (!seq.modifiers) seq.modifiers = [];
          const existingMod = seq.modifiers.find((m) => m.type === this.modifierType);

          if (existingMod) {
            if (this.previousParamsSnapshot === null) {
              this.previousParamsSnapshot = JSON.parse(JSON.stringify(existingMod.params));
              this.wasPreviouslyExisting = true;
            }
            if (!existingMod.id) {
              existingMod.id = `${this.modifierType}_${seq.modifiers.indexOf(existingMod)}`;
            }
            if (this.target && !existingMod.target) {
              existingMod.target = this.target;
            }
            existingMod.params = { ...existingMod.params, ...this.params };
          } else {
            if (this.previousParamsSnapshot === null) {
              this.previousParamsSnapshot = null;
              this.wasPreviouslyExisting = false;
            }
            seq.modifiers.push({
              id: `mod_${this.modifierType.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
              type: this.modifierType,
              target: this.target || (seq.type ? seq.type : 'video'),
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

    // 1. Timeline / Project level modifier undo
    if (this.sequenceId === 'timeline' || this.sequenceId === copy.meta.contentId) {
      if (copy.modifiers) {
        if (!this.wasPreviouslyExisting) {
          copy.modifiers = copy.modifiers.filter((m) => m.type !== this.modifierType);
        } else if (this.previousParamsSnapshot !== null) {
          const existingMod = copy.modifiers.find((m) => m.type === this.modifierType);
          if (existingMod) {
            existingMod.params = { ...this.previousParamsSnapshot };
          }
        }
      }
      return copy;
    }

    // 2. Track & Sequence level modifiers undo
    for (const track of copy.tracks) {
      if (track.id === this.sequenceId && track.modifiers) {
        if (!this.wasPreviouslyExisting) {
          track.modifiers = track.modifiers.filter((m) => m.type !== this.modifierType);
        } else if (this.previousParamsSnapshot !== null) {
          const existingMod = track.modifiers.find((m) => m.type === this.modifierType);
          if (existingMod) {
            existingMod.params = { ...this.previousParamsSnapshot };
          }
        }
        return copy;
      }

      for (const seq of track.sequences) {
        if (seq.id === this.sequenceId && seq.modifiers) {
          if (!this.wasPreviouslyExisting) {
            seq.modifiers = seq.modifiers.filter((m) => m.type !== this.modifierType);
          } else if (this.previousParamsSnapshot !== null) {
            const existingMod = seq.modifiers.find((m) => m.type === this.modifierType);
            if (existingMod) {
              existingMod.params = { ...this.previousParamsSnapshot };
            }
          }
          return copy;
        }
      }
    }

    return copy;
  }

  public tryMerge(nextCommand: ICommand): boolean {
    if (nextCommand instanceof UpdateModifierCommand) {
      if (
        nextCommand.sequenceId === this.sequenceId &&
        nextCommand.modifierType === this.modifierType &&
        nextCommand.timestamp - this.timestamp < 500
      ) {
        this.params = { ...this.params, ...nextCommand.params };
        return true;
      }
    }
    return false;
  }
}
