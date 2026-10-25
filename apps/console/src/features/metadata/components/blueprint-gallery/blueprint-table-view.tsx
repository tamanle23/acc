import React, { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
} from '@tanstack/react-table';
import type { BlueprintSummaryDto } from '../../api/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table/data-table';
import {
  Truck,
  Newspaper,
  Briefcase,
  Layers,
  HeartPulse,
  Home,
  ArrowRight,
  Eye,
} from 'lucide-react';

interface BlueprintTableViewProps {
  blueprints: BlueprintSummaryDto[];
  onPreview: (id: string) => void;
  onSelect: (id: string) => void;
  isImporting?: boolean;
}

const iconMap: Record<string, any> = {
  Truck,
  Newspaper,
  Briefcase,
  Layers,
  HeartPulse,
  Home,
};

export const BlueprintTableView: React.FC<BlueprintTableViewProps> = ({
  blueprints,
  onPreview,
  onSelect,
  isImporting = false,
}) => {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'name', desc: false },
  ]);

  const columns = useMemo<ColumnDef<BlueprintSummaryDto>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Template & Name',
        cell: ({ row }) => {
          const bp = row.original;
          const IconComponent = iconMap[bp.icon] || Layers;
          return (
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                <IconComponent className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {bp.name}
                </div>
                <code className="text-[10px] font-mono text-muted-foreground">
                  {bp.id}
                </code>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10px] font-medium px-2 py-0.5 whitespace-nowrap">
            {row.original.category}
          </Badge>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        enableSorting: false,
        cell: ({ row }) => (
          <p className="line-clamp-2 text-muted-foreground text-xs max-w-xs" title={row.original.description}>
            {row.original.description}
          </p>
        ),
      },
      {
        accessorKey: 'entityTypesCount',
        header: () => <div className="text-center">Models</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0.5">
              {row.original.entityTypesCount}
            </Badge>
          </div>
        ),
      },
      {
        accessorKey: 'relationshipTypesCount',
        header: () => <div className="text-center">Edges</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5">
              {row.original.relationshipTypesCount}
            </Badge>
          </div>
        ),
      },
      {
        id: 'actions',
        header: () => <div className="text-right pr-4">Actions</div>,
        enableSorting: false,
        cell: ({ row }) => {
          const bp = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5 pr-4" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onPreview(bp.id)}
                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/5"
                title="Preview Blueprint Graph"
              >
                <Eye className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">Preview</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onSelect(bp.id)}
                disabled={isImporting}
                className="h-7 px-2.5 text-xs gap-1 font-semibold bg-primary/90 hover:bg-primary text-primary-foreground shadow-xs"
              >
                <span>Use</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          );
        },
      },
    ],
    [isImporting, onPreview, onSelect]
  );

  const table = useReactTable({
    data: blueprints,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <DataTable
      showRowIndex
      table={table}
      noResultsMessage="No blueprints available in gallery."
    />
  );
};
