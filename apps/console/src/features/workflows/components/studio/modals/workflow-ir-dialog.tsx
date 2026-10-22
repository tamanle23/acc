import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Code2, Copy, Download, Upload, Check, AlertCircle } from 'lucide-react';
import type { WorkflowIR } from '../utils/workflow-ir-converter';

interface WorkflowIrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'export' | 'import';
  initialJson?: string;
  onImportJson?: (ir: WorkflowIR) => void;
}

export function WorkflowIrDialog({
  open,
  onOpenChange,
  mode,
  initialJson = '',
  onImportJson,
}: WorkflowIrDialogProps) {
  const [jsonText, setJsonText] = useState(initialJson);
  const [copied, setCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  React.useEffect(() => {
    setJsonText(initialJson);
    setParseError(null);
  }, [initialJson, open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-ir-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApplyImport = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        setParseError('Missing required field "tasks" array in Workflow IR');
        return;
      }
      setParseError(null);
      onImportJson?.(parsed);
      onOpenChange(false);
    } catch (e: any) {
      setParseError(`JSON parse syntax error: ${e.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 rounded-2xl backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border border-white/20 dark:border-white/10 shadow-2xl">
        <DialogHeader className="pb-2 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-primary" />
              <DialogTitle className="text-base font-bold">
                {mode === 'export' ? 'Export Canonical Workflow IR' : 'Import Workflow IR Definition'}
              </DialogTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              schema v1
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {mode === 'export'
              ? 'Complete JSON schema representation of the visual DAG studio including layout coordinates and retry policies.'
              : 'Paste canonical JSON IR to recreate the visual DAG canvas with full layout fidelity.'}
          </DialogDescription>
        </DialogHeader>

        {parseError && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        <div className="flex-1 min-h-[300px] flex flex-col">
          <Textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setParseError(null);
            }}
            readOnly={mode === 'export'}
            className="flex-1 font-mono text-xs p-3 rounded-xl bg-slate-950 text-slate-100 border border-white/10 resize-none h-[320px] overflow-auto"
            placeholder={mode === 'import' ? '{\n  "workflowKey": "my-dag",\n  "tasks": [...]\n}' : ''}
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border/40 mt-auto">
          {mode === 'export' ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handleCopy}>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy JSON'}
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handleDownload}>
                <Download className="w-3.5 h-3.5" />
                Download File
              </Button>
            </div>
          ) : (
            <Button size="sm" className="text-xs gap-1.5" onClick={handleApplyImport}>
              <Upload className="w-3.5 h-3.5" />
              Apply to Canvas
            </Button>
          )}

          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
