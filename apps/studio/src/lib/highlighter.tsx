/**
 * Lightweight Zero-Dependency JSON Code Highlighter Shim.
 * Replaces Shiki TextMate grammars and Oniguruma/WASM runtime with pure deterministic tokenization.
 */
import { tokenizeJsonLine, type JsonToken } from '../components/debugger/code-editor/jsonTokenizer';

export interface HighlightedToken {
  content: string;
  style?: string | Record<string, string>;
}

export async function highlightCode(
  code: string,
  _language = 'json'
): Promise<HighlightedToken[][] | null> {
  const lines = code.split('\n');
  return lines.map((line) => {
    const tokens = tokenizeJsonLine(line);
    return tokens.map((t) => ({
      content: t.text,
      style: t.type,
    }));
  });
}
