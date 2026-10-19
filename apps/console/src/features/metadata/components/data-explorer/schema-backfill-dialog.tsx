import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  ArrowRight,
  Database,
  Layers,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { type AttributeDefinition, type EntityType, type SchemaDriftAnalysisResponse } from '../../api/types';

interface SchemaBackfillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType?: EntityType | null;
  driftAnalysis?: SchemaDriftAnalysisResponse | null;
  attributes: AttributeDefinition[];
  onConfirm: (batchSize: number) => Promise<void>;
  isPending: boolean;
}

export const SchemaBackfillDialog: React.FC<SchemaBackfillDialogProps> = ({
  open,
  onOpenChange,
  entityType,
  driftAnalysis,
  attributes,
  onConfirm,
  isPending,
}) => {
  const [batchSize, setBatchSize] = useState<number>(100);

  // Filter attributes that provide a default value and are active (not archived)
  const backfillAttributes = attributes.filter(
    (attr) => !attr.isArchived && attr.defaultValue !== undefined && attr.defaultValue !== null && attr.defaultValue !== ''
  );

  const targetVersion = entityType?.schemaVersion ?? driftAnalysis?.currentSchemaVersion ?? 1;
  const outdatedRecords = driftAnalysis?.outdatedRecords ?? 0;
  const totalRecords = driftAnalysis?.totalRecords ?? 0;

  const handleConfirm = async () => {
    await onConfirm(batchSize);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-6 rounded-2xl bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl">
        <DialogHeader className="space-y-2 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold tracking-tight">
                Schema Evolution Backfill Preview
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Review potential changes and parameters before running retroactive schema migration for{' '}
                <span className="font-semibold text-foreground">{entityType?.name || 'this Entity'}</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3 overflow-y-auto pr-1">
          {/* Version & Impact Summary Banner */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Layers className="h-3.5 w-3.5" />
                <span>Target Version</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">Legacy</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/30">
                  v{targetVersion}
                </Badge>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Database className="h-3.5 w-3.5" />
                <span>Outdated Records</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                  {outdatedRecords}
                </span>
                <span className="text-xs text-muted-foreground">
                  of {totalRecords} total records
                </span>
              </div>
            </div>
          </div>

          {/* Potential Attribute Value Injections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Default Values Injected for Missing Attributes
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                {backfillAttributes.length} attribute{backfillAttributes.length === 1 ? '' : 's'} with defaults
              </span>
            </div>

            {backfillAttributes.length === 0 ? (
              <div className="p-3 rounded-xl bg-muted/20 border border-border/40 text-xs text-muted-foreground text-center">
                No active attributes have default values configured. Outdated records will be validated against current schema constraints and stamped with <code className="text-foreground font-mono">schemaVersion = {targetVersion}</code>.
              </div>
            ) : (
              <div className="rounded-xl border border-border/40 overflow-hidden divide-y divide-border/30 bg-muted/10">
                {backfillAttributes.map((attr) => (
                  <div key={attr.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors">
                    <div>
                      <div className="font-medium text-foreground">{attr.name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {attr.systemName} &bull; <span className="uppercase text-[10px]">{attr.dataType}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="font-mono text-xs max-w-[200px] truncate">
                        {String(attr.defaultValue)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Execution Settings */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Migration Settings
            </span>
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium">Batch Processing Size</div>
                <div className="text-[11px] text-muted-foreground">
                  Records per transactional migration batch
                </div>
              </div>
              <Select
                value={String(batchSize)}
                onValueChange={(val) => setBatchSize(Number(val))}
              >
                <SelectTrigger className="w-28 h-8 text-xs bg-white/70 dark:bg-slate-900/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="25">25 records</SelectItem>
                  <SelectItem value="50">50 records</SelectItem>
                  <SelectItem value="100">100 records</SelectItem>
                  <SelectItem value="250">250 records</SelectItem>
                  <SelectItem value="500">500 records</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Operational Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              <span className="font-semibold">Safe Zero-Downtime Migration</span>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300/90">
                During this operation, each record will have its missing attributes populated with configured defaults, re-validated against the compiled schema, and stamped with the new schema version. Any unresolvable constraint failures will be safely isolated and returned in the execution summary.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-border/40 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isPending || outdatedRecords === 0}
            className="text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <RefreshCw className={isPending ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            <span>{isPending ? 'Migrating Records...' : 'Confirm & Run Backfill'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
