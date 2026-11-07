import GithubSlugger from 'github-slugger';

export function formatDate(date: string, locale = 'en-US'): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return new Date(date).toLocaleDateString(locale, options);
}

export function slug(text: string): string {
  return new GithubSlugger().slug(text);
}
