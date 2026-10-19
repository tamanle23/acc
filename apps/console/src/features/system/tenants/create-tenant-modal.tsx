import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Sparkles, Loader2 } from 'lucide-react';
import { useCreateTenant, type SovereignSubscriptionTier } from '../api/use-system-fleet';

interface CreateTenantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTenantModal({ open, onOpenChange }: CreateTenantModalProps) {
  const [tenantId, setTenantId] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [tier, setTier] = useState<SovereignSubscriptionTier>('PRO');
  const [blueprintId, setBlueprintId] = useState('ecommerce-standard');

  const createTenantMutation = useCreateTenant();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !tenantName) return;

    createTenantMutation.mutate(
      {
        tenantId: tenantId.trim().toLowerCase(),
        tenantName: tenantName.trim(),
        ownerEmail: ownerEmail.trim() || undefined,
        tier,
        blueprintId,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setTenantId('');
          setTenantName('');
          setOwnerEmail('');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-background/95 backdrop-blur-2xl border-white/20 dark:border-white/10 shadow-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="gap-1">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <Building2 className="h-4 w-4" />
              <span>Sovereign Fleet Provisioning</span>
            </div>
            <DialogTitle className="text-xl">Provision New Tenant</DialogTitle>
            <DialogDescription>
              Deploy a new isolated tenant database namespace seeded with canonical domain blueprints.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tenant-id">Tenant Identifier (ID / Slug)</Label>
              <Input
                id="tenant-id"
                placeholder="e.g. tenant-logistics"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
                className="font-mono text-sm bg-muted/40"
              />
              <span className="text-[11px] text-muted-foreground">
                Canonical PostgreSQL RLS identifier. Lowercase alphanumeric and hyphens only.
              </span>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tenant-name">Organization Name</Label>
              <Input
                id="tenant-name"
                placeholder="e.g. Global Express Logistics Corp"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="owner-email">Root Organization Admin Email</Label>
              <Input
                id="owner-email"
                type="email"
                placeholder="e.g. admin@logistics.vn"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="tier">Subscription Tier</Label>
                <Select value={tier} onValueChange={(val) => setTier(val as SovereignSubscriptionTier)}>
                  <SelectTrigger id="tier" className="bg-muted/40">
                    <SelectValue placeholder="Select Tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASIC">Basic (Solo)</SelectItem>
                    <SelectItem value="PRO">Pro (Standard)</SelectItem>
                    <SelectItem value="PRO_MAX">Pro Max (Scale)</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise (VIP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="blueprint">Domain Blueprint</Label>
                <Select value={blueprintId} onValueChange={setBlueprintId}>
                  <SelectTrigger id="blueprint" className="bg-muted/40">
                    <SelectValue placeholder="Select Blueprint" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ecommerce-standard">E-Commerce Standard</SelectItem>
                    <SelectItem value="supply-chain-graph">Supply Chain & Graph</SelectItem>
                    <SelectItem value="saas-crm">SaaS CRM</SelectItem>
                    <SelectItem value="empty-scratch">Scratch (Clean Slate)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createTenantMutation.isPending || !tenantId || !tenantName}
              className="gap-1.5 shadow-md shadow-primary/20"
            >
              {createTenantMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Provisioning...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Deploy Organization
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
