import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { blogPostSchema, authorSchema } from './lib/types';

export const collections = {
  blog: defineCollection({
    loader: glob({ pattern: '**/*.json', base: './data/blog' }),
    schema: blogPostSchema,
  }),
  authors: defineCollection({
    loader: glob({ pattern: '**/*.json', base: './data/authors' }),
    schema: authorSchema,
  }),
};
