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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditCard, Sparkles, Loader2 } from 'lucide-react';
import {
  useOverrideSubscription,
  type FleetTenantSummary,
  type SovereignSubscriptionTier,
} from '../api/use-system-fleet';

const ALL_SYSTEM_FEATURES = [
  { key: 'FEATURE_METADATA_READ', label: 'Schema Read & Inspect', minTier: 'BASIC' },
  { key: 'FEATURE_RECORDS_CRUD', label: 'Record Data CRUD', minTier: 'BASIC' },
  { key: 'FEATURE_SCHEMA_STUDIO', label: 'Schema Studio Visual Designer', minTier: 'PRO' },
  { key: 'FEATURE_PATTERN_C_GRAPH', label: 'Pattern C Entity Graph Traversals', minTier: 'PRO' },
  { key: 'FEATURE_DATA_EXPORT', label: 'Data Dump & Manifest Export', minTier: 'PRO' },
  { key: 'FEATURE_AI_AGENT_MCP', label: 'AI Agent Context Protocol (MCP)', minTier: 'PRO_MAX' },
  { key: 'FEATURE_STATE_MACHINE', label: 'Workflow State Machine Engine', minTier: 'PRO_MAX' },
  { key: 'FEATURE_STREAMING_EXPORT', label: 'High-Throughput Streaming Export', minTier: 'PRO_MAX' },
  { key: 'FEATURE_DEDICATED_REPLICA', label: 'Isolated Read Replica Routing', minTier: 'ENTERPRISE' },
];

interface SubscriptionOverrideDrawerProps {
  tenant: FleetTenantSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscriptionOverrideDrawer({
  tenant,
  open,
  onOpenChange,
}: SubscriptionOverrideDrawerProps) {
  const [tier, setTier] = useState<SovereignSubscriptionTier>('PRO');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [reason, setReason] = useState('Sovereign administrative promotion');

  const overrideMutation = useOverrideSubscription();

  useEffect(() => {
    if (tenant) {
      setTier(tenant.tier);
      setSelectedFeatures(tenant.activeFeatures || []);
    }
  }, [tenant]);

  if (!tenant) return null;

  const handleToggleFeature = (featureKey: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(featureKey) ? prev.filter((k) => k !== featureKey) : [...prev, featureKey]
    );
  };

  const handleSave = () => {
    overrideMutation.mutate(
      {
        tenantId: tenant.tenantId,
        planTier: tier,
        features: selectedFeatures,
        reason: reason.trim() || 'Sovereign override',
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
            <CreditCard className="h-4 w-4" />
            <span>Sovereign Subscription Governance</span>
          </div>
          <SheetTitle className="text-xl">Commercial Tier Override</SheetTitle>
          <SheetDescription>
            Override plan tier, cherry-pick feature entitlement flags, or extend trial terms for{' '}
            <strong className="text-foreground">{tenant.name}</strong> ({tenant.tenantId}).
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="plan-tier">Plan Tier</Label>
            <Select value={tier} onValueChange={(val) => setTier(val as SovereignSubscriptionTier)}>
              <SelectTrigger id="plan-tier" className="bg-muted/40">
                <SelectValue placeholder="Select Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BASIC">Basic (Solo Freelancer)</SelectItem>
                <SelectItem value="PRO">Pro (Standard Growing Team)</SelectItem>
                <SelectItem value="PRO_MAX">Pro Max (High Scale Ops)</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise (Custom / Sovereign)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Entitlement Feature Flags</Label>
              <Badge variant="outline" className="text-xs font-mono">
                {selectedFeatures.length} Active
              </Badge>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              {ALL_SYSTEM_FEATURES.map((feat) => {
                const isChecked = selectedFeatures.includes(feat.key);
                return (
                  <label
                    key={feat.key}
                    className="flex items-start gap-3 cursor-pointer select-none group"
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleToggleFeature(feat.key)}
                      className="mt-0.5"
                    />
                    <div className="grid gap-0.5 leading-none">
                      <span className="text-sm font-medium group-hover:text-primary transition-colors">
                        {feat.label}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {feat.key}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audit-reason">Mandatory Audit Reason</Label>
            <Input
              id="audit-reason"
              placeholder="e.g. VIP Strategic Partner tier grant"
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
          <Button
            onClick={handleSave}
            disabled={overrideMutation.isPending || !reason.trim()}
            className="gap-1.5 shadow-md shadow-primary/20"
          >
            {overrideMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying Override...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Commit Entitlement
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
