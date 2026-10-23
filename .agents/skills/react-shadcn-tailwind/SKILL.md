---
name: react-shadcn-tailwind
description: Build modular, accessible client-side interfaces and design components using pure React, shadcn/ui primitives, and Tailwind CSS. Use when crafting reusable UI components, styling with Tailwind utilities and cn(), implementing Radix UI primitives, managing compound component state, or building form controls with cva.
---
# React + shadcn/ui + Tailwind CSS Architecture

A specialized skill for building clean, composable, and accessible user interfaces using pure React, shadcn/ui patterns, Radix UI primitives, and Tailwind CSS.

## When to Use This Skill

- Creating or refactoring client-side React UI components with Tailwind CSS.
- Implementing or customizing shadcn/ui components (Button, Dialog, DropdownMenu, Form, Sheet, Table).
- Setting up variant systems using class-variance-authority (cva) and the cn() utility.
- Building accessible compound components using Radix UI headless primitives.
- Structuring client-side component state, transitions, and accessible form inputs.

---

## 1. Class Merging & Variant System (cva & cn)

Always combine class names using the standard cn helper (clsx + tailwind-merge) to allow consumer overrides without specificity clashes:

```typescript
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

---

## 2. Component Composition & Polymorphism (asChild)

Use the Radix UI Slot pattern so components can swap their underlying DOM element while preserving styles and event listeners:

```typescript
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps } from "class-variance-authority";
import { cn, buttonVariants } from "./button-variants";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
```

---

## 3. Pure React Component Patterns

- Controlled vs. Uncontrolled: Design components with controlled props (value, onChange) while allowing uncontrolled usage via default props (defaultValue).
- Compound Components: Group complex controls (Select, SelectTrigger, SelectContent, SelectItem) sharing state via React Context.
- Hook Encapsulation: Extract UI interactions (e.g., keyboard traps, outside clicks, media queries) into isolated hooks (useMediaQuery, useDebounce).
- Suspense & Shimmer States: Provide matching skeleton components (Skeleton with animate-pulse) mirroring exact component shapes to eliminate Cumulative Layout Shift (CLS).

---

## 4. Tailwind CSS Conventions

- Design Token Usage: Rely on semantic CSS variable mappings (bg-background, text-foreground, border-border, ring-ring) rather than hardcoded hex colors.
- Responsive Layouts: Apply mobile-first breakpoints (sm:, md:, lg:, xl:).
- Interactive State Styling: Cover all states using Tailwind modifiers:
  - Hover: hover:bg-accent
  - Focus: focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none
  - Active: active:scale-[0.98]
  - Disabled: disabled:opacity-50 disabled:pointer-events-none
- Dark Mode Compatibility: Ensure all utility classes adapt seamlessly when the dark class is toggled on root containers.
