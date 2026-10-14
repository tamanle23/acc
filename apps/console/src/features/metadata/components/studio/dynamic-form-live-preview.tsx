import React, { useState } from 'react';
import type { AttributeDefinition } from '../../api/types';
import { DynamicFieldRenderer } from '../dynamic-fields/dynamic-field-renderer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  entityTypeName: string;
  attributes: AttributeDefinition[];
}

export const DynamicFormLivePreview: React.FC<Props> = ({
  entityTypeName,
  attributes,
}) => {
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [submittedData, setSubmittedData] = useState<Record<string, unknown> | null>(null);

  const handleFieldChange = (systemName: string, val: unknown) => {
    setFormValues((prev) => ({
      ...prev,
      [systemName]: val,
    }));
  };

  const handleReset = () => {
    setFormValues({});
    setSubmittedData(null);
  };

  const handleSimulatedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedData({ ...formValues });
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/40 bg-white/30 dark:bg-slate-800/30">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-emerald-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Interactive Form Preview
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
            Live {entityTypeName}
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleReset}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            title="Reset Preview Values"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4 max-h-[600px]">
        {attributes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mb-2 opacity-30 text-emerald-500" />
            <p className="text-xs font-semibold text-foreground">No Form Inputs</p>
            <p className="text-[11px] max-w-xs mt-1 text-muted-foreground">
              Drop attributes from the palette into the canvas to preview the real dynamic input controls.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSimulatedSubmit} className="space-y-4">
            {attributes.map((attr) => (
              <div
                key={attr.id || attr.systemName}
                className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-white/20 dark:border-white/5 transition-all"
              >
                <DynamicFieldRenderer
                  attribute={attr}
                  value={formValues[attr.systemName] ?? attr.defaultValue ?? ''}
                  onChange={(val) => handleFieldChange(attr.systemName, val)}
                  error={undefined}
                />
              </div>
            ))}

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Validate & Simulate Submit</span>
              </Button>
            </div>
          </form>
        )}

        {submittedData && (
          <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] overflow-x-auto shadow-inner">
            <div className="text-[10px] text-muted-foreground uppercase font-sans mb-1 flex items-center gap-1 font-bold">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Form Output Record Payload:
            </div>
            <pre>{JSON.stringify(submittedData, null, 2)}</pre>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
