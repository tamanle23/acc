import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Standard shadcn class merger utility
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

