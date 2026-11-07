import type { APIRoute } from 'astro';
import { contentProvider } from '../lib/cms/content-provider';

export const GET: APIRoute = async () => {
  const blogs = await contentProvider.getAllBlogs();
  const searchDocs = blogs.map((b) => ({
    title: b.title,
    summary: b.summary,
    slug: b.slug,
    date: b.date,
    tags: b.tags,
  }));
  return new Response(JSON.stringify(searchDocs), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

