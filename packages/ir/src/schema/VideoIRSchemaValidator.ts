import type { VideoIRDocument, SequenceType, TrackType } from '../types/VideoIR';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_SEQUENCE_TYPES = new Set<string>(['video', 'image', 'audio', 'text', 'overlay']);
const VALID_BLEND_MODES = new Set<string>([
  'normal',
  'screen',
  'multiply',
  'overlay',
  'add',
  'color_dodge',
  'soft_light',
]);

const TRACK_COMPATIBLE_SEQUENCE_TYPES: Record<string, Set<string>> = {
  video: new Set(['video', 'image', 'overlay']),
  audio: new Set(['audio']),
  timed_text: new Set(['text']),
  data: new Set(['video', 'image', 'audio', 'text', 'overlay']),
};

/**
 * High-speed Draft-07 Polymorphic Schema Validator for Video IR V1.0-Stable.
 * Implements strict type checking on core topology (version, meta, tracks, sequences, types, modifiers)
 * and discriminator checks for polymorphic modifier nodes and target domains.
 */
export class VideoIRSchemaValidator {
  public static validate(doc: unknown): ValidationResult {
    const errors: string[] = [];

    if (!doc || typeof doc !== 'object') {
      return { valid: false, errors: ['Document must be an object'] };
    }

    const d = doc as Partial<VideoIRDocument>;

    if (typeof d.version !== 'string' || !d.version.startsWith('1.')) {
      errors.push(`Invalid version: expected '1.x.x-stable', received '${d.version}'`);
    }

    if (!d.meta || typeof d.meta !== 'object') {
      errors.push('Missing or invalid "meta" object');
    } else {
      if (!d.meta.contentId || typeof d.meta.contentId !== 'string') {
        errors.push('"meta.contentId" must be a non-empty string');
      }
      if (typeof d.meta.globalFps !== 'number' || d.meta.globalFps <= 0) {
        errors.push('"meta.globalFps" must be a positive number');
      }
      if (
        !d.meta.canvasSize ||
        typeof d.meta.canvasSize.w !== 'number' ||
        typeof d.meta.canvasSize.h !== 'number' ||
        d.meta.canvasSize.w <= 0 ||
        d.meta.canvasSize.h <= 0
      ) {
        errors.push('"meta.canvasSize" must have positive integer dimensions w and h');
      }
    }

    if (d.assets !== undefined) {
      if (typeof d.assets !== 'object' || d.assets === null) {
        errors.push('"assets" must be a dictionary object');
      } else {
        for (const [key, asset] of Object.entries(d.assets)) {
          if (!asset || typeof asset !== 'object') {
            errors.push(`Asset "${key}" must be an object`);
          } else {
            if (!asset.src || typeof asset.src !== 'string') {
              errors.push(`Asset "${key}" missing valid "src" URI`);
            }
            if (!asset.type || typeof asset.type !== 'string') {
              errors.push(`Asset "${key}" missing valid "type"`);
            }
          }
        }
      }
    }

    // Global document-level modifier chain validation
    if (d.modifiers !== undefined) {
      this.validateModifiers(d.modifiers, 'root document', errors);
    }

    if (!Array.isArray(d.tracks)) {
      errors.push('"tracks" must be an array');
    } else {
      const validTrackTypes = new Set(['video', 'audio', 'data', 'timed_text']);
      const trackIds = new Set<string>();

      for (let tIdx = 0; tIdx < d.tracks.length; tIdx++) {
        const track = d.tracks[tIdx];
        if (!track || typeof track !== 'object') {
          errors.push(`Track index ${tIdx} is not an object`);
          continue;
        }

        if (!track.id || typeof track.id !== 'string') {
          errors.push(`Track index ${tIdx} missing valid "id" string`);
        } else {
          if (trackIds.has(track.id)) {
            errors.push(`Duplicate track id "${track.id}" at index ${tIdx}`);
          }
          trackIds.add(track.id);
        }

        if (!validTrackTypes.has(track.type)) {
          errors.push(`Track "${track.id || tIdx}" has invalid type "${track.type}"`);
        }

        if (track.blendMode !== undefined && !VALID_BLEND_MODES.has(track.blendMode)) {
          errors.push(`Track "${track.id || tIdx}" has invalid blendMode "${track.blendMode}"`);
        }

        if (track.modifiers !== undefined) {
          this.validateModifiers(track.modifiers, `track "${track.id || tIdx}"`, errors, track.type);
        }

        if (!Array.isArray(track.sequences)) {
          errors.push(`Track "${track.id || tIdx}" "sequences" must be an array`);
        } else {
          const compatibleSeqTypes = TRACK_COMPATIBLE_SEQUENCE_TYPES[track.type] || new Set();

          for (let sIdx = 0; sIdx < track.sequences.length; sIdx++) {
            const seq = track.sequences[sIdx];
            if (!seq || typeof seq !== 'object') {
              errors.push(`Track "${track.id}" sequence index ${sIdx} is not an object`);
              continue;
            }

            if (!seq.id || typeof seq.id !== 'string') {
              errors.push(`Sequence index ${sIdx} on track "${track.id}" missing valid "id"`);
            }

            // Strictly required sequence type
            if (!seq.type || typeof seq.type !== 'string') {
              errors.push(`Sequence "${seq.id || sIdx}" on track "${track.id}" missing strictly required "type"`);
            } else if (!VALID_SEQUENCE_TYPES.has(seq.type)) {
              errors.push(`Sequence "${seq.id || sIdx}" has invalid type "${seq.type}". Expected: ${Array.from(VALID_SEQUENCE_TYPES).join(', ')}`);
            } else if (!compatibleSeqTypes.has(seq.type)) {
              errors.push(
                `Track "${track.id}" of type "${track.type}" cannot contain sequence "${seq.id || sIdx}" of type "${seq.type}". Permitted types: ${Array.from(compatibleSeqTypes).join(', ')}`
              );
            }

            if (seq.blendMode !== undefined && !VALID_BLEND_MODES.has(seq.blendMode)) {
              errors.push(`Sequence "${seq.id || sIdx}" has invalid blendMode "${seq.blendMode}"`);
            }

            if (!seq.time || typeof seq.time !== 'object') {
              errors.push(`Sequence "${seq.id || sIdx}" missing "time" definition`);
            } else {
              if (seq.time.start === undefined) {
                errors.push(`Sequence "${seq.id || sIdx}" missing "time.start"`);
              }
            }

            if (seq.modifiers !== undefined) {
              this.validateModifiers(seq.modifiers, `sequence "${seq.id || sIdx}"`, errors, track.type, seq.type as SequenceType);
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serializes a VideoIRDocument to a formatted JSON string for export or Visual Video Editor consumption.
   */
  public static serialize(doc: VideoIRDocument, pretty: boolean = true): string {
    const validation = this.validate(doc);
    if (!validation.valid) {
      throw new Error(`[VideoIRSchemaValidator] Cannot serialize invalid VideoIRDocument: ${validation.errors.join('; ')}`);
    }
    return pretty ? JSON.stringify(doc, null, 2) : JSON.stringify(doc);
  }

  /**
   * Deserializes and validates a JSON string into a compliant VideoIRDocument.
   */
  public static deserialize(jsonStr: string): VideoIRDocument {
    const parsed = JSON.parse(jsonStr);
    const validation = this.validate(parsed);
    if (!validation.valid) {
      throw new Error(`[VideoIRSchemaValidator] Deserialization validation failed: ${validation.errors.join('; ')}`);
    }
    return parsed as VideoIRDocument;
  }

  private static validateModifiers(
    modifiers: unknown,
    context: string,
    errors: string[],
    trackType?: TrackType,
    seqType?: SequenceType
  ): void {
    if (!Array.isArray(modifiers)) {
      errors.push(`Modifiers on ${context} must be an array`);
      return;
    }

    const compatibleTrackSeqTypes = trackType ? TRACK_COMPATIBLE_SEQUENCE_TYPES[trackType] : undefined;

    for (let i = 0; i < modifiers.length; i++) {
      const mod = modifiers[i];
      if (!mod || typeof mod !== 'object') {
        errors.push(`Modifier at index ${i} on ${context} is not an object`);
        continue;
      }
      if (!mod.type || typeof mod.type !== 'string') {
        errors.push(`Modifier at index ${i} on ${context} missing "type" string discriminator`);
      }

      // Strictly required modifier target
      if (mod.target === undefined || mod.target === null) {
        errors.push(`Modifier "${mod.type || i}" on ${context} missing strictly required "target"`);
      } else {
        const targets: string[] = Array.isArray(mod.target) ? mod.target : [mod.target];
        if (targets.length === 0) {
          errors.push(`Modifier "${mod.type || i}" on ${context} has empty "target" array`);
        } else {
          for (const tgt of targets) {
            if (typeof tgt !== 'string' || !VALID_SEQUENCE_TYPES.has(tgt)) {
              errors.push(
                `Modifier "${mod.type || i}" on ${context} has invalid target "${tgt}". Expected: ${Array.from(VALID_SEQUENCE_TYPES).join(', ')}`
              );
            }
          }

          // Validate target compatibility with track
          if (compatibleTrackSeqTypes) {
            const hasCompatibleTarget = targets.some((tgt) => compatibleTrackSeqTypes.has(tgt));
            if (!hasCompatibleTarget) {
              errors.push(
                `Modifier "${mod.type || i}" on ${context} (track type "${trackType}") has target [${targets.join(', ')}] which is incompatible with track permitted types [${Array.from(compatibleTrackSeqTypes).join(', ')}]`
              );
            }
          }

          // Validate target compatibility with sequence if placed on a sequence
          if (seqType) {
            const matchesSeq = targets.includes(seqType);
            if (!matchesSeq) {
              errors.push(
                `Modifier "${mod.type || i}" on sequence "${context}" (type "${seqType}") does not target sequence type "${seqType}" (targets: [${targets.join(', ')}])`
              );
            }
          }
        }
      }

      if (mod.params === undefined || typeof mod.params !== 'object' || mod.params === null) {
        errors.push(`Modifier "${mod.type || i}" on ${context} missing "params" object`);
      } else {
        // Specialized validator checks for Phase 1 - Phase 3 Visual Modifiers
        const p = mod.params as Record<string, any>;
        if (mod.type === 'vfx/camera_3d' && p.keyframes && !Array.isArray(p.keyframes)) {
          errors.push(`Modifier "vfx/camera_3d" on ${context}: keyframes must be an array`);
        }
        if (mod.type === 'vfx/depth3d' && p.relighting && typeof p.relighting.enabled !== 'boolean') {
          errors.push(`Modifier "vfx/depth3d" on ${context}: relighting.enabled must be a boolean`);
        }
        if (mod.type === 'overlay/canvas_particles' && p.type && typeof p.type !== 'string') {
          errors.push(`Modifier "overlay/canvas_particles" on ${context}: type must be a string`);
        }
      }
    }
  }
}
