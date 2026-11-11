import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 font-mono font-medium rounded-md transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:pointer-events-none cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm font-bold',
        accent: 'bg-accent text-accent-foreground hover:bg-accent/80 border border-border/50 shadow-sm font-bold',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
        outline: 'bg-transparent text-foreground border border-border hover:bg-accent hover:text-accent-foreground',
        ghost: 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent/60',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90 shadow-sm',
      },
      size: {
        xs: 'text-xs px-2.5 py-1 min-h-[26px]',
        sm: 'text-xs px-3 py-1.5 min-h-[30px] font-medium',
        md: 'text-sm px-3.5 py-2 min-h-[36px]',
        lg: 'text-base px-4 py-2.5 min-h-[40px]',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'sm',
    },
  }
);

export interface ButtonProps
  extends JSX.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  class?: string;
  className?: string;
  ref?: HTMLButtonElement | ((el: HTMLButtonElement) => void);
  asChild?: boolean;
}

export const Button: Component<ButtonProps> = (props) => {
  const [local, rest] = splitProps(props, ['variant', 'size', 'class', 'className', 'children', 'ref']);
  return (
    <button
      ref={local.ref}
      type="button"
      class={cn(buttonVariants({ variant: local.variant, size: local.size, className: local.class || local.className }))}
      {...rest}
    >
      {local.children}
    </button>
  );
};
