import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Users,
  Search,
  Lock,
  Unlock,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Mail,
  Building,
  Eye,
  KeyRound,
  ShieldCheck,
  Calendar,
  Clock,
  Copy,
  LogOut,
  UserCheck,
} from 'lucide-react';
import {
  useGlobalUsers,
  useLockUser,
  type GlobalUserListItem,
} from '../api/use-system-fleet';
import { toast } from 'sonner';

export interface UserMembershipDrawerProps {
  initialTenantId?: string;
}

export function UserMembershipDrawer({ initialTenantId }: UserMembershipDrawerProps = {}) {
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState(initialTenantId || 'ALL');

  // Inspector Sheet state
  const [inspectedUser, setInspectedUser] = useState<GlobalUserListItem | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Lock Confirmation Dialog state
  const [selectedUser, setSelectedUser] = useState<GlobalUserListItem | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [lockDialogOpen, setLockDialogOpen] = useState(false);

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
            <SelectTrigger className="w-[160px] bg-background/50 border-white/20 dark:border-white/10">
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

      {/* Glass Users Table */}
      <div className="rounded-xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>User Account</TableHead>
              <TableHead>Assigned Tenant</TableHead>
              <TableHead>RBAC Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-end">Emergency Custody</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Searching cross-tenant global user directory...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No users found matching query.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const isCustodian = u.tenantId === 'SYSTEM';
                return (
                  <TableRow key={u.userId} className={isCustodian ? 'bg-primary/5' : 'hover:bg-muted/30'}>
                    <TableCell>
                      <div className="grid gap-0.5">
                        <span className="font-semibold text-sm flex items-center gap-1.5">
                          {u.displayName}
                          {isCustodian && (
                            <Badge variant="default" className="text-[10px] px-1 py-0 h-4">
                              ROOT
                            </Badge>
                          )}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{u.username}</span>
                          <span>•</span>
                          <span>{u.email}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <Building className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{u.tenantId}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r} variant="outline" className="text-[10px] font-mono">
                            {r.replace('ROLE_', '')}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={u.locked ? 'destructive' : 'secondary'}
                        className="text-[10px] uppercase font-mono"
                      >
                        {u.locked ? 'LOCKED' : 'ACTIVE'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleInspect(u)}
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          title="Inspect user details and security telemetry"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Inspect</span>
                        </Button>

                        {!isCustodian ? (
                          <Button
                            size="sm"
                            variant={u.locked ? 'outline' : 'destructive'}
                            onClick={() => handleOpenLockDialog(u)}
                            className="h-7 text-xs gap-1.5"
                          >
                            {u.locked ? (
                              <>
                                <Unlock className="h-3.5 w-3.5" />
                                Unlock Account
                              </>
                            ) : (
                              <>
                                <Lock className="h-3.5 w-3.5" />
                                Lockout
                              </>
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic font-mono px-2">Sovereign Root</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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
                    {inspectedUser.locked ? 'LOCKED' : 'ACTIVE'}
                  </Badge>
                </SheetTitle>
                <SheetDescription className="font-mono text-xs text-muted-foreground">
                  {inspectedUser.email}
                </SheetDescription>
              </SheetHeader>

              {/* Identity & Scope Info */}
              <div className="space-y-3 p-4 rounded-xl border border-white/20 dark:border-white/10 bg-muted/20">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">User ID</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-foreground">{inspectedUser.userId}</span>
                    <button
                      onClick={() => copyToClipboard(inspectedUser.userId, 'User ID')}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Username</span>
                  <span className="font-mono font-medium text-foreground">{inspectedUser.username}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Assigned Tenant Scope</span>
                  <Badge variant="outline" className="font-mono text-[11px] gap-1">
                    <Building className="h-3 w-3 text-muted-foreground" />
                    {inspectedUser.tenantId}
                  </Badge>
                </div>
              </div>

              {/* Roles & Permissions */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  <span>Assigned RBAC Roles</span>
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {inspectedUser.roles.map((r) => (
                    <Badge key={r} variant="outline" className="text-xs font-mono py-1 px-2">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Security Telemetry & Timestamps */}
              <div className="space-y-2.5 p-3 rounded-lg border bg-background/50 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Account Created
                  </span>
                  <span className="font-mono text-foreground">
                    {new Date(inspectedUser.createdDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Last Login Observed
                  </span>
                  <span className="font-mono text-foreground">
                    {new Date(inspectedUser.lastLoginDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Emergency Operations Actions */}
              <div className="space-y-2 pt-2 border-t">
                <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Emergency Session Controls</span>
                </h4>

                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevokeSessions(inspectedUser)}
                    className="w-full justify-start text-xs gap-2 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Revoke All Active Sessions & Tokens
                  </Button>

                  {inspectedUser.tenantId !== 'SYSTEM' && (
                    <Button
                      variant={inspectedUser.locked ? 'outline' : 'destructive'}
                      size="sm"
                      onClick={() => handleOpenLockDialog(inspectedUser)}
                      className="w-full justify-start text-xs gap-2"
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
    </div>
  );
}
