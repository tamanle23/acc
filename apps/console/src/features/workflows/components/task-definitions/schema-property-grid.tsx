import React, { useState, useEffect, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Code2, ListTree, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PropertyType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';

export interface SchemaPropertyRow {
  id: string;
  name: string;
  type: PropertyType;
  required: boolean;
  description: string;
  defaultValue?: string;
}

export interface SchemaPropertyGridProps {
  value: Record<string, unknown>;
  onChange: (schema: Record<string, unknown>) => void;
  disabled?: boolean;
  className?: string;
}

export function schemaToRows(schema: Record<string, unknown> | null | undefined): SchemaPropertyRow[] {
  if (!schema || typeof schema !== 'object' || !schema.properties) {
    return [];
  }

  const properties = schema.properties as Record<string, Record<string, unknown>>;
  const requiredList = Array.isArray(schema.required) ? (schema.required as string[]) : [];

  return Object.entries(properties).map(([name, def], index) => {
    const propType = (typeof def.type === 'string' ? def.type : 'string') as PropertyType;
    const allowedTypes: PropertyType[] = ['string', 'number', 'integer', 'boolean', 'object', 'array'];
    const safeType: PropertyType = allowedTypes.includes(propType) ? propType : 'string';

    return {
      id: `prop-${name}-${index}-${Math.random().toString(36).substring(2, 7)}`,
      name,
      type: safeType,
      required: requiredList.includes(name),
      description: typeof def.description === 'string' ? def.description : '',
      defaultValue: def.default !== undefined ? String(def.default) : '',
    };
  });
}

export function rowsToSchema(
  rows: SchemaPropertyRow[],
  baseSchema?: Record<string, unknown>
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const row of rows) {
    const trimmedName = row.name.trim();
    if (!trimmedName) continue;

    const propDef: Record<string, unknown> = {
      type: row.type,
    };

    if (row.description.trim()) {
      propDef.description = row.description.trim();
    }

    if (row.defaultValue !== undefined && row.defaultValue.trim() !== '') {
      const val = row.defaultValue.trim();
      if (row.type === 'number' || row.type === 'integer') {
        const num = Number(val);
        if (!isNaN(num)) propDef.default = num;
      } else if (row.type === 'boolean') {
        propDef.default = val.toLowerCase() === 'true';
      } else if (row.type === 'object' || row.type === 'array') {
        try {
          propDef.default = JSON.parse(val);
        } catch {
          propDef.default = val;
        }
      } else {
        propDef.default = val;
      }
    }

    properties[trimmedName] = propDef;

    if (row.required) {
      required.push(trimmedName);
    }
  }

  return {
    $schema: (baseSchema?.$schema as string) || 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    title: (baseSchema?.title as string) || 'ContractSchema',
    description: (baseSchema?.description as string) || undefined,
    properties,
    required,
    additionalProperties: false,
  };
}

export const SchemaPropertyGrid: React.FC<SchemaPropertyGridProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const [mode, setMode] = useState<'visual' | 'raw'>('visual');
  const [rows, setRows] = useState<SchemaPropertyRow[]>(() => schemaToRows(value));
  const [rawText, setRawText] = useState<string>(() => JSON.stringify(value || {}, null, 2));
  const [rawError, setRawError] = useState<string | null>(null);

  // Sync rows from outside value if external value changed meaningfully
  useEffect(() => {
    const incomingRows = schemaToRows(value);
    setRows(incomingRows);
    setRawText(JSON.stringify(value || {}, null, 2));
  }, [value]);

  const handleRowChange = (id: string, field: keyof SchemaPropertyRow, newVal: unknown) => {
    const updated = rows.map((r) => (r.id === id ? { ...r, [field]: newVal } : r));
    setRows(updated);
    const newSchema = rowsToSchema(updated, value);
    setRawText(JSON.stringify(newSchema, null, 2));
    onChange(newSchema);
  };

  const handleAddProperty = () => {
    const newRow: SchemaPropertyRow = {
      id: `prop-new-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: '',
      type: 'string',
      required: false,
      description: '',
      defaultValue: '',
    };
    const updated = [...rows, newRow];
    setRows(updated);
  };

  const handleRemoveProperty = (id: string) => {
    const updated = rows.filter((r) => r.id !== id);
    setRows(updated);
    const newSchema = rowsToSchema(updated, value);
    setRawText(JSON.stringify(newSchema, null, 2));
    onChange(newSchema);
  };

  const handleRawTextChange = (text: string) => {
    setRawText(text);
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setRawError('JSON Schema must be an object at the root');
        return;
      }
      setRawError(null);
      setRows(schemaToRows(parsed));
      onChange(parsed);
    } catch (e: unknown) {
      setRawError((e as Error).message || 'Invalid JSON format');
    }
  };

  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border border-border/50 bg-card/40 p-3', className)}>
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Contract Properties
          </span>
          <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
            {rows.length} fields
          </Badge>
          {rows.filter((r) => r.required).length > 0 && (
            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 bg-primary/10 text-primary">
              {rows.filter((r) => r.required).length} required
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md border border-border/40">
          <Button
            type="button"
            size="sm"
            variant={mode === 'visual' ? 'secondary' : 'ghost'}
            className="h-6 px-2 text-xs gap-1"
            onClick={() => setMode('visual')}
          >
            <ListTree className="w-3 h-3" />
            Visual
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'raw' ? 'secondary' : 'ghost'}
            className="h-6 px-2 text-xs gap-1"
            onClick={() => setMode('raw')}
          >
            <Code2 className="w-3 h-3" />
            Raw JSON
          </Button>
        </div>
      </div>

      {mode === 'visual' ? (
        <div className="flex flex-col gap-2">
          {rows.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-md bg-muted/20">
              No schema properties defined yet. Click below to add one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border/30">
                    <th className="pb-1.5 font-medium w-[160px]">Field Name</th>
                    <th className="pb-1.5 font-medium w-[110px]">Type</th>
                    <th className="pb-1.5 font-medium w-[70px] text-center">Required</th>
                    <th className="pb-1.5 font-medium">Description</th>
                    <th className="pb-1.5 font-medium w-[120px]">Default</th>
                    <th className="pb-1.5 font-medium w-[36px] text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {rows.map((row) => (
                    <tr key={row.id} className="group hover:bg-muted/30 transition-colors">
                      <td className="py-1.5 pr-2">
                        <Input
                          placeholder="e.g. orderId"
                          value={row.name}
                          disabled={disabled}
                          onChange={(e) => handleRowChange(row.id, 'name', e.target.value)}
                          className="h-7 text-xs font-mono"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Select
                          value={row.type}
                          disabled={disabled}
                          onValueChange={(val: PropertyType) => handleRowChange(row.id, 'type', val)}
                        >
                          <SelectTrigger className="h-7 text-xs font-mono">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">string</SelectItem>
                            <SelectItem value="number">number</SelectItem>
                            <SelectItem value="integer">integer</SelectItem>
                            <SelectItem value="boolean">boolean</SelectItem>
                            <SelectItem value="object">object</SelectItem>
                            <SelectItem value="array">array</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <Checkbox
                          checked={row.required}
                          disabled={disabled}
                          onCheckedChange={(checked) =>
                            handleRowChange(row.id, 'required', Boolean(checked))
                          }
                          className="mx-auto"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          placeholder="Description of field"
                          value={row.description}
                          disabled={disabled}
                          onChange={(e) => handleRowChange(row.id, 'description', e.target.value)}
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          placeholder="Optional default"
                          value={row.defaultValue || ''}
                          disabled={disabled}
                          onChange={(e) => handleRowChange(row.id, 'defaultValue', e.target.value)}
                          className="h-7 text-xs font-mono"
                        />
                      </td>
                      <td className="py-1.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={disabled}
                          onClick={() => handleRemoveProperty(row.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddProperty}
              className="mt-1 h-7 text-xs gap-1 border-dashed self-start"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Property
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={rawText}
            disabled={disabled}
            onChange={(e) => handleRawTextChange(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-input bg-background/80 p-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            spellCheck={false}
          />
          {rawError && (
            <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{rawError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
