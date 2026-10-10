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
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { useCreateSystemRole } from '../api/use-system-fleet';

interface RoleDefinitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoleDefinitionModal({ open, onOpenChange }: RoleDefinitionModalProps) {
  const [roleName, setRoleName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [description, setDescription] = useState('');
  const createRoleMutation = useCreateSystemRole();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim() || !roleId.trim()) return;

    createRoleMutation.mutate(
      {
        roleId,
        roleName: roleName.trim(),
        description: description.trim(),
        inheritedRoles: ['ROLE_USER'],
        permissions: [],
      },
      {
        onSuccess: () => {
          setRoleName('');
          setRoleId('');
          setDescription('');
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-background/95 backdrop-blur-2xl border-white/20 dark:border-white/10 shadow-2xl">
        <form onSubmit={handleCreate}>
          <DialogHeader className="gap-1">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" />
              <span>RBAC Governance Studio</span>
            </div>
            <DialogTitle className="text-xl">Create Custom Sovereign Role</DialogTitle>
            <DialogDescription>
              Define a new tenant-level or fleet-level role with declarative DAG inheritance.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="role-name">Role Display Name</Label>
              <Input
                id="role-name"
                placeholder="e.g. Compliance Auditor"
                value={roleName}
                onChange={(e) => {
                  setRoleName(e.target.value);
                  setRoleId('ROLE_' + e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
                }}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role-id">Canonical Role Key</Label>
              <Input
                id="role-id"
                value={roleId}
                readOnly
                className="bg-muted/40 font-mono text-sm"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role-desc">Description</Label>
              <Input
                id="role-desc"
                placeholder="e.g. Granted read-only schema inspection and export rights"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Visual DAG Inheritance Preview */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>Inheritance DAG Flow:</span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  Direct Inheritance
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono p-2 rounded bg-background/80 border">
                <Badge variant="secondary">ROLE_USER</Badge>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge variant="default">{roleId || 'ROLE_CUSTOM'}</Badge>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createRoleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!roleName.trim() || createRoleMutation.isPending}
              className="gap-1.5"
            >
              {createRoleMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Provisioning...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Create Role
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
