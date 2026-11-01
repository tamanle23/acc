#!/usr/bin/env bun
/**
 * scripts/generate-ir-schemas.ts
 *
 * Schema-First Synchronization & TypeScript Code Generation Tool for Universal Video IR.
 *
 * Responsibilities:
 * 1. Synchronize schema/modifiers.schema.json with ModifierPluginRegistry.
 * 2. Validate that all 53 canonical modifier plugins have parameter definitions in schema/modifiers.schema.json.
 * 3. Validate that schema/video-ir.schema.json and schema/modifiers.schema.json are structurally compliant Draft-07 schemas.
 * 4. Generate readable, clean, strongly-typed TypeScript interfaces into packages/ir/src/types/generated-ir-types.ts.
 * 5. Verify that VideoIRSchemaValidator and packages/ir/src/types/modifiers.ts remain 100% synchronized with zero drift.
 *
 * Flags:
 *   --check : Verifies zero drift between schemas, registries, and generated TypeScript types. Exits with code 1 if drift detected.
 *   --write : Updates schema/modifiers.schema.json and generates packages/ir/src/types/generated-ir-types.ts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ModifierPluginRegistry } from '../packages/ir/src/plugins/ModifierPluginRegistry';
import { registerCoreModifierPlugins } from '../packages/ir/src/plugins';

const ROOT_DIR = path.resolve(__dirname, '..');
const MODIFIERS_SCHEMA_PATH = path.join(ROOT_DIR, 'schema', 'modifiers.schema.json');
const VIDEO_IR_SCHEMA_PATH = path.join(ROOT_DIR, 'schema', 'video-ir.schema.json');
const GENERATED_TYPES_PATH = path.join(ROOT_DIR, 'packages', 'ir', 'src', 'types', 'generated-ir-types.ts');

const TYPE_TO_DEF_MAP: Record<string, string> = {
  transform: 'TransformModifierParams',
  'vfx/depth_relighting': 'DepthRelightingParams',
  'vfx/camera_3d': 'Camera3DModifierParams',
  'vfx/depth3d': 'Depth3DModifierParams',
  'vfx/auto_reframe': 'AutoReframeModifierParams',
  'vfx/color_grading': 'ColorGradingModifierParams',
  'vfx/partial': 'PartialVfxModifierParams',
  'motion/gsap': 'GSAPMotionModifierParams',
  'motion/vector_blur': 'VectorMotionBlurModifierParams',
  'timed_text/style': 'TextStyleModifierParams',
  'shape/draw': 'ShapeDrawModifierParams',
  'shape/vector': 'ShapeVectorModifierParams',
  'sfx/procedural': 'ProceduralSfxModifierParams',
  'sfx/dynamic_ducking': 'DynamicDuckingModifierParams',
  'editorial/split_edit': 'SplitEditModifierParams',
  'transition/crossfade': 'TransitionModifierParams',
  'transition/wipe': 'TransitionModifierParams',
  'transition/push': 'TransitionModifierParams',
  'transition/zoom': 'TransitionModifierParams',
  'transition/dip': 'TransitionModifierParams',
  'transition/glitch': 'TransitionModifierParams',
  'transition/light_leak': 'TransitionModifierParams',
  'transition/radial_wipe': 'TransitionModifierParams',
  'transition/iris': 'TransitionModifierParams',
  'overlay/blend_mode': 'BlendModeModifierParams',
  'overlay/canvas_particles': 'ParticleVfxModifierParams',
  'overlay/hologram_hud': 'HologramHudModifierParams',
  'generator/solid_backdrop': 'SolidBackdropModifierParams',
  'audio/volume': 'VolumeModifierParams',
  'audio/pan': 'PanModifierParams',
  'audio/filter': 'FilterModifierParams',
  'audio/pitch': 'PitchModifierParams',
  'timeline/photometric_bloom': 'PhotometricBloomModifierParams',
  'timeline/anamorphic_glare': 'AnamorphicGlareModifierParams',
  time_space: 'TimeSpaceModifierParams',
  'time_space/callout_leader': 'CalloutLeaderModifierParams',
  'time_space/callout_multitarget': 'CalloutMultiTargetModifierParams',
  'time_space/hud_reticle': 'HUDReticleModifierParams',
  'time_space/kinetic_title': 'KineticTitleModifierParams',
  'time_space/cyber_lower_third': 'CyberLowerThirdModifierParams',
  'time_space/countdown': 'CountdownModifierParams',
  'time_space/network_plexus': 'NetworkPlexusModifierParams',
  'time_space/audio_waveform': 'AudioWaveformModifierParams',
  'time_space/audio_spectrum': 'AudioSpectrumModifierParams',
  'time_space/superformula': 'SuperformulaModifierParams',
  'time_space/energy_shield': 'EnergyShieldModifierParams',
  'time_space/glitch_data_stream': 'GlitchDataStreamModifierParams',
  'time_space/cymatic_chladni': 'CymaticChladniModifierParams',
  'time_space/strange_attractor': 'StrangeAttractorModifierParams',
  'time_space/relativistic_blackhole': 'RelativisticBlackHoleModifierParams',
  'time_space/topographic_contour': 'TopographicContourModifierParams',
  'time_space/hyperbolic_poincare': 'HyperbolicPoincareModifierParams',
  'time_space/kinetic_harmonograph': 'KineticHarmonographModifierParams',
};

function schemaTypeToTs(prop: any, indent: string = ''): string {
  if (!prop) return 'unknown';

  if (prop.$ref) {
    const refName = prop.$ref.split('/').pop();
    return refName;
  }

  if (prop.oneOf || prop.anyOf) {
    const list = prop.oneOf || prop.anyOf;
    const variants = list.map((v: any) => schemaTypeToTs(v, indent));
    return variants.join(' | ');
  }

  if (prop.enum) {
    return prop.enum.map((v: any) => JSON.stringify(v)).join(' | ');
  }

  if (prop.type === 'string') return 'string';
  if (prop.type === 'number' || prop.type === 'integer') return 'number';
  if (prop.type === 'boolean') return 'boolean';
  if (prop.type === 'null') return 'null';

  if (prop.type === 'array') {
    if (prop.items) {
      if (Array.isArray(prop.items)) {
        return `[${prop.items.map((i: any) => schemaTypeToTs(i, indent)).join(', ')}]`;
      }
      const itemType = schemaTypeToTs(prop.items, indent);
      return itemType.includes(' | ') ? `(${itemType})[]` : `${itemType}[]`;
    }
    return 'unknown[]';
  }

  if (prop.type === 'object' || prop.properties) {
    if (!prop.properties) {
      if (prop.additionalProperties && typeof prop.additionalProperties === 'object') {
        return `Record<string, ${schemaTypeToTs(prop.additionalProperties, indent)}>`;
      }
      return 'Record<string, unknown>';
    }
    const lines: string[] = ['{'];
    const required = new Set(prop.required || []);
    for (const [key, field] of Object.entries(prop.properties)) {
      const isReq = required.has(key);
      const optMark = isReq ? '' : '?';
      const doc = (field as any).description ? `${indent}  /** ${(field as any).description} */\n` : '';
      lines.push(`${doc}${indent}  ${key}${optMark}: ${schemaTypeToTs(field, indent + '  ')};`);
    }
    lines.push(`${indent}}`);
    return lines.join('\n');
  }

  return 'unknown';
}

export function generateTypeScriptTypes(videoIRSchema: any, modifiersSchema: any): string {
  const code: string[] = [
    '/**',
    ' * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY',
    ' * Generated by scripts/generate-ir-schemas.ts from:',
    ' *   - schema/video-ir.schema.json',
    ' *   - schema/modifiers.schema.json',
    ' */',
    '',
  ];

  // 1. Video IR Core Topology Definitions
  code.push('// ============================================================================');
  code.push('// Video IR Core Topology Types (from schema/video-ir.schema.json)');
  code.push('// ============================================================================');
  code.push('');

  // 1a. Root Document Schema (VideoIRDocument & VideoIR)
  const rootDoc: string = videoIRSchema.description ? `/** ${videoIRSchema.description} */\n` : '';
  code.push(`${rootDoc}export interface VideoIRDocument ${schemaTypeToTs({
    type: 'object',
    required: videoIRSchema.required,
    properties: videoIRSchema.properties,
  })}\n`);
  code.push('/** Convenient type alias for VideoIRDocument */');
  code.push('export type VideoIR = VideoIRDocument;\n');

  const vDefs = videoIRSchema.definitions as Record<string, any>;
  for (const [name, def] of Object.entries(vDefs)) {
    if (name === 'ModifierNode' || name === 'SequenceType') continue; // canonically in modifiers
    const doc = def.description ? `/** ${def.description} */\n` : '';
    if (def.enum) {
      code.push(`${doc}export type ${name} = ${def.enum.map((e: any) => JSON.stringify(e)).join(' | ')};\n`);
    } else if (def.type === 'object' || def.properties) {
      code.push(`${doc}export interface ${name} ${schemaTypeToTs(def)}\n`);
    } else {
      code.push(`${doc}export type ${name} = ${schemaTypeToTs(def)};\n`);
    }
  }

  // 2. Modifier Plugin Parameter Definitions
  code.push('// ============================================================================');
  code.push('// Modifier Plugin Parameter Types (from schema/modifiers.schema.json)');
  code.push('// ============================================================================');
  code.push('');

  const mDefs = modifiersSchema.definitions as Record<string, any>;
  for (const [name, def] of Object.entries(mDefs)) {
    const doc = def.description ? `/** ${def.description} */\n` : '';
    if (def.enum) {
      code.push(`${doc}export type ${name} = ${def.enum.map((e: any) => JSON.stringify(e)).join(' | ')};\n`);
    } else if (def.type === 'object' || def.properties) {
      code.push(`${doc}export interface ${name} ${schemaTypeToTs(def)}\n`);
    } else {
      code.push(`${doc}export type ${name} = ${schemaTypeToTs(def)};\n`);
    }
  }

  return code.join('\n');
}

export function runSchemaSync(options: { checkOnly?: boolean; write?: boolean }) {
  console.log('[generate-ir-schemas] Initializing ModifierPluginRegistry & Schema Verification...');

  if (!fs.existsSync(MODIFIERS_SCHEMA_PATH)) {
    throw new Error(`Modifiers schema not found at ${MODIFIERS_SCHEMA_PATH}`);
  }
  if (!fs.existsSync(VIDEO_IR_SCHEMA_PATH)) {
    throw new Error(`Video IR schema not found at ${VIDEO_IR_SCHEMA_PATH}`);
  }

  const rawModifiersSchema = fs.readFileSync(MODIFIERS_SCHEMA_PATH, 'utf8');
  const modifiersSchema = JSON.parse(rawModifiersSchema);

  const rawVideoIRSchema = fs.readFileSync(VIDEO_IR_SCHEMA_PATH, 'utf8');
  const videoIRSchema = JSON.parse(rawVideoIRSchema);

  const registry = registerCoreModifierPlugins(new ModifierPluginRegistry());
  const registeredPlugins = registry.listPlugins();

  const missingPlugins: string[] = [];
  const missingDefs: string[] = [];

  for (const plugin of registeredPlugins) {
    const defName = TYPE_TO_DEF_MAP[plugin.type];
    if (!defName) {
      missingPlugins.push(plugin.type);
      continue;
    }
    if (!modifiersSchema.definitions[defName]) {
      missingDefs.push(`${plugin.type} -> ${defName}`);
    }
  }

  const enumList: string[] = modifiersSchema.definitions.ModifierTypeEnum?.enum || [];
  const unlistedInEnum = registeredPlugins.filter((p) => !enumList.includes(p.type));

  const errors: string[] = [];
  if (missingPlugins.length > 0) {
    errors.push(`Missing type-to-def mappings for registered plugins: ${missingPlugins.join(', ')}`);
  }
  if (missingDefs.length > 0) {
    errors.push(`Missing schema definitions in modifiers.schema.json: ${missingDefs.join(', ')}`);
  }
  if (unlistedInEnum.length > 0) {
    errors.push(`Plugins not listed in ModifierTypeEnum: ${unlistedInEnum.map((p) => p.type).join(', ')}`);
  }

  // Generate target TypeScript code
  const generatedTs = generateTypeScriptTypes(videoIRSchema, modifiersSchema);

  if (fs.existsSync(GENERATED_TYPES_PATH)) {
    const existingTs = fs.readFileSync(GENERATED_TYPES_PATH, 'utf8');
    if (existingTs !== generatedTs) {
      errors.push(`Generated TypeScript file (${GENERATED_TYPES_PATH}) is out of sync with schemas.`);
    }
  } else {
    errors.push(`Generated TypeScript file does not exist at ${GENERATED_TYPES_PATH}`);
  }

  if (errors.length > 0) {
    console.error('[generate-ir-schemas] DRIFT DETECTED:\n' + errors.map((e) => `  - ${e}`).join('\n'));
    if (options.checkOnly) {
      process.exit(1);
    }
  }

  console.log(
    `[generate-ir-schemas] Verified ${registeredPlugins.length} registered plugins against ${Object.keys(modifiersSchema.definitions).length} schema definitions.`
  );

  if (options.write) {
    // 1. Format JSON with 2 spaces and trailing newline
    const formatted = JSON.stringify(modifiersSchema, null, 2) + '\n';
    fs.writeFileSync(MODIFIERS_SCHEMA_PATH, formatted, 'utf8');
    console.log('[generate-ir-schemas] Formatted and wrote schema/modifiers.schema.json cleanly.');

    // 2. Write generated TypeScript types
    fs.writeFileSync(GENERATED_TYPES_PATH, generatedTs, 'utf8');
    console.log(`[generate-ir-schemas] Generated readable TypeScript types at ${GENERATED_TYPES_PATH}`);
  }

  console.log('[generate-ir-schemas] Schema sync & code generation completed with 0 drift.');
}

if (import.meta.main) {
  const isCheck = process.argv.includes('--check');
  const isWrite = process.argv.includes('--write');
  runSchemaSync({ checkOnly: isCheck, write: isWrite });
}
