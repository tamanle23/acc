import { createSignal, createMemo, Show, For, Component } from 'solid-js';
import { Box, Upload, CheckCircle2, AlertCircle, FileCode } from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { HERO_CATALOG } from '@/constants/heroes';
import { cn } from '@/lib/utils';

export interface LottieHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_RIGS: { name: string; description: string; json: string }[] = [
  {
    name: 'Cyber Hexagram',
    description: 'Kinetic sacred geometry with alternating rotation and node pulses',
    json: JSON.stringify(
      {
        v: '5.7.4',
        fr: 60,
        ip: 0,
        op: 120,
        w: 500,
        h: 500,
        nm: 'Cyber Hexagram Rig',
        layers: [
          { nm: 'Outer Ring', ty: 4, ks: { r: { k: 360 } } },
          { nm: 'Inner Hexagram', ty: 4, ks: { r: { k: -360 } } },
          { nm: 'Plasma Nodes', ty: 4, ks: { s: { k: [120, 120] } } },
        ],
      },
      null,
      2
    ),
  },
  {
    name: 'Kinetic Equalizer',
    description: 'Bodymovin 16-band spectrum vector mesh with harmonic wave decay',
    json: JSON.stringify(
      {
        v: '5.8.0',
        fr: 60,
        ip: 0,
        op: 180,
        w: 600,
        h: 400,
        nm: 'Kinetic EQ Rig',
        layers: Array.from({ length: 9 }, (_, i) => ({
          nm: `Band_${i + 1}`,
          ty: 4,
          ks: { p: { k: [i * 50 - 200, 0] } },
        })),
      },
      null,
      2
    ),
  },
  {
    name: 'Planetary Gimbal',
    description: '3-axis concentric gyroscope rings with orbital markers',
    json: JSON.stringify(
      {
        v: '5.7.4',
        fr: 60,
        ip: 0,
        op: 240,
        w: 500,
        h: 500,
        nm: 'Planetary Gimbal Rig',
        layers: [
          { nm: 'Pitch Ring', ty: 4, ks: { rx: { k: 360 } } },
          { nm: 'Yaw Ring', ty: 4, ks: { ry: { k: 360 } } },
          { nm: 'Roll Ring', ty: 4, ks: { rz: { k: 360 } } },
        ],
      },
      null,
      2
    ),
  },
  {
    name: 'Chrono Spiral',
    description: 'Fibonacci logarithmic spiral vector path with strobe ticks',
    json: JSON.stringify(
      {
        v: '5.9.1',
        fr: 60,
        ip: 0,
        op: 300,
        w: 500,
        h: 500,
        nm: 'Chrono Spiral Rig',
        layers: [
          { nm: 'Golden Curve', ty: 4, ks: { r: { k: 720 } } },
          { nm: 'Strobe Ticks', ty: 4, ks: { o: { k: 80 } } },
        ],
      },
      null,
      2
    ),
  },
];

export const LottieHubModal: Component<LottieHubModalProps> = (props) => {
  const fileInputId = 'lottie-file-upload-input';
  const { state, patchState, triggerToast } = useStudio();
  const [lottieDraft, setLottieDraft] = createSignal<string>(
    state.customLottieJson ?? PRESET_RIGS[0]!.json
  );

  const isValidJson = createMemo(() => {
    try {
      JSON.parse(lottieDraft());
      return true;
    } catch {
      return false;
    }
  });

  const handleFileUpload = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        try {
          JSON.parse(content);
          setLottieDraft(content);
          triggerToast(`Loaded Lottie file: ${file.name}`);
        } catch {
          triggerToast('Error: Selected file is not valid JSON');
        }
      }
    };
    reader.readAsText(file);
    target.value = '';
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      maxWidthClass="max-w-2xl"
      title={
        <div class="flex items-center gap-2">
          <Box class="w-4 h-4 text-primary" />
          <h3 class="text-sm font-mono font-bold text-foreground">
            BODYMOVIN / LOTTIE VECTOR HUB
          </h3>
        </div>
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={props.onClose}>
            Close
          </Button>
          <Button
            variant="accent"
            size="sm"
            disabled={!isValidJson()}
            onClick={() => {
              try {
                JSON.parse(lottieDraft());
                patchState({
                  customLottieJson: lottieDraft(),
                  heroId: 'lottie-hologram',
                });
                props.onClose();
                triggerToast('Mounted Custom Lottie Vector Rig (1:1 Frame Sync)');
              } catch {
                triggerToast('Invalid Lottie JSON Syntax');
              }
            }}
          >
            Mount Lottie Rig
          </Button>
        </>
      }
    >
      <div class="space-y-4">
        {/* Preset Hero Rigs */}
        <div>
          <span class="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold block mb-1.5">
            Active Hero Rig Selection
          </span>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <For each={HERO_CATALOG.filter((h) => h.isLottie)}>
              {(l) => {
                const isActive = () => state.heroId === l.id;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      patchState({ heroId: l.id });
                      triggerToast(`Activated ${l.name}`);
                    }}
                    class={cn(
                      'p-2 rounded border text-left font-mono text-xs cursor-pointer transition-colors',
                      isActive()
                        ? 'bg-primary/15 border-primary text-primary font-bold'
                        : 'bg-card border-border text-muted-foreground hover:border-border hover:text-foreground'
                    )}
                  >
                    {l.name}
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        {/* Preset Vector Blueprints */}
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
              Bodymovin Vector Rig Presets
            </span>
            <label
              for={fileInputId}
              class="flex items-center gap-1 text-xs font-mono font-medium text-primary hover:underline cursor-pointer"
            >
              <Upload class="w-3 h-3" />
              Upload .json
              <input
                id={fileInputId}
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                class="hidden"
              />
            </label>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <For each={PRESET_RIGS}>
              {(rig) => (
                <button
                  type="button"
                  onClick={() => {
                    setLottieDraft(rig.json);
                    triggerToast(`Loaded preset rig: ${rig.name}`);
                  }}
                  class="p-2 rounded bg-card border border-border hover:border-primary/50 text-left transition-colors cursor-pointer group"
                >
                  <div class="flex items-center gap-1.5 text-foreground group-hover:text-primary font-mono text-xs font-bold">
                    <FileCode class="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                    {rig.name}
                  </div>
                  <p class="text-[11px] font-mono text-muted-foreground mt-0.5 line-clamp-1">
                    {rig.description}
                  </p>
                </button>
              )}
            </For>
          </div>
        </div>

        {/* JSON Editor */}
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-mono text-muted-foreground font-medium">
              Raw Bodymovin / Lottie JSON Payload
            </label>
            <div class="flex items-center gap-1 text-[11px] font-mono">
              <Show
                when={isValidJson()}
                fallback={
                  <span class="text-red-400 flex items-center gap-1">
                    <AlertCircle class="w-3 h-3" /> Invalid JSON Syntax
                  </span>
                }
              >
                <span class="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 class="w-3 h-3" /> Valid JSON
                </span>
              </Show>
            </div>
          </div>
          <textarea
            rows={7}
            value={lottieDraft()}
            onInput={(e) => setLottieDraft(e.currentTarget.value)}
            class="w-full rounded bg-card border border-border p-2.5 text-[11px] font-mono text-foreground focus:border-primary focus:outline-none"
            placeholder="Paste your exported Bodymovin / Lottie JSON here..."
          />
        </div>
      </div>
    </Modal>
  );
};
