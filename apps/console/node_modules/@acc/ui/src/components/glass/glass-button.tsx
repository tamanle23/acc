import * as React from "react"
import { cn } from "../../lib/utils"

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "destructive"
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const baseStyles = "relative overflow-hidden inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"

    // Liquid Glass Tokens
    const glassStyles = "backdrop-blur-md border border-white/30 dark:border-white/15"

    const variants = {
      default: "bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/15 text-foreground",
      primary: "bg-primary/80 hover:bg-primary text-primary-foreground border-primary-foreground/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]",
      destructive: "bg-destructive/80 hover:bg-destructive text-destructive-foreground border-destructive-foreground/30"
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, glassStyles, variants[variant], "h-10 px-4 py-2", className)}
        {...props}
      />
    )
  }
)
GlassButton.displayName = "GlassButton"
