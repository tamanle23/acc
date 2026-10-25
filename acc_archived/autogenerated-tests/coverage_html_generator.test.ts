import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import {
  parseLcov,
  calculateSummary,
  getCoverageClass,
  escapeHtml,
  generateIndexHtml,
  generateFileHtml,
  generateHtmlCoverageReport,
  type FileCoverageReport,
} from '../scripts/generate-coverage-html';

describe('HTML Coverage Generator Suite', () => {
  const sampleLcov = `
TN:
SF:packages\\core\\src\\sample.ts
FN:10,testFunc
FN:25,uncalledFunc
FNDA:5,testFunc
FNDA:0,uncalledFunc
FNF:2
FNH:1
BRDA:12,0,0,3
BRDA:12,0,1,0
BRF:2
BRH:1
DA:10,5
DA:11,5
DA:12,5
DA:13,3
DA:25,0
DA:26,0
LF:6
LH:4
end_of_record
SF:apps/studio/src/empty.ts
LF:0
LH:0
end_of_record
`;

  describe('parseLcov', () => {
    it('should accurately parse LCOV data into structured FileCoverageReport records', () => {
      const reports = parseLcov(sampleLcov);
      expect(reports.size).toBe(2);

      const sampleRep = reports.get('packages/core/src/sample.ts');
      expect(sampleRep).toBeDefined();
      expect(sampleRep?.linesFound).toBe(6);
      expect(sampleRep?.linesHit).toBe(4);
      expect(sampleRep?.linePercent).toBeCloseTo(66.67, 1);

      expect(sampleRep?.functionsFound).toBe(2);
      expect(sampleRep?.functionsHit).toBe(1);
      expect(sampleRep?.functionPercent).toBe(50);

      expect(sampleRep?.branchesFound).toBe(2);
      expect(sampleRep?.branchesHit).toBe(1);
      expect(sampleRep?.branchPercent).toBe(50);

      // Verify lines map
      expect(sampleRep?.lines.get(10)).toBe(5);
      expect(sampleRep?.lines.get(25)).toBe(0);
    });

    it('should normalize Windows backslashes into standard web forward slashes', () => {
      const reports = parseLcov(sampleLcov);
      expect(reports.has('packages/core/src/sample.ts')).toBe(true);
      expect(reports.has('packages\\core\\src\\sample.ts')).toBe(false);
    });

    it('should handle zero lines gracefully without returning NaN', () => {
      const reports = parseLcov(sampleLcov);
      const emptyRep = reports.get('apps/studio/src/empty.ts');
      expect(emptyRep).toBeDefined();
      expect(emptyRep?.linePercent).toBe(100);
      expect(emptyRep?.functionPercent).toBe(100);
      expect(emptyRep?.branchPercent).toBe(100);
    });

    it('should return an empty map when given empty LCOV string', () => {
      const reports = parseLcov('');
      expect(reports.size).toBe(0);
    });
  });

  describe('calculateSummary', () => {
    it('should aggregate totals and calculate accurate global percentages', () => {
      const reports = Array.from(parseLcov(sampleLcov).values());
      const summary = calculateSummary(reports);

      expect(summary.totalFiles).toBe(2);
      expect(summary.linesFound).toBe(6);
      expect(summary.linesHit).toBe(4);
      expect(summary.linePercent).toBeCloseTo(66.67, 1);
      expect(summary.functionsFound).toBe(2);
      expect(summary.functionsHit).toBe(1);
      expect(summary.functionPercent).toBe(50);
      expect(summary.branchesFound).toBe(2);
      expect(summary.branchesHit).toBe(1);
      expect(summary.branchPercent).toBe(50);
    });

    it('should handle empty report array with default 100% metrics', () => {
      const summary = calculateSummary([]);
      expect(summary.totalFiles).toBe(0);
      expect(summary.linePercent).toBe(100);
      expect(summary.functionPercent).toBe(100);
      expect(summary.branchPercent).toBe(100);
    });
  });

  describe('getCoverageClass and escapeHtml', () => {
    it('should return correct severity class based on percentage thresholds', () => {
      expect(getCoverageClass(85)).toBe('high');
      expect(getCoverageClass(80)).toBe('high');
      expect(getCoverageClass(79.9)).toBe('medium');
      expect(getCoverageClass(50)).toBe('medium');
      expect(getCoverageClass(49.9)).toBe('low');
      expect(getCoverageClass(0)).toBe('low');
    });

    it('should safely escape HTML entities to prevent injection', () => {
      const raw = '<script>alert("xss & \'injection\'")</script>';
      const escaped = escapeHtml(raw);
      expect(escaped).toBe('&lt;script&gt;alert(&quot;xss &amp; &#39;injection&#39;&quot;)&lt;/script&gt;');
    });
  });

  describe('generateIndexHtml', () => {
    it('should produce complete HTML dashboard with metrics, sorting, and search', () => {
      const reports = Array.from(parseLcov(sampleLcov).values());
      const summary = calculateSummary(reports);
      const html = generateIndexHtml(reports, summary);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Visual Storytelling Generator Coverage');
      expect(html).toContain('packages/core/src/sample.ts');
      expect(html).toContain('data-file="packages/core/src/sample.ts"');
      expect(html).toContain('data-col="0"');
      expect(html).toContain('id="searchInput"');
      expect(html).toContain('class="filter-pills"');
    });
  });

  describe('generateFileHtml', () => {
    it('should generate line-by-line source view with hit/miss indicators', () => {
      const reportsMap = parseLcov(sampleLcov);
      const rep = reportsMap.get('packages/core/src/sample.ts')!;
      const fakeSource = [
        '// Line 1: Comment',
        'export function testFunc() {',
        '  const x = 1;',
        '}',
      ].join('\n');

      const html = generateFileHtml(rep, fakeSource, '../');

      expect(html).toContain('packages/core/src/sample.ts - Coverage Detail');
      expect(html).toContain('id="L1"');
      expect(html).toContain('id="L2"');
      expect(html).toContain('id="toggleMissed"');
      expect(html).toContain('Back to Master Dashboard');
    });

    it('should display graceful fallback if source file is missing', () => {
      const reportsMap = parseLcov(sampleLcov);
      const rep = reportsMap.get('packages/core/src/sample.ts')!;
      const html = generateFileHtml(rep, null, '../');

      expect(html).toContain('Source code file could not be read from disk');
    });
  });

  describe('generateHtmlCoverageReport', () => {
    const testDir = path.resolve(process.cwd(), 'coverage-test-tmp');
    const testLcov = path.join(testDir, 'test.lcov');

    beforeEach(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      fs.writeFileSync(testLcov, sampleLcov, 'utf-8');
    });

    afterEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should generate full HTML suite on disk from LCOV file', async () => {
      const outputDir = path.join(testDir, 'html-report');
      const result = await generateHtmlCoverageReport({
        lcovPath: testLcov,
        outputDir,
      });

      expect(result.fileCount).toBe(2);
      expect(result.summary.linesFound).toBe(6);
      expect(fs.existsSync(path.join(outputDir, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'files'))).toBe(true);

      const files = fs.readdirSync(path.join(outputDir, 'files'));
      expect(files.length).toBe(2);
    });

    it('should throw descriptive error when LCOV file is not found', async () => {
      expect(
        generateHtmlCoverageReport({
          lcovPath: path.join(testDir, 'non_existent.info'),
          outputDir: testDir,
        })
      ).rejects.toThrow('LCOV coverage file not found');
    });
  });
});
