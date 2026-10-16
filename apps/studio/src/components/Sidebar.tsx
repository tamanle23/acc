import React, { useState, useEffect } from 'react';
import {
  Folder,
  Sliders,
  Film,
  Volume2,
  Search,
  Palette,
  Sparkles,
  Layers,
  Box,
  Camera,
  Type,
  RotateCcw,
  Trash2,
  Plus,
  Check,
  Flame,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
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

interface SidebarProps {
  activeTab: 'vault' | 'inspector';
  setActiveTab: (tab: 'vault' | 'inspector') => void;
  assets?: { inputs: any[]; outputs: any[] };
}

interface ParameterSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
  onChange: (value: number) => void;
}

function ParameterSlider({
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

interface ColorPickerRowProps {
  label: string;
  value: string;
  presets: { name: string; hex: string }[];
  onChange: (hex: string) => void;
}

function ColorPickerRow({ label, value, presets, onChange }: ColorPickerRowProps) {
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
            className={`w-4 h-4 rounded-full border transition-transform hover:scale-125 ${
              value.toLowerCase() === preset.hex.toLowerCase()
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

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());

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

  const relightMod = modifiers.find((m: any) => m.type === 'vfx/depth_relighting' || m.type === 'vfx/depth3d_relighting');
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

  // Modifier Definitions for "Add Modifier" Dropdown
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

  // Assets Vault Filter
  const assetList = Object.entries(irState.doc.assets || {}).map(([id, asset]) => ({
    id,
    ...asset,
  }));

  const filteredAssets = assetList.filter(
    (a) => a.id.toLowerCase().includes(filterQuery.toLowerCase()) || a.src.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <aside className="w-84 bg-white border-l border-slate-200 flex flex-col h-full select-none shadow-xs">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'vault' | 'inspector')}
        className="flex flex-col h-full"
      >
        {/* Tabs Header */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/50">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vault" className="gap-2">
              <Folder className="w-3.5 h-3.5" />
              IR Assets
            </TabsTrigger>
            <TabsTrigger value="inspector" className="gap-2">
              <Sliders className="w-3.5 h-3.5" />
              Inspector
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Video IR Asset Vault */}
        <TabsContent value="vault" className="flex-1 flex flex-col m-0 overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Filter IR assets..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-50/50"
              />
            </div>
          </div>

          <ScrollArea className="flex-1 p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Registered IR Assets
              </h3>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {filteredAssets.length}
              </Badge>
            </div>

            {filteredAssets.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No assets registered in Video IR.</p>
            ) : (
              <div className="space-y-2">
                {filteredAssets.map((asset) => (
                  <Card
                    key={asset.id}
                    className="p-2.5 border-slate-200 hover:border-indigo-300 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-900 truncate text-xs font-mono">
                        {asset.id}
                      </span>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono">
                        {asset.type}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate font-mono">{asset.src}</p>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Tab 2: Deep Live Modifier Inspector */}
        <TabsContent value="inspector" className="flex-1 flex flex-col m-0 overflow-hidden">
          <ScrollArea className="flex-1 p-3 space-y-4">
            {/* Inspector Header & Add Modifier Dropdown */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Inspector
                </h3>
                <Badge variant="outline" className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border-indigo-200">
                  {selectedSeqId || 'None'}
                </Badge>
              </div>

              {selectedSeq && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 px-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
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

            {!selectedSeq ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                Select a sequence on the timeline to inspect and edit its 3D, VFX, and audio parameters.
              </p>
            ) : (
              <div className="space-y-3">
                {/* General Sequence Info Card */}
                <Card className="p-2.5 bg-slate-50/70 border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[11px]">Track:</span>
                    <span className="font-mono font-medium text-slate-800 text-[11px]">{selectedTrack?.id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[11px]">Type:</span>
                    <Badge variant="secondary" className="font-mono text-[9px] uppercase">
                      {selectedTrack?.type}
                    </Badge>
                  </div>
                  {selectedSeq.assetId && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[11px]">Asset:</span>
                      <span className="font-mono text-slate-700 truncate max-w-[140px] text-[11px]">
                        {selectedSeq.assetId}
                      </span>
                    </div>
                  )}
                </Card>

                {/* Collapsible Accordion Sections */}
                <Accordion
                  type="multiple"
                  defaultValue={['relighting', 'camera', 'particles', 'color', 'typography', 'audio']}
                  className="space-y-2"
                >
                  {/* 1. 3D Depth Relighting Section */}
                  {relightMod && (
                    <AccordionItem value="relighting" className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-2xs">
                      <AccordionTrigger className="px-3 py-2 hover:no-underline bg-slate-50/50">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="text-xs font-bold text-slate-800">3D Relighting</span>
                          </div>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-slate-700"
                              onClick={() =>
                                updateModifierParams(relightMod.type, {
                                  lightColor: '#00d4ff',
                                  lightX: 2.0,
                                  lightY: 2.0,
                                  lightZ: 5.0,
                                  diffuse: 1.0,
                                  specular: 1.2,
                                  shininess: 32,
                                  rimIntensity: 0.5,
                                })
                              }
                              title="Reset defaults"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-rose-400 hover:text-rose-600"
                              onClick={() => removeModifier(relightMod.type)}
                              title="Remove effect"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                            <Switch
                              checked={relightMod.params?.enabled !== false}
                              onCheckedChange={(val) => toggleModifier(relightMod.type, val)}
                            />
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-3 space-y-3">
                        <ColorPickerRow
                          label="Light Color"
                          value={relightMod.params?.lightColor || '#00d4ff'}
                          presets={[
                            { name: 'Cold Cyber Blue', hex: '#00d4ff' },
                            { name: 'Warm Tungsten', hex: '#ffb366' },
                            { name: 'Sunset Amber', hex: '#ff5500' },
                            { name: 'Toxic Acid', hex: '#39ff14' },
                            { name: 'Neon Pink', hex: '#ff007f' },
                          ]}
                          onChange={(hex) => updateModifierParams(relightMod.type, { lightColor: hex })}
                        />
                        <ParameterSlider
                          label="Light X Position"
                          value={relightMod.params?.lightX ?? 2.0}
                          min={-5.0}
                          max={5.0}
                          step={0.1}
                          defaultValue={2.0}
                          unit="m"
                          onChange={(v) => updateModifierParams(relightMod.type, { lightX: v })}
                        />
                        <ParameterSlider
                          label="Light Y Position"
                          value={relightMod.params?.lightY ?? 2.0}
                          min={-5.0}
                          max={5.0}
                          step={0.1}
                          defaultValue={2.0}
                          unit="m"
                          onChange={(v) => updateModifierParams(relightMod.type, { lightY: v })}
                        />
                        <ParameterSlider
                          label="Light Z Position (Depth)"
                          value={relightMod.params?.lightZ ?? 5.0}
                          min={0.1}
                          max={10.0}
                          step={0.1}
                          defaultValue={5.0}
                          unit="m"
                          onChange={(v) => updateModifierParams(relightMod.type, { lightZ: v })}
                        />
                        <ParameterSlider
                          label="Diffuse Intensity"
                          value={relightMod.params?.diffuse ?? 1.0}
                          min={0.0}
                          max={2.0}
                          step={0.05}
                          defaultValue={1.0}
                          onChange={(v) => updateModifierParams(relightMod.type, { diffuse: v })}
                        />
                        <ParameterSlider
                          label="Specular Power"
                          value={relightMod.params?.specular ?? 1.2}
                          min={0.0}
                          max={3.0}
                          step={0.05}
                          defaultValue={1.2}
                          onChange={(v) => updateModifierParams(relightMod.type, { specular: v })}
                        />
                        <ParameterSlider
                          label="Shininess Exponent"
                          value={relightMod.params?.shininess ?? 32}
                          min={4}
                          max={128}
                          step={1}
                          defaultValue={32}
                          onChange={(v) => updateModifierParams(relightMod.type, { shininess: v })}
                        />
                        <ParameterSlider
                          label="Rim Light Intensity"
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

                  {/* 2. 3D Camera & Rack Focus Section */}
                  {cameraMod && (
                    <AccordionItem value="camera" className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-2xs">
                      <AccordionTrigger className="px-3 py-2 hover:no-underline bg-slate-50/50">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5 text-violet-600" />
                            <span className="text-xs font-bold text-slate-800">3D Camera & Lens</span>
                          </div>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-slate-700"
                              onClick={() =>
                                updateModifierParams(cameraMod.type, {
                                  eyeX: 0.0,
                                  eyeY: 0.0,
                                  eyeZ: 10.0,
                                  fov: 45,
                                  roll: 0,
                                  focalDistance: 2.5,
                                  focalRange: 1.0,
                                  bokehRadius: 6.0,
                                })
                              }
                              title="Reset defaults"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-rose-400 hover:text-rose-600"
                              onClick={() => removeModifier(cameraMod.type)}
                              title="Remove camera"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                            <Switch
                              checked={cameraMod.params?.enabled !== false}
                              onCheckedChange={(val) => toggleModifier(cameraMod.type, val)}
                            />
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-3 space-y-3">
                        <ParameterSlider
                          label="Field of View (FOV)"
                          value={cameraMod.params?.fov ?? 45}
                          min={15}
                          max={120}
                          step={1}
                          defaultValue={45}
                          unit="°"
                          onChange={(v) => updateModifierParams(cameraMod.type, { fov: v })}
                        />
                        <ParameterSlider
                          label="Camera Roll Angle"
                          value={cameraMod.params?.roll ?? 0}
                          min={-180}
                          max={180}
                          step={1}
                          defaultValue={0}
                          unit="°"
                          onChange={(v) => updateModifierParams(cameraMod.type, { roll: v })}
                        />
                        <ParameterSlider
                          label="Camera Eye X"
                          value={cameraMod.params?.eyeX ?? 0.0}
                          min={-10.0}
                          max={10.0}
                          step={0.1}
                          defaultValue={0.0}
                          unit="m"
                          onChange={(v) => updateModifierParams(cameraMod.type, { eyeX: v })}
                        />
                        <ParameterSlider
                          label="Camera Eye Y"
                          value={cameraMod.params?.eyeY ?? 0.0}
                          min={-10.0}
                          max={10.0}
                          step={0.1}
                          defaultValue={0.0}
                          unit="m"
                          onChange={(v) => updateModifierParams(cameraMod.type, { eyeY: v })}
                        />
                        <ParameterSlider
                          label="Camera Eye Z (Dolly)"
                          value={cameraMod.params?.eyeZ ?? 10.0}
                          min={1.0}
                          max={20.0}
                          step={0.1}
                          defaultValue={10.0}
                          unit="m"
                          onChange={(v) => updateModifierParams(cameraMod.type, { eyeZ: v })}
                        />
                        <div className="pt-1 border-t border-slate-100">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                            Rack Focus & Bokeh
                          </span>
                          <ParameterSlider
                            label="Focal Distance"
                            value={cameraMod.params?.focalDistance ?? 2.5}
                            min={0.1}
                            max={10.0}
                            step={0.1}
                            defaultValue={2.5}
                            unit="m"
                            onChange={(v) => updateModifierParams(cameraMod.type, { focalDistance: v })}
                          />
                          <ParameterSlider
                            label="Focal Range Depth"
                            value={cameraMod.params?.focalRange ?? 1.0}
                            min={0.1}
                            max={5.0}
                            step={0.1}
                            defaultValue={1.0}
                            unit="m"
                            onChange={(v) => updateModifierParams(cameraMod.type, { focalRange: v })}
                          />
                          <ParameterSlider
                            label="Bokeh Blur Radius"
                            value={cameraMod.params?.bokehRadius ?? 6.0}
                            min={0.0}
                            max={20.0}
                            step={0.5}
                            defaultValue={6.0}
                            unit="px"
                            onChange={(v) => updateModifierParams(cameraMod.type, { bokehRadius: v })}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* 3. Particle VFX & Shaders Section */}
                  {particleMod && (
                    <AccordionItem value="particles" className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-2xs">
                      <AccordionTrigger className="px-3 py-2 hover:no-underline bg-slate-50/50">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-cyan-600" />
                            <span className="text-xs font-bold text-slate-800">Particle VFX & Shaders</span>
                          </div>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-slate-700"
                              onClick={() =>
                                updateModifierParams(particleMod.type, {
                                  preset: 'cyber_sparks',
                                  particleCount: 1500,
                                  gravity: -1.2,
                                  drag: 0.15,
                                  turbulence: 1.0,
                                  bloomThreshold: 0.7,
                                  chromaticAberration: 2.0,
                                })
                              }
                              title="Reset defaults"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-rose-400 hover:text-rose-600"
                              onClick={() => removeModifier(particleMod.type)}
                              title="Remove particles"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                            <Switch
                              checked={particleMod.params?.enabled !== false}
                              onCheckedChange={(val) => toggleModifier(particleMod.type, val)}
                            />
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-3 space-y-3">
                        {/* Preset Badges */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] text-slate-600">Particle Preset</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {['cyber_sparks', 'cosmic_dust', 'matrix_rain', 'magic_embers'].map((pst) => (
                              <button
                                key={pst}
                                onClick={() => updateModifierParams(particleMod.type, { preset: pst })}
                                className={`text-[10px] font-mono py-1 px-2 rounded border transition-colors ${
                                  (particleMod.params?.preset || 'cyber_sparks') === pst
                                    ? 'bg-cyan-50 border-cyan-400 text-cyan-800 font-semibold shadow-2xs'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {pst.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>

                        <ParameterSlider
                          label="Particle Count"
                          value={particleMod.params?.particleCount ?? 1500}
                          min={100}
                          max={20000}
                          step={100}
                          defaultValue={1500}
                          onChange={(v) => updateModifierParams(particleMod.type, { particleCount: v })}
                        />
                        <ParameterSlider
                          label="Gravity"
                          value={particleMod.params?.gravity ?? -1.2}
                          min={-9.8}
                          max={9.8}
                          step={0.1}
                          defaultValue={-1.2}
                          unit="m/s²"
                          onChange={(v) => updateModifierParams(particleMod.type, { gravity: v })}
                        />
                        <ParameterSlider
                          label="Air Drag"
                          value={particleMod.params?.drag ?? 0.15}
                          min={0.0}
                          max={1.0}
                          step={0.01}
                          defaultValue={0.15}
                          onChange={(v) => updateModifierParams(particleMod.type, { drag: v })}
                        />
                        <ParameterSlider
                          label="Simplex Turbulence"
                          value={particleMod.params?.turbulence ?? 1.0}
                          min={0.0}
                          max={5.0}
                          step={0.1}
                          defaultValue={1.0}
                          onChange={(v) => updateModifierParams(particleMod.type, { turbulence: v })}
                        />
                        <div className="pt-1 border-t border-slate-100">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                            Post Processing Shaders
                          </span>
                          <ParameterSlider
                            label="Bloom Threshold"
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
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* 4. Color Grading Section */}
                  {colorGradingMod && (
                    <AccordionItem value="color" className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-2xs">
                      <AccordionTrigger className="px-3 py-2 hover:no-underline bg-slate-50/50">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-1.5">
                            <Palette className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-xs font-bold text-slate-800">Color Grading</span>
                          </div>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-slate-700"
                              onClick={() =>
                                updateModifierParams(colorGradingMod.type, {
                                  contrast: 1.0,
                                  saturation: 1.0,
                                  exposure: 0.0,
                                  vignette: 0.35,
                                })
                              }
                              title="Reset defaults"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-rose-400 hover:text-rose-600"
                              onClick={() => removeModifier(colorGradingMod.type)}
                              title="Remove color grading"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                            <Switch
                              checked={colorGradingMod.params?.enabled !== false}
                              onCheckedChange={(val) => toggleModifier(colorGradingMod.type, val)}
                            />
                          </div>
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

                  {/* 5. Typography & Styling Section (if text sequence) */}
                  {(textStyleMod || selectedSeq.cues || selectedTrack?.type === 'timed_text') && (
                    <AccordionItem value="typography" className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-2xs">
                      <AccordionTrigger className="px-3 py-2 hover:no-underline bg-slate-50/50">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-1.5">
                            <Type className="w-3.5 h-3.5 text-amber-600" />
                            <span className="text-xs font-bold text-slate-800">Typography & Styling</span>
                          </div>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-slate-700"
                              onClick={() =>
                                updateModifierParams('text/style', {
                                  fontFamily: 'Inter',
                                  fontSize: 28,
                                  fontWeight: 600,
                                  letterSpacing: 0,
                                  fillColor: '#ffffff',
                                  strokeColor: '#000000',
                                  strokeWidth: 2,
                                  shadowBlur: 6,
                                  glowColor: '#00d4ff',
                                })
                              }
                              title="Reset defaults"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                            <Switch
                              checked={textStyleMod?.params?.enabled !== false}
                              onCheckedChange={(val) => toggleModifier('text/style', val)}
                            />
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-3 space-y-3">
                        <div className="space-y-1">
                          <span className="text-[11px] text-slate-600">Font Family</span>
                          <select
                            value={textStyleMod?.params?.fontFamily || 'Inter'}
                            onChange={(e) => updateModifierParams('text/style', { fontFamily: e.target.value })}
                            className="w-full h-7 text-xs border border-slate-200 rounded px-2 bg-white"
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
                          label="Active Word Karaoke Glow"
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

                  {/* 6. Audio Dynamic Ducking & Pan Section */}
                  {(duckingMod || selectedTrack?.type === 'audio') && (
                    <AccordionItem value="audio" className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-2xs">
                      <AccordionTrigger className="px-3 py-2 hover:no-underline bg-slate-50/50">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-1.5">
                            <Volume2 className="w-3.5 h-3.5 text-rose-600" />
                            <span className="text-xs font-bold text-slate-800">Audio Ducking & Pan</span>
                          </div>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-slate-700"
                              onClick={() =>
                                updateModifierParams('sfx/dynamic_ducking', {
                                  duckVolume: 0.25,
                                  attackMs: 150,
                                  releaseMs: 300,
                                  stereoPan: 0.0,
                                  targetBus: 'track-a2',
                                })
                              }
                              title="Reset defaults"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                            <Switch
                              checked={duckingMod?.params?.enabled !== false}
                              onCheckedChange={(val) => toggleModifier('sfx/dynamic_ducking', val)}
                            />
                          </div>
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
                          unit="%"
                          onChange={(v) => updateModifierParams('sfx/dynamic_ducking', { duckVolume: v })}
                        />
                        <ParameterSlider
                          label="Attack Slew"
                          value={duckingMod?.params?.attackMs ?? 150}
                          min={10}
                          max={500}
                          step={10}
                          defaultValue={150}
                          unit="ms"
                          onChange={(v) => updateModifierParams('sfx/dynamic_ducking', { attackMs: v })}
                        />
                        <ParameterSlider
                          label="Release Slew"
                          value={duckingMod?.params?.releaseMs ?? 300}
                          min={50}
                          max={2000}
                          step={50}
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
                          unit=""
                          onChange={(v) => updateModifierParams('sfx/dynamic_ducking', { stereoPan: v })}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
