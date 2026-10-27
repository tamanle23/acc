import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRSequence, AssetDefinition } from '../../../../../packages/ir/src/types/VideoIR';
import { VideoIRAuthoringEngine } from '../../../../../packages/ir/src/authoring/VideoIRAuthoringEngine';

export interface AddLinkedAVSequenceOptions {
  videoTrackId: string;
  audioTrackId: string;
  videoSequence: IRSequence;
  audioSequence: IRSequence;
  asset?: { id: string; asset: AssetDefinition };
}

/**
 * AddLinkedAVSequenceCommand:
 * Atomic undoable command that inserts synchronized Video and Audio sequences
 * onto respective video and audio tracks, linked with editorial/av_link modifiers.
 * Automatically provisions missing tracks and cleans them up on undo.
 */
export class AddLinkedAVSequenceCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private videoTrackId: string;
  private audioTrackId: string;
  private videoSequence: IRSequence;
  private audioSequence: IRSequence;
  private asset?: { id: string; asset: AssetDefinition };

  private createdVideoTrack: boolean = false;
  private createdAudioTrack: boolean = false;
  private nextSequenceIndexSnapshot: number | undefined = undefined;

  constructor(options: AddLinkedAVSequenceOptions) {
    this.id = `add_linked_av_${options.videoSequence.id}_${Date.now()}`;
    this.description = `Add linked A/V sequences (${options.videoSequence.id} & ${options.audioSequence.id})`;
    this.timestamp = Date.now();

    this.videoTrackId = options.videoTrackId;
    this.audioTrackId = options.audioTrackId;
    this.videoSequence = JSON.parse(JSON.stringify(options.videoSequence));
    this.audioSequence = JSON.parse(JSON.stringify(options.audioSequence));
    this.asset = options.asset ? JSON.parse(JSON.stringify(options.asset)) : undefined;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    if (this.nextSequenceIndexSnapshot === undefined) {
      this.nextSequenceIndexSnapshot = copy.meta?.nextSequenceIndex;
    }

    // 1. Register asset if provided
    if (this.asset) {
      if (!copy.assets) copy.assets = {};
      if (!copy.assets[this.asset.id]) {
        copy.assets[this.asset.id] = this.asset.asset;
      }
    }

    // 2. Locate or provision video track
    let vTrack = copy.tracks.find((t) => t.id === this.videoTrackId);
    if (!vTrack) {
      vTrack = {
        id: this.videoTrackId,
        type: 'video',
        name: this.videoTrackId.replace('track-', '').toUpperCase(),
        sequences: [],
      };
      copy.tracks.push(vTrack);
      this.createdVideoTrack = true;
    }

    // 3. Locate or provision audio track
    let aTrack = copy.tracks.find((t) => t.id === this.audioTrackId);
    if (!aTrack) {
      aTrack = {
        id: this.audioTrackId,
        type: 'audio',
        name: this.audioTrackId.replace('track-', '').toUpperCase(),
        sequences: [],
      };
      copy.tracks.push(aTrack);
      this.createdAudioTrack = true;
    }

    // 4. Ensure coordinated sequential IDs if sequences are new/temporary
    if (!this.videoSequence.id || this.videoSequence.id.startsWith('temp_')) {
      const vAlloc = VideoIRAuthoringEngine.allocateNextSequenceId(copy, {
        type: 'video',
        nameOrSlug: this.videoSequence.name,
      });
      this.videoSequence.id = vAlloc.id;
    }
    if (!this.audioSequence.id || this.audioSequence.id.startsWith('temp_')) {
      const aAlloc = VideoIRAuthoringEngine.allocateNextSequenceId(copy, {
        type: 'audio',
        nameOrSlug: this.audioSequence.name,
      });
      this.audioSequence.id = aAlloc.id;
    }

    // 5. Wire reciprocal av_link modifier targets
    this.wireAVLinkModifier(this.videoSequence, this.audioSequence.id, this.audioTrackId);
    this.wireAVLinkModifier(this.audioSequence, this.videoSequence.id, this.videoTrackId);

    // 6. Insert or update Video Sequence
    const existingVIdx = vTrack.sequences.findIndex((s) => s.id === this.videoSequence.id);
    if (existingVIdx >= 0) {
      vTrack.sequences[existingVIdx] = JSON.parse(JSON.stringify(this.videoSequence));
    } else {
      vTrack.sequences.push(JSON.parse(JSON.stringify(this.videoSequence)));
    }

    // 7. Insert or update Audio Sequence
    const existingAIdx = aTrack.sequences.findIndex((s) => s.id === this.audioSequence.id);
    if (existingAIdx >= 0) {
      aTrack.sequences[existingAIdx] = JSON.parse(JSON.stringify(this.audioSequence));
    } else {
      aTrack.sequences.push(JSON.parse(JSON.stringify(this.audioSequence)));
    }

    return copy;
  }

  private wireAVLinkModifier(seq: IRSequence, linkedSeqId: string, linkedTrackId: string): void {
    if (!Array.isArray(seq.modifiers)) {
      seq.modifiers = [];
    }
    const existingLink = seq.modifiers.find((m) => m.type === 'editorial/av_link');
    if (existingLink) {
      if (!existingLink.params) existingLink.params = {};
      existingLink.params.linkedSequenceId = linkedSeqId;
      existingLink.params.linkedTrackId = linkedTrackId;
    } else {
      seq.modifiers.push({
        type: 'editorial/av_link',
        target: seq.id,
        params: {
          linkedSequenceId: linkedSeqId,
          linkedTrackId: linkedTrackId,
        },
      });
    }
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    // Remove video sequence
    const vTrackIdx = copy.tracks.findIndex((t) => t.id === this.videoTrackId);
    if (vTrackIdx >= 0) {
      const vTrack = copy.tracks[vTrackIdx];
      vTrack.sequences = vTrack.sequences.filter((s) => s.id !== this.videoSequence.id);
      if (this.createdVideoTrack && vTrack.sequences.length === 0) {
        copy.tracks.splice(vTrackIdx, 1);
      }
    }

    // Remove audio sequence
    const aTrackIdx = copy.tracks.findIndex((t) => t.id === this.audioTrackId);
    if (aTrackIdx >= 0) {
      const aTrack = copy.tracks[aTrackIdx];
      aTrack.sequences = aTrack.sequences.filter((s) => s.id !== this.audioSequence.id);
      if (this.createdAudioTrack && aTrack.sequences.length === 0) {
        copy.tracks.splice(aTrackIdx, 1);
      }
    }

    // Clean up asset if solely introduced by this command
    if (this.asset && copy.assets && copy.assets[this.asset.id]) {
      let isReferenced = false;
      for (const t of copy.tracks) {
        if (t.sequences.some((s) => s.assetId === this.asset?.id)) {
          isReferenced = true;
          break;
        }
      }
      if (!isReferenced) {
        delete copy.assets[this.asset.id];
      }
    }

    if (copy.meta && this.nextSequenceIndexSnapshot !== undefined) {
      copy.meta.nextSequenceIndex = this.nextSequenceIndexSnapshot;
    }

    return copy;
  }
}
