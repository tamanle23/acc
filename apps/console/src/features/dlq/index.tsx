import React, { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ProfileDropdown } from '@/components/profile-dropdown';
import { ThemeSwitch } from '@/components/theme-switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Archive,
  RefreshCw,
  Crown,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import type { TaskDlqRecordDto } from '@unipost/client';
import { usePermissions } from '@/features/spring-auth/hooks/use-permissions';
import { useDlqQuery, useReplayDlqMutation, useDiscardDlqMutation } from './hooks/use-dlq';
import { DlqTable } from './components/dlq-table';
import { DlqInspectorSheet } from './components/dlq-inspector-sheet';

export function DlqFeature() {
  const { isSovereignCustodian } = usePermissions();
  const [selectedRecord, setSelectedRecord] = useState<TaskDlqRecordDto | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const { data: records = [], isLoading, isRefetching, refetch } = useDlqQuery();
  const replayMutation = useReplayDlqMutation();
  const discardMutation = useDiscardDlqMutation();

  const isolatedCount = records.filter((r) => r.status === 'ISOLATED').length;
  const replayedCount = records.filter((r) => r.status === 'REPLAYED').length;
  const discardedCount = records.filter((r) => r.status === 'DISCARDED').length;

  const handleInspect = (record: TaskDlqRecordDto) => {
    setSelectedRecord(record);
    setInspectorOpen(true);
  };

  const handleReplay = (record: TaskDlqRecordDto, payloadOverrides?: Record<string, unknown>) => {
    replayMutation.mutate(
      { dlqId: record.dlqId, payloadOverrides },
      {
        onSuccess: () => {
          toast.success(`Task ${record.taskId} re-enqueued for execution`);
          refetch();
        },
        onError: (err: any) => {
          toast.error(`Failed to replay task: ${err.message || 'Unknown error'}`);
        },
      }
    );
  };

  const handleDiscard = (record: TaskDlqRecordDto) => {
    discardMutation.mutate(record.dlqId, {
      onSuccess: () => {
        toast.info(`Task ${record.taskId} marked as discarded`);
        refetch();
      },
      onError: (err: any) => {
        toast.error(`Failed to discard task: ${err.message || 'Unknown error'}`);
      },
    });
  };

  if (!isSovereignCustodian) {
    return (
      <div className="flex h-[80vh] w-full flex-col items-center justify-center p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive mb-4 shadow-inner">
          <ShieldAlert className="h-8 w-8 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          403 Forbidden: Sovereign Custody Restricted
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mt-2">
          Dead-Letter Queue inspection and lease task replaying are strictly restricted to Sovereign Custodians within the SYSTEM Platform Root workspace.
        </p>
      </div>
    );
  }

  return (
    <>
      <Header fixed>
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Dead-Letter Queue</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="h-8 gap-1.5 text-xs backdrop-blur-md bg-background/50 border-white/20 dark:border-white/10"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <ThemeSwitch />
            <ProfileDropdown />
          </div>
        </div>
      </Header>

      <Main className="space-y-6 p-6">
        {/* Hero Section */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Crown className="h-4 w-4" />
            <span>Sovereign Platform Root</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Dead-Letter Queue (DLQ)
          </h2>
          <p className="text-sm text-muted-foreground">
            Cross-tenant quarantine, inspection, and priority recovery for poisoned tasks isolated from the distributed lease queue.
          </p>
        </div>

        {/* Liquid Glass Metric Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Isolated Tasks */}
          <Card className="backdrop-blur-xl bg-card/65 border border-destructive/20 shadow-xl shadow-black/5 dark:shadow-black/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-destructive">
                Isolated Tasks
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive font-mono">{isolatedCount}</div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Tasks exceeding max retries or unrecoverable crashes
              </p>
            </CardContent>
          </Card>

          {/* Replayed Recoveries */}
          <Card className="backdrop-blur-xl bg-card/65 border border-emerald-500/20 shadow-xl shadow-black/5 dark:shadow-black/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Replayed Recoveries
              </CardTitle>
              <RotateCcw className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {replayedCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Tasks re-enqueued into priority queue with overrides
              </p>
            </CardContent>
          </Card>

          {/* Discarded Tasks */}
          <Card className="backdrop-blur-xl bg-card/65 border border-border/40 shadow-xl shadow-black/5 dark:shadow-black/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Discarded Tasks
              </CardTitle>
              <Archive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground font-mono">
                {discardedCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Archived poison tasks marked non-retryable
              </p>
            </CardContent>
          </Card>
        </div>

        {/* DLQ Shared DataTable Container */}
        <Card className="backdrop-blur-xl bg-card/65 border border-white/20 dark:border-white/10 shadow-xl shadow-black/5 dark:shadow-black/20">
          <CardContent className="p-6">
            <DlqTable
              records={records}
              onInspect={handleInspect}
              onReplay={handleReplay}
              onDiscard={handleDiscard}
            />
          </CardContent>
        </Card>

        {/* Slide-over Inspector Sheet */}
        <DlqInspectorSheet
          record={selectedRecord}
          open={inspectorOpen}
          onOpenChange={setInspectorOpen}
          onReplay={handleReplay}
          onDiscard={handleDiscard}
        />
      </Main>
    </>
  );
}

export default DlqFeature;
