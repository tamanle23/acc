import { run } from 'mitata';

console.log('=====================================================');
console.log('⚡ ACC Microbenchmarks Suite (mitata)');
console.log('=====================================================\n');

// Import all microbenchmark modules to register their benchmarks with mitata
await import('./ffi-dsp.bench');
await import('./ir-adaptation.bench');
await import('./canvas-overlay.bench');
await import('./model-registry.bench');
await import('./ffmpeg-ffi.bench');

await run();
