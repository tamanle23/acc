import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import type { AttributeDefinition } from '../../api/types';
import type { AttributeFilterClause } from '../../store/use-metadata-ui-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Filter,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  FolderPlus,
  Check,
  RotateCcw,
} from 'lucide-react';

export type LogicalOperator = 'AND' | 'OR' | 'NOT';

export type ConditionOperator =
  // Text
  | 'equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'is_empty'
  | 'regex'
  // Number
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  // Date/Timestamp
  | 'is_today'
  | 'in_last_n_days'
  | 'before'
  | 'after'
  // Select/Enum
  | 'one_of'
  | 'none_of'
  // Relation
  | 'linked_to'
  | 'not_linked';

export interface QueryRule {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: string;
  secondaryValue?: string;
}

export interface QueryGroup {
  id: string;
  logicalOp: LogicalOperator;
  rules: (QueryRule | QueryGroup)[];
}

export interface DynamicQueryBuilderProps {
  attributes: AttributeDefinition[];
  initialGroup?: QueryGroup;
  legacyFilters?: AttributeFilterClause[];
  onApplyQuery?: (group: QueryGroup, legacyClauses: AttributeFilterClause[]) => void;
  className?: string;
}

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'equals (=)',
  contains: 'contains',
  starts_with: 'starts with',
  ends_with: 'ends with',
  in: 'in list (comma sep)',
  is_empty: 'is empty / null',
  regex: 'regex match',
  eq: 'equals (=)',
  ne: 'not equals (≠)',
  gt: 'greater than (>)',
  gte: 'greater or equal (≥)',
  lt: 'less than (<)',
  lte: 'less or equal (≤)',
  between: 'between',
  is_today: 'is today',
  in_last_n_days: 'in last N days',
  before: 'before date',
  after: 'after date',
  one_of: 'is one of',
  none_of: 'is none of',
  linked_to: 'linked to record',
  not_linked: 'not linked',
};

export function getOperatorsForDataType(dataType?: string): ConditionOperator[] {
  const dt = (dataType || 'string').toLowerCase();
  if (dt === 'number' || dt === 'decimal' || dt === 'integer') {
    return ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between'];
  }
  if (dt === 'date' || dt === 'timestamp' || dt === 'datetime') {
    return ['is_today', 'in_last_n_days', 'before', 'after', 'between', 'is_empty'];
  }
  if (dt === 'select' || dt === 'enum' || dt === 'multiselect') {
    return ['one_of', 'none_of', 'equals', 'is_empty'];
  }
  if (dt === 'relation' || dt === 'relation_picker') {
    return ['linked_to', 'not_linked', 'is_empty'];
  }
  return ['equals', 'contains', 'starts_with', 'ends_with', 'in', 'is_empty', 'regex'];
}

export function toLegacyClause(rule: QueryRule): AttributeFilterClause {
  let op: AttributeFilterClause['operator'] = 'eq';
  if (['equals', 'eq', 'one_of', 'linked_to', 'is_today'].includes(rule.operator)) op = 'eq';
  else if (['ne', 'none_of', 'not_linked'].includes(rule.operator)) op = 'ne';
  else if (['contains', 'starts_with', 'ends_with', 'regex'].includes(rule.operator)) op = 'contains';
  else if (['gt', 'after'].includes(rule.operator)) op = 'gt';
  else if (['gte'].includes(rule.operator)) op = 'gte';
  else if (['lt', 'before'].includes(rule.operator)) op = 'lt';
  else if (['lte'].includes(rule.operator)) op = 'lte';
  else if (['in'].includes(rule.operator)) op = 'in';

  return {
    id: rule.id,
    field: rule.field,
    operator: op,
    value: rule.value,
  };
}

export function flattenToLegacyClauses(group: QueryGroup): AttributeFilterClause[] {
  const result: AttributeFilterClause[] = [];
  for (const item of group.rules) {
    if ('logicalOp' in item) {
      result.push(...flattenToLegacyClauses(item as QueryGroup));
    } else {
      result.push(toLegacyClause(item as QueryRule));
    }
  }
  return result;
}

export const DynamicQueryBuilder: React.FC<DynamicQueryBuilderProps> = ({
  attributes,
  initialGroup,
  legacyFilters,
  onApplyQuery,
  className,
}) => {
  const [open, setOpen] = useState(false);

  const filterableAttributes = React.useMemo(() => {
    return attributes.filter((a) => !a.isArchived);
  }, [attributes]);

  const defaultField = filterableAttributes[0]?.systemName || 'id';

  const [rootGroup, setRootGroup] = useState<QueryGroup>(() => {
    if (initialGroup) return initialGroup;
    if (legacyFilters && legacyFilters.length > 0) {
      return {
        id: 'root-group',
        logicalOp: 'AND',
        rules: legacyFilters.map((f) => ({
          id: f.id,
          field: f.field,
          operator: (f.operator === 'eq' ? 'equals' : f.operator) as ConditionOperator,
          value: f.value,
        })),
      };
    }
    return {
      id: 'root-group',
      logicalOp: 'AND',
      rules: [],
    };
  });

  const handleAddRuleToGroup = (targetGroup: QueryGroup): QueryGroup => {
    const newRule: QueryRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      field: defaultField,
      operator: getOperatorsForDataType(filterableAttributes[0]?.dataType)[0] || 'equals',
      value: '',
    };
    return {
      ...targetGroup,
      rules: [...targetGroup.rules, newRule],
    };
  };

  const handleAddSubGroup = (targetGroup: QueryGroup): QueryGroup => {
    const newSubGroup: QueryGroup = {
      id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      logicalOp: 'OR',
      rules: [
        {
          id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          field: defaultField,
          operator: 'equals',
          value: '',
        },
      ],
    };
    return {
      ...targetGroup,
      rules: [...targetGroup.rules, newSubGroup],
    };
  };

  const handleRemoveItem = (targetGroup: QueryGroup, id: string): QueryGroup => {
    const updatedRules: (QueryRule | QueryGroup)[] = [];
    for (const rule of targetGroup.rules) {
      if (rule.id === id) continue;
      if ('logicalOp' in rule) {
        updatedRules.push(handleRemoveItem(rule as QueryGroup, id));
      } else {
        updatedRules.push(rule);
      }
    }
    return { ...targetGroup, rules: updatedRules };
  };

  const handleUpdateRuleInTree = (
    targetGroup: QueryGroup,
    ruleId: string,
    updates: Partial<QueryRule>
  ): QueryGroup => {
    const updatedRules = targetGroup.rules.map((item) => {
      if ('logicalOp' in item) {
        return handleUpdateRuleInTree(item as QueryGroup, ruleId, updates);
      }
      if (item.id === ruleId) {
        const next = { ...item, ...updates };
        if (updates.field && updates.field !== item.field) {
          const attr = filterableAttributes.find((a) => a.systemName === updates.field);
          next.operator = getOperatorsForDataType(attr?.dataType)[0] || 'equals';
          next.value = '';
        }
        return next;
      }
      return item;
    });
    return { ...targetGroup, rules: updatedRules };
  };

  const handleUpdateLogicalOp = (
    targetGroup: QueryGroup,
    groupId: string,
    op: LogicalOperator
  ): QueryGroup => {
    if (targetGroup.id === groupId) {
      return { ...targetGroup, logicalOp: op };
    }
    return {
      ...targetGroup,
      rules: targetGroup.rules.map((r) =>
        'logicalOp' in r ? handleUpdateLogicalOp(r as QueryGroup, groupId, op) : r
      ),
    };
  };

  const handleApply = () => {
    const legacy = flattenToLegacyClauses(rootGroup);
    onApplyQuery?.(rootGroup, legacy);
    setOpen(false);
  };

  const handleClear = () => {
    const cleared: QueryGroup = { id: 'root-group', logicalOp: 'AND', rules: [] };
    setRootGroup(cleared);
    onApplyQuery?.(cleared, []);
    setOpen(false);
  };

  const countTotalRules = (group: QueryGroup): number => {
    let count = 0;
    for (const r of group.rules) {
      if ('logicalOp' in r) count += countTotalRules(r as QueryGroup);
      else count += 1;
    }
    return count;
  };

  const activeCount = countTotalRules(rootGroup);

  const renderGroup = (group: QueryGroup, isRoot = false) => {
    return (
      <div
        key={group.id}
        className={cn(
          'flex flex-col gap-2.5 p-3 rounded-xl transition-all',
          isRoot
            ? 'bg-transparent'
            : 'border border-primary/20 bg-muted/20 backdrop-blur-md shadow-xs'
        )}
      >
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Match
            </span>
            <div className="inline-flex rounded-lg border border-border/60 bg-background/50 p-0.5 text-xs">
              {(['AND', 'OR', 'NOT'] as LogicalOperator[]).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setRootGroup((prev) => handleUpdateLogicalOp(prev, group.id, op))}
                  className={cn(
                    'px-2 py-0.5 rounded-md font-medium transition-colors',
                    group.logicalOp === op
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {op}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">conditions</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (isRoot) setRootGroup((prev) => handleAddRuleToGroup(prev));
                else {
                  setRootGroup((prev) => {
                    const updateTree = (g: QueryGroup): QueryGroup => {
                      if (g.id === group.id) return handleAddRuleToGroup(g);
                      return {
                        ...g,
                        rules: g.rules.map((r) => ('logicalOp' in r ? updateTree(r as QueryGroup) : r)),
                      };
                    };
                    return updateTree(prev);
                  });
                }
              }}
              className="h-7 px-2 text-xs gap-1"
            >
              <Plus className="size-3" /> Rule
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (isRoot) setRootGroup((prev) => handleAddSubGroup(prev));
                else {
                  setRootGroup((prev) => {
                    const updateTree = (g: QueryGroup): QueryGroup => {
                      if (g.id === group.id) return handleAddSubGroup(g);
                      return {
                        ...g,
                        rules: g.rules.map((r) => ('logicalOp' in r ? updateTree(r as QueryGroup) : r)),
                      };
                    };
                    return updateTree(prev);
                  });
                }
              }}
              className="h-7 px-2 text-xs gap-1"
            >
              <FolderPlus className="size-3" /> Group
            </Button>
            {!isRoot && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setRootGroup((prev) => handleRemoveItem(prev, group.id))}
                className="h-7 w-7 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        </div>

        {group.rules.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            No query conditions in this group. Click &ldquo;+ Rule&rdquo; to add one.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {group.rules.map((item) => {
              if ('logicalOp' in item) {
                return renderGroup(item as QueryGroup, false);
              }
              const rule = item as QueryRule;
              const attr = filterableAttributes.find((a) => a.systemName === rule.field);
              const validOps = getOperatorsForDataType(attr?.dataType);

              return (
                <div
                  key={rule.id}
                  className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/60 p-2 shadow-xs"
                >
                  {/* Field Select */}
                  <Select
                    value={rule.field}
                    onValueChange={(val) =>
                      setRootGroup((prev) => handleUpdateRuleInTree(prev, rule.id, { field: val }))
                    }
                  >
                    <SelectTrigger className="w-40 h-8 text-xs bg-background/80">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {filterableAttributes.map((a) => (
                        <SelectItem key={a.systemName} value={a.systemName} className="text-xs">
                          {a.name || a.systemName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator Select */}
                  <Select
                    value={rule.operator}
                    onValueChange={(val) =>
                      setRootGroup((prev) =>
                        handleUpdateRuleInTree(prev, rule.id, {
                          operator: val as ConditionOperator,
                        })
                      )
                    }
                  >
                    <SelectTrigger className="w-40 h-8 text-xs bg-background/80">
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {validOps.map((op) => (
                        <SelectItem key={op} value={op} className="text-xs">
                          {OPERATOR_LABELS[op] || op}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value Input */}
                  {rule.operator !== 'is_empty' && (
                    <Input
                      value={rule.value}
                      placeholder="Value..."
                      onChange={(e) =>
                        setRootGroup((prev) =>
                          handleUpdateRuleInTree(prev, rule.id, { value: e.target.value })
                        )
                      }
                      className="h-8 text-xs flex-1 bg-background/80"
                    />
                  )}

                  {rule.operator === 'between' && (
                    <Input
                      value={rule.secondaryValue || ''}
                      placeholder="To..."
                      onChange={(e) =>
                        setRootGroup((prev) =>
                          handleUpdateRuleInTree(prev, rule.id, { secondaryValue: e.target.value })
                        )
                      }
                      className="h-8 text-xs w-28 bg-background/80"
                    />
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setRootGroup((prev) => handleRemoveItem(prev, rule.id))}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 gap-2 border-dashed transition-all',
            activeCount > 0
              ? 'border-primary/50 bg-primary/10 text-primary font-medium'
              : 'border-border/60 hover:bg-muted/50',
            className
          )}
        >
          <Filter className="size-3.5 text-primary" />
          <span>Query Builder</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] rounded-full">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[620px] max-w-[95vw] p-4 rounded-2xl border border-white/20 dark:border-white/10 bg-white/85 dark:bg-slate-900/90 backdrop-blur-2xl shadow-2xl flex flex-col gap-3"
      >
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="font-semibold text-sm">Dynamic Multi-Condition Query Builder</span>
          </div>
          <Badge variant="outline" className="text-[11px] font-mono">
            {activeCount} condition{activeCount !== 1 ? 's' : ''}
          </Badge>
        </div>

        <div className="max-h-[420px] overflow-y-auto pr-1">
          {renderGroup(rootGroup, true)}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs h-8 gap-1 text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="size-3" /> Reset All
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
            >
              <Check className="size-3.5" /> Apply Criteria
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
