import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { Search } from '@/components/search';
import { ThemeSwitch } from '@/components/theme-switch';
import { LanguageSwitch } from '@/components/language-switch';
import { ConfigDrawer } from '@/components/config-drawer';
import { ProfileDropdown } from '@/components/profile-dropdown';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { UserCheck } from 'lucide-react';
import { useApprovalsQuery } from './hooks/use-approvals';
import { ApprovalTable } from './components/approval-table';
import { HumanDecisionModal } from './components/human-decision-modal';
import type { ApprovalTask } from '@acc/client';

export const ApprovalsFeature: React.FC = () => {
  const { t } = useTranslation('console');
  const currentUserId = 'satnaing';

  const { data: approvals = [], isLoading, refetch } = useApprovalsQuery();
  const [activeTab, setActiveTab] = useState<'myReview' | 'unassigned' | 'history'>('myReview');
  const [selectedTask, setSelectedTask] = useState<ApprovalTask | null>(null);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);

  // Categorize tasks
  const myReviewTasks = useMemo(() => {
    return approvals.filter(
      (a) => a.status === 'WAITING_FOR_APPROVAL' && a.claimedBy === currentUserId
    );
  }, [approvals, currentUserId]);

  const unassignedTasks = useMemo(() => {
    return approvals.filter(
      (a) => a.status === 'WAITING_FOR_APPROVAL' && !a.claimedBy
    );
  }, [approvals]);

  const historyTasks = useMemo(() => {
    return approvals.filter(
      (a) => a.status === 'COMPLETED' || a.status === 'FAILED'
    );
  }, [approvals]);

  const displayedTasks = useMemo(() => {
    if (activeTab === 'myReview') return myReviewTasks;
    if (activeTab === 'unassigned') return unassignedTasks;
    if (activeTab === 'history') return historyTasks;
    return approvals;
  }, [activeTab, myReviewTasks, unassignedTasks, historyTasks, approvals]);

  const handleOpenReview = (task: ApprovalTask) => {
    setSelectedTask(task);
    setIsDecisionModalOpen(true);
  };

  return (
    <>
      <Header fixed>
        <Search />
        <div className="ms-auto flex items-center space-x-4">
          <LanguageSwitch />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                {t('sidebar.groups.workspace', 'Workspace')} / {t('sidebar.items.approvals', 'Task Approvals')}
              </span>
              <Badge variant="outline" className="font-mono text-[10px] text-primary bg-primary/5">
                HITL Engine
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-primary" />
              {t('sidebar.items.approvals', 'Task Approvals Inbox')}
            </h1>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/40 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shadow-sm">
              <span className="text-xs text-muted-foreground">Pending:</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {myReviewTasks.length + unassignedTasks.length}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/40 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shadow-sm">
              <span className="text-xs text-muted-foreground">My Queue:</span>
              <Badge variant="default" className="font-mono text-xs bg-primary text-primary-foreground">
                {myReviewTasks.length}
              </Badge>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as any)}
            className="w-full sm:w-auto"
          >
            <TabsList className="bg-muted/40 p-1">
              <TabsTrigger value="myReview" className="text-xs gap-1.5">
                My Review
                <span className="ml-1 text-[10px] rounded-full px-1.5 py-0.2 bg-primary/20 text-primary font-mono">
                  {myReviewTasks.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="unassigned" className="text-xs gap-1.5">
                Unassigned Pool
                <span className="ml-1 text-[10px] rounded-full px-1.5 py-0.2 bg-muted text-muted-foreground font-mono">
                  {unassignedTasks.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs">
                History
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : (
          <ApprovalTable
            tasks={displayedTasks}
            onReviewTask={handleOpenReview}
            currentUserId={currentUserId}
          />
        )}

        {/* Decision Modal */}
        <HumanDecisionModal
          isOpen={isDecisionModalOpen}
          onClose={() => {
            setIsDecisionModalOpen(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          onSuccess={() => refetch()}
        />
      </Main>
    </>
  );
};
