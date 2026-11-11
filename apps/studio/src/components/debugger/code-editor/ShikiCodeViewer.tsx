/**
 * ShikiCodeViewer (Legacy Compatibility Facade):
 * Re-exports the high-performance, zero-dependency JsonCodeViewer to completely
 * eliminate Shiki TextMate grammars, Oniguruma/WASM, and JS regex engine heap overhead.
 */
export {
  JsonCodeViewer as ShikiCodeViewer,
  JsonCodeViewer,
  type JsonCodeViewerProps as ShikiCodeViewerProps,
  type JsonToken,
  type JsonTokenType,
  tokenizeJsonLine,
  getTokenClass,
} from './JsonCodeViewer';

export { JsonCodeViewer as default } from './JsonCodeViewer';
