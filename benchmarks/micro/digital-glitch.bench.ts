import { run, bench, group } from "mitata";

group("Digital Glitch Frame Generation", () => {
  const totalFrames = 10000;

  // Setup blocks exactly like the code does currently
  interface GlitchBlock {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    frame: number;
  }
  const blocks: GlitchBlock[] = [];
  const width = 1920;
  const height = 1080;

  // block_datamosh
  const colors = [
    "rgba(255,0,255,0.8)",
    "rgba(0,255,255,0.8)",
    "rgba(255,255,0,0.8)",
  ];
  for (let i = 0; i < totalFrames; i++) {
    if (Math.random() < 0.15) {
      const numBlocks = Math.floor(Math.random() * 10) + 5;
      for (let j = 0; j < numBlocks; j++) {
        blocks.push({
          x: Math.random() * width,
          y: Math.random() * height,
          w: Math.random() * 300 + 50,
          h: Math.random() * 100 + 20,
          color: colors[Math.floor(Math.random() * colors.length)],
          frame: i,
        });
      }
    }
  }

  // Current approach: Array.filter in a loop over frames
  bench("O(N*M) - Array.filter (Current)", () => {
    let matches = 0;
    for (let frame = 0; frame < totalFrames; frame++) {
      const currentBlocks = blocks.filter((b) => b.frame === frame);
      matches += currentBlocks.length;
    }
  });

  // Setup pre-grouped Map
  const blocksByFrame = new Map<number, GlitchBlock[]>();
  for (const b of blocks) {
    if (!blocksByFrame.has(b.frame)) {
      blocksByFrame.set(b.frame, []);
    }
    blocksByFrame.get(b.frame)!.push(b);
  }

  // O(1) optimized approach
  bench("O(1) - Map Lookup (Optimized)", () => {
    let matches = 0;
    for (let frame = 0; frame < totalFrames; frame++) {
      const currentBlocks = blocksByFrame.get(frame) || [];
      matches += currentBlocks.length;
    }
  });
});

if (import.meta.main) {
  run();
}
