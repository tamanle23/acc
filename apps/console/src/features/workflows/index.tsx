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
import { useWorkflowDefinitions } from './api/workflow-api';
import { WorkflowCatalogTable } from './components/workflow-catalog-table';
import { WorkflowCreateDialog } from './components/workflow-create-dialog';

export const WorkflowsFeature: React.FC = () => {
  const { t } = useTranslation('console');
  const [activeWorkflowKey, setActiveWorkflowKey] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: definitions = [], isLoading, refetch } = useWorkflowDefinitions();

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

      <Main fixed fluid className="flex flex-1 flex-col gap-4 sm:gap-6 min-w-0 w-full overflow-hidden">
        {/* Page Title & Operational Telemetry Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-md shadow-amber-500/20">
              <Workflow className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
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
          <div className="flex-1 w-full min-w-0 min-h-0 rounded-2xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-lg p-2 sm:p-4 overflow-hidden flex flex-col">
            <VisualDagStudio
              mode="designer"
              workflowKey={activeWorkflowKey}
              onSaveSuccess={refetch}
            />
          </div>
        ) : (
          <div className="flex-1 w-full min-w-0 min-h-0 overflow-y-auto">
            <WorkflowCatalogTable
              definitions={definitions}
              isLoading={isLoading}
              onDesignWorkflow={handleOpenStudio}
              onCreateNew={() => setIsCreateOpen(true)}
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
    </>
  );
};
