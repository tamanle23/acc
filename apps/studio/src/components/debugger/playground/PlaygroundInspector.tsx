import { createSignal, createMemo, createEffect, For, Show } from 'solid-js';
import {
  Sliders,
  Code2,
  Activity,
  Check,
  Copy,
  RotateCcw,
  PlusCircle,
  ExternalLink,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-solid';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Slider } from '../../ui/slider';
import { Switch } from '../../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { ShikiCodeViewer } from '../code-editor/ShikiCodeViewer';
import { getPresetsForPlugin } from './playgroundPresets';
import type { PlaygroundEngine } from './usePlaygroundEngine';
import type { ParamFieldDescriptor } from '@acc/ir';

export interface PlaygroundInspectorProps {
  engine: PlaygroundEngine;
  class?: string;
}

type InspectorTab = 'controls' | 'json' | 'diagnostics';

export function PlaygroundInspector(props: PlaygroundInspectorProps) {
  const [activeTab, setActiveTab] = createSignal<InspectorTab>('controls');
  const [copied, setCopied] = createSignal(false);
  const [applyFeedback, setApplyFeedback] = createSignal<string | null>(null);

  const { state, activePlugin, generatedModifierNode } = props.engine;

  // Presets list for active plugin
  const presets = createMemo(() => {
    const plugin = activePlugin();
    return getPresetsForPlugin(state.selectedPluginType, plugin?.schema);
  });

  const [selectedPresetName, setSelectedPresetName] = createSignal<string>(presets()[0]?.name || '');

  createEffect(() => {
    state.selectedPluginType;
    setSelectedPresetName(presets()[0]?.name || '');
  });

  // Schema fields dictionary
  const fields = createMemo(() => {
    return activePlugin()?.schema?.fields || {};
  });

  const handleCopyJson = async () => {
    try {
      const jsonStr = JSON.stringify(generatedModifierNode(), null, 2);
      await navigator.clipboard.writeText(jsonStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
    }
  };

  const handleApplyToStudio = () => {
    const res = props.engine.applyToActiveSequence();
    setApplyFeedback(res.message);
    setTimeout(() => setApplyFeedback(null), 3500);
  };

  // Helper to render individual dynamic form fields
  const renderField = (key: string, desc: ParamFieldDescriptor) => {
    const currentVal = () => state.currentParams[key] ?? desc.defaultValue;

    // Check visibleIf condition if present
    if (desc.visibleIf && !desc.visibleIf(state.currentParams)) {
      return null;
    }

    switch (desc.type) {
      case 'number': {
        const min = desc.min ?? 0;
        const max = desc.max ?? 100;
        const step = desc.step ?? (max - min <= 2 ? 0.05 : 1);
        const val = () => Number(currentVal() ?? min);

        return (
          <div class="flex flex-col gap-1.5 p-2 rounded-lg bg-glass-surface/30 border border-glass-border/40">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-foreground">{desc.label || key}</label>
              <span class="font-mono text-[11px] text-accent-theme">
                {val()}
                {desc.unit ? ` ${desc.unit}` : ''}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <Slider
                min={min}
                max={max}
                step={step}
                value={val()}
                onChange={(v) => props.engine.setParam(key, v[0])}
                class="flex-1"
              />
              <Input
                type="number"
                min={min}
                max={max}
                step={step}
                value={val()}
                onInput={(e) => {
                  const num = parseFloat(e.currentTarget.value);
                  if (!Number.isNaN(num)) props.engine.setParam(key, num);
                }}
                class="w-16 h-6 px-1.5 text-right font-mono text-[11px] bg-background/50 border-glass-border"
              />
            </div>
            <Show when={desc.description}>
              <span class="text-[10px] text-muted-foreground">{desc.description}</span>
            </Show>
          </div>
        );
      }

      case 'boolean': {
        const isChecked = () => Boolean(currentVal());
        return (
          <div class="flex items-center justify-between p-2 rounded-lg bg-glass-surface/30 border border-glass-border/40">
            <div class="flex flex-col">
              <label class="text-xs font-medium text-foreground">{desc.label || key}</label>
              <Show when={desc.description}>
                <span class="text-[10px] text-muted-foreground">{desc.description}</span>
              </Show>
            </div>
            <Switch
              checked={isChecked()}
              onChange={(checked) => props.engine.setParam(key, checked)}
            />
          </div>
        );
      }

      case 'string': {
        const strVal = () => String(currentVal() ?? '');
        return (
          <div class="flex flex-col gap-1.5 p-2 rounded-lg bg-glass-surface/30 border border-glass-border/40">
            <label class="text-xs font-medium text-foreground">{desc.label || key}</label>
            <Input
              type="text"
              value={strVal()}
              onInput={(e) => props.engine.setParam(key, e.currentTarget.value)}
              class="h-7 text-xs font-mono bg-background/50 border-glass-border"
            />
            <Show when={desc.description}>
              <span class="text-[10px] text-muted-foreground">{desc.description}</span>
            </Show>
          </div>
        );
      }

      case 'select':
      case 'vision_depth_strategy':
      case 'vision_segmentation_strategy': {
        const selVal = () => String(currentVal() ?? desc.options?.[0]?.value ?? '');
        const options = desc.options || [
          { label: 'Default', value: 'default' },
        ];

        return (
          <div class="flex flex-col gap-1.5 p-2 rounded-lg bg-glass-surface/30 border border-glass-border/40">
            <label class="text-xs font-medium text-foreground">{desc.label || key}</label>
            <Select
              value={selVal()}
              onChange={(v) => props.engine.setParam(key, v)}
            >
              <SelectTrigger class="h-7 text-xs font-mono bg-background/50 border-glass-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent class="glass-panel border-glass-border">
                <For each={options}>
                  {(opt) => (
                    <SelectItem value={String(opt.value)} class="text-xs font-mono">
                      {opt.label}
                    </SelectItem>
                  )}
                </For>
              </SelectContent>
            </Select>
            <Show when={desc.description}>
              <span class="text-[10px] text-muted-foreground">{desc.description}</span>
            </Show>
          </div>
        );
      }

      case 'color': {
        const colVal = () => String(currentVal() ?? '#00f0ff');
        return (
          <div class="flex flex-col gap-1.5 p-2 rounded-lg bg-glass-surface/30 border border-glass-border/40">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-foreground">{desc.label || key}</label>
              <span class="font-mono text-[11px] text-muted-foreground uppercase">{colVal()}</span>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="color"
                value={colVal()}
                onInput={(e) => props.engine.setParam(key, e.currentTarget.value)}
                class="w-8 h-7 rounded border border-glass-border cursor-pointer bg-transparent"
              />
              <Input
                type="text"
                value={colVal()}
                onInput={(e) => props.engine.setParam(key, e.currentTarget.value)}
                class="flex-1 h-7 text-xs font-mono bg-background/50 border-glass-border uppercase"
              />
            </div>
          </div>
        );
      }

      case 'curve': {
        const curveVal = () => String(currentVal() ?? 'easeInOutCubic');
        const curves = [
          { label: 'Linear', value: 'linear' },
          { label: 'Ease In Quad', value: 'easeInQuad' },
          { label: 'Ease Out Cubic', value: 'easeOutCubic' },
          { label: 'Ease In Out Cubic', value: 'easeInOutCubic' },
          { label: 'Ease Out Back', value: 'easeOutBack' },
          { label: 'Equal Power', value: 'equal_power' },
        ];
        return (
          <div class="flex flex-col gap-1.5 p-2 rounded-lg bg-glass-surface/30 border border-glass-border/40">
            <label class="text-xs font-medium text-foreground">{desc.label || key}</label>
            <Select
              value={curveVal()}
              onChange={(v) => props.engine.setParam(key, v)}
            >
              <SelectTrigger class="h-7 text-xs font-mono bg-background/50 border-glass-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent class="glass-panel border-glass-border">
                <For each={curves}>
                  {(c) => (
                    <SelectItem value={c.value} class="text-xs font-mono">
                      {c.label}
                    </SelectItem>
                  )}
                </For>
              </SelectContent>
            </Select>
          </div>
        );
      }

      case 'light_vector': {
        const vec = () => (currentVal() as { x?: number; y?: number }) || { x: 0, y: 0 };
        return (
          <div class="flex flex-col gap-2 p-2 rounded-lg bg-glass-surface/30 border border-glass-border/40">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-foreground">{desc.label || key}</label>
              <span class="font-mono text-[10px] text-accent-theme">
                X: {(vec().x ?? 0).toFixed(2)}, Y: {(vec().y ?? 0).toFixed(2)}
              </span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-[10px] font-mono text-muted-foreground w-4">X</span>
              <Slider
                min={-1}
                max={1}
                step={0.05}
                value={vec().x ?? 0}
                onChange={(v) =>
                  props.engine.setParam(key, { ...vec(), x: v[0] })
                }
                class="flex-1"
              />
            </div>
            <div class="flex items-center gap-3">
              <span class="text-[10px] font-mono text-muted-foreground w-4">Y</span>
              <Slider
                min={-1}
                max={1}
                step={0.05}
                value={vec().y ?? 0}
                onChange={(v) =>
                  props.engine.setParam(key, { ...vec(), y: v[0] })
                }
                class="flex-1"
              />
            </div>
          </div>
        );
      }

      case 'shader_group': {
        const shaders = () => state.currentParams[key] || {};
        return (
          <div class="flex flex-col gap-2 p-2.5 rounded-lg bg-glass-surface/40 border border-accent-theme/20">
            <span class="text-xs font-bold text-accent-theme flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5" />
              {desc.label || 'Post-Processing Shaders'}
            </span>

            {/* Bloom Subgroup */}
            <div class="p-2 rounded bg-background/40 border border-glass-border flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-semibold text-foreground">Bloom & Glow</span>
                <Switch
                  size="sm"
                  checked={Boolean(shaders().bloom?.enabled)}
                  onChange={(val) =>
                    props.engine.setParam(key, {
                      ...shaders(),
                      bloom: { ...shaders().bloom, enabled: val },
                    })
                  }
                />
              </div>
              <Show when={shaders().bloom?.enabled}>
                <div class="flex items-center justify-between text-[10px] font-mono">
                  <span>Intensity</span>
                  <Slider
                    min={0.1}
                    max={3.0}
                    step={0.1}
                    value={shaders().bloom?.intensity ?? 1.0}
                    onChange={(v) =>
                      props.engine.setParam(key, {
                        ...shaders(),
                        bloom: { ...shaders().bloom, intensity: v[0] },
                      })
                    }
                    class="w-32"
                  />
                </div>
              </Show>
            </div>

            {/* Chromatic Aberration Subgroup */}
            <div class="p-2 rounded bg-background/40 border border-glass-border flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-semibold text-foreground">Chromatic Aberration</span>
                <Switch
                  size="sm"
                  checked={Boolean(shaders().chromaticAberration?.enabled)}
                  onChange={(val) =>
                    props.engine.setParam(key, {
                      ...shaders(),
                      chromaticAberration: { ...shaders().chromaticAberration, enabled: val },
                    })
                  }
                />
              </div>
              <Show when={shaders().chromaticAberration?.enabled}>
                <div class="flex items-center justify-between text-[10px] font-mono">
                  <span>Offset Px</span>
                  <Slider
                    min={0.5}
                    max={10.0}
                    step={0.5}
                    value={shaders().chromaticAberration?.offsetPx ?? 2.0}
                    onChange={(v) =>
                      props.engine.setParam(key, {
                        ...shaders(),
                        chromaticAberration: { ...shaders().chromaticAberration, offsetPx: v[0] },
                      })
                    }
                    class="w-32"
                  />
                </div>
              </Show>
            </div>
          </div>
        );
      }

      case 'group': {
        const subfields = desc.fields || {};
        const groupVal = () => (currentVal() as Record<string, any>) || {};
        return (
          <div class="flex flex-col gap-2 p-2.5 rounded-xl bg-glass-surface/40 border border-glass-border/60">
            <span class="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Layers class="w-3.5 h-3.5 text-accent-theme" />
              {desc.label || key}
            </span>
            <div class="flex flex-col gap-2 pl-1 border-l-2 border-accent-theme/30">
              <For each={Object.entries(subfields)}>
                {([subKey, subDesc]) => {
                  return renderField(subKey, {
                    ...subDesc,
                    defaultValue: groupVal()[subKey] ?? subDesc.defaultValue,
                  });
                }}
              </For>
            </div>
          </div>
        );
      }

      case 'regions_array': {
        const regions = () => (Array.isArray(currentVal()) ? (currentVal() as any[]) : []);
        const subfields = desc.fields || {};

        const updateRegion = (index: number, subKey: string, val: any) => {
          const list = [...regions()];
          list[index] = { ...list[index], [subKey]: val };
          props.engine.setParam(key, list);
        };

        const addRegion = () => {
          const newRegion: Record<string, any> = {};
          for (const [k, f] of Object.entries(subfields)) {
            newRegion[k] = f.defaultValue !== undefined ? f.defaultValue : f.min ?? 0;
          }
          props.engine.setParam(key, [...regions(), newRegion]);
        };

        const removeRegion = (index: number) => {
          const list = regions().filter((_, i) => i !== index);
          props.engine.setParam(key, list);
        };

        return (
          <div class="flex flex-col gap-2 p-2.5 rounded-xl bg-glass-surface/40 border border-accent-theme/20">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-accent-theme flex items-center gap-1.5">
                <Layers class="w-3.5 h-3.5" />
                {desc.label || 'VFX Regions'} ({regions().length})
              </span>
              <Button
                variant="outline"
                size="sm"
                class="h-6 px-2 text-[10px] font-mono border-glass-border hover:bg-accent-theme/10 hover:text-accent-theme"
                onClick={addRegion}
              >
                <PlusCircle class="w-3 h-3 mr-1" />
                Add Region
              </Button>
            </div>

            <For each={regions()}>
              {(reg, idx) => (
                <div class="p-2 rounded-lg bg-background/40 border border-glass-border flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-semibold text-foreground font-mono">
                      Region #{idx() + 1} ({reg.type || 'spotlight'})
                    </span>
                    <button
                      type="button"
                      class="text-[10px] text-rose-400 hover:text-rose-300 font-mono"
                      onClick={() => removeRegion(idx())}
                    >
                      Delete
                    </button>
                  </div>

                  <div class="grid grid-cols-2 gap-2 text-[11px]">
                    <div class="flex flex-col gap-1">
                      <span class="text-muted-foreground text-[10px]">Type</span>
                      <Select
                        value={reg.type || 'spotlight'}
                        onChange={(v) => updateRegion(idx(), 'type', v)}
                      >
                        <SelectTrigger class="h-6 text-[10px] font-mono bg-background/50 border-glass-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent class="glass-panel border-glass-border">
                          <SelectItem value="spotlight" class="text-xs font-mono">Spotlight</SelectItem>
                          <SelectItem value="glitch" class="text-xs font-mono">Glitch</SelectItem>
                          <SelectItem value="blur" class="text-xs font-mono">Blur</SelectItem>
                          <SelectItem value="point_emitter" class="text-xs font-mono">Point Emitter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div class="flex flex-col gap-1">
                      <span class="text-muted-foreground text-[10px]">Color</span>
                      <div class="flex items-center gap-1">
                        <input
                          type="color"
                          value={reg.color || '#00d4ff'}
                          onInput={(e) => updateRegion(idx(), 'color', e.currentTarget.value)}
                          class="w-6 h-6 rounded border border-glass-border cursor-pointer bg-transparent"
                        />
                        <span class="font-mono text-[10px] uppercase truncate">{reg.color || '#00d4ff'}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <span class="text-[10px] text-muted-foreground w-12">Pos X/Y</span>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={reg.x ?? 0.5}
                      onChange={(v) => updateRegion(idx(), 'x', v[0])}
                      class="flex-1"
                    />
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={reg.y ?? 0.5}
                      onChange={(v) => updateRegion(idx(), 'y', v[0])}
                      class="flex-1"
                    />
                  </div>

                  <div class="flex items-center gap-2">
                    <span class="text-[10px] text-muted-foreground w-12">Intensity</span>
                    <Slider
                      min={0.1}
                      max={4.0}
                      step={0.1}
                      value={reg.intensity ?? 1.5}
                      onChange={(v) => updateRegion(idx(), 'intensity', v[0])}
                      class="flex-1"
                    />
                    <span class="font-mono text-[10px] text-accent-theme w-8 text-right">
                      {(reg.intensity ?? 1.5).toFixed(1)}
                    </span>
                  </div>
                </div>
              )}
            </For>
          </div>
        );
      }

      default: {
        // Fallback for novel/unmapped complex types
        return (
          <div class="flex flex-col gap-1 p-2 rounded-lg bg-glass-surface/30 border border-glass-border/40">
            <label class="text-xs font-medium text-foreground">{desc.label || key}</label>
            <Input
              type="text"
              value={JSON.stringify(currentVal())}
              onInput={(e) => {
                try {
                  const parsed = JSON.parse(e.currentTarget.value);
                  props.engine.setParam(key, parsed);
                } catch {
                  props.engine.setParam(key, e.currentTarget.value);
                }
              }}
              class="h-7 text-xs font-mono bg-background/50 border-glass-border"
            />
          </div>
        );
      }
    }
  };

  return (
    <div
      class={`flex flex-col h-full w-full min-h-0 min-w-0 bg-background/70 border-l border-glass-border select-none ${
        props.class || ''
      }`}
    >
      {/* Tab Navigation Header */}
      <div class="flex items-center justify-between p-2.5 border-b border-glass-border bg-glass-surface/40 shrink-0">
        <div class="flex items-center gap-1">
          <button
            type="button"
            class={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 border ${
              activeTab() === 'controls'
                ? 'bg-accent-theme/20 text-accent-theme border-accent-theme/40 font-bold'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-glass-surface/60'
            }`}
            onClick={() => setActiveTab('controls')}
          >
            <Sliders class="w-3.5 h-3.5" />
            <span>Controls</span>
          </button>

          <button
            type="button"
            class={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 border ${
              activeTab() === 'json'
                ? 'bg-accent-theme/20 text-accent-theme border-accent-theme/40 font-bold'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-glass-surface/60'
            }`}
            onClick={() => setActiveTab('json')}
          >
            <Code2 class="w-3.5 h-3.5" />
            <span>Node JSON</span>
          </button>

          <button
            type="button"
            class={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 border ${
              activeTab() === 'diagnostics'
                ? 'bg-accent-theme/20 text-accent-theme border-accent-theme/40 font-bold'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-glass-surface/60'
            }`}
            onClick={() => setActiveTab('diagnostics')}
          >
            <Activity class="w-3.5 h-3.5" />
            <span>Diagnostics</span>
          </button>
        </div>

        {/* Reset Button */}
        <Button
          variant="ghost"
          size="sm"
          class="h-7 px-2 text-xs font-mono text-muted-foreground hover:text-foreground"
          onClick={props.engine.resetDefaults}
          title="Reset to Plugin Defaults"
        >
          <RotateCcw class="w-3 h-3 mr-1" />
          Reset
        </Button>
      </div>

      {/* Tab 1: GUI Controls */}
      <Show when={activeTab() === 'controls'}>
        <div class="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
          {/* Preset Selector */}
          <div class="flex flex-col gap-1.5 p-2.5 rounded-xl bg-accent-theme/10 border border-accent-theme/25">
            <label class="text-[11px] font-bold uppercase tracking-wider text-accent-theme">
              Curated Production Presets
            </label>
            <Select
              value={selectedPresetName()}
              onChange={(val) => {
                setSelectedPresetName(val);
                const target = presets().find((p) => p.name === val);
                if (target) props.engine.loadPreset(target.params);
              }}
            >
              <SelectTrigger class="h-8 text-xs font-mono bg-background/60 border-accent-theme/30">
                <SelectValue placeholder="Select preset..." />
              </SelectTrigger>
              <SelectContent class="glass-panel border-glass-border">
                <For each={presets()}>
                  {(p) => (
                    <SelectItem value={p.name} class="text-xs font-mono">
                      <div class="flex flex-col text-left">
                        <span class="font-bold">{p.name}</span>
                        <span class="text-[10px] text-muted-foreground">{p.description}</span>
                      </div>
                    </SelectItem>
                  )}
                </For>
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Controls List */}
          <div class="flex flex-col gap-2">
            <Show
              when={Object.keys(fields()).length > 0}
              fallback={
                <div class="p-6 text-center text-muted-foreground text-xs">
                  This plugin does not declare schema parameters. It runs with standard internal defaults.
                </div>
              }
            >
              <For each={Object.entries(fields())}>
                {([key, desc]) => renderField(key, desc)}
              </For>
            </Show>
          </div>
        </div>
      </Show>

      {/* Tab 2: VideoIR Node JSON */}
      <Show when={activeTab() === 'json'}>
        <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div class="flex-1 min-h-0 overflow-hidden relative">
            <ShikiCodeViewer
              code={JSON.stringify(generatedModifierNode(), null, 2)}
              readOnly={true}
              onChange={() => {}}
              class="h-full w-full"
            />
          </div>

          {/* Action Bar */}
          <div class="p-3 border-t border-glass-border bg-glass-surface/60 flex flex-col gap-2 shrink-0">
            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                class="flex-1 h-8 text-xs font-mono border-glass-border gap-1.5"
                onClick={handleCopyJson}
              >
                {copied() ? <Check class="w-3.5 h-3.5 text-emerald-400" /> : <Copy class="w-3.5 h-3.5" />}
                <span>{copied() ? 'Copied to Clipboard!' : 'Copy Node JSON'}</span>
              </Button>

              <Button
                variant="default"
                size="sm"
                class="flex-1 h-8 text-xs font-mono bg-accent-theme hover:bg-accent-theme/90 text-white font-bold gap-1.5 shadow-accent-glow"
                onClick={handleApplyToStudio}
              >
                <PlusCircle class="w-3.5 h-3.5" />
                <span>Apply to Studio</span>
              </Button>
            </div>

            <Show when={applyFeedback()}>
              {(msg) => (
                <div class="p-2 rounded bg-accent-theme/15 border border-accent-theme/30 text-accent-theme text-[11px] font-mono text-center">
                  {msg()}
                </div>
              )}
            </Show>
          </div>
        </div>
      </Show>

      {/* Tab 3: Diagnostics */}
      <Show when={activeTab() === 'diagnostics'}>
        <div class="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3 font-mono text-xs">
          <div class="p-3 rounded-xl bg-glass-surface/40 border border-glass-border flex flex-col gap-2">
            <span class="font-bold text-foreground">Plugin Architectural Spec</span>
            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <span class="text-muted-foreground">Type:</span>
              <span class="text-accent-theme truncate">{state.selectedPluginType}</span>

              <span class="text-muted-foreground">Category:</span>
              <span>{activePlugin()?.schema?.category || 'vfx'}</span>

              <span class="text-muted-foreground">Target Phase:</span>
              <span>Phase {activePlugin()?.targetPhase ?? 2}</span>

              <span class="text-muted-foreground">Target Scope:</span>
              <span>{activePlugin()?.targetScope ?? 'clip'}</span>

              <span class="text-muted-foreground">Context Δ:</span>
              <span class={state.telemetry.stackDelta === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {state.telemetry.stackDelta} (Save/Restore Parity)
              </span>

              <span class="text-muted-foreground">Render Latency:</span>
              <span>{state.telemetry.latencyMs.toFixed(2)} ms</span>

              <span class="text-muted-foreground">RAF FPS:</span>
              <span>{state.telemetry.fps} FPS</span>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
