import { Component } from 'solid-js';
import { Palette } from 'lucide-solid';
import { Modal } from '@/components/ui/modal';
import { ThemeManagerDeck } from '@/components/inspector/theme-manager-deck';

export interface ThemeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeManagerModal: Component<ThemeManagerModalProps> = (props) => {
  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      maxWidthClass="max-w-4xl"
      title={
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
            <Palette class="w-4 h-4" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm uppercase tracking-wide font-bold text-foreground">
                Studio UI Theme & Appearance
              </span>
              <span class="text-xs font-mono px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/20 font-medium">
                Tailwind CSS
              </span>
            </div>
            <p class="text-xs font-mono text-muted-foreground">
              Configure IDE Chrome & Studio UI shell • Decoupled from canvas poster rendering
            </p>
          </div>
        </div>
      }
    >
      <div class="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
        <ThemeManagerDeck inModal />
      </div>
    </Modal>
  );
};
