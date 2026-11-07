import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { AuthorizedButton } from '@/components/auth';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Sliders, Infinity as InfinityIcon, Loader2, Sparkles, HardDrive, Database, Layers } from 'lucide-react';
import {
  useUpdateTenantQuotas,
  type FleetTenantSummary,
} from '../api/use-system-fleet';

interface QuotaTuningDrawerProps {
  tenant: FleetTenantSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuotaTuningDrawer({
  tenant,
  open,
  onOpenChange,
}: QuotaTuningDrawerProps) {
  const [unlimitedWorkspaces, setUnlimitedWorkspaces] = useState(false);
  const [maxWorkspaces, setMaxWorkspaces] = useState(5);

  const [unlimitedSchemas, setUnlimitedSchemas] = useState(false);
  const [maxSchemas, setMaxSchemas] = useState(50);

  const [unlimitedRecords, setUnlimitedRecords] = useState(false);
  const [maxRecords, setMaxRecords] = useState(100000);

  const [rateLimitBurst, setRateLimitBurst] = useState(1000);
  const [reason, setReason] = useState('Sovereign buffer pool tuning');

  const updateQuotasMutation = useUpdateTenantQuotas();

  useEffect(() => {
    if (tenant) {
      setUnlimitedWorkspaces(tenant.maxWorkspaces === -1);
      setMaxWorkspaces(tenant.maxWorkspaces === -1 ? 15 : tenant.maxWorkspaces);

      setUnlimitedSchemas(tenant.maxSchemas === -1);
      setMaxSchemas(tenant.maxSchemas === -1 ? 200 : tenant.maxSchemas);

      setUnlimitedRecords(tenant.maxRecords === -1);
      setMaxRecords(tenant.maxRecords === -1 ? 1000000 : tenant.maxRecords);

      setRateLimitBurst(1000);
    }
  }, [tenant]);

  if (!tenant) return null;

  const handleSave = () => {
    updateQuotasMutation.mutate(
      {
        tenantId: tenant.tenantId,
        maxWorkspaces: unlimitedWorkspaces ? -1 : maxWorkspaces,
        maxSchemas: unlimitedSchemas ? -1 : maxSchemas,
        maxRecords: unlimitedRecords ? -1 : maxRecords,
        rateLimitBurst,
        reason: reason.trim() || 'Sovereign quota tuning',
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-background/95 backdrop-blur-2xl border-white/20 dark:border-white/10 shadow-2xl overflow-y-auto"
      >
        <SheetHeader className="gap-1 border-b pb-4">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
            <Sliders className="h-4 w-4" />
            <span>Sovereign Custodian Quota Tuning</span>
          </div>
          <SheetTitle className="text-xl">Volume & Rate Quotas</SheetTitle>
          <SheetDescription>
            Directly configure data plane physical quotas for{' '}
            <strong className="text-foreground">{tenant.name}</strong> ({tenant.tenantId}) to prevent noisy neighbor contention.
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Workspaces Quota */}
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <Label className="font-semibold text-sm">Workspaces Quota</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="unlimited-workspaces" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                  <InfinityIcon className="h-3 w-3" /> Unlimited
                </Label>
                <Switch
                  id="unlimited-workspaces"
                  checked={unlimitedWorkspaces}
                  onCheckedChange={setUnlimitedWorkspaces}
                />
              </div>
            </div>

            {!unlimitedWorkspaces ? (
              <div className="space-y-1.5">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={maxWorkspaces}
                  onChange={(e) => setMaxWorkspaces(Number(e.target.value))}
                  className="bg-background"
                />
                <span className="text-[11px] text-muted-foreground">
                  Currently active: {tenant.workspacesCount} workspaces
                </span>
              </div>
            ) : (
              <Badge variant="secondary" className="font-mono text-xs">
                ∞ Unconstrained Workspaces
              </Badge>
            )}
          </div>

          {/* Schemas Quota */}
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <Label className="font-semibold text-sm">Max Schemas (Entity Types)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="unlimited-schemas" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                  <InfinityIcon className="h-3 w-3" /> Unlimited
                </Label>
                <Switch
                  id="unlimited-schemas"
                  checked={unlimitedSchemas}
                  onCheckedChange={setUnlimitedSchemas}
                />
              </div>
            </div>

            {!unlimitedSchemas ? (
              <div className="space-y-1.5">
                <Input
                  type="number"
                  min={1}
                  max={2000}
                  value={maxSchemas}
                  onChange={(e) => setMaxSchemas(Number(e.target.value))}
                  className="bg-background"
                />
                <span className="text-[11px] text-muted-foreground">
                  Currently active: {tenant.schemasCount} schemas
                </span>
              </div>
            ) : (
              <Badge variant="secondary" className="font-mono text-xs">
                ∞ Unconstrained Entity Types
              </Badge>
            )}
          </div>

          {/* Records Quota */}
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" />
                <Label className="font-semibold text-sm">Max Total Records</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="unlimited-records" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                  <InfinityIcon className="h-3 w-3" /> Unlimited
                </Label>
                <Switch
                  id="unlimited-records"
                  checked={unlimitedRecords}
                  onCheckedChange={setUnlimitedRecords}
                />
              </div>
            </div>

            {!unlimitedRecords ? (
              <div className="space-y-1.5">
                <Input
                  type="number"
                  min={1000}
                  step={10000}
                  value={maxRecords}
                  onChange={(e) => setMaxRecords(Number(e.target.value))}
                  className="bg-background"
                />
                <span className="text-[11px] text-muted-foreground">
                  Currently active: {tenant.recordsCount.toLocaleString()} rows
                </span>
              </div>
            ) : (
              <Badge variant="secondary" className="font-mono text-xs">
                ∞ Unconstrained PostgreSQL Records
              </Badge>
            )}
          </div>

          {/* Rate Limit Burst */}
          <div className="space-y-2">
            <Label htmlFor="rate-burst">Rate Limit Burst (Tokens / Min)</Label>
            <Input
              id="rate-burst"
              type="number"
              min={100}
              step={100}
              value={rateLimitBurst}
              onChange={(e) => setRateLimitBurst(Number(e.target.value))}
              className="bg-muted/40 font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quota-reason">Mandatory Audit Reason</Label>
            <Input
              id="quota-reason"
              placeholder="e.g. Dedicated high-throughput migration grant"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
        </div>

        <SheetFooter className="border-t pt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <AuthorizedButton
            permission="platform:quotas:manage"
            onClick={handleSave}
            disabled={updateQuotasMutation.isPending || !reason.trim()}
            className="gap-1.5 shadow-md shadow-primary/20"
          >
            {updateQuotasMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying Quotas...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Save Quotas
              </>
            )}
          </AuthorizedButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
