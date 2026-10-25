import fs from 'fs';
import path from 'path';

export interface FuncCoverage {
  name: string;
  line: number;
  hit: number;
}

export interface BranchCoverage {
  line: number;
  block: number;
  branch: number;
  taken: number;
}

export interface FileCoverageReport {
  file: string; // normalized path relative to workspace root
  absolutePath: string;
  lines: Map<number, number>; // line number -> hit count
  functions: FuncCoverage[];
  branches: BranchCoverage[];
  linesFound: number;
  linesHit: number;
  functionsFound: number;
  functionsHit: number;
  branchesFound: number;
  branchesHit: number;
  linePercent: number;
  functionPercent: number;
  branchPercent: number;
}

export interface CoverageSummary {
  totalFiles: number;
  linesFound: number;
  linesHit: number;
  linePercent: number;
  functionsFound: number;
  functionsHit: number;
  functionPercent: number;
  branchesFound: number;
  branchesHit: number;
  branchPercent: number;
}

export interface GenerateReportOptions {
  lcovPath?: string;
  outputDir?: string;
  sourceRootDir?: string;
}

/**
 * Parses LCOV format string into structured FileCoverageReport records.
 */
export function parseLcov(lcovContent: string, sourceRootDir: string = process.cwd()): Map<string, FileCoverageReport> {
  const reports = new Map<string, FileCoverageReport>();
  const lines = lcovContent.split(/\r?\n/);

  let currentFile: string | null = null;
  let currentAbsolutePath: string | null = null;
  let currentLines = new Map<number, number>();
  let currentFuncs: FuncCoverage[] = [];
  let currentBranches: BranchCoverage[] = [];
  let linesFound = 0;
  let linesHit = 0;
  let funcsFound = 0;
  let funcsHit = 0;
  let branchesFound = 0;
  let branchesHit = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('SF:')) {
      const rawPath = line.substring(3).trim();
      const normalized = rawPath.replace(/\\/g, '/');

      let relPath = normalized;
      let absPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(sourceRootDir, rawPath);

      if (path.isAbsolute(normalized)) {
        const rootNorm = sourceRootDir.replace(/\\/g, '/');
        if (normalized.startsWith(rootNorm)) {
          relPath = normalized.substring(rootNorm.length).replace(/^\//, '');
        }
      }

      currentFile = relPath.replace(/\\/g, '/');
      currentAbsolutePath = absPath;
      currentLines = new Map<number, number>();
      currentFuncs = [];
      currentBranches = [];
      linesFound = 0;
      linesHit = 0;
      funcsFound = 0;
      funcsHit = 0;
      branchesFound = 0;
      branchesHit = 0;
    } else if (line.startsWith('DA:')) {
      // DA:<line number>,<execution count>
      const parts = line.substring(3).split(',');
      const lineNo = parseInt(parts[0], 10);
      const hit = parseInt(parts[1], 10) || 0;
      if (!isNaN(lineNo)) {
        currentLines.set(lineNo, hit);
      }
    } else if (line.startsWith('FN:')) {
      // FN:<line number>,<function name>
      const parts = line.substring(3).split(',');
      const lineNo = parseInt(parts[0], 10);
      const name = parts.slice(1).join(',');
      if (!isNaN(lineNo)) {
        currentFuncs.push({ line: lineNo, name: name.trim(), hit: 0 });
      }
    } else if (line.startsWith('FNDA:')) {
      // FNDA:<execution count>,<function name>
      const parts = line.substring(5).split(',');
      const hit = parseInt(parts[0], 10) || 0;
      const name = parts.slice(1).join(',').trim();
      const fn = currentFuncs.find((f) => f.name === name);
      if (fn) {
        fn.hit = hit;
      }
    } else if (line.startsWith('BRDA:')) {
      // BRDA:<line>,<block>,<branch>,<taken>
      const parts = line.substring(5).split(',');
      const lineNo = parseInt(parts[0], 10);
      const block = parseInt(parts[1], 10);
      const branch = parseInt(parts[2], 10);
      const taken = parts[3] === '-' ? 0 : parseInt(parts[3], 10) || 0;
      if (!isNaN(lineNo)) {
        currentBranches.push({ line: lineNo, block, branch, taken });
      }
    } else if (line.startsWith('LF:')) {
      linesFound = parseInt(line.substring(3), 10) || 0;
    } else if (line.startsWith('LH:')) {
      linesHit = parseInt(line.substring(3), 10) || 0;
    } else if (line.startsWith('FNF:')) {
      funcsFound = parseInt(line.substring(4), 10) || 0;
    } else if (line.startsWith('FNH:')) {
      funcsHit = parseInt(line.substring(4), 10) || 0;
    } else if (line.startsWith('BRF:')) {
      branchesFound = parseInt(line.substring(4), 10) || 0;
    } else if (line.startsWith('BRH:')) {
      branchesHit = parseInt(line.substring(4), 10) || 0;
    } else if (line === 'end_of_record') {
      if (currentFile) {
        // Compute counts if LF/LH omitted
        if (linesFound === 0 && currentLines.size > 0) {
          linesFound = currentLines.size;
          linesHit = Array.from(currentLines.values()).filter((h) => h > 0).length;
        }
        if (funcsFound === 0 && currentFuncs.length > 0) {
          funcsFound = currentFuncs.length;
          funcsHit = currentFuncs.filter((f) => f.hit > 0).length;
        }
        if (branchesFound === 0 && currentBranches.length > 0) {
          branchesFound = currentBranches.length;
          branchesHit = currentBranches.filter((b) => b.taken > 0).length;
        }

        const linePercent = linesFound > 0 ? (linesHit / linesFound) * 100 : 100;
        const functionPercent = funcsFound > 0 ? (funcsHit / funcsFound) * 100 : 100;
        const branchPercent = branchesFound > 0 ? (branchesHit / branchesFound) * 100 : 100;

        reports.set(currentFile, {
          file: currentFile,
          absolutePath: currentAbsolutePath || currentFile,
          lines: currentLines,
          functions: currentFuncs,
          branches: currentBranches,
          linesFound,
          linesHit,
          functionsFound: funcsFound,
          functionsHit: funcsHit,
          branchesFound,
          branchesHit,
          linePercent,
          functionPercent,
          branchPercent,
        });
      }
      currentFile = null;
    }
  }

  return reports;
}

/**
 * Calculates aggregate summary metrics across all parsed file reports.
 */
export function calculateSummary(reports: FileCoverageReport[]): CoverageSummary {
  let linesFound = 0;
  let linesHit = 0;
  let funcsFound = 0;
  let funcsHit = 0;
  let branchesFound = 0;
  let branchesHit = 0;

  for (const rep of reports) {
    linesFound += rep.linesFound;
    linesHit += rep.linesHit;
    funcsFound += rep.functionsFound;
    funcsHit += rep.functionsHit;
    branchesFound += rep.branchesFound;
    branchesHit += rep.branchesHit;
  }

  const linePercent = linesFound > 0 ? (linesHit / linesFound) * 100 : 100;
  const functionPercent = funcsFound > 0 ? (funcsHit / funcsFound) * 100 : 100;
  const branchPercent = branchesFound > 0 ? (branchesHit / branchesFound) * 100 : 100;

  return {
    totalFiles: reports.length,
    linesFound,
    linesHit,
    linePercent,
    functionsFound: funcsFound,
    functionsHit: funcsHit,
    functionPercent,
    branchesFound,
    branchesHit,
    branchPercent,
  };
}

export function getCoverageClass(pct: number): string {
  if (pct >= 80) return 'high';
  if (pct >= 50) return 'medium';
  return 'low';
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates the master JaCoCo-style dashboard index.html string with sorting and filtering.
 */
export function generateIndexHtml(reports: FileCoverageReport[], summary: CoverageSummary): string {
  const timestamp = new Date().toLocaleString();
  const sortedReports = [...reports].sort((a, b) => a.file.localeCompare(b.file));

  const tableRows = sortedReports
    .map((rep) => {
      const lineClass = getCoverageClass(rep.linePercent);
      const fnClass = getCoverageClass(rep.functionPercent);
      const brClass = getCoverageClass(rep.branchPercent);
      const detailHref = `files/${encodeURIComponent(rep.file.replace(/[\/\\:]/g, '_'))}.html`;
      const missedLines = rep.linesFound - rep.linesHit;

      return `
      <tr class="file-row" 
          data-file="${escapeHtml(rep.file.toLowerCase())}" 
          data-line-pct="${rep.linePercent.toFixed(2)}"
          data-lines-missed="${missedLines}"
          data-lines-found="${rep.linesFound}"
          data-fn-pct="${rep.functionPercent.toFixed(2)}"
          data-br-pct="${rep.branchPercent.toFixed(2)}">
        <td class="file-cell" data-val="${escapeHtml(rep.file)}">
          <a href="${detailHref}" class="file-link" title="${escapeHtml(rep.file)}">
            <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            <span class="file-name">${escapeHtml(rep.file)}</span>
          </a>
        </td>
        <td class="num-cell" data-val="${rep.linePercent}">
          <div class="bar-container">
            <div class="bar ${lineClass}" style="width: ${rep.linePercent.toFixed(1)}%"></div>
          </div>
          <span class="badge ${lineClass}">${rep.linePercent.toFixed(1)}%</span>
        </td>
        <td class="num-cell" data-val="${rep.linesHit}">${rep.linesHit} / ${rep.linesFound}</td>
        <td class="num-cell missed" data-val="${missedLines}">${missedLines}</td>
        <td class="num-cell" data-val="${rep.functionPercent}">
          <div class="bar-container">
            <div class="bar ${fnClass}" style="width: ${rep.functionPercent.toFixed(1)}%"></div>
          </div>
          <span class="badge ${fnClass}">${rep.functionPercent.toFixed(1)}%</span>
        </td>
        <td class="num-cell" data-val="${rep.functionsHit}">${rep.functionsHit} / ${rep.functionsFound}</td>
        <td class="num-cell" data-val="${rep.branchPercent}">
          <div class="bar-container">
            <div class="bar ${brClass}" style="width: ${rep.branchPercent.toFixed(1)}%"></div>
          </div>
          <span class="badge ${brClass}">${rep.branchPercent.toFixed(1)}%</span>
        </td>
        <td class="num-cell" data-val="${rep.branchesHit}">${rep.branchesHit} / ${rep.branchesFound}</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Storytelling Generator - Code Coverage Report</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(18, 24, 38, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --high-bg: #10b981;
      --high-text: #ecfdf5;
      --med-bg: #f59e0b;
      --med-text: #fffbeb;
      --low-bg: #ef4444;
      --low-text: #fef2f2;
      --bar-track: rgba(255, 255, 255, 0.06);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 32px 24px;
      line-height: 1.5;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--card-border);
    }
    .title-group h1 { font-size: 24px; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
    .title-group p { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 20px;
      backdrop-filter: blur(12px);
    }
    .card-label { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
    .card-value { font-size: 36px; font-weight: 800; margin: 8px 0; color: #fff; }
    .card-meta { font-size: 13px; color: var(--text-muted); }
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      gap: 12px;
      flex-wrap: wrap;
    }
    .search-input {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14px;
      width: 320px;
      outline: none;
      transition: all 0.2s;
    }
    .search-input:focus { border-color: var(--accent); background: rgba(255, 255, 255, 0.08); }
    .filter-pills { display: flex; gap: 8px; }
    .pill {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s;
    }
    .pill.active, .pill:hover { background: rgba(56, 189, 248, 0.15); border-color: var(--accent); color: #fff; }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
      font-size: 14px;
    }
    th, td { padding: 12px 16px; text-align: left; }
    th {
      background: rgba(255, 255, 255, 0.03);
      color: var(--text-muted);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--card-border);
      cursor: pointer;
      user-select: none;
    }
    th:hover { color: #fff; background: rgba(255, 255, 255, 0.06); }
    th.sorted-asc::after { content: " \\2191"; color: var(--accent); }
    th.sorted-desc::after { content: " \\2193"; color: var(--accent); }
    tr.file-row { border-bottom: 1px solid rgba(255, 255, 255, 0.04); transition: background 0.15s; }
    tr.file-row:hover { background: rgba(255, 255, 255, 0.03); }
    .file-cell { min-width: 280px; }
    .file-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #38bdf8;
      text-decoration: none;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
    }
    .file-link:hover { text-decoration: underline; color: #7dd3fc; }
    .file-icon { width: 15px; height: 15px; opacity: 0.7; flex-shrink: 0; }
    .num-cell { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
    .missed { color: #f87171; font-weight: 600; }
    .bar-container {
      width: 70px;
      height: 6px;
      background: var(--bar-track);
      border-radius: 3px;
      display: inline-block;
      vertical-align: middle;
      margin-right: 8px;
      overflow: hidden;
    }
    .bar { height: 100%; border-radius: 3px; }
    .bar.high { background: var(--high-bg); }
    .bar.medium { background: var(--med-bg); }
    .bar.low { background: var(--low-bg); }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      vertical-align: middle;
    }
    .badge.high { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .badge.medium { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    .badge.low { background: rgba(239, 68, 68, 0.15); color: #f87171; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="title-group">
        <h1>Visual Storytelling Generator Coverage</h1>
        <p>JaCoCo-Style Isomorphic Code Coverage Report &bull; Generated on ${timestamp}</p>
      </div>
    </header>

    <div class="metrics-grid">
      <div class="card">
        <div class="card-label">Line Coverage</div>
        <div class="card-value ${getCoverageClass(summary.linePercent)}">${summary.linePercent.toFixed(1)}%</div>
        <div class="card-meta">${summary.linesHit} of ${summary.linesFound} lines covered (${summary.linesFound - summary.linesHit} missed)</div>
      </div>
      <div class="card">
        <div class="card-label">Function Coverage</div>
        <div class="card-value ${getCoverageClass(summary.functionPercent)}">${summary.functionPercent.toFixed(1)}%</div>
        <div class="card-meta">${summary.functionsHit} of ${summary.functionsFound} functions covered</div>
      </div>
      <div class="card">
        <div class="card-label">Branch Coverage</div>
        <div class="card-value ${getCoverageClass(summary.branchPercent)}">${summary.branchPercent.toFixed(1)}%</div>
        <div class="card-meta">${summary.branchesHit} of ${summary.branchesFound} branches covered</div>
      </div>
      <div class="card">
        <div class="card-label">Files Tracked</div>
        <div class="card-value">${summary.totalFiles}</div>
        <div class="card-meta">Monorepo modules across studio & packages</div>
      </div>
    </div>

    <div class="toolbar">
      <input type="text" id="searchInput" class="search-input" placeholder="Filter files by name or path...">
      <div class="filter-pills">
        <button class="pill active" data-filter="all">All (${summary.totalFiles})</button>
        <button class="pill" data-filter="high">&ge; 80%</button>
        <button class="pill" data-filter="medium">50% - 79%</button>
        <button class="pill" data-filter="low">&lt; 50%</button>
      </div>
    </div>

    <table id="coverageTable">
      <thead>
        <tr>
          <th data-col="0" data-type="text">Source File</th>
          <th data-col="1" data-type="num">Line Coverage</th>
          <th data-col="2" data-type="num">Lines Hit / Total</th>
          <th data-col="3" data-type="num">Lines Missed</th>
          <th data-col="4" data-type="num">Function Coverage</th>
          <th data-col="5" data-type="num">Functions Hit / Total</th>
          <th data-col="6" data-type="num">Branch Coverage</th>
          <th data-col="7" data-type="num">Branches Hit / Total</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>

  <script>
    const searchInput = document.getElementById('searchInput');
    const filterPills = document.querySelectorAll('.filter-pills .pill');
    const tableBody = document.querySelector('#coverageTable tbody');
    let rows = Array.from(document.querySelectorAll('.file-row'));
    let activeFilter = 'all';

    function applyFilters() {
      const query = (searchInput.value || '').toLowerCase().trim();
      rows.forEach(row => {
        const file = row.getAttribute('data-file') || '';
        const pct = parseFloat(row.getAttribute('data-line-pct') || '0');

        const matchesQuery = !query || file.includes(query);
        let matchesFilter = true;
        if (activeFilter === 'high') matchesFilter = pct >= 80;
        else if (activeFilter === 'medium') matchesFilter = pct >= 50 && pct < 80;
        else if (activeFilter === 'low') matchesFilter = pct < 50;

        row.style.display = (matchesQuery && matchesFilter) ? '' : 'none';
      });
    }

    searchInput.addEventListener('input', applyFilters);
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeFilter = pill.getAttribute('data-filter');
        applyFilters();
      });
    });

    // Column sorting
    let sortCol = -1;
    let sortAsc = true;
    document.querySelectorAll('#coverageTable th').forEach((th, colIdx) => {
      th.addEventListener('click', () => {
        if (sortCol === colIdx) {
          sortAsc = !sortAsc;
        } else {
          sortCol = colIdx;
          sortAsc = true;
        }

        document.querySelectorAll('#coverageTable th').forEach(h => {
          h.classList.remove('sorted-asc', 'sorted-desc');
        });
        th.classList.add(sortAsc ? 'sorted-asc' : 'sorted-desc');

        const isNum = th.getAttribute('data-type') === 'num';
        rows.sort((a, b) => {
          const cellA = a.children[colIdx];
          const cellB = b.children[colIdx];
          const valA = cellA.getAttribute('data-val') ?? cellA.innerText.trim();
          const valB = cellB.getAttribute('data-val') ?? cellB.innerText.trim();

          let res = 0;
          if (isNum) {
            res = (parseFloat(valA) || 0) - (parseFloat(valB) || 0);
          } else {
            res = String(valA).localeCompare(String(valB));
          }
          return sortAsc ? res : -res;
        });

        rows.forEach(r => tableBody.appendChild(r));
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Generates an individual source file coverage HTML report with line-by-line hit badges.
 */
export function generateFileHtml(
  report: FileCoverageReport,
  sourceCode: string | null,
  rootRelativePath: string = '../'
): string {
  let sourceHtml = '';
  if (sourceCode) {
    const rawLines = sourceCode.split(/\r?\n/);
    const lineElements = rawLines.map((content, idx) => {
      const lineNo = idx + 1;
      const hitCount = report.lines.get(lineNo);
      let statusClass = 'neutral';
      let badgeText = '';

      if (hitCount !== undefined) {
        if (hitCount > 0) {
          statusClass = 'hit';
          badgeText = `${hitCount}x`;
        } else {
          statusClass = 'miss';
          badgeText = '0x';
        }
      }

      return `
      <tr class="code-line ${statusClass}" id="L${lineNo}" data-status="${statusClass}">
        <td class="line-no"><a href="#L${lineNo}">${lineNo}</a></td>
        <td class="hit-count">${badgeText}</td>
        <td class="line-text"><code>${escapeHtml(content || ' ')}</code></td>
      </tr>`;
    });

    sourceHtml = `
    <table class="code-table">
      <tbody>
        ${lineElements.join('\n')}
      </tbody>
    </table>`;
  } else {
    sourceHtml = `<div class="missing-source">Source code file could not be read from disk: ${escapeHtml(report.absolutePath)}</div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(report.file)} - Coverage Detail</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(18, 24, 38, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --hit-bg: rgba(16, 185, 129, 0.12);
      --hit-border: #10b981;
      --miss-bg: rgba(239, 68, 68, 0.18);
      --miss-border: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 16px;
    }
    .breadcrumb a { color: var(--accent); text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .file-title { font-size: 16px; font-weight: 700; font-family: ui-monospace, monospace; color: #fff; }
    .stat-pills { display: flex; gap: 12px; align-items: center; }
    .stat-pill {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 13px;
    }
    .stat-pill strong { color: #fff; }
    .toggle-btn {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .toggle-btn.active {
      background: rgba(239, 68, 68, 0.25);
      border-color: #ef4444;
      color: #fff;
    }
    .code-container {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow-x: auto;
    }
    .code-table {
      width: 100%;
      border-collapse: collapse;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      line-height: 1.6;
    }
    .code-line { transition: background 0.1s; }
    .code-line:hover { background: rgba(255, 255, 255, 0.05); }
    .code-line.hit { background: var(--hit-bg); }
    .code-line.miss { background: var(--miss-bg); }
    .line-no {
      width: 50px;
      text-align: right;
      padding: 2px 12px;
      color: #64748b;
      user-select: none;
      border-right: 1px solid var(--card-border);
    }
    .line-no a { color: inherit; text-decoration: none; }
    .hit-count {
      width: 55px;
      text-align: right;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
      border-right: 1px solid var(--card-border);
      user-select: none;
    }
    .code-line.hit .hit-count { color: #34d399; }
    .code-line.miss .hit-count { color: #f87171; }
    .line-text {
      padding: 2px 16px;
      white-space: pre;
    }
    .missing-source { padding: 40px; text-align: center; color: var(--text-muted); }
  </style>
</head>
<body>
  <div class="container">
    <div class="breadcrumb">
      <a href="${rootRelativePath}index.html">&larr; Back to Master Dashboard</a>
      <span>/</span>
      <span>${escapeHtml(report.file)}</span>
    </div>

    <div class="header-bar">
      <div class="file-title">${escapeHtml(report.file)}</div>
      <div class="stat-pills">
        <button id="toggleMissed" class="toggle-btn">Show Missed Lines Only</button>
        <div class="stat-pill">Lines: <strong>${report.linePercent.toFixed(1)}%</strong> (${report.linesHit}/${report.linesFound})</div>
        <div class="stat-pill">Functions: <strong>${report.functionPercent.toFixed(1)}%</strong> (${report.functionsHit}/${report.functionsFound})</div>
        <div class="stat-pill">Branches: <strong>${report.branchPercent.toFixed(1)}%</strong> (${report.branchesHit}/${report.branchesFound})</div>
      </div>
    </div>

    <div class="code-container">
      ${sourceHtml}
    </div>
  </div>

  <script>
    const toggleBtn = document.getElementById('toggleMissed');
    let missedOnly = false;
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        missedOnly = !missedOnly;
        toggleBtn.classList.toggle('active', missedOnly);
        toggleBtn.innerText = missedOnly ? 'Show All Lines' : 'Show Missed Lines Only';
        document.querySelectorAll('.code-line').forEach(line => {
          if (missedOnly) {
            line.style.display = line.classList.contains('miss') ? '' : 'none';
          } else {
            line.style.display = '';
          }
        });
      });
    }
  </script>
</body>
</html>`;
}

/**
 * Main coordinator function generating full HTML report suite from LCOV file.
 */
export async function generateHtmlCoverageReport(options: GenerateReportOptions = {}): Promise<{
  summary: CoverageSummary;
  reportDir: string;
  fileCount: number;
}> {
  const rootDir = options.sourceRootDir || process.cwd();
  const lcovPath = options.lcovPath || path.resolve(rootDir, 'coverage', 'lcov.info');
  const outputDir = options.outputDir || path.resolve(rootDir, 'coverage', 'html');

  if (!fs.existsSync(lcovPath)) {
    throw new Error(`LCOV coverage file not found at: ${lcovPath}. Run bun test with --coverage --coverage-reporter=lcov first.`);
  }

  const lcovContent = fs.readFileSync(lcovPath, 'utf-8');
  const reportsMap = parseLcov(lcovContent, rootDir);
  const reports = Array.from(reportsMap.values());
  const summary = calculateSummary(reports);

  // Ensure output directory structure
  const filesDir = path.join(outputDir, 'files');
  if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir, { recursive: true });
  }

  // 1. Generate master index.html
  const indexHtml = generateIndexHtml(reports, summary);
  fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml, 'utf-8');

  // 2. Generate per-file detail HTML pages
  for (const rep of reports) {
    let sourceContent: string | null = null;
    try {
      if (fs.existsSync(rep.absolutePath)) {
        sourceContent = fs.readFileSync(rep.absolutePath, 'utf-8');
      } else {
        const fallbackPath = path.resolve(rootDir, rep.file);
        if (fs.existsSync(fallbackPath)) {
          sourceContent = fs.readFileSync(fallbackPath, 'utf-8');
        }
      }
    } catch {
      sourceContent = null;
    }

    const fileHtml = generateFileHtml(rep, sourceContent, '../');
    const safeFilename = `${encodeURIComponent(rep.file.replace(/[\/\\:]/g, '_'))}.html`;
    fs.writeFileSync(path.join(filesDir, safeFilename), fileHtml, 'utf-8');
  }

  return {
    summary,
    reportDir: outputDir,
    fileCount: reports.length,
  };
}

// CLI Entrypoint execution
if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    let lcovPath: string | undefined;
    let outputDir: string | undefined;

    for (const arg of args) {
      if (arg.startsWith('--input=')) {
        lcovPath = arg.substring(8);
      } else if (arg.startsWith('--output=')) {
        outputDir = arg.substring(9);
      }
    }

    console.log('[Coverage Generator] Generating JaCoCo-style HTML report...');
    const result = await generateHtmlCoverageReport({ lcovPath, outputDir });
    console.log(`[Coverage Generator] Successfully generated HTML report for ${result.fileCount} files.`);
    console.log(`[Coverage Generator] Line Coverage: ${result.summary.linePercent.toFixed(1)}% (${result.summary.linesHit}/${result.summary.linesFound})`);
    console.log(`[Coverage Generator] Report available at: file://${path.resolve(result.reportDir, 'index.html').replace(/\\/g, '/')}`);
  } catch (err: any) {
    console.error('[Coverage Generator Error]:', err.message);
    process.exit(1);
  }
}
