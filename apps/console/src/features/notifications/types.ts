export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';

export type NotificationCategory =
  | 'workflow'
  | 'approval'
  | 'system'
  | 'security'
  | 'billing';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  category: NotificationCategory;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  type: 'all' | 'mentions' | 'none';
  browserToasts?: boolean;
  workflowAlerts?: boolean;
  securityAlerts?: boolean;
  communicationEmails?: boolean;
  socialEmails?: boolean;
  marketingEmails?: boolean;
}
