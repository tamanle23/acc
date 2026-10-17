import type { ICommand } from './ICommand';
import type { VideoIRDocument } from '@acc/ir';

/**
 * UpdateTextCueCommand:
 * Undoable command for inline canvas text editing.
 * Updates the text cue on the target sequence, syncing with text/style modifier if present.
 */
export class UpdateTextCueCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private cueIndex: number;
  private newText: string;
  private previousText: string | null = null;
  private previousModifierText: string | null = null;

  constructor(sequenceId: string, cueIndex: number, newText: string) {
    this.id = `text_cue_${sequenceId}_${cueIndex}_${Date.now()}`;
    this.description = `Update text cue on sequence ${sequenceId} to "${newText.slice(0, 20)}..."`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
    this.cueIndex = cueIndex;
    this.newText = newText;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    for (const track of copy.tracks) {
      for (const seq of track.sequences) {
        if (seq.id === this.sequenceId) {
          // 1. Update cues array
          if (seq.cues && seq.cues[this.cueIndex]) {
            if (this.previousText === null) {
              this.previousText = seq.cues[this.cueIndex].text;
            }
            seq.cues[this.cueIndex].text = this.newText;
          } else {
            // If cues array didn't exist or was empty, initialize it
            if (!seq.cues) seq.cues = [];
            if (this.previousText === null) {
              this.previousText = '';
            }
            seq.cues[this.cueIndex] = {
              startOffsetMs: 0,
              endOffsetMs: 3000,
              text: this.newText,
            };
          }

          // 2. Also update text/style modifier params if text is cached there
          if (seq.modifiers) {
            const styleMod = seq.modifiers.find((m) => m.type === 'text/style');
            if (styleMod && styleMod.params) {
              if (this.previousModifierText === null && typeof (styleMod.params as any).text === 'string') {
                this.previousModifierText = (styleMod.params as any).text;
              }
              (styleMod.params as any).text = this.newText;
            }
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
        if (seq.id === this.sequenceId) {
          if (this.previousText !== null && seq.cues && seq.cues[this.cueIndex]) {
            seq.cues[this.cueIndex].text = this.previousText;
          }
          if (this.previousModifierText !== null && seq.modifiers) {
            const styleMod = seq.modifiers.find((m) => m.type === 'text/style');
            if (styleMod && styleMod.params) {
              (styleMod.params as any).text = this.previousModifierText;
            }
          }
          return copy;
        }
      }
    }

    return copy;
  }
}
