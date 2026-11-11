import {
  type Component,
  createSignal,
  createMemo,
  For,
  Show,
} from 'solid-js';
import {
  X,
  Check,
  Sparkles,
  ArrowRightLeft,
  Clock,
  Compass,
  Zap,
  RotateCw,
  Eye,
  Film,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-solid';
import { Popover } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import type {
  StoryboardScene,
  SceneTransition,
  TransitionType,
  TransitionDirection,
} from '@/types/storyboard';
import type { EasingId } from '@/types/motion';
import { cn } from '@/lib/utils';

export interface TransitionMetadata {
  id: TransitionType;
  name: string;
  category: '3d' | 'optical' | 'kinetic';
  description: string;
  badge: string;
  icon: typeof Sparkles;
  supportsDirection?: boolean;
}

export const TRANSITION_CATALOG: readonly TransitionMetadata[] = [
  // 3D Spatial Transitions
  {
    id: 'spin-orbit-dissolve',
    name: 'Spin Orbit Dissolve',
    category: '3d',
    description: '3D spatial rotation blending into incoming scene with focal depth scale.',
    badge: '3D SPATIAL',
    icon: RotateCw,
  },
  {
    id: 'dolly-punch-through',
    name: 'Dolly Punch Through',
    category: '3d',
    description: 'Dramatic camera push rushing into the screen and punching through to next scene.',
    badge: '3D CAMERA',
    icon: Sparkles,
  },
  {
    id: 'cross-zoom',
    name: 'Cross Zoom',
    category: '3d',
    description: 'Kinetic zoom surge expanding outward into the incoming composition.',
    badge: 'SURGE',
    icon: Zap,
  },
  // Optical Dissolves
  {
    id: 'cross-dissolve',
    name: 'Cross Dissolve',
    category: 'optical',
    description: 'Smooth alpha crossfade blending preceding and incoming frames.',
    badge: 'CLASSIC',
    icon: Eye,
  },
  {
    id: 'cut',
    name: 'Hard Cut',
    category: 'optical',
    description: 'Instant zero-latency scene jump at the exact frame boundary.',
    badge: 'DIRECT',
    icon: Film,
  },
  // Kinetic & Directional
  {
    id: 'whip-pan',
    name: 'Whip Pan',
    category: 'kinetic',
    description: 'High-speed camera swipe with dynamic directional velocity blur.',
    badge: 'KINETIC',
    icon: ArrowRightLeft,
    supportsDirection: true,
  },
  {
    id: 'matte-wipe',
    name: 'Matte Wipe',
    category: 'kinetic',
    description: 'Linear geometric wipe curtain smoothly sweeping across the canvas.',
    badge: 'WIPE',
    icon: ArrowRight,
    supportsDirection: true,
  },
  {
    id: 'glitch-dissolve',
    name: 'Glitch Dissolve',
    category: 'kinetic',
    description: 'Digital cyber scanline displacement and chromatic aberration breakdown.',
    badge: 'CYBER',
    icon: Zap,
  },
];

export interface TransitionPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: HTMLElement | null;
  scene: StoryboardScene;
  actIndex: number;
  isLast: boolean;
  onUpdateTransition: (transition: SceneTransition) => void;
}

const DURATION_PRESETS: readonly number[] = [0.3, 0.5, 0.8, 1.2, 1.8];

const EASING_OPTIONS: readonly { id: EasingId; label: string }[] = [
  { id: 'expo-out', label: 'Expo Out (Snappy)' },
  { id: 'spring-luxury', label: 'Spring (Luxury)' },
  { id: 'velvet-cubic', label: 'Velvet (Smooth)' },
  { id: 'linear-sine', label: 'Linear Sine' },
  { id: 'elastic-whip', label: 'Elastic Whip' },
];

export const TransitionPickerPopover: Component<TransitionPickerPopoverProps> = (props) => {
  const currentTransition = () =>
    props.scene.transitionOut ?? {
      type: 'cross-dissolve',
      durationSec: 0.8,
      easing: 'expo-out' as EasingId,
      direction: 'right' as TransitionDirection,
    };

  const currentType = () => currentTransition().type;
  const currentDuration = () => currentTransition().durationSec ?? 0.8;
  const currentEasing = () => currentTransition().easing ?? 'expo-out';
  const currentDirection = () => currentTransition().direction ?? 'right';

  const [activeTab, setActiveTab] = createSignal<'all' | '3d' | 'optical' | 'kinetic'>('all');

  const filteredTransitions = createMemo(() => {
    const tab = activeTab();
    if (tab === 'all') return TRANSITION_CATALOG;
    return TRANSITION_CATALOG.filter((t) => t.category === tab);
  });

  const activeMeta = createMemo(
    () => TRANSITION_CATALOG.find((t) => t.id === currentType()) ?? TRANSITION_CATALOG[0]
  );

  const setType = (type: TransitionType) => {
    props.onUpdateTransition({
      type,
      durationSec: currentDuration(),
      easing: currentEasing(),
      direction: currentDirection(),
    });
  };

  const setDuration = (sec: number) => {
    const clamped = Math.max(0.1, Math.min(3.0, Math.round(sec * 100) / 100));
    props.onUpdateTransition({
      type: currentType(),
      durationSec: clamped,
      easing: currentEasing(),
      direction: currentDirection(),
    });
  };

  const setEasing = (easing: EasingId) => {
    props.onUpdateTransition({
      type: currentType(),
      durationSec: currentDuration(),
      easing,
      direction: currentDirection(),
    });
  };

  const setDirection = (direction: TransitionDirection) => {
    props.onUpdateTransition({
      type: currentType(),
      durationSec: currentDuration(),
      easing: currentEasing(),
      direction,
    });
  };

  return (
    <Popover
      isOpen={props.isOpen}
      onClose={props.onClose}
      anchorRef={props.anchorRef}
      placement="top"
      offset={10}
      padding={12}
      class="w-96 max-w-[92vw] shadow-2xl border-border/80 bg-popover/95 backdrop-blur-xl"
      ariaLabel={props.isLast ? 'Loop to Act 01 Transition' : 'Scene Transition Settings'}
    >
      {/* Header Bar */}
      <div class="p-3 border-b border-border/80 flex items-center justify-between gap-2 bg-muted/40 shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-6 h-6 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <ArrowRightLeft class="w-3.5 h-3.5" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-mono font-bold tracking-wider text-foreground uppercase truncate">
                {props.isLast ? 'Loop to Act 01' : `Act 0${props.actIndex + 1} ➔ Act 0${props.actIndex + 2}`}
              </span>
              <Badge variant={props.isLast ? 'amber' : 'primary'} class="text-[9px] py-0 px-1.5">
                {props.isLast ? 'LOOP' : 'TRANSITION'}
              </Badge>
            </div>
            <p class="text-[10px] text-muted-foreground font-mono truncate">
              {props.isLast
                ? 'Cyclic optical connector looping back to Scene 1'
                : 'Optical choreographic blend between scenes'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close transition picker"
          class="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent/60 transition-colors shrink-0 cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div class="px-3 pt-2.5 pb-1 flex items-center gap-1 border-b border-border/50 bg-background/50 shrink-0">
        <For
          each={[
            { id: 'all', label: 'All (8)' },
            { id: '3d', label: '3D Spatial (3)' },
            { id: 'optical', label: 'Optical (2)' },
            { id: 'kinetic', label: 'Kinetic (3)' },
          ] as const}
        >
          {(tab) => {
            const active = () => activeTab() === tab.id;
            return (
              <button
                type="button"
                onClick={() => setActiveTab(tab.id)}
                class={cn(
                  'px-2 py-0.5 rounded text-[11px] font-mono transition-all border cursor-pointer shrink-0',
                  active()
                    ? 'bg-primary/15 text-primary border-primary/50 font-bold'
                    : 'bg-muted/30 text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/40'
                )}
              >
                {tab.label}
              </button>
            );
          }}
        </For>
      </div>

      {/* Transition Type Cards (Scrollable List) */}
      <div class="p-2.5 max-h-52 overflow-y-auto flex flex-col gap-1.5 focus:outline-none shrink-0 divide-y divide-border/20">
        <For each={filteredTransitions()}>
          {(item) => {
            const isSelected = () => currentType() === item.id;
            const IconComponent = item.icon;

            return (
              <button
                type="button"
                onClick={() => setType(item.id)}
                class={cn(
                  'p-2 rounded-lg text-left transition-all flex items-start gap-2.5 cursor-pointer border',
                  isSelected()
                    ? 'bg-primary/10 border-primary/60 ring-1 ring-primary/40 text-foreground'
                    : 'bg-card/40 border-border/40 hover:bg-accent/50 hover:border-border text-card-foreground'
                )}
              >
                <div
                  class={cn(
                    'w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5',
                    isSelected() ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  <IconComponent class="w-3.5 h-3.5" />
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-mono font-bold truncate">
                      {item.name}
                    </span>
                    <Badge
                      variant={
                        item.category === '3d'
                          ? 'cyan'
                          : item.category === 'kinetic'
                          ? 'lime'
                          : 'default'
                      }
                      class="text-[9px] py-0 px-1"
                    >
                      {item.badge}
                    </Badge>
                  </div>
                  <p class="text-[10px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                    {item.description}
                  </p>
                </div>

                <Show when={isSelected()}>
                  <div class="text-primary shrink-0 mt-0.5">
                    <Check class="w-4 h-4" />
                  </div>
                </Show>
              </button>
            );
          }}
        </For>
      </div>

      {/* Parameter Controls Deck */}
      <div class="p-3 border-t border-border/80 bg-muted/20 flex flex-col gap-3 shrink-0">
        {/* Duration Control */}
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-mono text-muted-foreground font-semibold flex items-center gap-1">
              <Clock class="w-3 h-3 text-primary" />
              Duration:
            </span>
            <div class="flex items-center gap-1">
              <input
                type="number"
                min="0.1"
                max="3.0"
                step="0.05"
                value={currentDuration()}
                onInput={(e) => setDuration(parseFloat(e.currentTarget.value) || 0.8)}
                class="w-14 text-right bg-background border border-border rounded px-1.5 py-0.5 text-xs font-mono font-bold text-foreground focus:outline-none focus:border-primary"
              />
              <span class="text-[10px] font-mono text-muted-foreground">sec</span>
            </div>
          </div>

          {/* Slider */}
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.05"
            value={currentDuration()}
            onInput={(e) => setDuration(parseFloat(e.currentTarget.value))}
            class="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />

          {/* Quick Presets */}
          <div class="flex items-center justify-between gap-1 mt-0.5">
            <For each={DURATION_PRESETS}>
              {(presetSec) => {
                const active = () => Math.abs(currentDuration() - presetSec) < 0.04;
                return (
                  <button
                    type="button"
                    onClick={() => setDuration(presetSec)}
                    class={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-mono transition-all border cursor-pointer',
                      active()
                        ? 'bg-primary text-primary-foreground border-primary font-bold'
                        : 'bg-background/80 text-muted-foreground border-border/60 hover:text-foreground hover:bg-accent/40'
                    )}
                  >
                    {presetSec}s
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        {/* Easing & Direction Row */}
        <div class="grid grid-cols-2 gap-2">
          {/* Easing Selector */}
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-mono text-muted-foreground font-semibold flex items-center gap-1">
              <Zap class="w-2.5 h-2.5 text-primary" />
              Easing Curve
            </span>
            <select
              value={currentEasing()}
              onChange={(e) => setEasing(e.currentTarget.value as EasingId)}
              class="w-full bg-background border border-border rounded px-1.5 py-1 text-[11px] font-mono text-foreground focus:outline-none focus:border-primary cursor-pointer"
            >
              <For each={EASING_OPTIONS}>
                {(option) => <option value={option.id}>{option.label}</option>}
              </For>
            </select>
          </div>

          {/* Direction Selector (Only if supported) */}
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-mono text-muted-foreground font-semibold flex items-center gap-1">
              <Compass class="w-2.5 h-2.5 text-primary" />
              Direction
            </span>
            <Show
              when={activeMeta().supportsDirection}
              fallback={
                <div class="text-[10px] font-mono text-muted-foreground/60 py-1 italic">
                  Omni-directional
                </div>
              }
            >
              <div class="flex items-center gap-1">
                <For
                  each={[
                    { id: 'left', icon: ArrowLeft, label: 'L' },
                    { id: 'right', icon: ArrowRight, label: 'R' },
                    { id: 'up', icon: ArrowUp, label: 'U' },
                    { id: 'down', icon: ArrowDown, label: 'D' },
                  ] as const}
                >
                  {(dir) => {
                    const active = () => currentDirection() === dir.id;
                    const DirIcon = dir.icon;
                    return (
                      <button
                        type="button"
                        onClick={() => setDirection(dir.id)}
                        title={`Direction: ${dir.id}`}
                        class={cn(
                          'flex-1 p-1 rounded flex items-center justify-center border cursor-pointer transition-all',
                          active()
                            ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                            : 'bg-background text-muted-foreground border-border hover:text-foreground hover:bg-accent/40'
                        )}
                      >
                        <DirIcon class="w-3 h-3" />
                      </button>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Popover>
  );
};
