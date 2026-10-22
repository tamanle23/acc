import { describe, test, expect } from 'bun:test';

export function calculateSequenceLOD(widthPx: number): number {
  if (widthPx < 36) return 0; // Micro
  if (widthPx < 90) return 1; // Compact
  if (widthPx < 220) return 2; // Standard
  return 3; // Expanded
}

export function formatSequenceDuration(durationFrames: number, fps: number = 30): { badge: string; sec: string } {
  const safeFps = Math.max(1, fps);
  const sec = (durationFrames / safeFps).toFixed(1);
  const badge = durationFrames >= safeFps ? `${sec}s` : `${durationFrames}f`;
  return { badge, sec };
}

export function getSequenceArchetypeBadge(type: string, id: string): { icon: string; themeClass: string } {
  if (type === 'audio') {
    return { icon: '♫', themeClass: 'bg-emerald-950/85 border-emerald-500/50 text-emerald-200' };
  }
  if (id.includes('v2') || id.includes('depth') || id.includes('vfx')) {
    return { icon: '✨', themeClass: 'bg-amber-950/85 border-amber-500/50 text-amber-200' };
  }
  if (type === 'overlay' || type === 'timed_text' || id.includes('text') || id.includes('sub')) {
    return { icon: 'T', themeClass: 'bg-violet-950/85 border-violet-500/50 text-violet-200' };
  }
  return { icon: '▶', themeClass: 'bg-indigo-950/85 border-indigo-500/50 text-indigo-200' };
}

describe('Studio Bento Layout & Timeline Readability Engine (Iteration 24)', () => {
  test('accurately classifies sequence widths into 4 adaptive LOD tiers', () => {
    expect(calculateSequenceLOD(15)).toBe(0); // Micro icon
    expect(calculateSequenceLOD(35)).toBe(0); // Boundary
    expect(calculateSequenceLOD(36)).toBe(1); // Compact
    expect(calculateSequenceLOD(75)).toBe(1);
    expect(calculateSequenceLOD(89)).toBe(1);
    expect(calculateSequenceLOD(90)).toBe(2); // Standard
    expect(calculateSequenceLOD(180)).toBe(2);
    expect(calculateSequenceLOD(219)).toBe(2);
    expect(calculateSequenceLOD(220)).toBe(3); // Expanded
    expect(calculateSequenceLOD(450)).toBe(3);
  });

  test('formats frame duration accurately into seconds or frame units', () => {
    const d1 = formatSequenceDuration(15, 30);
    expect(d1.badge).toBe('15f');
    expect(d1.sec).toBe('0.5');

    const d2 = formatSequenceDuration(60, 30);
    expect(d2.badge).toBe('2.0s');
    expect(d2.sec).toBe('2.0');

    const d3 = formatSequenceDuration(105, 30);
    expect(d3.badge).toBe('3.5s');
    expect(d3.sec).toBe('3.5');
  });

  test('maps sequence types and IDs to semantic archetype colors and icons', () => {
    const audio = getSequenceArchetypeBadge('audio', 'track-a1');
    expect(audio.icon).toBe('♫');
    expect(audio.themeClass).toContain('emerald');

    const vfx = getSequenceArchetypeBadge('video', 'track-v2-depth');
    expect(vfx.icon).toBe('✨');
    expect(vfx.themeClass).toContain('amber');

    const subtitle = getSequenceArchetypeBadge('overlay', 'track-subtitles');
    expect(subtitle.icon).toBe('T');
    expect(subtitle.themeClass).toContain('violet');

    const mainVideo = getSequenceArchetypeBadge('video', 'track-v1');
    expect(mainVideo.icon).toBe('▶');
    expect(mainVideo.themeClass).toContain('indigo');
  });
});
