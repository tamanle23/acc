import React from 'react';
import type { CompositeSpec, CompositeRollup, AggregateFunction } from '../../../../api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calculator, Plus, Trash2, Sigma, Hash, ChevronRight } from 'lucide-react';

interface Props {
  spec: CompositeSpec;
  onUpdateSpec: (updated: CompositeSpec) => void;
}

export const CompositeRollupBuilder: React.FC<Props> = ({ spec, onUpdateSpec }) => {
  const rollups = spec.rollups || [];
  const availableChildren = spec.children || [];

  const handleAddRollup = () => {
    const defaultTarget = availableChildren[0]?.alias || availableChildren[0]?.target_entity_system_name || 'child';
    const newRollup: CompositeRollup = {
      alias: `rollup_${rollups.length + 1}`,
      target_node_alias: defaultTarget,
      aggregate_function: 'COUNT',
      target_field: '',
      filter_predicate: '',
    };
    onUpdateSpec({
      ...spec,
      rollups: [...rollups, newRollup],
    });
  };

  const handleUpdateRollup = (index: number, updated: CompositeRollup) => {
    const next = [...rollups];
    next[index] = updated;
    onUpdateSpec({
      ...spec,
      rollups: next,
    });
  };

  const handleRemoveRollup = (index: number) => {
    onUpdateSpec({
      ...spec,
      rollups: rollups.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="mt-4 rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Sigma className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              Computed Aggregate Rollups
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-indigo-400/40 text-indigo-600 dark:text-indigo-400">
                {rollups.length}
              </Badge>
            </h4>
            <p className="text-[10px] text-muted-foreground">
              Unpaginated companion lateral aggregates computed live across the entire child dataset
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleAddRollup}
          disabled={availableChildren.length === 0}
          className="h-7 text-xs gap-1 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/50"
        >
          <Plus className="h-3 w-3" />
          Add Rollup
        </Button>
      </div>

      {availableChildren.length === 0 && (
        <div className="p-3 text-center rounded-lg border border-dashed border-muted text-xs text-muted-foreground">
          Join at least one child collection (Pattern B or C) to configure aggregate rollups.
        </div>
      )}

      {rollups.length === 0 && availableChildren.length > 0 && (
        <div className="p-3 text-center rounded-lg border border-dashed border-border/40 text-xs text-muted-foreground">
          No computed rollups defined. Click &quot;Add Rollup&quot; to calculate totals, counts, or averages across child collections.
        </div>
      )}

      {rollups.length > 0 && (
        <div className="space-y-2.5">
          {rollups.map((rollup, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border border-border/30 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs grid grid-cols-1 md:grid-cols-12 gap-2 items-center text-xs"
            >
              {/* Alias */}
              <div className="md:col-span-3">
                <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Rollup Alias</label>
                <Input
                  value={rollup.alias}
                  onChange={(e) => handleUpdateRollup(idx, { ...rollup, alias: e.target.value })}
                  placeholder="e.g. total_spent"
                  className="h-7 text-xs bg-white/80 dark:bg-slate-800/80"
                />
              </div>

              {/* Target Collection */}
              <div className="md:col-span-3">
                <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Target Collection</label>
                <select
                  value={rollup.target_node_alias}
                  onChange={(e) => handleUpdateRollup(idx, { ...rollup, target_node_alias: e.target.value })}
                  className="h-7 w-full text-xs rounded-md border border-input bg-white/80 dark:bg-slate-800/80 px-2 text-foreground"
                >
                  {availableChildren.map((child, cIdx) => {
                    const cAlias = child.alias || child.target_entity_system_name;
                    return (
                      <option key={cIdx} value={cAlias}>
                        {cAlias} ({child.join_pattern === 'PATTERN_B_FOREIGN_KEY' ? '🔗 Pattern B' : 'ᛦ Pattern C'})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Aggregate Function */}
              <div className="md:col-span-2">
                <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Function</label>
                <select
                  value={rollup.aggregate_function}
                  onChange={(e) =>
                    handleUpdateRollup(idx, { ...rollup, aggregate_function: e.target.value as AggregateFunction })
                  }
                  className="h-7 w-full text-xs rounded-md border border-input bg-white/80 dark:bg-slate-800/80 px-2 text-foreground font-mono"
                >
                  <option value="COUNT">COUNT(*)</option>
                  <option value="SUM">SUM(...)</option>
                  <option value="AVG">AVG(...)</option>
                  <option value="MIN">MIN(...)</option>
                  <option value="MAX">MAX(...)</option>
                </select>
              </div>

              {/* Target Field */}
              <div className="md:col-span-3">
                <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">
                  Target Field {rollup.aggregate_function === 'COUNT' ? '(Optional)' : '(Required)'}
                </label>
                <Input
                  value={rollup.target_field || ''}
                  onChange={(e) => handleUpdateRollup(idx, { ...rollup, target_field: e.target.value })}
                  placeholder={rollup.aggregate_function === 'COUNT' ? 'id / *' : 'e.g. total_amount'}
                  className="h-7 text-xs bg-white/80 dark:bg-slate-800/80"
                />
              </div>

              {/* Actions */}
              <div className="md:col-span-1 flex items-end justify-end">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleRemoveRollup(idx)}
                  className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                  title="Remove Rollup"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
