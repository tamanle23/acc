import { RegistryManager } from '../core/Registry';
import path from 'path';
import { BaseEffectEngine } from '../core/BaseEffectEngine';
import { pathToFileURL } from 'url';
import fs from 'fs';

export async function renderEffectLayer(
  registry: RegistryManager, 
  effectName: string, 
  variantName: string, 
  duration: number, 
  outDir: string
): Promise<string> {
  registry.validate(effectName, variantName);

  const effectConfig = registry.getEffectConfig(effectName);
  const pipelineConfig = registry.getPipelineConfig(effectConfig.pipeline);
  
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outputPath = path.join(outDir, `${effectName}_${variantName}_${duration}s.${pipelineConfig.format}`);

  // Skip generation if it already exists (caching for speed)
  if (fs.existsSync(outputPath)) {
    return outputPath;
  }

  const modulePath = path.resolve(process.cwd(), effectConfig.module_path);
  const url = pathToFileURL(modulePath).href;
  
  let module;
  try {
    module = await import(url);
  } catch (e: any) {
    throw new Error(`Failed to dynamically import module at ${modulePath}. Ensure the file exists. Error: ${e.message}`);
  }
  
  const ExportedClass = Object.values(module).find(
    (val: any) => typeof val === 'function' && val.prototype instanceof BaseEffectEngine
  ) as any;

  if (!ExportedClass) {
    throw new Error(`Module at ${effectConfig.module_path} does not export a class extending BaseEffectEngine.`);
  }

  const engine: BaseEffectEngine = new ExportedClass(variantName, duration, pipelineConfig);
  await engine.renderAndPipe(outputPath);
  
  return outputPath;
}
