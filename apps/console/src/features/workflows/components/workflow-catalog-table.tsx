import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  SlidersHorizontal,
  Trash2,
  Power,
  Workflow,
  Search,
  Plus,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  type WorkflowDefinitionSummary,
  useToggleWorkflowStatus,
  useDeleteWorkflowDefinition,
} from '../api/workflow-api';

interface WorkflowCatalogTableProps {
  definitions: WorkflowDefinitionSummary[];
  isLoading: boolean;
  onDesignWorkflow: (workflowKey: string) => void;
  onCreateNew: () => void;
}

export const WorkflowCatalogTable: React.FC<WorkflowCatalogTableProps> = ({
  definitions,
  isLoading,
  onDesignWorkflow,
  onCreateNew,
}) => {
  const [search, setSearch] = useState('');
  const toggleMutation = useToggleWorkflowStatus();
  const deleteMutation = useDeleteWorkflowDefinition();

  const filtered = definitions.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.workflowKey.toLowerCase().includes(search.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workflows by key or name..."
            className="pl-9 h-9 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-white/20 dark:border-white/10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={onCreateNew} size="sm" className="h-9 gap-1 shadow-md shadow-primary/20">
            <Plus className="h-4 w-4" />
            Create Workflow
          </Button>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="rounded-2xl border border-white/30 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40 backdrop-blur-md">
            <TableRow>
              <TableHead className="w-[280px]">Workflow</TableHead>
              <TableHead className="w-[120px]">Version</TableHead>
              <TableHead className="w-[120px]">Nodes</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[160px]">Last Updated</TableHead>
              <TableHead className="text-right w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                  Loading workflow definitions...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Workflow className="h-8 w-8 text-muted-foreground/50" />
                    <span>No workflow definitions found</span>
                    <Button variant="outline" size="sm" onClick={onCreateNew}>
                      Create your first workflow
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => {
                const nodeCount = item.tasks ? item.tasks.length : Object.keys(item.layoutMetadata || {}).length;
                const isActive = item.status !== 'DISABLED';

                return (
                  <TableRow key={item.workflowKey} className="hover:bg-white/40 dark:hover:bg-slate-800/40">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          {item.name}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">{item.workflowKey}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground truncate max-w-[260px]">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        v{item.version || 1}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-foreground">{nodeCount} nodes</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20'
                        }
                      >
                        {isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.updatedAt || 'Recently'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1 text-primary hover:text-primary"
                          onClick={() => onDesignWorkflow(item.workflowKey)}
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                          Design
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onDesignWorkflow(item.workflowKey)}>
                              <SlidersHorizontal className="h-4 w-4 mr-2" />
                              Open in Studio
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                toggleMutation.mutate({
                                  workflowKey: item.workflowKey,
                                  status: isActive ? 'DISABLED' : 'ACTIVE',
                                })
                              }
                            >
                              <Power className="h-4 w-4 mr-2" />
                              {isActive ? 'Disable Workflow' : 'Enable Workflow'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => deleteMutation.mutate(item.workflowKey)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
