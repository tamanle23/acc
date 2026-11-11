import type { Component, JSX } from 'solid-js';
import { Show, createEffect, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { X } from 'lucide-solid';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: JSX.Element;
  children: JSX.Element;
  headerActions?: JSX.Element;
  footer?: JSX.Element;
  maxWidthClass?: string;
  class?: string;
  className?: string;
}

export const Modal: Component<ModalProps> = (props) => {
  // Close on Escape key
  createEffect(() => {
    if (!props.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });

  return (
    <Show when={props.isOpen}>
      <Portal mount={typeof document !== 'undefined' ? document.body : undefined}>
        <div
          role="dialog"
          aria-modal="true"
          class="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={props.onClose}
        >
          <div
            class={cn(
              'bg-popover text-popover-foreground border border-border rounded-xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden',
              props.maxWidthClass || 'max-w-4xl',
              props.class || props.className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div class="p-4 border-b border-border flex items-center justify-between gap-3 shrink-0">
              <div class="min-w-0 flex-1">{props.title}</div>
              <div class="flex items-center gap-2 shrink-0">
                {props.headerActions}
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={props.onClose}
                  aria-label="Close dialog"
                >
                  <X class="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Modal Content Body */}
            <div class="flex-1 overflow-y-auto p-4">{props.children}</div>

            {/* Modal Footer */}
            {props.footer && (
              <div class="p-3 border-t border-border bg-muted/40 flex items-center justify-end gap-2 shrink-0">
                {props.footer}
              </div>
            )}
          </div>
        </div>
      </Portal>
    </Show>
  );
};
