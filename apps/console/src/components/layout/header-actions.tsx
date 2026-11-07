import { Search } from '@/components/search';
import { LanguageSwitch } from '@/components/language-switch';
import { ThemeSwitch } from '@/components/theme-switch';
import { ConfigDrawer } from '@/components/config-drawer';
import { ProfileDropdown } from '@/components/profile-dropdown';
import { NotificationDropdown } from '@/features/notifications';

interface HeaderActionsProps {
  className?: string;
}

export function HeaderActions({ className }: HeaderActionsProps) {
  return (
    <div className={`ms-auto flex items-center space-x-4 ${className || ''}`}>
      <Search />
      <NotificationDropdown />
      <LanguageSwitch />
      <ThemeSwitch />
      <ConfigDrawer />
      <ProfileDropdown />
    </div>
  );
}
