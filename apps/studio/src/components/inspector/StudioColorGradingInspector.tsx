import { createSignal, Show } from 'solid-js';
import {
  RotateCcw,
  Sparkles,
  Sun,
  Aperture,
} from 'lucide-solid';
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
 */
interface ColorWheelProps {
  label: string;
  sublabel: string;
  value?: unknown;
  onChange: (val: ColorWheelValue) => void;
  disabled?: boolean;
}

function ColorWheel(props: ColorWheelProps) {
  let wheelRef: HTMLDivElement | undefined;
  const [isDragging, setIsDragging] = createSignal(false);

  const radius = 34; // Wheel radius in px
  const center = 38; // Wheel center (76px width/height)

  // Defensively normalize wheel value object
  const val = () =>
    props.value && typeof props.value === 'object' && !Array.isArray(props.value)
      ? (props.value as Record<string, unknown>)
      : {};
  const rVal = () => (typeof val().r === 'number' && Number.isFinite(val().r) ? (val().r as number) : 0);
  const gVal = () => (typeof val().g === 'number' && Number.isFinite(val().g) ? (val().g as number) : 0);
  const bVal = () => (typeof val().b === 'number' && Number.isFinite(val().b) ? (val().b as number) : 0);
  const yVal = () => (typeof val().y === 'number' && Number.isFinite(val().y) ? (val().y as number) : 0);

  // Map RGB vector back to 2D puck position
  const puckX = () => center + (rVal() - (gVal() + bVal()) * 0.5) * radius * 0.8;
  const puckY = () => center + (gVal() - bVal()) * 0.866 * radius * 0.8;

  const handlePointerMove = (e: PointerEvent) => {
    if (props.disabled || !wheelRef) return;
    const rect = wheelRef.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);

    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const normDist = Math.min(1.0, dist / radius);

    // Convert polar chromaticity to RGB balance
    const r = Math.max(-1, Math.min(1, normDist * Math.cos(angle)));
    const g = Math.max(-1, Math.min(1, normDist * Math.cos(angle - (2 * Math.PI) / 3)));
    const b = Math.max(-1, Math.min(1, normDist * Math.cos(angle - (4 * Math.PI) / 3)));

    props.onChange({
      r: Number(r.toFixed(3)),
      g: Number(g.toFixed(3)),
      b: Number(b.toFixed(3)),
      y: yVal(),
    });
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (props.disabled) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    handlePointerMove(e);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (props.disabled) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
    setIsDragging(false);
  };

  const handleReset = () => {
    if (props.disabled) return;
    props.onChange({ r: 0, g: 0, b: 0, y: 0 });
  };

  const hasModifications = () => rVal() !== 0 || gVal() !== 0 || bVal() !== 0 || yVal() !== 0;

  return (
    <div class="flex flex-col items-center p-2 rounded-lg bg-glass-surface/30 border border-glass-border">
      <div class="flex items-center justify-between w-full mb-1.5 px-0.5">
        <div>
          <span class="text-[11px] font-bold text-foreground block">{props.label}</span>
          <span class="text-[9px] text-muted-foreground block -mt-0.5">{props.sublabel}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={props.disabled || !hasModifications()}
          onClick={handleReset}
          class="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
          title={`Reset ${props.label}`}
        >
          <RotateCcw class="w-2.5 h-2.5" />
        </Button>
      </div>

      {/* Interactive Chromatic Wheel */}
      <div
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={(e) => isDragging() && handlePointerMove(e)}
        onPointerUp={handlePointerUp}
        onDblClick={handleReset}
        class={`relative w-[76px] h-[76px] rounded-full cursor-crosshair select-none touch-none shadow-inner border border-glass-border/60 ${
          props.disabled ? 'opacity-50 pointer-events-none' : ''
        }`}
        style={{
          background:
            'radial-gradient(circle, #2d3748 0%, #1a202c 100%), conic-gradient(from 0deg, #ef4444, #eab308, #22c55e, #06b6d4, #3b82f6, #ec4899, #ef4444)',
          'background-blend-mode': 'screen',
        }}
        title="Drag to balance color. Double-click to reset."
      >
        {/* Subtle center crosshair rings */}
        <div class="absolute inset-0 rounded-full border border-white/10 pointer-events-none" />
        <div class="absolute left-[37px] top-0 bottom-0 w-[1px] bg-white/10 pointer-events-none" />
        <div class="absolute top-[37px] left-0 right-0 h-[1px] bg-white/10 pointer-events-none" />
        <div class="absolute left-[26px] top-[26px] w-[24px] h-[24px] rounded-full border border-white/15 pointer-events-none" />

        {/* Draggable Puck */}
        <div
          class="absolute w-3 h-3 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] border border-slate-900 pointer-events-none transition-transform"
          style={{
            left: `${puckX() - 6}px`,
            top: `${puckY() - 6}px`,
          }}
        />
      </div>

      {/* Master Luminance Slider */}
      <div class="w-full mt-2.5 space-y-1">
        <div class="flex items-center justify-between text-[9px] text-muted-foreground px-0.5">
          <span>Y (Luma)</span>
          <span class="font-mono text-foreground font-semibold">
            {yVal() >= 0 ? `+${yVal().toFixed(2)}` : yVal().toFixed(2)}
          </span>
        </div>
        <Slider
          value={[yVal()]}
          min={-1}
          max={1}
          step={0.02}
          disabled={props.disabled}
          onChange={([val]) => props.onChange({ r: rVal(), g: gVal(), b: bVal(), y: val ?? 0 })}
          class="w-full"
        />
      </div>
    </div>
  );
}

/**
 * Studio-Grade Color Grading & Correction Inspector.
 */
export function StudioColorGradingInspector(props: StudioColorGradingInspectorProps) {
  const p = () => (props.params || {}) as ColorGradingParams;
  const [activeTab, setActiveTab] = createSignal<'correction' | 'wheels' | 'creative' | 'vignette'>('correction');

  const updateParam = (key: keyof ColorGradingParams, val: unknown) => {
    if (props.disabled) return;
    props.onChange({
      ...props.params,
      [key]: val,
    });
  };

  const getNum = (val: unknown, fallback: number): number => {
    return typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  };

  const currentLutValue = () =>
    typeof p().lut === 'string' && (p().lut as string).length > 0 ? (p().lut as string) : '__none__';

  return (
    <>
      {/* Segmented Sub-Navigation Tabs */}
      <Tabs value={activeTab()} onChange={(v: string) => setActiveTab(v as any)} class="w-full">
        <TabsList class="grid grid-cols-4 w-full h-7 p-0.5 bg-glass-surface/60 border border-glass-border rounded-md text-[10px]">
          <TabsTrigger value="correction" class="h-6 text-[10px] px-1 data-[selected]:bg-accent-theme/20 data-[selected]:text-accent-theme font-semibold">
            Correction
          </TabsTrigger>
          <TabsTrigger value="wheels" class="h-6 text-[10px] px-1 data-[selected]:bg-accent-theme/20 data-[selected]:text-accent-theme font-semibold">
            Wheels
          </TabsTrigger>
          <TabsTrigger value="creative" class="h-6 text-[10px] px-1 data-[selected]:bg-accent-theme/20 data-[selected]:text-accent-theme font-semibold">
            Creative LUT
          </TabsTrigger>
          <TabsTrigger value="vignette" class="h-6 text-[10px] px-1 data-[selected]:bg-accent-theme/20 data-[selected]:text-accent-theme font-semibold">
            Vignette
          </TabsTrigger>
        </TabsList>

        {/* --- TAB 1: PRIMARY COLOR CORRECTION --- */}
        <TabsContent value="correction" class="space-y-3 pt-2">
          {/* Section: White Balance */}
          <div class="space-y-2 p-2.5 rounded-lg bg-glass-surface/30 border border-glass-border">
            <span class="text-[10px] font-bold text-foreground uppercase tracking-wider block">
              White Balance
            </span>

            {/* Temperature */}
            <div class="space-y-1">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-muted-foreground">Temperature</span>
                <Badge variant="outline" class="h-4 px-1 font-mono text-[9px]">
                  {getNum(p().temperature, 0) > 0 ? `+${getNum(p().temperature, 0)}` : getNum(p().temperature, 0)}
                </Badge>
              </div>
              <div class="relative flex items-center">
                <Slider
                  value={[getNum(p().temperature, 0)]}
                  min={-100}
                  max={100}
                  step={1}
                  disabled={props.disabled}
                  onChange={([val]) => updateParam('temperature', val ?? 0)}
                  class="w-full"
                />
              </div>
              <div class="flex justify-between text-[8px] text-muted-foreground px-0.5">
                <span class="text-sky-400">Cool (Blue)</span>
                <span class="text-amber-400">Warm (Amber)</span>
              </div>
            </div>

            {/* Tint */}
            <div class="space-y-1 pt-1">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-muted-foreground">Tint</span>
                <Badge variant="outline" class="h-4 px-1 font-mono text-[9px]">
                  {getNum(p().tint, 0) > 0 ? `+${getNum(p().tint, 0)}` : getNum(p().tint, 0)}
                </Badge>
              </div>
              <Slider
                value={[getNum(p().tint, 0)]}
                min={-100}
                max={100}
                step={1}
                disabled={props.disabled}
                onChange={([val]) => updateParam('tint', val ?? 0)}
                class="w-full"
              />
              <div class="flex justify-between text-[8px] text-muted-foreground px-0.5">
                <span class="text-emerald-400">Green</span>
                <span class="text-fuchsia-400">Magenta</span>
              </div>
            </div>
          </div>

          {/* Section: Tonal Dynamic Range */}
          <div class="space-y-2 p-2.5 rounded-lg bg-glass-surface/30 border border-glass-border">
            <span class="text-[10px] font-bold text-foreground uppercase tracking-wider block">
              Tonal Range & Exposure
            </span>

            {/* Exposure */}
            <div class="space-y-1">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-muted-foreground flex items-center gap-1">
                  <Sun class="w-3 h-3 text-amber-400" />
                  Exposure
                </span>
                <Badge variant="outline" class="h-4 px-1 font-mono text-[9px]">
                  {getNum(p().exposure, 0) >= 0 ? `+${getNum(p().exposure, 0).toFixed(2)}` : getNum(p().exposure, 0).toFixed(2)} EV
                </Badge>
              </div>
              <Slider
                value={[getNum(p().exposure, 0)]}
                min={-3.0}
                max={3.0}
                step={0.05}
                disabled={props.disabled}
                onChange={([val]) => updateParam('exposure', val ?? 0)}
              />
            </div>

            {/* Contrast & Pivot */}
            <div class="grid grid-cols-2 gap-2 pt-1">
              <div class="space-y-1">
                <div class="flex items-center justify-between text-[10px]">
                  <span class="text-muted-foreground">Contrast</span>
                  <span class="font-mono text-[9px] font-semibold text-foreground">
                    {getNum(p().contrast, 1.0).toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[getNum(p().contrast, 1.0)]}
                  min={0.2}
                  max={2.5}
                  step={0.05}
                  disabled={props.disabled}
                  onChange={([val]) => updateParam('contrast', val ?? 1.0)}
                />
              </div>

              <div class="space-y-1">
                <div class="flex items-center justify-between text-[10px]">
                  <span class="text-muted-foreground">Pivot</span>
                  <span class="font-mono text-[9px] font-semibold text-foreground">
                    {getNum(p().pivot, 0.435).toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[getNum(p().pivot, 0.435)]}
                  min={0.1}
                  max={0.9}
                  step={0.01}
                  disabled={props.disabled}
                  onChange={([val]) => updateParam('pivot', val ?? 0.435)}
                />
              </div>
            </div>

            {/* Highlights & Shadows */}
            <div class="grid grid-cols-2 gap-2 pt-1">
              <div class="space-y-1">
                <div class="flex items-center justify-between text-[10px]">
                  <span class="text-muted-foreground">Highlights</span>
                  <span class="font-mono text-[9px] font-semibold text-foreground">
                    {getNum(p().highlights, 0) > 0 ? `+${getNum(p().highlights, 0)}` : getNum(p().highlights, 0)}
                  </span>
                </div>
                <Slider
                  value={[getNum(p().highlights, 0)]}
                  min={-100}
                  max={100}
                  step={1}
                  disabled={props.disabled}
                  onChange={([val]) => updateParam('highlights', val ?? 0)}
                />
              </div>

              <div class="space-y-1">
                <div class="flex items-center justify-between text-[10px]">
                  <span class="text-muted-foreground">Shadows</span>
                  <span class="font-mono text-[9px] font-semibold text-foreground">
                    {getNum(p().shadows, 0) > 0 ? `+${getNum(p().shadows, 0)}` : getNum(p().shadows, 0)}
                  </span>
                </div>
                <Slider
                  value={[getNum(p().shadows, 0)]}
                  min={-100}
                  max={100}
                  step={1}
                  disabled={props.disabled}
                  onChange={([val]) => updateParam('shadows', val ?? 0)}
                />
              </div>
            </div>

            {/* Whites & Blacks */}
            <div class="grid grid-cols-2 gap-2 pt-1">
              <div class="space-y-1">
                <div class="flex items-center justify-between text-[10px]">
                  <span class="text-muted-foreground">Whites</span>
                  <span class="font-mono text-[9px] font-semibold text-foreground">
                    {getNum(p().whites, 0) > 0 ? `+${getNum(p().whites, 0)}` : getNum(p().whites, 0)}
                  </span>
                </div>
                <Slider
                  value={[getNum(p().whites, 0)]}
                  min={-100}
                  max={100}
                  step={1}
                  disabled={props.disabled}
                  onChange={([val]) => updateParam('whites', val ?? 0)}
                />
              </div>

              <div class="space-y-1">
                <div class="flex items-center justify-between text-[10px]">
                  <span class="text-muted-foreground">Blacks</span>
                  <span class="font-mono text-[9px] font-semibold text-foreground">
                    {getNum(p().blacks, 0) > 0 ? `+${getNum(p().blacks, 0)}` : getNum(p().blacks, 0)}
                  </span>
                </div>
                <Slider
                  value={[getNum(p().blacks, 0)]}
                  min={-100}
                  max={100}
                  step={1}
                  disabled={props.disabled}
                  onChange={([val]) => updateParam('blacks', val ?? 0)}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* --- TAB 2: 3-WAY COLOR WHEELS --- */}
        <TabsContent value="wheels" class="space-y-2 pt-2">
          <div class="grid grid-cols-2 gap-2">
            <ColorWheel
              label="Lift"
              sublabel="Shadows"
              value={p().lift}
              onChange={(val) => updateParam('lift', val)}
              disabled={props.disabled}
            />
            <ColorWheel
              label="Gamma"
              sublabel="Midtones"
              value={p().gamma}
              onChange={(val) => updateParam('gamma', val)}
              disabled={props.disabled}
            />
            <ColorWheel
              label="Gain"
              sublabel="Highlights"
              value={p().gain}
              onChange={(val) => updateParam('gain', val)}
              disabled={props.disabled}
            />
            <ColorWheel
              label="Offset"
              sublabel="Master"
              value={p().offset}
              onChange={(val) => updateParam('offset', val)}
              disabled={props.disabled}
            />
          </div>
        </TabsContent>

        {/* --- TAB 3: CREATIVE LOOK & 3D LUT --- */}
        <TabsContent value="creative" class="space-y-3 pt-2">
          <div class="space-y-2 p-2.5 rounded-lg bg-glass-surface/30 border border-glass-border">
            <span class="text-[10px] font-bold text-foreground uppercase tracking-wider block">
              3D LUT Film Looks
            </span>

            {/* LUT Preset Selector */}
            <div class="space-y-1">
              <span class="text-[11px] text-muted-foreground block">LUT Preset</span>
              <Select
                value={currentLutValue()}
                onChange={(val: string) => updateParam('lut', val === '__none__' ? '' : val)}
                disabled={props.disabled}
              >
                <SelectTrigger class="h-8 text-xs bg-glass-surface/50 border-glass-border">
                  <SelectValue placeholder="Select film look..." />
                </SelectTrigger>
                <SelectContent class="bg-glass-surface/90 backdrop-blur-xl border-glass-border text-xs">
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
            <Show when={Boolean(p().lut)}>
              <div class="space-y-1 pt-1.5 border-t border-glass-border/40">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="text-muted-foreground flex items-center gap-1">
                    <Sparkles class="w-3 h-3 text-accent-theme" />
                    LUT Intensity
                  </span>
                  <Badge variant="outline" class="h-4 px-1 font-mono text-[9px]">
                    {Math.round(getNum(p().lutIntensity, 1.0) * 100)}%
                  </Badge>
                </div>
                <Slider
                  value={[getNum(p().lutIntensity, 1.0)]}
                  min={0.0}
                  max={1.0}
                  step={0.05}
                  disabled={props.disabled}
                  onChange={([val]) => updateParam('lutIntensity', val ?? 1.0)}
                />
              </div>
            </Show>
          </div>

          {/* Saturation & Vibrance */}
          <div class="space-y-2.5 p-2.5 rounded-lg bg-glass-surface/30 border border-glass-border">
            <span class="text-[10px] font-bold text-foreground uppercase tracking-wider block">
              Color Richness
            </span>

            {/* Saturation */}
            <div class="space-y-1">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-muted-foreground">Saturation</span>
                <Badge variant="outline" class="h-4 px-1 font-mono text-[9px]">
                  {Math.round(getNum(p().saturation, 1.0) * 100)}%
                </Badge>
              </div>
              <Slider
                value={[getNum(p().saturation, 1.0)]}
                min={0.0}
                max={3.0}
                step={0.05}
                disabled={props.disabled}
                onChange={([val]) => updateParam('saturation', val ?? 1.0)}
              />
            </div>

            {/* Vibrance */}
            <div class="space-y-1 pt-1">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-muted-foreground">Vibrance</span>
                <Badge variant="outline" class="h-4 px-1 font-mono text-[9px]">
                  {getNum(p().vibrance, 0) > 0 ? `+${getNum(p().vibrance, 0)}` : getNum(p().vibrance, 0)}
                </Badge>
              </div>
              <Slider
                value={[getNum(p().vibrance, 0)]}
                min={-100}
                max={100}
                step={1}
                disabled={props.disabled}
                onChange={([val]) => updateParam('vibrance', val ?? 0)}
              />
            </div>
          </div>
        </TabsContent>

        {/* --- TAB 4: VIGNETTE & FINISHING --- */}
        <TabsContent value="vignette" class="space-y-2.5 pt-2">
          <div class="space-y-2 p-2.5 rounded-lg bg-glass-surface/30 border border-glass-border">
            <div class="flex items-center gap-1.5 pb-1 border-b border-glass-border/40">
              <Aperture class="w-3.5 h-3.5 text-accent-theme" />
              <span class="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Lens Vignette
              </span>
            </div>

            {/* Amount */}
            <div class="space-y-1">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-muted-foreground">Amount</span>
                <Badge variant="outline" class="h-4 px-1 font-mono text-[9px]">
                  {Math.round(getNum(p().vignetteAmount ?? p().vignette, 0) * 100)}%
                </Badge>
              </div>
              <Slider
                value={[getNum(p().vignetteAmount ?? p().vignette, 0)]}
                min={-1.0}
                max={1.0}
                step={0.05}
                disabled={props.disabled}
                onChange={([val]) => {
                  updateParam('vignetteAmount', val ?? 0);
                  updateParam('vignette', val ?? 0); // backwards compatibility
                }}
              />
            </div>

            {/* Midpoint */}
            <div class="space-y-1 pt-1">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-muted-foreground">Midpoint</span>
                <span class="font-mono text-[9px] text-foreground font-semibold">
                  {getNum(p().vignetteMidpoint, 0.5).toFixed(2)}
                </span>
              </div>
              <Slider
                value={[getNum(p().vignetteMidpoint, 0.5)]}
                min={0.1}
                max={0.9}
                step={0.05}
                disabled={props.disabled}
                onChange={([val]) => updateParam('vignetteMidpoint', val ?? 0.5)}
              />
            </div>

            {/* Feather */}
            <div class="space-y-1 pt-1">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-muted-foreground">Feather</span>
                <span class="font-mono text-[9px] text-foreground font-semibold">
                  {getNum(p().vignetteFeather, 0.5).toFixed(2)}
                </span>
              </div>
              <Slider
                value={[getNum(p().vignetteFeather, 0.5)]}
                min={0.1}
                max={1.0}
                step={0.05}
                disabled={props.disabled}
                onChange={([val]) => updateParam('vignetteFeather', val ?? 0.5)}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
