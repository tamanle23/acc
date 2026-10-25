import { createFileRoute } from '@tanstack/react-router';
import { RbacMatrixGrid } from '@/features/system/roles/rbac-matrix-grid';
import { RoleManagementTab } from '@/features/system/roles/role-management-tab';
import { UserMembershipDrawer } from '@/features/system/roles/user-membership-drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldCheck, Users, KeyRound, Layers } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/system/roles')({
  component: SystemRolesPage,
});

function SystemRolesPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <KeyRound className="h-4 w-4" />
            <span>Sovereign Governance & Security</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">RBAC Matrix & Global Users</h2>
          <p className="text-sm text-muted-foreground">
            Declarative permission matrix studio, canonical role lifecycle management, and universal cross-tenant credential control.
          </p>
        </div>
      </div>

      <Tabs defaultValue="matrix" className="space-y-4">
        <TabsList className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-white/10">
          <TabsTrigger value="matrix" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Permission Matrix
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Layers className="h-4 w-4" />
            Roles Management
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Universal Users Directory
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-4">
          <RbacMatrixGrid />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <RoleManagementTab />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserMembershipDrawer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
