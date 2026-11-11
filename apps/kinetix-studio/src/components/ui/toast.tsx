import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { CheckCircle2 } from 'lucide-solid';

export interface ToastProps {
  message: string | null;
}

export const Toast: Component<ToastProps> = (props) => {
  return (
    <Show when={props.message}>
      <div
        role="status"
        aria-live="polite"
        class="fixed bottom-5 right-5 z-50 bg-popover border border-primary/60 text-popover-foreground px-3.5 py-2 rounded-lg shadow-xl flex items-center gap-2 text-xs font-mono animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        <CheckCircle2 class="w-4 h-4 text-primary shrink-0" />
        <span>{props.message}</span>
      </div>
    </Show>
  );
};
