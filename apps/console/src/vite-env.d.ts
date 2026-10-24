/// <reference types="vite/client" />
import 'vitest';
import type { AxeResults } from 'axe-core';

declare module 'vitest' {
  export interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
  export interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}

interface ImportMetaEnv {
  readonly VITE_FACEBOOK_APP_ID?: string
  readonly VITE_FACEBOOK_APP_SECRET?: string
  readonly VITE_YOUTUBE_CLIENT_ID?: string
  readonly VITE_YOUTUBE_CLIENT_SECRET?: string
  readonly VITE_TIKTOK_CLIENT_KEY?: string
  readonly VITE_TIKTOK_CLIENT_SECRET?: string
  readonly VITE_ROUTER_MODE?: 'browser' | 'hash' | 'memory' | 'auto'
  readonly VITE_DESKTOP_ROUTER_MODE?: 'browser' | 'hash' | 'memory'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
