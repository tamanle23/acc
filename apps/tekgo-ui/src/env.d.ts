/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module 'refractor' {
  const refractor: {
    registered(lang: string): boolean;
    highlight(code: string, lang: string): any;
  };
  export default refractor;
}
