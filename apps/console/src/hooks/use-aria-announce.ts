import { useState, useCallback } from 'react';

type AnnouncementPriority = 'polite' | 'assertive';

interface AnnouncementState {
  message: string;
  priority: AnnouncementPriority;
  timestamp: number;
}

// Global listener registry so non-React mutations or utility calls can announce
type AnnouncementListener = (announcement: AnnouncementState) => void;
const listeners = new Set<AnnouncementListener>();

export function announceToScreenReader(message: string, priority: AnnouncementPriority = 'polite') {
  if (!message) return;
  const announcement: AnnouncementState = {
    message,
    priority,
    timestamp: Date.now(),
  };
  listeners.forEach((listener) => listener(announcement));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('acc-aria-announce', {
        detail: { message, priority },
      })
    );
  }
}

/**
 * Hook providing programmatic aria live announcements and the current announcement state.
 */
export function useAriaAnnounce() {
  const [announcement, setAnnouncement] = useState<AnnouncementState>({
    message: '',
    priority: 'polite',
    timestamp: 0,
  });

  const announce = useCallback((message: string, priority: AnnouncementPriority = 'polite') => {
    announceToScreenReader(message, priority);
    setAnnouncement({
      message,
      priority,
      timestamp: Date.now(),
    });
  }, []);

  return { announce, announcement };
}
