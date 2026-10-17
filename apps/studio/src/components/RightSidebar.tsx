import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Sparkles,
  Camera,
  Layers,
  Palette,
  Type,
  Volume2,
  RotateCcw,
  Plus,
  Check,
  Copy,
  Trash2,
  CopyPlus,
  Lock,
  Unlock,
  Move,
  Settings,
  Clock,
  Film,
  Monitor,
  Play,
  Music,
} from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './ui/accordion';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
} from './ui/dropdown-menu';
import { IRStateManager } from '../lib/ir/irState';
import { EasingCurveSelector } from './EasingCurveSelector';
import { ProceduralAudioSynthesizer } from '@acc/effect-engines/client';
import {
  ModifierPluginRegistry,
  type ModifierPlugin,
  type SequenceTime,
  type RelationalStart,
  type RelationalDuration,
} from '@acc/ir/client';

export interface ParameterSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function ParameterSlider({
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  unit = '',
  onChange,
}: ParameterSliderProps) {
  const [localVal, setLocalVal] = useState(String(value));

  useEffect(() => {
    setLocalVal(String(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVal(e.target.value);
    const num = parseFloat(e.target.value);
    if (!isNaN(num)) {
      onChange(Math.max(min, Math.min(max, num)));
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[11px]">
        <span
          onDoubleClick={() => onChange(defaultValue)}
          className="text-slate-600 select-none cursor-pointer hover:text-indigo-600 transition-colors"
          title="Double-click to reset"
        >
          {label}
        </span>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step={step}
            value={localVal}
            onChange={handleInputChange}
            className="w-14 h-5 text-[10px] text-right font-mono px-1 py-0 border-slate-200 bg-white"
          />
          {unit && <span className="text-[10px] text-slate-400 font-mono">{unit}</span>}
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={(val) => onChange(val)}
        onDoubleClick={() => onChange(defaultValue)}
      />
    </div>
  );
}

export interface ColorPickerRowProps {
  label: string;
  value: string;
  presets: { name: string; hex: string }[];
  onChange: (hex: string) => void;
}

export function ColorPickerRow({ label, value, presets, onChange }: ColorPickerRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[11px] text-slate-600">
        <span>{label}</span>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-5 h-5 rounded cursor-pointer border border-slate-300 p-0"
          />
          <span className="font-mono text-[10px] text-slate-500 uppercase">{value}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {presets.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onChange(preset.hex)}
            className={`w-4 h-4 rounded-full border transition-transform hover:scale-125 ${value.toLowerCase() === preset.hex.toLowerCase()
              ? 'ring-2 ring-indigo-500 border-white scale-110'
              : 'border-slate-300'
              }`}
            style={{ backgroundColor: preset.hex }}
            title={preset.name}
          />
        ))}
      </div>
    </div>
  );
}

export const PARTICLE_PRESET_DEFAULTS: Record<
  string,
  {
    intensity: number;
    speed: number;
    opacity: number;
    particleCount: number;
    bloomEnabled: boolean;
    bloomThreshold: number;
    bloomIntensity: number;
    chromaticAberrationEnabled: boolean;
    chromaticAberrationOffset: number;
  }
> = {
  cyber_sparks: {
    intensity: 1.2,
    speed: 1.8,
    opacity: 0.9,
    particleCount: 1500,
    bloomEnabled: true,
    bloomThreshold: 0.6,
    bloomIntensity: 1.5,
    chromaticAberrationEnabled: true,
    chromaticAberrationOffset: 2.5,
  },
  embers: {
    intensity: 1.0,
    speed: 0.8,
    opacity: 0.85,
    particleCount: 800,
    bloomEnabled: true,
    bloomThreshold: 0.7,
    bloomIntensity: 1.2,
    chromaticAberrationEnabled: false,
    chromaticAberrationOffset: 1.0,
  },
  dust: {
    intensity: 0.6,
    speed: 0.4,
    opacity: 0.5,
    particleCount: 400,
    bloomEnabled: false,
    bloomThreshold: 0.8,
    bloomIntensity: 0.5,
    chromaticAberrationEnabled: false,
    chromaticAberrationOffset: 0.0,
  },
  rain: {
    intensity: 1.5,
    speed: 2.2,
    opacity: 0.7,
    particleCount: 1200,
    bloomEnabled: false,
    bloomThreshold: 0.8,
    bloomIntensity: 0.5,
    chromaticAberrationEnabled: true,
    chromaticAberrationOffset: 1.2,
  },
  snow: {
    intensity: 0.8,
    speed: 0.5,
    opacity: 0.75,
    particleCount: 600,
    bloomEnabled: false,
    bloomThreshold: 0.8,
    bloomIntensity: 0.5,
    chromaticAberrationEnabled: false,
    chromaticAberrationOffset: 0.0,
  },
  bokeh: {
    intensity: 0.9,
    speed: 0.3,
    opacity: 0.6,
    particleCount: 300,
    bloomEnabled: true,
    bloomThreshold: 0.5,
    bloomIntensity: 1.8,
    chromaticAberrationEnabled: false,
    chromaticAberrationOffset: 0.5,
  },
  matrix_rain: {
    intensity: 1.3,
    speed: 1.6,
    opacity: 0.85,
    particleCount: 1800,
    bloomEnabled: true,
    bloomThreshold: 0.65,
    bloomIntensity: 1.4,
    chromaticAberrationEnabled: true,
    chromaticAberrationOffset: 2.0,
  },
  digital_glitch: {
    intensity: 1.4,
    speed: 2.0,
    opacity: 0.9,
    particleCount: 1000,
    bloomEnabled: true,
    bloomThreshold: 0.5,
    bloomIntensity: 2.0,
    chromaticAberrationEnabled: true,
    chromaticAberrationOffset: 4.0,
  },
};

export interface AvailableModifierDef {
  type: string;
  name: string;
  icon: any;
  supportedTrackTypes: Array<'video' | 'audio' | 'timed_text' | 'data'>;
  defaultParams: Record<string, unknown>;
}

export const MODIFIER_PRESENTATION_CATALOG: Record<
  string,
  {
    name: string;
    icon: any;
    supportedTrackTypes: Array<'video' | 'audio' | 'timed_text' | 'data'>;
    defaultParams: Record<string, unknown>;
  }
> = {
  transform: {
    name: 'In-Canvas Transform',
    icon: Move,
    supportedTrackTypes: ['video', 'timed_text'],
    defaultParams: {
      x: 0,
      y: 0,
      scale: 1.0,
      rotation: 0,
      opacity: 1.0,
      ease: 'power2.out',
    },
  },
  'overlay/canvas_particles': {
    name: 'Particle VFX & Shaders',
    icon: Layers,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      type: 'cyber_sparks',
      preset: 'cyber_sparks',
      intensity: 1.0,
      speed: 1.0,
      opacity: 0.8,
      particleCount: 1500,
      gravity: -1.2,
      drag: 0.15,
      turbulence: 1.0,
      bloomThreshold: 0.7,
      chromaticAberration: 2.0,
      shaders: {
        bloom: { enabled: true, threshold: 0.7, intensity: 1.0 },
        chromaticAberration: { enabled: true, offsetPx: 2.0 },
      },
    },
  },
  'overlay/hologram_hud': {
    name: 'Hologram HUD',
    icon: Monitor,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      ringRadiusNorm: 0.35,
      scanlineDensity: 40,
      color: '#00ffff',
      rotationSpeed: 0.5,
    },
  },
  'vfx/depth_relighting': {
    name: '3D Relighting',
    icon: Sparkles,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      lightColor: '#00d4ff',
      lightX: 2.0,
      lightY: 2.0,
      lightZ: 5.0,
      diffuse: 1.0,
      specular: 1.2,
      shininess: 32,
      rimIntensity: 0.5,
    },
  },
  'vfx/depth3d': {
    name: 'Depth 3D & Parallax',
    icon: Sparkles,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      mode: 'parallax_25d',
      popOutIntensity: 1.25,
      autoSegment: true,
      autoDepth: true,
    },
  },
  'camera/3d': {
    name: '3D Camera & Lens',
    icon: Camera,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      eyeX: 0.0,
      eyeY: 0.0,
      eyeZ: 10.0,
      targetX: 0.0,
      targetY: 0.0,
      targetZ: 0.0,
      fov: 45,
      roll: 0,
      focalDistance: 2.5,
      focalRange: 1.0,
      bokehRadius: 6.0,
    },
  },
  'vfx/color_grading': {
    name: 'Color Grading',
    icon: Palette,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      contrast: 1.0,
      saturation: 1.0,
      exposure: 0.0,
      vignette: 0.35,
    },
  },
  'text/style': {
    name: 'Typography & Karaoke Glow',
    icon: Type,
    supportedTrackTypes: ['timed_text'],
    defaultParams: {
      enabled: true,
      fontFamily: 'Inter',
      fontSize: 28,
      fontWeight: 600,
      letterSpacing: 0,
      fillColor: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 2,
      shadowBlur: 6,
      glowColor: '#00d4ff',
      activeWordHighlight: {
        enabled: true,
        fillColor: '#facc15',
        scale: 1.15,
        glowColor: '#00d4ff',
        glowBlur: 12,
        animationPreset: 'pop',
      },
    },
  },
  'sfx/dynamic_ducking': {
    name: 'Audio Ducking & Pan',
    icon: Volume2,
    supportedTrackTypes: ['audio'],
    defaultParams: {
      enabled: true,
      duckVolume: 0.25,
      attackMs: 150,
      releaseMs: 300,
      stereoPan: 0.0,
      targetBus: 'track-a2',
    },
  },
  'audio/volume': {
    name: 'Volume & Gain DSP',
    icon: Volume2,
    supportedTrackTypes: ['audio'],
    defaultParams: {
      enabled: true,
      volume: 1.0,
      gainDb: 0.0,
    },
  },
  'audio/pan': {
    name: 'Stereo Panner DSP',
    icon: Volume2,
    supportedTrackTypes: ['audio'],
    defaultParams: {
      enabled: true,
      pan: 0.0,
    },
  },
  'audio/filter': {
    name: 'Equalizer / Filter DSP',
    icon: Volume2,
    supportedTrackTypes: ['audio'],
    defaultParams: {
      enabled: true,
      filterType: 'lowpass',
      cutoffHz: 12000,
      resonance: 1.0,
    },
  },
  'audio/pitch': {
    name: 'Pitch Shift DSP',
    icon: Volume2,
    supportedTrackTypes: ['audio'],
    defaultParams: {
      enabled: true,
      pitchSemitones: 0,
      playbackRate: 1.0,
    },
  },
  'sfx/procedural': {
    name: 'Procedural Audio Synthesizer',
    icon: Music,
    supportedTrackTypes: ['audio'],
    defaultParams: {
      enabled: true,
      synthType: 'impact',
      durationSec: 1.5,
      duckingFactor: 0.75,
      label: 'IMPACT',
    },
  },
  'editorial/split_edit': {
    name: 'L/J Cut Split Edit',
    icon: Film,
    supportedTrackTypes: ['video', 'audio'],
    defaultParams: {
      enabled: true,
      audioLeadFrames: 15,
      videoLagFrames: 0,
    },
  },
  'editorial/transition_crossfade': {
    name: 'Transition Crossfade',
    icon: Film,
    supportedTrackTypes: ['video', 'audio'],
    defaultParams: {
      enabled: true,
      durationFrames: 15,
      crossfadeType: 'crossfade',
    },
  },
  'overlay/blend_mode': {
    name: 'Blend Mode Composite',
    icon: Layers,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      mode: 'screen',
      opacity: 1.0,
    },
  },
};

/**
 * Dynamically queries ModifierPluginRegistry to discover all registered modifiers,
 * mapping them with UI presentation definitions and providing defensive fallbacks
 * for newly registered or third-party custom plugins.
 */
export function getAvailableModifiersFromRegistry(
  registry: ModifierPluginRegistry = ModifierPluginRegistry.getInstance()
): AvailableModifierDef[] {
  const registeredPlugins = registry.listPlugins();
  const result: AvailableModifierDef[] = [];
  const processedTypes = new Set<string>();

  for (const plugin of registeredPlugins) {
    processedTypes.add(plugin.type);
    const catalogEntry = MODIFIER_PRESENTATION_CATALOG[plugin.type];

    if (catalogEntry) {
      result.push({
        type: plugin.type,
        name: catalogEntry.name,
        icon: catalogEntry.icon,
        supportedTrackTypes: catalogEntry.supportedTrackTypes,
        defaultParams: { ...catalogEntry.defaultParams },
      });
    } else {
      // Dynamic fallback for custom/third-party plugins without presentation metadata
      const isAudio = plugin.targetScope === 'audio';
      const defaultSupportedTrackTypes: Array<'video' | 'audio' | 'timed_text' | 'data'> = isAudio
        ? ['audio']
        : plugin.targetScope === 'both'
        ? ['video', 'audio', 'timed_text']
        : ['video'];

      // Generate a human-readable title from type (e.g. "custom/glitch_fx" -> "Glitch Fx")
      const rawName = plugin.type.split('/').pop() || plugin.type;
      const formattedName = rawName
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      result.push({
        type: plugin.type,
        name: formattedName,
        icon: isAudio ? Volume2 : Sparkles,
        supportedTrackTypes: defaultSupportedTrackTypes,
        defaultParams: { enabled: true },
      });
    }
  }

  // Ensure any catalog entries that weren't registered yet are included as fallback
  for (const [type, entry] of Object.entries(MODIFIER_PRESENTATION_CATALOG)) {
    if (!processedTypes.has(type)) {
      result.push({
        type,
        name: entry.name,
        icon: entry.icon,
        supportedTrackTypes: entry.supportedTrackTypes,
        defaultParams: { ...entry.defaultParams },
      });
    }
  }

  return result;
}

export const ALL_AVAILABLE_MODIFIERS: AvailableModifierDef[] = getAvailableModifiersFromRegistry();

export function formatTimecode(frames: number, fps: number): string {
  const safeFps = fps > 0 ? fps : 30;
  const safeFrames = Math.max(0, Math.round(frames));
  const totalSeconds = Math.floor(safeFrames / safeFps);
  const f = safeFrames % safeFps;
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

export function RightSidebar() {
  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());
  const [copiedId, setCopiedId] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    return IRStateManager.getInstance().subscribe(setIrState);
  }, []);

  const selectedSeqId = irState.selectedSequenceId;

  // Resolve selected sequence and track
  let selectedSeq: any = null;
  let selectedTrack: any = null;

  for (const track of irState.doc.tracks) {
    for (const seq of track.sequences) {
      if (seq.id === selectedSeqId) {
        selectedSeq = seq;
        selectedTrack = track;
        break;
      }
    }
    if (selectedSeq) break;
  }

  // Defensive fallback: check compiled timeline tracks if not found in doc.tracks
  if (!selectedSeq && irState.timeline) {
    const rawTracks = irState.timeline.tracks;
    const timelineTracks = rawTracks instanceof Map
      ? Array.from(rawTracks.values())
      : Array.isArray(rawTracks)
      ? rawTracks
      : [];
    for (const track of timelineTracks) {
      for (const seq of track.sequences) {
        if (seq.id === selectedSeqId) {
          selectedSeq = seq;
          selectedTrack = track;
          break;
        }
      }
      if (selectedSeq) break;
    }
  }

  // Modifiers lookup
  const modifiers = selectedSeq?.modifiers || [];

  const transformMod = modifiers.find((m: any) => m.type === 'transform');
  const relightMod = modifiers.find(
    (m: any) => m.type === 'vfx/depth_relighting' || m.type === 'vfx/depth3d_relighting'
  );
  const cameraMod = modifiers.find((m: any) => m.type === 'camera/3d' || m.type === 'camera/path');
  const particleMod = modifiers.find((m: any) => m.type === 'overlay/canvas_particles');
  const dedicatedHudMod = modifiers.find((m: any) => m.type === 'overlay/hologram_hud');
  const sciFiHudParticleMod = modifiers.find(
    (m: any) => m.type === 'overlay/canvas_particles' && m.params?.type === 'sci_fi_hud'
  );
  const hologramHudMod = dedicatedHudMod || sciFiHudParticleMod;
  const colorGradingMod = modifiers.find((m: any) => m.type === 'vfx/color_grading');
  const textStyleMod = modifiers.find((m: any) => m.type === 'text/style');
  const duckingMod = modifiers.find((m: any) => m.type === 'sfx/dynamic_ducking' || m.type === 'audio/volume');
  const proceduralSfxMod = modifiers.find((m: any) => m.type === 'sfx/procedural');

  const attachedModifierTypes = new Set(modifiers.map((m: any) => m.type));

  // Generic Modifier Updaters with Coalesced History
  const updateModifierParams = (type: string, params: Record<string, any>) => {
    if (!selectedSeqId) return;
    IRStateManager.getInstance().updateModifier(selectedSeqId, type, params);
  };

  const removeModifier = (type: string) => {
    if (!selectedSeqId) return;
    IRStateManager.getInstance().removeModifier(selectedSeqId, type);
  };

  const toggleModifier = (type: string, enabled: boolean) => {
    const existing = modifiers.find((m: any) => m.type === type);
    if (!existing) return;
    updateModifierParams(type, { ...existing.params, enabled });
  };

  const handleCopyId = () => {
    if (!selectedSeqId) return;
    navigator.clipboard?.writeText(selectedSeqId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleDuplicate = () => {
    if (!selectedSeqId) return;
    IRStateManager.getInstance().duplicateSequence(selectedSeqId);
  };

  const handleDelete = () => {
    if (!selectedSeqId) return;
    IRStateManager.getInstance().deleteSequence(selectedSeqId);
  };

  // Base Sequence Timing Resolution & Interactive Handlers
  const fps = irState.doc.meta?.globalFps || 30;
  const resolvedSeq = selectedSeqId ? irState.timeline?.sequences?.get(selectedSeqId) : null;
  const resolvedStartFrame = resolvedSeq?.startFrame ?? (typeof selectedSeq?.time?.start === 'number' ? selectedSeq.time.start : 0);
  const resolvedEndFrame = resolvedSeq?.endFrame ?? (resolvedStartFrame + (typeof selectedSeq?.time?.duration === 'number' ? selectedSeq.time.duration : 30));
  const resolvedDurationFrames = Math.max(1, resolvedEndFrame - resolvedStartFrame);

  const otherSequenceIds: string[] = [];
  for (const track of irState.doc.tracks) {
    for (const seq of track.sequences) {
      if (seq.id !== selectedSeqId) {
        otherSequenceIds.push(seq.id);
      }
    }
  }

  const isStartRelational = typeof selectedSeq?.time?.start === 'object' && selectedSeq?.time?.start !== null;
  const isDurationRelational = typeof selectedSeq?.time?.duration === 'object' && selectedSeq?.time?.duration !== null;

  const currentStartNumber = typeof selectedSeq?.time?.start === 'number' ? selectedSeq.time.start : resolvedStartFrame;
  const currentDurationNumber = typeof selectedSeq?.time?.duration === 'number' ? selectedSeq.time.duration : resolvedDurationFrames;

  const relStartObj = (isStartRelational ? selectedSeq.time.start : {}) as RelationalStart;
  const relStartType: 'after' | 'syncWith' = relStartObj?.after ? 'after' : 'syncWith';
  const relStartTarget = relStartObj?.after || relStartObj?.syncWith || otherSequenceIds[0] || '';
  const relStartOffset = relStartObj?.offsetFrames ?? 0;
  const relStartOverlap = relStartObj?.overlapFrames ?? 0;

  const relDurObj = (isDurationRelational ? selectedSeq.time.duration : {}) as RelationalDuration;
  const relDurMatchAsset = Boolean(relDurObj?.matchAssetDuration);
  const relDurTarget = relDurObj?.matchLengthOf || otherSequenceIds[0] || '';
  const relDurPadding = relDurObj?.paddingFrames ?? 0;

  const handleUpdateSequenceTime = (newTime: SequenceTime) => {
    if (!selectedSeqId) return;
    IRStateManager.getInstance().updateSequenceTime(selectedSeqId, newTime);
  };

  const handleToggleStartRelational = (relational: boolean) => {
    if (!selectedSeq) return;
    if (relational) {
      const target = otherSequenceIds[0] || '';
      handleUpdateSequenceTime({
        ...selectedSeq.time,
        start: { after: target },
      });
    } else {
      handleUpdateSequenceTime({
        ...selectedSeq.time,
        start: resolvedStartFrame,
      });
    }
  };

  const handleSetAbsoluteStart = (frames: number) => {
    if (!selectedSeq) return;
    handleUpdateSequenceTime({
      ...selectedSeq.time,
      start: Math.max(0, frames),
    });
  };

  const handleSetRelStartMode = (mode: 'after' | 'syncWith') => {
    if (!selectedSeq) return;
    const target = relStartTarget || otherSequenceIds[0] || '';
    const newStart: RelationalStart = mode === 'after'
      ? { after: target, offsetFrames: relStartOffset, overlapFrames: relStartOverlap }
      : { syncWith: target, offsetFrames: relStartOffset, overlapFrames: relStartOverlap };
    handleUpdateSequenceTime({
      ...selectedSeq.time,
      start: newStart,
    });
  };

  const handleSetRelStartTarget = (target: string) => {
    if (!selectedSeq) return;
    const newStart: RelationalStart = relStartType === 'after'
      ? { after: target, offsetFrames: relStartOffset, overlapFrames: relStartOverlap }
      : { syncWith: target, offsetFrames: relStartOffset, overlapFrames: relStartOverlap };
    handleUpdateSequenceTime({
      ...selectedSeq.time,
      start: newStart,
    });
  };

  const handleSetRelStartOffset = (offset: number) => {
    if (!selectedSeq) return;
    const newStart: RelationalStart = {
      ...relStartObj,
      offsetFrames: offset,
    };
    handleUpdateSequenceTime({
      ...selectedSeq.time,
      start: newStart,
    });
  };

  const handleSetRelStartOverlap = (overlap: number) => {
    if (!selectedSeq) return;
    const newStart: RelationalStart = {
      ...relStartObj,
      overlapFrames: overlap,
    };
    handleUpdateSequenceTime({
      ...selectedSeq.time,
      start: newStart,
    });
  };

  const handleToggleDurationRelational = (relational: boolean) => {
    if (!selectedSeq) return;
    if (relational) {
      const target = otherSequenceIds[0] || '';
      handleUpdateSequenceTime({
        ...selectedSeq.time,
        duration: { matchLengthOf: target },
      });
    } else {
      handleUpdateSequenceTime({
        ...selectedSeq.time,
        duration: resolvedDurationFrames || 30,
      });
    }
  };

  const handleSetAbsoluteDuration = (frames: number) => {
    if (!selectedSeq) return;
    handleUpdateSequenceTime({
      ...selectedSeq.time,
      duration: Math.max(1, frames),
    });
  };

  const handleToggleMatchAssetDuration = (match: boolean) => {
    if (!selectedSeq) return;
    if (match) {
      handleUpdateSequenceTime({
        ...selectedSeq.time,
        duration: { matchAssetDuration: true },
      });
    } else {
      const target = otherSequenceIds[0] || '';
      handleUpdateSequenceTime({
        ...selectedSeq.time,
        duration: { matchLengthOf: target },
      });
    }
  };

  const handleSetRelDurationTarget = (target: string) => {
    if (!selectedSeq) return;
    handleUpdateSequenceTime({
      ...selectedSeq.time,
      duration: { matchLengthOf: target, paddingFrames: relDurPadding },
    });
  };

  const handleSetRelDurationPadding = (padding: number) => {
    if (!selectedSeq) return;
    handleUpdateSequenceTime({
      ...selectedSeq.time,
      duration: {
        ...relDurObj,
        paddingFrames: padding,
      },
    });
  };

  // On-the-fly Procedural Audio Synthesizer State (Phase 5)
  const [synthType, setSynthType] = useState<'whoosh' | 'impact' | 'glitch' | 'riser' | 'laser'>('impact');
  const [synthDuration, setSynthDuration] = useState(1.5);
  const [synthDucking, setSynthDucking] = useState(0.75);
  const [isPlayingAudition, setIsPlayingAudition] = useState(false);

  const handleAuditionSFX = () => {
    setIsPlayingAudition(true);
    let buf: Float32Array;
    switch (synthType) {
      case 'whoosh':
        buf = ProceduralAudioSynthesizer.synthWhoosh(0, synthDuration);
        break;
      case 'impact':
        buf = ProceduralAudioSynthesizer.synthImpact(0, synthDuration);
        break;
      case 'glitch':
        buf = ProceduralAudioSynthesizer.synthGlitch(0, synthDuration);
        break;
      case 'riser':
        buf = ProceduralAudioSynthesizer.synthRiser(0, synthDuration);
        break;
      case 'laser':
      default:
        buf = ProceduralAudioSynthesizer.synthLaserSFX(0, synthDuration);
        break;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const audioBuf = ctx.createBuffer(1, buf.length, 44100);
        audioBuf.copyToChannel(buf, 0);
        const source = ctx.createBufferSource();
        source.buffer = audioBuf;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (e) {
      console.warn('Audio audition error:', e);
    }

    setTimeout(() => setIsPlayingAudition(false), Math.min(2000, synthDuration * 1000));
  };

  const handleInsertProceduralSFX = () => {
    const startFrame = 0;
    const durationFrames = Math.round(synthDuration * 30);
    const seq = {
      id: `seq-sfx-${synthType}-${Date.now()}`,
      name: `${synthType.toUpperCase()} SFX`,
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      modifiers: [
        {
          type: 'sfx/procedural',
          params: {
            synthType,
            durationSec: synthDuration,
            duckingFactor: synthDucking,
            label: synthType.toUpperCase(),
          },
        },
      ],
    };
    IRStateManager.getInstance().addSequence('track-audio', seq as any, {
      trackTypeFallback: 'audio',
      trackNameFallback: 'Master Audio Track',
    });
  };

  const trackType = (selectedTrack?.type || 'video') as 'video' | 'audio' | 'timed_text' | 'data';
  const availableModifiers = getAvailableModifiersFromRegistry();
  const relevantModifiers = availableModifiers.filter((mod) =>
    mod.supportedTrackTypes.includes(trackType)
  );

  const width = irState.doc.meta?.canvasSize?.w || 1920;
  const height = irState.doc.meta?.canvasSize?.h || 1080;
  const totalDurationFrames = irState.timeline?.totalDurationFrames || 300;
  const activeSequencesCount = irState.timeline?.sequences
    ? irState.timeline.sequences.size
    : irState.doc.tracks.reduce((acc, t) => acc + t.sequences.length, 0);

  return (
    <aside className="w-[336px] glass-panel border-l border-border/50 flex flex-col h-full select-none shadow-xs z-10 shrink-0">
      {/* 1. Inspector Header */}
      <div className="p-3 border-b border-border/40 bg-background/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            {selectedSeq ? 'Sequence Inspector' : 'Project Settings'}
          </h2>
        </div>

        {selectedSeq && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1 px-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
              >
                <Plus className="w-3 h-3" />
                Add Effect
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                {relevantModifiers.map((mod) => {
                  const isAttached = modifiers.some((m: any) => m.type === mod.type);
                  const Icon = mod.icon;
                  return (
                    <DropdownMenuItem
                      key={mod.type}
                      disabled={isAttached}
                      onClick={() => updateModifierParams(mod.type, mod.defaultParams)}
                      className="flex items-center justify-between cursor-pointer py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{mod.name}</span>
                      </div>
                      {isAttached && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* 2. Main Content Area */}
      <ScrollArea className="flex-1 p-3 space-y-4">
        {selectedSeq ? (
          <div className="space-y-3">
            {/* Sequence Meta Card */}
            <Card className="p-2.5 bg-slate-50/70 border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Badge variant="outline" className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border-indigo-200 truncate">
                    {selectedSeq.id}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyId}
                    className="h-5 w-5 text-slate-400 hover:text-indigo-600"
                    title="Copy Sequence ID"
                  >
                    {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
                <Badge variant="secondary" className="font-mono text-[9px] uppercase">
                  {selectedTrack?.type || 'track'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-slate-400">Track: </span>
                  <span className="font-mono font-medium text-slate-700">{selectedTrack?.id}</span>
                </div>
                <div>
                  <span className="text-slate-400">Duration: </span>
                  <span className="font-mono font-medium text-slate-700">
                    {resolvedDurationFrames}f ({(resolvedDurationFrames / fps).toFixed(2)}s)
                  </span>
                </div>
              </div>

              {/* Sequence Timing Card */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    Sequence Timing
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {resolvedStartFrame}f - {resolvedEndFrame}f ({formatTimecode(resolvedStartFrame, fps)})
                  </span>
                </div>

                {/* Start Time Section */}
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded border border-slate-200/80 dark:border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Start Time</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleStartRelational(false)}
                        className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors cursor-pointer ${!isStartRelational ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
                      >
                        Absolute
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStartRelational(true)}
                        className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors cursor-pointer ${isStartRelational ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
                      >
                        Relational
                      </button>
                    </div>
                  </div>

                  {!isStartRelational ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-400">Frame</label>
                        <Input
                          type="number"
                          min={0}
                          value={currentStartNumber}
                          onChange={(e) => handleSetAbsoluteStart(parseInt(e.target.value) || 0)}
                          className="h-6 text-[11px] font-mono"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-400">Timecode</label>
                        <div className="h-6 px-2 text-[10px] font-mono flex items-center bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">
                          {formatTimecode(currentStartNumber, fps)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-[11px]">
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[10px] text-slate-400">Relation</label>
                          <select
                            value={relStartType}
                            onChange={(e) => handleSetRelStartMode(e.target.value as 'after' | 'syncWith')}
                            className="w-full h-6 text-[10px] bg-background border border-slate-200 dark:border-white/10 rounded px-1"
                          >
                            <option value="after">after (sequential)</option>
                            <option value="syncWith">syncWith (parallel)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Target Sequence</label>
                          <select
                            value={relStartTarget}
                            onChange={(e) => handleSetRelStartTarget(e.target.value)}
                            className="w-full h-6 text-[10px] bg-background border border-slate-200 dark:border-white/10 rounded px-1 font-mono"
                          >
                            {otherSequenceIds.map((id) => (
                              <option key={id} value={id}>{id}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400">Offset Frames</label>
                          <Input
                            type="number"
                            value={relStartOffset}
                            onChange={(e) => handleSetRelStartOffset(parseInt(e.target.value) || 0)}
                            className="h-6 text-[11px] font-mono"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400">Overlap Frames</label>
                          <Input
                            type="number"
                            value={relStartOverlap}
                            onChange={(e) => handleSetRelStartOverlap(parseInt(e.target.value) || 0)}
                            className="h-6 text-[11px] font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Duration Section */}
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded border border-slate-200/80 dark:border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Duration</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleDurationRelational(false)}
                        className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors cursor-pointer ${!isDurationRelational ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
                      >
                        Absolute
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleDurationRelational(true)}
                        className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors cursor-pointer ${isDurationRelational ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
                      >
                        Relational
                      </button>
                    </div>
                  </div>

                  {!isDurationRelational ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-400">Frames</label>
                        <Input
                          type="number"
                          min={1}
                          value={currentDurationNumber}
                          onChange={(e) => handleSetAbsoluteDuration(Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-6 text-[11px] font-mono"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-400">Seconds</label>
                        <div className="h-6 px-2 text-[10px] font-mono flex items-center bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">
                          {(currentDurationNumber / fps).toFixed(2)}s
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">Match Asset Duration</span>
                        <Switch
                          checked={relDurMatchAsset}
                          onCheckedChange={handleToggleMatchAssetDuration}
                        />
                      </div>
                      {!relDurMatchAsset && (
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="text-[10px] text-slate-400">matchLengthOf</label>
                            <select
                              value={relDurTarget}
                              onChange={(e) => handleSetRelDurationTarget(e.target.value)}
                              className="w-full h-6 text-[10px] bg-background border border-slate-200 dark:border-white/10 rounded px-1 font-mono"
                            >
                              {otherSequenceIds.map((id) => (
                                <option key={id} value={id}>{id}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">Padding Frames</label>
                            <Input
                              type="number"
                              value={relDurPadding}
                              onChange={(e) => handleSetRelDurationPadding(parseInt(e.target.value) || 0)}
                              className="h-6 text-[11px] font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center gap-1 pt-2 border-t border-slate-200/60">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDuplicate}
                  className="flex-1 h-6 text-[10px] gap-1 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 border-slate-200"
                  title="Duplicate sequence"
                >
                  <CopyPlus className="w-3 h-3" />
                  Duplicate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLocked(!isLocked)}
                  className={`h-6 px-2 text-[10px] gap-1 border-slate-200 ${isLocked ? 'bg-amber-50 text-amber-700 border-amber-300' : 'text-slate-600'
                    }`}
                  title={isLocked ? 'Locked' : 'Unlocked'}
                >
                  {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="h-6 px-2 text-[10px] text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200"
                  title="Delete sequence (undoable)"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>

            {/* Pure Attached-Only Empty State */}
            {modifiers.length === 0 && (
              <div className="p-6 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-lg text-center space-y-2 text-slate-400 bg-slate-50/40 dark:bg-slate-900/20">
                <Sliders className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">No Effects Attached</p>
                <p className="text-[11px] text-slate-400 max-w-[220px] mx-auto">
                  Click <span className="font-semibold text-indigo-500">+ Add Effect</span> above to attach visual, audio, or motion modifiers to this sequence.
                </p>
              </div>
            )}

            {/* Accordion Panels */}
            <Accordion type="multiple" defaultValue={['transform', 'relighting', 'camera', 'particles', 'hologram_hud', 'typography', 'audio']} className="space-y-2">
              {/* Transform Section (Pure Attached-Only) */}
              {attachedModifierTypes.has('transform') && (
                <AccordionItem value="transform" className="border border-slate-200 dark:border-white/10 rounded-md overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                  <AccordionTrigger
                    actions={
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          onClick={() => updateModifierParams('transform', { x: 0, y: 0, scale: 1.0, rotation: 0 })}
                          title="Reset transform"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                          onClick={() => removeModifier('transform')}
                          title="Remove transform"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <Move className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">In-Canvas Transform</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-3 space-y-3">
                  <ParameterSlider
                    label="Offset X"
                    value={transformMod?.params?.x ?? 0}
                    min={-960}
                    max={960}
                    step={1}
                    defaultValue={0}
                    unit="px"
                    onChange={(v) => updateModifierParams('transform', { ...transformMod?.params, x: v })}
                  />
                  <ParameterSlider
                    label="Offset Y"
                    value={transformMod?.params?.y ?? 0}
                    min={-540}
                    max={540}
                    step={1}
                    defaultValue={0}
                    unit="px"
                    onChange={(v) => updateModifierParams('transform', { ...transformMod?.params, y: v })}
                  />
                  <ParameterSlider
                    label="Uniform Scale"
                    value={transformMod?.params?.scale ?? 1.0}
                    min={0.1}
                    max={4.0}
                    step={0.05}
                    defaultValue={1.0}
                    unit="x"
                    onChange={(v) => updateModifierParams('transform', { ...transformMod?.params, scale: v })}
                  />
                  <ParameterSlider
                    label="Rotation"
                    value={transformMod?.params?.rotation ?? 0}
                    min={-180}
                    max={180}
                    step={1}
                    defaultValue={0}
                    unit="°"
                    onChange={(v) => updateModifierParams('transform', { ...transformMod?.params, rotation: v })}
                  />

                  <div className="pt-2 border-t border-[var(--glass-border)] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        Motion Preset & Lifecycle
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase font-mono">GSAP</span>
                    </div>

                    {/* Presets Pills */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { id: 'none', label: 'Static', ease: 'linear' },
                        { id: 'pop_in', label: 'Pop In', ease: 'elastic.out' },
                        { id: 'slide_left', label: 'Slide In', ease: 'power2.out' },
                        { id: 'bounce', label: 'Bounce', ease: 'bounce.out' },
                        { id: 'overshoot', label: 'Overshoot', ease: 'back.out' },
                        { id: 'drift', label: 'Drift', ease: 'power2.inOut' },
                      ].map((p) => {
                        const currentPreset = (transformMod?.params as any)?.animation?.preset || 'none';
                        const isSelected = currentPreset === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              const newAnim =
                                p.id === 'none'
                                  ? undefined
                                  : {
                                      preset: p.id as any,
                                      intro: { durationSec: 0.5, ease: p.ease },
                                      outro: { durationSec: 0.3, ease: 'power2.in' },
                                    };
                              updateModifierParams('transform', {
                                ...transformMod?.params,
                                ease: p.ease,
                                animation: newAnim,
                              });
                            }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                            }`}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Duration Sliders */}
                    <div className="grid grid-cols-2 gap-2">
                      <ParameterSlider
                        label="Intro Duration"
                        value={(transformMod?.params as any)?.animation?.intro?.durationSec ?? 0.4}
                        min={0.1}
                        max={2.0}
                        step={0.05}
                        defaultValue={0.4}
                        unit="s"
                        onChange={(v) => {
                          const currentAnim = (transformMod?.params as any)?.animation || { preset: 'pop_in' };
                          updateModifierParams('transform', {
                            ...transformMod?.params,
                            animation: {
                              ...currentAnim,
                              intro: { ...currentAnim.intro, durationSec: v },
                            },
                          });
                        }}
                      />
                      <ParameterSlider
                        label="Outro Duration"
                        value={(transformMod?.params as any)?.animation?.outro?.durationSec ?? 0.3}
                        min={0.1}
                        max={1.5}
                        step={0.05}
                        defaultValue={0.3}
                        unit="s"
                        onChange={(v) => {
                          const currentAnim = (transformMod?.params as any)?.animation || { preset: 'pop_in' };
                          updateModifierParams('transform', {
                            ...transformMod?.params,
                            animation: {
                              ...currentAnim,
                              outro: { ...currentAnim.outro, durationSec: v },
                            },
                          });
                        }}
                      />
                    </div>

                    <EasingCurveSelector
                      value={(transformMod?.params as any)?.ease || 'power2.out'}
                      onChange={(ease) => {
                        const currentAnim = (transformMod?.params as any)?.animation;
                        updateModifierParams('transform', {
                          ...transformMod?.params,
                          ease,
                          animation: currentAnim
                            ? {
                                ...currentAnim,
                                intro: { ...(currentAnim.intro || {}), ease },
                              }
                            : undefined,
                        });
                      }}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* 3D Relighting Section */}
              {relightMod && (
                <AccordionItem value="relighting" className="border border-slate-200 dark:border-white/10 rounded-md overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                  <AccordionTrigger
                    actions={
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          onClick={() => removeModifier(relightMod.type)}
                          title="Remove modifier"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                        </Button>
                        <Switch
                          checked={relightMod.params?.enabled !== false}
                          onCheckedChange={(val) => toggleModifier(relightMod.type, val)}
                        />
                      </>
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">3D Depth Relighting</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-3 space-y-3">
                    <ColorPickerRow
                      label="Point Light Color"
                      value={relightMod.params?.lightColor || '#00d4ff'}
                      presets={[
                        { name: 'Cyan Neon', hex: '#00d4ff' },
                        { name: 'Solar Amber', hex: '#f59e0b' },
                        { name: 'Magenta Pulse', hex: '#ec4899' },
                        { name: 'Electric Violet', hex: '#8b5cf6' },
                        { name: 'Pure White', hex: '#ffffff' },
                      ]}
                      onChange={(hex) => updateModifierParams(relightMod.type, { lightColor: hex })}
                    />
                    <ParameterSlider
                      label="Light Position X"
                      value={relightMod.params?.lightX ?? 2.0}
                      min={-10.0}
                      max={10.0}
                      step={0.1}
                      defaultValue={2.0}
                      onChange={(v) => updateModifierParams(relightMod.type, { lightX: v })}
                    />
                    <ParameterSlider
                      label="Light Position Y"
                      value={relightMod.params?.lightY ?? 2.0}
                      min={-10.0}
                      max={10.0}
                      step={0.1}
                      defaultValue={2.0}
                      onChange={(v) => updateModifierParams(relightMod.type, { lightY: v })}
                    />
                    <ParameterSlider
                      label="Light Depth (Z)"
                      value={relightMod.params?.lightZ ?? 5.0}
                      min={0.5}
                      max={20.0}
                      step={0.5}
                      defaultValue={5.0}
                      onChange={(v) => updateModifierParams(relightMod.type, { lightZ: v })}
                    />
                    <ParameterSlider
                      label="Diffuse Weight"
                      value={relightMod.params?.diffuse ?? 1.0}
                      min={0.0}
                      max={3.0}
                      step={0.05}
                      defaultValue={1.0}
                      onChange={(v) => updateModifierParams(relightMod.type, { diffuse: v })}
                    />
                    <ParameterSlider
                      label="Specular Shininess"
                      value={relightMod.params?.shininess ?? 32}
                      min={4}
                      max={128}
                      step={4}
                      defaultValue={32}
                      onChange={(v) => updateModifierParams(relightMod.type, { shininess: v })}
                    />
                    <ParameterSlider
                      label="Soft Rim Intensity"
                      value={relightMod.params?.rimIntensity ?? 0.5}
                      min={0.0}
                      max={2.0}
                      step={0.05}
                      defaultValue={0.5}
                      onChange={(v) => updateModifierParams(relightMod.type, { rimIntensity: v })}
                    />
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* 3D Camera & Lens Section */}
              {cameraMod && (
                <AccordionItem value="camera" className="border border-slate-200 dark:border-white/10 rounded-md overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                  <AccordionTrigger
                    actions={
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          onClick={() => removeModifier(cameraMod.type)}
                          title="Remove modifier"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                        </Button>
                        <Switch
                          checked={cameraMod.params?.enabled !== false}
                          onCheckedChange={(val) => toggleModifier(cameraMod.type, val)}
                        />
                      </>
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">3D Camera & Lens</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-3 space-y-3">
                    <ParameterSlider
                      label="Field of View (FOV)"
                      value={cameraMod.params?.fov ?? 45}
                      min={20}
                      max={110}
                      step={1}
                      defaultValue={45}
                      unit="°"
                      onChange={(v) => updateModifierParams(cameraMod.type, { fov: v })}
                    />
                    <ParameterSlider
                      label="Focal Distance"
                      value={cameraMod.params?.focalDistance ?? 2.5}
                      min={0.5}
                      max={20.0}
                      step={0.1}
                      defaultValue={2.5}
                      unit="m"
                      onChange={(v) => updateModifierParams(cameraMod.type, { focalDistance: v })}
                    />
                    <ParameterSlider
                      label="Bokeh Blur Radius"
                      value={cameraMod.params?.bokehRadius ?? 6.0}
                      min={0.0}
                      max={25.0}
                      step={0.5}
                      defaultValue={6.0}
                      unit="px"
                      onChange={(v) => updateModifierParams(cameraMod.type, { bokehRadius: v })}
                    />
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Hologram HUD Section */}
              {hologramHudMod && (
                <AccordionItem value="hologram_hud" className="border border-slate-200 dark:border-white/10 rounded-md overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                  <AccordionTrigger
                    actions={
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          onClick={() => removeModifier(hologramHudMod.type)}
                          title="Remove modifier"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                        </Button>
                        <Switch
                          checked={hologramHudMod.params?.enabled !== false}
                          onCheckedChange={(val) => toggleModifier(hologramHudMod.type, val)}
                        />
                      </>
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Hologram HUD</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-3 space-y-3">
                    <ColorPickerRow
                      label="HUD Telemetry Color"
                      value={hologramHudMod.params?.color || '#00ffff'}
                      presets={[
                        { name: 'Cyan Neon', hex: '#00ffff' },
                        { name: 'Magenta Pulse', hex: '#ec4899' },
                        { name: 'Amber Gold', hex: '#f59e0b' },
                        { name: 'Emerald Glow', hex: '#10b981' },
                        { name: 'Violet Spark', hex: '#8b5cf6' },
                      ]}
                      onChange={(hex) => updateModifierParams(hologramHudMod.type, { color: hex })}
                    />
                    <ParameterSlider
                      label="Ring Radius"
                      value={hologramHudMod.params?.ringRadiusNorm ?? 0.35}
                      min={0.10}
                      max={0.80}
                      step={0.05}
                      defaultValue={0.35}
                      onChange={(v) => updateModifierParams(hologramHudMod.type, { ringRadiusNorm: v })}
                    />
                    <ParameterSlider
                      label="Scanline Density"
                      value={hologramHudMod.params?.scanlineDensity ?? 40}
                      min={10}
                      max={100}
                      step={5}
                      defaultValue={40}
                      onChange={(v) => updateModifierParams(hologramHudMod.type, { scanlineDensity: v })}
                    />
                    <ParameterSlider
                      label="Rotation Speed"
                      value={hologramHudMod.params?.rotationSpeed ?? 0.5}
                      min={0.1}
                      max={3.0}
                      step={0.1}
                      defaultValue={0.5}
                      unit=" rad/s"
                      onChange={(v) => updateModifierParams(hologramHudMod.type, { rotationSpeed: v })}
                    />
                    <div className="pt-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-slate-500 hover:text-indigo-600 gap-1 px-2"
                        onClick={() => updateModifierParams(hologramHudMod.type, {
                          ...hologramHudMod.params,
                          ringRadiusNorm: 0.35,
                          scanlineDensity: 40,
                          color: '#00ffff',
                          rotationSpeed: 0.5,
                        })}
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        Reset Defaults
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Particle VFX & Shaders Section */}
              {particleMod && (() => {
                const currentType = (particleMod.params?.type || particleMod.params?.preset || 'cyber_sparks') as string;
                const pBloom = particleMod.params?.shaders?.bloom;
                const bloomEnabled = pBloom?.enabled ?? (particleMod.params?.bloomThreshold !== undefined ? true : true);
                const bloomThreshold = pBloom?.threshold ?? particleMod.params?.bloomThreshold ?? 0.7;
                const bloomIntensity = pBloom?.intensity ?? 1.0;

                const pChrom = particleMod.params?.shaders?.chromaticAberration;
                const chromEnabled = pChrom?.enabled ?? (particleMod.params?.chromaticAberration !== undefined ? true : true);
                const chromOffset = pChrom?.offsetPx ?? particleMod.params?.chromaticAberration ?? 2.0;

                const updateBloom = (patch: { enabled?: boolean; threshold?: number; intensity?: number }) => {
                  const curShaders = particleMod.params?.shaders || {};
                  const curBloom = curShaders.bloom || {};
                  const updatedBloom = {
                    enabled: patch.enabled !== undefined ? patch.enabled : bloomEnabled,
                    threshold: patch.threshold !== undefined ? patch.threshold : bloomThreshold,
                    intensity: patch.intensity !== undefined ? patch.intensity : bloomIntensity,
                  };
                  updateModifierParams(particleMod.type, {
                    ...particleMod.params,
                    bloomThreshold: updatedBloom.threshold,
                    shaders: {
                      ...curShaders,
                      bloom: updatedBloom,
                      chromaticAberration: curShaders.chromaticAberration || {
                        enabled: chromEnabled,
                        offsetPx: chromOffset,
                      },
                    },
                  });
                };

                const updateChrom = (patch: { enabled?: boolean; offsetPx?: number }) => {
                  const curShaders = particleMod.params?.shaders || {};
                  const curChrom = curShaders.chromaticAberration || {};
                  const updatedChrom = {
                    enabled: patch.enabled !== undefined ? patch.enabled : chromEnabled,
                    offsetPx: patch.offsetPx !== undefined ? patch.offsetPx : chromOffset,
                  };
                  updateModifierParams(particleMod.type, {
                    ...particleMod.params,
                    chromaticAberration: updatedChrom.offsetPx,
                    shaders: {
                      ...curShaders,
                      bloom: curShaders.bloom || {
                        enabled: bloomEnabled,
                        threshold: bloomThreshold,
                        intensity: bloomIntensity,
                      },
                      chromaticAberration: updatedChrom,
                    },
                  });
                };

                const handleResetDefaults = () => {
                  const def = PARTICLE_PRESET_DEFAULTS[currentType] || PARTICLE_PRESET_DEFAULTS['cyber_sparks'];
                  updateModifierParams(particleMod.type, {
                    ...particleMod.params,
                    type: currentType,
                    preset: currentType,
                    intensity: def.intensity,
                    speed: def.speed,
                    opacity: def.opacity,
                    particleCount: def.particleCount,
                    bloomThreshold: def.bloomThreshold,
                    chromaticAberration: def.chromaticAberrationOffset,
                    shaders: {
                      bloom: {
                        enabled: def.bloomEnabled,
                        threshold: def.bloomThreshold,
                        intensity: def.bloomIntensity,
                      },
                      chromaticAberration: {
                        enabled: def.chromaticAberrationEnabled,
                        offsetPx: def.chromaticAberrationOffset,
                      },
                    },
                  });
                };

                return (
                  <AccordionItem value="particles" className="border border-slate-200 dark:border-white/10 rounded-md overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                    <AccordionTrigger
                      actions={
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            onClick={() => removeModifier(particleMod.type)}
                            title="Remove modifier"
                          >
                            <Trash2 className="w-3 h-3 text-rose-500" />
                          </Button>
                          <Switch
                            checked={particleMod.params?.enabled !== false}
                            onCheckedChange={(val) => toggleModifier(particleMod.type, val)}
                          />
                        </>
                      }
                    >
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Particle VFX & Shaders</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-3 space-y-3">
                      {/* Predefined Particle Type Dropdown */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-600 dark:text-slate-400">Particle Type</span>
                          <span className="text-[10px] font-mono text-indigo-500 uppercase">{currentType}</span>
                        </div>
                        <select
                          value={currentType}
                          onChange={(e) => {
                            const newType = e.target.value;
                            updateModifierParams(particleMod.type, {
                              ...particleMod.params,
                              type: newType,
                              preset: newType,
                            });
                          }}
                          className="w-full h-7 text-xs border border-slate-200 dark:border-white/10 rounded px-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="cyber_sparks">Cyber Sparks (High-velocity electric arcs)</option>
                          <option value="embers">Floating Embers (Warm upward drifting sparks)</option>
                          <option value="dust">Atmospheric Dust (Slow ambient specks)</option>
                          <option value="rain">Cinematic Rain (Downward streaks with splash)</option>
                          <option value="snow">Gentle Snow (Soft swirling flakes)</option>
                          <option value="bokeh">Dreamy Bokeh (Floating soft focus circles)</option>
                          <option value="matrix_rain">Matrix Rain (Digital falling code streams)</option>
                          <option value="digital_glitch">Digital Glitch (Corrupted pixel fragments)</option>
                          <option value="sci_fi_hud">Sci-Fi HUD (Telemetry Reticle Overlay)</option>
                        </select>
                      </div>

                      {/* Physics & Emission Sliders */}
                      <ParameterSlider
                        label="Intensity"
                        value={particleMod.params?.intensity ?? 1.0}
                        min={0.1}
                        max={2.0}
                        step={0.05}
                        defaultValue={1.0}
                        onChange={(v) => updateModifierParams(particleMod.type, { ...particleMod.params, intensity: v })}
                      />
                      <ParameterSlider
                        label="Speed"
                        value={particleMod.params?.speed ?? 1.0}
                        min={0.1}
                        max={3.0}
                        step={0.1}
                        defaultValue={1.0}
                        onChange={(v) => updateModifierParams(particleMod.type, { ...particleMod.params, speed: v })}
                      />
                      <ParameterSlider
                        label="Opacity"
                        value={particleMod.params?.opacity ?? 0.8}
                        min={0.0}
                        max={1.0}
                        step={0.05}
                        defaultValue={0.8}
                        onChange={(v) => updateModifierParams(particleMod.type, { ...particleMod.params, opacity: v })}
                      />
                      <ParameterSlider
                        label="Particle Count"
                        value={particleMod.params?.particleCount ?? 1500}
                        min={50}
                        max={3000}
                        step={50}
                        defaultValue={1500}
                        onChange={(v) => updateModifierParams(particleMod.type, { ...particleMod.params, particleCount: v })}
                      />

                      {/* Collapsible Shader Post-Processing */}
                      <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-indigo-500" />
                            <span>Shader Post-Processing</span>
                          </div>
                        </div>

                        {/* Bloom / Glow */}
                        <div className="p-2 rounded bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Bloom & Glow</span>
                            <Switch
                              checked={bloomEnabled}
                              onCheckedChange={(val) => updateBloom({ enabled: val })}
                            />
                          </div>
                          {bloomEnabled && (
                            <>
                              <ParameterSlider
                                label="Bloom Threshold"
                                value={bloomThreshold}
                                min={0.1}
                                max={1.0}
                                step={0.05}
                                defaultValue={0.7}
                                onChange={(v) => updateBloom({ threshold: v })}
                              />
                              <ParameterSlider
                                label="Bloom Intensity"
                                value={bloomIntensity}
                                min={0.1}
                                max={3.0}
                                step={0.1}
                                defaultValue={1.0}
                                onChange={(v) => updateBloom({ intensity: v })}
                              />
                            </>
                          )}
                        </div>

                        {/* Chromatic Aberration */}
                        <div className="p-2 rounded bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Chromatic Aberration</span>
                            <Switch
                              checked={chromEnabled}
                              onCheckedChange={(val) => updateChrom({ enabled: val })}
                            />
                          </div>
                          {chromEnabled && (
                            <ParameterSlider
                              label="Color Fringe Offset"
                              value={chromOffset}
                              min={0.0}
                              max={10.0}
                              step={0.5}
                              defaultValue={2.0}
                              unit="px"
                              onChange={(v) => updateChrom({ offsetPx: v })}
                            />
                          )}
                        </div>
                      </div>

                      {/* Reset to Defaults Action */}
                      <div className="pt-1 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-slate-500 hover:text-indigo-600 gap-1 px-2"
                          onClick={handleResetDefaults}
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          Reset Defaults
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })()}

              {/* Color Grading Section */}
              {colorGradingMod && (
                <AccordionItem value="color" className="border border-slate-200 dark:border-white/10 rounded-md overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                  <AccordionTrigger
                    actions={
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          onClick={() => removeModifier(colorGradingMod.type)}
                          title="Remove modifier"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                        </Button>
                        <Switch
                          checked={colorGradingMod.params?.enabled !== false}
                          onCheckedChange={(val) => toggleModifier(colorGradingMod.type, val)}
                        />
                      </>
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Color Grading</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-3 space-y-3">
                    <ParameterSlider
                      label="Contrast"
                      value={colorGradingMod.params?.contrast ?? 1.0}
                      min={0.5}
                      max={2.0}
                      step={0.05}
                      defaultValue={1.0}
                      unit="x"
                      onChange={(v) => updateModifierParams(colorGradingMod.type, { contrast: v })}
                    />
                    <ParameterSlider
                      label="Saturation"
                      value={colorGradingMod.params?.saturation ?? 1.0}
                      min={0.0}
                      max={2.0}
                      step={0.05}
                      defaultValue={1.0}
                      unit="x"
                      onChange={(v) => updateModifierParams(colorGradingMod.type, { saturation: v })}
                    />
                    <ParameterSlider
                      label="Exposure"
                      value={colorGradingMod.params?.exposure ?? 0.0}
                      min={-1.0}
                      max={1.0}
                      step={0.05}
                      defaultValue={0.0}
                      unit="EV"
                      onChange={(v) => updateModifierParams(colorGradingMod.type, { exposure: v })}
                    />
                    <ParameterSlider
                      label="Vignette Intensity"
                      value={colorGradingMod.params?.vignette ?? 0.35}
                      min={0.0}
                      max={1.0}
                      step={0.05}
                      defaultValue={0.35}
                      onChange={(v) => updateModifierParams(colorGradingMod.type, { vignette: v })}
                    />
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Typography & Styling Section (Pure Attached-Only) */}
              {attachedModifierTypes.has('text/style') && (
                <AccordionItem value="typography" className="border border-slate-200 dark:border-white/10 rounded-md overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                  <AccordionTrigger
                    actions={
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          onClick={() => removeModifier('text/style')}
                          title="Remove modifier"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                        </Button>
                        <Switch
                          checked={textStyleMod?.params?.enabled !== false}
                          onCheckedChange={(val) => toggleModifier('text/style', val)}
                        />
                      </div>
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Typography & Karaoke</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-3 space-y-3">
                    {/* 1. Base Typography */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Base Typography</span>
                      <div className="space-y-1">
                        <span className="text-[11px] text-slate-600 dark:text-slate-400">Font Family</span>
                        <select
                          value={textStyleMod?.params?.fontFamily || 'Inter'}
                          onChange={(e) => updateModifierParams('text/style', { fontFamily: e.target.value })}
                          className="w-full h-7 text-xs border border-slate-200 dark:border-white/10 rounded px-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        >
                          <option value="Inter">Inter (Sans-Serif)</option>
                          <option value="Fira Code">Fira Code (Monospace)</option>
                          <option value="Outfit">Outfit (Modern Clean)</option>
                          <option value="Cinzel">Cinzel (Cinematic Serif)</option>
                          <option value="Montserrat">Montserrat (Geometric)</option>
                        </select>
                      </div>
                      <ParameterSlider
                        label="Font Size"
                        value={textStyleMod?.params?.fontSize ?? 28}
                        min={12}
                        max={120}
                        step={1}
                        defaultValue={28}
                        unit="px"
                        onChange={(v) => updateModifierParams('text/style', { fontSize: v })}
                      />
                      <ParameterSlider
                        label="Font Weight"
                        value={textStyleMod?.params?.fontWeight ?? 600}
                        min={300}
                        max={900}
                        step={100}
                        defaultValue={600}
                        onChange={(v) => updateModifierParams('text/style', { fontWeight: v })}
                      />
                      <ParameterSlider
                        label="Letter Spacing"
                        value={textStyleMod?.params?.letterSpacing ?? 0}
                        min={-2}
                        max={10}
                        step={0.5}
                        defaultValue={0}
                        unit="px"
                        onChange={(v) => updateModifierParams('text/style', { letterSpacing: v })}
                      />
                      <ColorPickerRow
                        label="Text Fill Color"
                        value={textStyleMod?.params?.fillColor || '#ffffff'}
                        presets={[
                          { name: 'Pure White', hex: '#ffffff' },
                          { name: 'Cyber Yellow', hex: '#facc15' },
                          { name: 'Neon Green', hex: '#4ade80' },
                          { name: 'Cyan Glow', hex: '#22d3ee' },
                          { name: 'Dark Slate', hex: '#0f172a' },
                        ]}
                        onChange={(hex) => updateModifierParams('text/style', { fillColor: hex })}
                      />
                      <ColorPickerRow
                        label="Glow / Shadow Color"
                        value={textStyleMod?.params?.glowColor || '#00d4ff'}
                        presets={[
                          { name: 'Cyan Neon', hex: '#00d4ff' },
                          { name: 'Electric Violet', hex: '#8b5cf6' },
                          { name: 'Hot Pink', hex: '#ec4899' },
                          { name: 'Amber Gold', hex: '#f59e0b' },
                        ]}
                        onChange={(hex) => updateModifierParams('text/style', { glowColor: hex })}
                      />
                    </div>

                    {/* 2. Active-Word Karaoke Glow (Dual-State) */}
                    <div className="pt-2 border-t border-slate-200/80 dark:border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Active-Word Karaoke
                        </span>
                        <Switch
                          checked={(textStyleMod?.params?.activeWordHighlight as any)?.enabled !== false}
                          onCheckedChange={(val) => {
                            const prev = (textStyleMod?.params?.activeWordHighlight as any) || {};
                            updateModifierParams('text/style', {
                              activeWordHighlight: { ...prev, enabled: val },
                            });
                          }}
                        />
                      </div>

                      {((textStyleMod?.params?.activeWordHighlight as any)?.enabled !== false) && (
                        <div className="space-y-2.5 bg-amber-500/5 p-2 rounded border border-amber-500/20">
                          <div className="space-y-1">
                            <span className="text-[11px] text-slate-600 dark:text-slate-400">Animation Preset</span>
                            <div className="grid grid-cols-4 gap-1">
                              {(['pop', 'glow_pulse', 'bounce', 'wave'] as const).map((preset) => {
                                const currentPreset = (textStyleMod?.params?.activeWordHighlight as any)?.animationPreset || 'pop';
                                return (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => {
                                      const prev = (textStyleMod?.params?.activeWordHighlight as any) || {};
                                      updateModifierParams('text/style', {
                                        activeWordHighlight: { ...prev, animationPreset: preset },
                                      });
                                    }}
                                    className={`px-1.5 py-1 text-[9px] rounded font-mono capitalize transition-all cursor-pointer ${
                                      currentPreset === preset
                                        ? 'bg-amber-500 text-slate-950 font-bold'
                                        : 'bg-white/50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                                    }`}
                                  >
                                    {preset.replace('_', ' ')}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <ParameterSlider
                            label="Active Word Scale"
                            value={(textStyleMod?.params?.activeWordHighlight as any)?.scale ?? 1.15}
                            min={1.0}
                            max={1.5}
                            step={0.05}
                            defaultValue={1.15}
                            unit="x"
                            onChange={(v) => {
                              const prev = (textStyleMod?.params?.activeWordHighlight as any) || {};
                              updateModifierParams('text/style', {
                                activeWordHighlight: { ...prev, scale: v },
                              });
                            }}
                          />

                          <ColorPickerRow
                            label="Active Word Fill"
                            value={(textStyleMod?.params?.activeWordHighlight as any)?.fillColor || '#facc15'}
                            presets={[
                              { name: 'Gold Pop', hex: '#facc15' },
                              { name: 'Neon Coral', hex: '#f43f5e' },
                              { name: 'Electric Cyan', hex: '#00d4ff' },
                              { name: 'Lime Glow', hex: '#a3e635' },
                            ]}
                            onChange={(hex) => {
                              const prev = (textStyleMod?.params?.activeWordHighlight as any) || {};
                              updateModifierParams('text/style', {
                                activeWordHighlight: { ...prev, fillColor: hex },
                              });
                            }}
                          />

                          <ColorPickerRow
                            label="Karaoke Glow Color"
                            value={(textStyleMod?.params?.activeWordHighlight as any)?.glowColor || textStyleMod?.params?.glowColor || '#00d4ff'}
                            presets={[
                              { name: 'Cyan Neon', hex: '#00d4ff' },
                              { name: 'Electric Violet', hex: '#8b5cf6' },
                              { name: 'Hot Pink', hex: '#ec4899' },
                              { name: 'Amber Gold', hex: '#f59e0b' },
                            ]}
                            onChange={(hex) => {
                              const prev = (textStyleMod?.params?.activeWordHighlight as any) || {};
                              updateModifierParams('text/style', {
                                activeWordHighlight: { ...prev, glowColor: hex },
                                glowColor: hex,
                              });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Audio Ducking & Pan Section (Pure Attached-Only) */}
              {(attachedModifierTypes.has('sfx/dynamic_ducking') || attachedModifierTypes.has('audio/volume')) && (
                <AccordionItem value="audio" className="border border-slate-200 dark:border-white/10 rounded-md overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                  <AccordionTrigger
                    actions={
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          onClick={() => removeModifier(duckingMod?.type || 'sfx/dynamic_ducking')}
                          title="Remove modifier"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                        </Button>
                        <Switch
                          checked={duckingMod?.params?.enabled !== false}
                          onCheckedChange={(val) => toggleModifier(duckingMod?.type || 'sfx/dynamic_ducking', val)}
                        />
                      </div>
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Audio Ducking & Pan</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-3 space-y-3">
                    <ParameterSlider
                      label="Ducking Volume"
                      value={duckingMod?.params?.duckVolume ?? 0.25}
                      min={0.0}
                      max={1.0}
                      step={0.05}
                      defaultValue={0.25}
                      onChange={(v) => updateModifierParams(duckingMod?.type || 'sfx/dynamic_ducking', { duckVolume: v })}
                    />
                    <ParameterSlider
                      label="Attack Time"
                      value={duckingMod?.params?.attackMs ?? 150}
                      min={10}
                      max={1000}
                      step={10}
                      defaultValue={150}
                      unit="ms"
                      onChange={(v) => updateModifierParams(duckingMod?.type || 'sfx/dynamic_ducking', { attackMs: v })}
                    />
                    <ParameterSlider
                      label="Release Time"
                      value={duckingMod?.params?.releaseMs ?? 300}
                      min={50}
                      max={2000}
                      step={25}
                      defaultValue={300}
                      unit="ms"
                      onChange={(v) => updateModifierParams(duckingMod?.type || 'sfx/dynamic_ducking', { releaseMs: v })}
                    />
                    <ParameterSlider
                      label="Stereo Pan"
                      value={duckingMod?.params?.stereoPan ?? 0.0}
                      min={-1.0}
                      max={1.0}
                      step={0.05}
                      defaultValue={0.0}
                      onChange={(v) => updateModifierParams(duckingMod?.type || 'sfx/dynamic_ducking', { stereoPan: v })}
                    />
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Procedural Audio Synthesizer (Pure Attached-Only) */}
              {attachedModifierTypes.has('sfx/procedural') && (
                <AccordionItem value="procedural_sfx" className="border border-slate-200 dark:border-white/10 rounded-md overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                  <AccordionTrigger
                    actions={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        onClick={() => removeModifier('sfx/procedural')}
                        title="Remove modifier"
                      >
                        <Trash2 className="w-3 h-3 text-rose-500" />
                      </Button>
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-cyan-500" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Procedural SFX Synth</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-3 space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Synth Sound Type</span>
                      <div className="grid grid-cols-3 gap-1">
                        {(['impact', 'whoosh', 'glitch', 'riser', 'laser'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setSynthType(t)}
                            className={`px-2 py-1 text-[10px] font-mono rounded-lg border capitalize transition-all cursor-pointer ${
                              synthType === t
                                ? 'bg-[var(--accent-primary)] text-slate-950 font-bold border-transparent shadow-xs'
                                : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-foreground/80 hover:bg-white/10'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <ParameterSlider
                      label="SFX Duration"
                      value={synthDuration}
                      min={0.2}
                      max={4.0}
                      step={0.1}
                      defaultValue={1.5}
                      unit="s"
                      onChange={setSynthDuration}
                    />

                    <ParameterSlider
                      label="Auto-Ducking Level"
                      value={synthDucking}
                      min={0.0}
                      max={1.0}
                      step={0.05}
                      defaultValue={0.75}
                      onChange={setSynthDucking}
                    />

                    <div className="flex items-center gap-2 pt-2 border-t border-[var(--glass-border)]">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAuditionSFX}
                        disabled={isPlayingAudition}
                        className="flex-1 text-[11px] font-mono gap-1.5 cursor-pointer hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                      >
                        <Volume2 className={`w-3.5 h-3.5 ${isPlayingAudition ? 'text-[var(--accent-primary)] animate-pulse' : ''}`} />
                        {isPlayingAudition ? 'Playing...' : 'Audition SFX'}
                      </Button>

                      <Button
                        size="sm"
                        onClick={handleInsertProceduralSFX}
                        className="flex-1 text-[11px] font-mono gap-1.5 cursor-pointer bg-[var(--accent-primary)] text-slate-950 hover:brightness-110 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Insert to Track
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </div>
        ) : (
          /* Fallback State: Project & Canvas Settings */
          <div className="space-y-4 py-2">
            <div className="text-center pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2">
                <Settings className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-800 text-xs">Project Master Settings</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Global canvas & timeline configuration
              </p>
            </div>

            <Card className="p-3 bg-slate-50/60 border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-slate-400" />
                  Resolution
                </span>
                <span className="font-mono font-medium text-slate-800 text-[11px]">
                  {width} × {height} ({((width / Math.max(1, height))).toFixed(2)}:1)
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Frame Rate
                </span>
                <span className="font-mono font-medium text-slate-800 text-[11px]">
                  {fps} FPS
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-400" />
                  Color Space
                </span>
                <span className="font-mono text-slate-700 text-[11px]">
                  Rec.709 / sRGB (8-bit)
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-slate-400" />
                  Master Duration
                </span>
                <span className="font-mono font-medium text-slate-800 text-[11px]">
                  {totalDurationFrames}f ({(totalDurationFrames / Math.max(1, fps)).toFixed(2)}s)
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  Active Tracks
                </span>
                <Badge variant="outline" className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border-indigo-200">
                  {irState.doc.tracks.length} Tracks
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[11px]">Active Sequences</span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {activeSequencesCount} Sequences
                </Badge>
              </div>
            </Card>

            <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-200 text-amber-800 text-[11px] space-y-1">
              <span className="font-semibold block">Inspector Navigation Tip:</span>
              <p className="text-amber-700 leading-normal">
                Click any sequence on the timeline or directly on the canvas to inspect and edit its 3D, visual, and audio properties.
              </p>
            </div>
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
