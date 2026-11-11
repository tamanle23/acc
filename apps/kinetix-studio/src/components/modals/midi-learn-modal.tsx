// ============================================================================
// KINETIX STUDIO - INTERACTIVE MIDI LEARN MODAL (ECMA-429)
// Live stage performance controller mapping with automatic knob discovery,
// low-latency CC ingestion (<16ms), and persistent mapping configuration.
// ============================================================================

import { createSignal, For, Show, onMount, onCleanup, type Component } from 'solid-js';
import { useStudio } from '@/context/studio-context';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  WebMidiManager,
  type MidiDeviceInfo,
  type MidiControlChangeEvent,
} from '@/lib/midi-controller';
import { Sliders, Radio, RotateCcw, X, Disc } from 'lucide-solid';

export interface MidiMappingEntry {
  key: string;
  label: string;
  controller: number | null;
  channel: number;
  min: number;
  max: number;
  unit: string;
  description: string;
}

const DEFAULT_MAPPINGS: MidiMappingEntry[] = [
  { key: 'bpm', label: 'Master Tempo (BPM)', controller: 14, channel: 1, min: 60, max: 180, unit: 'BPM', description: 'Sets global choreography and audio BPM' },
  { key: 'synthCutoff', label: 'Synth Filter Cutoff', controller: 74, channel: 1, min: 100, max: 8000, unit: 'Hz', description: 'Modulates 4-voice low-pass ladder filter' },
  { key: 'synthResonance', label: 'Synth Filter Resonance', controller: 71, channel: 1, min: 1, max: 15, unit: 'Q', description: 'Controls audio filter resonance peak' },
  { key: 'synthVolume', label: 'Synth Master Volume', controller: 7, channel: 1, min: 0, max: 1, unit: '%', description: 'Modulates output synth volume level' },
  { key: 'shaderTurbulence', label: 'Shader Turbulence', controller: 1, channel: 1, min: 0, max: 2, unit: 'x', description: 'Controls fluid speed and ambient noise' },
  { key: 'typeEnergy', label: 'Typography Wave Scale', controller: 11, channel: 1, min: 0.5, max: 2.5, unit: 'x', description: 'Modulates kinetic type wave height' },
];

const STORAGE_KEY = 'kinetix_studio_midi_mappings_v1';

export interface MidiLearnModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MidiLearnModal: Component<MidiLearnModalProps> = (props) => {
  const studio = useStudio();
  const [devices, setDevices] = createSignal<readonly MidiDeviceInfo[]>([]);
  const [mappings, setMappings] = createSignal<MidiMappingEntry[]>(DEFAULT_MAPPINGS);
  const [learningKey, setLearningKey] = createSignal<string | null>(null);
  const [lastActivity, setLastActivity] = createSignal<string>('Listening for MIDI signals...');
  const [isSupported, setIsSupported] = createSignal<boolean>(false);

  let midiManager: WebMidiManager | null = null;
  let unsubscribeCc: (() => void) | null = null;
  let unsubscribeState: (() => void) | null = null;

  // Load saved mappings from storage
  const loadSavedMappings = () => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setMappings(parsed);
          }
        }
      }
    } catch {
      // Fall back to defaults
    }
  };

  const saveMappings = (updated: MidiMappingEntry[]) => {
    setMappings(updated);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch {
      // Ignore storage errors
    }
  };

  const handleControlChange = (e: MidiControlChangeEvent) => {
    setLastActivity(`Device "${e.deviceName}": CC #${e.controller} (Ch ${e.channel}) = ${Math.round(e.normalizedValue * 100)}%`);

    const currentLearnKey = learningKey();
    if (currentLearnKey) {
      // Bind this CC to the learning parameter
      const updated = mappings().map((m) => {
        if (m.key === currentLearnKey) {
          return {
            ...m,
            controller: e.controller,
            channel: e.channel,
          };
        }
        return m;
      });
      saveMappings(updated);
      setLearningKey(null);
      studio.triggerToast(`Bound CC #${e.controller} to ${mappings().find((m) => m.key === currentLearnKey)?.label}`);
      return;
    }

    // Apply live parameter modulation
    const matched = mappings().find((m) => m.controller === e.controller && m.channel === e.channel);
    if (!matched) return;

    const scaledValue = matched.min + e.normalizedValue * (matched.max - matched.min);

    if (matched.key === 'bpm') {
      studio.patchState({ bpm: Math.round(scaledValue) });
    } else if (matched.key === 'synthCutoff') {
      studio.patchState({ synthFilterCutoff: Math.round(scaledValue) });
    } else if (matched.key === 'synthResonance') {
      studio.patchState({ synthFilterResonance: Number(scaledValue.toFixed(1)) });
    } else if (matched.key === 'synthVolume') {
      studio.patchState({ synthMasterVolume: Number(scaledValue.toFixed(2)) });
    } else if (matched.key === 'shaderTurbulence') {
      studio.patchState({ shaderTurbulence: Number(scaledValue.toFixed(2)) });
    }
  };

  onMount(async () => {
    loadSavedMappings();
    const supported = WebMidiManager.isSupported();
    setIsSupported(supported);

    if (supported) {
      midiManager = new WebMidiManager();
      const initialized = await midiManager.initialize();
      if (initialized) {
        setDevices(midiManager.getInputs());
        unsubscribeCc = midiManager.onControlChange(handleControlChange);
        unsubscribeState = midiManager.onStateChange((devs) => {
          setDevices(devs);
        });
      }
    }
  });

  onCleanup(() => {
    if (unsubscribeCc) unsubscribeCc();
    if (unsubscribeState) unsubscribeState();
    if (midiManager) midiManager.disconnect();
  });

  const handleStartLearn = (key: string) => {
    if (learningKey() === key) {
      setLearningKey(null);
    } else {
      setLearningKey(key);
      studio.triggerToast('Twist any knob on your MIDI controller to bind');
    }
  };

  const handleUnbind = (key: string) => {
    const updated = mappings().map((m) => (m.key === key ? { ...m, controller: null } : m));
    saveMappings(updated);
    studio.triggerToast('Unbound MIDI parameter');
  };

  const handleResetDefaults = () => {
    saveMappings(DEFAULT_MAPPINGS);
    studio.triggerToast('Reset MIDI mappings to factory defaults');
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="Hardware MIDI Learn & Live Stage Engine"
      maxWidthClass="max-w-2xl"
    >
      <div class="space-y-4 text-xs font-sans text-foreground">
        {/* HARDWARE CONNECTION STATUS */}
        <div class="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border/60">
          <div class="flex items-center gap-2.5">
            <Radio class={`w-4 h-4 ${devices().length > 0 ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
            <div>
              <div class="font-bold font-mono">
                {isSupported()
                  ? devices().length > 0
                    ? `${devices().length} Hardware MIDI Controller(s) Online`
                    : 'Web MIDI Ready (No Hardware Connected)'
                  : 'Web MIDI API Not Supported in this Environment'}
              </div>
              <div class="text-[11px] text-muted-foreground">
                {devices().length > 0
                  ? devices().map((d) => `${d.name} (${d.manufacturer})`).join(', ')
                  : 'Plug in any USB/Bluetooth MIDI controller to begin live stage control.'}
              </div>
            </div>
          </div>

          <Badge variant={devices().length > 0 ? 'lime' : 'secondary'}>
            {devices().length > 0 ? 'STAGE READY' : 'STANDBY'}
          </Badge>
        </div>

        {/* TELEMETRY ACTIVITY LOG STRIP */}
        <div class="px-2.5 py-1.5 bg-background rounded border border-border/50 text-[11px] font-mono flex items-center justify-between text-muted-foreground">
          <span class="flex items-center gap-1.5">
            <Disc class="w-3 h-3 text-cyan-400" />
            {lastActivity()}
          </span>
          <Button size="xs" variant="ghost" onClick={handleResetDefaults} title="Reset to Factory Mappings">
            <RotateCcw class="w-3 h-3 mr-1" /> Reset Defaults
          </Button>
        </div>

        {/* PARAMETER MAPPING TABLE */}
        <div class="border border-border/60 rounded-lg overflow-hidden divide-y divide-border/40">
          <For each={mappings()}>
            {(m) => {
              const isLearning = () => learningKey() === m.key;
              const isMapped = () => m.controller !== null;

              return (
                <div class="flex items-center justify-between p-2.5 hover:bg-muted/20 transition-colors">
                  <div class="space-y-0.5">
                    <div class="font-bold flex items-center gap-2">
                      <span>{m.label}</span>
                      <Show
                        when={isMapped()}
                        fallback={
                          <Badge variant="outline" class="text-[10px]">
                            UNASSIGNED
                          </Badge>
                        }
                      >
                        <Badge variant="lime" class="text-[10px]">
                          CC #{m.controller} (Ch {m.channel})
                        </Badge>
                      </Show>
                    </div>
                    <div class="text-[11px] text-muted-foreground">
                      {m.description} — [{m.min} to {m.max} {m.unit}]
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <Button
                      size="xs"
                      variant={isLearning() ? 'primary' : isMapped() ? 'outline' : 'secondary'}
                      onClick={() => handleStartLearn(m.key)}
                      class={isLearning() ? 'animate-pulse' : ''}
                    >
                      <Sliders class="w-3 h-3 mr-1" />
                      {isLearning() ? 'Listening...' : isMapped() ? 'Re-Learn' : 'Learn'}
                    </Button>

                    <Show when={isMapped()}>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleUnbind(m.key)}
                        title="Unassign Controller"
                        class="text-muted-foreground hover:text-red-400"
                      >
                        <X class="w-3 h-3" />
                      </Button>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>

        {/* FOOTER TIP */}
        <div class="text-[11px] font-mono text-muted-foreground flex items-center justify-between">
          <span>Pro tip: Press [M] in Gallery Presenter mode to toggle this dialog instantly.</span>
          <Button size="sm" variant="primary" onClick={props.onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
