import React from 'react';
import type { EntityRecord, AttributeDefinition, EntityType } from '../../api/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Database,
  Tag,
  Copy,
  Check,
  Edit2,
  GitFork,
  Code,
  Clock,
  Sparkles,
  Lock,
  History,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRecordAuditLogs, useRestoreRecordVersion } from '../../api/metadata-api';
import { announceToScreenReader } from '@/hooks/use-aria-announce';
import { VisualJsonEditor } from '@/components/ui/json-editor';

interface MasterDetailRowInspectorProps {
  record: EntityRecord | null;
  entityType?: EntityType | null;
  attributes: AttributeDefinition[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (record: EntityRecord) => void;
  onInspectEdges?: (record: EntityRecord) => void;
}

export const MasterDetailRowInspector: React.FC<MasterDetailRowInspectorProps> = ({
  record,
  entityType,
  attributes,
  open,
  onOpenChange,
  onEdit,
  onInspectEdges,
}) => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const entityTypeId = entityType?.id || (record as unknown as { entityType?: { id?: number | string } } | null)?.entityType?.id || null;
  const { data: auditLogs = [], isLoading: auditLogsLoading } = useRecordAuditLogs(entityTypeId, record?.id || null);
  const restoreMutation = useRestoreRecordVersion(entityTypeId || 0);

  if (!record) return null;

  const handleCopy = (key: string, val: unknown) => {
    try {
      const text = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val ?? '');
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success(`Copied ${key} to clipboard`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const recordAttributes = record.attributes || {};

  const handleRevertVersion = async (auditLogId: string | number, version: number) => {
    try {
      await restoreMutation.mutateAsync({
        recordId: record.id,
        auditLogId,
      });
      toast.success(`Successfully reverted record #${record.id} to version ${version}`);
      announceToScreenReader(`Record reverted to version ${version}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to revert record version');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl border-l border-white/20 dark:border-white/10 shadow-2xl"
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Database className="size-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold flex items-center gap-2">
                  <span>Record #{record.id}</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {entityType?.name || 'Entity'}
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="font-mono">{entityType?.systemName}</span>
                  {record.tenantId && <span>• Tenant: {record.tenantId}</span>}
                </SheetDescription>
              </div>
            </div>

            <div className="flex items-center gap-1.5 mr-6">
              {onEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(record);
                  }}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Edit2 className="size-3.5" /> Edit
                </Button>
              )}
              {onInspectEdges && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onInspectEdges(record);
                  }}
                  className="h-8 gap-1.5 text-xs text-primary"
                >
                  <GitFork className="size-3.5" /> Edges
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="attributes" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-3 border-b border-border/40 bg-muted/10">
            <TabsList className="bg-muted/40 p-0.5">
              <TabsTrigger value="attributes" className="text-xs gap-1.5">
                <Tag className="size-3.5" /> Attributes
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs gap-1.5">
                <History className="size-3.5" /> History & CDC
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-xs gap-1.5">
                <Clock className="size-3.5" /> Audit & Provenance
              </TabsTrigger>
              <TabsTrigger value="json" className="text-xs gap-1.5">
                <Code className="size-3.5" /> Raw JSON
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="attributes" className="flex-1 m-0 p-6 min-h-0">
            <ScrollArea className="h-[calc(100vh-180px)] pr-3">
              <div className="grid grid-cols-1 gap-3">
                {attributes.map((attr) => {
                  const val = recordAttributes[attr.systemName];
                  const hasVal = val !== undefined && val !== null && val !== '';
                  const isCopied = copiedKey === attr.systemName;
                  const isPii = Boolean(
                    ['ssn', 'tax_id', 'card_number', 'password', 'salary', 'bank_account', 'credit_card'].some(k => attr.systemName.toLowerCase().includes(k)) ||
                    String(val).includes('****') ||
                    val === '[CONFIDENTIAL]'
                  );

                  return (
                    <div
                      key={attr.systemName}
                      className="group flex flex-col gap-1 p-3 rounded-xl border border-border/50 bg-background/60 hover:border-primary/30 hover:bg-background/90 transition-all shadow-xs"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">{attr.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            ({attr.systemName})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isPii && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 bg-amber-500/10">
                              <Lock className="size-2.5" /> FLS Protected
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                            {attr.dataType}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(attr.systemName, val)}
                            className="size-6 text-muted-foreground group-hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy value"
                          >
                            {isCopied ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="text-xs font-mono break-all text-foreground/90 mt-0.5">
                        {hasVal ? (
                          typeof val === 'object' ? (
                            <VisualJsonEditor
                              value={val}
                              onChange={() => {}}
                              readOnly
                              defaultMode="tree"
                              height="180px"
                              className="mt-1 border-border/40 shadow-xs"
                            />
                          ) : (
                            String(val)
                          )
                        ) : (
                          <span className="text-muted-foreground/50 italic text-[11px]">
                            &lt;empty / null&gt;
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="flex-1 m-0 p-6 min-h-0">
            <ScrollArea className="h-[calc(100vh-180px)] pr-3">
              <div className="space-y-3">
                {auditLogsLoading ? (
                  <div className="text-xs text-muted-foreground p-4 text-center">Loading audit history...</div>
                ) : auditLogs.length === 0 ? (
                  <div className="p-4 rounded-xl border border-border/50 bg-background/60 text-center text-xs text-muted-foreground">
                    No historical mutations recorded for this record yet.
                  </div>
                ) : (
                  auditLogs.map((logItem) => {
                    const delta = logItem.delta || {};
                    const hasDelta = Object.keys(delta).length > 0;
                    return (
                      <div
                        key={logItem.id}
                        className="p-3.5 rounded-xl border border-border/50 bg-background/70 space-y-2 hover:border-primary/30 transition-colors shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                logItem.operation === 'CREATE'
                                  ? 'default'
                                  : logItem.operation === 'RESTORE'
                                  ? 'secondary'
                                  : logItem.operation === 'SOFT_DELETE'
                                  ? 'destructive'
                                  : 'outline'
                              }
                              className="text-[10px] font-mono"
                            >
                              {logItem.operation}
                            </Badge>
                            <span className="font-mono text-xs font-semibold">v{logItem.version}</span>
                            <span className="text-muted-foreground text-[11px]">by {logItem.actor}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(logItem.createdAt).toLocaleString()}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] gap-1 hover:bg-primary/10"
                              onClick={() => handleRevertVersion(logItem.id, logItem.version)}
                              disabled={restoreMutation.isPending}
                            >
                              <RotateCcw className="size-2.5" />
                              Revert
                            </Button>
                          </div>
                        </div>

                        {/* Visual Delta Diff */}
                        {hasDelta && (
                          <div className="mt-2 pt-2 border-t border-border/40 space-y-1 font-mono text-[11px]">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                              Changes:
                            </span>
                            {Object.entries(delta).map(([key, change]: [string, unknown]) => {
                              const c = change as { old?: unknown; new?: unknown } | null;
                              return (
                                <div key={key} className="flex items-center gap-2 py-0.5 px-2 rounded bg-muted/40">
                                  <span className="font-semibold text-foreground">{key}:</span>
                                  <span className="line-through text-destructive/80 text-[10px]">
                                    {JSON.stringify(c?.old ?? null)}
                                  </span>
                                  <span className="text-muted-foreground text-[10px]">➔</span>
                                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-[10px]">
                                    {JSON.stringify(c?.new ?? null)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="audit" className="flex-1 m-0 p-6 min-h-0">
            <ScrollArea className="h-[calc(100vh-180px)] pr-3">
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-border/50 bg-background/60 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Clock className="size-3.5 text-primary" /> Lifecycle & Mutation Metadata
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Created At</span>
                      <span className="font-mono font-medium">
                        {record.createdDate
                          ? new Date(record.createdDate).toLocaleString()
                          : 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Created By</span>
                      <span className="font-mono font-medium">{record.createdBy || 'SYSTEM'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Last Modified</span>
                      <span className="font-mono font-medium">
                        {record.lastModifiedDate
                          ? new Date(record.lastModifiedDate).toLocaleString()
                          : 'Not modified'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Last Modified By</span>
                      <span className="font-mono font-medium">
                        {record.lastModifiedBy || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border/50 bg-background/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Sparkles className="size-3.5 text-indigo-500" /> Keyboard Shortcuts
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>
                      <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px]">j</kbd> /{' '}
                      <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px]">k</kbd> :
                      Navigate next / previous row
                    </div>
                    <div>
                      <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px]">Enter</kbd> :
                      Open Inspector for active row
                    </div>
                    <div>
                      <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px]">Esc</kbd> :
                      Close Slide-Over Drawer
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="json" className="flex-1 m-0 p-6 min-h-0">
            <ScrollArea className="h-[calc(100vh-180px)] pr-3">
              <pre className="p-4 rounded-xl border border-border/50 bg-muted/40 font-mono text-xs overflow-x-auto text-foreground/90">
                {JSON.stringify(record, null, 2)}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
