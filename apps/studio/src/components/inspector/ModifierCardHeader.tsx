import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Copy, Check, RotateCcw, Trash2 } from 'lucide-react';
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
export const ModifierCardHeader: React.FC<ModifierCardHeaderProps> = ({
  modifier,
  index,
  totalModifiers,
  catalogEntry,
  isLocked = false,
  onMoveUp,
  onMoveDown,
  onToggleEnabled,
  onReset,
  onRemove,
}) => {
  const [copied, setCopied] = useState(false);
  const isEnabled = modifier.params?.enabled !== false;

  const handleCopyParams = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!modifier.params) return;
    try {
      navigator.clipboard?.writeText(JSON.stringify(modifier.params, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.warn('Failed to copy modifier parameters to clipboard:', err);
    }
  };

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Reorder Up */}
      {onMoveUp && totalModifiers > 1 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isLocked || index === 0}
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
          title={index === 0 ? 'Top of modifier pipeline' : 'Move up in pipeline'}
          aria-label="Move modifier up in pipeline order"
        >
          <ChevronUp className="w-3 h-3" />
        </Button>
      )}

      {/* Reorder Down */}
      {onMoveDown && totalModifiers > 1 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isLocked || index === totalModifiers - 1}
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
          title={index === totalModifiers - 1 ? 'Bottom of modifier pipeline' : 'Move down in pipeline'}
          aria-label="Move modifier down in pipeline order"
        >
          <ChevronDown className="w-3 h-3" />
        </Button>
      )}

      {/* Copy Settings */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={isLocked}
        onClick={handleCopyParams}
        className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        title="Copy modifier settings JSON"
        aria-label="Copy modifier parameters to clipboard"
      >
        {copied ? (
          <Check className="w-2.5 h-2.5 text-emerald-500" />
        ) : (
          <Copy className="w-2.5 h-2.5" />
        )}
      </Button>

      {/* Reset to schema defaults */}
      {catalogEntry?.defaultParams && onReset && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isLocked}
          onClick={(e) => {
            e.stopPropagation();
            onReset();
          }}
          className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title="Reset parameters to defaults"
          aria-label="Reset modifier parameters to schema defaults"
        >
          <RotateCcw className="w-2.5 h-2.5" />
        </Button>
      )}

      {/* Remove modifier */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={isLocked}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="h-5 w-5 text-muted-foreground hover:text-destructive cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        title="Remove modifier from sequence"
        aria-label="Remove modifier"
      >
        <Trash2 className="w-2.5 h-2.5 text-destructive" />
      </Button>

      {/* Soft bypass / enable switch (optional internal) */}
      {onToggleEnabled && (
        <div className="pl-0.5">
          <Switch
            checked={isEnabled}
            disabled={isLocked}
            onCheckedChange={(checked) => onToggleEnabled(checked)}
            aria-label={isEnabled ? 'Bypass modifier' : 'Enable modifier'}
          />
        </div>
      )}
    </div>
  );
};
