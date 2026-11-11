import { Component, For } from 'solid-js';
import { LayoutGrid, RefreshCw } from 'lucide-solid';
import type { AspectRatio } from '@/types/spatial';
import { useStudio } from '@/context/studio-context';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

export interface MatrixTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchCycleActive: boolean;
  onToggleBatchCycle: () => void;
}

export const MatrixTestModal: Component<MatrixTestModalProps> = (props) => {
  const studio = useStudio();

  const formats: Array<{ ratio: AspectRatio; label: string; h: string }> = [
    { ratio: '9:16', label: '9:16 Reels / TikTok (1080×1920)', h: 'h-72 w-42' },
    { ratio: '4:5', label: '4:5 IG Portrait (1080×1350)', h: 'h-64 w-52' },
    { ratio: '1:1', label: '1:1 Square Feed (1080×1080)', h: 'h-56 w-56' },
    { ratio: '16:9', label: '16:9 DOOH Billboard (1920×1080)', h: 'h-40 w-68' },
  ];

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      maxWidthClass="max-w-5xl"
      title={
        <div>
          <h2 class="text-sm font-mono font-bold text-foreground flex items-center gap-2">
            <LayoutGrid class="w-4 h-4 text-primary" />
            MULTI-FORMAT RESPONSIVE MATRIX TEST // 9:16 • 4:5 • 1:1 • 16:9
          </h2>
          <p class="text-xs text-muted-foreground mt-0.5">
            Simultaneously audit spatial skeleton reflow across all 4 commercial aspect ratios or run automated batch cycling.
          </p>
        </div>
      }
      headerActions={
        <Button
          variant={props.batchCycleActive ? 'primary' : 'secondary'}
          size="xs"
          onClick={() => props.onToggleBatchCycle()}
        >
          <RefreshCw
            class={`w-3 h-3 ${props.batchCycleActive ? 'animate-spin' : ''}`}
          />
          {props.batchCycleActive ? 'Stop Auto-Cycle' : 'Start Batch Variant Cycle'}
        </Button>
      }
    >
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
        <For each={formats}>
          {(item) => (
            <div class="flex flex-col items-center p-3 rounded-lg bg-card border border-border">
              <div class="text-xs font-mono font-semibold text-foreground mb-2">
                {item.label}
              </div>
              <div
                style={{
                  "background-color": studio.state.palette.bg,
                  "border-color": studio.state.palette.accent,
                }}
                class={`${item.h} rounded border p-2.5 flex flex-col justify-between relative overflow-hidden shadow-lg`}
              >
                <div class="flex justify-between text-[11px] font-mono font-medium">
                  <span style={{ color: studio.state.palette.ink }}>
                    {studio.state.content.subhead.slice(0, 18)}
                  </span>
                  <span
                    style={{
                      "background-color": studio.state.palette.accent,
                      color: studio.state.palette.bg,
                    }}
                    class="px-1 rounded-xs font-bold"
                  >
                    {item.ratio}
                  </span>
                </div>

                <div
                  class={`flex flex-1 my-1.5 items-center justify-between gap-1.5 ${
                    item.ratio === '16:9'
                      ? 'flex-row'
                      : studio.state.topHeadlineFlow
                      ? 'flex-col'
                      : 'flex-col-reverse'
                  }`}
                >
                  <div class="w-full">
                    <For each={studio.state.content.headline}>
                      {(l, i) => (
                        <div
                          style={{
                            color:
                              i() === 1 ? studio.state.palette.accent : studio.state.palette.ink,
                          }}
                          class="font-black text-xs leading-none tracking-tight font-display"
                        >
                          {l}
                        </div>
                      )}
                    </For>
                  </div>
                  <div
                    style={{
                      "background-color": studio.state.palette.surface,
                      "border-color": studio.state.palette.accent + '66',
                    }}
                    class="w-full flex-1 rounded border flex items-center justify-center min-h-[48px]"
                  >
                    <span
                      style={{ color: studio.state.palette.accent }}
                      class="text-xs font-mono font-bold"
                    >
                      {studio.state.heroId.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div
                  style={{ color: studio.state.palette.ink }}
                  class="text-[11px] font-mono font-medium flex justify-between border-t border-white/10 pt-1"
                >
                  <span>{studio.state.content.date}</span>
                  <span>WCAG {studio.wcagContrast}:1</span>
                </div>
              </div>

              <Button
                variant={studio.state.aspectRatio === item.ratio ? 'primary' : 'secondary'}
                size="xs"
                class="mt-3 w-full"
                onClick={() => {
                  studio.patchState({ aspectRatio: item.ratio });
                  props.onClose();
                  studio.triggerToast(`Switched Active Format to ${item.ratio}`);
                }}
              >
                Activate {item.ratio} Stage
              </Button>
            </div>
          )}
        </For>
      </div>
    </Modal>
  );
};
