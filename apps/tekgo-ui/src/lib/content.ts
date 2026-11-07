import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readingTime from 'reading-time';
import GithubSlugger from 'github-slugger';
import siteMetadata from '@/data/siteMetadata';
import type { Blog, Authors, TocItem, CoreContent } from './types';
import { blogPostSchema, authorSchema } from './types';

export type { Blog, Authors, TocItem, CoreContent };

const dataDir = fileURLToPath(new URL('../../data', import.meta.url));

export function extractTocFromPortableText(blocks: any[]): TocItem[] {
  const toc: TocItem[] = [];
  if (!Array.isArray(blocks)) return toc;

  const slugger = new GithubSlugger();

  for (const block of blocks) {
    if (
      block._type === 'block' &&
      typeof block.style === 'string' &&
      block.style.match(/^h[1-6]$/)
    ) {
      const depth = parseInt(block.style.charAt(1), 10);
      const text = block.children?.map((child: any) => child.text).join('') || '';
      const url = '#' + slugger.slug(text);
      toc.push({ value: text, url, depth });
    }
  }
  return toc;
}

function getFilesRecursively(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath));
    } else {
      if (filePath.endsWith('.json')) {
        results.push(filePath);
      }
    }
  }
  return results;
}

function loadBlogs(): Blog[] {
  const blogDir = path.join(dataDir, 'blog');
  const files = getFilesRecursively(blogDir);

  return files.map((filePath) => {
    const raw = fs.readFileSync(filePath, 'utf8');
    const doc = JSON.parse(raw);
    const validated = blogPostSchema.parse(doc);

    const relativePath = path
      .relative(dataDir, filePath)
      .replace(/\\/g, '/');

    const flattenedPath = relativePath.replace(/\.json$/, '');
    const slug = flattenedPath.replace(/^.+?(\/)/, '');
    const docToc = extractTocFromPortableText(validated.portableTextBody || []);

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: validated.title,
      datePublished: validated.date,
      dateModified: validated.lastmod || validated.date,
      description: validated.summary,
      image: validated.images
        ? Array.isArray(validated.images)
          ? validated.images[0]
          : validated.images
        : siteMetadata.socialBanner,
      url: `${siteMetadata.siteUrl}/${flattenedPath}`,
    };

    return {
      ...validated,
      slug,
      path: flattenedPath,
      filePath: relativePath,
      readingTime: readingTime(JSON.stringify(validated.portableTextBody || '')),
      toc: docToc,
      structuredData,
    };
  });
}

function loadAuthors(): Authors[] {
  const authorDir = path.join(dataDir, 'authors');
  const files = getFilesRecursively(authorDir);

  return files.map((filePath) => {
    const raw = fs.readFileSync(filePath, 'utf8');
    const doc = JSON.parse(raw);
    const validated = authorSchema.parse(doc);

    const relativePath = path
      .relative(dataDir, filePath)
      .replace(/\\/g, '/');
    const flattenedPath = relativePath.replace(/\.json$/, '');
    const slug = flattenedPath.replace(/^.+?(\/)/, '');

    return {
      ...validated,
      slug,
      path: flattenedPath,
      filePath: relativePath,
      readingTime: readingTime(JSON.stringify(validated.portableTextBody || '')),
    };
  });
}

export const allBlogs = loadBlogs();
export const allAuthors = loadAuthors();

export const tagData = (() => {
  const tagCount: Record<string, number> = {};
  const slugger = new GithubSlugger();
  allBlogs.forEach((file) => {
    if (file.tags && file.draft !== true) {
      file.tags.forEach((tag) => {
        const formattedTag = slugger.slug(tag);
        tagCount[formattedTag] = (tagCount[formattedTag] || 0) + 1;
      });
    }
  });
  return tagCount;
})();

export function sortPosts(posts: Blog[]): Blog[] {
  return [...posts].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

export function coreContent<T extends { portableTextBody?: any; structuredData?: any }>(
  content: T
): Omit<T, 'portableTextBody' | 'structuredData'> {
  const { portableTextBody, structuredData, ...core } = content;
  return core as Omit<T, 'portableTextBody' | 'structuredData'>;
}

export function allCoreContent<T extends { portableTextBody?: any; structuredData?: any }>(
  contents: T[]
): Omit<T, 'portableTextBody' | 'structuredData'>[] {
  return contents.map((c) => coreContent(c));
}
