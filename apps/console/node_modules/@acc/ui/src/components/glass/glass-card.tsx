import * as React from "react"
import { cn } from "../../lib/utils"

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: "low" | "medium" | "high"
}

export function GlassCard({ className, intensity = "medium", ...props }: GlassCardProps) {
  const intensityClasses = {
    low: "bg-white/40 dark:bg-slate-900/40 backdrop-blur-md",
    medium: "bg-white/65 dark:bg-slate-900/65 backdrop-blur-xl",
    high: "bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl"
  }

  return (
    <div
      className={cn(
        "border border-white/30 dark:border-white/10",
        "shadow-lg shadow-black/5 dark:shadow-black/30",
        "rounded-2xl",
        intensityClasses[intensity],
        className
      )}
      {...props}
    />
  )
}
