import { describe, it, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';

describe('Studio Inspector UX Improvements & Refinements Suite (Iteration 21)', () => {
  it('verifies RightSidebar.tsx maintains strict architectural line limit (< 350 lines)', () => {
    const filePath = path.resolve('apps/studio/src/components/RightSidebar.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lineCount = content.split('\n').length;
    expect(lineCount).toBeLessThan(350);
  });

  it('verifies SequenceInspector.tsx adheres strictly to Rule 229 for AccordionTrigger actions', () => {
    const filePath = path.resolve('apps/studio/src/components/inspector/SequenceInspector.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Rule 229: interactive elements must NOT be children of AccordionTrigger, must be in actions prop
    const triggerRegex = /<AccordionTrigger/g;
    let match;
    let count = 0;

    while ((match = triggerRegex.exec(content)) !== null) {
      count++;
      const startIdx = match.index;
      let depth = 0;
      let closeTagIdx = -1;
      for (let i = startIdx + '<AccordionTrigger'.length; i < content.length; i++) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') depth--;
        else if (content[i] === '>' && depth === 0) {
          closeTagIdx = i;
          break;
        }
      }

      expect(closeTagIdx).toBeGreaterThan(startIdx);
      const endTriggerIdx = content.indexOf('</AccordionTrigger>', closeTagIdx);
      expect(endTriggerIdx).toBeGreaterThan(closeTagIdx);

      const triggerProps = content.slice(startIdx, closeTagIdx + 1);
      const triggerChildren = content.slice(closeTagIdx + 1, endTriggerIdx);

      // Children of AccordionTrigger MUST NOT contain interactive buttons, switches, or inputs
      expect(triggerChildren).not.toContain('<Button');
      expect(triggerChildren).not.toContain('<button');
      expect(triggerChildren).not.toContain('<Switch');
      expect(triggerChildren).not.toContain('<Input');
      expect(triggerChildren).not.toContain('onClick');

      // Actions prop must house the interactive controls
      expect(triggerProps).toContain('actions=');
      expect(triggerProps).toContain('<Switch');
    }

    expect(count).toBeGreaterThan(0);
  });

  it('verifies CueTimelineDialog exists and handles subtitle cues immutably', () => {
    const filePath = path.resolve('apps/studio/src/components/inspector/CueTimelineDialog.tsx');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('CueTimelineDialog');
    expect(content).toContain('onSaveCues');
    expect(content).toContain('startOffsetMs');
    expect(content).toContain('endOffsetMs');
  });

  it('updates timed text cues in IRStateManager and preserves cue array integrity', () => {
    const stateManager = IRStateManager.getInstance();
    
    // Add text sequence with cues
    stateManager.addSequence('track-subtitles', {
      id: 'seq-test-cues-1',
      name: 'Subtitles 1',
      time: { start: 0, duration: 90 },
      cues: [
        { startOffsetMs: 0, endOffsetMs: 1200, text: 'Hello world' },
        { startOffsetMs: 1300, endOffsetMs: 2500, text: 'Visual Storytelling' },
      ],
    } as any, {
      trackTypeFallback: 'timed_text',
      trackNameFallback: 'Subtitles',
    });

    const state1 = stateManager.getState();
    const track = state1.doc.tracks.find((t) => t.id === 'track-subtitles');
    const seq = track?.sequences.find((s) => s.id === 'seq-test-cues-1');
    expect(seq).toBeDefined();
    expect(seq?.cues?.length).toBe(2);
    expect(seq?.cues?.[0].text).toBe('Hello world');

    // Update cues with a 3rd cue
    const updatedCues = [
      ...(seq?.cues || []),
      { startOffsetMs: 2600, endOffsetMs: 3800, text: 'New 3rd cue' },
    ];
    stateManager.updateSequenceProps('seq-test-cues-1', { cues: updatedCues });

    const state2 = stateManager.getState();
    const updatedSeq = state2.doc.tracks
      .find((t) => t.id === 'track-subtitles')
      ?.sequences.find((s) => s.id === 'seq-test-cues-1');

    expect(updatedSeq?.cues?.length).toBe(3);
    expect(updatedSeq?.cues?.[2].text).toBe('New 3rd cue');
  });

  it('verifies relational timing controls support offsetFrames and overlapFrames in IR', () => {
    const stateManager = IRStateManager.getInstance();

    stateManager.addSequence('track-video-main', {
      id: 'seq-anchor-rel',
      name: 'Anchor Clip',
      time: { start: 0, duration: 60 },
    } as any);

    stateManager.addSequence('track-video-main', {
      id: 'seq-follower-rel',
      name: 'Follower Clip',
      time: {
        start: {
          after: 'seq-anchor-rel',
          offsetFrames: 5,
          overlapFrames: 2,
        },
        duration: {
          matchLengthOf: 'seq-anchor-rel',
          paddingFrames: 10,
        },
      },
    } as any);

    const state = stateManager.getState();
    const follower = state.doc.tracks
      .find((t) => t.id === 'track-video-main')
      ?.sequences.find((s) => s.id === 'seq-follower-rel');

    expect(follower).toBeDefined();
    expect((follower?.time.start as any).after).toBe('seq-anchor-rel');
    expect((follower?.time.start as any).offsetFrames).toBe(5);
    expect((follower?.time.start as any).overlapFrames).toBe(2);
    expect((follower?.time.duration as any).matchLengthOf).toBe('seq-anchor-rel');
    expect((follower?.time.duration as any).paddingFrames).toBe(10);
  });

  it('verifies disabled prop propagation across modifier inspector strategies', () => {
    const strategiesPath = path.resolve('apps/studio/src/components/inspector/ModifierControlStrategies.tsx');
    const content = fs.readFileSync(strategiesPath, 'utf-8');

    expect(content).toContain('disabled = false');
    expect(content).toContain('ControlStrategyProps');
    expect(content).toContain('disabled?: boolean');
    expect(content).toContain('NumberControlStrategy');
    expect(content).toContain('SwitchControlStrategy');
    expect(content).toContain('SelectControlStrategy');
    expect(content).toContain('ColorControlStrategy');
  });
});
