import React, { useState } from 'react';
import { useEntityTypes } from '../../../api/metadata-api';
import type { EntityType } from '../../../api/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Link2, GitMerge, Layers } from 'lucide-react';

interface Props {
  rootEntityTypeId: string | number;
  onAddChildNode: (targetEntity: EntityType, pattern: 'PATTERN_B_FOREIGN_KEY' | 'PATTERN_C_ASSOCIATION') => void;
  disabled?: boolean;
}

export const CompositeCatalogRail: React.FC<Props> = ({
  rootEntityTypeId,
  onAddChildNode,
  disabled = false,
}) => {
  const { data: entityTypesResponse, isLoading } = useEntityTypes({ size: 100 });
  const [searchQuery, setSearchQuery] = useState('');
  const [activePatternTab, setActivePatternTab] = useState<'all' | 'pattern_b' | 'pattern_c'>('all');

  const allEntities = entityTypesResponse?.content || [];
  // Filter out the current entity type and other virtual composite entities from being joined as root
  const baseEntities = allEntities.filter(
    (e) => !e.isComposite && String(e.id) !== String(rootEntityTypeId)
  );

  const filteredEntities = baseEntities.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.systemName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="flex flex-col h-[750px] rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-border/50">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <Layers className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Base Entity Catalog
          </h3>
          <p className="text-[11px] text-muted-foreground">Join targets for composite synthesis</p>
        </div>
      </div>

      {/* Pattern Filter Tabs */}
      <div className="grid grid-cols-3 gap-1 my-3 p-1 rounded-xl bg-slate-100/70 dark:bg-slate-800/70 border border-border/30 text-xs">
        <button
          type="button"
          onClick={() => setActivePatternTab('all')}
          className={`py-1 rounded-lg text-center font-medium transition-all ${
            activePatternTab === 'all'
              ? 'bg-white dark:bg-slate-700 text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setActivePatternTab('pattern_b')}
          className={`py-1 rounded-lg text-center font-medium flex items-center justify-center gap-1 transition-all ${
            activePatternTab === 'pattern_b'
              ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Link2 className="h-3 w-3" />
          <span>Pattern B</span>
        </button>
        <button
          type="button"
          onClick={() => setActivePatternTab('pattern_c')}
          className={`py-1 rounded-lg text-center font-medium flex items-center justify-center gap-1 transition-all ${
            activePatternTab === 'pattern_c'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <GitMerge className="h-3 w-3" />
          <span>Pattern C</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Filter base entities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 pl-8 text-xs bg-white/40 dark:bg-slate-800/40 border-border/50 rounded-xl"
        />
      </div>

      {/* Entity List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {isLoading ? (
          <div className="text-center py-8 text-xs text-muted-foreground">Loading catalog...</div>
        ) : filteredEntities.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No base entity types available.
          </div>
        ) : (
          filteredEntities.map((entity) => (
            <div
              key={entity.id}
              className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-white/60 dark:border-white/5 hover:border-sky-500/30 transition-all hover:shadow-xs group flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-1">
                <div>
                  <h4 className="text-xs font-semibold text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    {entity.name}
                  </h4>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {entity.systemName}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[9px] font-mono px-1 py-0 bg-slate-100/50 dark:bg-slate-800/50"
                >
                  v{entity.schemaVersion || 1}
                </Badge>
              </div>

              {/* Action Buttons for Patterns */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border/30">
                {(activePatternTab === 'all' || activePatternTab === 'pattern_b') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => onAddChildNode(entity, 'PATTERN_B_FOREIGN_KEY')}
                    className="h-7 text-[10px] px-2 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 flex items-center justify-center gap-1"
                    title="Add as Direct 1:1 / N:1 Foreign Key Join (Pattern B)"
                  >
                    <Link2 className="h-3 w-3" />
                    <span>🔗 FK Join</span>
                  </Button>
                )}
                {(activePatternTab === 'all' || activePatternTab === 'pattern_c') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => onAddChildNode(entity, 'PATTERN_C_ASSOCIATION')}
                    className="h-7 text-[10px] px-2 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 flex items-center justify-center gap-1"
                    title="Add as Association Engine N:M / 1:N Hierarchy (Pattern C)"
                  >
                    <GitMerge className="h-3 w-3" />
                    <span>ᛦ Assoc</span>
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
