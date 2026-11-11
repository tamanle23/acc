import type { Component } from 'solid-js';
import { cn } from '@/lib/utils';

export interface SwitchRowProps {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  class?: string;
  className?: string;
}

export const SwitchRow: Component<SwitchRowProps> = (props) => {
  return (
    <div
      onClick={() => props.onChange(!props.checked)}
      class={cn(
        'flex items-center justify-between p-2 rounded-md bg-card/70 border border-border hover:border-primary/50 cursor-pointer transition-colors select-none focus-within:ring-1 focus-within:ring-ring',
        props.class || props.className
      )}
    >
      <div class="pr-2">
        <div class="text-xs font-semibold text-foreground">{props.label}</div>
        {props.sublabel && <div class="text-[11px] text-muted-foreground mt-0.5 leading-normal">{props.sublabel}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        aria-label={props.label}
        onClick={(e) => {
          e.stopPropagation();
          props.onChange(!props.checked);
        }}
        class={cn(
          'w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors focus:outline-none cursor-pointer',
          props.checked ? 'bg-primary' : 'bg-muted'
        )}
      >
        <span
          class={cn(
            'bg-background w-3.5 h-3.5 rounded-full shadow transform transition-transform pointer-events-none',
            props.checked ? 'translate-x-3.5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
};
