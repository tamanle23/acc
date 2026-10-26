import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { Logger } from "@acc/core";
import { BaseEffectEngine } from '@acc/core';
export class LeavesEffect extends BaseEffectEngine {
  async renderAndPipe(outputPath: string): Promise<void> {
    
    const canvas = UniversalCanvasProvider.createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    const totalFrames = Math.ceil(this.fps * this.duration);
    const { stream, promise } = this.initStream(outputPath);
    let leafCount = 100;
    let baseSpeedY = this.height * 0.3; // Fall down
    let baseSpeedX = this.width * 0.2;  // Drift right
    let sizeMultiplier = 1;
    let colors = ['220, 100, 50', '255, 150, 20', '200, 50, 20']; // Autumn
    switch (this.variantName) {
      case 'autumn_breeze':
        leafCount = 120;
        baseSpeedY = this.height * 0.2;
        baseSpeedX = this.width * 0.5; // Strong breeze
        sizeMultiplier = 1.0;
        break;
      case 'sakura_petals':
        leafCount = 300;
        baseSpeedY = this.height * 0.15;
        baseSpeedX = this.width * 0.1; // Gentle
        sizeMultiplier = 0.4;
        colors = ['255, 180, 200', '255, 200, 220', '255, 150, 180']; // Pinks
        break;
      default:
        Logger.warn('OverlayGenerator', `Variant '${this.variantName}' not recognized for leaves, defaulting to autumn_breeze`);
        break;
    }
    interface Leaf {
      x: number;
      y: number;
      radius: number;
      speedX: number;
      speedY: number;
      swayFreq: number;
      swayPhase: number;
      rotFreqX: number;
      rotFreqY: number;
      rotFreqZ: number;
      rotPhaseX: number;
      rotPhaseY: number;
      rotPhaseZ: number;
      color: string;
    }
    const leaves: Leaf[] = [];
    for (let i = 0; i < leafCount; i++) {
      const z = Math.random() * 0.8 + 0.2;
      // All frequencies must be integer multiples of (2*PI/duration) for seamless loop
      const getFreq = (minCycles: number, maxCycles: number) => {
        const cycles = Math.floor(Math.random() * (maxCycles - minCycles + 1)) + minCycles;
        return (cycles * Math.PI * 2) / this.duration;
      };
      leaves.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: (Math.random() * 15 + 10) * z * sizeMultiplier,
        speedX: baseSpeedX * z + (Math.random() - 0.5) * this.width * 0.1,
        speedY: baseSpeedY * z + (Math.random() - 0.5) * this.height * 0.05,
        swayFreq: getFreq(1, 3), // Pendulum swing
        swayPhase: Math.random() * Math.PI * 2,
        rotFreqX: getFreq(2, 6), // 3D tumble X
        rotFreqY: getFreq(2, 6), // 3D tumble Y
        rotFreqZ: getFreq(1, 4), // Spin Z
        rotPhaseX: Math.random() * Math.PI * 2,
        rotPhaseY: Math.random() * Math.PI * 2,
        rotPhaseZ: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    process.stdout.write(`Rendering ${totalFrames} frames for Leaves (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      const timeSec = frame / this.fps;
      ctx.clearRect(0, 0, this.width, this.height);
      for (const l of leaves) {
        // Continuous movement with seamless wrapping
        const currentX = ((l.x + l.speedX * timeSec) % this.width + this.width) % this.width;
        const currentY = ((l.y + l.speedY * timeSec) % this.height + this.height) % this.height;
        // Pendulum sway
        const sway = Math.sin(timeSec * l.swayFreq + l.swayPhase) * (this.width * 0.05);
        const finalX = currentX + sway;
        // 3D Rotation simulation
        const rotX = Math.cos(timeSec * l.rotFreqX + l.rotPhaseX);
        const rotY = Math.sin(timeSec * l.rotFreqY + l.rotPhaseY);
        const rotZ = timeSec * l.rotFreqZ + l.rotPhaseZ;
        ctx.save();
        ctx.translate(finalX, currentY);
        // Spin on Z axis
        ctx.rotate(rotZ);
        // Tumble in 3D (scaling simulates foreshortening of the leaf as it flips)
        ctx.scale(rotX, rotY);
        ctx.fillStyle = `rgba(${l.color}, 0.9)`;
        // Draw leaf/petal shape
        ctx.beginPath();
        if (this.variantName === 'sakura_petals') {
          // Petal shape (teardrop/heart-like)
          ctx.moveTo(0, l.radius);
          ctx.bezierCurveTo(l.radius, l.radius, l.radius, -l.radius, 0, -l.radius);
          ctx.bezierCurveTo(-l.radius, -l.radius, -l.radius, l.radius, 0, l.radius);
        } else {
          // Autumn leaf shape (oval with pointy ends)
          ctx.moveTo(0, l.radius * 1.5);
          ctx.quadraticCurveTo(l.radius, 0, 0, -l.radius * 1.5);
          ctx.quadraticCurveTo(-l.radius, 0, 0, l.radius * 1.5);
        }
        ctx.fill();
        ctx.restore();
      }
      const buffer = canvas.toBuffer('raw');
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
