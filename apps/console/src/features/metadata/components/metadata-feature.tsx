import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMetadataUiStore } from '../store/use-metadata-ui-store';
import {
  useEntityType,
  useAttributeDefinitions,
  useEntityRecords,
  useRelationshipTypes,
} from '../api/metadata-api';
import { EntityTypeSidebar } from './entity-type';
import { SchemaBuilder } from './schema-builder';
import { EntityDataGrid } from './data-explorer';
import { RelationshipTypesManager } from './relationships';
import { MetadataDialogs } from './metadata-dialogs';
import { FeatureGate } from './billing/feature-gate';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { Search } from '@/components/search';
import { LanguageSwitch } from '@/components/language-switch';
import { ThemeSwitch } from '@/components/theme-switch';
import { ConfigDrawer } from '@/components/config-drawer';
import { ProfileDropdown } from '@/components/profile-dropdown';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getRouteApi } from '@tanstack/react-router';
import { Layers, Database, Sparkles, GitFork, Cpu, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const route = getRouteApi('/_authenticated/metadata/');

export const MetadataFeature: React.FC = () => {
  const { t } = useTranslation('console');
  const navigate = route.useNavigate();
  const searchParams = route.useSearch();

  const {
    selectedEntityTypeId,
    setSelectedEntityTypeId,
    activeTab,
    setActiveTab,
    workspaceMode,
    toggleWorkspaceMode,
    currentUserRole,
    canManageSchema,
    openBlueprintGallery,
    openCreateEntityTypeDialog,
  } = useMetadataUiStore();


  // 1. Initial Sync from URL to Store
  React.useEffect(() => {
    if (searchParams.model && searchParams.model !== selectedEntityTypeId) {
      setSelectedEntityTypeId(searchParams.model);
    }
    if (
      searchParams.tab &&
      ['schema', 'data', 'relationships'].includes(searchParams.tab) &&
      searchParams.tab !== activeTab
    ) {
      setActiveTab(searchParams.tab);
    }
  }, [searchParams.model, searchParams.tab]);

  // 2. Sync Tab change to URL and Store
  const handleTabChange = (val: string) => {
    const tab = val as 'schema' | 'data' | 'relationships';
    setActiveTab(tab);
    navigate({
      search: (prev) => ({
        ...prev,
        tab,
        model: selectedEntityTypeId || prev.model,
      }),
    });
  };

  const { data: activeEntity } = useEntityType(selectedEntityTypeId);

  // 3. Auto-switch to 'data' (Records) tab when a composite entity is selected
  React.useEffect(() => {
    if (activeEntity?.isComposite && activeTab === 'schema') {
      setActiveTab('data');
    }
  }, [activeEntity?.id, activeEntity?.isComposite]);

  // Live Metric Counts for High-Affordance Badges
  const { data: attributesResponse } = useAttributeDefinitions(selectedEntityTypeId, { size: 1 });
  const { data: recordsResponse } = useEntityRecords(selectedEntityTypeId, { size: 1 });
  const { data: relTypesResponse } = useRelationshipTypes();

  const attributeCount = attributesResponse?.totalElements ?? 0;
  const recordCount = recordsResponse?.totalElements ?? 0;
  const relCount = React.useMemo(() => {
    if (!selectedEntityTypeId || !relTypesResponse?.content) return 0;
    return relTypesResponse.content.filter(
      (r) =>
        String(r.sourceEntityTypeId) === String(selectedEntityTypeId) ||
        String(r.targetEntityTypeId) === String(selectedEntityTypeId)
    ).length;
  }, [selectedEntityTypeId, relTypesResponse]);

  return (
    <>
      <Header>
        <Search />
        <div className="ms-auto flex items-center space-x-4">
          <LanguageSwitch />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main fixed fluid className="flex flex-1 flex-col gap-4 sm:gap-6 min-w-0 w-full lg:overflow-hidden">
        {/* Page Title & Intro + Dual-Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t('metadata.title', 'Metadata Management')}
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm">
              {t(
                'metadata.description',
                'Architect flexible data schemas, enforce dynamic validation rules, and manage records.'
              )}
            </p>
          </div>

          {/* Liquid Glass Workspace Mode Switcher (Visible to Admins) */}
          {currentUserRole === 'TENANT_ADMIN' && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/60 dark:bg-slate-900/60 border border-white/30 dark:border-white/10 backdrop-blur-xl shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                {workspaceMode === 'architect' ? (
                  <span className="text-amber-500 dark:text-amber-400 flex items-center gap-1.5 font-bold">
                    <Sparkles className="h-3.5 w-3.5" /> {t('metadata.mode.architect', 'Architect Studio')}
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-bold">
                    <User className="h-3.5 w-3.5" /> {t('metadata.mode.operator', 'Operator View')}
                  </span>
                )}
              </span>
              <Switch
                checked={workspaceMode === 'architect'}
                onCheckedChange={toggleWorkspaceMode}
                aria-label="Toggle Architect / Operator Mode"
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
          )}
        </div>

        {/* Liquid Glass Split Workspace */}
        <div className="flex flex-col lg:flex-row gap-6 items-stretch flex-1 w-full min-w-0 max-lg:min-h-fit lg:min-h-0">
          {/* Left: Entity Models Rail */}
          <EntityTypeSidebar />

          {/* Right: Active Model Workspace */}
          <div className="flex-1 w-full min-w-0 flex flex-col gap-4 max-lg:min-h-fit lg:min-h-0">
            {selectedEntityTypeId && activeEntity ? (
              <div className="flex flex-col gap-4 flex-1 max-lg:min-h-fit lg:min-h-0">
                {/* Active Model Banner & Segmented Frosted Glass Rail (Option A) */}
                <Tabs
                  value={activeTab}
                  onValueChange={handleTabChange}
                  className="flex flex-col gap-4 flex-1 max-lg:min-h-fit lg:min-h-0"
                >
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 md:p-5 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/25 shrink-0">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                          <Cpu className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-base md:text-lg text-foreground tracking-tight truncate">
                          {activeEntity.name}
                        </span>
                        <code className="text-xs font-mono text-muted-foreground bg-muted/60 dark:bg-white/5 px-2 py-0.5 rounded border border-white/20">
                          {activeEntity.systemName}
                        </code>
                        {activeEntity.isComposite && (
                          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/25 rounded px-2 py-0.5 flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            <span>Composite Entity</span>
                          </span>
                        )}
                      </div>
                      {activeEntity.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed pl-0 sm:pl-9">
                          {activeEntity.description}
                        </p>
                      )}
                    </div>

                    {/* High-Affordance Segmented Tab Navigation Rail */}
                    <div className="w-full xl:w-auto overflow-x-auto no-scrollbar py-0.5">
                      <TabsList className="flex w-full xl:w-auto min-w-0 items-center justify-between sm:justify-start xl:justify-end gap-1 sm:gap-1.5 p-1 sm:p-1.5 h-auto rounded-xl bg-slate-200/50 dark:bg-slate-950/60 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-inner shadow-black/5">
                        {/* Schema Builder Tab (Architect Mode Only) */}
                        {canManageSchema() && (
                          <TabsTrigger
                            value="schema"
                            className={cn(
                              'relative flex-1 xl:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-2.5 sm:px-3 text-xs font-medium rounded-lg transition-all duration-200 min-w-0 whitespace-nowrap',
                              'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/5',
                              'data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-foreground data-[state=active]:font-semibold',
                              'data-[state=active]:shadow-md data-[state=active]:shadow-black/10 data-[state=active]:border data-[state=active]:border-white/60 dark:data-[state=active]:border-white/10'
                            )}
                          >
                            <Layers className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                            <span className="truncate">{t('metadata.tabs.schema', 'Schema')}</span>
                            <span
                              className={cn(
                                'inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium transition-colors shrink-0',
                                activeTab === 'schema'
                                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20'
                                  : 'bg-muted/80 text-muted-foreground'
                              )}
                            >
                              {attributeCount}
                            </span>
                          </TabsTrigger>
                        )}

                        {/* Data Explorer Tab */}
                        <TabsTrigger
                          value="data"
                          className={cn(
                            'relative flex-1 xl:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-2.5 sm:px-3 text-xs font-medium rounded-lg transition-all duration-200 min-w-0 whitespace-nowrap',
                            'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/5',
                            'data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-foreground data-[state=active]:font-semibold',
                            'data-[state=active]:shadow-md data-[state=active]:shadow-black/10 data-[state=active]:border data-[state=active]:border-white/60 dark:data-[state=active]:border-white/10'
                          )}
                        >
                          <Database className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="truncate">{t('metadata.tabs.data', 'Records')}</span>
                          <span
                            className={cn(
                              'inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium transition-colors shrink-0',
                              activeTab === 'data'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                : 'bg-muted/80 text-muted-foreground'
                            )}
                          >
                            {recordCount}
                          </span>
                        </TabsTrigger>

                        {/* Connected Edges Tab */}
                        <TabsTrigger
                          value="relationships"
                          className={cn(
                            'relative flex-1 xl:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-2.5 sm:px-3 text-xs font-medium rounded-lg transition-all duration-200 min-w-0 whitespace-nowrap',
                            'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/5',
                            'data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-foreground data-[state=active]:font-semibold',
                            'data-[state=active]:shadow-md data-[state=active]:shadow-black/10 data-[state=active]:border data-[state=active]:border-white/60 dark:data-[state=active]:border-white/10'
                          )}
                        >
                          <GitFork className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                          <span className="truncate">{t('metadata.tabs.relationships', 'Edges')}</span>
                          <span
                            className={cn(
                              'inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium transition-colors shrink-0',
                              activeTab === 'relationships'
                                ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/20'
                                : 'bg-muted/80 text-muted-foreground'
                            )}
                          >
                            {relCount}
                          </span>
                        </TabsTrigger>
                      </TabsList>
                    </div>
                  </div>

                  {/* Tab Views */}
                  <TabsContent value="schema" className="m-0 flex-1 min-h-0 focus-visible:outline-none data-[state=inactive]:hidden">
                    <FeatureGate
                      featureKey="FEATURE_SCHEMA_STUDIO"
                      featureTitle="Schema Architect Studio"
                      requiredTier="PRO"
                      description="Thiết kế và tùy biến các trường dữ liệu động (Attribute Definitions) cho mô hình thực thể. Nâng cấp Pro hoặc Pro Max để kích hoạt."
                    >
                      <SchemaBuilder entityTypeId={selectedEntityTypeId} />
                    </FeatureGate>
                  </TabsContent>

                  <TabsContent value="data" className="m-0 flex-1 min-h-0 focus-visible:outline-none data-[state=inactive]:hidden">
                    <EntityDataGrid entityTypeId={selectedEntityTypeId} />
                  </TabsContent>

                  <TabsContent value="relationships" className="m-0 flex-1 min-h-0 focus-visible:outline-none data-[state=inactive]:hidden">
                    <FeatureGate
                      featureKey="FEATURE_PATTERN_C_GRAPH"
                      featureTitle="Pattern C Connected Graph Edges"
                      requiredTier="PRO"
                      description="Khởi tạo và cấu hình các mối quan hệ đồ thị đa chiều giữa các mô hình dữ liệu. Nâng cấp Pro hoặc Pro Max để kích hoạt."
                    >
                      <RelationshipTypesManager entityTypeId={selectedEntityTypeId} />
                    </FeatureGate>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 md:p-16 text-center rounded-3xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-dashed border-white/40 dark:border-white/10 shadow-lg shadow-black/5 text-muted-foreground flex-1 min-h-[360px]">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-primary border border-primary/20 mb-4 shadow-sm">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <h4 className="font-bold text-foreground mb-1 text-base md:text-lg tracking-tight">
                  No Entity Model Selected
                </h4>
                <p className="text-xs max-w-md text-muted-foreground mb-6">
                  Select an existing model from the left rail, or jump-start your workspace with a pre-modeled Domain Blueprint in under 250ms.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  {canManageSchema() && (
                    <>
                      <Button
                        size="sm"
                        onClick={openBlueprintGallery}
                        className="text-xs gap-1.5 font-semibold bg-primary text-primary-foreground shadow-md hover:shadow-lg"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Browse Blueprint Catalog</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={openCreateEntityTypeDialog}
                        className="text-xs gap-1.5 bg-white/40 dark:bg-white/5 border-white/20 hover:bg-white/60"
                      >
                        <Database className="h-3.5 w-3.5" />
                        <span>Create Custom Model</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Main>

      <MetadataDialogs />

    </>
  );
};
