import { createMemo, createSignal, Show, For, Component } from 'solid-js';
import {
  Wand2,
  Upload,
  Trash2,
  Sliders,
  Layers,
  Type,
  Shield,
  Cpu,
  Film,
  Image as ImageIcon,
  Box,
  Zap,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from 'lucide-solid';
import type { LayoutEngineType } from '@/types/spatial';
import type { HeroMotionId } from '@/types/motion';
import type { PaletteTokens, BackgroundBlendMode } from '@/types/studio';
import { useStudio } from '@/context/studio-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SwitchRow } from '@/components/ui/switch-row';
import { studioRegistry } from '@/constants/registry';
import { LAYOUT_ENGINES } from '@/constants/spatial-layouts';
import { getLayoutEngine } from '@/engine/composition/layout-geometry';
import { diffAgainstArchetype } from '@/lib/config-engine';
import { saveImageToOpfs, deleteImageFromOpfs } from '@/lib/opfs-storage';
import { loadCustomFontFile } from '@/lib/custom-fonts';
import { saveAsset, deleteAsset } from '@/lib/asset-store';
import { processImageCutout } from '@/lib/image-cutout';
import { parseGlbMesh, gltfMeshEngine } from '@/engine/webgpu/gltf-mesh-engine';
import { MEDIA_CATALOG } from '@/constants/media-catalog';
import { videoTextureEngine } from '@/lib/video-texture-engine';
import { cn } from '@/lib/utils';

export interface BrandAndStylesTabProps {
  onOpenLottieHub: () => void;
  onOpenMediaVault?: () => void;
}

export const BrandAndStylesTab: Component<BrandAndStylesTabProps> = (props) => {
  const { state, patchState, handleSynthesizePalette, triggerToast, revertToArchetype } = useStudio();
  const [diffExpanded, setDiffExpanded] = createSignal<boolean>(false);
  const diffs = createMemo(() => diffAgainstArchetype(state, state.archetypeId));

  let fileInputRef: HTMLInputElement | undefined;
  let fontInputRef: HTMLInputElement | undefined;
  let logoInputRef: HTMLInputElement | undefined;
  let cutoutInputRef: HTMLInputElement | undefined;
  let glbFileInputRef: HTMLInputElement | undefined;

  const handleGlbUpload = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      triggerToast('GLB Upload Error: File exceeds 100MB limit for in-browser rendering');
      target.value = '';
      return;
    }

    try {
      triggerToast(`Decoding 3D Model: ${file.name}...`);
      const arrayBuffer = await file.arrayBuffer();
      const mesh = await parseGlbMesh(arrayBuffer);
      gltfMeshEngine.setCustomMesh(mesh);
      patchState({
        heroId: 'custom-glb',
        customGlbName: file.name,
      });
      triggerToast(
        `Loaded 3D Mesh: ${file.name} (${Math.round(mesh.vertices.length / 3).toLocaleString()} vertices, ${Math.round(mesh.indices.length / 3).toLocaleString()} triangles)`
      );
    } catch (err: any) {
      console.warn('GLB upload failed:', err);
      gltfMeshEngine.setCustomMesh(null);
      triggerToast(`GLB Upload Error: ${err?.message ?? 'Failed to parse GLB file'}`);
    } finally {
      target.value = '';
    }
  };

  // Spatial layout engine & variants (Option B)
  const currentEngine = createMemo<LayoutEngineType>(
    () => state.layoutEngine || getLayoutEngine(state.layoutId)
  );
  const activeEngineMeta = createMemo(
    () => LAYOUT_ENGINES[currentEngine()] || LAYOUT_ENGINES.GridEngine
  );
  const activeVariantId = createMemo(
    () => state.layoutVariant || activeEngineMeta().defaultVariant
  );
  const activeVariantObj = createMemo(
    () =>
      activeEngineMeta().variants.find((v) => v.id === activeVariantId()) ||
      activeEngineMeta().variants[0]
  );

  // Catalogs from registry
  const backgrounds = () => studioRegistry.getBackgrounds();
  const shaders = () => studioRegistry.getShaders();
  const heroes = () => studioRegistry.getHeroes();
  const curatedPalettes = () => studioRegistry.getPalettes();

  // Active dynamic uniforms
  const bgUniforms = createMemo(() => studioRegistry.getBackgroundUniforms(state.bgGraphicId));
  const shaderUniforms = createMemo(() => studioRegistry.getShaderUniforms(state.shaderId));
  const heroUniforms = createMemo(() => studioRegistry.getHeroUniforms(state.heroId));
  const stageShapes = () => studioRegistry.getStageShapes();
  const stageAspects = () => studioRegistry.getStageAspects();

  const [heroFilter, setHeroFilter] = createSignal<'all' | '3d' | 'hardware' | 'lottie'>('all');

  const filteredHeroes = createMemo(() => {
    const all = heroes();
    const filter = heroFilter();
    if (filter === '3d') {
      const mesh3dIds = new Set([
        'architectural-monolith',
        'chrome-torus-pod',
        'sculpture',
        'isometric-plinth',
        'prism-crystal',
        'quantum-core',
        'classical-bust',
        'bauhaus-geometry',
        'destijl-grid-plinth',
        'deco-ziggurat',
        'custom-glb',
      ]);
      return all.filter((h) => mesh3dIds.has(h.id) || h.category.toLowerCase().includes('3d'));
    }
    if (filter === 'hardware') {
      return all.filter((h) => h.category.toLowerCase().includes('hardware') || h.category.toLowerCase().includes('tech'));
    }
    if (filter === 'lottie') {
      return all.filter((h) => h.isLottie);
    }
    return all;
  });

  const activeMediaItem = createMemo(() => {
    if (state.activeMediaAssetId) {
      return MEDIA_CATALOG.find((m) => m.id === state.activeMediaAssetId);
    }
    if (state.bgVideoUrl) {
      return MEDIA_CATALOG.find((m) => m.url === state.bgVideoUrl);
    }
    if (state.bgCustomImageKey) {
      return MEDIA_CATALOG.find((m) => m.id === state.bgCustomImageKey);
    }
    return null;
  });

  const handleImageUpload = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    try {
      const filename = `bg_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const savedKey = await saveImageToOpfs(file, filename);
      patchState({
        bgGraphicId: 'custom-image',
        bgCustomImageKey: savedKey,
      });
      triggerToast(`Loaded Background via OPFS (${file.name})`);
    } catch {
      triggerToast('Failed to load image into OPFS');
    }
  };

  const handleClearCustomImage = async () => {
    if (state.bgCustomImageKey) {
      await deleteImageFromOpfs(state.bgCustomImageKey);
    }
    patchState({
      bgGraphicId: 'duotone-mesh',
      bgCustomImageKey: null,
    });
    triggerToast('Reset to Procedural Background');
  };

  const handleFontUpload = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    try {
      const meta = await loadCustomFontFile(file);
      patchState({
        customFontKey: meta.key,
        customFontFamily: meta.fontFamily,
      });
      triggerToast(`Loaded Custom Font: ${file.name}`);
    } catch {
      triggerToast('Failed to load custom font');
    }
  };

  const handleClearFont = async () => {
    if (state.customFontKey) {
      await deleteAsset(state.customFontKey);
    }
    patchState({ customFontKey: null, customFontFamily: null });
    triggerToast('Reset to Default System Typography');
  };

  const handleLogoUpload = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    try {
      const key = `logo_${Date.now()}`;
      await saveAsset(key, file, 'vector', file.name, file.type || 'image/svg+xml');
      patchState({
        vectorLogoKey: key,
        vectorLogoAnchor: state.vectorLogoAnchor ?? 'top-left',
        vectorLogoScale: state.vectorLogoScale ?? 1.0,
      });
      triggerToast(`Loaded Vector Mark: ${file.name}`);
    } catch {
      triggerToast('Failed to save vector logo');
    }
  };

  const handleClearLogo = async () => {
    if (state.vectorLogoKey) {
      await deleteAsset(state.vectorLogoKey);
    }
    patchState({ vectorLogoKey: null });
    triggerToast('Removed Brand Vector Mark');
  };

  const handleCutoutUpload = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    try {
      triggerToast('Isolating Subject Edge Boundaries...');
      const result = await processImageCutout(file);
      patchState({
        userPhotoCutoutKey: result.key,
        heroBreakout: true,
      });
      triggerToast('Applied 2.5D Focal Photo Breakout');
    } catch {
      triggerToast('Failed to extract image cutout');
    }
  };

  const handleClearCutout = async () => {
    if (state.userPhotoCutoutKey) {
      await deleteAsset(state.userPhotoCutoutKey);
    }
    patchState({ userPhotoCutoutKey: null });
    triggerToast('Cleared Cutout Subject');
  };

  return (
    <div class="space-y-4 w-full min-w-0">
      {/* 1. SCENE BRAND ARCHETYPE & BASELINE DIFF */}
      <div class="p-2.5 rounded border border-border bg-card/40 space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <Shield class="w-3.5 h-3.5 text-primary" />
            <span class="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
              Scene Brand Archetype
            </span>
            <Show when={state.isStoryboardMode}>
              <Badge variant="primary" class="text-[9px] py-0 px-1 font-bold">SCENE SPECIFIC</Badge>
            </Show>
          </div>
          <Badge variant="lime" class="font-bold">{state.archetypeId}</Badge>
        </div>

        {/* Diff Accordion & Revert */}
        <div class="flex items-center justify-between text-xs font-mono pt-1">
          <span class="text-muted-foreground text-[11px]">Archetype Preset Diff:</span>
          <Show
            when={diffs().length > 0}
            fallback={
              <span class="text-emerald-500 flex items-center gap-1 font-semibold text-[11px]">
                <Check class="w-3 h-3" /> Pure Preset
              </span>
            }
          >
            <div class="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDiffExpanded((prev) => !prev)}
                class="text-amber-500 hover:underline flex items-center gap-0.5 cursor-pointer font-semibold text-[11px]"
              >
                {diffs().length} customized
                <Show
                  when={diffExpanded()}
                  fallback={<ChevronRight class="w-2.5 h-2.5" />}
                >
                  <ChevronDown class="w-2.5 h-2.5" />
                </Show>
              </button>
              <button
                type="button"
                onClick={() => {
                  revertToArchetype();
                  triggerToast(`Reverted to ${state.archetypeId} (Text preserved)`);
                }}
                class="text-primary hover:underline flex items-center gap-0.5 cursor-pointer font-semibold text-[11px]"
              >
                <RotateCcw class="w-2.5 h-2.5" /> Revert
              </button>
            </div>
          </Show>
        </div>

        <Show when={diffExpanded() && diffs().length > 0}>
          <div class="mt-1.5 max-h-28 overflow-y-auto space-y-0.5 p-1.5 rounded bg-background border border-border text-[11px] font-mono">
            <For each={diffs()}>
              {(d) => (
                <div class="flex items-center justify-between text-foreground">
                  <span class="text-muted-foreground">{d.label}:</span>
                  <span class="text-amber-500 font-semibold truncate max-w-[120px]">
                    {String(d.currentValue)}
                  </span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* 2. SPATIAL SKELETON & LAYOUT (6 ENGINES) */}
      <div class="p-2.5 rounded border border-border bg-card/40 space-y-2.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono uppercase tracking-wider text-foreground font-bold flex items-center gap-1.5">
            <Layers class="w-3.5 h-3.5 text-primary" />
            6 Layout Engines
          </span>
          <Badge variant="lime">{activeEngineMeta().tag}</Badge>
        </div>

        {/* 6 Engine Cards (2x3 Grid) */}
        <div class="grid grid-cols-2 gap-1.5">
          <For each={Object.keys(LAYOUT_ENGINES) as LayoutEngineType[]}>
            {(engKey) => {
              const eng = LAYOUT_ENGINES[engKey];
              const isActive = () => currentEngine() === engKey;
              return (
                <button
                  type="button"
                  onClick={() => {
                    patchState({
                      layoutEngine: engKey,
                      layoutVariant: eng.defaultVariant,
                      layoutId: eng.variants[0].legacyLayoutId,
                    });
                    triggerToast(`Activated [${eng.name}]`);
                  }}
                  class={cn(
                    'p-2 rounded text-left border font-mono text-xs transition-all cursor-pointer min-w-0 flex flex-col justify-between',
                    isActive()
                      ? 'bg-primary text-primary-foreground font-bold border-primary shadow-xs'
                      : 'bg-card border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div class="font-bold leading-snug">{eng.name.replace(' Engine', '')}</div>
                  <div class="text-[11px] text-muted-foreground leading-normal mt-0.5">{eng.tag}</div>
                </button>
              );
            }}
          </For>
        </div>

        {/* Sub-Style Variant Selector Chips */}
        <div class="space-y-1 pt-1 border-t border-border/60">
          <div class="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span>{activeEngineMeta().name} Sub-Styles:</span>
            <span class="text-primary font-bold">{activeVariantObj()?.name}</span>
          </div>
          <div class="grid grid-cols-3 gap-1">
            <For each={activeEngineMeta().variants}>
              {(v) => {
                const isVActive = () => activeVariantId() === v.id;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      patchState({
                        layoutEngine: currentEngine(),
                        layoutVariant: v.id,
                        layoutId: v.legacyLayoutId,
                      });
                      triggerToast(`Variant: ${v.name}`);
                    }}
                    class={cn(
                      'p-1.5 rounded text-center border font-mono text-[11px] transition-all cursor-pointer min-w-0 truncate',
                      isVActive()
                        ? 'bg-primary/20 text-primary font-bold border-primary shadow-xs'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-border'
                    )}
                    title={v.desc}
                  >
                    <div class="truncate font-bold">{v.name}</div>
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        {/* Spatial Guardrails */}
        <div class="space-y-1.5 pt-1 border-t border-border">
          <SwitchRow
            label="Grid Blueprint & Optical Reticle"
            sublabel="Modular thirds, golden spiral & axial guides"
            checked={state.blueprintGrid}
            onChange={(v) => patchState({ blueprintGrid: v })}
          />
          <SwitchRow
            label="9:16 Reels / TikTok Safe Zone Guard"
            sublabel="Reserves bottom 20% caption & right 15% UI dock"
            checked={state.safeZone916}
            onChange={(v) => patchState({ safeZone916: v })}
          />
          <SwitchRow
            label="Top-1/3 Headline Z-Pattern Flow"
            sublabel="Places Headline in top 1/3 & Hero in core"
            checked={state.topHeadlineFlow}
            onChange={(v) => patchState({ topHeadlineFlow: v })}
          />

          <div class="pt-1">
            <div class="flex justify-between text-xs font-mono mb-1">
              <span class="text-muted-foreground uppercase">Margin Breather</span>
              <span class="text-foreground font-semibold">{state.gridMarginPx}px</span>
            </div>
            <input
              type="range"
              min={16}
              max={48}
              step={4}
              value={state.gridMarginPx}
              onInput={(e) =>
                patchState({ gridMarginPx: Number(e.currentTarget.value) })
              }
              class="w-full accent-primary cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 3. LAYER 0: BACKGROUND PLATE */}
      <div class="p-2.5 rounded border border-border bg-card/40 space-y-2.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
            Layer 0 // Background Plate ({backgrounds().length} Graphics)
          </span>
          <span class="text-xs font-mono text-muted-foreground">
            {state.bgGraphicId === 'custom-image' ? 'OPFS Custom' : state.bgGraphicId}
          </span>
        </div>

        {/* Background Graphic Selector */}
        <div class="grid grid-cols-2 gap-1.5">
          <For each={backgrounds()}>
            {(bg) => {
              const isSelected = () => state.bgGraphicId === bg.id;
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (bg.id === 'custom-image') {
                      fileInputRef?.click();
                    } else {
                      patchState({ bgGraphicId: bg.id });
                    }
                  }}
                  class={cn(
                    'py-2 px-2.5 rounded text-left border transition-all cursor-pointer flex flex-col justify-between min-w-0',
                    isSelected()
                      ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                      : 'bg-card border-border hover:border-border text-foreground'
                  )}
                >
                  <span class="text-xs font-mono font-medium leading-snug">{bg.name}</span>
                  <span class="text-[11px] font-mono text-muted-foreground uppercase font-medium mt-0.5">
                    {bg.category}
                  </span>
                </button>
              );
            }}
          </For>
        </div>

        {/* OPFS Image Upload Action */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.svg"
          onChange={handleImageUpload}
          class="hidden"
        />

        <div class="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            onClick={() => fileInputRef?.click()}
            class="flex-1 text-xs font-mono border-border text-foreground hover:bg-accent"
          >
            <Upload class="w-3 h-3" />
            Upload Image (OPFS)
          </Button>

          <Show when={props.onOpenMediaVault}>
            <Button
              variant="outline"
              size="xs"
              onClick={() => props.onOpenMediaVault?.()}
              class="flex-1 text-xs font-mono border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
              title="Open Media Vault (Curated CC0 Footages, Photos & Art)"
            >
              <Film class="w-3 h-3" />
              ✦ Media Vault
            </Button>
          </Show>

          <Show when={state.bgCustomImageKey}>
            <Button
              variant="destructive"
              size="xs"
              onClick={handleClearCustomImage}
              title="Remove Custom Image"
            >
              <Trash2 class="w-3 h-3" />
            </Button>
          </Show>
        </div>

        {/* Active Media Vault Status Banner */}
        <Show when={activeMediaItem()}>
          {(item) => (
            <div class="p-2 rounded bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between text-xs font-mono">
              <div class="flex items-center gap-1.5 overflow-hidden">
                <Show when={item().mediaType === 'video'} fallback={<ImageIcon class="w-3.5 h-3.5 text-cyan-400 shrink-0" />}>
                  <Film class="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                </Show>
                <div class="truncate">
                  <span class="text-cyan-400 font-bold">{item().name}</span>
                  <span class="text-muted-foreground ml-1.5 text-[10px]">({item().license})</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  videoTextureEngine.setActiveVideo(null);
                  patchState({
                    bgVideoUrl: null,
                    bgCustomImageKey: null,
                    activeMediaAssetId: null,
                    bgGraphicId: 'solid',
                  });
                  triggerToast('Cleared active media asset');
                }}
                class="text-rose-400 hover:text-rose-300 ml-2 shrink-0 cursor-pointer text-[10px]"
                title="Clear Media Asset"
              >
                Clear
              </button>
            </div>
          )}
        </Show>

        {/* Background Sliders */}
        <div class="grid grid-cols-2 gap-2 pt-1 border-t border-border">
          <div>
            <div class="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Opacity</span>
              <span>{Math.round(state.bgOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={state.bgOpacity}
              onInput={(e) =>
                patchState({ bgOpacity: Number(e.currentTarget.value) })
              }
              class="w-full accent-primary cursor-pointer"
            />
          </div>

          <div>
            <div class="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Scale</span>
              <span>{state.bgScale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.05}
              value={state.bgScale}
              onInput={(e) =>
                patchState({ bgScale: Number(e.currentTarget.value) })
              }
              class="w-full accent-primary cursor-pointer"
            />
          </div>
        </div>

        {/* Blend Mode & Treatments */}
        <div class="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label class="text-xs font-mono uppercase text-muted-foreground block mb-1">
              Canvas Blend Mode
            </label>
            <select
              value={state.bgBlendMode}
              onChange={(e) =>
                patchState({
                  bgBlendMode: e.currentTarget.value as BackgroundBlendMode,
                })
              }
              class="w-full bg-card border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            >
              <option value="normal">Normal (Source Over)</option>
              <option value="multiply">Multiply (Shadow Remap)</option>
              <option value="screen">Screen (Light Projection)</option>
              <option value="overlay">Overlay (High Contrast)</option>
              <option value="soft-light">Soft Light (Subtle)</option>
              <option value="luminosity">Luminosity (Luma Only)</option>
            </select>
          </div>

          <div class="space-y-1">
            <Show when={state.bgGraphicId === 'custom-image'}>
              <div class="pt-2 pb-1 border-t border-border space-y-2">
                <label class="text-xs font-mono text-foreground font-bold flex items-center justify-between">
                  <span>Darkroom Media Grading</span>
                  <Badge variant="outline" class="text-[9px] uppercase">Pillar 2</Badge>
                </label>
                <select
                  value={state.bgDarkroomMode || 'natural'}
                  onChange={(e) =>
                    patchState({
                      bgDarkroomMode: e.currentTarget.value as typeof state.bgDarkroomMode,
                    })
                  }
                  class="w-full bg-card border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="natural">Natural (Unfiltered Photo)</option>
                  <option value="duotone">Duotone (Ink & Accent)</option>
                  <option value="tritone">Tritone (Ink, Accent, Surface)</option>
                  <option value="risograph">Risograph (8x8 Bayer Dither)</option>
                </select>

                <Show when={(state.bgDarkroomMode || 'natural') !== 'natural'}>
                  <SwitchRow
                    label="Plate Misregistration"
                    sublabel="Simulate physical rotary drum drift"
                    checked={state.bgDarkroomMisreg ?? false}
                    onChange={(v) => patchState({ bgDarkroomMisreg: v })}
                  />
                  <div class="flex items-center justify-between text-xs font-mono text-muted-foreground pt-1">
                    <span>Dither Scale</span>
                    <select
                      value={state.bgDarkroomDitherScale ?? 1}
                      onChange={(e) =>
                        patchState({
                          bgDarkroomDitherScale: Number(e.currentTarget.value),
                        })
                      }
                      class="bg-card border border-border rounded px-1.5 py-0.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="1">1x Fine Screen (HD)</option>
                      <option value="2">2x Chunky Screenprint</option>
                      <option value="3">3x Retro Zine Halftone</option>
                    </select>
                  </div>
                </Show>
              </div>
            </Show>

            <Show when={state.bgGraphicId !== 'custom-image'}>
              <SwitchRow
                label="Duotone Remap"
                sublabel="Shadow=BG, Highlight=Accent"
                checked={state.bgDuotone}
                onChange={(v) => patchState({ bgDuotone: v })}
              />
            </Show>
            <SwitchRow
              label="Background Drift"
              sublabel="0.2x speed motion vs static"
              checked={state.bgMotion}
              onChange={(v) => patchState({ bgMotion: v })}
            />
          </div>
        </div>

        {/* Dynamic Background Uniforms */}
        <Show when={bgUniforms().length > 0}>
          <div class="pt-2 border-t border-border space-y-2">
            <span class="text-xs font-mono text-foreground uppercase tracking-wider block font-bold flex items-center gap-1">
              <Sliders class="w-3 h-3" />
              Dynamic Parameters ({state.bgGraphicId})
            </span>
            <For each={bgUniforms()}>
              {(u) => {
                const val = () => state.bgParams[u.id] ?? u.default;
                return (
                  <div>
                    <div class="flex justify-between text-xs font-mono text-muted-foreground mb-0.5">
                      <span>{u.name}</span>
                      <span>
                        {String(val())}
                        {u.unit ?? ''}
                      </span>
                    </div>
                    <Show when={u.type === 'number'}>
                      <input
                        type="range"
                        min={u.min ?? 0}
                        max={u.max ?? 100}
                        step={u.step ?? 1}
                        value={Number(val())}
                        onInput={(e) =>
                          patchState({
                            bgParams: {
                              ...state.bgParams,
                              [u.id]: Number(e.currentTarget.value),
                            },
                          })
                        }
                        class="w-full accent-primary cursor-pointer"
                      />
                    </Show>
                    <Show when={u.type === 'boolean'}>
                      <SwitchRow
                        label={u.name}
                        checked={Boolean(val())}
                        onChange={(v) =>
                          patchState({
                            bgParams: { ...state.bgParams, [u.id]: v },
                          })
                        }
                      />
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* 4. LAYER 1: AMBIENT PLATE SHADERS */}
      <div class="p-2.5 rounded border border-border bg-card/40 space-y-2.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
            Layer 1 // Ambient Plate ({shaders().length} Shaders)
          </span>
          <span class="text-xs font-mono text-muted-foreground">{state.shaderId}</span>
        </div>

        {/* Shader Selector Grid */}
        <div class="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
          <For each={shaders()}>
            {(s) => {
              const isSelected = () => state.shaderId === s.id;
              return (
                <button
                  type="button"
                  onClick={() => patchState({ shaderId: s.id })}
                  class={cn(
                    'p-1.5 rounded text-left border transition-all cursor-pointer flex flex-col min-w-0',
                    isSelected()
                      ? 'bg-primary/10 border-primary text-primary font-bold'
                      : 'bg-card border-border hover:border-border text-foreground'
                  )}
                >
                  <span class="text-xs font-mono font-medium leading-snug">{s.name}</span>
                  <span class="text-[11px] font-mono text-muted-foreground mt-0.5">
                    {s.role}
                  </span>
                </button>
              );
            }}
          </For>
        </div>

        {/* Shader Controls */}
        <div class="grid grid-cols-2 gap-2 pt-1 border-t border-border">
          <div>
            <div class="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Turbulence</span>
              <span>{state.shaderTurbulence.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.2}
              max={2.0}
              step={0.05}
              value={state.shaderTurbulence}
              onInput={(e) =>
                patchState({ shaderTurbulence: Number(e.currentTarget.value) })
              }
              class="w-full accent-primary cursor-pointer"
            />
          </div>

          <div>
            <div class="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Opacity</span>
              <span>{Math.round(state.shaderOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={state.shaderOpacity}
              onInput={(e) =>
                patchState({ shaderOpacity: Number(e.currentTarget.value) })
              }
              class="w-full accent-primary cursor-pointer"
            />
          </div>
        </div>

        {/* Dynamic Shader Uniforms */}
        <Show when={shaderUniforms().length > 0}>
          <div class="pt-2 border-t border-border space-y-2">
            <span class="text-xs font-mono text-foreground uppercase tracking-wider block font-bold flex items-center gap-1">
              <Sliders class="w-3 h-3" />
              Dynamic Parameters ({state.shaderId})
            </span>
            <For each={shaderUniforms()}>
              {(u) => {
                const val = () => state.shaderParams[u.id] ?? u.default;
                return (
                  <div>
                    <div class="flex justify-between text-xs font-mono text-muted-foreground mb-0.5">
                      <span>{u.name}</span>
                      <span>
                        {String(val())}
                        {u.unit ?? ''}
                      </span>
                    </div>
                    <Show when={u.type === 'number'}>
                      <input
                        type="range"
                        min={u.min ?? 0}
                        max={u.max ?? 100}
                        step={u.step ?? 1}
                        value={Number(val())}
                        onInput={(e) =>
                          patchState({
                            shaderParams: {
                              ...state.shaderParams,
                              [u.id]: Number(e.currentTarget.value),
                            },
                          })
                        }
                        class="w-full accent-primary cursor-pointer"
                      />
                    </Show>
                    <Show when={u.type === 'boolean'}>
                      <SwitchRow
                        label={u.name}
                        checked={Boolean(val())}
                        onChange={(v) =>
                          patchState({
                            shaderParams: { ...state.shaderParams, [u.id]: v },
                          })
                        }
                      />
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* 5. LAYER 2: HERO STAGE GEOMETRY & FRAME */}
      <div class="p-2.5 rounded border border-border bg-card/40 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
            Layer 2 // Stage Geometry & Frame
          </span>
          <span class="text-xs font-mono text-muted-foreground">
            {state.stageShape} // {state.stageAspect}
          </span>
        </div>

        {/* Stage Geometry Shape Selector */}
        <div class="space-y-1">
          <div class="flex justify-between text-xs font-mono text-muted-foreground">
            <span>Geometry Shape</span>
            <span class="text-foreground font-semibold">{state.stageShape}</span>
          </div>
          <div class="grid grid-cols-3 gap-1">
            <For each={stageShapes()}>
              {(s) => {
                const isSelected = () => state.stageShape === s.id;
                return (
                  <button
                    type="button"
                    onClick={() => patchState({ stageShape: s.id })}
                    class={cn(
                      'px-1.5 py-1 rounded border text-xs font-mono flex items-center justify-between transition-all cursor-pointer min-w-0',
                      isSelected()
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                        : 'border-border bg-card text-muted-foreground hover:border-border hover:text-foreground'
                    )}
                    title={s.description}
                  >
                    <span class="truncate">{s.name}</span>
                    <span class="text-xs opacity-80 ml-0.5">{s.glyph}</span>
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        {/* Aspect Shape Override */}
        <div class="space-y-1">
          <div class="flex justify-between text-xs font-mono text-muted-foreground">
            <span>Aspect Ratio Shape</span>
            <span class="text-foreground font-semibold">{state.stageAspect}</span>
          </div>
          <div class="flex flex-wrap gap-1">
            <For each={stageAspects()}>
              {(a) => {
                const isSelected = () => state.stageAspect === a.id;
                return (
                  <button
                    type="button"
                    onClick={() => patchState({ stageAspect: a.id })}
                    class={cn(
                      'px-2 py-0.5 rounded border text-xs font-mono transition-all cursor-pointer',
                      isSelected()
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border bg-card text-muted-foreground hover:border-border hover:text-foreground'
                    )}
                    title={a.description}
                  >
                    {a.name}
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        {/* Geometry Fine-Tuning Sliders: Corner Radius, Scale, Y-Offset */}
        <div class="grid grid-cols-3 gap-2 pt-1 border-t border-border">
          <div>
            <div class="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Radius</span>
              <span>{state.stageCornerRadius}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={48}
              step={2}
              value={state.stageCornerRadius}
              onInput={(e) =>
                patchState({ stageCornerRadius: Number(e.currentTarget.value) })
              }
              class="w-full accent-primary cursor-pointer"
            />
          </div>

          <div>
            <div class="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Scale</span>
              <span>{Math.round(state.stageScale * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={state.stageScale}
              onInput={(e) =>
                patchState({ stageScale: Number(e.currentTarget.value) })
              }
              class="w-full accent-primary cursor-pointer"
            />
          </div>

          <div>
            <div class="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Offset Y</span>
              <span>
                {state.stageOffsetY > 0 ? `+${state.stageOffsetY}` : state.stageOffsetY}
                px
              </span>
            </div>
            <input
              type="range"
              min={-60}
              max={60}
              step={2}
              value={state.stageOffsetY}
              onInput={(e) =>
                patchState({ stageOffsetY: Number(e.currentTarget.value) })
              }
              class="w-full accent-primary cursor-pointer"
            />
          </div>
        </div>

        {/* Stage Surface Fill Color & Opacity */}
        <div class="space-y-1.5 pt-1 border-t border-border">
          <div class="flex justify-between items-center text-xs font-mono text-muted-foreground">
            <span>Stage Surface Color</span>
            <div class="flex items-center gap-1.5">
              <span class="text-foreground font-semibold uppercase">
                {state.stageColor}
              </span>
              <input
                type="color"
                value={
                  state.stageColor.startsWith('#')
                    ? state.stageColor
                    : state.palette.surface
                }
                onChange={(e) => patchState({ stageColor: e.currentTarget.value })}
                class="w-4 h-4 rounded cursor-pointer border border-border bg-transparent p-0"
                title="Custom Stage Fill Color"
              />
            </div>
          </div>
          <div class="flex flex-wrap gap-1">
            <For
              each={[
                { id: 'auto', label: 'Auto (Grad)' },
                { id: 'surface', label: 'Surface' },
                { id: 'bg', label: 'Bg' },
                { id: 'accent', label: 'Accent' },
                { id: 'accent2', label: 'Accent 2' },
                { id: 'ink', label: 'Ink' },
              ]}
            >
              {(c) => {
                const isSelected = () => state.stageColor === c.id;
                return (
                  <button
                    type="button"
                    onClick={() => patchState({ stageColor: c.id })}
                    class={cn(
                      'px-1.5 py-0.5 rounded border text-xs font-mono transition-all cursor-pointer',
                      isSelected()
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border bg-card text-muted-foreground hover:border-border hover:text-foreground'
                    )}
                  >
                    {c.label}
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        {/* Stage Border Color */}
        <div class="space-y-1.5 pt-1 border-t border-border">
          <div class="flex justify-between items-center text-xs font-mono text-muted-foreground">
            <span>Frame Border Color</span>
            <div class="flex items-center gap-1.5">
              <span class="text-foreground font-semibold uppercase">
                {state.stageBorderColor}
              </span>
              <input
                type="color"
                value={
                  state.stageBorderColor.startsWith('#')
                    ? state.stageBorderColor
                    : state.palette.accent
                }
                onChange={(e) =>
                  patchState({ stageBorderColor: e.currentTarget.value })
                }
                class="w-4 h-4 rounded cursor-pointer border border-border bg-transparent p-0"
                title="Custom Frame Border Color"
              />
            </div>
          </div>
          <div class="flex flex-wrap gap-1">
            <For
              each={[
                { id: 'accent', label: 'Accent' },
                { id: 'accent2', label: 'Accent 2' },
                { id: 'ink', label: 'Ink' },
                { id: 'surface', label: 'Surface' },
                { id: '#ffffff', label: 'White' },
              ]}
            >
              {(c) => {
                const isSelected = () => state.stageBorderColor === c.id;
                return (
                  <button
                    type="button"
                    onClick={() => patchState({ stageBorderColor: c.id })}
                    class={cn(
                      'px-1.5 py-0.5 rounded border text-xs font-mono transition-all cursor-pointer',
                      isSelected()
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border bg-card text-muted-foreground hover:border-border hover:text-foreground'
                    )}
                  >
                    {c.label}
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        {/* Sliders: Surface Opacity, Border Opacity, Border Width, Acrylic Blur */}
        <div class="grid grid-cols-2 gap-2 pt-1 border-t border-border">
          <div>
            <div class="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Surface Opacity</span>
              <span>{Math.round((state.stageOpacity ?? 0.5) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={state.stageOpacity ?? 0.5}
              onInput={(e) =>
                patchState({ stageOpacity: Number(e.currentTarget.value) })
              }
              class="w-full accent-primary cursor-pointer"
            />
          </div>

          <div>
            <div class="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Border Opacity</span>
              <span>{Math.round((state.stageBorderOpacity ?? 0.45) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={state.stageBorderOpacity ?? 0.45}
              onInput={(e) =>
                patchState({ stageBorderOpacity: Number(e.currentTarget.value) })
              }
              class="w-full accent-primary cursor-pointer"
            />
          </div>

          <div>
            <div class="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Border Width</span>
              <span>{state.stageBorderWidth ?? 1.5}px</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={8}
              step={0.5}
              value={state.stageBorderWidth ?? 1.5}
              onInput={(e) =>
                patchState({ stageBorderWidth: Number(e.currentTarget.value) })
              }
              class="w-full accent-primary cursor-pointer"
            />
          </div>

          <div>
            <div class="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Acrylic Blur</span>
              <span>{state.stageBlurPx}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              step={2}
              value={state.stageBlurPx}
              onInput={(e) =>
                patchState({ stageBlurPx: Number(e.currentTarget.value) })
              }
              class="w-full accent-primary cursor-pointer"
            />
          </div>
        </div>

        <div class="space-y-1.5 pt-1 border-t border-border">
          <SwitchRow
            label="2.5D Hero Frame Breakout"
            sublabel="Projects hero above stage frame with deep drop shadow"
            checked={state.heroBreakout}
            onChange={(v) => patchState({ heroBreakout: v })}
          />
          <SwitchRow
            label="Double Exposure Silhouette Mask"
            sublabel="Clips moving ambient shader inside central silhouette"
            checked={state.doubleExposure}
            onChange={(v) => patchState({ doubleExposure: v })}
          />
        </div>
      </div>

      {/* 6. LAYER 3: HERO FOCAL SUBJECT */}
      <div class="p-2.5 rounded border border-border bg-card/40 space-y-2.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
            Layer 3 // Hero Focal Subject ({heroes().length} Models)
          </span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={() => glbFileInputRef?.click()}
              class="text-xs font-mono text-cyan-400 hover:underline cursor-pointer flex items-center gap-1"
              title="Upload 3D binary glTF container (.glb)"
            >
              <Upload class="w-3 h-3" />
              <span>Upload .GLB</span>
            </button>
            <button
              type="button"
              onClick={() => props.onOpenLottieHub()}
              class="text-xs font-mono text-primary hover:underline cursor-pointer"
            >
              + Custom Lottie
            </button>
          </div>
        </div>

        {/* Hidden GLB File Input */}
        <input
          ref={glbFileInputRef}
          type="file"
          accept=".glb"
          onChange={handleGlbUpload}
          class="hidden"
        />

        {/* Custom Uploaded GLB Status Pill */}
        <Show when={state.heroId === 'custom-glb' && state.customGlbName}>
          <div class="p-2 rounded bg-cyan-950/30 border border-cyan-500/40 text-xs font-mono flex items-center justify-between">
            <div class="flex items-center gap-1.5 text-cyan-300 truncate">
              <Box class="w-3.5 h-3.5 shrink-0" />
              <span class="truncate">{state.customGlbName}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                gltfMeshEngine.setCustomMesh(null);
                patchState({ heroId: 'architectural-monolith', customGlbName: null });
                triggerToast('Reset to Default 3D Monolith');
              }}
              class="text-[10px] text-muted-foreground hover:text-destructive cursor-pointer ml-2 shrink-0"
              title="Reset 3D Mesh"
            >
              Reset
            </button>
          </div>
        </Show>

        {/* Category Filter Pills */}
        <div class="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setHeroFilter('all')}
            class={cn(
              'px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors',
              heroFilter() === 'all'
                ? 'bg-primary text-primary-foreground font-bold'
                : 'bg-muted hover:bg-accent text-muted-foreground'
            )}
          >
            All ({heroes().length})
          </button>
          <button
            type="button"
            onClick={() => setHeroFilter('3d')}
            class={cn(
              'px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors flex items-center gap-1',
              heroFilter() === '3d'
                ? 'bg-cyan-500 text-black font-bold'
                : 'bg-muted hover:bg-accent text-cyan-400'
            )}
          >
            <Box class="w-2.5 h-2.5" />
            <span>3D Mesh</span>
          </button>
          <button
            type="button"
            onClick={() => setHeroFilter('hardware')}
            class={cn(
              'px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors',
              heroFilter() === 'hardware'
                ? 'bg-primary text-primary-foreground font-bold'
                : 'bg-muted hover:bg-accent text-muted-foreground'
            )}
          >
            Hardware
          </button>
          <button
            type="button"
            onClick={() => setHeroFilter('lottie')}
            class={cn(
              'px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors',
              heroFilter() === 'lottie'
                ? 'bg-primary text-primary-foreground font-bold'
                : 'bg-muted hover:bg-accent text-muted-foreground'
            )}
          >
            Lottie SVG
          </button>
        </div>

        {/* Hero Selector Grid */}
        <div class="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
          <For each={filteredHeroes()}>
            {(h) => {
              const isSelected = () => state.heroId === h.id;
              return (
                <button
                  type="button"
                  onClick={() => patchState({ heroId: h.id })}
                  class={cn(
                    'p-1.5 rounded text-left border transition-all cursor-pointer flex flex-col min-w-0',
                    isSelected()
                      ? 'bg-primary/10 border-primary text-primary font-bold'
                      : 'bg-card border-border hover:border-border text-foreground'
                  )}
                >
                  <span class="text-xs font-mono font-medium leading-snug">{h.name}</span>
                  <span class="text-[11px] font-mono text-muted-foreground uppercase font-medium">
                    {h.category}
                  </span>
                </button>
              );
            }}
          </For>
        </div>

        {/* Hero Controls */}
        <div class="grid grid-cols-2 gap-2 pt-1 border-t border-border">
          <div>
            <div class="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Hero Scale</span>
              <span>{state.heroScale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.6}
              max={2.0}
              step={0.05}
              value={state.heroScale}
              onInput={(e) =>
                patchState({ heroScale: Number(e.currentTarget.value) })
              }
              class="w-full accent-primary cursor-pointer"
            />
          </div>

          <div>
            <label class="text-xs font-mono uppercase text-muted-foreground block mb-1">
              Hero Motion Mode
            </label>
            <select
              value={state.heroMotion}
              onChange={(e) =>
                patchState({ heroMotion: e.currentTarget.value as HeroMotionId })
              }
              class="w-full bg-card border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            >
              <option value="turntable">Turntable (360° Continuous)</option>
              <option value="float">Float (Harmonic Zero-G)</option>
              <option value="drift">Drift (Subtle Inertial)</option>
              <option value="shiver">Shiver (High-Frequency)</option>
              <option value="pulse">Pulse (Audio Beat Sync)</option>
            </select>
          </div>
        </div>

        {/* Dedicated 3D Camera Choreography Deck (Active when custom-glb or in Storyboard mode) */}
        <div class="mt-3 p-3 rounded-lg border border-border bg-card/60 flex flex-col gap-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <Box class="w-4 h-4 text-primary" />
              <span class="text-xs font-bold font-mono uppercase tracking-wider text-foreground">
                3D Camera Choreography
              </span>
              <Show when={state.isStoryboardMode}>
                <Badge variant="primary" class="text-[9px] py-0 px-1">SCENE SPECIFIC</Badge>
              </Show>
            </div>
            <label class="flex items-center gap-1 text-[11px] font-mono text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={state.choreo3d?.enabled ?? state.heroId === 'custom-glb'}
                onChange={(e) => {
                  const en = e.currentTarget.checked;
                  patchState({
                    heroId: en ? 'custom-glb' : state.heroId,
                    choreo3d: {
                      ...(state.choreo3d ?? {}),
                      enabled: en,
                      meshKey: state.choreo3d?.meshKey ?? 'custom-glb',
                      shotType: state.choreo3d?.shotType ?? 'turntable-orbit',
                    },
                  });
                }}
                class="accent-primary"
              />
              <span>Enabled</span>
            </label>
          </div>

          <Show when={state.choreo3d?.enabled ?? state.heroId === 'custom-glb'}>
            <div class="flex flex-col gap-2 pt-1 border-t border-border/40">
              {/* 3D Mesh Model Picker */}
              <div>
                <label class="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                  3D Subject Mesh
                </label>
                <select
                  value={state.choreo3d?.meshKey ?? 'custom-glb'}
                  onChange={(e) => {
                    const mKey = e.currentTarget.value;
                    patchState({
                      heroId: 'custom-glb',
                      choreo3d: { ...(state.choreo3d ?? { enabled: true }), meshKey: mKey },
                    });
                  }}
                  class="w-full bg-card border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="custom-glb">
                    {state.customGlbName ? `Uploaded GLB (${state.customGlbName})` : 'Uploaded GLB (or Default)'}
                  </option>
                  <option value="3d-torus-knot">Parametric Torus Knot (p=2, q=3)</option>
                  <option value="3d-icosahedron">Golden Ratio Icosahedron</option>
                  <option value="3d-monolith3d">Brutalist Architectural Monolith</option>
                </select>
              </div>

              {/* Cinematic Shot Framing */}
              <div>
                <label class="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                  Cinematic Camera Framing
                </label>
                <select
                  value={state.choreo3d?.shotType ?? 'turntable-orbit'}
                  onChange={(e) => {
                    patchState({
                      choreo3d: {
                        ...(state.choreo3d ?? { enabled: true }),
                        shotType: e.currentTarget.value as any,
                      },
                    });
                  }}
                  class="w-full bg-card border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="turntable-orbit">Turntable Orbit (360° Continuous)</option>
                  <option value="heroic-low-angle">Heroic Low-Angle (Worm's Eye +35°)</option>
                  <option value="bird-eye-high">Bird's Eye Overhead (-50° Plunge)</option>
                  <option value="dutch-tilt-dynamic">Dutch Tilt Dynamic (+22° Cant)</option>
                  <option value="macro-close-up">Macro Close-Up (2.2x Tight Detail)</option>
                  <option value="cinematic-dolly-zoom">Cinematic Dolly-Zoom (Vertigo t in [0, 1])</option>
                  <option value="custom">Custom Camera Angles</option>
                </select>
              </div>

              {/* Sliders: Zoom, Pitch, Yaw, Roll, Speed */}
              <div class="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div>
                  <div class="flex items-center justify-between text-muted-foreground mb-0.5">
                    <span>Camera Zoom</span>
                    <span>{(state.choreo3d?.cameraZoom ?? 1.0).toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.3}
                    max={3.0}
                    step={0.05}
                    value={state.choreo3d?.cameraZoom ?? 1.0}
                    onInput={(e) => {
                      patchState({
                        choreo3d: {
                          ...(state.choreo3d ?? { enabled: true }),
                          cameraZoom: parseFloat(e.currentTarget.value),
                        },
                      });
                    }}
                    class="w-full accent-primary cursor-pointer"
                  />
                </div>

                <div>
                  <div class="flex items-center justify-between text-muted-foreground mb-0.5">
                    <span>Rotation Tempo</span>
                    <span>{(state.choreo3d?.rotationSpeed ?? 1.0).toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.0}
                    max={4.0}
                    step={0.1}
                    value={state.choreo3d?.rotationSpeed ?? 1.0}
                    onInput={(e) => {
                      patchState({
                        choreo3d: {
                          ...(state.choreo3d ?? { enabled: true }),
                          rotationSpeed: parseFloat(e.currentTarget.value),
                        },
                      });
                    }}
                    class="w-full accent-primary cursor-pointer"
                  />
                </div>

                <div>
                  <div class="flex items-center justify-between text-muted-foreground mb-0.5">
                    <span>Elevation (Pitch)</span>
                    <span>{state.choreo3d?.cameraElevationDeg ?? 0}°</span>
                  </div>
                  <input
                    type="range"
                    min={-85}
                    max={85}
                    step={1}
                    value={state.choreo3d?.cameraElevationDeg ?? 0}
                    onInput={(e) => {
                      patchState({
                        choreo3d: {
                          ...(state.choreo3d ?? { enabled: true }),
                          cameraElevationDeg: parseInt(e.currentTarget.value, 10),
                        },
                      });
                    }}
                    class="w-full accent-primary cursor-pointer"
                  />
                </div>

                <div>
                  <div class="flex items-center justify-between text-muted-foreground mb-0.5">
                    <span>Camera Roll</span>
                    <span>{state.choreo3d?.cameraRollDeg ?? 0}°</span>
                  </div>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    step={1}
                    value={state.choreo3d?.cameraRollDeg ?? 0}
                    onInput={(e) => {
                      patchState({
                        choreo3d: {
                          ...(state.choreo3d ?? { enabled: true }),
                          cameraRollDeg: parseInt(e.currentTarget.value, 10),
                        },
                      });
                    }}
                    class="w-full accent-primary cursor-pointer"
                  />
                </div>
              </div>

              {/* Lighting & Wireframe */}
              <div class="flex items-center justify-between pt-1 gap-2 border-t border-border/30">
                <div class="flex-1">
                  <div class="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-0.5">
                    <span>Light Azimuth</span>
                    <span>{state.choreo3d?.lightAzimuthDeg ?? 45}°</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={state.choreo3d?.lightAzimuthDeg ?? 45}
                    onInput={(e) => {
                      patchState({
                        choreo3d: {
                          ...(state.choreo3d ?? { enabled: true }),
                          lightAzimuthDeg: parseInt(e.currentTarget.value, 10),
                        },
                      });
                    }}
                    class="w-full accent-primary cursor-pointer"
                  />
                </div>

                <label class="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground cursor-pointer shrink-0 mt-3">
                  <input
                    type="checkbox"
                    checked={state.choreo3d?.wireframe ?? true}
                    onChange={(e) => {
                      patchState({
                        choreo3d: {
                          ...(state.choreo3d ?? { enabled: true }),
                          wireframe: e.currentTarget.checked,
                        },
                      });
                    }}
                    class="accent-primary"
                  />
                  <span>Wireframe</span>
                </label>
              </div>
            </div>
          </Show>
        </div>

        {/* Hero Micro-Kinetics */}
        <div class="pt-1">
          <SwitchRow
            label="Hero Micro-Kinetics"
            sublabel="Internal moving parts (rotors, patch cables, VU needles)"
            checked={state.heroMicroKinetics}
            onChange={(v) => patchState({ heroMicroKinetics: v })}
          />
        </div>

        {/* Dynamic Hero Uniforms */}
        <Show when={heroUniforms().length > 0}>
          <div class="pt-2 border-t border-border space-y-2">
            <span class="text-xs font-mono text-foreground uppercase tracking-wider block font-bold flex items-center gap-1">
              <Sliders class="w-3 h-3" />
              Dynamic Parameters ({state.heroId})
            </span>
            <For each={heroUniforms()}>
              {(u) => {
                const val = () => state.heroParams[u.id] ?? u.default;
                return (
                  <div>
                    <div class="flex justify-between text-xs font-mono text-muted-foreground mb-0.5">
                      <span>{u.name}</span>
                      <span>
                        {String(val())}
                        {u.unit ?? ''}
                      </span>
                    </div>
                    <Show when={u.type === 'number'}>
                      <input
                        type="range"
                        min={u.min ?? 0}
                        max={u.max ?? 100}
                        step={u.step ?? 1}
                        value={Number(val())}
                        onInput={(e) =>
                          patchState({
                            heroParams: {
                              ...state.heroParams,
                              [u.id]: Number(e.currentTarget.value),
                            },
                          })
                        }
                        class="w-full accent-primary cursor-pointer"
                      />
                    </Show>
                    <Show when={u.type === 'boolean'}>
                      <SwitchRow
                        label={u.name}
                        checked={Boolean(val())}
                        onChange={(v) =>
                          patchState({
                            heroParams: { ...state.heroParams, [u.id]: v },
                          })
                        }
                      />
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        {/* 2.5D Focal Photo Cutout Subject */}
        <div class="pt-2 border-t border-border space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <span>Photo Cutout Subject (2.5D Breakout)</span>
            </span>
            <Show
              when={state.userPhotoCutoutKey}
              fallback={
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => cutoutInputRef?.click()}
                  class="text-xs h-7 px-2.5"
                >
                  <Upload class="w-2.5 h-2.5 mr-1" />
                  Cutout Photo
                </Button>
              }
            >
              <Button
                variant="destructive"
                size="xs"
                onClick={handleClearCutout}
                class="text-xs h-7 px-2.5"
              >
                <Trash2 class="w-2.5 h-2.5 mr-1" />
                Clear
              </Button>
            </Show>
          </div>
          <input
            ref={cutoutInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleCutoutUpload}
            class="hidden"
          />
          <Show when={state.userPhotoCutoutKey}>
            <div class="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1">
              ✓ Active Cutout Subject (Edge Isolated Breakout)
            </div>
          </Show>
        </div>
      </div>

      {/* 7. BRAND COLOR TOKENS & PALETTE SYNTHESIZER */}
      <div class="p-2.5 rounded border border-border bg-card/40 space-y-2.5">
        <div class="flex items-center justify-between">
          <label class="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
            Brand Color Tokens
          </label>
          <Button
            variant="primary"
            size="xs"
            onClick={handleSynthesizePalette}
          >
            <Wand2 class="w-3 h-3" />
            Synthesize Palette
          </Button>
        </div>

        {/* Curated Swatch Pills */}
        <div class="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 min-w-0 w-full">
          <For each={curatedPalettes()}>
            {(cp) => (
              <button
                type="button"
                onClick={() => patchState({ palette: cp.palette })}
                class="px-2 py-1 rounded bg-card border border-border hover:border-primary/50 text-xs font-mono text-foreground flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span
                  class="w-2 h-2 rounded-full shrink-0"
                  style={{ "background-color": cp.palette.accent }}
                />
                <span class="truncate">{cp.name}</span>
              </button>
            )}
          </For>
        </div>

        {/* Color Pickers */}
        <div class="grid grid-cols-5 gap-1.5 min-w-0">
          <For
            each={[
              ['bg', 'BG'],
              ['surface', 'Stage'],
              ['ink', 'Ink'],
              ['accent', 'Pri'],
              ['accent2', 'Sec'],
            ] as Array<[keyof PaletteTokens, string]>}
          >
            {([key, label]) => (
              <label class="flex flex-col items-center p-1.5 rounded bg-card border border-border cursor-pointer min-w-0">
                <input
                  type="color"
                  value={state.palette[key]}
                  onChange={(e) =>
                    patchState({
                      palette: {
                        ...state.palette,
                        [key]: e.currentTarget.value,
                      },
                    })
                  }
                  class="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                />
                <span class="text-xs font-mono text-muted-foreground mt-1">
                  {label}
                </span>
              </label>
            )}
          </For>
        </div>
      </div>

      {/* 8. STUDIO SURFACE TREATMENTS */}
      <div class="p-2.5 rounded border border-border bg-card/40 space-y-1.5">
        <label class="text-xs font-mono uppercase tracking-wider text-foreground font-bold block">
          Studio Surface Treatments
        </label>
        <SwitchRow
          label="Organic Light Leaks & Dust Motes"
          sublabel="Keeps Golden Hold frame alive without distraction"
          checked={state.lightLeaks}
          onChange={(v) => patchState({ lightLeaks: v })}
        />
        <SwitchRow
          label="Retro VHS Analog Scratches & Grain"
          sublabel="Celluloid scanlines & vintage tape texture"
          checked={state.vhsGrain}
          onChange={(v) => patchState({ vhsGrain: v })}
        />
        <SwitchRow
          label="SVG Liquid & Fluid Distortion Warp"
          sublabel="Real-time feTurbulence psychedelic wave filter"
          checked={state.liquidWarp}
          onChange={(v) => patchState({ liquidWarp: v })}
        />
      </div>

      {/* 9. BRAND ASSETS & VECTOR IDENTITY: Custom Font & SVG Logo */}
      <div class="p-2.5 rounded border border-border bg-card/40 space-y-3">
        <span class="text-xs font-mono uppercase tracking-wider text-foreground font-bold flex items-center gap-1.5">
          <Shield class="w-3.5 h-3.5 text-primary" />
          <span>9. Brand Assets & Vector Identity</span>
        </span>

        {/* Custom Font Ingestion */}
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <Type class="w-3 h-3 text-amber-400" />
              <span>Custom Web Font (.woff2 / .ttf / .otf)</span>
            </span>
            <Show
              when={state.customFontKey}
              fallback={
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => fontInputRef?.click()}
                  class="text-xs h-7 px-2.5"
                >
                  <Upload class="w-2.5 h-2.5 mr-1" />
                  Upload Font
                </Button>
              }
            >
              <Button
                variant="destructive"
                size="xs"
                onClick={handleClearFont}
                class="text-xs h-7 px-2.5"
              >
                <Trash2 class="w-2.5 h-2.5 mr-1" />
                Remove
              </Button>
            </Show>
          </div>
          <input
            ref={fontInputRef}
            type="file"
            accept=".woff2,.ttf,.otf"
            onChange={handleFontUpload}
            class="hidden"
          />
          <Show when={state.customFontFamily}>
            <div class="text-xs font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 truncate">
              FontFace: {state.customFontFamily}
            </div>
          </Show>
        </div>

        {/* Brand Vector SVG Logo */}
        <div class="space-y-1.5 pt-2 border-t border-border/50">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <Shield class="w-3 h-3 text-cyan-400" />
              <span>Stamped SVG Vector Mark</span>
            </span>
            <Show
              when={state.vectorLogoKey}
              fallback={
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => logoInputRef?.click()}
                  class="text-xs h-7 px-2.5"
                >
                  <Upload class="w-2.5 h-2.5 mr-1" />
                  Upload SVG
                </Button>
              }
            >
              <Button
                variant="destructive"
                size="xs"
                onClick={handleClearLogo}
                class="text-xs h-7 px-2.5"
              >
                <Trash2 class="w-2.5 h-2.5 mr-1" />
                Remove
              </Button>
            </Show>
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept=".svg,image/svg+xml"
            onChange={handleLogoUpload}
            class="hidden"
          />

          <Show when={state.vectorLogoKey}>
            <div class="grid grid-cols-3 gap-2 pt-1">
              <div>
                <label class="text-xs font-mono text-muted-foreground block mb-0.5">
                  Anchor
                </label>
                <select
                  value={state.vectorLogoAnchor ?? 'top-left'}
                  onChange={(e) =>
                    patchState({
                      vectorLogoAnchor: e.currentTarget.value as any,
                    })
                  }
                  class="w-full bg-card border border-border rounded px-1.5 py-1 text-xs font-mono text-foreground"
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="hero-plinth">Hero Plinth</option>
                  <option value="stage-center">Stage Center</option>
                </select>
              </div>

              <div>
                <label class="text-xs font-mono text-muted-foreground block mb-0.5">
                  Tint Mode
                </label>
                <select
                  value={state.vectorLogoColor ?? 'accent'}
                  onChange={(e) =>
                    patchState({
                      vectorLogoColor: e.currentTarget.value as any,
                    })
                  }
                  class="w-full bg-card border border-border rounded px-1.5 py-1 text-xs font-mono text-foreground"
                >
                  <option value="accent">Accent Tint</option>
                  <option value="ink">Ink Tint</option>
                  <option value="original">Original SVG</option>
                </select>
              </div>

              <div>
                <div class="flex justify-between text-xs font-mono mb-0.5">
                  <span class="text-muted-foreground">Scale</span>
                  <span class="text-foreground">
                    {Math.round((state.vectorLogoScale ?? 1.0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  value={state.vectorLogoScale ?? 1.0}
                  onInput={(e) =>
                    patchState({ vectorLogoScale: Number(e.currentTarget.value) })
                  }
                  class="w-full accent-primary cursor-pointer mt-1"
                />
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* 10. REFRACTIVE ACRYLIC CAUSTIC SHADER RIG */}
      <div class="p-2.5 rounded border border-border bg-card/40 space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <Cpu class="w-3.5 h-3.5 text-cyan-400" />
            <span class="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
              10. Refractive Acrylic Caustic Shader
            </span>
            <Show when={state.isStoryboardMode}>
              <Badge variant="primary" class="text-[9px] py-0 px-1 font-bold">SCENE SPECIFIC</Badge>
            </Show>
          </div>
          <span class="text-xs font-mono text-cyan-400 font-semibold">
            {state.webGpuEnabled ? 'ACTIVE RIG' : 'INACTIVE'}
          </span>
        </div>

        {/* 1-Click 3D WebGPU Rig Preset Button */}
        <Button
          variant="outline"
          size="xs"
          onClick={() => {
            patchState({
              webGpuEnabled: true,
              heroId: 'chrome-torus-pod',
              heroMotion: 'gyro',
              shaderId: 'neon-caustics',
              chromaticAberration: 0.45,
              shaderTurbulence: 0.8,
            });
            triggerToast('⚡ Activated 3D WebGPU Mesh Rig (Chrome Torus + Refractive Shader)');
          }}
          class="w-full gap-1.5 text-xs font-mono font-semibold text-cyan-400 hover:text-cyan-300 border-cyan-500/30 hover:border-cyan-500/60"
        >
          <Zap class="w-3.5 h-3.5" />
          <span>Launch 3D WebGPU Rig Preset</span>
        </Button>

        <SwitchRow
          label="Refractive Acrylic Caustic Shader"
          sublabel="Snell's law refraction, chromatic dispersion & simplex turbulence"
          checked={state.webGpuEnabled ?? false}
          onChange={(v) => patchState({ webGpuEnabled: v })}
        />
        <Show when={state.webGpuEnabled}>
          <div class="grid grid-cols-2 gap-2 pt-1">
            <div>
              <div class="flex justify-between text-xs font-mono mb-0.5">
                <span class="text-muted-foreground">Dispersion</span>
                <span class="text-foreground">
                  {Math.round((state.chromaticAberration ?? 0.25) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1.0}
                step={0.05}
                value={state.chromaticAberration ?? 0.25}
                onInput={(e) =>
                  patchState({ chromaticAberration: Number(e.currentTarget.value) })
                }
                class="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
            <div>
              <div class="flex justify-between text-xs font-mono mb-0.5">
                <span class="text-muted-foreground">Turbulence</span>
                <span class="text-foreground">
                  {Math.round((state.shaderTurbulence ?? 0.5) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={2.0}
                step={0.1}
                value={state.shaderTurbulence ?? 0.5}
                onInput={(e) =>
                  patchState({ shaderTurbulence: Number(e.currentTarget.value) })
                }
                class="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};
