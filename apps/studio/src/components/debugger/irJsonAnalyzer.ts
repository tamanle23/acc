import {
  VideoIRSchemaValidator,
  type VideoIRDocument,
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
} from '@acc/ir';
import type { IRDiagnosticsReport } from './types';

/**
 * Pure diagnostic analyzer for a raw VideoIR JSON string.
 * Exported for unit and round-trip testing.
 */
export function analyzeVideoIRJson(rawJson: string): {
  parsedDoc: VideoIRDocument | null;
  diagnostics: IRDiagnosticsReport;
} {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(rawJson) as Record<string, unknown>;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Syntax error in JSON payload';
    return {
      parsedDoc: null,
      diagnostics: {
        parseError: msg || 'Syntax error in JSON payload',
        schemaValidation: { valid: false, errors: [`Syntax Error: ${msg || 'Invalid JSON'}`] },
        trackCount: 0,
        sequenceCount: 0,
        assetCount: 0,
        modifierCount: 0,
        unregisteredModifiers: [],
        danglingAnchors: [],
        missingAssets: [],
      },
    };
  }

  const schemaValidation = VideoIRSchemaValidator.validate(parsed);
  const tracks = Array.isArray(parsed?.tracks) ? (parsed.tracks as Array<Record<string, unknown>>) : [];
  const assetsObj = parsed?.assets && typeof parsed.assets === 'object' ? (parsed.assets as Record<string, unknown>) : {};
  const assetIds = new Set(Object.keys(assetsObj));

  const sequenceIds = new Set<string>();
  let sequenceCount = 0;
  let modifierCount = 0;
  const unregisteredSet = new Set<string>();
  const danglingAnchors: Array<{ sequenceId: string; referenceId: string }> = [];
  const missingAssets: Array<{ sequenceId: string; assetId: string }> = [];

  const registry = ModifierPluginRegistry.getInstance();
  if (registry.listTypes().length === 0) {
    registerCoreModifierPlugins(registry);
  }

  for (const track of tracks) {
    if (Array.isArray(track?.modifiers)) {
      for (const mod of track.modifiers as Array<{ type?: string }>) {
        modifierCount++;
        if (mod?.type && !registry.get(mod.type)) {
          unregisteredSet.add(mod.type);
        }
      }
    }
    const seqs = Array.isArray(track?.sequences) ? (track.sequences as Array<Record<string, unknown>>) : [];
    for (const seq of seqs) {
      sequenceCount++;
      if (typeof seq?.id === 'string') {
        sequenceIds.add(seq.id);
      }
    }
  }

  for (const track of tracks) {
    const seqs = Array.isArray(track?.sequences) ? (track.sequences as Array<Record<string, unknown>>) : [];
    for (const seq of seqs) {
      const seqId = typeof seq?.id === 'string' ? seq.id : 'unknown';
      const timeObj = seq?.time as { start?: { referenceId?: string } } | undefined;
      const refId = timeObj?.start?.referenceId;
      if (typeof refId === 'string' && refId.length > 0 && !sequenceIds.has(refId)) {
        danglingAnchors.push({ sequenceId: seqId, referenceId: refId });
      }
      if (typeof seq?.assetId === 'string' && seq.assetId.length > 0 && !assetIds.has(seq.assetId)) {
        missingAssets.push({ sequenceId: seqId, assetId: seq.assetId });
      }
      if (Array.isArray(seq?.modifiers)) {
        for (const mod of seq.modifiers as Array<{ type?: string }>) {
          modifierCount++;
          if (mod?.type && !registry.get(mod.type)) {
            unregisteredSet.add(mod.type);
          }
        }
      }
    }
  }

  return {
    parsedDoc: parsed as unknown as VideoIRDocument,
    diagnostics: {
      parseError: null,
      schemaValidation,
      trackCount: tracks.length,
      sequenceCount,
      assetCount: assetIds.size,
      modifierCount,
      unregisteredModifiers: Array.from(unregisteredSet),
      danglingAnchors,
      missingAssets,
    },
  };
}
