import { Component, For, Show } from 'solid-js';
import { Zap } from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface PayloadTabProps {
  onOpenMediaVault?: () => void;
}

export const PayloadTab: Component<PayloadTabProps> = () => {
  const { state, patchState, handleRandomizeEvent } = useStudio();

  return (
    <div class="space-y-3.5 w-full min-w-0">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <label class="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
            Content Payload Contract
          </label>
          <Show when={state.isStoryboardMode}>
            <Badge variant="primary" class="text-[9px] py-0 px-1 font-bold">SCENE SPECIFIC</Badge>
          </Show>
        </div>
        <Button
          variant="primary"
          size="xs"
          onClick={handleRandomizeEvent}
        >
          <Zap class="w-3 h-3" />
          ⚡ Randomize Event
        </Button>
      </div>

      <For each={[0, 1, 2]}>
        {(idx) => (
          <div>
            <span class="text-xs font-mono text-muted-foreground font-medium">
              Headline Line 0{idx + 1}
            </span>
            <input
              type="text"
              value={state.content.headline[idx]}
              onInput={(e) => {
                const next: [string, string, string] = [
                  ...state.content.headline,
                ] as [string, string, string];
                next[idx] = e.currentTarget.value.toUpperCase();
                patchState({
                  content: { ...state.content, headline: next },
                });
              }}
              class="w-full mt-0.5 bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
            />
          </div>
        )}
      </For>

      <div>
        <span class="text-xs font-mono text-muted-foreground font-medium">
          Subhead Descriptor
        </span>
        <input
          type="text"
          value={state.content.subhead}
          onInput={(e) =>
            patchState({
              content: { ...state.content, subhead: e.currentTarget.value },
            })
          }
          class="w-full mt-0.5 bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <span class="text-xs font-mono text-muted-foreground font-medium">Event Date</span>
          <input
            type="text"
            value={state.content.date}
            onInput={(e) =>
              patchState({
                content: { ...state.content, date: e.currentTarget.value },
              })
            }
            class="w-full mt-0.5 bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <span class="text-xs font-mono text-muted-foreground font-medium">CTA Badge</span>
          <input
            type="text"
            value={state.content.tag}
            onInput={(e) =>
              patchState({
                content: { ...state.content, tag: e.currentTarget.value },
              })
            }
            class="w-full mt-0.5 bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div>
        <span class="text-xs font-mono text-muted-foreground font-medium">
          Venue / Location Lockup
        </span>
        <input
          type="text"
          value={state.content.location}
          onInput={(e) =>
            patchState({
              content: { ...state.content, location: e.currentTarget.value },
            })
          }
          class="w-full mt-0.5 bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <span class="text-xs font-mono text-muted-foreground font-medium">
          Sponsor / Billing Block
        </span>
        <input
          type="text"
          value={state.content.sponsor}
          onInput={(e) =>
            patchState({
              content: { ...state.content, sponsor: e.currentTarget.value },
            })
          }
          class="w-full mt-0.5 bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
};
