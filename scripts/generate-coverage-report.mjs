#!/usr/bin/env node

/**
 * Universal Monorepo JaCoCo-Style Coverage Generator
 * Combines Java (JaCoCo) and TypeScript (Vitest / Istanbul) into an interactive,
 * high-performance, self-contained HTML coverage dashboard.
 *
 * Usage:
 *   node scripts/generate-coverage-report.mjs [--open] [--run] [--out <path>] [--json]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Command line args
const args = process.argv.slice(2);
const shouldOpen = args.includes('--open');
const shouldRun = args.includes('--run');
const outputJson = args.includes('--json');
const outArgIndex = args.indexOf('--out');
const customOutPath = outArgIndex !== -1 && args[outArgIndex + 1] ? args[outArgIndex + 1] : null;

const OUTPUT_DIR = path.join(ROOT_DIR, 'coverage');
const OUTPUT_HTML = customOutPath ? path.resolve(ROOT_DIR, customOutPath) : path.join(OUTPUT_DIR, 'index.html');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'coverage-summary.json');

// --- Helper Functions ---
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function calcPercentage(covered, total) {
  if (!total || total === 0) return 100;
  return Math.round((covered / total) * 1000) / 10;
}

// Optional: Execute test suites if --run flag was provided
if (shouldRun) {
  console.log('🚀 [Coverage Generator] --run specified: Executing monorepo test coverage suites...');
  try {
    console.log('📦 Running backend JaCoCo coverage (mvn test jacoco:report)...');
    execSync('mvn test jacoco:report -f apps/backend/unipost-fw/pom.xml -q', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
  } catch (err) {
    console.warn('⚠️ Backend coverage execution failed or returned non-zero, continuing with available reports...');
  }

  try {
    console.log('⚡ Running sandbox Vitest coverage...');
    execSync('pnpm --filter @unipost/sandbox test:coverage', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
  } catch (err) {
    console.warn('⚠️ Sandbox coverage execution failed, continuing with available reports...');
  }

  try {
    console.log('💻 Running console Vitest coverage...');
    execSync('pnpm --filter @unipost/console test:coverage', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
  } catch (err) {
    console.warn('⚠️ Console coverage execution failed, continuing with available reports...');
  }
}

console.log('🔍 [Coverage Generator] Discovering coverage artifacts across repository...');

// ==========================================
// 1. Parse Backend JaCoCo (CSV & XML)
// ==========================================
function parseJacocoBackend() {
  const possibleCsvPaths = [
    path.join(ROOT_DIR, 'apps/backend/unipost-fw/target/site/jacoco/jacoco.csv'),
    path.join(ROOT_DIR, 'apps/backend/target/site/jacoco/jacoco.csv'),
  ];
  const possibleXmlPaths = [
    path.join(ROOT_DIR, 'apps/backend/unipost-fw/target/site/jacoco/jacoco.xml'),
    path.join(ROOT_DIR, 'apps/backend/target/site/jacoco/jacoco.xml'),
  ];

  let csvPath = possibleCsvPaths.find((p) => fs.existsSync(p));
  let xmlPath = possibleXmlPaths.find((p) => fs.existsSync(p));

  if (!csvPath) {
    console.warn('ℹ️ No JaCoCo CSV found at apps/backend/**/target/site/jacoco/jacoco.csv');
    return null;
  }

  console.log(`📄 Parsing JaCoCo CSV: ${path.relative(ROOT_DIR, csvPath)}`);
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return null;

  // Read XML for line coverage & sourcefile breakdown if present
  const xmlLinesByPackageSource = new Map();
  if (xmlPath && fs.existsSync(xmlPath)) {
    try {
      console.log(`📄 Parsing JaCoCo XML for line-level details: ${path.relative(ROOT_DIR, xmlPath)}`);
      const xmlContent = fs.readFileSync(xmlPath, 'utf8');
      const packageRegex = /<package name="([^"]+)">([\s\S]*?)<\/package>/g;
      let pkgMatch;
      while ((pkgMatch = packageRegex.exec(xmlContent)) !== null) {
        const pkgName = pkgMatch[1].replace(/\//g, '.');
        const pkgBody = pkgMatch[2];
        const sourceFileRegex = /<sourcefile name="([^"]+)">([\s\S]*?)<\/sourcefile>/g;
        let sfMatch;
        while ((sfMatch = sourceFileRegex.exec(pkgBody)) !== null) {
          const sfName = sfMatch[1];
          const sfBody = sfMatch[2];
          const lineCoverage = {};
          const lineRegex = /<line nr="(\d+)" mi="(\d+)" ci="(\d+)" mb="(\d+)" cb="(\d+)"\/>/g;
          let lMatch;
          while ((lMatch = lineRegex.exec(sfBody)) !== null) {
            const lineNr = parseInt(lMatch[1], 10);
            const mi = parseInt(lMatch[2], 10);
            const ci = parseInt(lMatch[3], 10);
            const mb = parseInt(lMatch[4], 10);
            const cb = parseInt(lMatch[5], 10);
            if (mb > 0 && cb > 0) {
              lineCoverage[lineNr] = 'partial';
            } else if (ci > 0 && mi === 0) {
              lineCoverage[lineNr] = 'covered';
            } else if (ci === 0 && mi > 0) {
              lineCoverage[lineNr] = 'uncovered';
            } else if (ci > 0 && mi > 0) {
              lineCoverage[lineNr] = 'partial';
            }
          }
          xmlLinesByPackageSource.set(`${pkgName}/${sfName}`, lineCoverage);
        }
      }
    } catch (e) {
      console.warn('⚠️ Could not parse jacoco.xml line details:', e.message);
    }
  }

  // GROUP,PACKAGE,CLASS,INSTRUCTION_MISSED,INSTRUCTION_COVERED,BRANCH_MISSED,BRANCH_COVERED,LINE_MISSED,LINE_COVERED,COMPLEXITY_MISSED,COMPLEXITY_COVERED,METHOD_MISSED,METHOD_COVERED
  const packagesMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    if (row.length < 13) continue;

    const group = row[0];
    const pkgName = row[1];
    const className = row[2];
    const im = parseInt(row[3], 10) || 0;
    const ic = parseInt(row[4], 10) || 0;
    const bm = parseInt(row[5], 10) || 0;
    const bc = parseInt(row[6], 10) || 0;
    const lm = parseInt(row[7], 10) || 0;
    const lc = parseInt(row[8], 10) || 0;
    const cxm = parseInt(row[9], 10) || 0;
    const cxc = parseInt(row[10], 10) || 0;
    const mm = parseInt(row[11], 10) || 0;
    const mc = parseInt(row[12], 10) || 0;

    if (!packagesMap.has(pkgName)) {
      packagesMap.set(pkgName, {
        name: pkgName,
        files: [],
        instructionCovered: 0,
        instructionMissed: 0,
        branchCovered: 0,
        branchMissed: 0,
        lineCovered: 0,
        lineMissed: 0,
        complexityCovered: 0,
        complexityMissed: 0,
        methodCovered: 0,
        methodMissed: 0,
      });
    }

    const pkg = packagesMap.get(pkgName);
    pkg.instructionCovered += ic;
    pkg.instructionMissed += im;
    pkg.branchCovered += bc;
    pkg.branchMissed += bm;
    pkg.lineCovered += lc;
    pkg.lineMissed += lm;
    pkg.complexityCovered += cxc;
    pkg.complexityMissed += cxm;
    pkg.methodCovered += mc;
    pkg.methodMissed += mm;

    // Source code resolution
    const sourceFileName = className.includes('$')
      ? className.substring(0, className.indexOf('$')) + '.java'
      : className.includes('.')
      ? className.split('.')[0] + '.java'
      : className + '.java';

    const javaSourcePath = path.join(
      ROOT_DIR,
      'apps/backend/unipost-fw/src/main/java',
      pkgName.replace(/\./g, '/'),
      sourceFileName
    );

    const lineCoverageKey = `${pkgName}/${sourceFileName}`;
    const lineCoverage = xmlLinesByPackageSource.get(lineCoverageKey) || {};

    pkg.files.push({
      name: className,
      sourceFileName,
      javaSourcePath: fs.existsSync(javaSourcePath) ? path.relative(ROOT_DIR, javaSourcePath) : null,
      instructionCovered: ic,
      instructionMissed: im,
      branchCovered: bc,
      branchMissed: bm,
      lineCovered: lc,
      lineMissed: lm,
      complexityCovered: cxc,
      complexityMissed: cxm,
      methodCovered: mc,
      methodMissed: mm,
      lineCoverage,
    });
  }

  // Aggregate module metrics
  let totalIc = 0, totalIm = 0, totalBc = 0, totalBm = 0, totalLc = 0, totalLm = 0;
  let totalMc = 0, totalMm = 0, totalCxc = 0, totalCxm = 0;
  const packages = [];

  for (const [name, pkg] of packagesMap.entries()) {
    totalIc += pkg.instructionCovered;
    totalIm += pkg.instructionMissed;
    totalBc += pkg.branchCovered;
    totalBm += pkg.branchMissed;
    totalLc += pkg.lineCovered;
    totalLm += pkg.lineMissed;
    totalMc += pkg.methodCovered;
    totalMm += pkg.methodMissed;
    totalCxc += pkg.complexityCovered;
    totalCxm += pkg.complexityMissed;
    packages.push(pkg);
  }

  return {
    id: 'backend',
    name: '@unipost/backend',
    type: 'java',
    engine: 'JaCoCo 0.8.12',
    instructionCovered: totalIc,
    instructionMissed: totalIm,
    branchCovered: totalBc,
    branchMissed: totalBm,
    lineCovered: totalLc,
    lineMissed: totalLm,
    methodCovered: totalMc,
    methodMissed: totalMm,
    complexityCovered: totalCxc,
    complexityMissed: totalCxm,
    classCount: lines.length - 1,
    packages,
  };
}

// ==========================================
// 2. Parse Vitest / Istanbul JSON Reports
// ==========================================
function parseVitestModule(moduleId, moduleName, coverageJsonRelative) {
  const fullPath = path.join(ROOT_DIR, coverageJsonRelative);
  if (!fs.existsSync(fullPath)) {
    console.warn(`ℹ️ No coverage file at ${coverageJsonRelative}`);
    return null;
  }

  console.log(`📄 Parsing Vitest Coverage: ${coverageJsonRelative}`);
  let rawJson;
  try {
    rawJson = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (e) {
    console.warn(`⚠️ Failed to parse JSON at ${fullPath}:`, e.message);
    return null;
  }

  const packagesMap = new Map();
  let totalStatementsCovered = 0, totalStatementsMissed = 0;
  let totalBranchesCovered = 0, totalBranchesMissed = 0;
  let totalLinesCovered = 0, totalLinesMissed = 0;
  let totalFunctionsCovered = 0, totalFunctionsMissed = 0;
  let fileCount = 0;

  for (const [absFilePath, fileData] of Object.entries(rawJson)) {
    fileCount++;
    const relFilePath = path.relative(ROOT_DIR, fileData.path || absFilePath).replace(/\\/g, '/');
    const dirName = path.dirname(relFilePath);
    const fileName = path.basename(relFilePath);

    // Statements
    const stmts = Object.values(fileData.s || {});
    const stmtsTotal = stmts.length;
    const stmtsCovered = stmts.filter((cnt) => cnt > 0).length;
    const stmtsMissed = stmtsTotal - stmtsCovered;

    // Branches
    let branchesTotal = 0;
    let branchesCovered = 0;
    for (const bLocs of Object.values(fileData.b || {})) {
      branchesTotal += bLocs.length;
      branchesCovered += bLocs.filter((cnt) => cnt > 0).length;
    }
    const branchesMissed = branchesTotal - branchesCovered;

    // Functions
    const fns = Object.values(fileData.f || {});
    const fnsTotal = fns.length;
    const fnsCovered = fns.filter((cnt) => cnt > 0).length;
    const fnsMissed = fnsTotal - fnsCovered;

    // Lines & Line Coverage mapping
    const lineHits = {};
    const lineBranches = {};
    if (fileData.statementMap && fileData.s) {
      for (const [id, loc] of Object.entries(fileData.statementMap)) {
        const hit = fileData.s[id] || 0;
        for (let l = loc.start.line; l <= loc.end.line; l++) {
          lineHits[l] = Math.max(lineHits[l] || 0, hit);
        }
      }
    }
    if (fileData.branchMap && fileData.b) {
      for (const [id, bDef] of Object.entries(fileData.branchMap)) {
        const bHits = fileData.b[id] || [];
        const hasAllHits = bHits.length > 0 && bHits.every((h) => h > 0);
        const hasSomeHits = bHits.some((h) => h > 0);
        const line = bDef.loc?.start?.line || bDef.line;
        if (line) {
          lineBranches[line] = hasAllHits ? 'covered' : hasSomeHits ? 'partial' : 'uncovered';
        }
      }
    }

    const linesTotal = Object.keys(lineHits).length;
    const linesCovered = Object.values(lineHits).filter((h) => h > 0).length;
    const linesMissed = linesTotal - linesCovered;

    const lineCoverage = {};
    for (const [lineStr, hit] of Object.entries(lineHits)) {
      const lineNr = parseInt(lineStr, 10);
      if (lineBranches[lineNr] === 'partial') {
        lineCoverage[lineNr] = 'partial';
      } else if (hit > 0) {
        lineCoverage[lineNr] = 'covered';
      } else {
        lineCoverage[lineNr] = 'uncovered';
      }
    }

    if (!packagesMap.has(dirName)) {
      packagesMap.set(dirName, {
        name: dirName,
        files: [],
        instructionCovered: 0, // In TS, mapped to statements
        instructionMissed: 0,
        branchCovered: 0,
        branchMissed: 0,
        lineCovered: 0,
        lineMissed: 0,
        methodCovered: 0, // mapped to functions
        methodMissed: 0,
        complexityCovered: 0,
        complexityMissed: 0,
      });
    }

    const pkg = packagesMap.get(dirName);
    pkg.instructionCovered += stmtsCovered;
    pkg.instructionMissed += stmtsMissed;
    pkg.branchCovered += branchesCovered;
    pkg.branchMissed += branchesMissed;
    pkg.lineCovered += linesCovered;
    pkg.lineMissed += linesMissed;
    pkg.methodCovered += fnsCovered;
    pkg.methodMissed += fnsMissed;

    pkg.files.push({
      name: fileName,
      sourceFileName: fileName,
      sourcePath: relFilePath,
      instructionCovered: stmtsCovered,
      instructionMissed: stmtsMissed,
      branchCovered: branchesCovered,
      branchMissed: branchesMissed,
      lineCovered: linesCovered,
      lineMissed: linesMissed,
      methodCovered: fnsCovered,
      methodMissed: fnsMissed,
      complexityCovered: fnsCovered,
      complexityMissed: fnsMissed,
      lineCoverage,
    });

    totalStatementsCovered += stmtsCovered;
    totalStatementsMissed += stmtsMissed;
    totalBranchesCovered += branchesCovered;
    totalBranchesMissed += branchesMissed;
    totalLinesCovered += linesCovered;
    totalLinesMissed += linesMissed;
    totalFunctionsCovered += fnsCovered;
    totalFunctionsMissed += fnsMissed;
  }

  const packages = Array.from(packagesMap.values());

  return {
    id: moduleId,
    name: moduleName,
    type: 'typescript',
    engine: 'Vitest v8',
    instructionCovered: totalStatementsCovered,
    instructionMissed: totalStatementsMissed,
    branchCovered: totalBranchesCovered,
    branchMissed: totalBranchesMissed,
    lineCovered: totalLinesCovered,
    lineMissed: totalLinesMissed,
    methodCovered: totalFunctionsCovered,
    methodMissed: totalFunctionsMissed,
    complexityCovered: totalFunctionsCovered,
    complexityMissed: totalFunctionsMissed,
    classCount: fileCount,
    packages,
  };
}

// Run parsers
const backendModule = parseJacocoBackend();
const consoleModule = parseVitestModule('console', '@unipost/console', 'apps/console/coverage/coverage-final.json');
const sandboxModule = parseVitestModule('sandbox', '@unipost/sandbox', 'packages/sandbox/coverage/coverage-final.json');

const modules = [backendModule, consoleModule, sandboxModule].filter(Boolean);

if (modules.length === 0) {
  console.error('❌ [Coverage Generator Error] No coverage reports found in repository!');
  console.error('Please run test coverage first:');
  console.error('  1. mvn test jacoco:report -f apps/backend/unipost-fw/pom.xml');
  console.error('  2. pnpm --filter @unipost/sandbox test:coverage');
  console.error('  3. pnpm --filter @unipost/console test:coverage');
  process.exit(1);
}

// Calculate grand monorepo aggregates
let grandIc = 0, grandIm = 0;
let grandBc = 0, grandBm = 0;
let grandLc = 0, grandLm = 0;
let grandMc = 0, grandMm = 0;
let grandClassCount = 0;

for (const mod of modules) {
  grandIc += mod.instructionCovered;
  grandIm += mod.instructionMissed;
  grandBc += mod.branchCovered;
  grandBm += mod.branchMissed;
  grandLc += mod.lineCovered;
  grandLm += mod.lineMissed;
  grandMc += mod.methodCovered;
  grandMm += mod.methodMissed;
  grandClassCount += mod.classCount;
}

const grandInstructionsTotal = grandIc + grandIm;
const grandBranchesTotal = grandBc + grandBm;
const grandLinesTotal = grandLc + grandLm;
const grandMethodsTotal = grandMc + grandMm;

const grandInstructionPct = calcPercentage(grandIc, grandInstructionsTotal);
const grandBranchPct = calcPercentage(grandBc, grandBranchesTotal);
const grandLinePct = calcPercentage(grandLc, grandLinesTotal);
const grandMethodPct = calcPercentage(grandMc, grandMethodsTotal);

console.log('\n📊 === MONOREPO COVERAGE AGGREGATE SUMMARY ===');
console.log(`Modules Audited: ${modules.length} (${modules.map((m) => m.name).join(', ')})`);
console.log(`Total Files / Classes: ${grandClassCount}`);
console.log(`Instructions / Statements: ${grandIc.toLocaleString()} / ${grandInstructionsTotal.toLocaleString()} (${grandInstructionPct}%)`);
console.log(`Branch Coverage:           ${grandBc.toLocaleString()} / ${grandBranchesTotal.toLocaleString()} (${grandBranchPct}%)`);
console.log(`Line Coverage:             ${grandLc.toLocaleString()} / ${grandLinesTotal.toLocaleString()} (${grandLinePct}%)`);
console.log(`Functions / Methods:       ${grandMc.toLocaleString()} / ${grandMethodsTotal.toLocaleString()} (${grandMethodPct}%)`);
console.log('==============================================\n');

// Optional JSON export
if (outputJson) {
  ensureDir(OUTPUT_DIR);
  const summaryPayload = {
    timestamp: new Date().toISOString(),
    metrics: {
      instructionPercentage: grandInstructionPct,
      branchPercentage: grandBranchPct,
      linePercentage: grandLinePct,
      methodPercentage: grandMethodPct,
      grandInstructionsTotal,
      grandInstructionsCovered: grandIc,
      grandBranchesTotal,
      grandBranchesCovered: grandBc,
      grandLinesTotal,
      grandLinesCovered: grandLc,
      grandMethodsTotal,
      grandMethodsCovered: grandMc,
      totalFiles: grandClassCount,
    },
    modules: modules.map((m) => ({
      id: m.id,
      name: m.name,
      engine: m.engine,
      type: m.type,
      classCount: m.classCount,
      instructionCovered: m.instructionCovered,
      instructionTotal: m.instructionCovered + m.instructionMissed,
      instructionPercentage: calcPercentage(m.instructionCovered, m.instructionCovered + m.instructionMissed),
      branchCovered: m.branchCovered,
      branchTotal: m.branchCovered + m.branchMissed,
      branchPercentage: calcPercentage(m.branchCovered, m.branchCovered + m.branchMissed),
      lineCovered: m.lineCovered,
      lineTotal: m.lineCovered + m.lineMissed,
      linePercentage: calcPercentage(m.lineCovered, m.lineCovered + m.lineMissed),
    })),
  };
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(summaryPayload, null, 2), 'utf8');
  console.log(`💾 JSON summary written to ${path.relative(ROOT_DIR, OUTPUT_JSON)}`);
}

// ==========================================
// 3. Build Interactive JaCoCo-Style HTML
// ==========================================

const reportDataJson = JSON.stringify({
  timestamp: new Date().toLocaleString(),
  isoTimestamp: new Date().toISOString(),
  grand: {
    instructionCovered: grandIc,
    instructionMissed: grandIm,
    instructionTotal: grandInstructionsTotal,
    instructionPct: grandInstructionPct,
    branchCovered: grandBc,
    branchMissed: grandBm,
    branchTotal: grandBranchesTotal,
    branchPct: grandBranchPct,
    lineCovered: grandLc,
    lineMissed: grandLm,
    lineTotal: grandLinesTotal,
    linePct: grandLinePct,
    methodCovered: grandMc,
    methodMissed: grandMm,
    methodTotal: grandMethodsTotal,
    methodPct: grandMethodPct,
    classCount: grandClassCount,
  },
  modules,
});

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unipost · JaCoCo Monorepo Code Coverage</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310b981'><path d='M12 2L2 7l10 5 10-5-10-5zm0 8.2L4.5 7 12 3.8 19.5 7 12 10.2zm0 2.8l-8-4v6l8 4 8-4v-6l-8 4z'/></svg>">
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: rgba(30, 41, 59, 0.75);
      --card-border: rgba(255, 255, 255, 0.12);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent: #38bdf8;
      --bar-red: #ef4444;
      --bar-green: #22c55e;
      --bar-yellow: #eab308;
      --border: rgba(148, 163, 184, 0.15);
      --table-hover: rgba(51, 65, 85, 0.5);
      --code-bg: #0b1120;
    }

    [data-theme="light"] {
      --bg: #f8fafc;
      --card-bg: rgba(255, 255, 255, 0.9);
      --card-border: rgba(0, 0, 0, 0.08);
      --text-main: #0f172a;
      --text-muted: #475569;
      --text-dim: #94a3b8;
      --accent: #0284c7;
      --bar-red: #dc2626;
      --bar-green: #16a34a;
      --bar-yellow: #ca8a04;
      --border: #e2e8f0;
      --table-hover: #f1f5f9;
      --code-bg: #ffffff;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      transition: background 0.2s, color 0.2s;
    }

    .container {
      max-width: 1440px;
      margin: 0 auto;
      padding: 1.5rem 2rem;
      width: 100%;
    }

    /* Top Header & Breadcrumbs */
    header {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--card-border);
      position: sticky;
      top: 0;
      z-index: 50;
      box-shadow: 0 4px 20px -2px rgba(0,0,0,0.15);
    }
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .logo-badge {
      background: linear-gradient(135deg, #0284c7, #10b981);
      color: #fff;
      font-weight: 800;
      font-size: 0.85rem;
      padding: 0.35rem 0.65rem;
      border-radius: 8px;
      letter-spacing: 0.05em;
    }
    .header-title h1 {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .header-controls {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .theme-toggle-btn {
      background: rgba(148, 163, 184, 0.15);
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 0.45rem 0.85rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s;
    }
    .theme-toggle-btn:hover {
      background: rgba(148, 163, 184, 0.25);
    }

    /* Breadcrumbs Bar */
    .breadcrumb-bar {
      margin-top: 1rem;
      padding: 0.65rem 1rem;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      flex-wrap: wrap;
    }
    .breadcrumb-item {
      color: var(--accent);
      cursor: pointer;
      font-weight: 600;
      text-decoration: none;
    }
    .breadcrumb-item:hover {
      text-decoration: underline;
    }
    .breadcrumb-separator {
      color: var(--text-dim);
    }
    .breadcrumb-active {
      color: var(--text-muted);
      font-weight: 500;
    }

    /* KPI Summary Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin: 1.5rem 0;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      position: relative;
      overflow: hidden;
    }
    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: var(--accent);
    }
    .kpi-title {
      font-size: 0.8rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .kpi-value-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
    }
    .kpi-percentage {
      font-size: 1.85rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .kpi-raw {
      font-size: 0.85rem;
      color: var(--text-dim);
    }
    .kpi-progress-bg {
      height: 6px;
      width: 100%;
      background: rgba(148, 163, 184, 0.2);
      border-radius: 999px;
      overflow: hidden;
      margin-top: 0.4rem;
    }
    .kpi-progress-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.4s ease;
    }

    /* Filters, Tabs, & Search */
    .toolbar-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .module-tabs {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .module-tab-btn {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
      transition: all 0.2s;
    }
    .module-tab-btn:hover {
      color: var(--text-main);
      background: var(--table-hover);
    }
    .module-tab-btn.active {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }

    .search-box-wrap {
      position: relative;
      min-width: 280px;
    }
    .search-input {
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 0.5rem 0.85rem 0.5rem 2.2rem;
      color: var(--text-main);
      font-size: 0.85rem;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-input:focus {
      border-color: var(--accent);
    }
    .search-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-dim);
      pointer-events: none;
    }

    /* JaCoCo Table */
    .table-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px -2px rgba(0,0,0,0.1);
    }
    .coverage-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }
    .coverage-table th {
      background: rgba(148, 163, 184, 0.08);
      padding: 0.85rem 1rem;
      font-weight: 700;
      color: var(--text-muted);
      cursor: pointer;
      user-select: none;
      border-bottom: 2px solid var(--border);
      white-space: nowrap;
    }
    .coverage-table th:hover {
      color: var(--accent);
    }
    .coverage-table th.sort-asc::after {
      content: ' ▲';
      font-size: 0.7rem;
    }
    .coverage-table th.sort-desc::after {
      content: ' ▼';
      font-size: 0.7rem;
    }
    .coverage-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
      color: var(--text-main);
    }
    .coverage-table tbody tr {
      transition: background 0.15s;
    }
    .coverage-table tbody tr:hover {
      background: var(--table-hover);
    }
    .coverage-table tfoot tr {
      background: rgba(148, 163, 184, 0.12);
      font-weight: 800;
      border-top: 2px solid var(--border);
    }

    /* JaCoCo Classical Red/Green Meter Bar */
    .jacoco-meter-cell {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      min-width: 150px;
    }
    .jacoco-meter {
      height: 12px;
      width: 110px;
      background: #e2e8f0;
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 2px;
      display: flex;
      overflow: hidden;
      flex-shrink: 0;
    }
    .bar-red {
      background: var(--bar-red);
      height: 100%;
    }
    .bar-green {
      background: var(--bar-green);
      height: 100%;
    }
    .meter-label {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.8rem;
      font-weight: 600;
      min-width: 42px;
      text-align: right;
    }

    .element-link {
      color: var(--accent);
      cursor: pointer;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      text-decoration: none;
    }
    .element-link:hover {
      text-decoration: underline;
    }

    .badge-tag {
      font-size: 0.7rem;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .badge-pass { background: rgba(34, 197, 94, 0.2); color: var(--bar-green); }
    .badge-warn { background: rgba(234, 179, 8, 0.2); color: var(--bar-yellow); }
    .badge-fail { background: rgba(239, 68, 68, 0.2); color: var(--bar-red); }

    /* Source View Modal / Slide Drawer */
    .source-viewer-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      z-index: 100;
      display: flex;
      justify-content: flex-end;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }
    .source-viewer-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }
    .source-drawer {
      width: 85vw;
      max-width: 1200px;
      height: 100vh;
      background: var(--code-bg);
      border-left: 1px solid var(--card-border);
      display: flex;
      flex-direction: column;
      box-shadow: -10px 0 30px rgba(0,0,0,0.5);
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .source-viewer-overlay.active .source-drawer {
      transform: translateX(0);
    }
    .drawer-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--card-bg);
    }
    .drawer-title {
      font-size: 1.1rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .close-btn {
      background: none;
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
    }
    .source-body {
      flex: 1;
      overflow: auto;
      padding: 1rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
      line-height: 1.5;
    }
    .source-line {
      display: flex;
      padding: 0.1rem 0;
    }
    .source-line-nr {
      width: 50px;
      user-select: none;
      color: var(--text-dim);
      text-align: right;
      padding-right: 1.25rem;
      flex-shrink: 0;
    }
    .source-line-code {
      flex: 1;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .source-line.line-covered {
      background: rgba(34, 197, 94, 0.15);
    }
    .source-line.line-partial {
      background: rgba(234, 179, 8, 0.25);
    }
    .source-line.line-uncovered {
      background: rgba(239, 68, 68, 0.2);
    }

    footer {
      margin-top: auto;
      border-top: 1px solid var(--card-border);
      padding: 1.25rem 2rem;
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-dim);
      background: var(--card-bg);
    }
  </style>
</head>
<body data-theme="dark">

  <!-- Top Sticky Header -->
  <header>
    <div class="container header-content">
      <div class="logo-area">
        <span class="logo-badge">JACOCO</span>
        <div class="header-title">
          <h1>Unipost Monorepo Code Coverage</h1>
        </div>
      </div>
      <div class="header-controls">
        <span id="gen-timestamp" style="font-size: 0.8rem; color: var(--text-dim);"></span>
        <button class="theme-toggle-btn" onclick="toggleTheme()">
          <span id="theme-icon">☀️</span> <span id="theme-text">Light Mode</span>
        </button>
      </div>
    </div>
  </header>

  <main class="container">
    <!-- Breadcrumbs Navigation -->
    <nav class="breadcrumb-bar" id="breadcrumb-container">
      <!-- Injected dynamically -->
    </nav>

    <!-- Top KPI Dashboard Cards -->
    <section class="kpi-grid" id="kpi-container">
      <!-- Injected dynamically -->
    </section>

    <!-- Toolbar: Module Tabs & Search Input -->
    <div class="toolbar-container">
      <div class="module-tabs" id="module-tabs">
        <!-- Injected dynamically -->
      </div>
      <div class="search-box-wrap">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="text" id="search-input" class="search-input" placeholder="Filter packages, classes, files..." oninput="handleSearch(this.value)">
      </div>
    </div>

    <!-- JaCoCo Interactive Data Table -->
    <div class="table-card">
      <table class="coverage-table" id="coverage-table">
        <thead>
          <tr id="table-header-row">
            <!-- Headers injected dynamically based on current level -->
          </tr>
        </thead>
        <tbody id="table-body">
          <!-- Rows injected dynamically -->
        </tbody>
        <tfoot id="table-footer">
          <!-- Footer aggregate injected dynamically -->
        </tfoot>
      </table>
    </div>
  </main>

  <!-- Source Code Inspector Drawer -->
  <div class="source-viewer-overlay" id="source-overlay" onclick="closeSourceViewer(event)">
    <div class="source-drawer" onclick="event.stopPropagation()">
      <div class="drawer-header">
        <div class="drawer-title">
          <span>📄</span>
          <span id="drawer-file-name">source-file.ts</span>
          <span id="drawer-coverage-badge" class="badge-tag"></span>
        </div>
        <button class="close-btn" onclick="closeSourceViewer()">Close ✕</button>
      </div>
      <div class="source-body" id="source-code-content">
        <!-- Lines injected dynamically -->
      </div>
    </div>
  </div>

  <footer>
    <p>Generated with Universal Monorepo JaCoCo Generator · Enterprise Testing & Coverage Platform · Built for Unipost</p>
  </footer>

  <script>
    // Embedded Monorepo Coverage State
    const REPORT_DATA = ${reportDataJson};

    // Navigation state:
    // level: 'root' | 'module' | 'package' | 'file'
    let state = {
      level: 'root',
      activeModuleId: 'all',
      activePackageName: null,
      activeFileName: null,
      searchQuery: '',
      sortColumn: 'element',
      sortDirection: 'asc'
    };

    function toggleTheme() {
      const current = document.body.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', next);
      document.getElementById('theme-icon').textContent = next === 'dark' ? '☀️' : '🌙';
      document.getElementById('theme-text').textContent = next === 'dark' ? 'Light Mode' : 'Dark Mode';
    }

    function renderBreadcrumbs() {
      const container = document.getElementById('breadcrumb-container');
      const parts = [];

      parts.push(\`<span class="breadcrumb-item" onclick="navigateRoot()">unipost (monorepo)</span>\`);

      if (state.activeModuleId !== 'all') {
        const mod = REPORT_DATA.modules.find(m => m.id === state.activeModuleId);
        const name = mod ? mod.name : state.activeModuleId;
        if (state.level === 'module') {
          parts.push(\`<span class="breadcrumb-separator">›</span>\`);
          parts.push(\`<span class="breadcrumb-active">\${name}</span>\`);
        } else {
          parts.push(\`<span class="breadcrumb-separator">›</span>\`);
          parts.push(\`<span class="breadcrumb-item" onclick="navigateToModule('\${state.activeModuleId}')">\${name}</span>\`);
        }
      }

      if (state.activePackageName) {
        if (state.level === 'package') {
          parts.push(\`<span class="breadcrumb-separator">›</span>\`);
          parts.push(\`<span class="breadcrumb-active">\${state.activePackageName}</span>\`);
        } else {
          parts.push(\`<span class="breadcrumb-separator">›</span>\`);
          parts.push(\`<span class="breadcrumb-item" onclick="navigateToPackage('\${state.activePackageName}')">\${state.activePackageName}</span>\`);
        }
      }

      if (state.activeFileName) {
        parts.push(\`<span class="breadcrumb-separator">›</span>\`);
        parts.push(\`<span class="breadcrumb-active">\${state.activeFileName}</span>\`);
      }

      container.innerHTML = parts.join(' ');
    }

    function getActiveMetrics() {
      if (state.activeModuleId === 'all') {
        return REPORT_DATA.grand;
      }
      const mod = REPORT_DATA.modules.find(m => m.id === state.activeModuleId);
      if (!mod) return REPORT_DATA.grand;

      const totalInst = mod.instructionCovered + mod.instructionMissed;
      const totalBranch = mod.branchCovered + mod.branchMissed;
      const totalLine = mod.lineCovered + mod.lineMissed;
      const totalMethod = mod.methodCovered + mod.methodMissed;

      return {
        instructionCovered: mod.instructionCovered,
        instructionMissed: mod.instructionMissed,
        instructionTotal: totalInst,
        instructionPct: totalInst > 0 ? Math.round((mod.instructionCovered / totalInst) * 1000) / 10 : 100,
        branchCovered: mod.branchCovered,
        branchMissed: mod.branchMissed,
        branchTotal: totalBranch,
        branchPct: totalBranch > 0 ? Math.round((mod.branchCovered / totalBranch) * 1000) / 10 : 100,
        lineCovered: mod.lineCovered,
        lineMissed: mod.lineMissed,
        lineTotal: totalLine,
        linePct: totalLine > 0 ? Math.round((mod.lineCovered / totalLine) * 1000) / 10 : 100,
        methodCovered: mod.methodCovered,
        methodMissed: mod.methodMissed,
        methodTotal: totalMethod,
        methodPct: totalMethod > 0 ? Math.round((mod.methodCovered / totalMethod) * 1000) / 10 : 100,
        classCount: mod.classCount
      };
    }

    function renderKpis() {
      const container = document.getElementById('kpi-container');
      const m = getActiveMetrics();

      const getBarColor = (pct) => pct >= 90 ? 'var(--bar-green)' : pct >= 70 ? 'var(--bar-yellow)' : 'var(--bar-red)';

      container.innerHTML = \`
        <div class="kpi-card">
          <div class="kpi-title">Instructions / Statements</div>
          <div class="kpi-value-row">
            <span class="kpi-percentage" style="color: \${getBarColor(m.instructionPct)}">\${m.instructionPct}%</span>
            <span class="kpi-raw">\${m.instructionCovered.toLocaleString()} / \${m.instructionTotal.toLocaleString()}</span>
          </div>
          <div class="kpi-progress-bg">
            <div class="kpi-progress-fill" style="width: \${m.instructionPct}%; background: \${getBarColor(m.instructionPct)}"></div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">Branches</div>
          <div class="kpi-value-row">
            <span class="kpi-percentage" style="color: \${getBarColor(m.branchPct)}">\${m.branchPct}%</span>
            <span class="kpi-raw">\${m.branchCovered.toLocaleString()} / \${m.branchTotal.toLocaleString()}</span>
          </div>
          <div class="kpi-progress-bg">
            <div class="kpi-progress-fill" style="width: \${m.branchPct}%; background: \${getBarColor(m.branchPct)}"></div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">Line Coverage</div>
          <div class="kpi-value-row">
            <span class="kpi-percentage" style="color: \${getBarColor(m.linePct)}">\${m.linePct}%</span>
            <span class="kpi-raw">\${m.lineCovered.toLocaleString()} / \${m.lineTotal.toLocaleString()}</span>
          </div>
          <div class="kpi-progress-bg">
            <div class="kpi-progress-fill" style="width: \${m.linePct}%; background: \${getBarColor(m.linePct)}"></div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">Functions / Methods</div>
          <div class="kpi-value-row">
            <span class="kpi-percentage" style="color: \${getBarColor(m.methodPct)}">\${m.methodPct}%</span>
            <span class="kpi-raw">\${m.methodCovered.toLocaleString()} / \${m.methodTotal.toLocaleString()}</span>
          </div>
          <div class="kpi-progress-bg">
            <div class="kpi-progress-fill" style="width: \${m.methodPct}%; background: \${getBarColor(m.methodPct)}"></div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">Total Files Audited</div>
          <div class="kpi-value-row">
            <span class="kpi-percentage" style="color: var(--accent)">\${m.classCount}</span>
            <span class="kpi-raw">\${state.activeModuleId === 'all' ? 'All Monorepo Packages' : 'Active Module'}</span>
          </div>
          <div class="kpi-progress-bg">
            <div class="kpi-progress-fill" style="width: 100%; background: var(--accent)"></div>
          </div>
        </div>
      \`;
    }

    function renderModuleTabs() {
      const container = document.getElementById('module-tabs');
      const tabs = [
        { id: 'all', label: 'All Monorepo' },
        ...REPORT_DATA.modules.map(m => ({ id: m.id, label: m.name }))
      ];

      container.innerHTML = tabs.map(t => \`
        <button class="module-tab-btn \${state.activeModuleId === t.id ? 'active' : ''}" onclick="switchModuleTab('\${t.id}')">
          \${t.label}
        </button>
      \`).join('');
    }

    function switchModuleTab(modId) {
      state.activeModuleId = modId;
      state.activePackageName = null;
      state.activeFileName = null;
      state.level = modId === 'all' ? 'root' : 'module';
      renderView();
    }

    function navigateRoot() {
      state.level = 'root';
      state.activeModuleId = 'all';
      state.activePackageName = null;
      state.activeFileName = null;
      renderView();
    }

    function navigateToModule(modId) {
      state.level = 'module';
      state.activeModuleId = modId;
      state.activePackageName = null;
      state.activeFileName = null;
      renderView();
    }

    function navigateToPackage(pkgName) {
      state.level = 'package';
      state.activePackageName = pkgName;
      state.activeFileName = null;
      renderView();
    }

    function renderTableHeaders() {
      const thead = document.getElementById('table-header-row');
      const cols = [
        { id: 'element', label: 'Element' },
        { id: 'instructions', label: 'Missed Instructions / Stmts' },
        { id: 'instCov', label: 'Cov.' },
        { id: 'branches', label: 'Missed Branches' },
        { id: 'branchCov', label: 'Cov.' },
        { id: 'linesMissed', label: 'Missed Lines' },
        { id: 'linesTotal', label: 'Total Lines' },
        { id: 'methodsMissed', label: 'Missed Methods' },
        { id: 'methodsTotal', label: 'Total Methods' },
        { id: 'classesMissed', label: 'Files / Classes' },
      ];

      thead.innerHTML = cols.map(c => {
        let sortClass = '';
        if (state.sortColumn === c.id) {
          sortClass = state.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc';
        }
        return \`<th class="\${sortClass}" onclick="handleSort('\${c.id}')">\${c.label}</th>\`;
      }).join('');
    }

    function handleSort(colId) {
      if (state.sortColumn === colId) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortColumn = colId;
        state.sortDirection = 'desc';
      }
      renderTableRows();
    }

    function handleSearch(q) {
      state.searchQuery = q.toLowerCase();
      renderTableRows();
    }

    function getTableRowsData() {
      let rows = [];

      if (state.level === 'root') {
        // Monorepo level: show all modules
        rows = REPORT_DATA.modules.map(mod => {
          const ic = mod.instructionCovered;
          const im = mod.instructionMissed;
          const bc = mod.branchCovered;
          const bm = mod.branchMissed;
          const lc = mod.lineCovered;
          const lm = mod.lineMissed;
          const mc = mod.methodCovered;
          const mm = mod.methodMissed;
          return {
            element: mod.name,
            type: 'module',
            id: mod.id,
            im, ic, it: ic + im, ipct: calcPercentage(ic, ic + im),
            bm, bc, bt: bc + bm, bpct: calcPercentage(bc, bc + bm),
            lm, lc, lt: lc + lm, lpct: calcPercentage(lc, lc + lm),
            mm, mc, mt: mc + mm,
            classes: mod.classCount
          };
        });
      } else if (state.level === 'module') {
        // Module level: show packages inside this module
        const mod = REPORT_DATA.modules.find(m => m.id === state.activeModuleId);
        if (mod && mod.packages) {
          rows = mod.packages.map(pkg => {
            const ic = pkg.instructionCovered;
            const im = pkg.instructionMissed;
            const bc = pkg.branchCovered;
            const bm = pkg.branchMissed;
            const lc = pkg.lineCovered;
            const lm = pkg.lineMissed;
            const mc = pkg.methodCovered;
            const mm = pkg.methodMissed;
            return {
              element: pkg.name,
              type: 'package',
              name: pkg.name,
              moduleId: mod.id,
              im, ic, it: ic + im, ipct: calcPercentage(ic, ic + im),
              bm, bc, bt: bc + bm, bpct: calcPercentage(bc, bc + bm),
              lm, lc, lt: lc + lm, lpct: calcPercentage(lc, lc + lm),
              mm, mc, mt: mc + mm,
              classes: pkg.files.length
            };
          });
        }
      } else if (state.level === 'package') {
        // Package level: show files inside this package
        const mod = REPORT_DATA.modules.find(m => m.id === state.activeModuleId);
        if (mod) {
          const pkg = mod.packages.find(p => p.name === state.activePackageName);
          if (pkg && pkg.files) {
            rows = pkg.files.map(f => {
              const ic = f.instructionCovered;
              const im = f.instructionMissed;
              const bc = f.branchCovered;
              const bm = f.branchMissed;
              const lc = f.lineCovered;
              const lm = f.lineMissed;
              const mc = f.methodCovered;
              const mm = f.methodMissed;
              return {
                element: f.name,
                type: 'file',
                fileData: f,
                im, ic, it: ic + im, ipct: calcPercentage(ic, ic + im),
                bm, bc, bt: bc + bm, bpct: calcPercentage(bc, bc + bm),
                lm, lc, lt: lc + lm, lpct: calcPercentage(lc, lc + lm),
                mm, mc, mt: mc + mm,
                classes: 1
              };
            });
          }
        }
      }

      // Filter by search
      if (state.searchQuery) {
        rows = rows.filter(r => r.element.toLowerCase().includes(state.searchQuery));
      }

      // Sort rows
      rows.sort((a, b) => {
        let valA, valB;
        switch (state.sortColumn) {
          case 'element':
            valA = a.element.toLowerCase();
            valB = b.element.toLowerCase();
            return state.sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          case 'instructions':
            valA = a.im; valB = b.im; break;
          case 'instCov':
            valA = a.ipct; valB = b.ipct; break;
          case 'branches':
            valA = a.bm; valB = b.bm; break;
          case 'branchCov':
            valA = a.bpct; valB = b.bpct; break;
          case 'linesMissed':
            valA = a.lm; valB = b.lm; break;
          case 'linesTotal':
            valA = a.lt; valB = b.lt; break;
          case 'methodsMissed':
            valA = a.mm; valB = b.mm; break;
          case 'methodsTotal':
            valA = a.mt; valB = b.mt; break;
          case 'classesMissed':
            valA = a.classes; valB = b.classes; break;
          default:
            valA = a.ipct; valB = b.ipct;
        }
        return state.sortDirection === 'asc' ? valA - valB : valB - valA;
      });

      return rows;
    }

    function renderTableRows() {
      const tbody = document.getElementById('table-body');
      const rows = getTableRowsData();

      if (rows.length === 0) {
        tbody.innerHTML = \`<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-dim);">No elements match current filter.</td></tr>\`;
        renderTableFooter([]);
        return;
      }

      tbody.innerHTML = rows.map(r => {
        let elementCell = '';
        if (r.type === 'module') {
          elementCell = \`<a class="element-link" onclick="navigateToModule('\${r.id}')">📦 \${r.element}</a>\`;
        } else if (r.type === 'package') {
          elementCell = \`<a class="element-link" onclick="navigateToPackage('\${r.name}')">📁 \${r.element}</a>\`;
        } else {
          elementCell = \`<a class="element-link" onclick="openFileViewer('\${r.element}')">📄 \${r.element}</a>\`;
        }

        // JaCoCo Meters
        const instBarRed = r.it > 0 ? (r.im / r.it) * 100 : 0;
        const instBarGreen = r.it > 0 ? (r.ic / r.it) * 100 : 100;
        const branchBarRed = r.bt > 0 ? (r.bm / r.bt) * 100 : 0;
        const branchBarGreen = r.bt > 0 ? (r.bc / r.bt) * 100 : 100;

        return \`
          <tr>
            <td>\${elementCell}</td>
            <td>
              <div class="jacoco-meter-cell">
                <div class="jacoco-meter" title="Missed: \${r.im.toLocaleString()}, Covered: \${r.ic.toLocaleString()}">
                  <div class="bar-red" style="width: \${instBarRed}%"></div>
                  <div class="bar-green" style="width: \${instBarGreen}%"></div>
                </div>
                <span class="meter-label">\${r.im.toLocaleString()} of \${r.it.toLocaleString()}</span>
              </div>
            </td>
            <td><strong>\${r.ipct}%</strong></td>
            <td>
              <div class="jacoco-meter-cell">
                <div class="jacoco-meter" title="Missed: \${r.bm.toLocaleString()}, Covered: \${r.bc.toLocaleString()}">
                  <div class="bar-red" style="width: \${branchBarRed}%"></div>
                  <div class="bar-green" style="width: \${branchBarGreen}%"></div>
                </div>
                <span class="meter-label">\${r.bm.toLocaleString()} of \${r.bt.toLocaleString()}</span>
              </div>
            </td>
            <td><strong>\${r.bpct}%</strong></td>
            <td>\${r.lm.toLocaleString()}</td>
            <td>\${r.lt.toLocaleString()}</td>
            <td>\${r.mm.toLocaleString()}</td>
            <td>\${r.mt.toLocaleString()}</td>
            <td>\${r.classes.toLocaleString()}</td>
          </tr>
        \`;
      }).join('');

      renderTableFooter(rows);
    }

    function renderTableFooter(rows) {
      const tfoot = document.getElementById('table-footer');
      if (!rows || rows.length === 0) {
        tfoot.innerHTML = '';
        return;
      }

      let sumIm = 0, sumIc = 0;
      let sumBm = 0, sumBc = 0;
      let sumLm = 0, sumLt = 0;
      let sumMm = 0, sumMt = 0;
      let sumClasses = 0;

      for (const r of rows) {
        sumIm += r.im; sumIc += r.ic;
        sumBm += r.bm; sumBc += r.bc;
        sumLm += r.lm; sumLt += r.lt;
        sumMm += r.mm; sumMt += r.mt;
        sumClasses += r.classes;
      }

      const sumIt = sumIc + sumIm;
      const sumBt = sumBc + sumBm;
      const sumIpct = calcPercentage(sumIc, sumIt);
      const sumBpct = calcPercentage(sumBc, sumBt);

      const instBarRed = sumIt > 0 ? (sumIm / sumIt) * 100 : 0;
      const instBarGreen = sumIt > 0 ? (sumIc / sumIt) * 100 : 100;
      const branchBarRed = sumBt > 0 ? (sumBm / sumBt) * 100 : 0;
      const branchBarGreen = sumBt > 0 ? (sumBc / sumBt) * 100 : 100;

      tfoot.innerHTML = \`
        <tr>
          <td>Total</td>
          <td>
            <div class="jacoco-meter-cell">
              <div class="jacoco-meter">
                <div class="bar-red" style="width: \${instBarRed}%"></div>
                <div class="bar-green" style="width: \${instBarGreen}%"></div>
              </div>
              <span class="meter-label">\${sumIm.toLocaleString()} of \${sumIt.toLocaleString()}</span>
            </div>
          </td>
          <td><strong>\${sumIpct}%</strong></td>
          <td>
            <div class="jacoco-meter-cell">
              <div class="jacoco-meter">
                <div class="bar-red" style="width: \${branchBarRed}%"></div>
                <div class="bar-green" style="width: \${branchBarGreen}%"></div>
              </div>
              <span class="meter-label">\${sumBm.toLocaleString()} of \${sumBt.toLocaleString()}</span>
            </div>
          </td>
          <td><strong>\${sumBpct}%</strong></td>
          <td>\${sumLm.toLocaleString()}</td>
          <td>\${sumLt.toLocaleString()}</td>
          <td>\${sumMm.toLocaleString()}</td>
          <td>\${sumMt.toLocaleString()}</td>
          <td>\${sumClasses.toLocaleString()}</td>
        </tr>
      \`;
    }

    function openFileViewer(fileName) {
      const mod = REPORT_DATA.modules.find(m => m.id === state.activeModuleId);
      if (!mod) return;
      const pkg = mod.packages.find(p => p.name === state.activePackageName);
      if (!pkg) return;
      const file = pkg.files.find(f => f.name === fileName);
      if (!file) return;

      document.getElementById('drawer-file-name').textContent = file.name;
      const pct = calcPercentage(file.lineCovered, file.lineCovered + file.lineMissed);
      const badge = document.getElementById('drawer-coverage-badge');
      badge.textContent = \`\${pct}% Line Coverage (\${file.lineCovered} / \${file.lineCovered + file.lineMissed})\`;
      badge.className = \`badge-tag \${pct >= 90 ? 'badge-pass' : pct >= 70 ? 'badge-warn' : 'badge-fail'}\`;

      // Build simulated or annotated code lines
      const container = document.getElementById('source-code-content');
      const lines = [];
      const totalLines = file.lineCovered + file.lineMissed;
      const sampleCount = Math.max(totalLines, 30);

      for (let i = 1; i <= sampleCount; i++) {
        let status = 'none';
        if (file.lineCoverage && file.lineCoverage[i]) {
          status = file.lineCoverage[i];
        } else if (i <= file.lineCovered) {
          status = 'covered';
        } else if (i <= totalLines) {
          status = 'uncovered';
        }

        const statusClass = status === 'covered' ? 'line-covered' : status === 'partial' ? 'line-partial' : status === 'uncovered' ? 'line-uncovered' : '';
        lines.push(\`
          <div class="source-line \${statusClass}">
            <span class="source-line-nr">\${i}</span>
            <span class="source-line-code">// Line \${i} coverage marker [\${status.toUpperCase()}]</span>
          </div>
        \`);
      }

      container.innerHTML = lines.join('');
      document.getElementById('source-overlay').classList.add('active');
    }

    function closeSourceViewer(e) {
      document.getElementById('source-overlay').classList.remove('active');
    }

    function renderView() {
      renderBreadcrumbs();
      renderKpis();
      renderModuleTabs();
      renderTableHeaders();
      renderTableRows();
    }

    // Init
    document.getElementById('gen-timestamp').textContent = 'Generated: ' + REPORT_DATA.timestamp;
    renderView();
  </script>
</body>
</html>
`;

ensureDir(OUTPUT_DIR);
fs.writeFileSync(OUTPUT_HTML, htmlContent, 'utf8');

console.log(`\n🎉 [Coverage Generator Success] Interactive JaCoCo-style report created:`);
console.log(`📍 File: ${OUTPUT_HTML}`);
console.log(`🔗 Browser Link: file://${OUTPUT_HTML.replace(/\\/g, '/')}\n`);

// Open in browser if requested
if (shouldOpen) {
  console.log('🌐 Opening coverage dashboard in default browser...');
  const openCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  try {
    if (process.platform === 'win32') {
      execSync(`start "" "${OUTPUT_HTML}"`);
    } else {
      execSync(`${openCmd} "${OUTPUT_HTML}"`);
    }
  } catch (err) {
    console.warn('⚠️ Could not automatically launch browser:', err.message);
  }
}
