import { useState, useEffect, useRef } from 'preact/hooks';
import siteMetadata from '@/data/siteMetadata';

export default function Comments({ slug }: { slug: string }) {
  const [loadComments, setLoadComments] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loadComments || !siteMetadata.comments?.provider) return;

    if (siteMetadata.comments.provider === 'giscus') {
      const config = siteMetadata.comments.giscusConfig;
      if (!config) return;

      const script = document.createElement('script');
      script.src = 'https://giscus.app/client.js';
      script.setAttribute('data-repo', config.repo || '');
      script.setAttribute('data-repo-id', config.repositoryId || '');
      script.setAttribute('data-category', config.category || '');
      script.setAttribute('data-category-id', config.categoryId || '');
      script.setAttribute('data-mapping', config.mapping || 'pathname');
      script.setAttribute('data-reactions-enabled', config.reactions || '1');
      script.setAttribute('data-emit-metadata', config.metadata || '0');
      script.setAttribute('data-input-position', 'bottom');
      script.setAttribute('data-theme', config.theme || 'preferred_color_scheme');
      script.setAttribute('data-lang', config.lang || 'en');
      script.crossOrigin = 'anonymous';
      script.async = true;

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(script);
      }
    }
  }, [loadComments, slug]);

  if (!siteMetadata.comments?.provider) {
    return null;
  }

  return (
    <div id="comment" className="pt-6 pb-6 text-center text-gray-700 dark:text-gray-300">
      {!loadComments && (
        <button
          type="button"
          onClick={() => setLoadComments(true)}
          className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-slate-900/50 px-5 py-2.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
        >
          Load Comments
        </button>
      )}
      <div ref={containerRef} className="giscus" />
    </div>
  );
}

