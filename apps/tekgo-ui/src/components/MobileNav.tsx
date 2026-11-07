import { useState, useEffect } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { isNavOpenStore, toggleNav, closeNav } from '../stores/nav';
import headerNavLinks from '@/data/headerNavLinks';

export default function MobileNav() {
  const [mounted, setMounted] = useState(false);
  const isOpen = useStore(isNavOpenStore);

  useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeNav();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  if (!mounted) {
    return (
      <button aria-label="Toggle Menu" className="sm:hidden p-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-8 w-8 text-gray-900 dark:text-gray-100"
        >
          <path
            fillRule="evenodd"
            d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    );
  }

  return (
    <>
      <button
        aria-label="Toggle Menu"
        onClick={toggleNav}
        className="sm:hidden p-1 text-gray-900 hover:text-primary-500 dark:text-gray-100 dark:hover:text-primary-400 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-8 w-8"
        >
          <path
            fillRule="evenodd"
            d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex sm:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={closeNav}
          />
          <div className="relative z-50 flex h-full w-full flex-col bg-white/95 p-8 shadow-2xl backdrop-blur-2xl dark:bg-slate-950/95">
            <div className="flex items-center justify-end">
              <button
                type="button"
                aria-label="Close Menu"
                onClick={closeNav}
                className="hover:text-primary-500 dark:hover:text-primary-400 p-2 text-gray-900 dark:text-gray-100"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-8 w-8"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <nav className="mt-8 flex flex-col space-y-6">
              {headerNavLinks.map((link) => (
                <a
                  key={link.title}
                  href={link.href}
                  onClick={closeNav}
                  className="hover:text-primary-500 dark:hover:text-primary-400 text-3xl font-bold tracking-wide text-gray-900 transition-colors dark:text-gray-100"
                >
                  {link.title}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

