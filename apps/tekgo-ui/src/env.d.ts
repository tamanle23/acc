/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module 'refractor' {
  export const refractor: {
    registered(lang: string): boolean;
    highlight(code: string, lang: string): any;
  };
}
