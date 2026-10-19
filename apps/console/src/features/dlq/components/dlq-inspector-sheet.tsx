import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  Archive,
} from 'lucide-react';
import type { TaskDlqRecordDto } from '@unipost/client';

interface DlqInspectorSheetProps {
  record: TaskDlqRecordDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplay: (record: TaskDlqRecordDto, payloadOverrides?: Record<string, unknown>) => void;
  onDiscard: (record: TaskDlqRecordDto) => void;
}

export function DlqInspectorSheet({
  record,
  open,
  onOpenChange,
  onReplay,
  onDiscard,
}: DlqInspectorSheetProps) {
  const [copied, setCopied] = useState(false);
  const [overrideJson, setOverrideJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  if (!record) return null;

  const handleCopyStackTrace = () => {
    if (record.errorStacktrace || record.errorMessage) {
      navigator.clipboard.writeText(record.errorStacktrace || record.errorMessage || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTriggerReplay = () => {
    let parsedOverrides: Record<string, unknown> | undefined;
    if (overrideJson.trim()) {
      try {
        parsedOverrides = JSON.parse(overrideJson);
      } catch (err: any) {
        setJsonError(`Invalid JSON: ${err.message}`);
        return;
      }
    }
    setJsonError(null);
    onReplay(record, parsedOverrides);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto flex flex-col gap-5 p-6 backdrop-blur-2xl bg-background/95 border-l border-border/40 shadow-2xl">
        <SheetHeader className="text-left space-y-1">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Dead-Letter Queue Inspector
            </SheetTitle>
            <Badge
              variant={
                record.status === 'ISOLATED'
                  ? 'destructive'
                  : record.status === 'REPLAYED'
                  ? 'default'
                  : 'outline'
              }
              className="text-xs"
            >
              {record.status}
            </Badge>
          </div>
          <SheetDescription className="font-mono text-xs text-muted-foreground">
            {record.dlqId} • Task: {record.taskId}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg border border-border/50 bg-muted/20">
            <div>
              <span className="text-muted-foreground block text-[11px]">Workflow ID</span>
              <span className="font-mono font-medium text-foreground">{record.workflowId}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Task Type</span>
              <Badge variant="outline" className="font-mono text-[10px] mt-0.5">
                {record.taskType}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Retries Attempted</span>
              <span className="font-medium text-foreground">{record.retryCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Isolated Time</span>
              <span className="text-muted-foreground">
                {new Date(record.isolatedAtMs).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Failure Details */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-destructive">Error & Stacktrace</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={handleCopyStackTrace}
              >
                {copied ? <Check className="h-3 w-3 mr-1 text-emerald-500" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div
              tabIndex={0}
              role="region"
              aria-label="Error details and stacktrace"
              className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 font-mono text-[11px] text-red-900 dark:text-red-200 overflow-x-auto whitespace-pre-wrap max-h-48 leading-relaxed focus:outline-none focus:ring-1 focus:ring-destructive"
            >
              {record.errorMessage}
              {record.errorStacktrace && (
                <div className="mt-2 pt-2 border-t border-destructive/15 text-[10px] text-red-800 dark:text-red-300">
                  {record.errorStacktrace}
                </div>
              )}
            </div>
          </div>

          {/* Payload Snapshot */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Execution Payload Snapshot</Label>
            <pre className="p-3 rounded-lg border border-border/50 bg-muted/30 font-mono text-[11px] text-foreground/90 overflow-x-auto max-h-44">
              {JSON.stringify(record.payloadSnapshot, null, 2)}
            </pre>
          </div>

          {/* Payload Overrides (for Replay) */}
          {record.status === 'ISOLATED' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Replay Payload Overrides (Optional JSON)</span>
                {jsonError && <span className="text-destructive text-[11px]">{jsonError}</span>}
              </Label>
              <Textarea
                placeholder='e.g. { "timeoutSeconds": 60, "apiKey": "valid-token" }'
                value={overrideJson}
                onChange={(e) => {
                  setOverrideJson(e.target.value);
                  setJsonError(null);
                }}
                className="font-mono text-xs h-24 bg-background/50 border-border/60"
              />
            </div>
          )}
        </div>

        <SheetFooter className="mt-auto pt-4 border-t border-border/30 flex sm:justify-between items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-destructive hover:bg-destructive/10"
            onClick={() => {
              onDiscard(record);
              onOpenChange(false);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Discard Task
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {record.status === 'ISOLATED' && (
              <Button
                size="sm"
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-sm"
                onClick={handleTriggerReplay}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Replay Task
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
