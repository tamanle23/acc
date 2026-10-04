import { BaseEffectEngine } from "@acc/core";
import { NapiRsCanvasAdapter } from "../canvas-strategies/napi-rs";
import { CanvasAdapter } from "../canvas-strategies/base";
export class DigitalGlitchEffect extends BaseEffectEngine {
  async renderAndPipe(outputPath: string): Promise<void> {
    let adapter: CanvasAdapter;
    if ("napi-rs" === "napi-rs") {
      adapter = new NapiRsCanvasAdapter();
    } else {
      throw new Error(`Canvas engine ${"napi-rs"} not supported yet.`);
    }
    const canvas = adapter.createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");
    const totalFrames = Math.ceil(this.fps * this.duration);
    const { stream, promise } = this.initStream(outputPath);
    // Glitches are random discontinuous events. We can pre-generate them.
    interface GlitchBlock {
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      frame: number;
    }
    const blocks: GlitchBlock[] = [];
    if (this.variantName === "block_datamosh") {
      // Large moshing blocks
      const colors = [
        "rgba(255,0,255,0.8)",
        "rgba(0,255,255,0.8)",
        "rgba(255,255,0,0.8)",
      ];
      for (let i = 0; i < totalFrames; i++) {
        // Glitch only 15% of the time
        if (Math.random() < 0.15) {
          const numBlocks = Math.floor(Math.random() * 10) + 5;
          for (let j = 0; j < numBlocks; j++) {
            blocks.push({
              x: Math.random() * this.width,
              y: Math.random() * this.height,
              w: Math.random() * 300 + 50,
              h: Math.random() * 100 + 20,
              color: colors[Math.floor(Math.random() * colors.length)],
              frame: i,
            });
          }
        }
      }
    } else {
      // rgb_shake
      for (let i = 0; i < totalFrames; i++) {
        // Glitch 10% of the time
        if (Math.random() < 0.1) {
          blocks.push({
            x: (Math.random() - 0.5) * 50,
            y: (Math.random() - 0.5) * 50,
            w: 0,
            h: 0,
            color: "shake",
            frame: i,
          });
        }
      }
    }
    // ⚡ Performance Tuning: Pre-group blocks by frame to convert O(N*M) lookup into O(1) Map lookup
    const blocksByFrame = new Map<number, GlitchBlock[]>();
    for (const b of blocks) {
      const frameBlocks = blocksByFrame.get(b.frame);
      if (frameBlocks) {
        frameBlocks.push(b);
      } else {
        blocksByFrame.set(b.frame, [b]);
      }
    }

    process.stdout.write(
      `Rendering ${totalFrames} frames for Digital Glitch (${this.variantName}): `,
    );
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) process.stdout.write(".");
      if (this.pipelineConfig.background === "transparent") {
        ctx.clearRect(0, 0, this.width, this.height);
      } else {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, this.width, this.height);
      }
      ctx.globalCompositeOperation = "screen";
      if (this.variantName === "block_datamosh") {
        const currentBlocks = blocksByFrame.get(frame) || [];
        for (const b of currentBlocks) {
          ctx.fillStyle = b.color;
          ctx.fillRect(b.x, b.y, b.w, b.h);
        }
      } else {
        // rgb_shake
        const shakeList = blocksByFrame.get(frame);
        const shake =
          shakeList && shakeList.length > 0 ? shakeList[0] : undefined;
        if (shake) {
          // Draw aggressive full-screen RGB separation overlays
          ctx.fillStyle = "rgba(255, 0, 0, 0.4)";
          ctx.fillRect(shake.x, shake.y, this.width, this.height);
          ctx.fillStyle = "rgba(0, 255, 255, 0.4)";
          ctx.fillRect(-shake.x, -shake.y, this.width, this.height);
          // Draw some horizontal slice displacement bars
          for (let i = 0; i < 5; i++) {
            const sy = Math.random() * this.height;
            const sh = Math.random() * 100 + 10;
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.fillRect(0, sy, this.width, sh);
          }
        }
      }
      const buffer = canvas.toBuffer("raw");
      stream.write(buffer);
    }
    process.stdout.write(" Done!\n");
    stream.end();
    await promise;
  }
}
