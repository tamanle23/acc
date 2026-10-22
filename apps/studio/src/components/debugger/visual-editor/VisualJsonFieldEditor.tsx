import React, { useState, useEffect } from 'react';
import { Check, X, Edit3 } from 'lucide-react';
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

export function VisualJsonFieldEditor({
  fieldKey,
  value,
  path,
  onUpdate,
  disabled = false,
}: VisualJsonFieldEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState<string>(() => (value === null ? 'null' : String(value)));

  useEffect(() => {
    setDraftValue(value === null ? 'null' : String(value));
  }, [value]);

  // 1. Boolean Toggle (Emerald true / Muted false)
  if (typeof value === 'boolean') {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onUpdate(path, !value);
        }}
        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-all cursor-pointer select-none border ${
          value
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
            : 'bg-muted/60 text-muted-foreground border-glass-border hover:bg-muted'
        }`}
        title={`Click to toggle to ${!value}`}
      >
        {value ? 'true' : 'false'}
      </button>
    );
  }

  // 2. Known Enum Selector (Dropdown)
  const enumOptions = KNOWN_ENUMS[fieldKey.toLowerCase()];
  if (typeof value === 'string' && enumOptions && enumOptions.includes(value)) {
    return (
      <select
        value={value}
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          onUpdate(path, e.target.value);
        }}
        className="bg-glass-surface border border-glass-border rounded px-1.5 py-0.5 text-[11px] font-mono text-accent-theme focus:outline-hidden focus:border-accent-theme focus:shadow-accent-glow cursor-pointer"
      >
        {enumOptions.map((opt) => (
          <option key={opt} value={opt} className="text-foreground bg-background">
            "{opt}"
          </option>
        ))}
      </select>
    );
  }

  // 3. Hex Color Chip Preview
  const isHexColor = typeof value === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);

  // 4. In-Place Editing Form
  if (isEditing) {
    const handleCommit = () => {
      setIsEditing(false);
      let parsed: unknown = draftValue;
      if (typeof value === 'number') {
        const num = Number(draftValue);
        if (!Number.isNaN(num)) {
          parsed = num;
        }
      } else if (draftValue === 'null') {
        parsed = null;
      }
      onUpdate(path, parsed);
    };

    const handleCancel = () => {
      setIsEditing(false);
      setDraftValue(value === null ? 'null' : String(value));
    };

    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          type={typeof value === 'number' ? 'number' : 'text'}
          autoFocus
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCommit();
            if (e.key === 'Escape') handleCancel();
          }}
          className="bg-glass-surface border border-accent-theme rounded px-1.5 py-0.5 text-[11px] font-mono text-foreground focus:outline-hidden shadow-accent-glow w-36"
        />
        <button
          type="button"
          onClick={handleCommit}
          className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
          title="Commit changes (Enter)"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="p-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
          title="Cancel (Esc)"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // 5. Resting Display View (Click to edit)
  const isNumber = typeof value === 'number';
  const valStr = typeof value === 'string' ? `"${value}"` : String(value);

  return (
    <div
      onClick={(e) => {
        if (disabled) return;
        e.stopPropagation();
        setIsEditing(true);
      }}
      className="group flex items-center gap-1.5 cursor-pointer py-0.5 px-1 rounded hover:bg-foreground/10 transition-colors"
      title="Click to edit value"
    >
      {isHexColor && (
        <span
          className="w-3 h-3 rounded-full border border-glass-border shrink-0 shadow-xs"
          style={{ backgroundColor: value as string }}
        />
      )}
      <span
        className={`font-mono text-[11px] truncate max-w-xs ${
          isNumber ? 'text-amber-500 dark:text-amber-400' : 'text-accent-theme'
        }`}
      >
        {valStr}
      </span>
      <Edit3 className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
