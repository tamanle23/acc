import React from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { Search } from '@/components/search';
import { LanguageSwitch } from '@/components/language-switch';
import { ThemeSwitch } from '@/components/theme-switch';
import { ConfigDrawer } from '@/components/config-drawer';
import { ProfileDropdown } from '@/components/profile-dropdown';
import { EntityDataGrid } from './data-explorer';
import { useEntityType } from '../api/metadata-api';
import { MetadataDialogs } from './metadata-dialogs';
import { Building2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const CustomerAccountsExplorer: React.FC = () => {
  // Model ID 1 corresponds to "Customer Account" in the metadata engine
  const entityTypeId = '1';
  const { data: entityType, isLoading } = useEntityType(entityTypeId);

  return (
    <>
      <Header fixed>
        <Search />
        <div className="ml-auto flex items-center space-x-4">
          <LanguageSwitch />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Breadcrumb & Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                Workspace / Data Explorer
              </span>
              <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-widest bg-primary/10 text-primary border-primary/20">
                POC Faceted Search
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-xs">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>Customer Accounts</span>
                  <span className="text-xs font-mono font-normal text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                    customer_account
                  </span>
                </h1>
                <p className="text-xs text-muted-foreground max-w-2xl mt-0.5">
                  {entityType?.description ||
                    'Dedicated entity data explorer with real-time multi-dimensional Faceted Search and PostgreSQL GIN index acceleration.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="gap-1.5 py-1 px-3 text-xs bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-600/30">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Three-Tier Enforced</span>
            </Badge>
          </div>
        </div>

        {/* Dedicated Data Explorer with Faceted Search Sidebar enabled by default */}
        {isLoading ? (
          <div className="flex items-center justify-center p-16 text-muted-foreground gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">Loading Customer Accounts explorer...</span>
          </div>
        ) : (
          <EntityDataGrid
            entityTypeId={entityTypeId}
            showFacetedSidebar={true}
            defaultFacetOpen={true}
          />
        )}
      </Main>

      <MetadataDialogs />
    </>
  );
};
