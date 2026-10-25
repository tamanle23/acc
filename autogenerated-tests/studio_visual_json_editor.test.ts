import { describe, test, expect } from 'bun:test';
import {
  getJsonValueAtPath,
  setJsonValueAtPath,
  deleteJsonValueAtPath,
  insertJsonArrayItem,
  formatJsonPath,
} from '../apps/studio/src/components/debugger/types';
import { analyzeVideoIRJson } from '../apps/studio/src/components/debugger/VisualIRJsonDebuggerModal';
import { complexSciFiDemoIR } from '../apps/studio/src/lib/ir/complexSciFiDemoIR';

describe('Studio Visual VideoIR JSON Editor & In-Place Mutator Engine (Iteration 25)', () => {
  const sampleDoc = JSON.parse(JSON.stringify(complexSciFiDemoIR));

  test('getJsonValueAtPath accurately retrieves nested values and primitives', () => {
    const contentId = getJsonValueAtPath(sampleDoc, ['meta', 'contentId']);
    expect(contentId).toBe('sci-fi-cyberpunk-epic-2099');

    const firstTrackId = getJsonValueAtPath(sampleDoc, ['tracks', 0, 'id']);
    expect(firstTrackId).toBe('track-v1');

    const nonExistent = getJsonValueAtPath(sampleDoc, ['tracks', 99, 'missing']);
    expect(nonExistent).toBeUndefined();
  });

  test('setJsonValueAtPath immutably updates leaf values and maintains data integrity', () => {
    const updated = setJsonValueAtPath(sampleDoc, ['meta', 'contentId'], 'NEW_IMMUTABLE_CONTENT_ID');
    expect(getJsonValueAtPath(updated, ['meta', 'contentId'])).toBe('NEW_IMMUTABLE_CONTENT_ID');
    // Ensure original sampleDoc was not mutated in place
    expect(sampleDoc.meta.contentId).not.toBe('NEW_IMMUTABLE_CONTENT_ID');

    // Update nested number
    const updatedFps = setJsonValueAtPath(updated, ['meta', 'globalFps'], 60);
    expect(getJsonValueAtPath(updatedFps, ['meta', 'globalFps'])).toBe(60);
  });

  test('insertJsonArrayItem inserts into array at specified index immutably', () => {
    const newSeq = { id: 'seq-inserted-test', name: 'Inserted Seq', time: { start: 0, duration: 100 } };
    const updated = insertJsonArrayItem(sampleDoc, ['tracks', 0, 'sequences'], newSeq, 1);

    const targetArray: any = getJsonValueAtPath(updated, ['tracks', 0, 'sequences']);
    expect(targetArray.length).toBe(sampleDoc.tracks[0].sequences.length + 1);
    expect(targetArray[1].id).toBe('seq-inserted-test');
  });

  test('deleteJsonValueAtPath removes array item and object property immutably', () => {
    // 1. Delete array item
    const initialLen = sampleDoc.tracks[0].sequences.length;
    const deletedSeq = deleteJsonValueAtPath(sampleDoc, ['tracks', 0, 'sequences', 0]);
    const afterSeqs: any = getJsonValueAtPath(deletedSeq, ['tracks', 0, 'sequences']);
    expect(afterSeqs.length).toBe(initialLen - 1);

    // 2. Delete object key
    const deletedMeta = deleteJsonValueAtPath(sampleDoc, ['metadata', 'description']);
    expect(getJsonValueAtPath(deletedMeta, ['metadata', 'description'])).toBeUndefined();
  });

  test('formatJsonPath produces standard and human-readable JSON pointer notation', () => {
    expect(formatJsonPath([])).toBe('$ (root)');
    expect(formatJsonPath(['metadata', 'title'])).toBe('metadata.title');
    expect(formatJsonPath(['tracks', 0, 'sequences', 2, 'id'])).toBe('tracks[0].sequences[2].id');
  });

  test('analyzeVideoIRJson maintains real-time diagnostics parity after in-place visual mutations', () => {
    // Modify sequence duration visually
    const modified = setJsonValueAtPath(sampleDoc, ['tracks', 0, 'sequences', 0, 'time', 'duration'], 240);
    const jsonStr = JSON.stringify(modified, null, 2);

    const { parsedDoc, diagnostics } = analyzeVideoIRJson(jsonStr);
    expect(parsedDoc).not.toBeNull();
    expect(diagnostics.schemaValidation.valid).toBe(true);
    expect(diagnostics.trackCount).toBe(12);
    expect(diagnostics.sequenceCount).toBeGreaterThanOrEqual(16);
  });
});
