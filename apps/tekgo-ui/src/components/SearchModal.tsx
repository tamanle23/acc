import { useState, useEffect, useRef } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { isSearchOpenStore, closeSearch, toggleSearch } from '../stores/search';

interface SearchDoc {
  title: string;
  summary?: string;
  slug: string;
  date?: string;
  tags?: string[];
}

export default function SearchModal() {
  const isOpen = useStore(isSearchOpenStore);
  const [query, setQuery] = useState('');
  const [docs, setDocs] = useState<SearchDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleSearch();
      } else if (e.key === 'Escape' && isOpen) {
        closeSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 50);

      if (docs.length === 0 && !loading) {
        setLoading(true);
        fetch('/search.json')
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => {
            setDocs(Array.isArray(data) ? data : []);
            setLoading(false);
          })
          .catch(() => {
            setLoading(false);
          });
      }
    } else {
      document.body.style.overflow = '';
      setQuery('');
    }
  }, [isOpen]);

  const filteredDocs =
    query.trim() === ''
      ? docs.slice(0, 5)
      : docs.filter((doc) => {
          const text = `${doc.title} ${doc.summary || ''} ${(doc.tags || []).join(' ')}`.toLowerCase();
          return text.includes(query.toLowerCase());
        });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={closeSearch}
      />

      {/* Modal Dialog */}
      <div className="glass-modal relative z-50 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl transition-all">
        {/* Search Input Box */}
        <div className="flex items-center border-b border-black/10 dark:border-white/10 px-4 py-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5 text-gray-400 mr-3"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search articles, tags, or topics (Cmd+K)..."
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            className="w-full bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none dark:text-gray-100 text-base"
          />
          <button
            type="button"
            onClick={closeSearch}
            className="ml-2 text-xs rounded border border-gray-300 dark:border-gray-700 px-1.5 py-0.5 text-gray-500 dark:text-gray-400"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-black/5 dark:divide-white/5">
          {loading && (
            <div className="py-6 text-center text-sm text-gray-500">Loading search index...</div>
          )}
          {!loading && filteredDocs.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">
              No results found for "{query}".
            </div>
          )}
          {!loading &&
            filteredDocs.map((doc) => (
              <a
                key={doc.slug}
                href={`/blog/${doc.slug}`}
                onClick={closeSearch}
                className="group flex flex-col p-3 rounded-xl hover:bg-primary-500/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-500 dark:group-hover:text-primary-400">
                    {doc.title}
                  </span>
                  {doc.date && (
                    <span className="text-xs text-gray-400">
                      {new Date(doc.date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {doc.summary && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-1">
                    {doc.summary}
                  </p>
                )}
              </a>
            ))}
        </div>
      </div>
    </div>
  );
}
