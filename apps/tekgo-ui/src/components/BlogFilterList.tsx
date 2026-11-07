import { useState } from 'preact/hooks';
import type { CoreContent, Blog } from '../lib/types';
import { formatDate, slug } from '../lib/utils';
import siteMetadata from '@/data/siteMetadata';

interface PaginationProps {
  totalPages: number;
  currentPage: number;
  basePath?: string;
}

interface BlogFilterListProps {
  posts: CoreContent<Blog>[];
  title?: string;
  initialDisplayPosts?: CoreContent<Blog>[];
  pagination?: PaginationProps;
}

export default function BlogFilterList({
  posts,
  title,
  initialDisplayPosts = [],
  pagination,
}: BlogFilterListProps) {
  const [searchValue, setSearchValue] = useState('');

  const filteredBlogPosts = posts.filter((post) => {
    const searchContent = `${post.title} ${post.summary || ''} ${(post.tags || []).join(' ')}`;
    return searchContent.toLowerCase().includes(searchValue.toLowerCase());
  });

  const displayPosts =
    initialDisplayPosts.length > 0 && !searchValue ? initialDisplayPosts : filteredBlogPosts;

  const basePath = pagination?.basePath || 'blog';

  return (
    <>
      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        <div className="space-y-2 pt-6 pb-8 md:space-y-5">
          {title && (
            <h1 className="text-3xl leading-9 font-extrabold tracking-tight text-gray-900 sm:text-4xl sm:leading-10 md:text-6xl md:leading-14 dark:text-gray-100">
              {title}
            </h1>
          )}
          <div className="relative max-w-lg">
            <label>
              <span className="sr-only">Search articles</span>
              <input
                aria-label="Search articles"
                type="text"
                value={searchValue}
                onInput={(e) => setSearchValue((e.target as HTMLInputElement).value)}
                placeholder="Search articles"
                className="focus:border-primary-500 focus:ring-primary-500 block w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-2 text-gray-900 backdrop-blur-md dark:border-gray-800 dark:bg-slate-900/70 dark:text-gray-100"
              />
            </label>
            <svg
              className="absolute top-3 right-3 h-5 w-5 text-gray-400 dark:text-gray-300"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
          {!filteredBlogPosts.length && (
            <li className="py-6 text-gray-500 dark:text-gray-400">No posts found.</li>
          )}
          {displayPosts.map((post) => {
            const { slug: postSlug, date, title: postTitle, summary, tags } = post;
            return (
              <li key={postSlug} className="py-6">
                <article className="space-y-2 xl:grid xl:grid-cols-4 xl:items-baseline xl:space-y-0">
                  <dl>
                    <dt className="sr-only">Published on</dt>
                    <dd className="text-base leading-6 font-medium text-gray-500 dark:text-gray-400">
                      <time dateTime={date}>{formatDate(date, siteMetadata.locale)}</time>
                    </dd>
                  </dl>
                  <div className="space-y-3 xl:col-span-3">
                    <div>
                      <h3 className="text-2xl leading-8 font-bold tracking-tight">
                        <a
                          href={`/blog/${postSlug}`}
                          className="text-gray-900 transition-colors hover:text-primary-500 dark:text-gray-100 dark:hover:text-primary-400"
                        >
                          {postTitle}
                        </a>
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {tags?.map((t) => (
                          <a
                            key={t}
                            href={`/tags/${slug(t)}`}
                            className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 text-sm font-medium uppercase tracking-wider mr-3"
                          >
                            #{t}
                          </a>
                        ))}
                      </div>
                    </div>
                    {summary && (
                      <div className="prose max-w-none text-gray-500 dark:text-gray-400">
                        {summary}
                      </div>
                    )}
                    <div className="text-base font-medium leading-6">
                      <a
                        href={`/blog/${postSlug}`}
                        className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
                        aria-label={`Read "${postTitle}"`}
                      >
                        Read more &rarr;
                      </a>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
      {pagination && pagination.totalPages > 1 && !searchValue && (
        <div className="space-y-2 pt-6 pb-8 md:space-y-5">
          <nav className="flex justify-between">
            {pagination.currentPage > 1 ? (
              <a
                href={
                  pagination.currentPage - 1 === 1
                    ? `/${basePath}`
                    : `/${basePath}/page/${pagination.currentPage - 1}`
                }
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-slate-800 transition-colors"
                rel="prev"
              >
                Previous
              </a>
            ) : (
              <button
                disabled
                className="cursor-not-allowed opacity-50 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-700"
              >
                Previous
              </button>
            )}
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 self-center">
              {pagination.currentPage} of {pagination.totalPages}
            </span>
            {pagination.currentPage < pagination.totalPages ? (
              <a
                href={`/${basePath}/page/${pagination.currentPage + 1}`}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-slate-800 transition-colors"
                rel="next"
              >
                Next
              </a>
            ) : (
              <button
                disabled
                className="cursor-not-allowed opacity-50 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-700"
              >
                Next
              </button>
            )}
          </nav>
        </div>
      )}
    </>
  );
}

