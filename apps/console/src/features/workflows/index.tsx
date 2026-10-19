import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { Search } from '@/components/search';
import { ThemeSwitch } from '@/components/theme-switch';
import { LanguageSwitch } from '@/components/language-switch';
import { ConfigDrawer } from '@/components/config-drawer';
import { ProfileDropdown } from '@/components/profile-dropdown';
import { VisualDagStudio } from '@/features/metadata/components/studio';
import { Workflow, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWorkflowDefinitions as useWorkflowsQuery, type WorkflowDefinitionSummary } from './api/workflow-api';
import { WorkflowCatalogTable } from './components/workflow-catalog-table';
import { WorkflowCreateDialog } from './components/workflow-create-dialog';
import { FleetMigrationModal } from './components/fleet-migration-modal';
import { getRouteApi } from '@tanstack/react-router';
import { Skeleton } from '@/components/ui/skeleton';

const route = getRouteApi('/_authenticated/workflows/')

export const WorkflowsFeature: React.FC = () => {
  const search = route.useSearch()
  const { data: definitions = [], isLoading, refetch } = useWorkflowsQuery();

  const { t } = useTranslation('console');
  const [activeWorkflowKey, setActiveWorkflowKey] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [fleetMigrateTarget, setFleetMigrateTarget] = useState<WorkflowDefinitionSummary | null>(null);



  const handleOpenStudio = (workflowKey: string) => {
    setActiveWorkflowKey(workflowKey);
  };

  const handleBackToCatalog = () => {
    setActiveWorkflowKey(null);
    refetch();
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
        {/* Page Title & Operational Telemetry Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                Workspace / Workflows
              </span>
              <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-widest bg-primary/10 text-primary border-primary/20">
                POC Faceted Search
              </Badge>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-xs">
                  <Workflow className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                    {activeWorkflowKey
                      ? `${t('workflows.studio', 'Studio')}: ${activeWorkflowKey}`
                      : t('workflows.title', 'Workflow Definitions')}
                  </h1>
                  <Badge
                    variant="outline"
                    className="text-[11px] font-mono bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                  >
                    {activeWorkflowKey ? 'Designer Mode' : 'Catalog'}
                  </Badge>
                </div>
              </div>
              <p className="text-muted-foreground text-xs md:text-sm">
                {activeWorkflowKey
                  ? t(
                    'workflows.designer_desc',
                    'Design and bind DAG node topologies, parameters, and compensation handlers.'
                  )
                  : t(
                    'workflows.catalog_desc',
                    'Catalog of enterprise distributed workflows. Create, manage, and inspect DAG orchestrations.'
                  )}
              </p>
            </div>
          </div>

          {activeWorkflowKey && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9"
              onClick={handleBackToCatalog}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Catalog
            </Button>
          )}
        </div>

        {/* Content Area: Catalog Table or Full-bleed Studio Canvas */}
        {activeWorkflowKey ? (
          <VisualDagStudio
            mode="designer"
            workflowKey={activeWorkflowKey}
            onSaveSuccess={refetch}
          />
        ) : isLoading ? (
          <div className='space-y-4'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-96 w-full' />
          </div>
        ) : (
          <div className="flex-1 w-full min-w-0 min-h-0 overflow-y-auto">
            <WorkflowCatalogTable
              data={definitions}
              search={search}
              isLoading={isLoading}
              onDesignWorkflow={handleOpenStudio}
              onCreateNew={() => setIsCreateOpen(true)}
              onFleetMigrate={(wf) => setFleetMigrateTarget(wf)}
            />
          </div>
        )}
      </Main>

      <WorkflowCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={(key) => {
          refetch();
          setActiveWorkflowKey(key);
        }}
      />

      {fleetMigrateTarget && (
        <FleetMigrationModal
          isOpen={Boolean(fleetMigrateTarget)}
          onClose={() => {
            setFleetMigrateTarget(null);
            refetch();
          }}
          workflowKey={fleetMigrateTarget.workflowKey}
          workflowName={fleetMigrateTarget.name}
          currentVersion={fleetMigrateTarget.version || 1}
        />
      )}
    </>
  );
};
