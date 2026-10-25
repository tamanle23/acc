import { describe, expect, it } from 'bun:test';
import { generateAssContent } from '../packages/effect-engines/src/subtitles/subtitles';
import { drawCanvasCaptions } from '../packages/effect-engines/src/subtitles/captions-canvas';
import type { CaptionConfig } from '../packages/effect-engines/src/types';

describe('Active Word Highlight & Multi-Word Subtitles', () => {
  const sampleCaptions: CaptionConfig[] = [
    { text: 'Hello', start: 0.0, end: 0.5 },
    { text: 'world', start: 0.5, end: 1.0 },
    { text: 'from', start: 1.0, end: 1.5 },
    { text: 'Antigravity', start: 1.5, end: 2.2 },
  ];

  it('should generate static multi-word phrase subtitles without active word highlight when activeWordHighlight is false/omitted', () => {
    const ass = generateAssContent(
      sampleCaptions,
      {
        wordsPerPhrase: 4,
        activeWordHighlight: false,
      },
      1920,
      1080
    );

    expect(ass).toContain('[Events]');
    // Should have 1 single dialogue line for the whole phrase
    const dialogueLines = ass.trim().split('\n').filter(l => l.startsWith('Dialogue:'));
    expect(dialogueLines.length).toBe(1);
    expect(dialogueLines[0]).toContain('Hello world from Antigravity');
    // Must NOT contain ASS override tags like {\c...} or {\fscx...}
    expect(dialogueLines[0]).not.toContain('{\\c');
    expect(dialogueLines[0]).not.toContain('{\\fscx');
  });

  it('should generate karaoke highlight dialogue lines when activeWordHighlight is true', () => {
    const ass = generateAssContent(
      sampleCaptions,
      {
        wordsPerPhrase: 4,
        activeWordHighlight: true,
        highlightPreset: 'scale-color',
        highlightColor: '#00FFFF',
      },
      1920,
      1080
    );

    const dialogueLines = ass.trim().split('\n').filter(l => l.startsWith('Dialogue:'));
    // With active word highlight on 4 words in 1 phrase, 4 sequential highlighted dialogue events are generated
    expect(dialogueLines.length).toBe(4);
    // Contains highlight tags
    expect(dialogueLines[0]).toContain('\\fscx115\\fscy115');
    expect(dialogueLines[0]).toContain('Hello');
  });

  it('should fallback to default highlight color when activeWordHighlight is true but highlightPreset is omitted', () => {
    const ass = generateAssContent(
      sampleCaptions,
      {
        wordsPerPhrase: 4,
        activeWordHighlight: true,
      },
      1920,
      1080
    );

    const dialogueLines = ass.trim().split('\n').filter(l => l.startsWith('Dialogue:'));
    expect(dialogueLines.length).toBe(4);
    expect(ass).toContain('{\\c');
  });

  it('should support kebab-case active-word-highlight alias', () => {
    const ass = generateAssContent(
      sampleCaptions,
      {
        wordsPerPhrase: 4,
        'active-word-highlight': true,
      } as any,
      1920,
      1080
    );

    const dialogueLines = ass.trim().split('\n').filter(l => l.startsWith('Dialogue:'));
    expect(dialogueLines.length).toBe(4);
  });

  it('should render standard single-word subtitles when wordsPerPhrase is 1', () => {
    const ass = generateAssContent(
      sampleCaptions,
      {
        wordsPerPhrase: 1,
        activeWordHighlight: false,
      },
      1920,
      1080
    );

    const dialogueLines = ass.trim().split('\n').filter(l => l.startsWith('Dialogue:'));
    expect(dialogueLines.length).toBe(4);
    expect(dialogueLines[0]).toContain('Hello');
    expect(dialogueLines[1]).toContain('world');
  });

  it('should render canvas captions without crashing and respect activeWordHighlight flag', () => {
    let fillTextCalls: string[] = [];
    const mockCtx = {
      save: () => {},
      restore: () => {},
      measureText: (text: string) => ({ width: text.length * 10 }),
      font: '',
      textBaseline: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineJoin: '',
      miterLimit: 0,
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      translate: () => {},
      scale: () => {},
      beginPath: () => {},
      fillRect: () => {},
      fillText: (text: string) => {
        fillTextCalls.push(text);
      },
      strokeText: () => {},
    };

    drawCanvasCaptions(mockCtx, sampleCaptions, 0.25, { wordsPerPhrase: 4, activeWordHighlight: false }, 1920, 1080);
    expect(fillTextCalls).toEqual(['Hello', 'world', 'from', 'Antigravity']);
  });
});
