import React, { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, KeyRound, ShieldAlert } from 'lucide-react';
import { springApiClient } from '@/features/spring-auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { PasswordInput } from '@/components/password-input';

const rotationSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(12, 'New password must be at least 12 characters long')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords don't match",
    path: ['confirmPassword'],
  });

type RotationFormValues = z.infer<typeof rotationSchema>;

interface PasswordRotationModalProps {
  open: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
  username?: string;
}

export function PasswordRotationModal({
  open,
  onSuccess,
  onCancel,
  username,
}: PasswordRotationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RotationFormValues>({
    resolver: zodResolver(rotationSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: RotationFormValues) => {
    setIsSubmitting(true);
    try {
      await springApiClient.post('/auth/password/rotate', {
        username,
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success('Password changed successfully! You may now proceed.');
      form.reset();
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to rotate password. Please verify current password.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val && onCancel) onCancel(); }}>
      <DialogContent className="sm:max-w-md backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border border-white/30 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Mandatory Password Rotation</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Initial sovereign seed or security policy requires you to set a new password.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 mt-2">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temporary / Current Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="Current password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Secure Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="Min 12 chars, upper, lower, digit, symbol" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="Confirm new password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              {onCancel && (
                <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Rotate Password & Continue
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
