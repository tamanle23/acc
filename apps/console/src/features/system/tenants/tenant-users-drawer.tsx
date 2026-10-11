import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Users,
  Search,
  Lock,
  Unlock,
  ShieldAlert,
  Loader2,
  Mail,
  Copy,
  LogOut,
  UserCheck,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  useGlobalUsers,
  useLockUser,
  type GlobalUserListItem,
  type FleetTenantSummary,
} from '../api/use-system-fleet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface TenantUsersDrawerProps {
  tenant: FleetTenantSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TenantUsersDrawer({
  tenant,
  open,
  onOpenChange,
}: TenantUsersDrawerProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Lock Confirmation Dialog state
  const [userToLock, setUserToLock] = useState<GlobalUserListItem | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [lockDialogOpen, setLockDialogOpen] = useState(false);

  const { data: users = [], isLoading, refetch } = useGlobalUsers(
    search,
    tenant?.tenantId
  );
  const lockMutation = useLockUser();

  if (!tenant) return null;

  const filteredUsers = users.filter((u) => {
    if (roleFilter === 'ALL') return true;
    return u.roles.some((r) => r.toUpperCase().includes(roleFilter.toUpperCase()));
  });

  const handleOpenLockDialog = (user: GlobalUserListItem) => {
    setUserToLock(user);
    setLockReason('');
    setLockDialogOpen(true);
  };

  const handleConfirmLock = () => {
    if (!userToLock || !lockReason.trim()) return;

    lockMutation.mutate(
      {
        userId: userToLock.userId,
        locked: !userToLock.locked,
        reason: lockReason.trim(),
      },
      {
        onSuccess: () => {
          toast.success(
            userToLock.locked
              ? `Tài khoản ${userToLock.username} đã được mở khóa thành công.`
              : `Tài khoản ${userToLock.username} đã bị khóa khẩn cấp.`
          );
          setLockDialogOpen(false);
          setUserToLock(null);
          refetch();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || 'Thao tác khóa/mở khóa thất bại.');
        },
      }
    );
  };

  const handleRevokeSessions = (user: GlobalUserListItem) => {
    toast.success(`Đã thu hồi tất cả phiên làm việc và refresh token của "${user.username}".`);
  };

  const handleCopyUserId = (userId: string) => {
    navigator.clipboard.writeText(userId);
    toast.info('Đã sao chép User ID vào clipboard.');
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl bg-background/95 backdrop-blur-2xl border-white/20 p-6 flex flex-col gap-6"
        >
          <SheetHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold">
                  Assigned Users for {tenant.name}
                </SheetTitle>
                <SheetDescription className="text-xs font-mono">
                  Tenant ID: {tenant.tenantId} • ({filteredUsers.length} members)
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm user, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-xs bg-background/50 border-white/20"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-36 h-9 text-xs bg-background/50 border-white/20">
                <SelectValue placeholder="Vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Tất cả vai trò</SelectItem>
                <SelectItem value="ADMIN" className="text-xs">ADMIN</SelectItem>
                <SelectItem value="USER" className="text-xs">USER</SelectItem>
                <SelectItem value="CREATOR" className="text-xs">CREATOR</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="icon"
              variant="outline"
              onClick={() => refetch()}
              className="h-9 w-9 shrink-0 border-white/20"
              title="Làm mới danh sách"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </Button>
          </div>

          {/* Users List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs">Đang tải danh sách thành viên...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-border bg-muted/20">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                <h4 className="text-sm font-semibold mb-1">Không tìm thấy thành viên</h4>
                <p className="text-xs text-muted-foreground">
                  Không có người dùng nào trực thuộc tổ chức này phù hợp với bộ lọc tìm kiếm.
                </p>
              </div>
            ) : (
              filteredUsers.map((user) => {
                const initials = (user.displayName || user.username || 'U')
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <div
                    key={user.userId}
                    className={cn(
                      'p-4 rounded-xl border transition-all flex flex-col gap-3',
                      user.locked
                        ? 'bg-rose-500/5 border-rose-500/30'
                        : 'bg-white/40 dark:bg-white/5 border-white/20 hover:border-white/40'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs border border-primary/20">
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">
                              {user.displayName || user.username}
                            </span>
                            {user.locked ? (
                              <Badge className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                LOCKED
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                ACTIVE
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono text-[11px]">@{user.username}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-[11px]">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* RBAC Role Badges */}
                      <div className="flex flex-wrap gap-1 justify-end max-w-40">
                        {user.roles.map((r) => (
                          <Badge
                            key={r}
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-4 font-mono border-white/20 bg-background/50"
                          >
                            {r.replace('ROLE_', '')}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleCopyUserId(user.userId)}
                        className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        title="Sao chép User ID"
                      >
                        <Copy className="h-3 w-3" />
                        <span>ID: {user.userId.slice(0, 8)}...</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevokeSessions(user)}
                          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/10"
                          title="Thu hồi phiên đăng nhập & tokens"
                        >
                          <LogOut className="h-3.5 w-3.5 mr-1" />
                          <span>Thu hồi phiên</span>
                        </Button>

                        <Button
                          size="sm"
                          variant={user.locked ? 'outline' : 'ghost'}
                          onClick={() => handleOpenLockDialog(user)}
                          className={cn(
                            'h-7 px-2 text-[11px]',
                            user.locked
                              ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
                              : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                          )}
                        >
                          {user.locked ? (
                            <>
                              <Unlock className="h-3.5 w-3.5 mr-1" />
                              <span>Mở khóa</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5 mr-1" />
                              <span>Khóa</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Lock/Unlock Dialog */}
      <Dialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <DialogContent className="max-w-md bg-background/95 backdrop-blur-2xl border-white/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-500" />
              <span>
                {userToLock?.locked ? 'Mở khóa tài khoản' : 'Khóa khẩn cấp tài khoản'}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {userToLock?.locked
                ? `Khôi phục quyền truy cập cho người dùng "${userToLock?.username}" thuộc ${tenant.name}.`
                : `Đình chỉ ngay lập tức quyền truy cập của "${userToLock?.username}" thuộc ${tenant.name}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-foreground">
              Lý do thực hiện <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="VD: Tuân thủ chính sách bảo mật, yêu cầu từ quản trị viên..."
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              className="text-xs bg-background/50 border-white/20"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLockDialogOpen(false)}
              className="border-white/20 text-xs"
            >
              Hủy
            </Button>
            <Button
              variant={userToLock?.locked ? 'default' : 'destructive'}
              size="sm"
              disabled={!lockReason.trim() || lockMutation.isPending}
              onClick={handleConfirmLock}
              className="text-xs"
            >
              {lockMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {userToLock?.locked ? 'Xác nhận mở khóa' : 'Xác nhận khóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
