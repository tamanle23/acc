import { useState, useEffect, useRef } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { themeStore, setTheme, type Theme } from '../stores/theme';

const Sun = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-6 w-6"
  >
    <path
      fillRule="evenodd"
      d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
      clipRule="evenodd"
    />
  </svg>
);

const Moon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-6 w-6"
  >
    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
  </svg>
);

const Monitor = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-6 w-6"
  >
    <rect x="3" y="3" width="14" height="10" rx="2" ry="2"></rect>
    <line x1="7" y1="17" x2="13" y2="17"></line>
    <line x1="10" y1="13" x2="10" y2="17"></line>
  </svg>
);

export default function ThemeSwitch() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const theme = useStore(themeStore);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const stored = (localStorage.getItem('theme') as Theme) || 'system';
    setTheme(stored);

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDark =
    mounted &&
    (theme === 'dark' ||
      (theme === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches));

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        aria-label="Theme switcher"
        onClick={() => setIsOpen(!isOpen)}
        className="hover:text-primary-500 dark:hover:text-primary-400 flex items-center justify-center p-1 text-gray-900 transition-colors dark:text-gray-100"
      >
        {mounted ? isDark ? <Moon /> : <Sun /> : <span className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="glass-modal absolute right-0 z-50 mt-2 w-32 origin-top-right rounded-2xl p-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10">
          <button
            type="button"
            onClick={() => {
              setTheme('light');
              setIsOpen(false);
            }}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
              theme === 'light'
                ? 'bg-primary-500 text-white font-medium'
                : 'text-gray-700 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10'
            }`}
          >
            <Sun />
            <span>Light</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTheme('dark');
              setIsOpen(false);
            }}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
              theme === 'dark'
                ? 'bg-primary-500 text-white font-medium'
                : 'text-gray-700 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10'
            }`}
          >
            <Moon />
            <span>Dark</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTheme('system');
              setIsOpen(false);
            }}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
              theme === 'system'
                ? 'bg-primary-500 text-white font-medium'
                : 'text-gray-700 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10'
            }`}
          >
            <Monitor />
            <span>System</span>
          </button>
        </div>
      )}
    </div>
  );
}

