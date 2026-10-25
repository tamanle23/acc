import path from 'path';
import { RegistryManager } from '../packages/effect-engines/src/sound-effects/core/Registry';
import { renderSoundEffect } from '../packages/effect-engines/src/sound-effects/engine';
import { FFmpegManager, PythonBackend } from '@acc/core';

const scenarios = [
  // FOLEY
  { effect: 'foley', variant: 'footsteps', subVariant: 'slow_walk' },
  { effect: 'foley', variant: 'footsteps', subVariant: 'sprint' },
  { effect: 'foley', variant: 'footsteps', subVariant: 'heavy_boots' },
  { effect: 'foley', variant: 'footsteps', subVariant: 'stealth_creep' },
  { effect: 'foley', variant: 'cloth', subVariant: 'subtle_shift' },
  { effect: 'foley', variant: 'cloth', subVariant: 'fast_swipe' },
  { effect: 'foley', variant: 'cloth', subVariant: 'frantic_struggle' },
  { effect: 'foley', variant: 'handling', subVariant: 'jingle' },
  { effect: 'foley', variant: 'handling', subVariant: 'drop_shatter' },
  { effect: 'foley', variant: 'handling', subVariant: 'slow_crumple' },
  { effect: 'foley', variant: 'handling', subVariant: 'clinking' },
  { effect: 'foley', variant: 'typing', subVariant: 'single_keystroke' },
  { effect: 'foley', variant: 'typing', subVariant: 'fast_typing_burst' },
  { effect: 'foley', variant: 'typing', subVariant: 'angry_slam' },

  // DIEGETIC
  { effect: 'diegetic', variant: 'weather', subVariant: 'drizzle_on_tent' },
  { effect: 'diegetic', variant: 'weather', subVariant: 'heavy_rain_tin_roof' },
  { effect: 'diegetic', variant: 'weather', subVariant: 'howling_blizzard' },
  { effect: 'diegetic', variant: 'water', subVariant: 'gentle_lapping_waves' },
  { effect: 'diegetic', variant: 'water', subVariant: 'crashing_surf' },
  { effect: 'diegetic', variant: 'water', subVariant: 'muffled_submerged' },
  { effect: 'diegetic', variant: 'urban', subVariant: 'distant_highway_drone' },
  { effect: 'diegetic', variant: 'urban', subVariant: 'crowded_bar_chatter' },
  { effect: 'diegetic', variant: 'urban', subVariant: 'train_passing' },
  { effect: 'diegetic', variant: 'mechanical', subVariant: 'revving_idle' },
  { effect: 'diegetic', variant: 'mechanical', subVariant: 'squeaky_creak_open' },
  { effect: 'diegetic', variant: 'mechanical', subVariant: 'heavy_vault_slam' },

  // CINEMATIC
  { effect: 'cinematic', variant: 'transition', subVariant: 'fast_whip' },
  { effect: 'cinematic', variant: 'transition', subVariant: 'slow_cinematic_pass' },
  { effect: 'cinematic', variant: 'transition', subVariant: 'low_sub_rumble' },
  { effect: 'cinematic', variant: 'impact', subVariant: 'heavy_metallic' },
  { effect: 'cinematic', variant: 'impact', subVariant: 'muffled_sub_drop' },
  { effect: 'cinematic', variant: 'impact', subVariant: 'glass_shatter_layer' },
  { effect: 'cinematic', variant: 'tension', subVariant: 'slow_horror_build' },
  { effect: 'cinematic', variant: 'tension', subVariant: 'digital_glitch_ascend' },
  { effect: 'cinematic', variant: 'tension', subVariant: 'tinnitus_ring' },

  // UI
  { effect: 'ui', variant: 'click', subVariant: 'plastic_pop' },
  { effect: 'ui', variant: 'click', subVariant: 'glass_haptic' },
  { effect: 'ui', variant: 'click', subVariant: 'muffled_thud' },
  { effect: 'ui', variant: 'click', subVariant: 'sharp_snap' },
  { effect: 'ui', variant: 'feedback', subVariant: 'bright_chime' },
  { effect: 'ui', variant: 'feedback', subVariant: 'harsh_buzz' },
  { effect: 'ui', variant: 'feedback', subVariant: 'retro_8bit_coin' },
  { effect: 'ui', variant: 'comedy', subVariant: 'record_scratch_fast' },
  { effect: 'ui', variant: 'comedy', subVariant: 'vinyl_slow_stop' },
  { effect: 'ui', variant: 'comedy', subVariant: '1k_sine_beep' },

  // FAUNA
  { effect: 'fauna', variant: 'domestic_farm', subVariant: 'bark' },
  { effect: 'fauna', variant: 'domestic_farm', subVariant: 'growl' },
  { effect: 'fauna', variant: 'domestic_farm', subVariant: 'purr' },
  { effect: 'fauna', variant: 'domestic_farm', subVariant: 'cattle_lowing' },
  { effect: 'fauna', variant: 'domestic_farm', subVariant: 'horse_whinny' },
  { effect: 'fauna', variant: 'domestic_farm', subVariant: 'pig_squeal' },
  { effect: 'fauna', variant: 'domestic_farm', subVariant: 'rooster_crow' },
  { effect: 'fauna', variant: 'wild_terrestrial', subVariant: 'lion_roar' },
  { effect: 'fauna', variant: 'wild_terrestrial', subVariant: 'wolf_howl' },
  { effect: 'fauna', variant: 'wild_terrestrial', subVariant: 'hyena_whoop' },
  { effect: 'fauna', variant: 'wild_terrestrial', subVariant: 'elk_bugle' },
  { effect: 'fauna', variant: 'wild_terrestrial', subVariant: 'elephant_trumpet' },
  { effect: 'fauna', variant: 'wild_terrestrial', subVariant: 'ape_screech' },
  { effect: 'fauna', variant: 'avian', subVariant: 'dawn_chorus' },
  { effect: 'fauna', variant: 'avian', subVariant: 'falcon_screech' },
  { effect: 'fauna', variant: 'avian', subVariant: 'owl_hoot' },
  { effect: 'fauna', variant: 'avian', subVariant: 'duck_quack' },
  { effect: 'fauna', variant: 'avian', subVariant: 'raven_caw' },
  { effect: 'fauna', variant: 'reptile_insect', subVariant: 'snake_hiss' },
  { effect: 'fauna', variant: 'reptile_insect', subVariant: 'gator_bellow' },
  { effect: 'fauna', variant: 'reptile_insect', subVariant: 'frog_croak' },
  { effect: 'fauna', variant: 'reptile_insect', subVariant: 'cicada_chirp' },
  { effect: 'fauna', variant: 'reptile_insect', subVariant: 'bee_buzz' },
  { effect: 'fauna', variant: 'reptile_insect', subVariant: 'beetle_click' },
  { effect: 'fauna', variant: 'marine', subVariant: 'whale_song' },
  { effect: 'fauna', variant: 'marine', subVariant: 'dolphin_click' },
  { effect: 'fauna', variant: 'marine', subVariant: 'seal_bark' },
  { effect: 'fauna', variant: 'marine', subVariant: 'hydrophone_snap' },

  // SCIFI
  { effect: 'scifi', variant: 'laser', subVariant: 'heavy_blast' },
  { effect: 'scifi', variant: 'laser', subVariant: 'pew_pew' },
  { effect: 'scifi', variant: 'warp_drive', subVariant: 'engine_hum' },
  { effect: 'scifi', variant: 'glitch', subVariant: 'system_error' },
  { effect: 'scifi', variant: 'forcefield', subVariant: 'hum' }
];

const models = [
  'audioldm2-base',
  'audioldm2-large'
];

async function main() {
  await FFmpegManager.prepare();

  console.log('============================================');
  console.log('🤖 AI Sound Effects MASSIVE Batch Benchmark');
  console.log('============================================');
  console.log(`Scenarios: ${scenarios.length}`);
  console.log(`Models: ${models.length}`);
  console.log(`Total Generations: ${scenarios.length * models.length}`);
  console.log('============================================\n');

  const outDir = path.join(process.cwd(), 'autogenerated', 'sound-effects', 'ai');

  for (const scenario of scenarios) {
    for (const model of models) {
      console.log(`\n▶️ Generating [${scenario.effect} > ${scenario.variant} > ${scenario.subVariant}] with model [${model}]`);

      const registry = new RegistryManager('ai', model);

      try {
        const outWav = await renderSoundEffect(
          registry,
          scenario.effect,
          scenario.variant,
          scenario.subVariant,
          2.0,
          outDir
        );
        console.log(`✅ Success: ${outWav}`);
      } catch (e: any) {
        console.error(`❌ Failed: ${e.message}`);
      }
    }
  }

  console.log('\n🎉 Massive batch benchmark completed! Shutting down AI Engine...');
  PythonBackend.getInstance().shutdown();
  process.exit(0);
}

main();
