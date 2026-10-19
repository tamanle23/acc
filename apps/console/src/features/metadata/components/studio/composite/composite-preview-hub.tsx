import React, { useState, useMemo } from 'react';
import type { CompositeSpec } from '../../../api/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Code, Database, FileJson, Copy, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  spec: CompositeSpec;
}

export const CompositePreviewHub: React.FC<Props> = ({ spec }) => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  // 1. Generate Simulated Live JSON Projection Envelope
  const liveJsonProjection = useMemo(() => {
    const rootAttributes: Record<string, unknown> = {};

    (spec.fields || []).forEach((f) => {
      const key = f.alias || f.source_attribute;
      rootAttributes[key] = `sample_${f.source_attribute}_val`;
    });

    (spec.rollups || []).forEach((r) => {
      rootAttributes[r.alias] = r.aggregate_function === 'COUNT' ? 8 : 1420.5;
    });

    (spec.children || []).forEach((child) => {
      const childKey = child.alias || child.target_entity_system_name.toLowerCase();
      const childItem: Record<string, unknown> = {
        id: `rec_${child.target_entity_type_id}_001`,
      };

      (child.fields || []).forEach((cf) => {
        const cKey = cf.alias || cf.source_attribute;
        childItem[cKey] = `sample_${cf.source_attribute}_val`;
      });

      if (child.cardinality === 'ONE_TO_MANY') {
        rootAttributes[childKey] = [
          childItem,
          {
            ...childItem,
            id: `rec_${child.target_entity_type_id}_002`,
          },
        ];
      } else {
        rootAttributes[childKey] = childItem;
      }
    });

    return {
      id: `rec_${spec.root_entity_type_id}_999`,
      tenantId: 'tenant-demo',
      entityTypeId: spec.root_entity_type_id,
      schemaVersion: 1,
      is_composite: true,
      attributes: rootAttributes,
    };
  }, [spec]);

  // 2. Generate Client Pushdown SQL Projection Preview
  const pushdownSql = useMemo(() => {
    const rootAlias = spec.root_alias || 'root';
    const lines: string[] = [];

    lines.push(`-- ====================================================================`);
    lines.push(`-- PostgreSQL Pushdown Query Projection for: ${rootAlias}`);
    lines.push(`-- Root Entity ID: ${spec.root_entity_type_id} (${spec.root_entity_system_name})`);
    lines.push(`-- ====================================================================`);
    lines.push(`SELECT`);
    lines.push(`  t_root.id AS root_id,`);
    lines.push(`  t_root.tenant_id,`);
    lines.push(`  jsonb_build_object(`);
    lines.push(`    'id', t_root.id,`);
    lines.push(`    'tenantId', t_root.tenant_id,`);
    lines.push(`    'is_composite', TRUE,`);

    (spec.fields || []).forEach((f) => {
      lines.push(`    '${f.alias || f.source_attribute}', t_root.attributes->>'${f.source_attribute}',`);
    });

    (spec.children || []).forEach((c, i) => {
      const childAlias = c.alias || c.target_entity_system_name.toLowerCase();
      lines.push(`    '${childAlias}', t_child_${i + 1}.aggregated_data,`);
    });

    (spec.rollups || []).forEach((r) => {
      lines.push(`    '${r.alias}', t_rollup_${r.alias}.${r.alias},`);
    });

    // Remove trailing comma
    const lastItem = lines[lines.length - 1];
    if (lastItem.endsWith(',')) {
      lines[lines.length - 1] = lastItem.slice(0, -1);
    }

    lines.push(`  ) AS composite_record`);
    lines.push(`FROM UNIPOST_ENTITIES t_root`);

    (spec.rollups || []).forEach((r) => {
      lines.push(`LEFT JOIN LATERAL (`);
      const aggExpr = r.aggregate_function === 'COUNT'
        ? 'COUNT(*)'
        : `COALESCE(${r.aggregate_function}((c_agg.attributes->>'${r.target_field}')::numeric), 0)`;
      lines.push(`  SELECT ${aggExpr} AS ${r.alias}`);
      lines.push(`  FROM UNIPOST_ENTITIES c_agg`);
      lines.push(`  WHERE c_agg.tenant_id = t_root.tenant_id`);
      lines.push(`) t_rollup_${r.alias} ON TRUE`);
    });

    (spec.children || []).forEach((child, i) => {
      const cTable = `t_child_${i + 1}`;
      lines.push(`LEFT JOIN LATERAL (`);
      lines.push(`  SELECT jsonb_agg(jsonb_build_object(`);
      lines.push(`    'id', c.id,`);
      (child.fields || []).forEach((cf) => {
        lines.push(`    '${cf.alias || cf.source_attribute}', c.attributes->>'${cf.source_attribute}',`);
      });
      const lastChildItem = lines[lines.length - 1];
      if (lastChildItem.endsWith(',')) {
        lines[lines.length - 1] = lastChildItem.slice(0, -1);
      }
      lines.push(`  )) AS aggregated_data`);
      lines.push(`  FROM UNIPOST_ENTITIES c`);
      if (child.join_pattern === 'PATTERN_B_FOREIGN_KEY') {
        const fk = child.foreign_key_attribute || 'root_id';
        lines.push(`  WHERE c.entity_type_id = ${child.target_entity_type_id}`);
        lines.push(`    AND c.attributes->>'${fk}' = t_root.id::text`);
      } else {
        lines.push(`  INNER JOIN UNIPOST_ENTITY_RELATIONSHIPS r ON r.target_entity_id = c.id`);
        lines.push(`  WHERE r.source_entity_id = t_root.id`);
      }
      lines.push(`) ${cTable} ON TRUE`);
    });

    lines.push(`WHERE t_root.entity_type_id = ${spec.root_entity_type_id}`);
    lines.push(`  AND t_root.tenant_id = current_setting('app.current_tenant', true);`);

    return lines.join('\n');
  }, [spec]);

  // 3. Draft-07 JSON Schema Preview
  const jsonSchemaPreview = useMemo(() => {
    const properties: Record<string, unknown> = {
      id: { type: 'string' },
      tenantId: { type: 'string' },
      entityTypeId: { type: 'integer' },
      is_composite: { type: 'boolean' },
    };

    (spec.fields || []).forEach((f) => {
      properties[f.alias || f.source_attribute] = { type: f.data_type || 'string' };
    });

    (spec.children || []).forEach((child) => {
      const childProps: Record<string, unknown> = { id: { type: 'string' } };
      (child.fields || []).forEach((cf) => {
        childProps[cf.alias || cf.source_attribute] = { type: cf.data_type || 'string' };
      });

      const childSchema = {
        type: 'object',
        additionalProperties: false,
        properties: childProps,
      };

      if (child.cardinality === 'ONE_TO_MANY') {
        properties[child.alias || child.target_entity_system_name.toLowerCase()] = {
          type: 'array',
          items: childSchema,
        };
      } else {
        properties[child.alias || child.target_entity_system_name.toLowerCase()] = childSchema;
      }
    });

    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      additionalProperties: false,
      properties,
    };
  }, [spec]);

  const handleCopy = (text: string, tabKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabKey);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <div className="flex flex-col h-[750px] rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Live Preview Hub
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Real-time JSON Envelope & Lateral Pushdown SQL
            </p>
          </div>
        </div>

        <Badge
          variant="outline"
          className="text-[10px] font-mono px-2 py-0.5 bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
        >
          Read-Only View
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="json" className="flex-1 flex flex-col mt-3 overflow-hidden">
        <TabsList className="bg-slate-100/70 dark:bg-slate-800/70 p-1 rounded-xl grid grid-cols-3">
          <TabsTrigger value="json" className="text-xs gap-1 py-1 rounded-lg">
            <FileJson className="h-3.5 w-3.5 text-sky-500" />
            <span>Live JSON</span>
          </TabsTrigger>
          <TabsTrigger value="sql" className="text-xs gap-1 py-1 rounded-lg">
            <Database className="h-3.5 w-3.5 text-indigo-500" />
            <span>Pushdown SQL</span>
          </TabsTrigger>
          <TabsTrigger value="schema" className="text-xs gap-1 py-1 rounded-lg">
            <Code className="h-3.5 w-3.5 text-emerald-500" />
            <span>JSON Schema</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Live JSON Projection */}
        <TabsContent value="json" className="flex-1 flex flex-col mt-2 overflow-hidden relative">
          <div className="absolute top-2 right-2 z-10">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopy(JSON.stringify(liveJsonProjection, null, 2), 'json')}
              className="h-7 text-xs bg-white/80 dark:bg-slate-800/80 backdrop-blur-md gap-1"
            >
              {copiedTab === 'json' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              <span>{copiedTab === 'json' ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
          <pre className="flex-1 p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] leading-relaxed overflow-auto custom-scrollbar border border-slate-800">
            {JSON.stringify(liveJsonProjection, null, 2)}
          </pre>
        </TabsContent>

        {/* Tab 2: Pushdown SQL */}
        <TabsContent value="sql" className="flex-1 flex flex-col mt-2 overflow-hidden relative">
          <div className="absolute top-2 right-2 z-10">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopy(pushdownSql, 'sql')}
              className="h-7 text-xs bg-white/80 dark:bg-slate-800/80 backdrop-blur-md gap-1"
            >
              {copiedTab === 'sql' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              <span>{copiedTab === 'sql' ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
          <pre className="flex-1 p-3 rounded-xl bg-slate-950 text-sky-200 font-mono text-[11px] leading-relaxed overflow-auto custom-scrollbar border border-slate-800 whitespace-pre-wrap">
            {pushdownSql}
          </pre>
        </TabsContent>

        {/* Tab 3: JSON Schema */}
        <TabsContent value="schema" className="flex-1 flex flex-col mt-2 overflow-hidden relative">
          <div className="absolute top-2 right-2 z-10">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopy(JSON.stringify(jsonSchemaPreview, null, 2), 'schema')}
              className="h-7 text-xs bg-white/80 dark:bg-slate-800/80 backdrop-blur-md gap-1"
            >
              {copiedTab === 'schema' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              <span>{copiedTab === 'schema' ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
          <pre className="flex-1 p-3 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] leading-relaxed overflow-auto custom-scrollbar border border-slate-800">
            {JSON.stringify(jsonSchemaPreview, null, 2)}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
};
