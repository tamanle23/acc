import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Lock,
  GitCompare,
  LayoutGrid,
  Magnet,
  Spline,
  Route,
  Undo2,
  Redo2,
  BarChart2,
  Plus,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  FileCode,
  ChevronDown,
  Upload,
  Trash2,
  Maximize2,
  Minimize2,
  Save,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface DagHeaderCommandBarProps {
  containerRef?: React.RefObject<HTMLDivElement | null>;
  isReadOnly?: boolean;
  workflowKey?: string;
  workflowVersions: Array<{ version: number; status: string }>;
  diffTargetVersion: number | null;
  onDiffVersionChange: (version: number | null) => void;
  isExecutionMode: boolean;
  executionId?: string | null;
  onOpenHotMigration?: () => void;
  undoDisabled: boolean;
  redoDisabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: (direction: 'LR' | 'TB') => void;
  isSnapToGrid: boolean;
  onToggleSnapToGrid: () => void;
  edgeRoutingMode: 'bezier' | 'smoothstep';
  onToggleEdgeRouting: () => void;
  activeViewTab: 'graph' | 'timeline';
  onChangeViewTab: (tab: 'graph' | 'timeline') => void;
  showPalette: boolean;
  onTogglePalette: () => void;
  onNewBlank: () => void;
  onValidateDag: () => void;
  validationErrorsCount: number;
  onDryRun: () => void;
  onExportJson: () => void;
  onOpenImportDialog: () => void;
  onResetInitial: () => void;
  onClearSelected: () => void;
  hasSelectedNodes: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onSave: () => void;
  isSaving: boolean;
  onCloseExecution?: () => void;
}

export const DagHeaderCommandBar: React.FC<DagHeaderCommandBarProps> = ({
  containerRef,
  isReadOnly,
  workflowKey,
  workflowVersions,
  diffTargetVersion,
  onDiffVersionChange,
  isExecutionMode,
  executionId,
  onOpenHotMigration,
  undoDisabled,
  redoDisabled,
  onUndo,
  onRedo,
  onAutoLayout,
  isSnapToGrid,
  onToggleSnapToGrid,
  edgeRoutingMode,
  onToggleEdgeRouting,
  activeViewTab,
  onChangeViewTab,
  showPalette,
  onTogglePalette,
  onNewBlank,
  onValidateDag,
  validationErrorsCount,
  onDryRun,
  onExportJson,
  onOpenImportDialog,
  onResetInitial,
  onClearSelected,
  hasSelectedNodes,
  isFullscreen,
  onToggleFullscreen,
  onSave,
  isSaving,
  onCloseExecution,
}) => {
  return (
    <div
      ref={containerRef}
      data-testid="dag-header-command-bar"
      className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none transition-all duration-200"
    >
      {/* 1. Left Cluster: Identity & Context */}
      <div
        data-testid="dag-toolbar-left-cluster"
        className="pointer-events-auto shrink-0 flex items-center gap-1.5 sm:gap-2 p-1.5 px-2 sm:px-2.5 rounded-xl backdrop-blur-xl bg-white/85 dark:bg-slate-900/85 border border-white/30 dark:border-white/10 shadow-lg transition-all"
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Activity className="w-4 h-4 text-primary animate-pulse shrink-0" />
          <span className="text-xs font-bold text-foreground tracking-tight hidden sm:inline">
            Visual DAG Studio 2.0
          </span>
          <span className="text-xs font-bold text-foreground tracking-tight sm:hidden">Studio</span>
          {isReadOnly ? (
            <Badge
              variant="outline"
              className="text-[10px] bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 flex items-center gap-1 px-1.5"
            >
              <Lock className="w-2.5 h-2.5" />
              <span className="hidden xs:inline">Read-Only</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] bg-primary/10 text-primary border-primary/20 px-1.5"
            >
              <span className="hidden sm:inline">Full Authoring</span>
              <span className="sm:hidden">Author</span>
            </Badge>
          )}
        </div>

        {workflowKey && (
          <>
            <div className="h-3.5 w-[1px] bg-border/50 hidden xs:block" />
            <span
              className="text-[11px] font-medium text-muted-foreground truncate max-w-[80px] sm:max-w-[120px] hidden xs:inline"
              title={workflowKey}
            >
              {workflowKey}
            </span>
          </>
        )}

        {/* Visual Graph Diff Version Selector */}
        {workflowVersions.length > 0 && (
          <>
            <div className="h-3.5 w-[1px] bg-border/50" />
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/40 border border-border/50">
              <GitCompare className="w-3 h-3 text-primary" />
              <select
                aria-label="Diff comparison version"
                value={diffTargetVersion ?? ''}
                onChange={(e) =>
                  onDiffVersionChange(e.target.value ? Number(e.target.value) : null)
                }
                className="text-[10px] bg-transparent border-none focus:outline-none cursor-pointer font-medium text-foreground max-w-[70px] sm:max-w-none truncate"
              >
                <option value="">Diff: None</option>
                {workflowVersions.map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version} ({v.status})
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Hot Migration Operator Modal Button */}
        {executionId && onOpenHotMigration && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] gap-1 px-2 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 shadow-sm"
            onClick={onOpenHotMigration}
            title="Open Hot Migration compatibility checker & execution rewiring"
          >
            <GitCompare className="w-2.5 h-2.5" />
            <span className="hidden sm:inline">Hot Migrate</span>
          </Button>
        )}
      </div>

      {/* 2. Center Cluster: Canvas Ergonomics (Authoring Mode) */}
      {!isReadOnly && (
        <div
          data-testid="dag-toolbar-center-cluster"
          className="pointer-events-auto shrink-0 flex items-center gap-1 p-1.5 px-2 rounded-xl backdrop-blur-xl bg-white/85 dark:bg-slate-900/85 border border-white/30 dark:border-white/10 shadow-lg transition-all order-3 xl:order-2 mx-auto xl:mx-0"
        >
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => onAutoLayout('LR')}
            title="Topological Auto-Layout (Left-to-Right)"
            aria-label="Topological Auto-Layout"
            data-testid="dag-auto-layout-btn"
          >
            <LayoutGrid className="w-3 h-3 text-indigo-500" />
            <span className="hidden xl:inline">Auto-Layout</span>
          </Button>

          {/* Snap to grid toggle */}
          <Button
            size="sm"
            variant={isSnapToGrid ? 'default' : 'outline'}
            className="h-7 px-2 text-xs gap-1"
            onClick={onToggleSnapToGrid}
            title={`Snap to Grid: ${isSnapToGrid ? 'ON' : 'OFF'} (16px grid)`}
            aria-label={`Snap to Grid: ${isSnapToGrid ? 'ON' : 'OFF'}`}
            data-testid="dag-snap-grid-btn"
          >
            <Magnet
              className={cn(
                'w-3 h-3',
                isSnapToGrid ? 'text-primary-foreground' : 'text-muted-foreground'
              )}
            />
            <span className="hidden sm:inline">Snap</span>
          </Button>

          {/* Edge routing toggle */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs gap-1"
            onClick={onToggleEdgeRouting}
            title={`Edge Routing: ${edgeRoutingMode === 'bezier' ? 'Curved (Bezier)' : 'Orthogonal (Step)'}`}
            aria-label={`Edge Routing: ${edgeRoutingMode === 'bezier' ? 'Curved (Bezier)' : 'Orthogonal (Step)'}`}
            data-testid="dag-edge-routing-btn"
          >
            {edgeRoutingMode === 'bezier' ? (
              <>
                <Spline className="w-3 h-3 text-sky-500" />
                <span className="hidden sm:inline">Curves</span>
              </>
            ) : (
              <>
                <Route className="w-3 h-3 text-indigo-500" />
                <span className="hidden sm:inline">Orthogonal</span>
              </>
            )}
          </Button>

          <div className="h-3.5 w-[1px] bg-border/50 mx-0.5" />

          {/* Undo / Redo pair */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={onUndo}
            disabled={undoDisabled}
            title="Undo (Cmd+Z)"
            aria-label="Undo"
          >
            <Undo2 className="w-3 h-3" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={onRedo}
            disabled={redoDisabled}
            title="Redo (Cmd+Y)"
            aria-label="Redo"
          >
            <Redo2 className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Read-Only View Switcher (Center cluster in Read-Only / Execution Mode) */}
      {isReadOnly && (
        <div
          data-testid="dag-toolbar-center-cluster-readonly"
          className="pointer-events-auto shrink-0 flex items-center gap-1.5 p-1.5 px-2 rounded-xl backdrop-blur-xl bg-white/85 dark:bg-slate-900/85 border border-white/30 dark:border-white/10 shadow-lg transition-all order-3 sm:order-2 mx-auto sm:mx-0"
        >
          <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/40">
            <Button
              size="sm"
              variant={activeViewTab === 'graph' ? 'default' : 'ghost'}
              className="h-6 px-2 text-[10px] gap-1"
              onClick={() => onChangeViewTab('graph')}
              data-testid="dag-view-graph-tab"
            >
              <LayoutGrid className="w-3 h-3" />
              Graph
            </Button>
            <Button
              size="sm"
              variant={activeViewTab === 'timeline' ? 'default' : 'ghost'}
              className="h-6 px-2 text-[10px] gap-1"
              onClick={() => onChangeViewTab('timeline')}
              data-testid="dag-view-timeline-tab"
            >
              <BarChart2 className="w-3 h-3" />
              Timeline
            </Button>
          </div>
        </div>
      )}

      {/* 3. Right Cluster: Workflow Actions & CTAs */}
      <div
        data-testid="dag-toolbar-right-cluster"
        className="pointer-events-auto shrink-0 flex items-center gap-1 sm:gap-1.5 p-1.5 px-2 rounded-xl backdrop-blur-xl bg-white/85 dark:bg-slate-900/85 border border-white/30 dark:border-white/10 shadow-lg transition-all order-2 xl:order-3"
      >
        {!isReadOnly && (
          <>
            <Button
              size="sm"
              variant={showPalette ? 'default' : 'outline'}
              className="h-7 px-2 text-xs gap-1"
              onClick={onTogglePalette}
              title="Toggle Node Palette"
              aria-label="Palette"
            >
              <Plus className="w-3 h-3" />
              <span className="hidden xl:inline">Palette</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs gap-1"
              onClick={onNewBlank}
              title="Reset canvas to blank workflow (START and END only)"
              aria-label="Blank"
              data-testid="dag-new-blank-btn"
            >
              <RotateCcw className="w-3 h-3 text-muted-foreground" />
              <span className="hidden xl:inline">Blank</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs gap-1"
              onClick={onValidateDag}
              title="Run Kahn & Tarjan cycle checks and binding validation"
              aria-label="Validate DAG"
            >
              {validationErrorsCount > 0 ? (
                <AlertTriangle className="w-3 h-3 text-rose-500" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              )}
              <span className="hidden lg:inline">Validate DAG</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              onClick={onDryRun}
              title="Dry-run simulate workflow execution with mock inputs"
              aria-label="Dry Run"
              data-testid="dag-dry-run-btn"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span className="hidden lg:inline">Dry Run</span>
            </Button>

            {/* Dropdown Menu for Export / Import IR & Blank Reset */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 px-2"
                  title="Workflow IR and Graph options"
                  data-testid="dag-ir-dropdown-btn"
                >
                  <FileCode className="w-3 h-3 text-sky-500" />
                  <span>IR</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 border border-white/30 dark:border-white/10 shadow-xl"
              >
                <DropdownMenuItem onClick={onExportJson} className="text-xs gap-2 cursor-pointer">
                  <FileCode className="w-3.5 h-3.5 text-sky-500" />
                  <span>Export JSON IR</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onOpenImportDialog}
                  className="text-xs gap-2 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Import JSON IR</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onNewBlank}
                  className="text-xs gap-2 cursor-pointer"
                  data-testid="dag-new-blank-btn"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Reset to Blank DAG</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onResetInitial}
                  className="text-xs gap-2 cursor-pointer text-muted-foreground"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Initial Nodes</span>
                </DropdownMenuItem>
                {hasSelectedNodes && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onClearSelected}
                      className="text-xs gap-2 cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Selected</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 1-Click Fullscreen Toggle */}
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen'}
              data-testid="dag-fullscreen-btn"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3 h-3 text-muted-foreground" />
              ) : (
                <Maximize2 className="w-3 h-3 text-muted-foreground" />
              )}
            </Button>

            <div className="h-3.5 w-[1px] bg-border/50 mx-0.5" />

            {/* Primary Save CTA */}
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs gap-1 bg-primary text-primary-foreground shadow-sm disabled:opacity-50"
              onClick={onSave}
              disabled={isSaving || validationErrorsCount > 0}
              title={
                validationErrorsCount > 0
                  ? `Cannot save: ${validationErrorsCount} DAG topology issue(s)`
                  : 'Save workflow definition to backend catalog'
              }
              data-testid="dag-save-btn"
              aria-label="Save DAG"
            >
              <Save className="w-3 h-3" />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
              <span className="hidden sm:inline">{!isSaving && ' DAG'}</span>
            </Button>
          </>
        )}

        {/* Read-Only Exit / Fullscreen Actions */}
        {isReadOnly && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen'}
              data-testid="dag-fullscreen-btn"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3 h-3 text-muted-foreground" />
              ) : (
                <Maximize2 className="w-3 h-3 text-muted-foreground" />
              )}
            </Button>

            {onCloseExecution && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCloseExecution}>
                Exit View
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
