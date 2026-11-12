#!/usr/bin/env node
const { spawnSync, execSync } = require('node:child_process');
const path = require('node:path');

const isWin = process.platform === 'win32';
const scriptName = isWin ? 'mvnw.cmd' : 'mvnw';
const scriptPath = path.resolve(__dirname, scriptName);
const args = process.argv.slice(2);

// Auto-detect JAVA_HOME if omitted by environment or Turborepo
if (!process.env.JAVA_HOME) {
  try {
    const lookupCmd = isWin ? 'where.exe java' : 'which java';
    const rawOut = execSync(lookupCmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const firstLine = rawOut.split(/\r?\n/)[0];
    if (firstLine) {
      // First line is e.g. <JAVA_HOME>/bin/java.exe
      process.env.JAVA_HOME = path.dirname(path.dirname(firstLine));
    }
  } catch {
    // If lookup fails, let mvnw report its own environment error
  }
}

if (isWin) {
  // On Windows, passing args through spawnSync with cmd.exe causes cmd.exe to split arguments on spaces/dots.
  // Use spawnSync with cmd.exe /s /c and quoted command string.
  const escapedArgs = args.map(arg => {
    if (arg.includes(' ') || arg.includes('"')) {
      return `"${arg.replace(/"/g, '\"')}"`;
    }
    return arg;
  }).join(' ');

  const result = spawnSync('cmd.exe', ['/s', '/c', `"${scriptPath}" ${escapedArgs}`], {
    stdio: 'inherit',
    windowsVerbatimArguments: true,
    cwd: __dirname,
    env: process.env,
  });
  process.exit(result.status ?? 0);
} else {
  const result = spawnSync(scriptPath, args, {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env,
  });
  process.exit(result.status ?? 0);
}
