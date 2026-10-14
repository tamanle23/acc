import React, { useState } from 'react';
import type { EntityRecord } from '../../api/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Copy, Code } from 'lucide-react';

interface Props {
  record: EntityRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RawJsonDialog: React.FC<Props> = ({ record, open, onOpenChange }) => {
  const [copied, setCopied] = useState(false);

  const jsonString = record ? JSON.stringify(record, null, 2) : '{}';

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden p-6 rounded-3xl">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              <DialogTitle className="text-xl font-bold">
                Raw Record JSON (#{record?.id})
              </DialogTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5 text-xs bg-white/40 dark:bg-white/5"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy JSON
                </>
              )}
            </Button>
          </div>
          <DialogDescription>
            Underlying document structure including entityTypeId, tenantId, and dynamic attribute properties.
          </DialogDescription>
        </DialogHeader>

        <pre className="flex-1 min-h-[300px] overflow-auto p-4 rounded-xl font-mono text-xs bg-slate-950 text-emerald-400 border border-white/10 shadow-inner">
          <code>{jsonString}</code>
        </pre>
      </DialogContent>
    </Dialog>
  );
};
