import React, { useEffect, useState } from 'react';
import { announceToScreenReader } from '@/hooks/use-aria-announce';

/**
 * ScreenReaderLiveRegion provides invisible polite and assertive aria-live regions
 * for screen reader accessibility compliance (WCAG 2.2 AA).
 */
export const ScreenReaderLiveRegion: React.FC = () => {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  useEffect(() => {
    // Intercept toast or announcements if needed, or wire to announceToScreenReader
    const handleCustomAnnounce = (e: CustomEvent<{ message: string; priority?: 'polite' | 'assertive' }>) => {
      const { message, priority = 'polite' } = e.detail;
      if (priority === 'assertive') {
        setAssertiveMessage(message);
      } else {
        setPoliteMessage(message);
      }
    };

    window.addEventListener('acc-aria-announce' as any, handleCustomAnnounce as any);
    return () => {
      window.removeEventListener('acc-aria-announce' as any, handleCustomAnnounce as any);
    };
  }, []);

  return (
    <>
      <div
        id="a11y-live-polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only pointer-events-none fixed -top-96 -left-96 h-1 w-1 overflow-hidden"
      >
        {politeMessage}
      </div>
      <div
        id="a11y-live-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only pointer-events-none fixed -top-96 -left-96 h-1 w-1 overflow-hidden"
      >
        {assertiveMessage}
      </div>
    </>
  );
};
