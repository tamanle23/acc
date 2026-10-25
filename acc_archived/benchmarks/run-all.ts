import { spawn } from 'child_process';
import path from 'path';

async function runStep(title: string, scriptPath: string, args: string[] = []): Promise<void> {
  console.log('\n=====================================================');
  console.log(`🚀 RUNNING BENCHMARK SUITE: ${title}`);
  console.log(`Script: ${scriptPath}`);
  console.log('=====================================================\n');

  const proc = spawn('bun', ['run', scriptPath, ...args], {
    stdio: 'inherit',
  });

  await new Promise<void>((resolve, reject) => {
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Benchmark '${title}' failed with exit code ${code}`));
    });
  });
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const runMicro = rawArgs.length === 0 || rawArgs.includes('--micro') || rawArgs.includes('-m');
  const runHttp = rawArgs.length === 0 || rawArgs.includes('--http') || rawArgs.includes('-h');
  const runCli = rawArgs.length === 0 || rawArgs.includes('--cli') || rawArgs.includes('-c');

  console.log('=====================================================');
  console.log('🔥 ACC UNIFIED BENCHMARKING SUITE');
  console.log('   1. Microbenchmarks (mitata)');
  console.log('   2. HTTP Webhook Load Testing (oha)');
  console.log('   3. Macro CLI Execution Timing (hyperfine)');
  console.log('=====================================================');

  try {
    if (runMicro) {
      await runStep('1. Microbenchmarks (mitata)', path.join(__dirname, 'micro', 'runner.ts'));
    }

    if (runHttp) {
      await runStep('2. HTTP Webhook Load Testing (oha)', path.join(__dirname, 'http', 'load-test-webhook.ts'));
    }

    if (runCli) {
      await runStep('3. Macro CLI Benchmarks (hyperfine)', path.join(__dirname, 'cli', 'benchmark-cli.ts'));
    }

    console.log('\n🎉 ALL BENCHMARKS COMPLETED SUCCESSFULLY!');
  } catch (err: any) {
    console.error('\n❌ Benchmark Suite Error:', err.message);
    process.exit(1);
  }
}

main();
