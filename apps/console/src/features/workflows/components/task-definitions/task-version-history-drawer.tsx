import React, { useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  History,
  GitBranch,
  UploadCloud,
  Clock,
  User,
  ArrowRight,
  Code2,
  CheckCircle2,
  FileEdit,
  GitCompare,
} from 'lucide-react';
import {
  type TaskDefinitionRecord,
  useTaskDefinitionVersions,
  usePublishTaskDefinition,
} from '@/features/workflows/api/task-definition-api';
import { cn } from '@/lib/utils';

export interface TaskVersionHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string | null;
  onForkDraft: (record: TaskDefinitionRecord) => void;
}

export const TaskVersionHistoryDrawer: React.FC<TaskVersionHistoryDrawerProps> = ({
  open,
  onOpenChange,
  taskName,
  onForkDraft,
}) => {
  const { data: versions = [], isLoading } = useTaskDefinitionVersions(taskName || undefined);
  const publishMutation = usePublishTaskDefinition();

  const sortedVersions = useMemo(() => {
    return [...versions].sort((a, b) => b.version - a.version);
  }, [versions]);

  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);
  const [compareVersionNum, setCompareVersionNum] = useState<number | null>(null);

  // Default selection to the latest version
  const activeSelected = useMemo(() => {
    if (!sortedVersions.length) return null;
    if (selectedVersionNum !== null) {
      return sortedVersions.find((v) => v.version === selectedVersionNum) || sortedVersions[0];
    }
    return sortedVersions[0];
  }, [sortedVersions, selectedVersionNum]);

  const activeCompare = useMemo(() => {
    if (!compareVersionNum || !sortedVersions.length) return null;
    return sortedVersions.find((v) => v.version === compareVersionNum) || null;
  }, [sortedVersions, compareVersionNum]);

  const handlePublish = async (record: TaskDefinitionRecord) => {
    try {
      await publishMutation.mutateAsync({ name: record.name, version: record.version });
    } catch {
      // Handled in mutation onError
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl flex flex-col p-0 gap-0 bg-card/95 backdrop-blur-xl border-l border-white/20 dark:border-white/10 shadow-2xl"
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <SheetHeader className="p-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold flex items-center gap-2">
                Version History: <span className="font-mono text-primary">{taskName || '...'}</span>
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                Append-only audit trail of immutable revisions, changelogs, and contract evolutions.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground italic">
              Loading revision history...
            </div>
          ) : sortedVersions.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-md">
              No version history found for this task definition.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Timeline Column */}
              <div className="md:col-span-5 flex flex-col gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Revisions ({sortedVersions.length})
                </span>

                <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                  {sortedVersions.map((item) => {
                    const isSelected = activeSelected?.version === item.version;
                    const isComparing = activeCompare?.version === item.version;

                    return (
                      <div
                        key={item.version}
                        onClick={() => setSelectedVersionNum(item.version)}
                        className={cn(
                          'p-3 rounded-lg border text-left cursor-pointer transition-all flex flex-col gap-2',
                          isSelected
                            ? 'border-primary/50 bg-primary/5 shadow-sm'
                            : 'border-border/50 bg-card/40 hover:bg-muted/40'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              v{item.version}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                item.status === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]'
                                  : item.status === 'DRAFT'
                                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[10px]'
                                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]'
                              }
                            >
                              {item.status}
                            </Badge>
                          </div>

                          {item.status === 'DRAFT' && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePublish(item);
                              }}
                              disabled={publishMutation.isPending}
                              className="h-6 text-[10px] px-2 gap-1"
                            >
                              <UploadCloud className="w-3 h-3" />
                              Publish
                            </Button>
                          )}
                        </div>

                        {item.changelogNote && (
                          <p className="text-xs text-foreground/90 font-medium line-clamp-2">
                            {item.changelogNote}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.createdAtMs
                              ? new Date(item.createdAtMs).toLocaleString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Unknown date'}
                          </span>
                          {item.createdBy && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {item.createdBy}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Version Detail & Diff Column */}
              <div className="md:col-span-7 flex flex-col gap-3">
                {activeSelected ? (
                  <div className="flex flex-col gap-4 p-4 rounded-lg border border-border/50 bg-card/60">
                    <div className="flex items-center justify-between pb-2 border-b border-border/40">
                      <div>
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          Revision Details: v{activeSelected.version}
                          <Badge variant="outline" className="text-[10px]">
                            {activeSelected.status}
                          </Badge>
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          {activeSelected.description || 'No description provided.'}
                        </span>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          onForkDraft(activeSelected);
                          onOpenChange(false);
                        }}
                        className="h-7 text-xs gap-1.5 shadow-xs"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        Fork as Draft
                      </Button>
                    </div>

                    {/* Compare Dropdown */}
                    {sortedVersions.length > 1 && (
                      <div className="flex items-center justify-between text-xs bg-muted/30 p-2 rounded-md border border-border/40">
                        <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                          <GitCompare className="w-3.5 h-3.5" />
                          Compare with:
                        </span>
                        <div className="flex items-center gap-2">
                          <select
                            value={compareVersionNum || ''}
                            onChange={(e) =>
                              setCompareVersionNum(e.target.value ? Number(e.target.value) : null)
                            }
                            className="h-7 rounded border border-input bg-background px-2 text-xs font-mono"
                          >
                            <option value="">None (Inspect Only)</option>
                            {sortedVersions
                              .filter((v) => v.version !== activeSelected.version)
                              .map((v) => (
                                <option key={v.version} value={v.version}>
                                  v{v.version} ({v.status})
                                </option>
                              ))}
                          </select>
                          {compareVersionNum && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setCompareVersionNum(null)}
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Schemas View / Side-by-side diff */}
                    <div className="flex flex-col gap-3">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                          Input Contract Schema
                        </span>
                        {activeCompare ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-mono text-muted-foreground">
                                v{activeCompare.version} (Base)
                              </span>
                              <pre className="p-2 rounded bg-muted/40 border border-border/40 text-[10px] font-mono max-h-[160px] overflow-auto">
                                {JSON.stringify(activeCompare.inputSchema || {}, null, 2)}
                              </pre>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-mono text-primary">
                                v{activeSelected.version} (Selected)
                              </span>
                              <pre className="p-2 rounded bg-primary/5 border border-primary/20 text-[10px] font-mono max-h-[160px] overflow-auto">
                                {JSON.stringify(activeSelected.inputSchema || {}, null, 2)}
                              </pre>
                            </div>
                          </div>
                        ) : (
                          <pre className="p-2 rounded bg-muted/40 border border-border/40 text-[11px] font-mono max-h-[180px] overflow-auto">
                            {JSON.stringify(activeSelected.inputSchema || {}, null, 2)}
                          </pre>
                        )}
                      </div>

                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                          Output Contract Schema
                        </span>
                        {activeCompare ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-mono text-muted-foreground">
                                v{activeCompare.version} (Base)
                              </span>
                              <pre className="p-2 rounded bg-muted/40 border border-border/40 text-[10px] font-mono max-h-[160px] overflow-auto">
                                {JSON.stringify(activeCompare.outputSchema || {}, null, 2)}
                              </pre>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-mono text-primary">
                                v{activeSelected.version} (Selected)
                              </span>
                              <pre className="p-2 rounded bg-primary/5 border border-primary/20 text-[10px] font-mono max-h-[160px] overflow-auto">
                                {JSON.stringify(activeSelected.outputSchema || {}, null, 2)}
                              </pre>
                            </div>
                          </div>
                        ) : (
                          <pre className="p-2 rounded bg-muted/40 border border-border/40 text-[11px] font-mono max-h-[180px] overflow-auto">
                            {JSON.stringify(activeSelected.outputSchema || {}, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Select a version on the left to inspect its contract and diff.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
