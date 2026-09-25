import * as fs from 'fs';
import * as path from 'path';

const generatorsDir = path.resolve(__dirname, '../src/overlay-effects/generators');
const files = fs.readdirSync(generatorsDir).filter(f => f.endsWith('.ts') && f !== 'index.ts');

const registry: any = {
  pipelines: {
    mp4_luma: {
      format: "mp4",
      vcodec: "libx264",
      pix_fmt: "yuv420p",
      blend_mode_recommended: "screen",
      background: "black"
    },
    webm_alpha: {
      format: "webm",
      vcodec: "libvpx-vp9",
      pix_fmt: "yuva420p",
      blend_mode_recommended: "normal",
      background: "transparent"
    }
  },
  effects: {}
};

const alphaRequiredEffects = [
  'leaves', 'bubbles', 'confetti', 'floating_hearts', 
  'camera_ui', 'sci_fi_hud', 'audio_spectrum', 'speed_lines'
];

for (const file of files) {
  const filePath = path.join(generatorsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  const nameMatch = content.match(/name:\s*'([^']+)'/);
  const effectName = nameMatch ? nameMatch[1] : file.replace('.ts', '');
  
  const classNameMatch = content.match(/export const (generate[A-Za-z]+Effect)/);
  let className = '';
  if (classNameMatch) {
    className = classNameMatch[1].replace('generate', '');
  } else {
    className = effectName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Effect';
  }

  content = content.replace(/import \{ EffectGenerator, OverlayEffectConfig \} from '\.\.\/types';[\r\n]*/g, '');
  content = content.replace(/import \{ EffectPipeline \} from '\.\.\/pipeline';[\r\n]*/g, '');
  content = `import { BaseEffectEngine } from '../../core/BaseEffectEngine';\n` + content;
  content = content.replace(/^\s*[\r\n]/gm, ''); 

  const oldDeclRegex = /export const generate[A-Za-z]+Effect(?:.*?)?:\s*EffectGenerator\s*=\s*\{[\s\S]*?generate:\s*async\s*\([^{]*\{\s*/m;
  content = content.replace(oldDeclRegex, `export class ${className} extends BaseEffectEngine {\n  async renderAndPipe(outputPath: string): Promise<void> {\n`);

  content = content.replace(/\}\s*;\s*$/g, '}\n');

  content = content.replace(/config\.width/g, 'this.width');
  content = content.replace(/config\.height/g, 'this.height');
  content = content.replace(/config\.fps/g, 'this.fps');
  content = content.replace(/config\.duration/g, 'this.duration');
  content = content.replace(/config\.variant/g, 'this.variantName');
  content = content.replace(/config\.bgTransparent/g, "(this.pipelineConfig.background === 'transparent')");
  content = content.replace(/config\.canvasEngine/g, "'napi-rs'");

  content = content.replace(/const totalFrames = Math.ceil\(this\.fps \* this\.duration\);/g, 'const totalFrames = Math.ceil(this.fps * this.duration);\n    const { stream, promise } = this.setupFFmpegStream(outputPath);');

  content = content.replace(/pipeline\.pushFrame\(([^)]+)\);/g, 'stream.write($1);');
  
  content = content.replace(/process\.stdout\.write\(' Done!\\n'\);/g, `process.stdout.write(' Done!\\n');\n    stream.end();\n    await promise;`);

  fs.writeFileSync(filePath, content);

  const isAlpha = alphaRequiredEffects.includes(effectName);
  registry.effects[effectName] = {
    category: "Unknown",
    pipeline: isAlpha ? "webm_alpha" : "mp4_luma",
    variants: [],
    module_path: `./src/overlay-effects/generators/${file}`
  };
}

fs.writeFileSync(path.resolve(__dirname, '../effects-registry.json'), JSON.stringify(registry, null, 2));
console.log("Migration complete!");
