import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { GraphValidationError } from '../utils/workflow-ir-converter';

export interface DagValidationBannerProps {
  visible: boolean;
  errors: GraphValidationError[];
  onDismiss: () => void;
}

export const DagValidationBanner: React.FC<DagValidationBannerProps> = ({
  visible,
  errors,
  onDismiss,
}) => {
  if (!visible) return null;

  return (
    <div className="absolute top-16 right-4 z-20 max-w-sm p-3 rounded-xl backdrop-blur-xl shadow-2xl border transition-all animate-in fade-in slide-in-from-top-2">
      {errors.length === 0 ? (
        <div className="flex items-center justify-between gap-3 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-semibold">DAG is acyclic & all bindings valid!</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 text-[10px] px-1"
            onClick={onDismiss}
          >
            Dismiss
          </Button>
        </div>
      ) : (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs space-y-1.5">
          <div className="flex items-center justify-between font-bold">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errors.length} DAG Issue(s) Found</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 text-[10px] px-1"
              onClick={onDismiss}
            >
              Dismiss
            </Button>
          </div>
          <ul className="list-disc list-inside text-[11px] space-y-1 max-h-32 overflow-y-auto">
            {errors.map((err, i) => (
              <li key={i} className="truncate">
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
