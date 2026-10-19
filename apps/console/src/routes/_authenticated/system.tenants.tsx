import { createFileRoute } from '@tanstack/react-router';
import { FleetTenantsTable } from '@/features/system/tenants/fleet-tenants-table';
import { Building2 } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/system/tenants')({
  component: SystemTenantsPage,
});

function SystemTenantsPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Building2 className="h-4 w-4" />
            <span>Sovereign Platform Root</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Fleet Tenants Ledger</h2>
          <p className="text-sm text-muted-foreground">
            Complete platform tenancy ledger with live telemetry dials, unconstrained quota tuning (∞),
            and Assume-Tenant session delegation.
          </p>
        </div>
      </div>

      <FleetTenantsTable />
    </div>
  );
}
