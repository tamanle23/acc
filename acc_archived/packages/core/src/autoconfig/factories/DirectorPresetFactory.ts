import type {
  FineGrainedVideoDirectorConfig,
  PipelineId,
} from '@acc/ir';
import type {
  DiscoveredAssetManifest,
  AutoScaffoldOptions,
} from '../types';

/**
 * DirectorPresetFactory (GoF Factory Pattern)
 *
 * Produces production-grade FineGrainedVideoDirectorConfig envelopes
 * tailored for each of the 6 canonical pipeline archetypes.
 *
 * Configures all 3 tiers of cinematography:
 * - Tier 1: Global Canvas, Color Grading LUTs, Audio Staging (BGM/SFX volumes, ducking)
 * - Tier 2: Domain Archetype Directives (chart curves, talking head reframe, narrative fog)
 * - Tier 3: Timeline & Segment Fine-Grained Overrides (Ken Burns, 3D Depth, transitions)
 */
export class DirectorPresetFactory {
  /**
   * Universal factory entrypoint resolving by numeric ID ('1'-'6') or canonical PipelineId.
   */
  public static createForArchetype(
    pipelineId: '1' | '2' | '3' | '4' | '5' | '6' | PipelineId,
    manifest?: DiscoveredAssetManifest,
    options: AutoScaffoldOptions = {}
  ): FineGrainedVideoDirectorConfig {
    const effectiveAspect =
      options.aspectRatio || manifest?.dominantVisualAspect;

    const mergedOptions: AutoScaffoldOptions = {
      ...options,
      aspectRatio: effectiveAspect || options.aspectRatio,
    };

    switch (pipelineId) {
      case '1':
      case 'scraper-summarizer':
        return this.createScraperSummarizerPreset(mergedOptions);

      case '2':
      case 'db-templating':
        return this.createDbTemplatingPreset(mergedOptions);

      case '3':
      case 'repurposing-recycler':
        return this.createRepurposingPreset(mergedOptions);

      case '4':
      case 'generative-storytelling':
        return this.createCinematicStoryPreset(mergedOptions);

      case '5':
      case 'rule-logic':
        return this.createRuleLogicPreset(mergedOptions);

      case '6':
      case 'ambient-loops':
        return this.createAmbientLoopPreset(mergedOptions);

      default:
        return this.createCinematicStoryPreset(mergedOptions);
    }
  }

  /**
   * Pipeline 1: Scraper & Summarizer
   * Clean tech aesthetic, subtle editorial motion, crisp readable captions.
   */
  public static createScraperSummarizerPreset(
    options: AutoScaffoldOptions = {}
  ): FineGrainedVideoDirectorConfig {
    const aspect = options.aspectRatio || '9:16';
    const fps = options.fps || 30;

    return {
      aspectRatio: aspect,
      fps,
      canvas: {
        aspectRatio: aspect,
        fps,
        resolution: '1080p',
        colorGrading: {
          lutPreset: 'clean_tech',
          contrast: 1.05,
          saturation: 1.0,
          vignette: 0.05,
        },
      },
      audioStaging: {
        autoDucking: true,
        duckingAttenuationDb: -14,
        masterBgmVolume: 0.2,
        masterSfxVolume: 0.4,
      },
      typography: {
        preset: 'minimal_editorial',
        placement: 'bottom',
        fontSize: 28,
        primaryColor: '#FFFFFF',
      },
      roleDirectives: {
        hook: {
          cameraMotion: {
            type: 'ken_burns_zoom_in',
            intensity: 0.35,
          },
          transition: {
            type: options.enableTransitions === false ? 'none' : 'crossfade',
            durationMs: options.enableTransitions === false ? 0 : 400,
          },
          captions: {
            enabled: true,
            style: 'minimal_editorial',
          },
        },
        body: {
          cameraMotion: {
            type: 'ken_burns_zoom_out',
            intensity: 0.25,
          },
          transition: {
            type: options.enableTransitions === false ? 'none' : 'crossfade',
            durationMs: options.enableTransitions === false ? 0 : 350,
          },
        },
      },
    };
  }

  /**
   * Pipeline 2: DB-Templating (Chart Races, Leaderboards, Metrics)
   * High framerate (60fps), bold typography, dynamic chart curves.
   */
  public static createDbTemplatingPreset(
    options: AutoScaffoldOptions = {}
  ): FineGrainedVideoDirectorConfig {
    const aspect = options.aspectRatio || '16:9';
    const fps = options.fps || 60; // 60fps for fluid chart animations

    return {
      aspectRatio: aspect,
      fps,
      canvas: {
        aspectRatio: aspect,
        fps,
        resolution: '1080p',
        colorGrading: {
          lutPreset: 'clean_tech',
          contrast: 1.1,
          saturation: 1.15,
          vignette: 0.1,
        },
      },
      audioStaging: {
        autoDucking: true,
        duckingAttenuationDb: -12,
        masterBgmVolume: 0.3,
        masterSfxVolume: 0.6,
      },
      typography: {
        preset: 'bold_headline',
        placement: 'bottom',
        fontSize: 36,
        primaryColor: '#F8FAFC',
        highlightColor: '#38BDF8',
      },
      archetypeDirectives: {
        chartVisuals: {
          animationCurve: 'cubic-bezier(0.4, 0, 0.2, 1)',
          cameraZoomOnLeaderChange: true,
          glowIntensity: 0.6,
          showGridLines: true,
        },
      },
      roleDirectives: {
        hook: {
          cameraMotion: {
            type: 'static',
          },
          sfxCues: [
            {
              sfxType: 'impact_bass',
              offsetMs: 0,
              volume: 0.6,
            },
          ],
        },
      },
    };
  }

  /**
   * Pipeline 3: Repurposing Recycler (Short-form viral clips, podcast cutdowns)
   * Face-tracking auto-reframe, punch-in emphasis, kinetic karaoke captions.
   */
  public static createRepurposingPreset(
    options: AutoScaffoldOptions = {}
  ): FineGrainedVideoDirectorConfig {
    const aspect = options.aspectRatio || '9:16';
    const fps = options.fps || 30;

    return {
      aspectRatio: aspect,
      fps,
      canvas: {
        aspectRatio: aspect,
        fps,
        resolution: '1080p',
        colorGrading: {
          lutPreset: 'cyberpunk_neon',
          contrast: 1.1,
          saturation: 1.05,
          vignette: 0.08,
        },
      },
      audioStaging: {
        autoDucking: true,
        duckingAttenuationDb: -16,
        masterBgmVolume: 0.22,
        masterSfxVolume: 0.5,
      },
      typography: {
        preset: 'tiktok_karaoke_glow',
        placement: 'center',
        fontSize: 34,
        primaryColor: '#FFFFFF',
        highlightColor: '#FFE600',
      },
      archetypeDirectives: {
        talkingHead: {
          autoReframe: 'center_face',
          punchInOnEmphasis: true,
          waveformStyle: 'bars',
        },
      },
      roleDirectives: {
        hook: {
          cameraMotion: {
            type: 'dolly_zoom',
            intensity: 0.6,
          },
          captions: {
            enabled: true,
            style: 'kinetic_pop',
          },
          sfxCues: [
            {
              sfxType: 'whoosh',
              offsetMs: 0,
              volume: 0.6,
            },
          ],
        },
      },
    };
  }

  /**
   * Pipeline 4: Generative Storytelling (Visual Stories, Documentaries)
   * 3D Parallax / Sandwich typography, Teal & Orange color grade, cinematic dust & crossfades.
   */
  public static createCinematicStoryPreset(
    options: AutoScaffoldOptions = {}
  ): FineGrainedVideoDirectorConfig {
    const aspect = options.aspectRatio || '9:16';
    const fps = options.fps || 30;
    const depthEnabled = options.enableDepth3D ?? true;
    const transitionsEnabled = options.enableTransitions ?? true;

    return {
      aspectRatio: aspect,
      fps,
      canvas: {
        aspectRatio: aspect,
        fps,
        resolution: '1080p',
        colorGrading: {
          lutPreset: 'cinematic_teal_orange',
          contrast: 1.15,
          saturation: 1.1,
          vignette: 0.15,
        },
      },
      audioStaging: {
        autoDucking: true,
        duckingAttenuationDb: -14,
        masterBgmVolume: 0.25,
        masterSfxVolume: 0.5,
      },
      typography: {
        preset: '3d_sandwich',
        placement: 'center',
        fontSize: 32,
        primaryColor: '#FFFFFF',
        highlightColor: '#F59E0B',
      },
      archetypeDirectives: {
        narrativeStory: {
          cinematicBars: true,
          fogDensity: 0.08,
          ambientDustParticles: true,
        },
      },
      roleDirectives: {
        hook: {
          depth3d: {
            mode: 'sandwich',
            parallaxFactor: 0.6,
            enabled: depthEnabled,
          },
          cameraMotion: {
            type: 'ken_burns_zoom_in',
            intensity: 0.5,
          },
          transition: {
            type: transitionsEnabled ? 'crossfade' : 'none',
            durationMs: transitionsEnabled ? 500 : 0,
          },
        },
        body: {
          depth3d: {
            mode: 'parallax_2_5d',
            parallaxFactor: 0.4,
            enabled: depthEnabled,
          },
          cameraMotion: {
            type: 'ken_burns_zoom_out',
            intensity: 0.45,
          },
          transition: {
            type: transitionsEnabled ? 'crossfade' : 'none',
            durationMs: transitionsEnabled ? 500 : 0,
          },
        },
      },
    };
  }

  /**
   * Pipeline 5: Rule-Logic (Quizzes, Interactive Trees, Educational)
   * High contrast cyberpunk grade, notification cues, glitch transitions.
   */
  public static createRuleLogicPreset(
    options: AutoScaffoldOptions = {}
  ): FineGrainedVideoDirectorConfig {
    const aspect = options.aspectRatio || '9:16';
    const fps = options.fps || 30;

    return {
      aspectRatio: aspect,
      fps,
      canvas: {
        aspectRatio: aspect,
        fps,
        resolution: '1080p',
        colorGrading: {
          lutPreset: 'cyberpunk_neon',
          contrast: 1.2,
          saturation: 1.2,
          vignette: 0.12,
        },
      },
      audioStaging: {
        autoDucking: true,
        duckingAttenuationDb: -14,
        masterBgmVolume: 0.28,
        masterSfxVolume: 0.6,
      },
      typography: {
        preset: 'bold_headline',
        placement: 'center',
        fontSize: 36,
        primaryColor: '#38BDF8',
        highlightColor: '#F43F5E',
      },
      roleDirectives: {
        hook: {
          transition: {
            type: options.enableTransitions === false ? 'none' : 'glitch',
            durationMs: options.enableTransitions === false ? 0 : 300,
          },
          sfxCues: [
            {
              sfxType: 'notification',
              offsetMs: 100,
              volume: 0.7,
            },
          ],
        },
      },
    };
  }

  /**
   * Pipeline 6: Ambient Loops (Lofi, Meditations, Atmospheric Soundscapes)
   * Full BGM prominence, slow calming camera pan, soft golden tones.
   */
  public static createAmbientLoopPreset(
    options: AutoScaffoldOptions = {}
  ): FineGrainedVideoDirectorConfig {
    const aspect = options.aspectRatio || '16:9';
    const fps = options.fps || 30;

    return {
      aspectRatio: aspect,
      fps,
      canvas: {
        aspectRatio: aspect,
        fps,
        resolution: '1080p',
        colorGrading: {
          lutPreset: 'warm_golden',
          contrast: 0.95,
          saturation: 0.9,
          vignette: 0.2,
        },
      },
      audioStaging: {
        autoDucking: false, // BGM plays full and uninterrupted
        masterBgmVolume: 0.85,
        masterSfxVolume: 0.1,
      },
      typography: {
        preset: 'classic_subtitle',
        placement: 'bottom',
        fontSize: 22,
        primaryColor: '#E2E8F0',
      },
      roleDirectives: {
        hook: {
          cameraMotion: {
            type: 'pan_left',
            intensity: 0.2,
          },
          transition: {
            type: options.enableTransitions === false ? 'none' : 'crossfade',
            durationMs: options.enableTransitions === false ? 0 : 1200,
          },
        },
      },
    };
  }
}
