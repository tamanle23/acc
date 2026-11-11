import { Component, For, Show } from 'solid-js';
import type { TimelineMode, FpsCadence, EasingId } from '@/types/motion';
import { useStudio } from '@/context/studio-context';
import { Badge } from '@/components/ui/badge';
import { SwitchRow } from '@/components/ui/switch-row';
import { EASING_CATALOG } from '@/constants/easings';
import { KINETIC_TYPE_CATALOG } from '@/constants/kinetic-types';
import { cn } from '@/lib/utils';

export const MotionTab: Component = () => {
  const {
    state,
    patchState,
  } = useStudio();

  return (
    <div class="space-y-4 w-full min-w-0">
      {/* 60 / 30 / 10 MOTION BUDGET RULE INTERACTIVE ALLOCATOR */}
      <div class="p-2.5 rounded-lg bg-card border border-border space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
              Motion Budget (60 / 30 / 10 Rule)
            </span>
            <Show when={state.isStoryboardMode}>
              <Badge variant="primary" class="text-[9px] py-0 px-1 font-bold">SCENE SPECIFIC</Badge>
            </Show>
          </div>
          <button
            type="button"
            onClick={() =>
              patchState({
                primaryFocusZone:
                  state.primaryFocusZone === 'hero' ? 'headline' : 'hero',
              })
            }
            class="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono text-primary font-bold hover:bg-accent cursor-pointer"
          >
            60% Focus: {state.primaryFocusZone.toUpperCase()} ⇄
          </button>
        </div>

        {/* Visual 3-Segment Stacked Bar */}
        <div class="h-2.5 w-full rounded-full overflow-hidden flex bg-background border border-border">
          <div
            style={{ width: `${state.heroBudget}%` }}
            class="bg-lime-500 transition-all"
            title={`Primary Focal (${state.heroBudget}%)`}
          />
          <div
            style={{ width: `${state.ambientBudget}%` }}
            class="bg-cyan-500 transition-all"
            title={`Secondary Ambient (${state.ambientBudget}%)`}
          />
          <div
            style={{ width: `${state.metaBudget}%` }}
            class="bg-amber-500 transition-all"
            title={`Static Metadata (${state.metaBudget}%)`}
          />
        </div>

        <div class="grid grid-cols-3 text-xs font-mono text-muted-foreground">
          <span class="text-lime-700 dark:text-lime-300 font-semibold">
            ● Focal: {state.heroBudget}%
          </span>
          <span class="text-cyan-700 dark:text-cyan-300 font-semibold">
            ● Ambient: {state.ambientBudget}%
          </span>
          <span class="text-amber-700 dark:text-amber-400 font-semibold">
            ● Meta: {state.metaBudget}%
          </span>
        </div>

        <div>
          <div class="flex justify-between text-xs font-mono text-muted-foreground">
            <span>Primary Focal Energy (Hero / Headline)</span>
            <span>{state.heroBudget}%</span>
          </div>
          <input
            type="range"
            min={40}
            max={75}
            value={state.heroBudget}
            onInput={(e) => {
              const nextHero = Number(e.currentTarget.value);
              const rem = Math.max(0, 100 - nextHero);
              const nextAmb = Math.min(rem, Math.round(rem * 0.75));
              patchState({
                heroBudget: nextHero,
                ambientBudget: nextAmb,
                metaBudget: Math.max(0, 100 - nextHero - nextAmb),
              });
            }}
            class="w-full accent-primary cursor-pointer"
          />
        </div>
      </div>

      {/* Temporal Narrative Engine Switcher */}
      <div>
        <label class="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
          Temporal Choreography Mode
        </label>
        <div class="grid grid-cols-3 gap-1">
          <For
            each={[
              { id: 'studio3', label: 'Studio 3-Phase', sub: 'Hook→Hold→Loop' },
              { id: 'narrative4', label: '4-Act Story', sub: '10–15s DOOH' },
              { id: 'continuous', label: 'Oscillator', sub: '2πk Sine' },
            ]}
          >
            {(m) => {
              const isActive = () => state.timelineMode === m.id;
              return (
                <button
                  type="button"
                  onClick={() =>
                    patchState({
                      timelineMode: m.id as TimelineMode,
                      durationSec: m.id === 'narrative4' ? 10 : state.durationSec,
                    })
                  }
                  class={cn(
                    'p-1.5 rounded border text-left cursor-pointer transition-colors',
                    isActive()
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'bg-card border-border text-muted-foreground hover:border-border'
                  )}
                >
                  <div class="text-xs font-mono font-bold">{m.label}</div>
                  <div class="text-[11px] text-muted-foreground">{m.sub}</div>
                </button>
              );
            }}
          </For>
        </div>
      </div>

      <SwitchRow
        label="Hick's Law Progressive Disclosure"
        sublabel="Stages Headline → Hero → Secondary Venue/Date"
        checked={state.hicksLawDisclosure}
        onChange={(v) => patchState({ hicksLawDisclosure: v })}
      />

      {/* Frame Rate Cadence & Master Loop Duration */}
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-xs font-mono text-muted-foreground block mb-1">
            Studio Frame Cadence
          </label>
          <select
            value={state.fps}
            onChange={(e) =>
              patchState({ fps: Number(e.currentTarget.value) as FpsCadence })
            }
            class="w-full bg-card border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground"
          >
            <option value={12}>12 FPS (Stop-Motion)</option>
            <option value={24}>24 FPS (Cinematic)</option>
            <option value={30}>30 FPS (Social UI)</option>
            <option value={60}>60 FPS (Pro Smooth)</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-mono text-muted-foreground block mb-1">
            Master Loop Duration
          </label>
          <select
            value={state.durationSec}
            onChange={(e) =>
              patchState({ durationSec: Number(e.currentTarget.value) })
            }
            class="w-full bg-card border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground"
          >
            <option value={4}>4.0s Micro Loop</option>
            <option value={6}>6.0s Social Feed</option>
            <option value={8}>8.0s Studio Standard</option>
            <option value={10}>10.0s DOOH Narrative</option>
            <option value={12}>12.0s Extended Arc</option>
            <option value={15}>15.0s Festival Billboard</option>
          </select>
        </div>
      </div>

      {/* 12 Physics & Easing Archetypes */}
      <div>
        <label class="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
          12 Physics & Easing Archetypes
        </label>
        <select
          value={state.easingId}
          onChange={(e) =>
            patchState({ easingId: e.currentTarget.value as EasingId })
          }
          class="w-full bg-card border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground"
        >
          <For each={EASING_CATALOG}>
            {(ea) => (
              <option value={ea.id}>
                {ea.name} [{ea.badge}]
              </option>
            )}
          </For>
        </select>
      </div>

      {/* 12 Kinetic Typography Modes */}
      <div>
        <label class="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
          12 Kinetic Typography Modes
        </label>
        <div class="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
          <For each={KINETIC_TYPE_CATALOG}>
            {(kt) => {
              const isActive = () => state.kineticTypeId === kt.id;
              return (
                <button
                  type="button"
                  onClick={() => patchState({ kineticTypeId: kt.id })}
                  class={cn(
                    'p-1.5 rounded border text-left text-xs transition-all cursor-pointer',
                    isActive()
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'bg-card border-border text-muted-foreground hover:border-border'
                  )}
                >
                  {kt.name}
                </button>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
};
