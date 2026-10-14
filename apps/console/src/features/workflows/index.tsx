import React from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { Search } from '@/components/search';
import { ThemeSwitch } from '@/components/theme-switch';
import { LanguageSwitch } from '@/components/language-switch';
import { ConfigDrawer } from '@/components/config-drawer';
import { ProfileDropdown } from '@/components/profile-dropdown';
import { ConductorWorkflowStudio } from '@/features/metadata/components/studio';
import { Workflow } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const WorkflowsFeature: React.FC = () => {
  const { t } = useTranslation('console');

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
                  {t('workflows.title', 'Visual DAG Studio')}
                </h1>
                <Badge variant="outline" className="text-[11px] font-mono bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
                  Conductor OSS Core
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs md:text-sm">
                {t(
                  'workflows.description',
                  'Design, simulate, and observe distributed DAG workflows with single-column lease queues and virtual-thread workers.'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Full-bleed Liquid Glass Studio Canvas */}
        <div className="flex-1 w-full min-w-0 min-h-0 rounded-2xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-lg p-2 sm:p-4 overflow-hidden flex flex-col">
          <ConductorWorkflowStudio />
        </div>
      </Main>
    </>
  );
};
