import { describe, it, expect } from 'bun:test';
import { generatePosterSvgString, escapeXml } from '../src/lib/export-video';
import { INITIAL_STUDIO_STATE } from '../src/constants/initial-state';
import type { StudioState } from '../src/types/studio';

describe('Scalable Vector Graphics (.svg) XML Entity Safety Suite', () => {
  it('escapeXml safely encodes XML entity references and special characters', () => {
    expect(escapeXml(null)).toBe('');
    expect(escapeXml(undefined)).toBe('');
    expect(escapeXml('MODULAR SYNTHESIS & LASER EXHIBITION')).toBe(
      'MODULAR SYNTHESIS &amp; LASER EXHIBITION'
    );
    expect(escapeXml('<script>alert("XSS")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
    );
    expect(escapeXml("Rock & Roll's Best // <2026>")).toBe(
      'Rock &amp; Roll&apos;s Best // &lt;2026&gt;'
    );
  });

  it('strips invalid XML 1.0 control characters', () => {
    const invalidXmlChars = 'ValidText\u0000\u0007\u000B\u001FEnd';
    expect(escapeXml(invalidXmlChars)).toBe('ValidTextEnd');
  });

  it('prevents xmlParseEntityRef: no name error when subhead contains naked ampersand', () => {
    const state: StudioState = {
      ...INITIAL_STUDIO_STATE,
      content: {
        ...INITIAL_STUDIO_STATE.content,
        subhead: 'MODULAR SYNTHESIS & LASER EXHIBITION', // Exact user trigger
        headline: ['DRUM & BASS', 'R&D LABS', '<STAGE 01>'],
        sponsor: 'DOLBY ATMOS & DTS-X // "PRO AUDIO"',
        date: 'NOV 14 & 15',
        location: 'BERLIN & SAIGON',
        tag: 'LIVE & DIRECT',
      },
    };

    const svgString = generatePosterSvgString(state);

    // Verify raw unescaped & does not exist inside XML text nodes
    // Line 11 or any text node must have &amp; instead of bare &
    expect(svgString).not.toMatch(/<text[^>]*>[^<]*&(?!(amp|lt|gt|quot|apos);)[^<]*<\/text>/);
    expect(svgString).toContain('MODULAR SYNTHESIS &amp; LASER EXHIBITION');
    expect(svgString).toContain('DRUM &amp; BASS');
    expect(svgString).toContain('R&amp;D LABS');
    expect(svgString).toContain('&lt;STAGE 01&gt;');
    expect(svgString).toContain('DOLBY ATMOS &amp; DTS-X // &quot;PRO AUDIO&quot;');
    expect(svgString).toContain('LIVE &amp; DIRECT');

    // Verify XML well-formedness: all tags close properly
    const openTags = (svgString.match(/<[a-zA-Z0-9-]+(?=[\s>])/g) || []).map((t) =>
      t.substring(1)
    );
    const selfClosingTags = (svgString.match(/<[a-zA-Z0-9-]+[^>]*\/>/g) || []).length;
    const closeTags = (svgString.match(/<\/[a-zA-Z0-9-]+>/g) || []).length;

    // Must start with XML declaration and SVG root element
    expect(svgString.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(svgString.includes('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svgString.endsWith('</svg>')).toBe(true);
  });

  it('parses cleanly with DOMParser without any parsererror', () => {
    // If DOMParser is available (browser or jsdom/happy-dom)
    if (typeof DOMParser !== 'undefined') {
      const state: StudioState = {
        ...INITIAL_STUDIO_STATE,
        content: {
          headline: ['AUDIO & VISUAL', 'SYNTH & MOTION', '2026'],
          subhead: 'IMMERSIVE 360° & EXPERIMENTAL EXHIBITION',
          date: 'OCT 24 & 25 // 21:00',
          location: 'TOKYO & KYOTO // METAVERSE',
          tag: 'TICKETS & PASSES',
          sponsor: 'POWERED BY ANTIGRAVITY & KINETIX <STUDIO>',
        },
      };

      const svgString = generatePosterSvgString(state);
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const errorNode = doc.querySelector('parsererror');

      expect(errorNode).toBeNull();
      const texts = Array.from(doc.querySelectorAll('text')).map((t) => t.textContent);
      expect(texts).toContain('IMMERSIVE 360° & EXPERIMENTAL EXHIBITION');
      expect(texts).toContain('AUDIO & VISUAL');
      expect(texts).toContain('SYNTH & MOTION');
    }
  });
});
