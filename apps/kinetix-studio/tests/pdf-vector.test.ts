// ============================================================================
// KINETIX STUDIO - PURE VECTOR PDF PRE-PRESS SUITE (MILESTONE D)
// Verifies PDF 1.7 / PDF/X-4 compliance, DeviceCMYK color separation operators,
// MediaBox/BleedBox/TrimBox geometry, crop marks, and 5th spot varnish plate.
// ============================================================================

import { describe, it, expect } from 'bun:test';
import {
  PdfVectorGeneratorAdapter,
  mmToPoints,
} from '@/adapters/driven/pdf-vector-generator.adapter';
import { exportVectorPdfDeck } from '@/lib/print-master';
import { INITIAL_STUDIO_STATE } from '@/constants/initial-state';

describe('Pre-Press Vector PDF & DeviceCMYK Separation Suite (Milestone D)', () => {
  it('converts millimeters to typographic points according to 72pt/inch standard', () => {
    // 25.4 mm = 1 inch = 72 points
    expect(mmToPoints(25.4)).toBeCloseTo(72, 3);
    expect(mmToPoints(0)).toBe(0);
    // A4 width: 210mm -> 595.275 pt
    expect(mmToPoints(210)).toBeCloseTo(595.28, 1);
  });

  it('generates a valid binary PDF 1.7 document with DeviceCMYK separation', async () => {
    const adapter = new PdfVectorGeneratorAdapter();
    const result = adapter.generatePdf({
      state: INITIAL_STUDIO_STATE,
      presetId: 'iso-a2',
      bleedMm: 3,
      includeSpotPlate: false,
    });

    expect(result.blob).toBeDefined();
    expect(result.blob.type).toBe('application/pdf');
    expect(result.pageCount).toBe(1);
    expect(result.hasSpotPlate).toBe(false);
    expect(result.filename.endsWith('.pdf')).toBe(true);

    const text = await result.blob.text();

    // Verify PDF Header & Magic binary comment
    expect(text.startsWith('%PDF-1.7')).toBe(true);

    // Verify Standard Pre-Press Boxes
    expect(text).toContain('/MediaBox');
    expect(text).toContain('/BleedBox');
    expect(text).toContain('/TrimBox');

    // Verify DeviceCMYK Operator Syntax (c m y k k fill and K stroke)
    expect(text).toMatch(/\d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)? k/);
    expect(text).toMatch(/\d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)? K/);

    // Verify Typography Text Matrix Operators
    expect(text).toContain('BT');
    expect(text).toContain('Tf');
    expect(text).toContain('Tj');
    expect(text).toContain('ET');

    // Verify XRef Table & Trailer EOF
    expect(text).toContain('xref\n0 ');
    expect(text).toContain('trailer\n<< /Size ');
    expect(text).toContain('startxref\n');
    expect(text.trim().endsWith('%%EOF')).toBe(true);
  });

  it('generates a 2-page deck containing an isolated Spot Varnish / Foil Mask plate', async () => {
    const adapter = new PdfVectorGeneratorAdapter();
    const result = adapter.generatePdf({
      state: INITIAL_STUDIO_STATE,
      presetId: 'iso-a1',
      bleedMm: 3,
      includeSpotPlate: true,
    });

    expect(result.pageCount).toBe(2);
    expect(result.hasSpotPlate).toBe(true);

    const text = await result.blob.text();

    // Verify Page 2 definition and 100% K Spot Plate Label
    expect(text).toContain('/Count 2');
    expect(text).toContain('SPOT UV VARNISH & EMBOSSING DIE MASK');
    // Spot Plate must isolate embellishments in 100% Black (0 0 0 1 k)
    expect(text).toContain('0 0 0 1 k');
  });

  it('exports vector PDF deck using exportVectorPdfDeck without autoDownload', async () => {
    const blob = await exportVectorPdfDeck({
      state: INITIAL_STUDIO_STATE,
      presetId: 'us-poster',
      autoDownload: false,
    });

    expect(blob).toBeDefined();
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
  });
});
