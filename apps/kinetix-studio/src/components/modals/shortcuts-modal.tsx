import { Component, For } from 'solid-js';
import { Keyboard } from 'lucide-solid';
import { Modal } from '@/components/ui/modal';

export interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  desc: string;
  category: 'Transport' | 'Timeline & Phases' | 'Spatial & Stage' | 'Audio & System';
}

const SHORTCUTS: ShortcutItem[] = [
  { key: 'Space', desc: 'Toggle Master Playback / Pause', category: 'Transport' },
  { key: 'R', desc: 'Reset to Frame 0', category: 'Transport' },
  { key: 'Shift + R', desc: 'Randomize Content Event Payload', category: 'Transport' },
  { key: '1', desc: 'Phase 1: Hook (0–1.5s)', category: 'Timeline & Phases' },
  { key: '2', desc: 'Phase 2: Inspection (1.5–3.8s)', category: 'Timeline & Phases' },
  { key: '3', desc: 'Phase 3: Climax (3.8–6.2s)', category: 'Timeline & Phases' },
  { key: '4', desc: 'Phase 4: Outro Loop (6.2–8.0s)', category: 'Timeline & Phases' },
  { key: '[', desc: 'Toggle Left Inspector Sidebar', category: 'Spatial & Stage' },
  { key: ']', desc: 'Toggle Right Telemetry Sidebar', category: 'Spatial & Stage' },
  { key: 'Shift + [ / ]', desc: 'Cycle Aspect Ratios (9:16, 4:5, 1:1, 16:9)', category: 'Spatial & Stage' },
  { key: 'M', desc: 'Open Real-World Media Vault (CC0 Assets)', category: 'Audio & System' },
  { key: 'Shift + M', desc: 'Toggle BPM Synthesizer Audio Mute', category: 'Audio & System' },
  { key: 'C', desc: 'Jump to 1. Config & Canvas Presets Hub', category: 'Audio & System' },
  { key: 'T', desc: 'Open Studio UI Theme & Appearance Modal', category: 'Audio & System' },
  { key: 'Shift + T', desc: 'Quick Toggle Studio Mode (Dark / Light)', category: 'Audio & System' },
  { key: 'S', desc: 'Copy Shareable Deep-Link URL', category: 'Audio & System' },
  { key: '?', desc: 'Toggle This Keyboard Shortcuts Dialog', category: 'Audio & System' },
];

export const ShortcutsModal: Component<ShortcutsModalProps> = (props) => {
  const categories: Array<ShortcutItem['category']> = [
    'Transport',
    'Timeline & Phases',
    'Spatial & Stage',
    'Audio & System',
  ];

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      maxWidthClass="max-w-xl"
      title={
        <div class="flex items-center gap-2 text-primary font-bold">
          <Keyboard class="w-4 h-4" />
          <span class="font-mono text-sm uppercase tracking-wide">
            Studio Command Shortcuts
          </span>
        </div>
      }
    >
      <div class="p-4 space-y-4 font-mono text-xs">
        <For each={categories}>
          {(cat) => {
            const items = SHORTCUTS.filter((s) => s.category === cat);
            return (
              <div class="space-y-1.5">
                <div class="text-xs text-muted-foreground uppercase tracking-wider font-bold border-b border-border pb-1">
                  {cat}
                </div>
                <div class="space-y-1">
                  <For each={items}>
                    {(item) => (
                      <div class="flex items-center justify-between py-1 px-2 rounded bg-card hover:bg-muted transition-colors">
                        <span class="text-foreground">{item.desc}</span>
                        <kbd class="px-2 py-0.5 rounded bg-muted text-foreground font-bold border border-border text-xs shadow-xs">
                          {item.key}
                        </kbd>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </Modal>
  );
};
