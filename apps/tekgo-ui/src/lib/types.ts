import { z } from 'zod';

export const blogPostSchema = z.object({
  title: z.string().default('Untitled Post'),
  date: z.string(),
  tags: z.array(z.string()).default([]),
  lastmod: z.string().optional(),
  draft: z.boolean().default(false),
  summary: z.string().optional(),
  images: z.union([z.string(), z.array(z.string())]).optional(),
  authors: z.array(z.string()).default(['default']),
  layout: z.string().default('PostLayout'),
  bibliography: z.string().optional(),
  canonicalUrl: z.string().optional(),
  portableTextBody: z.any().optional(),
});

export const authorSchema = z.object({
  name: z.string(),
  avatar: z.string().optional(),
  occupation: z.string().optional(),
  company: z.string().optional(),
  email: z.string().optional(),
  twitter: z.string().optional(),
  bluesky: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  layout: z.string().optional(),
  portableTextBody: z.any().optional(),
});

export type BlogPostInput = z.infer<typeof blogPostSchema>;
export type AuthorInput = z.infer<typeof authorSchema>;

export interface TocItem {
  value: string;
  url: string;
  depth: number;
}

export interface ReadingTimeResult {
  text: string;
  minutes: number;
  time: number;
  words: number;
}

export interface Blog extends BlogPostInput {
  slug: string;
  path: string;
  filePath: string;
  readingTime: ReadingTimeResult;
  toc: TocItem[];
  structuredData: Record<string, any>;
}

export interface Authors extends AuthorInput {
  slug: string;
  path: string;
  filePath: string;
  readingTime?: ReadingTimeResult;
}

export type CoreContent<T> = Omit<T, 'portableTextBody' | 'structuredData'>;

