import React from 'react';
import type { AttributeDefinition, AttributeDefinitionOptions } from '../../api/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Sliders, Check, ShieldCheck } from 'lucide-react';

interface Props {
  attribute: AttributeDefinition | null;
  onUpdateAttribute: (updated: Partial<AttributeDefinition>) => void;
  onSave?: () => void;
  disabled?: boolean;
}

export const AttributePropertyInspector: React.FC<Props> = ({
  attribute,
  onUpdateAttribute,
  onSave,
  disabled = false,
}) => {
  if (!attribute) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-white/10 text-center text-muted-foreground min-h-[300px]">
        <Sliders className="h-8 w-8 mb-2 opacity-30 text-sky-500" />
        <h4 className="text-xs font-bold text-foreground">No Attribute Selected</h4>
        <p className="text-[11px] max-w-xs text-muted-foreground mt-1">
          Select an attribute card from the canvas or drop an element from the palette to configure JSON Schema constraints.
        </p>
      </div>
    );
  }

  const options: AttributeDefinitionOptions = attribute.options || {};

  const handleOptionChange = (key: string, val: unknown) => {
    onUpdateAttribute({
      options: {
        ...options,
        [key]: val,
      },
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg shadow-black/5">
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-sky-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Property Inspector
          </h3>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono bg-sky-500/10 text-sky-700 dark:text-sky-300">
          {attribute.systemName}
        </Badge>
      </div>

      <div className="space-y-3 text-xs">
        {/* Field Labels */}
        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-muted-foreground">Display Name</Label>
          <Input
            value={attribute.name}
            disabled={disabled}
            onChange={(e) => onUpdateAttribute({ name: e.target.value })}
            className="h-8 text-xs bg-white/70 dark:bg-slate-800/70 border-white/30"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-muted-foreground">System Identifier</Label>
          <Input
            value={attribute.systemName}
            disabled
            className="h-8 text-xs font-mono bg-muted/40 text-muted-foreground"
          />
        </div>

        {/* Validation Constraints */}
        <div className="pt-2 border-t border-border/30 space-y-3">
          <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            JSON Schema Constraints
          </h4>

          {/* isRequired switch */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-white/20">
            <div>
              <span className="font-semibold block text-foreground">Mandatory Field</span>
              <span className="text-[10px] text-muted-foreground">Rejects record if null/empty</span>
            </div>
            <Switch
              checked={attribute.isRequired}
              disabled={disabled}
              onCheckedChange={(checked) => onUpdateAttribute({ isRequired: checked })}
            />
          </div>

          {/* Regex Pattern for String types */}
          {attribute.dataType === 'STRING' && (
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Regex Pattern</Label>
              <Input
                placeholder="e.g. ^[A-Z0-9_-]{3,16}$"
                value={options.pattern || ''}
                disabled={disabled}
                onChange={(e) => handleOptionChange('pattern', e.target.value)}
                className="h-8 text-xs font-mono bg-white/70 dark:bg-slate-800/70 border-white/30"
              />
            </div>
          )}

          {/* Min & Max for Numeric types */}
          {(attribute.dataType === 'INTEGER' || attribute.dataType === 'DECIMAL') && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Minimum</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={options.min ?? ''}
                  disabled={disabled}
                  onChange={(e) => handleOptionChange('min', e.target.value === '' ? undefined : Number(e.target.value))}
                  className="h-8 text-xs bg-white/70 dark:bg-slate-800/70 border-white/30"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Maximum</Label>
                <Input
                  type="number"
                  placeholder="100000"
                  value={options.max ?? ''}
                  disabled={disabled}
                  onChange={(e) => handleOptionChange('max', e.target.value === '' ? undefined : Number(e.target.value))}
                  className="h-8 text-xs bg-white/70 dark:bg-slate-800/70 border-white/30"
                />
              </div>
            </div>
          )}

          {/* Default Value */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">Default Fallback Value</Label>
            <Input
              placeholder="e.g. Standard Default"
              value={attribute.defaultValue || ''}
              disabled={disabled}
              onChange={(e) => onUpdateAttribute({ defaultValue: e.target.value })}
              className="h-8 text-xs bg-white/70 dark:bg-slate-800/70 border-white/30"
            />
          </div>
        </div>
      </div>

      {onSave && (
        <Button
          size="sm"
          disabled={disabled}
          onClick={onSave}
          className="mt-2 h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shadow-md"
        >
          <Check className="h-3.5 w-3.5" />
          <span>Apply Constraints</span>
        </Button>
      )}
    </div>
  );
};
