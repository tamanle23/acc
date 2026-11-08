import type { JSX } from 'solid-js';
import { cn } from 'cn';
import { Spinner } from './spinner';

export interface ModalProgressFallbackProps {
  title?: string;
  class?: string;
  className?: string;
}

/**
 * Reusable Liquid Glass modal progressive loading fallback.
 * Displayed inside Suspense boundaries while heavy code-split modals
 * (e.g. IrVisualEditorModal, OpfsExplorerModal, ShortcutsModal) load asynchronously.
 */
export function ModalProgressFallback(props: ModalProgressFallbackProps): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={props.title || 'Loading module...'}
      class={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-150',
        props.class || props.className
      )}
    >
      <div
        class="flex flex-col items-center justify-center gap-3 px-6 py-5 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] shadow-2xl text-slate-800 dark:text-slate-100 min-w-[200px]"
      >
        <Spinner class="size-6 text-sky-500 animate-spin" />
        <span class="text-xs font-medium tracking-wide text-slate-600 dark:text-slate-300 select-none">
          {props.title || 'Loading...'}
        </span>
      </div>
    </div>
  );
}
