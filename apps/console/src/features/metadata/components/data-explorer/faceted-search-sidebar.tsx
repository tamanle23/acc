import React from 'react';
import type { AttributeDefinition, EntityRecord, EntityFacetsResponse } from '../../api/types';
import type { AttributeFilterClause } from '../../store/use-metadata-ui-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Tag,
  Layers,
  ToggleLeft,
  CheckCircle2,
  Hash,
  Calendar,
  Search,
  X,
} from 'lucide-react';

interface FacetedSearchSidebarProps {
  attributes: AttributeDefinition[];
  records: EntityRecord[];
  activeFilters: AttributeFilterClause[];
  onFilterChange: (filters: AttributeFilterClause[]) => void;
  serverFacets?: EntityFacetsResponse | null;
  className?: string;
  onClose?: () => void;
}

interface FacetBucket {
  value: string;
  label: string;
  count: number;
  operator?: 'eq' | 'gte' | 'lte' | 'gt' | 'lt';
  minVal?: string;
  maxVal?: string;
}

interface FacetGroup {
  field: string;
  name: string;
  dataType: string;
  type: 'discrete' | 'numeric_range' | 'date_range';
  buckets: FacetBucket[];
}

export const FacetedSearchSidebar: React.FC<FacetedSearchSidebarProps> = ({
  attributes,
  records,
  activeFilters,
  onFilterChange,
  serverFacets,
  className = '',
  onClose,
}) => {
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});
  const [groupSearchQuery, setGroupSearchQuery] = React.useState<Record<string, string>>({});

  const toggleGroupCollapse = (field: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const toggleGroupExpand = (field: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  // Discover and compute facets for ALL supported data types (leveraging serverFacets if available, otherwise local records)
  const facetGroups: FacetGroup[] = React.useMemo(() => {
    const activeAttrs = attributes.filter((a) => !a.isArchived);
    const groups: FacetGroup[] = [];

    // Helper map of server-side facet counts
    const serverFacetMap = new Map<string, Record<string, number>>();
    if (serverFacets?.facets) {
      serverFacets.facets.forEach((g) => {
        const counts: Record<string, number> = {};
        g.buckets.forEach((b) => {
          counts[b.value] = b.count;
        });
        serverFacetMap.set(g.field, counts);
      });
    }

    // Process all entity schema attributes by data type
    activeAttrs.forEach((attr) => {
      const field = attr.systemName;
      const dataType = attr.dataType;

      // A. NUMERIC FIELDS (INTEGER, DECIMAL) -> Smart Range Buckets
      if (dataType === 'INTEGER' || dataType === 'DECIMAL' || attr.uiComponent === 'number') {
        const nums: number[] = [];
        records.forEach((r) => {
          const raw = r.attributes?.[field];
          if (raw !== undefined && raw !== null && raw !== '') {
            const n = Number(raw);
            if (!isNaN(n)) nums.push(n);
          }
        });

        if (nums.length > 0) {
          const min = Math.min(...nums);
          const max = Math.max(...nums);

          // If min and max differ, build range buckets
          if (max > min) {
            const range = max - min;
            const step = Math.ceil(range / 3);
            const b1End = min + step;
            const b2End = min + step * 2;

            // Optimization: Single pass over nums array instead of 3 separate .filter() passes
            let b1 = 0;
            let b2 = 0;
            let b3 = 0;
            for (const n of nums) {
              if (n <= b1End) b1++;
              else if (n <= b2End) b2++;
              else b3++;
            }

            groups.push({
              field,
              name: attr.name,
              dataType,
              type: 'numeric_range',
              buckets: [
                {
                  value: `${min}..${b1End}`,
                  label: `${min} – ${b1End}`,
                  count: b1,
                  minVal: String(min),
                  maxVal: String(b1End),
                },
                {
                  value: `${b1End + 1}..${b2End}`,
                  label: `${b1End + 1} – ${b2End}`,
                  count: b2,
                  minVal: String(b1End + 1),
                  maxVal: String(b2End),
                },
                {
                  value: `>${b2End}`,
                  label: `> ${b2End}`,
                  count: b3,
                  minVal: String(b2End + 1),
                },
              ].filter((b) => b.count > 0),
            });
            return;
          }
        }
      }

      // B. DATE & DATETIME FIELDS -> Recency & Interval Buckets
      if (dataType === 'DATE' || dataType === 'DATETIME' || attr.uiComponent === 'datepicker') {
        const dates: Date[] = [];
        records.forEach((r) => {
          const raw = r.attributes?.[field];
          if (raw !== undefined && raw !== null && raw !== '') {
            const d = new Date(raw as string | number);
            if (!isNaN(d.getTime())) dates.push(d);
          }
        });

        if (dates.length > 0) {
          const now = Date.now();
          const d30 = 30 * 24 * 60 * 60 * 1000;
          const d90 = 90 * 24 * 60 * 60 * 1000;
          const d365 = 365 * 24 * 60 * 60 * 1000;

          // Optimization: Single pass over dates array instead of 4 separate .filter() passes
          let recent = 0;
          let quarterly = 0;
          let thisYear = 0;
          let older = 0;
          for (const d of dates) {
            const age = now - d.getTime();
            if (age <= d30) recent++;
            else if (age <= d90) quarterly++;
            else if (age <= d365) thisYear++;
            else older++;
          }

          const dateBuckets: FacetBucket[] = [
            { value: 'last_30_days', label: 'Last 30 Days', count: recent },
            { value: 'last_90_days', label: '1 – 3 Months Ago', count: quarterly },
            { value: 'last_year', label: '3 – 12 Months Ago', count: thisYear },
            { value: 'older_than_year', label: 'Older than 1 Year', count: older },
          ].filter((b) => b.count > 0);

          if (dateBuckets.length > 0) {
            groups.push({
              field,
              name: attr.name,
              dataType,
              type: 'date_range',
              buckets: dateBuckets,
            });
            return;
          }
        }
      }

      // C. CATEGORICAL, BOOLEAN, ENUM, RELATION, & AUTO-DETECTED LOW-CARDINALITY STRINGS
      const predefinedChoices = (attr.options?.choices as string[]) || [];
      const serverCounts = serverFacetMap.get(field);
      const counts: Record<string, number> = {};

      if (serverCounts) {
        // Use global server-aggregated counts directly
        Object.assign(counts, serverCounts);
        predefinedChoices.forEach((c) => {
          if (counts[String(c)] === undefined) counts[String(c)] = 0;
        });
      } else {
        predefinedChoices.forEach((c) => {
          counts[String(c)] = 0;
        });

        records.forEach((r) => {
          const val = r.attributes?.[field];
          if (val !== undefined && val !== null && val !== '') {
            const strVal = String(val);
            counts[strVal] = (counts[strVal] || 0) + 1;
          }
        });
      }

      const distinctKeys = Object.keys(counts);

      // Include if it's explicitly selectable, boolean, relation, or auto-detected low cardinality (<= 10 distinct values)
      const isSelectable =
        dataType === 'BOOLEAN' ||
        dataType === 'RELATIONSHIP' ||
        attr.uiComponent === 'select' ||
        attr.uiComponent === 'multiselect' ||
        attr.uiComponent === 'switch' ||
        attr.uiComponent === 'relation_picker' ||
        predefinedChoices.length > 0;

      const isLowCardinalityString =
        dataType === 'STRING' && distinctKeys.length >= 1 && distinctKeys.length <= 10;

      if (isSelectable || isLowCardinalityString) {
        const buckets = Object.entries(counts)
          .map(([val, count]) => {
            let label = val;
            if (dataType === 'BOOLEAN') {
              const isTrue = val === 'true' || val === '1';
              label = isTrue
                ? (attr.options?.trueLabel as string) || 'Yes / Enabled'
                : (attr.options?.falseLabel as string) || 'No / Disabled';
            }

            return {
              value: val,
              label,
              count,
            };
          })
          .filter((b) => b.count > 0 || predefinedChoices.includes(b.value))
          .sort((a, b) => b.count - a.count);

        if (buckets.length > 0) {
          groups.push({
            field,
            name: attr.name,
            dataType,
            type: 'discrete',
            buckets,
          });
        }
      }
    });

    return groups;
  }, [attributes, records, serverFacets]);

  // Handle checking/unchecking any facet bucket (Discrete, Numeric Range, Date Interval)
  const handleToggleFacet = (group: FacetGroup, bucket: FacetBucket) => {
    const { field, type } = group;

    // 1. Numeric Range Facet
    if (type === 'numeric_range') {
      const existingMinIdx = activeFilters.findIndex(
        (f) => f.field === field && f.operator === 'gte' && f.value === bucket.minVal
      );

      if (existingMinIdx >= 0) {
        // Remove range filters for this field
        const updated = activeFilters.filter((f) => f.field !== field);
        onFilterChange(updated);
      } else {
        const newFilters: AttributeFilterClause[] = activeFilters.filter((f) => f.field !== field);
        if (bucket.minVal !== undefined) {
          newFilters.push({
            id: `facet-range-min-${field}-${bucket.value}`,
            field,
            operator: 'gte',
            value: bucket.minVal,
          });
        }
        if (bucket.maxVal !== undefined) {
          newFilters.push({
            id: `facet-range-max-${field}-${bucket.value}`,
            field,
            operator: 'lte',
            value: bucket.maxVal,
          });
        }
        onFilterChange(newFilters);
      }
      return;
    }

    // 2. Date Range Facet
    if (type === 'date_range') {
      const existingDateFilter = activeFilters.find((f) => f.id.startsWith(`facet-date-${field}-`));
      if (existingDateFilter && existingDateFilter.value === bucket.value) {
        onFilterChange(activeFilters.filter((f) => !f.id.startsWith(`facet-date-${field}-`)));
      } else {
        const cleaned = activeFilters.filter((f) => !f.id.startsWith(`facet-date-${field}-`));
        const now = Date.now();
        const d = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const dateClauses: AttributeFilterClause[] = [];
        if (bucket.value === 'last_30_days') {
          dateClauses.push({
            id: `facet-date-${field}-${bucket.value}`,
            field,
            operator: 'gte',
            value: d(30),
          });
        } else if (bucket.value === 'last_90_days') {
          dateClauses.push(
            { id: `facet-date-${field}-min`, field, operator: 'gte', value: d(90) },
            { id: `facet-date-${field}-${bucket.value}`, field, operator: 'lte', value: d(30) }
          );
        } else if (bucket.value === 'last_year') {
          dateClauses.push(
            { id: `facet-date-${field}-min`, field, operator: 'gte', value: d(365) },
            { id: `facet-date-${field}-${bucket.value}`, field, operator: 'lte', value: d(90) }
          );
        } else if (bucket.value === 'older_than_year') {
          dateClauses.push({
            id: `facet-date-${field}-${bucket.value}`,
            field,
            operator: 'lt',
            value: d(365),
          });
        }

        onFilterChange([...cleaned, ...dateClauses]);
      }
      return;
    }

    // 3. Discrete (eq) Facet
    const existingIndex = activeFilters.findIndex(
      (f) => f.field === field && f.operator === 'eq' && f.value === bucket.value
    );

    if (existingIndex >= 0) {
      const updated = activeFilters.filter((_, idx) => idx !== existingIndex);
      onFilterChange(updated);
    } else {
      const newFilter: AttributeFilterClause = {
        id: `facet-${field}-${bucket.value}-${Date.now()}`,
        field,
        operator: 'eq',
        value: bucket.value,
      };
      onFilterChange([...activeFilters, newFilter]);
    }
  };

  const handleResetFacets = () => {
    onFilterChange([]);
  };

  const activeFacetCount = activeFilters.length;

  // Optimization: Pre-index active filters into O(1) Set lookup maps to avoid nested O(F) array scans during option rendering
  const activeFilterLookup = React.useMemo(() => {
    const minRanges = new Set<string>(); // field:minVal
    const dateValues = new Set<string>(); // field:value
    const eqValues = new Set<string>(); // field:value
    const fieldsWithFilters = new Set<string>();

    for (const f of activeFilters) {
      if (f.field) fieldsWithFilters.add(f.field);
      if (f.operator === 'gte' && f.value !== undefined && f.value !== null) {
        minRanges.add(`${f.field}:${f.value}`);
      }
      if (f.id.startsWith(`facet-date-${f.field}-`) && f.value !== undefined && f.value !== null) {
        dateValues.add(`${f.field}:${f.value}`);
      }
      if (f.operator === 'eq' && f.value !== undefined && f.value !== null) {
        eqValues.add(`${f.field}:${f.value}`);
      }
    }

    return { minRanges, dateValues, eqValues, fieldsWithFilters };
  }, [activeFilters]);

  return (
    <aside
      aria-label="Faceted Search Filters"
      className={`w-full lg:w-64 xl:w-72 shrink-0 rounded-2xl bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/25 flex flex-col min-h-0 overflow-hidden transition-all ${className}`}
    >
      {/* Header */}
      <div className="p-3.5 border-b border-white/20 dark:border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Faceted Filter
          </span>
          {activeFacetCount > 0 && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
              {activeFacetCount}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {activeFacetCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFacets}
              className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1"
              title="Reset facets"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </Button>
          )}

          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Close Facets"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Facet Groups Accordions */}
      <div className="p-3 space-y-4 overflow-y-auto flex-1 min-h-[220px] divide-y divide-white/10 dark:divide-white/5">
        {facetGroups.map((group, gIdx) => {
          const isCollapsed = Boolean(collapsedGroups[group.field]);
          const hasGroupActiveFilters = activeFilterLookup.fieldsWithFilters.has(group.field);

          return (
            <div key={group.field} className={gIdx > 0 ? 'pt-3.5' : ''}>
              {/* Group Title */}
              <button
                type="button"
                onClick={() => toggleGroupCollapse(group.field)}
                className="w-full flex items-center justify-between text-left group py-1 text-xs font-semibold text-foreground/90 hover:text-primary transition-colors"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {group.type === 'numeric_range' || group.dataType === 'INTEGER' || group.dataType === 'DECIMAL' ? (
                    <Hash className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  ) : group.type === 'date_range' || group.dataType === 'DATE' || group.dataType === 'DATETIME' ? (
                    <Calendar className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  ) : group.dataType === 'BOOLEAN' ? (
                    <ToggleLeft className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : group.dataType === 'RELATION' || group.dataType === 'RELATIONSHIP' ? (
                    <Layers className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                  ) : (
                    <Tag className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className="truncate">{group.name}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {hasGroupActiveFilters && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                  )}
                </div>
              </button>

              {/* Bucket Choices */}
              {!isCollapsed && (() => {
                const query = (groupSearchQuery[group.field] || '').toLowerCase().trim();
                const filteredBuckets = query
                  ? group.buckets.filter((b) => b.label.toLowerCase().includes(query))
                  : group.buckets;
                const isExpanded = Boolean(expandedGroups[group.field]);
                const visibleBuckets = isExpanded || query || filteredBuckets.length <= 5
                  ? filteredBuckets
                  : filteredBuckets.slice(0, 5);

                return (
                  <div className="mt-2 space-y-1.5 pl-1">
                    {group.buckets.length > 6 && (
                      <div className="relative mb-2 pr-1">
                        <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                        <Input
                          value={groupSearchQuery[group.field] || ''}
                          onChange={(e) =>
                            setGroupSearchQuery((prev) => ({
                              ...prev,
                              [group.field]: e.target.value,
                            }))
                          }
                          placeholder={`Filter ${group.name.toLowerCase()}...`}
                          className="h-7 pl-6 pr-2 text-[11px] bg-white/40 dark:bg-white/5 border-white/20"
                        />
                      </div>
                    )}

                    {visibleBuckets.map((bucket) => {
                      let isChecked = false;
                      if (group.type === 'numeric_range') {
                        isChecked = activeFilterLookup.minRanges.has(`${group.field}:${bucket.minVal}`);
                      } else if (group.type === 'date_range') {
                        isChecked = activeFilterLookup.dateValues.has(`${group.field}:${bucket.value}`);
                      } else {
                        isChecked = activeFilterLookup.eqValues.has(`${group.field}:${bucket.value}`);
                      }

                      return (
                        <label
                          key={bucket.value}
                          onClick={() => handleToggleFacet(group, bucket)}
                          className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-lg cursor-pointer transition-all select-none ${
                            isChecked
                              ? 'bg-primary/15 text-primary font-medium border border-primary/20'
                              : 'hover:bg-white/40 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => handleToggleFacet(group, bucket)}
                              className="h-3.5 w-3.5 pointer-events-none"
                            />
                            <span className="truncate">{bucket.label}</span>
                          </div>

                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                              isChecked
                                ? 'bg-primary text-primary-foreground font-semibold'
                                : 'bg-muted/80 text-muted-foreground'
                            }`}
                          >
                            {bucket.count}
                          </span>
                        </label>
                      );
                    })}

                    {visibleBuckets.length === 0 && (
                      <div className="text-[11px] text-muted-foreground/80 py-1 pl-1 italic">
                        No matching options
                      </div>
                    )}

                    {!query && filteredBuckets.length > 5 && (
                      <button
                        type="button"
                        onClick={() => toggleGroupExpand(group.field)}
                        className="text-[11px] text-primary hover:underline font-medium pl-1 pt-1 block"
                      >
                        {isExpanded ? 'Show less' : `+ Show ${filteredBuckets.length - 5} more`}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}

        {facetGroups.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
            <Sparkles className="h-4 w-4 mx-auto opacity-40" />
            <p>No categorical facets detected for this model.</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-white/20 dark:border-white/10 text-[10px] text-muted-foreground/80 flex items-center justify-between bg-white/20 dark:bg-black/10 shrink-0">
        <span>PostgreSQL GIN Indexed</span>
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
      </div>
    </aside>
  );
};
