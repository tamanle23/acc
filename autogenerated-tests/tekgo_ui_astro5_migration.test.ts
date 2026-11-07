import { describe, it, expect } from 'bun:test';
import { contentProvider } from '../apps/tekgo-ui/src/lib/cms/content-provider';
import { blogPostSchema, authorSchema } from '../apps/tekgo-ui/src/lib/types';
import { themeStore, setTheme } from '../apps/tekgo-ui/src/stores/theme';
import { isNavOpenStore, toggleNav, closeNav } from '../apps/tekgo-ui/src/stores/nav';
import { isSearchOpenStore, openSearch, closeSearch, toggleSearch } from '../apps/tekgo-ui/src/stores/search';
import { POST as newsletterHandler } from '../apps/tekgo-ui/src/pages/api/newsletter';
import { POST as revalidateHandler } from '../apps/tekgo-ui/src/pages/api/revalidate';

describe('tekgo-ui Astro 5 & Preact Migration Test Suite', () => {
  describe('Content Layer & Provider', () => {
    it('should load all blogs sorted by date descending', async () => {
      const blogs = await contentProvider.getAllBlogs();
      expect(blogs.length).toBeGreaterThan(0);

      // Verify chronological sorting (newest first)
      for (let i = 0; i < blogs.length - 1; i++) {
        const d1 = new Date(blogs[i].date).getTime();
        const d2 = new Date(blogs[i + 1].date).getTime();
        expect(d1).toBeGreaterThanOrEqual(d2);
      }
    });

    it('should find a post by slug with valid reading time and TOC', async () => {
      const slug = 'code-sample';
      const post = await contentProvider.getBlogBySlug(slug);
      expect(post).toBeDefined();
      if (!post) return;

      expect(post.slug).toBe(slug);
      expect(post.title).toBeDefined();
      expect(post.readingTime).toBeDefined();
      expect(post.readingTime.words).toBeGreaterThan(0);
      expect(Array.isArray(post.toc)).toBe(true);
      expect(post.structuredData['@type']).toBe('BlogPosting');
    });

    it('should calculate tag counts accurately across all published posts', async () => {
      const tags = await contentProvider.getTagData();
      expect(Object.keys(tags).length).toBeGreaterThan(0);
      for (const [tag, count] of Object.entries(tags)) {
        expect(typeof tag).toBe('string');
        expect(count).toBeGreaterThan(0);
      }
    });

    it('should load author profiles', async () => {
      const authors = await contentProvider.getAllAuthors();
      expect(authors.length).toBeGreaterThan(0);
      const defaultAuthor = authors.find((a) => a.slug === 'default');
      expect(defaultAuthor).toBeDefined();
      expect(defaultAuthor?.name).toBeDefined();
    });

    it('should validate blog post frontmatter against Zod schema', () => {
      const validDoc = {
        title: 'Test Article',
        date: '2026-11-07',
        tags: ['astro', 'preact'],
        summary: 'A test article summary',
      };
      const parsed = blogPostSchema.parse(validDoc);
      expect(parsed.title).toBe('Test Article');
      expect(parsed.tags).toEqual(['astro', 'preact']);
      expect(parsed.draft).toBe(false);
      expect(parsed.layout).toBe('PostLayout');
    });
  });

  describe('Nano Stores (Decoupled Cross-Island State)', () => {
    it('should initialize and update themeStore', () => {
      expect(themeStore.get()).toBeDefined();
      setTheme('dark');
      expect(themeStore.get()).toBe('dark');
      setTheme('light');
      expect(themeStore.get()).toBe('light');
      setTheme('system');
      expect(themeStore.get()).toBe('system');
    });

    it('should manage mobile navigation drawer state', () => {
      closeNav();
      expect(isNavOpenStore.get()).toBe(false);
      toggleNav();
      expect(isNavOpenStore.get()).toBe(true);
      closeNav();
      expect(isNavOpenStore.get()).toBe(false);
    });

    it('should manage search command palette modal state', () => {
      closeSearch();
      expect(isSearchOpenStore.get()).toBe(false);
      openSearch();
      expect(isSearchOpenStore.get()).toBe(true);
      toggleSearch();
      expect(isSearchOpenStore.get()).toBe(false);
    });
  });

  describe('WinterTC Web API Endpoints', () => {
    it('should accept valid newsletter subscription requests', async () => {
      const request = new Request('http://localhost:4321/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'developer@tekgo.io' }),
      });

      const response = await (newsletterHandler as any)({ request, redirect: () => {} });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.email).toBe('developer@tekgo.io');
    });

    it('should reject invalid newsletter emails', async () => {
      const request = new Request('http://localhost:4321/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      });

      const response = await (newsletterHandler as any)({ request, redirect: () => {} });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should enforce HMAC-SHA256 signature and replay protection on revalidate', async () => {
      const secret = process.env.UNIPOST_WEBHOOK_SECRET || 'acc-webhook-secret-token';
      const body = JSON.stringify({ slug: 'code-sample' });
      const timestamp = `${Math.floor(Date.now() / 1000)}`;

      // Compute HMAC-SHA256 via Web Crypto
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`));
      const signature = Array.from(new Uint8Array(sigBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // Test valid signature
      const validReq = new Request('http://localhost:4321/api/revalidate', {
        method: 'POST',
        headers: {
          'x-acc-signature': signature,
          'x-acc-timestamp': timestamp,
          'Content-Type': 'application/json',
        },
        body,
      });

      const validRes = await (revalidateHandler as any)({ request: validReq });
      expect(validRes.status).toBe(200);
      const resJson = await validRes.json();
      expect(resJson.revalidated).toBe(true);
      expect(resJson.target.slug).toBe('code-sample');

      // Test invalid signature
      const invalidReq = new Request('http://localhost:4321/api/revalidate', {
        method: 'POST',
        headers: {
          'x-acc-signature': 'invalid-tampered-signature',
          'x-acc-timestamp': timestamp,
          'Content-Type': 'application/json',
        },
        body,
      });
      const invalidRes = await (revalidateHandler as any)({ request: invalidReq });
      expect(invalidRes.status).toBe(401);

      // Test expired replay window
      const expiredTimestamp = `${Math.floor(Date.now() / 1000) - 400}`;
      const expiredReq = new Request('http://localhost:4321/api/revalidate', {
        method: 'POST',
        headers: {
          'x-acc-signature': signature,
          'x-acc-timestamp': expiredTimestamp,
          'Content-Type': 'application/json',
        },
        body,
      });
      const expiredRes = await (revalidateHandler as any)({ request: expiredReq });
      expect(expiredRes.status).toBe(401);
    });
  });
});
