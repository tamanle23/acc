import { createSignal, createEffect, Show, For } from 'solid-js';
import { Check, X, Edit3 } from 'lucide-solid';
import { type JsonPath } from '../types';

export interface VisualJsonFieldEditorProps {
  fieldKey: string;
  value: unknown;
  path: JsonPath;
  onUpdate: (path: JsonPath, newValue: unknown) => void;
  disabled?: boolean;
}

// Known enum suggestions for common VideoIR fields
const KNOWN_ENUMS: Record<string, string[]> = {
  fit: ['contain', 'cover', 'fill', 'none'],
  type: ['video', 'audio', 'text', 'overlay', 'subtitle', 'image'],
  anchor: ['center', 'top-left', 'top', 'top-right', 'bottom-left', 'bottom', 'bottom-right'],
  direction: ['left', 'right', 'up', 'down'],
  mode: ['crossfade', 'dip', 'wipe', 'push', 'zoom', 'glitch', 'light_leak', 'radial_wipe', 'iris'],
};

export function VisualJsonFieldEditor(props: VisualJsonFieldEditorProps) {
  const [isEditing, setIsEditing] = createSignal(false);
  const [draftValue, setDraftValue] = createSignal<string>(
    props.value === null ? 'null' : String(props.value)
  );

  createEffect(() => {
    setDraftValue(props.value === null ? 'null' : String(props.value));
  });

  const enumOptions = () => KNOWN_ENUMS[props.fieldKey.toLowerCase()];
  const isEnum = () =>
    typeof props.value === 'string' &&
    Boolean(enumOptions() && enumOptions()!.includes(props.value as string));

  const isHexColor = () =>
    typeof props.value === 'string' &&
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(props.value as string);

  const handleCommit = () => {
    setIsEditing(false);
    const draft = draftValue();
    let parsed: unknown = draft;
    if (typeof props.value === 'number') {
      const num = Number(draft);
      if (!Number.isNaN(num)) {
        parsed = num;
      }
    } else if (draft === 'null') {
      parsed = null;
    }
    props.onUpdate(props.path, parsed);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDraftValue(props.value === null ? 'null' : String(props.value));
  };

  return (
    <Show
      when={typeof props.value === 'boolean'}
      fallback={
        <Show
          when={isEnum()}
          fallback={
            <Show
              when={isEditing()}
              fallback={
                <div
                  onClick={(e) => {
                    if (props.disabled) return;
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  class="group flex items-center gap-1.5 cursor-pointer py-0.5 px-1 rounded hover:bg-foreground/10 transition-colors"
                  title="Click to edit value"
                >
                  <Show when={isHexColor()}>
                    <span
                      class="w-3 h-3 rounded-full border border-glass-border shrink-0 shadow-xs"
                      style={{ "background-color": props.value as string }}
                    />
                  </Show>
                  <span
                    class={`font-mono text-[11px] truncate max-w-xs ${
                      typeof props.value === 'number' ? 'text-amber-500 dark:text-amber-400' : 'text-accent-theme'
                    }`}
                  >
                    {typeof props.value === 'string' ? `"${props.value}"` : String(props.value)}
                  </span>
                  <Edit3 class="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              }
            >
              <div class="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type={typeof props.value === 'number' ? 'number' : 'text'}
                  autofocus
                  value={draftValue()}
                  onInput={(e: InputEvent & { currentTarget: HTMLInputElement }) => setDraftValue(currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommit();
                    if (e.key === 'Escape') handleCancel();
                  }}
                  class="bg-glass-surface border border-accent-theme rounded px-1.5 py-0.5 text-[11px] font-mono text-foreground focus:outline-hidden shadow-accent-glow w-36"
                />
                <button
                  type="button"
                  onClick={handleCommit}
                  class="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 cursor-pointer"
                  title="Commit changes (Enter)"
                >
                  <Check class="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  class="p-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 cursor-pointer"
                  title="Cancel (Esc)"
                >
                  <X class="w-3 h-3" />
                </button>
              </div>
            </Show>
          }
        >
          <select
            value={props.value as string}
            disabled={props.disabled}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              props.onUpdate(props.path, e.currentTarget.value);
            }}
            class="bg-glass-surface border border-glass-border rounded px-1.5 py-0.5 text-[11px] font-mono text-accent-theme focus:outline-hidden focus:border-accent-theme focus:shadow-accent-glow cursor-pointer"
          >
            <For items={enumOptions()}>
              {(opt) => (
                <option value={opt} class="text-foreground bg-background">
                  "{opt}"
                </option>
              )}
            </For>
          </select>
        </Show>
      }
    >
      <button
        type="button"
        disabled={props.disabled}
        onClick={(e) => {
          e.stopPropagation();
          props.onUpdate(props.path, !props.value);
        }}
        class={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-all cursor-pointer select-none border ${
          props.value
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
            : 'bg-muted/60 text-muted-foreground border-glass-border hover:bg-muted'
        }`}
        title={`Click to toggle to ${!props.value}`}
      >
        {props.value ? 'true' : 'false'}
      </button>
    </Show>
  );
}
