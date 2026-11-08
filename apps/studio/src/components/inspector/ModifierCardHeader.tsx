import { createSignal, Show } from 'solid-js';
import { ChevronUp, ChevronDown, Copy, Check, RotateCcw, Trash2 } from 'lucide-solid';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import type { ModifierNode } from '@acc/ir';
import type { AvailableModifierDef } from './modifierCatalog';

export interface ModifierCardHeaderProps {
  modifier: ModifierNode;
  index: number;
  totalModifiers: number;
  catalogEntry?: AvailableModifierDef;
  isLocked?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggleEnabled?: (enabled: boolean) => void;
  onReset?: () => void;
  onRemove: () => void;
}

/**
 * ModifierCardHeader:
 * Rendered strictly within AccordionTrigger actions prop to enforce Rule 229
 * (no nested buttons/switches inside native accordion triggers).
 * Provides reordering (Up/Down), copy settings, reset defaults, delete, and soft bypass toggle.
 */
export function ModifierCardHeader(props: ModifierCardHeaderProps) {
  const [copied, setCopied] = createSignal(false);
  const isEnabled = () => props.modifier.params?.enabled !== false;

  const handleCopyParams = (e: MouseEvent) => {
    e.stopPropagation();
    if (!props.modifier.params) return;
    try {
      navigator.clipboard?.writeText(JSON.stringify(props.modifier.params, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.warn('Failed to copy modifier parameters to clipboard:', err);
    }
  };

  return (
    <div
      class="flex items-center gap-1"
      onClick={(e: MouseEvent) => e.stopPropagation()}
    >
      {/* Reorder Up */}
      <Show when={props.onMoveUp && props.totalModifiers > 1}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={props.isLocked || props.index === 0}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            props.onMoveUp?.();
          }}
          class="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
          title={props.index === 0 ? 'Top of modifier pipeline' : 'Move up in pipeline'}
          aria-label="Move modifier up in pipeline order"
        >
          <ChevronUp class="w-3 h-3" />
        </Button>
      </Show>

      {/* Reorder Down */}
      <Show when={props.onMoveDown && props.totalModifiers > 1}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={props.isLocked || props.index === props.totalModifiers - 1}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            props.onMoveDown?.();
          }}
          class="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
          title={props.index === props.totalModifiers - 1 ? 'Bottom of modifier pipeline' : 'Move down in pipeline'}
          aria-label="Move modifier down in pipeline order"
        >
          <ChevronDown class="w-3 h-3" />
        </Button>
      </Show>

      {/* Copy Settings */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={props.isLocked}
        onClick={handleCopyParams}
        class="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        title="Copy modifier settings JSON"
        aria-label="Copy modifier parameters to clipboard"
      >
        <Show when={copied()} fallback={<Copy class="w-2.5 h-2.5" />}>
          <Check class="w-2.5 h-2.5 text-emerald-500" />
        </Show>
      </Button>

      {/* Reset to schema defaults */}
      <Show when={props.catalogEntry?.defaultParams && props.onReset}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={props.isLocked}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            props.onReset?.();
          }}
          class="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title="Reset parameters to defaults"
          aria-label="Reset modifier parameters to schema defaults"
        >
          <RotateCcw class="w-2.5 h-2.5" />
        </Button>
      </Show>

      {/* Remove modifier */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={props.isLocked}
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          props.onRemove();
        }}
        class="h-5 w-5 text-muted-foreground hover:text-destructive cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        title="Remove modifier from sequence"
        aria-label="Remove modifier"
      >
        <Trash2 class="w-2.5 h-2.5 text-destructive" />
      </Button>

      {/* Soft bypass / enable switch (optional internal) */}
      <Show when={props.onToggleEnabled}>
        <div class="pl-0.5">
          <Switch
            checked={isEnabled()}
            disabled={props.isLocked}
            onChange={(checked) => props.onToggleEnabled?.(checked)}
            aria-label={isEnabled() ? 'Bypass modifier' : 'Enable modifier'}
          />
        </div>
      </Show>
    </div>
  );
}
