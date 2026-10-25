import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Eye,
  Trash2,
  Globe,
  Building2,
  Lock,
} from 'lucide-react';
import type { SandboxRoleWithPermissions } from '@/core/sandbox/handlers/system-sandbox-handler';

interface GetRoleManagementColumnsProps {
  onInspect: (role: SandboxRoleWithPermissions) => void;
  onDelete: (role: SandboxRoleWithPermissions) => void;
}

export function getRoleManagementColumns({
  onInspect,
  onDelete,
}: GetRoleManagementColumnsProps): ColumnDef<SandboxRoleWithPermissions>[] {
  return [
    {
      accessorKey: 'roleId',
      header: 'Role Identifier',
      cell: ({ row }) => {
        const role = row.original;
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 font-semibold text-foreground font-mono text-xs">
              <span>{role.roleId}</span>
              {role.systemRole && (
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 gap-0.5">
                  <Lock className="h-2.5 w-2.5" /> Core
                </Badge>
              )}
            </div>
            <span className="font-sans text-xs text-muted-foreground">{role.roleName}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'roleScope',
      header: 'Scope & Custody',
      cell: ({ row }) => {
        const role = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={`text-[10px] font-mono ${
                role.roleScope === 'SYSTEM'
                  ? 'border-indigo-500/40 text-indigo-700 dark:text-indigo-400 bg-indigo-500/10'
                  : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
              }`}
            >
              {role.roleScope === 'SYSTEM' ? (
                <>
                  <Globe className="h-2.5 w-2.5 mr-1" /> Sovereign
                </>
              ) : (
                <>
                  <Building2 className="h-2.5 w-2.5 mr-1" /> {role.tenantId || 'TENANT'}
                </>
              )}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'minPlanTier',
      header: 'Minimum Tier',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[10px]">
          {row.original.minPlanTier || 'COMMUNITY'}
        </Badge>
      ),
    },
    {
      id: 'permissionsCount',
      header: 'Permissions',
      cell: ({ row }) => (
        <div className="text-center font-mono text-xs">
          <Badge variant="secondary" className="text-[10px]">
            {row.original.permissions?.length || 0} atoms
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: 'userCount',
      header: 'Assigned Users',
      cell: ({ row }) => (
        <div className="text-center font-mono text-xs text-muted-foreground">
          {row.original.userCount || 0}
        </div>
      ),
    },
    {
      id: 'actions',
      header: () => <div className="text-right pr-4">Actions</div>,
      cell: ({ row }) => {
        const role = row.original;
        return (
          <div className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Actions for role ${role.roleId}`}>
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 text-xs">
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => onInspect(role)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Inspect Atoms</span>
                </DropdownMenuItem>
                {!role.systemRole && (
                  <DropdownMenuItem
                    className="gap-2 text-destructive cursor-pointer"
                    onClick={() => onDelete(role)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Role</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
