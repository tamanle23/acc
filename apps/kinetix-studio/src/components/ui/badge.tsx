import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium uppercase tracking-wider border rounded select-none',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground border-border',
        primary: 'bg-primary/15 text-primary border-primary/40',
        secondary: 'bg-secondary text-secondary-foreground border-border',
        outline: 'bg-transparent text-foreground border-border',
        lime: 'bg-lime-500/15 text-lime-700 dark:text-lime-400 border-lime-500/30',
        cyan: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
        amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
        rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends JSX.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  class?: string;
  className?: string;
}

export const Badge: Component<BadgeProps> = (props) => {
  const [local, rest] = splitProps(props, ['variant', 'class', 'className', 'children']);
  return (
    <span class={cn(badgeVariants({ variant: local.variant, className: local.class || local.className }))} {...rest}>
      {local.children}
    </span>
  );
};
