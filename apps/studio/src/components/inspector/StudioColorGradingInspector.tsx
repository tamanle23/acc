import React, { useState, useRef, useCallback } from 'react';
import {
  Palette,
  RotateCcw,
  Sparkles,
  Sun,
  Aperture,
} from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { ColorGradingParams, ColorWheelValue } from '@acc/ir';

export interface StudioColorGradingInspectorProps {
  params: Record<string, unknown>;
  onChange: (nextParams: Record<string, unknown>) => void;
  disabled?: boolean;
}

/**
 * Interactive SVG 3-Way Color Wheel (Lift / Gamma / Gain / Offset).
 *
 * Implements ASC CDL & DaVinci Resolve color wheel ergonomics:
 * - Conic chromaticity gradient disc (Hue around circle, Saturation from center).
 * - Draggable puck with real-time polar-to-cartesian chromatic vector mapping.
 * - Double-click anywhere on the wheel or click reset button to return to neutral.
 * - Master luminance slider below the wheel.
 */
interface ColorWheelProps {
  label: string;
  sublabel: string;
  value?: unknown;
  onChange: (val: ColorWheelValue) => void;
  disabled?: boolean;
}

const ColorWheel: React.FC<ColorWheelProps> = ({
  label,
  sublabel,
  value,
  onChange,
  disabled = false,
}) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const radius = 34; // Wheel radius in px
  const center = 38; // Wheel center (76px width/height)

  // Defensively normalize wheel value object
  const val = (value && typeof value === 'object' && !Array.isArray(value))
    ? (value as Record<string, unknown>)
    : {};
  const rVal = typeof val.r === 'number' && Number.isFinite(val.r) ? val.r : 0;
  const gVal = typeof val.g === 'number' && Number.isFinite(val.g) ? val.g : 0;
  const bVal = typeof val.b === 'number' && Number.isFinite(val.b) ? val.b : 0;
  const yVal = typeof val.y === 'number' && Number.isFinite(val.y) ? val.y : 0;

  // Map RGB vector back to 2D puck position
  const puckX = center + (rVal - (gVal + bVal) * 0.5) * radius * 0.8;
  const puckY = center + ((gVal - bVal) * 0.866) * radius * 0.8;

  const handlePointerMove = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      if (disabled || !wheelRef.current) return;
      const rect = wheelRef.current.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);

      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const normDist = Math.min(1.0, dist / radius);

      // Convert polar chromaticity to RGB balance
      const r = Math.max(-1, Math.min(1, normDist * Math.cos(angle)));
      const g = Math.max(-1, Math.min(1, normDist * Math.cos(angle - (2 * Math.PI) / 3)));
      const b = Math.max(-1, Math.min(1, normDist * Math.cos(angle - (4 * Math.PI) / 3)));

      onChange({
        r: Number(r.toFixed(3)),
        g: Number(g.toFixed(3)),
        b: Number(b.toFixed(3)),
        y: yVal,
      });
    },
    [disabled, radius, onChange, yVal]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    handlePointerMove(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (disabled) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
    setIsDragging(false);
  };

  const handleReset = () => {
    if (disabled) return;
    onChange({ r: 0, g: 0, b: 0, y: 0 });
  };

  const hasModifications = rVal !== 0 || gVal !== 0 || bVal !== 0 || yVal !== 0;

  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-glass-surface/30 border border-glass-border">
      <div className="flex items-center justify-between w-full mb-1.5 px-0.5">
        <div>
          <span className="text-[11px] font-bold text-foreground block">{label}</span>
          <span className="text-[9px] text-muted-foreground block -mt-0.5">{sublabel}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled || !hasModifications}
          onClick={handleReset}
          className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
          title={`Reset ${label}`}
        >
          <RotateCcw className="w-2.5 h-2.5" />
        </Button>
      </div>

      {/* Interactive Chromatic Wheel */}
      <div
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={isDragging ? handlePointerMove : undefined}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleReset}
        className={`relative w-[76px] h-[76px] rounded-full cursor-crosshair select-none touch-none shadow-inner border border-glass-border/60 ${
          disabled ? 'opacity-50 pointer-events-none' : ''
        }`}
        style={{
          background:
            'radial-gradient(circle, #2d3748 0%, #1a202c 100%), conic-gradient(from 0deg, #ef4444, #eab308, #22c55e, #06b6d4, #3b82f6, #ec4899, #ef4444)',
          backgroundBlendMode: 'screen',
        }}
        title="Drag to balance color. Double-click to reset."
      >
        {/* Subtle center crosshair rings */}
        <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none" />
        <div className="absolute left-[37px] top-0 bottom-0 w-[1px] bg-white/10 pointer-events-none" />
        <div className="absolute top-[37px] left-0 right-0 h-[1px] bg-white/10 pointer-events-none" />
        <div className="absolute left-[26px] top-[26px] w-[24px] h-[24px] rounded-full border border-white/15 pointer-events-none" />

        {/* Draggable Puck */}
        <div
          className="absolute w-3 h-3 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] border border-slate-900 pointer-events-none transition-transform"
          style={{
            left: `${puckX - 6}px`,
            top: `${puckY - 6}px`,
          }}
        />
      </div>

      {/* Master Luminance Slider */}
      <div className="w-full mt-2.5 space-y-1">
        <div className="flex items-center justify-between text-[9px] text-muted-foreground px-0.5">
          <span>Y (Luma)</span>
          <span className="font-mono text-foreground font-semibold">
            {yVal >= 0 ? `+${yVal.toFixed(2)}` : yVal.toFixed(2)}
          </span>
        </div>
        <Slider
          value={[yVal]}
          min={-1}
          max={1}
          step={0.02}
          disabled={disabled}
          onValueChange={([val]) => onChange({ r: rVal, g: gVal, b: bVal, y: val ?? 0 })}
          className="w-full"
        />
      </div>
    </div>
  );
};

/**
 * Studio-Grade Color Grading & Correction Inspector.
 * Replaces generic flat parameter sliders with professional segmented color grading workflows.
 */
export const StudioColorGradingInspector: React.FC<StudioColorGradingInspectorProps> = ({
  params = {},
  onChange,
  disabled = false,
}) => {
  const p = params as ColorGradingParams;
  const [activeTab, setActiveTab] = useState<'correction' | 'wheels' | 'creative' | 'vignette'>('correction');

  const updateParam = (key: keyof ColorGradingParams, val: unknown) => {
    if (disabled) return;
    onChange({
      ...params,
      [key]: val,
    });
  };

  const resetAll = () => {
    if (disabled) return;
    onChange({
      enabled: params.enabled ?? true,
      exposure: 0.0,
      temperature: 0,
      tint: 0,
      contrast: 1.0,
      pivot: 0.435,
      highlights: 0,
      shadows: 0,
      whites: 0,
      blacks: 0,
      lift: { r: 0, g: 0, b: 0, y: 0 },
      gamma: { r: 0, g: 0, b: 0, y: 0 },
      gain: { r: 0, g: 0, b: 0, y: 0 },
      offset: { r: 0, g: 0, b: 0, y: 0 },
      lut: '',
      lutIntensity: 1.0,
      saturation: 1.0,
      vibrance: 0,
      vignetteAmount: 0.0,
      vignetteMidpoint: 0.5,
      vignetteFeather: 0.5,
    });
  };

  const getNum = (val: unknown, fallback: number): number => {
    return typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  };

  const currentLutValue = typeof p.lut === 'string' && p.lut.length > 0 ? p.lut : '__none__';

  return (
    <Card className="p-3 bg-glass-surface/40 backdrop-blur-md border-glass-border space-y-3">
      {/* Header bar with Master Reset */}
      <div className="flex items-center justify-between pb-2 border-b border-glass-border">
        <div className="flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-accent-theme" />
          <span className="text-xs font-bold text-foreground">Studio Color Suite</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={resetAll}
          className="h-5 px-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer gap-1"
          title="Reset all color correction and grading parameters"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          Reset All
        </Button>
      </div>

      {/* Segmented Sub-Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-4 w-full h-7 p-0.5 bg-glass-surface/60 border border-glass-border rounded-md text-[10px]">
          <TabsTrigger value="correction" className="h-6 text-[10px] px-1 data-[state=active]:bg-accent-theme/20 data-[state=active]:text-accent-theme font-semibold">
            Correction
          </TabsTrigger>
          <TabsTrigger value="wheels" className="h-6 text-[10px] px-1 data-[state=active]:bg-accent-theme/20 data-[state=active]:text-accent-theme font-semibold">
            Wheels
          </TabsTrigger>
          <TabsTrigger value="creative" className="h-6 text-[10px] px-1 data-[state=active]:bg-accent-theme/20 data-[state=active]:text-accent-theme font-semibold">
            Creative LUT
          </TabsTrigger>
          <TabsTrigger value="vignette" className="h-6 text-[10px] px-1 data-[state=active]:bg-accent-theme/20 data-[state=active]:text-accent-theme font-semibold">
            Vignette
          </TabsTrigger>
        </TabsList>

        {/* --- TAB 1: PRIMARY COLOR CORRECTION --- */}
        <TabsContent value="correction" className="space-y-3 pt-2">
          {/* Section: White Balance */}
          <div className="space-y-2 p-2.5 rounded-lg bg-glass-surface/30 border border-glass-border">
            <span className="text-[10px] font-bold text-foreground uppercase tracking-wider block">
              White Balance
            </span>

            {/* Temperature */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Temperature</span>
                <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                  {getNum(p.temperature, 0) > 0 ? `+${getNum(p.temperature, 0)}` : getNum(p.temperature, 0)}
                </Badge>
              </div>
              <div className="relative flex items-center">
                <Slider
                  value={[getNum(p.temperature, 0)]}
                  min={-100}
                  max={100}
                  step={1}
                  disabled={disabled}
                  onValueChange={([val]) => updateParam('temperature', val ?? 0)}
                  className="w-full"
                />
              </div>
              <div className="flex justify-between text-[8px] text-muted-foreground px-0.5">
                <span className="text-sky-400">Cool (Blue)</span>
                <span className="text-amber-400">Warm (Amber)</span>
              </div>
            </div>

            {/* Tint */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Tint</span>
                <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                  {getNum(p.tint, 0) > 0 ? `+${getNum(p.tint, 0)}` : getNum(p.tint, 0)}
                </Badge>
              </div>
              <Slider
                value={[getNum(p.tint, 0)]}
                min={-100}
                max={100}
                step={1}
                disabled={disabled}
                onValueChange={([val]) => updateParam('tint', val ?? 0)}
                className="w-full"
              />
              <div className="flex justify-between text-[8px] text-muted-foreground px-0.5">
                <span className="text-emerald-400">Green</span>
                <span className="text-fuchsia-400">Magenta</span>
              </div>
            </div>
          </div>

          {/* Section: Tonal Dynamic Range */}
          <div className="space-y-2 p-2.5 rounded-lg bg-glass-surface/30 border border-glass-border">
            <span className="text-[10px] font-bold text-foreground uppercase tracking-wider block">
              Tonal Range & Exposure
            </span>

            {/* Exposure */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sun className="w-3 h-3 text-amber-400" />
                  Exposure
                </span>
                <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                  {getNum(p.exposure, 0) >= 0 ? `+${getNum(p.exposure, 0).toFixed(2)}` : getNum(p.exposure, 0).toFixed(2)} EV
                </Badge>
              </div>
              <Slider
                value={[getNum(p.exposure, 0)]}
                min={-3.0}
                max={3.0}
                step={0.05}
                disabled={disabled}
                onValueChange={([val]) => updateParam('exposure', val ?? 0)}
              />
            </div>

            {/* Contrast & Pivot */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Contrast</span>
                  <span className="font-mono text-[9px] font-semibold text-foreground">
                    {getNum(p.contrast, 1.0).toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[getNum(p.contrast, 1.0)]}
                  min={0.2}
                  max={2.5}
                  step={0.05}
                  disabled={disabled}
                  onValueChange={([val]) => updateParam('contrast', val ?? 1.0)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Pivot</span>
                  <span className="font-mono text-[9px] font-semibold text-foreground">
                    {getNum(p.pivot, 0.435).toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[getNum(p.pivot, 0.435)]}
                  min={0.1}
                  max={0.9}
                  step={0.01}
                  disabled={disabled}
                  onValueChange={([val]) => updateParam('pivot', val ?? 0.435)}
                />
              </div>
            </div>

            {/* Highlights & Shadows */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Highlights</span>
                  <span className="font-mono text-[9px] font-semibold text-foreground">
                    {getNum(p.highlights, 0) > 0 ? `+${getNum(p.highlights, 0)}` : getNum(p.highlights, 0)}
                  </span>
                </div>
                <Slider
                  value={[getNum(p.highlights, 0)]}
                  min={-100}
                  max={100}
                  step={1}
                  disabled={disabled}
                  onValueChange={([val]) => updateParam('highlights', val ?? 0)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Shadows</span>
                  <span className="font-mono text-[9px] font-semibold text-foreground">
                    {getNum(p.shadows, 0) > 0 ? `+${getNum(p.shadows, 0)}` : getNum(p.shadows, 0)}
                  </span>
                </div>
                <Slider
                  value={[getNum(p.shadows, 0)]}
                  min={-100}
                  max={100}
                  step={1}
                  disabled={disabled}
                  onValueChange={([val]) => updateParam('shadows', val ?? 0)}
                />
              </div>
            </div>

            {/* Whites & Blacks */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Whites</span>
                  <span className="font-mono text-[9px] font-semibold text-foreground">
                    {getNum(p.whites, 0) > 0 ? `+${getNum(p.whites, 0)}` : getNum(p.whites, 0)}
                  </span>
                </div>
                <Slider
                  value={[getNum(p.whites, 0)]}
                  min={-100}
                  max={100}
                  step={1}
                  disabled={disabled}
                  onValueChange={([val]) => updateParam('whites', val ?? 0)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Blacks</span>
                  <span className="font-mono text-[9px] font-semibold text-foreground">
                    {getNum(p.blacks, 0) > 0 ? `+${getNum(p.blacks, 0)}` : getNum(p.blacks, 0)}
                  </span>
                </div>
                <Slider
                  value={[getNum(p.blacks, 0)]}
                  min={-100}
                  max={100}
                  step={1}
                  disabled={disabled}
                  onValueChange={([val]) => updateParam('blacks', val ?? 0)}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* --- TAB 2: 3-WAY COLOR WHEELS --- */}
        <TabsContent value="wheels" className="space-y-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <ColorWheel
              label="Lift"
              sublabel="Shadows"
              value={p.lift}
              onChange={(val) => updateParam('lift', val)}
              disabled={disabled}
            />
            <ColorWheel
              label="Gamma"
              sublabel="Midtones"
              value={p.gamma}
              onChange={(val) => updateParam('gamma', val)}
              disabled={disabled}
            />
            <ColorWheel
              label="Gain"
              sublabel="Highlights"
              value={p.gain}
              onChange={(val) => updateParam('gain', val)}
              disabled={disabled}
            />
            <ColorWheel
              label="Offset"
              sublabel="Master"
              value={p.offset}
              onChange={(val) => updateParam('offset', val)}
              disabled={disabled}
            />
          </div>
        </TabsContent>

        {/* --- TAB 3: CREATIVE LOOK & 3D LUT --- */}
        <TabsContent value="creative" className="space-y-3 pt-2">
          <div className="space-y-2 p-2.5 rounded-lg bg-glass-surface/30 border border-glass-border">
            <span className="text-[10px] font-bold text-foreground uppercase tracking-wider block">
              3D LUT Film Looks
            </span>

            {/* LUT Preset Selector */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground block">LUT Preset</span>
              <Select
                value={currentLutValue}
                onValueChange={(val) => updateParam('lut', val === '__none__' ? '' : val)}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-xs bg-glass-surface/50 border-glass-border">
                  <SelectValue placeholder="Select film look..." />
                </SelectTrigger>
                <SelectContent className="bg-glass-surface/90 backdrop-blur-xl border-glass-border text-xs">
                  <SelectItem value="__none__">None (Bypass LUT)</SelectItem>
                  <SelectItem value="teal_and_orange">Teal & Orange (Blockbuster)</SelectItem>
                  <SelectItem value="kodak_2383">Kodak 2383 Print Film</SelectItem>
                  <SelectItem value="bleach_bypass">Bleach Bypass (Gritty War)</SelectItem>
                  <SelectItem value="sci_fi_moody">Sci-Fi Moody (Mystery)</SelectItem>
                  <SelectItem value="cool_steel">Cool Steel (Futuristic)</SelectItem>
                  <SelectItem value="warm_golden">Warm Golden (Sunset)</SelectItem>
                  <SelectItem value="light_and_airy">Light & Airy (Pastel/Vlog)</SelectItem>
                  <SelectItem value="cyberpunk">Cyberpunk (Neon Night)</SelectItem>
                  <SelectItem value="vintage_faded">Vintage Faded (90s Camcorder)</SelectItem>
                  <SelectItem value="monochrome_noir">Monochrome Noir (Dramatic)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* LUT Intensity Blend Slider */}
            {Boolean(p.lut) && (
              <div className="space-y-1 pt-1.5 border-t border-glass-border/40">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-accent-theme" />
                    LUT Intensity
                  </span>
                  <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                    {Math.round(getNum(p.lutIntensity, 1.0) * 100)}%
                  </Badge>
                </div>
                <Slider
                  value={[getNum(p.lutIntensity, 1.0)]}
                  min={0.0}
                  max={1.0}
                  step={0.05}
                  disabled={disabled}
                  onValueChange={([val]) => updateParam('lutIntensity', val ?? 1.0)}
                />
              </div>
            )}
          </div>

          {/* Saturation & Vibrance */}
          <div className="space-y-2.5 p-2.5 rounded-lg bg-glass-surface/30 border border-glass-border">
            <span className="text-[10px] font-bold text-foreground uppercase tracking-wider block">
              Color Richness
            </span>

            {/* Saturation */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Saturation</span>
                <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                  {Math.round(getNum(p.saturation, 1.0) * 100)}%
                </Badge>
              </div>
              <Slider
                value={[getNum(p.saturation, 1.0)]}
                min={0.0}
                max={3.0}
                step={0.05}
                disabled={disabled}
                onValueChange={([val]) => updateParam('saturation', val ?? 1.0)}
              />
            </div>

            {/* Vibrance */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Vibrance</span>
                <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                  {getNum(p.vibrance, 0) > 0 ? `+${getNum(p.vibrance, 0)}` : getNum(p.vibrance, 0)}
                </Badge>
              </div>
              <Slider
                value={[getNum(p.vibrance, 0)]}
                min={-100}
                max={100}
                step={1}
                disabled={disabled}
                onValueChange={([val]) => updateParam('vibrance', val ?? 0)}
              />
            </div>
          </div>
        </TabsContent>

        {/* --- TAB 4: VIGNETTE & FINISHING --- */}
        <TabsContent value="vignette" className="space-y-2.5 pt-2">
          <div className="space-y-2 p-2.5 rounded-lg bg-glass-surface/30 border border-glass-border">
            <div className="flex items-center gap-1.5 pb-1 border-b border-glass-border/40">
              <Aperture className="w-3.5 h-3.5 text-accent-theme" />
              <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Lens Vignette
              </span>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Amount</span>
                <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                  {Math.round(getNum(p.vignetteAmount ?? p.vignette, 0) * 100)}%
                </Badge>
              </div>
              <Slider
                value={[getNum(p.vignetteAmount ?? p.vignette, 0)]}
                min={-1.0}
                max={1.0}
                step={0.05}
                disabled={disabled}
                onValueChange={([val]) => {
                  updateParam('vignetteAmount', val ?? 0);
                  updateParam('vignette', val ?? 0); // backwards compatibility
                }}
              />
            </div>

            {/* Midpoint */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Midpoint</span>
                <span className="font-mono text-[9px] text-foreground font-semibold">
                  {getNum(p.vignetteMidpoint, 0.5).toFixed(2)}
                </span>
              </div>
              <Slider
                value={[getNum(p.vignetteMidpoint, 0.5)]}
                min={0.1}
                max={0.9}
                step={0.05}
                disabled={disabled}
                onValueChange={([val]) => updateParam('vignetteMidpoint', val ?? 0.5)}
              />
            </div>

            {/* Feather */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Feather</span>
                <span className="font-mono text-[9px] text-foreground font-semibold">
                  {getNum(p.vignetteFeather, 0.5).toFixed(2)}
                </span>
              </div>
              <Slider
                value={[getNum(p.vignetteFeather, 0.5)]}
                min={0.1}
                max={1.0}
                step={0.05}
                disabled={disabled}
                onValueChange={([val]) => updateParam('vignetteFeather', val ?? 0.5)}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
