import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  BellOff,
  CheckCheck,
  Settings,
  Workflow,
  UserCheck,
  AlertTriangle,
  ShieldAlert,
  CreditCard,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { useNotificationStore } from '../store/use-notification-store';
import type { NotificationItem, NotificationCategory } from '../types';

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'workflow' | 'system'>('all');
  const navigate = useNavigate();

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    isConnected,
  } = useNotificationStore();

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filterTab === 'unread') return !n.read;
      if (filterTab === 'workflow') return n.category === 'workflow' || n.category === 'approval';
      if (filterTab === 'system') return n.category === 'system' || n.category === 'security';
      return true;
    });
  }, [notifications, filterTab]);

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'workflow':
        return <Workflow className="size-3.5 text-blue-500" />;
      case 'approval':
        return <UserCheck className="size-3.5 text-amber-500" />;
      case 'security':
        return <ShieldAlert className="size-3.5 text-rose-500" />;
      case 'billing':
        return <CreditCard className="size-3.5 text-emerald-500" />;
      case 'system':
      default:
        return <AlertTriangle className="size-3.5 text-orange-500" />;
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    markAsRead(item.id);
    if (item.actionUrl) {
      setOpen(false);
      navigate({ to: item.actionUrl as any });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 rounded-full hover:bg-white/40 dark:hover:bg-white/10"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
        >
          <Bell className="size-4 text-foreground/80" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow-xs animate-in zoom-in-75"
              aria-hidden="true"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          {isConnected && (
            <span
              className="absolute bottom-1 right-1 size-1.5 rounded-full bg-emerald-500 ring-1 ring-background"
              title="Real-Time Event Stream Connected"
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 rounded-2xl bg-white/75 dark:bg-slate-900/75 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-bold">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                title="Mark all as read"
              >
                <CheckCheck className="size-3.5" />
                <span>Mark all read</span>
              </Button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 p-2 bg-muted/40 border-b border-border/30 text-xs overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'workflow', label: 'Workflows' },
              { id: 'system', label: 'System' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-all whitespace-nowrap ${
                filterTab === tab.id
                  ? 'bg-background shadow-xs text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.id === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <ScrollArea className="h-[300px]">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <BellOff className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs font-medium">No notifications in this view</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                Real-time events will stream here automatically.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 transition-colors cursor-pointer flex gap-3 items-start relative hover:bg-muted/50 ${
                    !item.read
                      ? 'bg-primary/5 dark:bg-primary/10'
                      : 'bg-transparent opacity-85'
                  }`}
                >
                  {!item.read && (
                    <span
                      className="absolute left-1 top-4 size-1.5 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                  )}
                  <div className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-white/40 dark:bg-white/10 border border-white/20 dark:border-white/10 shrink-0 shadow-2xs">
                    {getCategoryIcon(item.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {item.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                      {item.message}
                    </p>
                    {item.actionUrl && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-primary font-medium hover:underline">
                        <span>View Details</span>
                        <ExternalLink className="size-2.5" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <Separator />
        <div className="flex items-center justify-between p-2 px-3 bg-muted/20 text-xs text-muted-foreground">
          <Link
            to="/settings/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors text-[11px]"
          >
            <Settings className="size-3.5" />
            <span>Notification Settings</span>
          </Link>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive gap-1"
            >
              <Trash2 className="size-3" />
              <span>Clear</span>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
