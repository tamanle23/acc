import React, { useState, useEffect } from 'react';
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
import {
  AlertTriangle,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import type { TaskDlqRecordDto } from '@acc/client';
import { announceToScreenReader } from '@/hooks/use-aria-announce';
import { VisualJsonEditor } from '@/components/ui/json-editor';

interface DlqInspectorSheetProps {
  record: TaskDlqRecordDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplay: (record: TaskDlqRecordDto, payloadOverrides?: Record<string, unknown>) => void;
  onDiscard: (record: TaskDlqRecordDto) => void;
  isReplaying?: boolean;
}

export function DlqInspectorSheet({
  record,
  open,
  onOpenChange,
  onReplay,
  onDiscard,
  isReplaying = false,
}: DlqInspectorSheetProps) {
  const [copied, setCopied] = useState(false);
  const [overridePayload, setOverridePayload] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (record?.payloadSnapshot && typeof record.payloadSnapshot === 'object') {
      setOverridePayload(record.payloadSnapshot as Record<string, unknown>);
    } else {
      setOverridePayload({});
    }
  }, [record]);

  if (!record) return null;

  const handleCopyStackTrace = () => {
    if (record.errorStacktrace || record.errorMessage) {
      navigator.clipboard.writeText(record.errorStacktrace || record.errorMessage || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTriggerReplay = () => {
    const hasOverrides = Object.keys(overridePayload).length > 0;
    onReplay(record, hasOverrides ? overridePayload : undefined);
    announceToScreenReader(`Task ${record.taskId} submitted for DLQ replay`);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-xl overflow-y-auto flex flex-col gap-5 p-6"
      >
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
              <span className="text-muted-foreground block text-[11px]">Workflow Execution ID</span>
              <Link
                to={'/workflow-executions' as any}
                onClick={() => onOpenChange(false)}
                className="font-mono font-medium text-primary hover:underline inline-flex items-center gap-1"
                title={`Open workflow execution ${record.workflowId}`}
              >
                <span>{record.workflowId}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
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

          {/* Payload Snapshot (Read-Only VisualJsonEditor) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Execution Payload Snapshot</Label>
            <VisualJsonEditor
              value={record.payloadSnapshot ?? {}}
              onChange={() => { }}
              readOnly
              defaultMode="tree"
              height="200px"
            />
          </div>

          {/* Payload Overrides (for Replay via VisualJsonEditor) */}
          {record.status === 'ISOLATED' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  <span>Replay Payload Overrides (Interactive JSON Editor)</span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] text-primary hover:underline"
                  onClick={() => {
                    if (record.payloadSnapshot && typeof record.payloadSnapshot === 'object') {
                      setOverridePayload(
                        JSON.parse(JSON.stringify(record.payloadSnapshot)) as Record<string, unknown>
                      );
                    }
                  }}
                >
                  Reset to Snapshot
                </Button>
              </div>
              <VisualJsonEditor
                value={overridePayload}
                onChange={(val) => {
                  if (val && typeof val === 'object' && !Array.isArray(val)) {
                    setOverridePayload(val as Record<string, unknown>);
                  }
                }}
                defaultMode="tree"
                height="240px"
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
                disabled={isReplaying}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-sm min-w-[110px]"
                onClick={handleTriggerReplay}
              >
                {isReplaying ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                )}
                <span>{isReplaying ? 'Replaying...' : 'Replay Task'}</span>
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
