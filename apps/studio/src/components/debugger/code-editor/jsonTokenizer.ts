export type JsonTokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation' | 'text';

export interface JsonToken {
  type: JsonTokenType;
  text: string;
}

const JSON_TOKEN_REGEX = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:])/g;

/**
 * Ultra-fast zero-dependency synchronous JSON tokenizer.
 * Replaces heavy Shiki TextMate/WASM parsers with a 0.1ms deterministic regex lexer.
 */
export function tokenizeJsonLine(line: string): JsonToken[] {
  if (!line || line.length === 0) {
    return [{ type: 'text', text: '' }];
  }

  const tokens: JsonToken[] = [];
  let lastIndex = 0;
  JSON_TOKEN_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = JSON_TOKEN_REGEX.exec(line)) !== null) {
    // Intervening whitespace or plain text
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        text: line.slice(lastIndex, match.index),
      });
    }

    const raw = match[0];
    let tokenType: JsonTokenType = 'text';

    if (raw.startsWith('"')) {
      if (raw.endsWith(':')) {
        tokenType = 'key';
      } else {
        tokenType = 'string';
      }
    } else if (raw === 'true' || raw === 'false') {
      tokenType = 'boolean';
    } else if (raw === 'null') {
      tokenType = 'null';
    } else if (/^[{}\[\],:]$/.test(raw)) {
      tokenType = 'punctuation';
    } else if (/^-?\d/.test(raw)) {
      tokenType = 'number';
    }

    tokens.push({
      type: tokenType,
      text: raw,
    });

    lastIndex = JSON_TOKEN_REGEX.lastIndex;
  }

  // Trailing whitespace or text
  if (lastIndex < line.length) {
    tokens.push({
      type: 'text',
      text: line.slice(lastIndex),
    });
  }

  return tokens;
}

export function getTokenClass(type: JsonTokenType): string {
  switch (type) {
    case 'key':
      return 'text-cyan-500 dark:text-cyan-400 font-semibold';
    case 'string':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'number':
      return 'text-amber-600 dark:text-amber-400';
    case 'boolean':
      return 'text-purple-600 dark:text-purple-400 font-medium';
    case 'null':
      return 'text-rose-500/80 dark:text-rose-400/80 italic';
    case 'punctuation':
      return 'text-muted-foreground/70';
    default:
      return 'text-foreground';
  }
}
