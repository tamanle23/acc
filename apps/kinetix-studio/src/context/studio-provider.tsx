import {
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  type Component,
  type JSX,
} from 'solid-js';
import { createStore, produce, reconcile } from 'solid-js/store';
import type {
  StudioState,
  StudioContextValue,
  LayerVisibility,
  SubsystemId,
  UserPreset,
} from '@/types/studio';
import { INITIAL_STUDIO_STATE } from '@/constants/initial-state';
import { BRAND_ARCHETYPES } from '@/constants/archetypes';
import { RANDOM_EVENT_PAYLOADS } from '@/constants/sample-events';
import { computeChoreography } from '@/engine/choreography';
import { calculateWcagContrast, synthesizePalette } from '@/core/domain/color';
import { AnalogAudioSynth, type SynthPatternId, type VoiceMuteMap } from '@/engine/audio-synth';
import { getSubsystemResetPatch } from '@/lib/config-engine';
import { importDeclarativeSchema } from '@/lib/schema';
import { decodeStateFromUrl, copyShareableLink, decompressStateFromUrlHash } from '@/lib/url-state';
import { userAudioTrack } from '@/engine/audio-user-track';
import { restoreCachedFonts } from '@/lib/custom-fonts';
import { ensureGenreFontLoaded } from '@/lib/font-catalog';
import { resolveLegacyLayout, getLegacyLayoutId } from '@/constants/spatial-layouts';
import { preloadImage } from '@/lib/opfs-storage';
import { videoTextureEngine } from '@/lib/video-texture-engine';
import {
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
  saveUserPreset,
  loadUserPresets,
  deleteUserPreset,
} from '@/lib/user-presets';
import { StoryboardSequence } from '@/core/domain/storyboard/storyboard-sequence.entity';
import type { StoryboardScene, Scene3DChoreography } from '@/types/storyboard';
import { DEFAULT_STORYBOARD_PRESET, STORYBOARD_PRESETS } from '@/constants/storyboard-presets';
import { StudioContext } from './studio-context';

export interface StudioProviderProps {
  children: JSX.Element;
  initialState?: Partial<StudioState>;
}

export const StudioProvider: Component<StudioProviderProps> = (props) => {
  // 1. Initial State Resolution
  const getInitialState = (): StudioState => {
    const urlConfig = decodeStateFromUrl();
    if (urlConfig) {
      return { ...INITIAL_STUDIO_STATE, ...urlConfig, ...props.initialState };
    }
    const savedSession = loadActiveSession();
    if (savedSession) {
      return { ...INITIAL_STUDIO_STATE, ...savedSession, ...props.initialState };
    }
    return { ...INITIAL_STUDIO_STATE, ...props.initialState };
  };

  // Tier 1: Low-Frequency Design Token Store
  const [state, setState] = createStore<StudioState>(getInitialState());

  // Tier 2: High-Frequency Animation & UI Signals
  const [isPlaying, setIsPlaying] = createSignal<boolean>(true);
  const [currentFrame, setCurrentFrame] = createSignal<number>(0);
  const [toastMessage, setToastMessage] = createSignal<string | null>(null);
  const [activeTab, setActiveTab] = createSignal<'config' | 'brand' | 'motion' | 'payload'>('config');
  const [userPresets, setUserPresets] = createSignal<UserPreset[]>(loadUserPresets());
  const [storyboard, setStoryboard] = createSignal<StoryboardSequence>(
    StoryboardSequence.fromSpec(DEFAULT_STORYBOARD_PRESET)
  );
  const [selectedSceneId, setSelectedSceneId] = createSignal<string | null>(
    DEFAULT_STORYBOARD_PRESET.scenes[0]?.id ?? null
  );

  const toggleStoryboardMode = () => {
    const nextMode = !state.isStoryboardMode;
    patchState({ isStoryboardMode: nextMode });
    if (nextMode) {
      const current = selectedSceneId();
      const valid = current && storyboard().scenes.some((s) => s.id === current);
      if (!valid) {
        const first = storyboard().scenes[0];
        if (first) selectStoryboardScene(first.id);
      }
    }
    triggerToast(nextMode ? '🎬 Storyboard Sequencer Enabled' : '🔁 Loop Mode Enabled');
  };

  const selectStoryboardScene = (sceneId: string | null) => {
    const seq = storyboard();
    const scenes = seq.scenes;
    const targetId = sceneId ?? scenes[0]?.id ?? null;
    setSelectedSceneId(targetId);
    if (!targetId) return;

    let accumulatedTime = 0;
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      if (s.id === targetId) {
        const totalDur = seq.totalDurationSec;
        if (totalDur > 0) {
          const frame = Math.round((accumulatedTime / totalDur) * totalFrames());
          setCurrentFrame(frame);
        }
        const archPatch = BRAND_ARCHETYPES.find((a) => a.id === (s.archetypeId ?? state.archetypeId))?.patch ?? {};
        setState(
          produce((st) => {
            Object.assign(st, archPatch, s.statePatch);
            if (s.choreo3d) st.choreo3d = s.choreo3d;
            if (s.archetypeId) st.archetypeId = s.archetypeId;
          })
        );
        triggerToast(`🎬 Editing Act 0${i + 1}: "${s.title}"`);
        break;
      }
      accumulatedTime += s.durationSec;
    }
  };

  const duplicateStoryboardScene = (sceneId: string) => {
    const seq = storyboard();
    const scenes = seq.scenes;
    const index = scenes.findIndex((s) => s.id === sceneId);
    if (index === -1) return;

    const original = scenes[index];
    const newId = `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const clonedScene: StoryboardScene = {
      ...original,
      id: newId,
      title: `${original.title} (Copy)`,
      statePatch: JSON.parse(JSON.stringify(original.statePatch ?? {})),
      choreo3d: original.choreo3d ? JSON.parse(JSON.stringify(original.choreo3d)) : undefined,
      transitionOut: original.transitionOut
        ? { ...original.transitionOut }
        : {
            type: 'cross-dissolve',
            durationSec: 0.8,
            easing: 'linear-sine',
          },
    };

    setStoryboard((prev) => prev.withAddedScene(clonedScene, index + 1));
    selectStoryboardScene(newId);
    triggerToast(`Duplicated: "${clonedScene.title}"`);
  };

  const patchSelectedStoryboardScene = (patch: Partial<StudioState>) => {
    const activeId = selectedSceneId();
    if (!activeId) return;

    setStoryboard((prev) =>
      prev.withUpdatedScene(activeId, {
        statePatch: {
          ...(prev.scenes.find((s) => s.id === activeId)?.statePatch ?? {}),
          ...patch,
        },
      })
    );
  };

  const patchSelectedScene3DChoreo = (patch: Partial<Scene3DChoreography>) => {
    const activeId = selectedSceneId();
    if (!activeId) return;

    setStoryboard((prev) => {
      const scene = prev.scenes.find((s) => s.id === activeId);
      const currentChoreo = scene?.choreo3d ?? { enabled: true };
      const updatedChoreo: Scene3DChoreography = { ...currentChoreo, ...patch };
      return prev.withUpdatedScene(activeId, {
        choreo3d: updatedChoreo,
        statePatch: {
          ...(scene?.statePatch ?? {}),
          choreo3d: updatedChoreo,
          heroId: updatedChoreo.enabled ? 'custom-glb' : (scene?.statePatch.heroId ?? 'custom-glb'),
        },
      });
    });

    setState(
      produce((s) => {
        const cur = s.choreo3d ?? { enabled: true };
        s.choreo3d = { ...cur, ...patch };
        if (s.choreo3d.enabled) {
          s.heroId = 'custom-glb';
        }
      })
    );
  };

  const addStoryboardScene = (scene: StoryboardScene, index?: number) => {
    setStoryboard((prev) => {
      let updated = prev;
      if (typeof index !== 'number' || index >= prev.scenes.length) {
        const lastIdx = prev.scenes.length - 1;
        if (lastIdx >= 0) {
          const lastScene = prev.scenes[lastIdx];
          if (!lastScene.transitionOut) {
            updated = updated.withUpdatedScene(lastScene.id, {
              transitionOut: {
                type: 'cross-dissolve',
                durationSec: 0.8,
                easing: 'expo-out',
                direction: 'right',
              },
            });
          }
        }
      }
      return updated.withAddedScene(scene, index);
    });
    selectStoryboardScene(scene.id);
    triggerToast(`Added scene: "${scene.title}"`);
  };

  const removeStoryboardScene = (sceneId: string) => {
    setStoryboard((prev) => {
      const idx = prev.scenes.findIndex((s) => s.id === sceneId);
      const updated = prev.withRemovedScene(sceneId);
      if (selectedSceneId() === sceneId) {
        const nextIdx = Math.min(Math.max(0, idx), updated.scenes.length - 1);
        const fallback = updated.scenes[nextIdx]?.id ?? updated.scenes[0]?.id ?? null;
        if (fallback) {
          setTimeout(() => selectStoryboardScene(fallback), 0);
        }
      }
      return updated;
    });
    triggerToast('Removed scene from storyboard');
  };

  const updateStoryboardScene = (sceneId: string, patch: Partial<StoryboardScene>) => {
    setStoryboard((prev) => prev.withUpdatedScene(sceneId, patch));
  };

  const reorderStoryboardScenes = (fromIndex: number, toIndex: number) => {
    setStoryboard((prev) => prev.withReorderedScenes(fromIndex, toIndex));
  };

  const loadStoryboardPreset = (presetId: string) => {
    const preset = STORYBOARD_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setStoryboard(StoryboardSequence.fromSpec(preset));
      patchState({ activeSequenceId: preset.id });
      const first = preset.scenes[0];
      if (first) {
        selectStoryboardScene(first.id);
      }
      triggerToast(`Loaded storyboard: "${preset.title}"`);
    }
  };

  // Debounced session auto-save (600ms)
  let saveTimer: number | undefined;
  createEffect(() => {
    // Reading JSON serialization tracks store changes
    JSON.stringify(state);
    if (typeof window !== 'undefined') {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        saveActiveSession(state);
      }, 600);
    }
  });

  onCleanup(() => {
    if (typeof window !== 'undefined') {
      window.clearTimeout(saveTimer);
    }
  });

  // Web Audio Synth Singleton
  const synth = new AnalogAudioSynth();

  // Synchronize synth settings with StudioState tokens
  createEffect(() => {
    synth.setPattern(state.synthPattern);
    synth.setMasterVolume(state.synthMasterVolume);
    synth.setFilter(state.synthFilterCutoff, state.synthFilterResonance);
    synth.setVoiceMutes(state.synthVoiceMutes);
  });

  // Derived Temporal Memos
  const totalFrames = createMemo(() =>
    Math.max(24, Math.round(state.durationSec * state.fps))
  );

  const rawProgress = createMemo(() =>
    totalFrames() > 0 ? (currentFrame() % totalFrames()) / totalFrames() : 0
  );

  const choreo = createMemo(() =>
    computeChoreography(
      rawProgress(),
      state.timelineMode,
      state.hicksLawDisclosure,
      state.customKeyframes,
      state.choreoMode
    )
  );

  const theta = createMemo(() => rawProgress() * Math.PI * 2);
  const safePulseFreq = createMemo(() => Math.min(3, Math.max(1, Math.round(state.bpm / 60))));
  const pulse = createMemo(() =>
    state.audioReactive
      ? 1 + 0.16 * Math.sin(theta() * safePulseFreq())
      : 1 + 0.04 * Math.sin(theta() * 2)
  );

  const audioTelemetry = createMemo(() => {
    if (state.audioSource === 'user-file') {
      return userAudioTrack.getTelemetryAtTime(rawProgress() * state.durationSec);
    }
    return synth.getAudioTelemetry(pulse());
  });

  // User Audio File playback synchronization
  createEffect(() => {
    if (state.audioSource === 'user-file') {
      if (isPlaying()) {
        userAudioTrack.play(rawProgress() * state.durationSec, [0, state.durationSec]);
      } else {
        userAudioTrack.pause();
      }
    } else {
      userAudioTrack.pause();
    }
  });

  const wcagContrast = createMemo(() =>
    calculateWcagContrast(state.palette.ink, state.palette.bg)
  );

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const patchState = (patch: Partial<StudioState>) => {
    setState(
      produce((s) => {
        Object.assign(s, patch);
        // Synchronize spatial layout fields
        if (patch.layoutEngine || patch.layoutVariant) {
          const eng = patch.layoutEngine || s.layoutEngine;
          const v = patch.layoutVariant || s.layoutVariant;
          s.layoutId = getLegacyLayoutId(eng, v);
        } else if (patch.layoutId && !patch.layoutEngine && !patch.layoutVariant) {
          const res = resolveLegacyLayout(patch.layoutId);
          s.layoutEngine = res.engine;
          s.layoutVariant = res.variant;
        }
      })
    );

    // If an act is currently selected in storyboard mode, sync scene-specific edits to that act's statePatch
    const activeSceneId = selectedSceneId();
    if (activeSceneId && state.isStoryboardMode) {
      // Global timeline & project keys that should never be written to an individual scene's statePatch
      const GLOBAL_TIMELINE_KEYS = new Set<string>([
        'aspectRatio',
        'stageAspect',
        'renderScale',
        'fps',
        'cadence',
        'bpm',
        'bpmHarmonicModulation',
        'synthAudioSound',
        'synthPattern',
        'synthMasterVolume',
        'synthFilterCutoff',
        'synthFilterResonance',
        'synthVoiceMutes',
        'audioSource',
        'audioUserTrack',
        'audioReactive',
        'isStoryboardMode',
        'activeSequenceId',
        'playbackSpeed',
        'timelineMode',
        'isPlaying',
        'currentFrame',
        'activeSequence',
      ]);

      const scenePatch: Record<string, any> = {};
      for (const [key, val] of Object.entries(patch)) {
        if (!GLOBAL_TIMELINE_KEYS.has(key)) {
          scenePatch[key] = val;
        }
      }

      if (Object.keys(scenePatch).length > 0) {
        setStoryboard((prev) => {
          const sc = prev.scenes.find((s) => s.id === activeSceneId);
          if (!sc) return prev;
          return prev.withUpdatedScene(activeSceneId, {
            archetypeId: patch.archetypeId ?? sc.archetypeId,
            statePatch: {
              ...sc.statePatch,
              ...scenePatch,
            },
          });
        });
      }
    }
  };

  const resetState = () => {
    clearActiveSession();
    setState(reconcile(INITIAL_STUDIO_STATE));
    setCurrentFrame(0);
    triggerToast('Reset to Canonical Studio Default');
  };

  const revertToArchetype = () => {
    const activeArch = BRAND_ARCHETYPES.find((a) => a.id === state.archetypeId);
    if (activeArch) {
      setState(
        produce((s) => {
          const preservedContent = { ...s.content };
          Object.assign(s, activeArch.patch);
          s.content = preservedContent;
          if (activeArch.patch.layoutId) {
            const res = resolveLegacyLayout(activeArch.patch.layoutId);
            s.layoutEngine = res.engine;
            s.layoutVariant = res.variant;
          }
        })
      );
      triggerToast(`Reverted to Archetype [${activeArch.name}] (Text preserved)`);
    }
  };

  const resetSubsystem = (subsystem: SubsystemId) => {
    const patch = getSubsystemResetPatch(subsystem, state, state.archetypeId);
    patchState(patch);
  };

  const saveCustomPresetCb = (title: string, category: string = 'Custom') => {
    const created = saveUserPreset(title, category, state);
    setUserPresets(loadUserPresets());
    triggerToast(`Saved Preset: ${created.title}`);
    return created;
  };

  const loadCustomPresetCb = (presetId: string) => {
    const found = userPresets().find((p) => p.id === presetId);
    if (found) {
      patchState(found.statePatch);
      triggerToast(`Loaded Preset: ${found.title}`);
    }
  };

  const deleteCustomPresetCb = (presetId: string) => {
    deleteUserPreset(presetId);
    setUserPresets(loadUserPresets());
    triggerToast('Deleted Preset');
  };

  const applyDeclarativeContractCb = (jsonString: string) => {
    const result = importDeclarativeSchema(jsonString);
    if (result.success && result.state) {
      patchState(result.state);
      triggerToast('Applied Declarative Contract');
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const copyShareUrlCb = async () => {
    return await copyShareableLink(state);
  };

  const triggerAnalogSynthBeat = (bpmVal: number) => {
    synth.triggerBeat(bpmVal);
  };

  const resumeAudio = async (): Promise<boolean> => {
    const s = await synth.resume();
    const u = await userAudioTrack.resume();
    return s || u;
  };

  const handleToggleBpmSynth = (forceNext?: boolean) => {
    const next = typeof forceNext === 'boolean' ? forceNext : !state.audioReactive;
    patchState({
      audioReactive: next,
      synthAudioSound: next ? true : state.synthAudioSound,
    });
    if (next) {
      synth.resume().catch(() => {});
      triggerAnalogSynthBeat(state.bpm);
      triggerToast(`BPM Synth Active (${state.bpm} BPM [${state.synthPattern}])`);
    } else {
      triggerToast('BPM Synth Muted');
    }
  };

  // Frame-Locked Phase-Synchronous Audio Clock (Zero Timer Drift)
  let lastAudioStep = -1;
  createEffect(() => {
    if (!state.audioReactive || !state.synthAudioSound || !isPlaying()) {
      lastAudioStep = -1;
      return;
    }
    const totalSteps = Math.max(1, Math.floor(state.durationSec * (state.bpm / 60) * 4));
    const currentStep = Math.floor(rawProgress() * totalSteps);
    if (currentStep !== lastAudioStep) {
      lastAudioStep = currentStep;
      synth.triggerStep(currentStep % 16, state.bpm);
    }
  });

  const handleSynthesizePalette = () => {
    const nextPalette = synthesizePalette();
    patchState({ palette: nextPalette });
    triggerToast('Synthesized WCAG High-Contrast Palette');
  };

  const handleRandomizeEvent = () => {
    const nextContent =
      RANDOM_EVENT_PAYLOADS[Math.floor(Math.random() * RANDOM_EVENT_PAYLOADS.length)];
    patchState({ content: nextContent });
    triggerToast(`Loaded Event: ${nextContent.headline.join(' ')}`);
  };

  const getByteFrequencyData = (targetArray: Uint8Array) => {
    synth.getByteFrequencyData(targetArray);
  };

  const getAudioLevel = () => {
    return synth.getAudioLevel();
  };

  const renderAudioTrackOffline = async (options?: { bpm?: number; durationSec?: number }) => {
    const bpm = options?.bpm ?? state.bpm;
    const durationSec = options?.durationSec ?? state.durationSec;
    return await synth.renderAudioTrackOffline({ bpm, durationSec });
  };

  const toggleLayerVisibility = (layer: keyof LayerVisibility) => {
    patchState({
      layerVisibility: {
        ...state.layerVisibility,
        [layer]: !state.layerVisibility[layer],
      },
    });
    triggerToast(`Layer [${layer.toUpperCase()}] ${!state.layerVisibility[layer] ? 'Enabled' : 'Muted'}`);
  };

  const setPlaybackSpeed = (speed: number) => {
    patchState({ playbackSpeed: speed });
    triggerToast(`Playback Speed: ${speed}x`);
  };

  const setSynthPattern = (pattern: SynthPatternId) => {
    patchState({ synthPattern: pattern });
    triggerToast(`Synth Pattern: [${pattern}]`);
  };

  const toggleSynthVoice = (voice: keyof VoiceMuteMap) => {
    const next = !state.synthVoiceMutes[voice];
    patchState({
      synthVoiceMutes: {
        ...state.synthVoiceMutes,
        [voice]: next,
      },
    });
    triggerToast(`Voice [${voice.toUpperCase()}] ${next ? 'Muted' : 'Unmuted'}`);
  };

  // Reactive Genre Font Preloader (Eliminates Canvas Frame Loop Font Polling)
  createEffect(() => {
    const head = state.headlineFont;
    if (head) {
      void ensureGenreFontLoaded(head);
    }
  });

  createEffect(() => {
    const sub = state.subheadFont;
    if (sub) {
      void ensureGenreFontLoaded(sub);
    }
  });

  // Reactive Media Asset Preloaders (Syncs Images, Cutouts & Video Textures into Synchronous Cache)
  createEffect(() => {
    const customKey = state.bgCustomImageKey;
    if (customKey) {
      void preloadImage(customKey);
    }
  });

  createEffect(() => {
    const cutoutKey = state.userPhotoCutoutKey;
    if (cutoutKey) {
      void preloadImage(cutoutKey);
    }
  });

  createEffect(() => {
    const videoUrl = state.bgVideoUrl;
    if (videoUrl) {
      void videoTextureEngine.setActiveVideo(videoUrl);
    } else {
      void videoTextureEngine.setActiveVideo(null);
    }
  });

  // Master RAF Animation Clock with Cadence Quantization & Loop Range Support
  onMount(() => {
    restoreCachedFonts();

    // One-time user gesture unlock for browser Web Audio autoplay policy
    const unlockAudio = () => {
      synth.resume().catch(() => {});
      userAudioTrack.resume().catch(() => {});
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });

    // Zero-Backend URL Hash State Hydration
    const hydrateFromHash = async () => {
      if (typeof window === 'undefined') return;
      const hash = window.location.hash;
      if (hash && hash.includes('p=')) {
        const decompressed = await decompressStateFromUrlHash(hash);
        if (decompressed) {
          patchState(decompressed);
          triggerToast('Loaded Shared Composition from URL Hash');
        }
      }
    };
    hydrateFromHash();

    const handleHashChange = () => hydrateFromHash();
    window.addEventListener('hashchange', handleHashChange);

    let rafId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      if (isPlaying()) {
        const frameInterval = 1000 / (state.fps * state.playbackSpeed);
        const total = totalFrames();
        const startFrame = Math.floor(state.loopRange[0] * total);
        const endFrame = Math.min(total - 1, Math.ceil(state.loopRange[1] * total));

        const rawDelta = now - lastTime;
        const delta = Math.min(100, Math.max(0, rawDelta));

        if (delta >= frameInterval) {
          lastTime = now - (delta % frameInterval);
          setCurrentFrame((prev) => {
            let next = prev + 1;
            if (next > endFrame || next < startFrame) {
              next = startFrame;
            }
            return next;
          });
        }
      } else {
        lastTime = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    onCleanup(() => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      userAudioTrack.pause();
    });
  });

  const contextValue: StudioContextValue = {
    state,
    patchState,
    resetState,
    get isPlaying() {
      return isPlaying();
    },
    setIsPlaying,
    get currentFrame() {
      return currentFrame();
    },
    setCurrentFrame,
    get totalFrames() {
      return totalFrames();
    },
    get rawProgress() {
      return rawProgress();
    },
    get choreo() {
      return choreo();
    },
    get audioTelemetry() {
      return audioTelemetry();
    },
    get wcagContrast() {
      return wcagContrast();
    },
    get toastMessage() {
      return toastMessage();
    },
    triggerToast,
    triggerAnalogSynthBeat,
    handleToggleBpmSynth,
    resumeAudio,
    handleSynthesizePalette,
    handleRandomizeEvent,
    getByteFrequencyData,
    getAudioLevel,
    renderAudioTrackOffline,
    toggleLayerVisibility,
    setPlaybackSpeed,
    setSynthPattern,
    toggleSynthVoice,
    revertToArchetype,
    resetSubsystem,
    saveCustomPreset: saveCustomPresetCb,
    loadCustomPreset: loadCustomPresetCb,
    deleteCustomPreset: deleteCustomPresetCb,
    get userPresets() {
      return userPresets();
    },
    applyDeclarativeContract: applyDeclarativeContractCb,
    copyShareUrl: copyShareUrlCb,
    get activeTab() {
      return activeTab();
    },
    setActiveTab,
    get storyboard() {
      return storyboard();
    },
    setStoryboard,
    toggleStoryboardMode,
    addStoryboardScene,
    removeStoryboardScene,
    updateStoryboardScene,
    reorderStoryboardScenes,
    loadStoryboardPreset,
    get selectedSceneId() {
      return selectedSceneId();
    },
    selectStoryboardScene,
    duplicateStoryboardScene,
    patchSelectedStoryboardScene,
    patchSelectedScene3DChoreo,
  };

  return (
    <StudioContext.Provider value={contextValue}>
      {props.children}
    </StudioContext.Provider>
  );
};
