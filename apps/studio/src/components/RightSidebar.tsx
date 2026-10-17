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

  // Modifiers lookup
  const modifiers = selectedSeq?.modifiers || [];

  const transformMod = modifiers.find((m: any) => m.type === 'transform');
  const relightMod = modifiers.find(
    (m: any) => m.type === 'vfx/depth_relighting' || m.type === 'vfx/depth3d_relighting'
  );
  const cameraMod = modifiers.find((m: any) => m.type === 'camera/3d' || m.type === 'camera/path');
  const particleMod = modifiers.find((m: any) => m.type === 'overlay/canvas_particles');
  const colorGradingMod = modifiers.find((m: any) => m.type === 'vfx/color_grading');
  const textStyleMod = modifiers.find((m: any) => m.type === 'text/style');
  const duckingMod = modifiers.find((m: any) => m.type === 'sfx/dynamic_ducking');

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

  const AVAILABLE_MODIFIERS = [
    {
      type: 'vfx/depth_relighting',
      name: '3D Relighting',
      icon: Sparkles,
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
    {
      type: 'camera/3d',
      name: '3D Camera & Lens',
      icon: Camera,
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
    {
      type: 'overlay/canvas_particles',
      name: 'Particle VFX & Shaders',
      icon: Layers,
      defaultParams: {
        enabled: true,
        preset: 'cyber_sparks',
        particleCount: 1500,
        gravity: -1.2,
        drag: 0.15,
        turbulence: 1.0,
        bloomThreshold: 0.7,
        chromaticAberration: 2.0,
      },
    },
    {
      type: 'vfx/color_grading',
      name: 'Color Grading',
      icon: Palette,
      defaultParams: {
        enabled: true,
        contrast: 1.0,
        saturation: 1.0,
        exposure: 0.0,
        vignette: 0.35,
      },
    },
    {
      type: 'text/style',
      name: 'Typography & Styling',
      icon: Type,
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
      },
    },
    {
      type: 'sfx/dynamic_ducking',
      name: 'Audio Ducking & Pan',
      icon: Volume2,
      defaultParams: {
        enabled: true,
        duckVolume: 0.25,
        attackMs: 150,
        releaseMs: 300,
        stereoPan: 0.0,
        targetBus: 'track-a2',
      },
    },
  ];

  const width = irState.doc.meta?.canvasSize?.w || 1920;
  const height = irState.doc.meta?.canvasSize?.h || 1080;
  const fps = irState.doc.meta?.globalFps || 30;
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
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                {AVAILABLE_MODIFIERS.map((mod) => {
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
                    {selectedSeq.durationFrames ?? 30}f
                  </span>
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

            {/* Accordion Panels */}
            <Accordion type="multiple" defaultValue={['transform', 'relighting', 'camera']} className="space-y-2">
              {/* Transform Section */}
              <AccordionItem value="transform" className="border border-slate-200 dark:border-white/10 rounded-md overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                <AccordionTrigger
                  actions={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      onClick={() => updateModifierParams('transform', { x: 0, y: 0, scale: 1.0, rotation: 0 })}
                      title="Reset transform"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
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

                  <div className="pt-2 border-t border-[var(--glass-border)]">
                    <EasingCurveSelector
                      value={(transformMod?.params as any)?.ease || 'power2.out'}
                      onChange={(ease) =>
                        updateModifierParams('transform', { ...transformMod?.params, ease })
                      }
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

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

              {/* Particle VFX & Shaders Section */}
              {particleMod && (
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
                    <ParameterSlider
                      label="Particle Count"
                      value={particleMod.params?.particleCount ?? 1500}
                      min={200}
                      max={5000}
                      step={100}
                      defaultValue={1500}
                      onChange={(v) => updateModifierParams(particleMod.type, { particleCount: v })}
                    />
                    <ParameterSlider
                      label="Bloom Glow Threshold"
                      value={particleMod.params?.bloomThreshold ?? 0.7}
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      defaultValue={0.7}
                      onChange={(v) => updateModifierParams(particleMod.type, { bloomThreshold: v })}
                    />
                    <ParameterSlider
                      label="Chromatic Aberration"
                      value={particleMod.params?.chromaticAberration ?? 2.0}
                      min={0.0}
                      max={10.0}
                      step={0.5}
                      defaultValue={2.0}
                      unit="px"
                      onChange={(v) => updateModifierParams(particleMod.type, { chromaticAberration: v })}
                    />
                  </AccordionContent>
                </AccordionItem>
              )}

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

              {/* Typography & Styling Section */}
              {(textStyleMod || selectedSeq.cues || selectedTrack?.type === 'timed_text') && (
                <AccordionItem value="typography" className="border border-slate-200 dark:border-white/10 rounded-md overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                  <AccordionTrigger
                    actions={
                      <Switch
                        checked={textStyleMod?.params?.enabled !== false}
                        onCheckedChange={(val) => toggleModifier('text/style', val)}
                      />
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Typography & Styling</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-3 space-y-3">
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
                      label="Active Word Glow"
                      value={textStyleMod?.params?.glowColor || '#00d4ff'}
                      presets={[
                        { name: 'Cyan Neon', hex: '#00d4ff' },
                        { name: 'Electric Violet', hex: '#8b5cf6' },
                        { name: 'Hot Pink', hex: '#ec4899' },
                        { name: 'Amber Gold', hex: '#f59e0b' },
                      ]}
                      onChange={(hex) => updateModifierParams('text/style', { glowColor: hex })}
                    />
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Audio Ducking & Pan Section */}
              {(duckingMod || selectedTrack?.type === 'audio') && (
                <AccordionItem value="audio" className="border border-slate-200 dark:border-white/10 rounded-md overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                  <AccordionTrigger
                    actions={
                      <Switch
                        checked={duckingMod?.params?.enabled !== false}
                        onCheckedChange={(val) => toggleModifier('sfx/dynamic_ducking', val)}
                      />
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
                      onChange={(v) => updateModifierParams('sfx/dynamic_ducking', { duckVolume: v })}
                    />
                    <ParameterSlider
                      label="Attack Time"
                      value={duckingMod?.params?.attackMs ?? 150}
                      min={10}
                      max={1000}
                      step={10}
                      defaultValue={150}
                      unit="ms"
                      onChange={(v) => updateModifierParams('sfx/dynamic_ducking', { attackMs: v })}
                    />
                    <ParameterSlider
                      label="Release Time"
                      value={duckingMod?.params?.releaseMs ?? 300}
                      min={50}
                      max={2000}
                      step={25}
                      defaultValue={300}
                      unit="ms"
                      onChange={(v) => updateModifierParams('sfx/dynamic_ducking', { releaseMs: v })}
                    />
                    <ParameterSlider
                      label="Stereo Pan"
                      value={duckingMod?.params?.stereoPan ?? 0.0}
                      min={-1.0}
                      max={1.0}
                      step={0.05}
                      defaultValue={0.0}
                      onChange={(v) => updateModifierParams('sfx/dynamic_ducking', { stereoPan: v })}
                    />
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Procedural Audio Synthesizer (On-Demand SFX) */}
              <AccordionItem value="procedural_sfx" className="border border-slate-200 dark:border-white/10 rounded-md overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                <AccordionTrigger>
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
