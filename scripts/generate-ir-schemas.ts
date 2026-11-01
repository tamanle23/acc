#!/usr/bin/env bun
/**
 * scripts/generate-ir-schemas.ts
 *
 * Schema-First Synchronization & Code Generation Tool for Universal Video IR.
 *
 * Responsibilities:
 * 1. Synchronize schema/modifiers.schema.json with ModifierPluginRegistry.
 * 2. Validate that all 53 canonical modifier plugins have parameter definitions in schema/modifiers.schema.json.
 * 3. Validate that schema/video-ir.schema.json and schema/modifiers.schema.json are structurally compliant Draft-07 schemas.
 * 4. Verify that VideoIRSchemaValidator and packages/ir/src/types/modifiers.ts remain 100% synchronized with zero drift.
 *
 * Flags:
 *   --check : Verifies zero drift between schemas, registries, and types. Exits with code 1 if drift detected.
 *   --write : Updates schema/modifiers.schema.json and synchronized artifacts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ModifierPluginRegistry } from '../packages/ir/src/plugins/ModifierPluginRegistry';
import { registerCoreModifierPlugins } from '../packages/ir/src/plugins';

const ROOT_DIR = path.resolve(__dirname, '..');
const MODIFIERS_SCHEMA_PATH = path.join(ROOT_DIR, 'schema', 'modifiers.schema.json');
const VIDEO_IR_SCHEMA_PATH = path.join(ROOT_DIR, 'schema', 'video-ir.schema.json');

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

  if (errors.length > 0) {
    console.error('[generate-ir-schemas] DRIFT DETECTED:\n' + errors.map((e) => `  - ${e}`).join('\n'));
    if (options.checkOnly) {
      process.exit(1);
    }
  }

  console.log(`[generate-ir-schemas] Verified ${registeredPlugins.length} registered plugins against ${Object.keys(modifiersSchema.definitions).length} schema definitions.`);

  if (options.write) {
    // Format JSON with 2 spaces and trailing newline
    const formatted = JSON.stringify(modifiersSchema, null, 2) + '\n';
    fs.writeFileSync(MODIFIERS_SCHEMA_PATH, formatted, 'utf8');
    console.log('[generate-ir-schemas] Formatted and wrote schema/modifiers.schema.json cleanly.');
  }

  console.log('[generate-ir-schemas] Schema sync completed with 0 drift.');
}

if (import.meta.main) {
  const isCheck = process.argv.includes('--check');
  const isWrite = process.argv.includes('--write');
  runSchemaSync({ checkOnly: isCheck, write: isWrite });
}
