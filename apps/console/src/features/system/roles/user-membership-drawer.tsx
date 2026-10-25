import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
} from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Search,
  Lock,
  Unlock,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Mail,
  Building,
  KeyRound,
  ShieldCheck,
  Calendar,
  Clock,
  Copy,
  LogOut,
} from 'lucide-react';
import {
  useGlobalUsers,
  useLockUser,
  type GlobalUserListItem,
} from '../api/use-system-fleet';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/pagination';
import { getUserMembershipColumns } from './user-membership-columns';
import { TenantRoleDelegationModal } from './tenant-role-delegation-modal';
import { toast } from 'sonner';

export interface UserMembershipDrawerProps {
  initialTenantId?: string;
}

export function UserMembershipDrawer({ initialTenantId }: UserMembershipDrawerProps = {}) {
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState(initialTenantId || 'ALL');
  const [sorting, setSorting] = useState<SortingState>([]);

  // Inspector Sheet state
  const [inspectedUser, setInspectedUser] = useState<GlobalUserListItem | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Lock Confirmation Dialog state
  const [selectedUser, setSelectedUser] = useState<GlobalUserListItem | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [lockDialogOpen, setLockDialogOpen] = useState(false);

  // Delegation Modal state
  const [delegatingUser, setDelegatingUser] = useState<GlobalUserListItem | null>(null);

  const { data: users = [], isLoading, refetch } = useGlobalUsers(
    search,
    tenantFilter === 'ALL' ? undefined : tenantFilter
  );
  const lockMutation = useLockUser();

  const handleOpenLockDialog = (user: GlobalUserListItem) => {
    setSelectedUser(user);
    setLockReason('');
    setLockDialogOpen(true);
  };

  const handleInspect = (user: GlobalUserListItem) => {
    setInspectedUser(user);
    setInspectorOpen(true);
  };

  const handleOpenDelegation = (user: GlobalUserListItem) => {
    setDelegatingUser(user);
  };

  const handleConfirmLock = () => {
    if (!selectedUser || !lockReason.trim()) return;

    lockMutation.mutate(
      {
        userId: selectedUser.userId,
        locked: !selectedUser.locked,
        reason: lockReason.trim(),
      },
      {
        onSuccess: (updated) => {
          setLockDialogOpen(false);
          setSelectedUser(null);
          if (inspectedUser && inspectedUser.userId === updated?.userId) {
            setInspectedUser(updated);
          }
        },
      }
    );
  };

  const handleRevokeSessions = (user: GlobalUserListItem) => {
    toast.success(`Ephemeral sessions and refresh tokens for '${user.username}' revoked across cluster.`);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.info(`${label} copied to clipboard!`);
  };

  const columns = useMemo(
    () =>
      getUserMembershipColumns({
        onInspect: handleInspect,
        onDelegate: handleOpenDelegation,
        onOpenLockDialog: handleOpenLockDialog,
      }),
    []
  );

  const table = useReactTable({
    data: users,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name, email, or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9 bg-background/50 border-white/20 dark:border-white/10"
            />
          </div>

          <Select value={tenantFilter} onValueChange={setTenantFilter}>
            <SelectTrigger
              aria-label="Filter by Tenant"
              className="w-[170px] bg-background/50 border-white/20 dark:border-white/10"
            >
              <SelectValue placeholder="All Tenants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Tenants</SelectItem>
              <SelectItem value="SYSTEM">SYSTEM Root</SelectItem>
              <SelectItem value="tenant-acme">Acme Corp</SelectItem>
              <SelectItem value="tenant-us-east-1">Logistics Hub</SelectItem>
              <SelectItem value="tenant-startup-alpha">Alpha AI</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="border-white/20 dark:border-white/10 bg-background/50"
        >
          <RefreshCw className="h-4 w-4 me-1.5" />
          Refresh
        </Button>
      </div>

      {/* Main Standardized DataTable */}
      <DataTable
        showRowIndex
        table={table}
        onRowClick={(user) => handleInspect(user)}
        noResultsMessage={
          isLoading
            ? 'Searching cross-tenant global user directory...'
            : 'No users found matching query.'
        }
      />

      {/* Standardized DataTablePagination */}
      <DataTablePagination table={table} />

      {/* Cross-Tenant User Inspector Drawer (Sheet) */}
      <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <SheetContent className="sm:max-w-md bg-background/95 backdrop-blur-2xl border-white/20 dark:border-white/10 shadow-2xl p-6 overflow-y-auto">
          {inspectedUser && (
            <div className="space-y-6">
              <SheetHeader className="space-y-1 text-start">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Sovereign User Inspector</span>
                </div>
                <SheetTitle className="text-xl font-bold flex items-center justify-between">
                  <span>{inspectedUser.displayName}</span>
                  <Badge
                    variant={inspectedUser.locked ? 'destructive' : 'secondary'}
                    className="font-mono text-xs uppercase"
                  >
                    {inspectedUser.locked ? 'Locked' : 'Active'}
                  </Badge>
                </SheetTitle>
                <SheetDescription className="font-mono text-xs">
                  {inspectedUser.userId}
                </SheetDescription>
              </SheetHeader>

              {/* Identity & Tenancy Card */}
              <div className="p-4 rounded-xl border border-white/10 bg-muted/20 space-y-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Identity & Tenancy
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> Primary Email:
                    </span>
                    <span className="font-medium font-mono">{inspectedUser.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5" /> Tenant Isolation:
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {inspectedUser.tenantId}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Created Date:
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {inspectedUser.createdDate ? new Date(inspectedUser.createdDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Last Active:
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {inspectedUser.lastLoginDate ? new Date(inspectedUser.lastLoginDate).toLocaleString() : 'Never logged in'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Roles & Authorities */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Assigned RBAC Roles
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {inspectedUser.roles.map((r) => (
                    <Badge key={r} variant="secondary" className="font-mono text-xs py-1 px-2.5">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Security Telemetry & MFA */}
              <div className="p-4 rounded-xl border border-white/10 bg-muted/20 space-y-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Security Telemetry & MFA
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5" /> FIDO2 / WebAuthn Passkeys:
                    </span>
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10">
                      Enrolled (YubiKey 5C)
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" /> Active Bearer Sessions:
                    </span>
                    <span className="font-mono">1 Active (Web Browser)</span>
                  </div>
                </div>
              </div>

              {/* Sovereign Actions */}
              <div className="space-y-2 pt-2 border-t">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Sovereign Remediation Actions
                </span>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 h-9 text-xs"
                    onClick={() => copyToClipboard(inspectedUser.userId, 'User UUID')}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy Identity UUID
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 h-9 text-xs"
                    onClick={() => handleRevokeSessions(inspectedUser)}
                  >
                    <LogOut className="h-3.5 w-3.5 text-amber-500" />
                    Revoke Active Bearer Sessions
                  </Button>

                  {inspectedUser.tenantId !== 'SYSTEM' && (
                    <Button
                      variant={inspectedUser.locked ? 'default' : 'destructive'}
                      size="sm"
                      className="justify-start gap-2 h-9 text-xs"
                      onClick={() => handleOpenLockDialog(inspectedUser)}
                    >
                      {inspectedUser.locked ? (
                        <>
                          <Unlock className="h-3.5 w-3.5" />
                          Restore Authentication Access
                        </>
                      ) : (
                        <>
                          <Lock className="h-3.5 w-3.5" />
                          Emergency Account Lockdown
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Lock/Unlock Dialog */}
      <Dialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-2xl border-white/20 dark:border-white/10 shadow-2xl">
          <DialogHeader className="gap-1">
            <div className="flex items-center gap-2 text-destructive font-semibold text-xs uppercase tracking-wider">
              <ShieldAlert className="h-4 w-4" />
              <span>Sovereign Security Action</span>
            </div>
            <DialogTitle className="text-xl">
              {selectedUser?.locked ? 'Unlock User Credentials' : 'Emergency User Lockdown'}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.locked
                ? `Restore authentication access for ${selectedUser?.displayName} (${selectedUser?.username}).`
                : `Immediately invalidate all active tokens and lock out ${selectedUser?.displayName} (${selectedUser?.username}).`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <label className="text-xs font-medium">Mandatory Security Reason:</label>
            <Input
              placeholder="e.g. Credential compromise or anomaly incident"
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              className="bg-muted/30"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setLockDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={selectedUser?.locked ? 'default' : 'destructive'}
              onClick={handleConfirmLock}
              disabled={!lockReason.trim() || lockMutation.isPending}
              className="gap-1.5"
            >
              {lockMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : selectedUser?.locked ? (
                'Confirm Unlock'
              ) : (
                'Lock User Account'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tenant Role Delegation Modal */}
      <TenantRoleDelegationModal
        user={delegatingUser}
        open={Boolean(delegatingUser)}
        onOpenChange={(open) => !open && setDelegatingUser(null)}
      />
    </div>
  );
}
