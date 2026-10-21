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
              if (seq.time.duration !== undefined && typeof seq.time.duration === 'object' && seq.time.duration !== null) {
                const rd = seq.time.duration as any;
                if (rd.matchLengthOf !== undefined && typeof rd.matchLengthOf !== 'string') {
                  errors.push(`Sequence "${seq.id || sIdx}" time.duration.matchLengthOf must be a string`);
                }
                if (rd.matchAssetDuration !== undefined && typeof rd.matchAssetDuration !== 'boolean') {
                  errors.push(`Sequence "${seq.id || sIdx}" time.duration.matchAssetDuration must be a boolean`);
                }
                if (rd.loop !== undefined && typeof rd.loop !== 'boolean') {
                  errors.push(`Sequence "${seq.id || sIdx}" time.duration.loop must be a boolean`);
                }
                if (rd.paddingFrames !== undefined && typeof rd.paddingFrames !== 'number') {
                  errors.push(`Sequence "${seq.id || sIdx}" time.duration.paddingFrames must be a number`);
                }
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
        // Deep parameter validation for all standard modifier types
        this.validateModifierParams(mod.type, mod.params as Record<string, any>, context, errors);
      }
    }
  }

  private static validateTemporalCurve(
    curve: any,
    context: string,
    paramName: string,
    errors: string[]
  ): void {
    if (typeof curve !== 'object' || curve === null) {
      errors.push(`Modifier param "${paramName}" on ${context} must be a TemporalCurve object`);
      return;
    }
    if (curve.intro !== undefined) {
      if (typeof curve.intro !== 'object' || curve.intro === null) {
        errors.push(`Modifier param "${paramName}.intro" on ${context} must be an object`);
      } else {
        if (typeof curve.intro.durationSec !== 'number' || curve.intro.durationSec < 0) {
          errors.push(`Modifier param "${paramName}.intro.durationSec" on ${context} must be a non-negative number`);
        }
        if (typeof curve.intro.ease !== 'string') {
          errors.push(`Modifier param "${paramName}.intro.ease" on ${context} must be a string`);
        }
      }
    }
    if (curve.steady !== undefined) {
      if (typeof curve.steady !== 'object' || curve.steady === null) {
        errors.push(`Modifier param "${paramName}.steady" on ${context} must be an object`);
      } else if (curve.steady.type && !['hold', 'drift', 'pulse'].includes(curve.steady.type)) {
        errors.push(`Modifier param "${paramName}.steady.type" on ${context} must be 'hold', 'drift', or 'pulse'`);
      }
    }
    if (curve.outro !== undefined) {
      if (typeof curve.outro !== 'object' || curve.outro === null) {
        errors.push(`Modifier param "${paramName}.outro" on ${context} must be an object`);
      } else {
        if (typeof curve.outro.durationSec !== 'number' || curve.outro.durationSec < 0) {
          errors.push(`Modifier param "${paramName}.outro.durationSec" on ${context} must be a non-negative number`);
        }
        if (typeof curve.outro.ease !== 'string') {
          errors.push(`Modifier param "${paramName}.outro.ease" on ${context} must be a string`);
        }
      }
    }
    if (curve.keyframes !== undefined) {
      if (!Array.isArray(curve.keyframes)) {
        errors.push(`Modifier param "${paramName}.keyframes" on ${context} must be an array`);
      } else {
        for (let k = 0; k < curve.keyframes.length; k++) {
          const kf = curve.keyframes[k];
          if (!kf || typeof kf !== 'object') {
            errors.push(`Modifier param "${paramName}.keyframes[${k}]" on ${context} must be an object`);
          } else if (typeof kf.timeSec !== 'number' || kf.timeSec < 0) {
            errors.push(`Modifier param "${paramName}.keyframes[${k}].timeSec" on ${context} must be a non-negative number`);
          }
        }
      }
    }
  }

  private static validateModifierParams(
    type: string,
    p: Record<string, any>,
    context: string,
    errors: string[]
  ): void {
    switch (type) {
      case 'transform':
      case 'transform/scale': {
        const checkNumericOrCurve = (key: string) => {
          if (p[key] !== undefined) {
            if (typeof p[key] === 'number') {
              if (Number.isNaN(p[key])) {
                errors.push(`Modifier "${type}" on ${context}: param "${key}" cannot be NaN`);
              }
            } else if (typeof p[key] === 'object' && p[key] !== null) {
              this.validateTemporalCurve(p[key], context, key, errors);
            } else {
              errors.push(`Modifier "${type}" on ${context}: param "${key}" must be a number or TemporalCurve object`);
            }
          }
        };

        checkNumericOrCurve('x');
        checkNumericOrCurve('y');
        checkNumericOrCurve('scale');
        checkNumericOrCurve('rotation');
        checkNumericOrCurve('opacity');

        if (p.normX !== undefined && typeof p.normX !== 'number') {
          errors.push(`Modifier "${type}" on ${context}: param "normX" must be a number`);
        }
        if (p.normY !== undefined && typeof p.normY !== 'number') {
          errors.push(`Modifier "${type}" on ${context}: param "normY" must be a number`);
        }
        if (p.startValue !== undefined && typeof p.startValue !== 'number') {
          errors.push(`Modifier "${type}" on ${context}: param "startValue" must be a number`);
        }
        if (p.endValue !== undefined && typeof p.endValue !== 'number') {
          errors.push(`Modifier "${type}" on ${context}: param "endValue" must be a number`);
        }
        if (p.animation !== undefined) {
          if (typeof p.animation !== 'object' || p.animation === null) {
            errors.push(`Modifier "${type}" on ${context}: param "animation" must be an object`);
          } else {
            const validPresets = ['pop_in', 'slide_left', 'overshoot', 'bounce', 'drift'];
            if (p.animation.preset && !validPresets.includes(p.animation.preset)) {
              errors.push(`Modifier "${type}" on ${context}: param "animation.preset" must be one of: ${validPresets.join(', ')}`);
            }
          }
        }
        break;
      }

      case 'vfx/camera_3d': {
        if (p.keyframes !== undefined) {
          if (!Array.isArray(p.keyframes)) {
            errors.push(`Modifier "vfx/camera_3d" on ${context}: keyframes must be an array`);
          } else {
            for (let k = 0; k < p.keyframes.length; k++) {
              const kf = p.keyframes[k];
              if (!kf || typeof kf !== 'object') {
                errors.push(`Modifier "vfx/camera_3d" on ${context}: keyframe[${k}] must be an object`);
              } else {
                if (typeof kf.time !== 'number') {
                  errors.push(`Modifier "vfx/camera_3d" on ${context}: keyframe[${k}].time must be a number`);
                }
                if (!Array.isArray(kf.position) || kf.position.length !== 3 || kf.position.some((n: any) => typeof n !== 'number')) {
                  errors.push(`Modifier "vfx/camera_3d" on ${context}: keyframe[${k}].position must be [x, y, z] numbers`);
                }
              }
            }
          }
        }
        if (p.rackFocus !== undefined) {
          if (typeof p.rackFocus !== 'object' || p.rackFocus === null) {
            errors.push(`Modifier "vfx/camera_3d" on ${context}: rackFocus must be an object`);
          } else if (p.rackFocus.enabled !== undefined && typeof p.rackFocus.enabled !== 'boolean') {
            errors.push(`Modifier "vfx/camera_3d" on ${context}: rackFocus.enabled must be a boolean`);
          }
        }
        break;
      }

      case 'vfx/depth3d':
      case 'vfx/depth_relighting':
      case 'vfx/depth3d_relighting': {
        if (p.mode !== undefined && typeof p.mode !== 'string') {
          errors.push(`Modifier "${type}" on ${context}: param "mode" must be a string`);
        }
        if (p.relighting !== undefined) {
          if (typeof p.relighting !== 'object' || p.relighting === null) {
            errors.push(`Modifier "${type}" on ${context}: relighting must be an object`);
          } else {
            if (p.relighting.enabled !== undefined && typeof p.relighting.enabled !== 'boolean') {
              errors.push(`Modifier "${type}" on ${context}: relighting.enabled must be a boolean`);
            }
            if (p.relighting.lightPosition !== undefined) {
              if (!Array.isArray(p.relighting.lightPosition) || p.relighting.lightPosition.length !== 3) {
                errors.push(`Modifier "${type}" on ${context}: relighting.lightPosition must be [x, y, z]`);
              }
            }
          }
        }
        break;
      }

      case 'color/lut':
      case 'vfx/color_lut': {
        const lutName = p.lutAsset || p.lut;
        if (!lutName || typeof lutName !== 'string') {
          errors.push(`Modifier "${type}" on ${context}: requires a string "lutAsset" or "lut"`);
        }
        if (p.intensity !== undefined && (typeof p.intensity !== 'number' || p.intensity < 0 || p.intensity > 1)) {
          errors.push(`Modifier "${type}" on ${context}: param "intensity" must be a number between 0 and 1`);
        }
        break;
      }

      case 'vfx/color_grading': {
        const numParams = ['contrast', 'saturation', 'brightness', 'temperature', 'tint', 'vignette', 'exposure'];
        for (const np of numParams) {
          if (p[np] !== undefined && typeof p[np] !== 'number') {
            errors.push(`Modifier "vfx/color_grading" on ${context}: param "${np}" must be a number`);
          }
        }
        break;
      }

      case 'overlay/canvas_particles': {
        if (p.type !== undefined && typeof p.type !== 'string') {
          errors.push(`Modifier "overlay/canvas_particles" on ${context}: type must be a string`);
        }
        if (p.intensity !== undefined && typeof p.intensity !== 'number') {
          errors.push(`Modifier "overlay/canvas_particles" on ${context}: intensity must be a number`);
        }
        if (p.particleCount !== undefined && (typeof p.particleCount !== 'number' || p.particleCount < 0)) {
          errors.push(`Modifier "overlay/canvas_particles" on ${context}: particleCount must be a non-negative integer`);
        }
        if (p.useSIMD !== undefined && typeof p.useSIMD !== 'boolean') {
          errors.push(`Modifier "overlay/canvas_particles" on ${context}: useSIMD must be a boolean`);
        }
        break;
      }

      case 'overlay/hologram_hud': {
        if (p.enabled !== undefined && typeof p.enabled !== 'boolean') {
          errors.push(`Modifier "overlay/hologram_hud" on ${context}: enabled must be a boolean`);
        }
        if (p.color !== undefined && typeof p.color !== 'string') {
          errors.push(`Modifier "overlay/hologram_hud" on ${context}: color must be a string`);
        }
        if (p.glitchIntensity !== undefined && typeof p.glitchIntensity !== 'number') {
          errors.push(`Modifier "overlay/hologram_hud" on ${context}: glitchIntensity must be a number`);
        }
        break;
      }

      case 'overlay/blend_mode': {
        if (!p.mode || !VALID_BLEND_MODES.has(p.mode)) {
          errors.push(`Modifier "overlay/blend_mode" on ${context}: invalid mode "${p.mode}". Expected one of: ${Array.from(VALID_BLEND_MODES).join(', ')}`);
        }
        break;
      }

      case 'text/style': {
        if (p.fontSize !== undefined && (typeof p.fontSize !== 'number' || p.fontSize <= 0)) {
          errors.push(`Modifier "text/style" on ${context}: fontSize must be a positive number`);
        }
        if (p.fontFamily !== undefined && typeof p.fontFamily !== 'string') {
          errors.push(`Modifier "text/style" on ${context}: fontFamily must be a string`);
        }
        if (p.color !== undefined && typeof p.color !== 'string') {
          errors.push(`Modifier "text/style" on ${context}: color must be a string`);
        }
        if (p.textAlign !== undefined && !['left', 'center', 'right'].includes(p.textAlign)) {
          errors.push(`Modifier "text/style" on ${context}: textAlign must be 'left', 'center', or 'right'`);
        }
        if (p.activeWord !== undefined) {
          if (typeof p.activeWord !== 'object' || p.activeWord === null) {
            errors.push(`Modifier "text/style" on ${context}: activeWord must be an object`);
          }
        }
        break;
      }

      case 'audio/volume': {
        if (p.volume !== undefined && (typeof p.volume !== 'number' || p.volume < 0)) {
          errors.push(`Modifier "audio/volume" on ${context}: volume must be a non-negative number`);
        }
        if (p.muted !== undefined && typeof p.muted !== 'boolean') {
          errors.push(`Modifier "audio/volume" on ${context}: muted must be a boolean`);
        }
        if (p.fadeInSec !== undefined && (typeof p.fadeInSec !== 'number' || p.fadeInSec < 0)) {
          errors.push(`Modifier "audio/volume" on ${context}: fadeInSec must be a non-negative number`);
        }
        if (p.fadeOutSec !== undefined && (typeof p.fadeOutSec !== 'number' || p.fadeOutSec < 0)) {
          errors.push(`Modifier "audio/volume" on ${context}: fadeOutSec must be a non-negative number`);
        }
        break;
      }

      case 'audio/pan':
      case 'audio/spatial_pan': {
        const panVal = p.stereoPan !== undefined ? p.stereoPan : p.pan;
        if (panVal !== undefined && (typeof panVal !== 'number' || panVal < -1 || panVal > 1)) {
          errors.push(`Modifier "${type}" on ${context}: stereoPan/pan must be a number between -1.0 and +1.0`);
        }
        break;
      }

      case 'audio/filter': {
        const validFilterTypes = ['lowpass', 'highpass', 'bandpass'];
        if (p.filterType && !validFilterTypes.includes(p.filterType)) {
          errors.push(`Modifier "audio/filter" on ${context}: filterType must be one of: ${validFilterTypes.join(', ')}`);
        }
        const freq = p.cutoffHz !== undefined ? p.cutoffHz : p.frequency;
        if (freq !== undefined && (typeof freq !== 'number' || freq <= 0)) {
          errors.push(`Modifier "audio/filter" on ${context}: cutoff frequency must be a positive number`);
        }
        break;
      }

      case 'audio/pitch':
      case 'audio/pitch_shift': {
        if (p.playbackRate !== undefined && (typeof p.playbackRate !== 'number' || p.playbackRate <= 0)) {
          errors.push(`Modifier "${type}" on ${context}: playbackRate must be a positive number`);
        }
        const cents = p.detuneCents !== undefined ? p.detuneCents : p.semitones;
        if (cents !== undefined && typeof cents !== 'number') {
          errors.push(`Modifier "${type}" on ${context}: detuneCents/semitones must be a number`);
        }
        break;
      }

      case 'sfx/dynamic_ducking':
      case 'audio/dynamic_ducking': {
        if (p.duckingFactor !== undefined) {
          if (typeof p.duckingFactor === 'number') {
            if (p.duckingFactor < 0 || p.duckingFactor > 1) {
              errors.push(`Modifier "${type}" on ${context}: numeric duckingFactor must be between 0 and 1`);
            }
          } else if (typeof p.duckingFactor === 'object' && p.duckingFactor !== null) {
            this.validateTemporalCurve(p.duckingFactor, context, 'duckingFactor', errors);
          } else {
            errors.push(`Modifier "${type}" on ${context}: duckingFactor must be a number or TemporalCurve object`);
          }
        }
        break;
      }

      case 'audio/compressor': {
        if (p.thresholdDb !== undefined && typeof p.thresholdDb !== 'number') {
          errors.push(`Modifier "audio/compressor" on ${context}: thresholdDb must be a number`);
        }
        if (p.ratio !== undefined && (typeof p.ratio !== 'number' || p.ratio < 1)) {
          errors.push(`Modifier "audio/compressor" on ${context}: ratio must be a number >= 1`);
        }
        break;
      }

      case 'sfx/procedural': {
        if (p.synthType !== undefined && typeof p.synthType !== 'string') {
          errors.push(`Modifier "sfx/procedural" on ${context}: synthType must be a string`);
        }
        if (p.durationSec !== undefined && (typeof p.durationSec !== 'number' || p.durationSec <= 0)) {
          errors.push(`Modifier "sfx/procedural" on ${context}: durationSec must be a positive number`);
        }
        break;
      }

      case 'editorial/split_edit':
      case 'edit/split': {
        if (p.mode && !['j_cut', 'l_cut'].includes(p.mode)) {
          errors.push(`Modifier "${type}" on ${context}: mode must be 'j_cut' or 'l_cut'`);
        }
        if (p.splitDurationFrames !== undefined && (typeof p.splitDurationFrames !== 'number' || p.splitDurationFrames < 0)) {
          errors.push(`Modifier "${type}" on ${context}: splitDurationFrames must be a non-negative integer`);
        }
        break;
      }

      case 'editorial/av_link': {
        if (!p.linkedSequenceId || typeof p.linkedSequenceId !== 'string') {
          errors.push(`Modifier "${type}" on ${context}: linkedSequenceId is required and must be a string`);
        }
        if (!p.linkedTrackId || typeof p.linkedTrackId !== 'string') {
          errors.push(`Modifier "${type}" on ${context}: linkedTrackId is required and must be a string`);
        }
        break;
      }

      case 'transition/crossfade':
      case 'transition/wipe':
      case 'transition/push':
      case 'transition/zoom':
      case 'transition/dip':
      case 'transition/glitch':
      case 'transition/light_leak':
      case 'transition/radial_wipe':
      case 'transition/iris':
      case 'editorial/transition':
      case 'transition': {
        const dur = p.durationSec !== undefined ? p.durationSec : p.durationFrames;
        if (dur !== undefined && (typeof dur !== 'number' || dur < 0)) {
          errors.push(`Modifier "${type}" on ${context}: transition duration must be a non-negative number`);
        }
        if (p.alignment !== undefined && !['center_on_cut', 'start_at_cut', 'end_at_cut'].includes(p.alignment)) {
          errors.push(`Modifier "${type}" on ${context}: alignment must be 'center_on_cut', 'start_at_cut', or 'end_at_cut'`);
        }
        if (p.direction !== undefined && !['left', 'right', 'up', 'down'].includes(p.direction)) {
          errors.push(`Modifier "${type}" on ${context}: direction must be 'left', 'right', 'up', or 'down'`);
        }
        if (p.dipColor !== undefined && typeof p.dipColor !== 'string') {
          errors.push(`Modifier "${type}" on ${context}: dipColor must be a valid color string`);
        }
        break;
      }

      case 'time_space': {
        if (!p.templateId || typeof p.templateId !== 'string') {
          errors.push(`Modifier "time_space" on ${context}: templateId must be a non-empty string`);
        }
        if (p.boundary !== undefined && !['loop', 'pingpong', 'clamp', 'once'].includes(p.boundary)) {
          errors.push(`Modifier "time_space" on ${context}: boundary must be 'loop', 'pingpong', 'clamp', or 'once'`);
        }
        if (p.renderMode !== undefined && !['canvas2d', 'webgl_buffers'].includes(p.renderMode)) {
          errors.push(`Modifier "time_space" on ${context}: renderMode must be 'canvas2d' or 'webgl_buffers'`);
        }
        break;
      }

      default:
        // Permissive Open-Closed Principle fallback: unknown / custom modifier types are allowed
        // as long as their params is an object (already validated above).
        break;
    }
  }
}
