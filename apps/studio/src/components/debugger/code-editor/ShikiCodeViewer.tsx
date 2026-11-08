import { createSignal, createEffect, onCleanup, For, Show, type JSX } from 'solid-js';
import { highlightCode, type HighlightedToken } from '../../../lib/highlighter';

export interface ShikiCodeViewerProps {
  code: string;
  onChange: (newCode: string) => void;
  errorLines?: number[];
  class?: string;
  className?: string;
  readOnly?: boolean;
}

export function ShikiCodeViewer(props: ShikiCodeViewerProps) {
  let textareaRef: HTMLTextAreaElement | undefined;
  let preRef: HTMLPreElement | undefined;
  const [highlightedLines, setHighlightedLines] = createSignal<HighlightedToken[][] | null>(null);

  const lines = () => props.code.split('\n');
  const lineCount = () => lines().length;
  const errorLines = () => props.errorLines || [];

  createEffect(() => {
    let active = true;
    const currentCode = props.code;
    highlightCode(currentCode, 'json')
      .then((res) => {
        if (active && res) {
          setHighlightedLines(res);
        }
      })
      .catch(() => {
        // Fallback
      });

    onCleanup(() => {
      active = false;
    });
  });

  const handleScroll = (e: Event & { currentTarget: HTMLTextAreaElement }) => {
    if (preRef) {
      preRef.scrollTop = e.currentTarget.scrollTop;
      preRef.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  return (
    <div
      class={`relative flex flex-1 h-full overflow-hidden font-mono bg-transparent text-xs ${
        props.class || props.className || ''
      }`}
    >
      {/* Line Numbers with Gutter Indicators */}
      <div
        aria-hidden="true"
        class="select-none py-3 px-2 text-right border-r border-glass-border bg-glass-surface/50 font-mono text-[11px] leading-[1.4rem] shrink-0 text-muted-foreground/60 w-12 backdrop-blur-xs"
      >
        <For each={Array.from({ length: Math.max(1, lineCount()) })}>
          {(_, i) => {
            const lineNum = i() + 1;
            const isError = () => errorLines().includes(lineNum);
            return (
              <div
                class={`flex items-center justify-end gap-1 ${
                  isError() ? 'text-rose-400 font-bold bg-rose-500/20 -mx-2 px-2' : ''
                }`}
              >
                <Show when={isError()}>
                  <span class="w-1.5 h-1.5 rounded-full bg-rose-500" />
                </Show>
                <span>{lineNum}</span>
              </div>
            );
          }}
        </For>
      </div>

      {/* Editor Body */}
      <div class="relative flex-1 h-full overflow-hidden">
        {/* Shiki Highlighted Overlay behind textarea */}
        <pre
          ref={preRef}
          aria-hidden="true"
          class="absolute inset-0 pointer-events-none p-3 m-0 font-mono text-[11px] leading-[1.4rem] overflow-hidden whitespace-pre tab-4 select-none opacity-90 z-0 text-foreground"
        >
          <Show
            when={highlightedLines()}
            fallback={<code>{props.code}</code>}
          >
            {(tokenLines) => (
              <For each={tokenLines()}>
                {(lineTokens) => (
                  <div class="min-h-[1.4rem]">
                    {lineTokens.length === 0 ? (
                      '\n'
                    ) : (
                      <For each={lineTokens}>
                        {(token) => (
                          <span
                            style={token.style as JSX.CSSProperties}
                            class="text-(--shiki-light) dark:text-(--shiki-dark)"
                          >
                            {token.content}
                          </span>
                        )}
                      </For>
                    )}
                  </div>
                )}
              </For>
            )}
          </Show>
        </pre>

        {/* Interactive Textarea (Caret & Typing) */}
        <textarea
          ref={textareaRef}
          value={props.code}
          readOnly={props.readOnly}
          onInput={(e: InputEvent & { currentTarget: HTMLTextAreaElement }) =>
            props.onChange(e.currentTarget.value)
          }
          onScroll={handleScroll}
          spellcheck={false}
          autocapitalize="off"
          autocomplete="off"
          autocorrect="off"
          class="absolute inset-0 w-full h-full p-3 font-mono text-[11px] leading-[1.4rem] bg-transparent text-transparent caret-foreground focus:outline-hidden resize-none whitespace-pre overflow-auto tab-4 z-10 selection:bg-accent-theme/30 selection:text-foreground"
        />
      </div>
    </div>
  );
}
