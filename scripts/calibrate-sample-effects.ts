import fs from 'fs';
import path from 'path';

/**
 * Calibrates story-config.json, pipeline-ir.json, and omnichannel-config.json
 * in each of the 6 sample folders to showcase rich SFX, VFX Overlays, and 3D In-Depth effects.
 */
export function calibrateSampleEffects(baseDir: string = path.resolve('samples')): void {
  // ---------------------------------------------------------------------------
  // 1. Pipeline 1: Scraper & Summarizer
  // SFX: whoosh, notification | VFX: camera_ui, digital_glitch | 3D: isometric_billboard
  // ---------------------------------------------------------------------------
  const p1Dir = path.join(baseDir, '01-scraper-summarizer');
  const p1StoryConfigPath = path.join(p1Dir, 'story-config.json');
  if (fs.existsSync(p1StoryConfigPath)) {
    const sc = JSON.parse(fs.readFileSync(p1StoryConfigPath, 'utf-8'));
    sc.settings.overlayComposite = 'camera_ui';
    sc.settings.depth3d = {
      enabled: true,
      mode: 'isometric_billboard',
      frameStyle: 'card',
      popOutIntensity: 1.2,
      shadow: true,
    };
    sc.settings.sfx = [
      { source: 'assets/sfx_notification.wav', time: 0.1, duration: 0.8, volume: 0.8, duckBgm: true },
    ];
    if (sc.scenes && sc.scenes.length > 0) {
      sc.scenes[0].transition = { enabled: true, type: 'glitch', duration: 0.4, audioBehavior: 'pad' };
      sc.scenes[0].sfx = [
        { source: 'assets/sfx_whoosh.wav', time: 0, duration: 1.0, volume: 0.7, duckBgm: true },
      ];
    }
    fs.writeFileSync(p1StoryConfigPath, JSON.stringify(sc, null, 2), 'utf-8');
  }

  // ---------------------------------------------------------------------------
  // 2. Pipeline 2: DB-Templating
  // SFX: data_blip, sub_drop | VFX: sci_fi_hud, matrix_rain | 3D: isometric_podium
  // ---------------------------------------------------------------------------
  const p2Dir = path.join(baseDir, '02-db-templating');
  const p2StoryConfigPath = path.join(p2Dir, 'story-config.json');
  if (fs.existsSync(p2StoryConfigPath)) {
    const sc = JSON.parse(fs.readFileSync(p2StoryConfigPath, 'utf-8'));
    sc.settings.overlayComposite = 'sci_fi_hud';
    sc.settings.depth3d = {
      enabled: true,
      mode: 'isometric_podium',
      frameStyle: 'cinema',
      popOutIntensity: 1.3,
      shadow: true,
    };
    sc.settings.sfx = [
      { source: 'assets/sfx_data_blip.wav', time: 0.2, duration: 0.5, volume: 0.9, duckBgm: false },
      { source: 'assets/sfx_sub_drop.wav', time: 2.0, duration: 2.0, volume: 1.0, duckBgm: true },
    ];
    fs.writeFileSync(p2StoryConfigPath, JSON.stringify(sc, null, 2), 'utf-8');
  }

  // ---------------------------------------------------------------------------
  // 3. Pipeline 3: Repurposing Recycler
  // SFX: pop, whoosh | VFX: vhs, speed_lines | 3D: gyro_focal_tilt, rack_focus
  // ---------------------------------------------------------------------------
  const p3Dir = path.join(baseDir, '03-repurposing-recycler');
  const p3StoryConfigPath = path.join(p3Dir, 'story-config.json');
  if (fs.existsSync(p3StoryConfigPath)) {
    const sc = JSON.parse(fs.readFileSync(p3StoryConfigPath, 'utf-8'));
    sc.settings.overlayComposite = 'vhs';
    sc.settings.depth3d = {
      enabled: true,
      mode: 'gyro_focal_tilt',
      popOutIntensity: 1.25,
      shadow: true,
    };
    sc.settings.sfx = [
      { source: 'assets/sfx_pop.wav', time: 0.3, duration: 0.4, volume: 0.8, duckBgm: false },
      { source: 'assets/sfx_whoosh.wav', time: 1.5, duration: 0.8, volume: 0.7, duckBgm: true },
    ];
    fs.writeFileSync(p3StoryConfigPath, JSON.stringify(sc, null, 2), 'utf-8');
  }

  // ---------------------------------------------------------------------------
  // 4. Pipeline 4: Generative Storytelling
  // SFX: cinematic_hit, kaiju_roar | VFX: dust, embers, fog | 3D: volumetric_sandwich, frame_breaker
  // ---------------------------------------------------------------------------
  const p4Dir = path.join(baseDir, '04-generative-storytelling');
  const p4StoryConfigPath = path.join(p4Dir, 'story-config.json');
  if (fs.existsSync(p4StoryConfigPath)) {
    const sc = JSON.parse(fs.readFileSync(p4StoryConfigPath, 'utf-8'));
    sc.settings.overlayComposite = 'dust';
    sc.settings.depth3d = {
      enabled: true,
      mode: 'volumetric_sandwich',
      popOutIntensity: 1.2,
      shadow: true,
      sandwich: {
        textBehindSubject: true,
        ambientDust: true,
        vignette: true,
        textColor: '#F59E0B',
      },
    };
    sc.settings.sfx = [
      { source: 'assets/sfx_cinematic_hit.wav', time: 0, duration: 2.5, volume: 1.0, duckBgm: true },
    ];
    if (sc.scenes && sc.scenes.length >= 2) {
      sc.scenes[0].depth3d = {
        enabled: true,
        mode: 'volumetric_sandwich',
        sandwich: { textBehindSubject: true, ambientDust: true, vignette: true },
      };
      sc.scenes[0].sfx = [
        { source: 'assets/sfx_kaiju_roar.wav', time: 1.0, duration: 2.0, volume: 0.9, duckBgm: true },
      ];
      sc.scenes[1].depth3d = {
        enabled: true,
        mode: 'frame_breaker',
        frameStyle: 'comic',
        popOutIntensity: 1.25,
        shadow: true,
      };
    }
    fs.writeFileSync(p4StoryConfigPath, JSON.stringify(sc, null, 2), 'utf-8');
  }

  // ---------------------------------------------------------------------------
  // 5. Pipeline 5: Rule & Math Logic
  // SFX: chalk, success_bell | VFX: confetti, bokeh | 3D: cutout_portal, extruded_text_3d
  // ---------------------------------------------------------------------------
  const p5Dir = path.join(baseDir, '05-rule-logic');
  const p5StoryConfigPath = path.join(p5Dir, 'story-config.json');
  if (fs.existsSync(p5StoryConfigPath)) {
    const sc = JSON.parse(fs.readFileSync(p5StoryConfigPath, 'utf-8'));
    sc.settings.overlayComposite = 'confetti';
    sc.settings.depth3d = {
      enabled: true,
      mode: 'extruded_text_3d',
      popOutIntensity: 1.3,
      shadow: true,
    };
    sc.settings.sfx = [
      { source: 'assets/sfx_chalk.wav', time: 0.2, duration: 0.9, volume: 0.8, duckBgm: false },
      { source: 'assets/sfx_success_bell.wav', time: 3.0, duration: 1.5, volume: 0.9, duckBgm: true },
    ];
    fs.writeFileSync(p5StoryConfigPath, JSON.stringify(sc, null, 2), 'utf-8');
  }

  // ---------------------------------------------------------------------------
  // 6. Pipeline 6: Ambient Loops
  // SFX: rain_sound, tape_hiss | VFX: rain_on_glass, starfield | 3D: macro_bokeh, vignette_tunnel
  // ---------------------------------------------------------------------------
  const p6Dir = path.join(baseDir, '06-ambient-loops');
  const p6StoryConfigPath = path.join(p6Dir, 'story-config.json');
  if (fs.existsSync(p6StoryConfigPath)) {
    const sc = JSON.parse(fs.readFileSync(p6StoryConfigPath, 'utf-8'));
    sc.settings.overlayComposite = 'rain_on_glass';
    sc.settings.depth3d = {
      enabled: true,
      mode: 'macro_bokeh',
      popOutIntensity: 1.1,
      shadow: false,
    };
    sc.settings.sfx = [
      { source: 'assets/sfx_rain_sound.wav', time: 0, duration: 8.0, volume: 0.7, duckBgm: false },
      { source: 'assets/sfx_tape_hiss.wav', time: 0, duration: 5.0, volume: 0.3, duckBgm: false },
    ];
    fs.writeFileSync(p6StoryConfigPath, JSON.stringify(sc, null, 2), 'utf-8');
  }

  // ---------------------------------------------------------------------------
  // Synchronize calibrated story-config into pipeline-ir.json & omnichannel-config.json
  // ---------------------------------------------------------------------------
  const dirs = fs.readdirSync(baseDir).filter((d) => fs.statSync(path.join(baseDir, d)).isDirectory());
  for (const dir of dirs) {
    const dirPath = path.join(baseDir, dir);
    const storyConfigPath = path.join(dirPath, 'story-config.json');
    const pipelineIRPath = path.join(dirPath, 'pipeline-ir.json');
    const omnichannelPath = path.join(dirPath, 'omnichannel-config.json');

    if (fs.existsSync(storyConfigPath) && fs.existsSync(pipelineIRPath)) {
      const storyConfig = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8'));
      const pipelineIR = JSON.parse(fs.readFileSync(pipelineIRPath, 'utf-8'));

      // Inject audioComposition SFX markers
      if (storyConfig.settings?.sfx && Array.isArray(storyConfig.settings.sfx)) {
        pipelineIR.audioComposition = pipelineIR.audioComposition || { ducking: { enabled: true } };
        pipelineIR.audioComposition.sfxMarkers = storyConfig.settings.sfx.map((s: any) => ({
          timeMs: Math.round((s.time || 0) * 1000),
          sfxPath: s.source,
          volume: s.volume ?? 1.0,
          category: 'scene_sfx',
        }));
      }

      // Inject visual effects into metadata
      pipelineIR.metadata = pipelineIR.metadata || {};
      pipelineIR.metadata.overlayEffect = storyConfig.settings?.overlayComposite;
      pipelineIR.metadata.depth3d = storyConfig.settings?.depth3d;

      fs.writeFileSync(pipelineIRPath, JSON.stringify(pipelineIR, null, 2), 'utf-8');

      if (fs.existsSync(omnichannelPath)) {
        const omnichannel = JSON.parse(fs.readFileSync(omnichannelPath, 'utf-8'));
        if (omnichannel.videoConfig) {
          omnichannel.videoConfig.depth3d = storyConfig.settings?.depth3d;
          omnichannel.videoConfig.overlayComposite = storyConfig.settings?.overlayComposite;
          omnichannel.videoConfig.sfx = storyConfig.settings?.sfx;
        }
        fs.writeFileSync(omnichannelPath, JSON.stringify(omnichannel, null, 2), 'utf-8');
      }
    }

    // Write a handy README.md in each sample directory
    const readmeContent = `# ${dir}

Sample project materials demonstrating **${dir}** within the ACC (Automated Content Creator) ecosystem.

## Features
- **3D Depth Mode**: \`${fs.existsSync(storyConfigPath) ? JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')).settings?.depth3d?.mode : 'default'}\`
- **VFX Overlay**: \`${fs.existsSync(storyConfigPath) ? JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')).settings?.overlayComposite : 'none'}\`
- **SFX Design**: Synchronized sound effect cues in \`assets/\`
- **Universal Video IR v3.0.0**: \`pipeline-ir.json\`
- **Omnichannel Config**: \`omnichannel-config.json\`
- **Story Config**: \`story-config.json\`

## Run with Unified CLI
\`\`\`bash
# Run pipeline with input data
bun run cli.ts run ${dir.split('-')[1]} -c ./samples/${dir} -n

# Headless Auto-Config dry-run
bun run auto-config.ts ./samples/${dir} --yes --dry-run
\`\`\`
`;
    fs.writeFileSync(path.join(dirPath, 'README.md'), readmeContent, 'utf-8');
  }
}
