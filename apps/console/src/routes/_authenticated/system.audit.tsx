import { createFileRoute } from '@tanstack/react-router';
import { AuditStudioTable } from '@/features/system/audit/audit-studio-table';
import { ShieldCheck, History } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/system/audit')({
  component: SystemAuditRoute,
});

function SystemAuditRoute() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <History className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Sovereign Audit & Compliance Studio
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tamper-evident cryptographic forward-hash ledger, mathematical verification, and signed compliance export.
          </p>
        </div>
      </div>

      {/* Main Studio View */}
      <AuditStudioTable />
    </div>
  );
}
