import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '../ui/input';

export interface ScrubbableNumberInputProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  label?: string;
  defaultValue?: number;
  onChange: (value: number) => void;
  className?: string;
}

/**
 * Deterministic safe math expression evaluator without eval() or Function().
 * Supports basic arithmetic (+, -, *, /) and relative increments (+50, -20).
 */
export function evaluateSafeMathExpression(expr: string, baseValue: number): number | null {
  const trimmed = expr.trim();
  if (!trimmed) return null;

  // Relative prefix: e.g. "+50" or "-25"
  if (trimmed.startsWith('+') && !trimmed.slice(1).includes('+') && !trimmed.slice(1).includes('-') && !trimmed.slice(1).includes('*') && !trimmed.slice(1).includes('/')) {
    const delta = parseFloat(trimmed.slice(1));
    return Number.isNaN(delta) ? null : baseValue + delta;
  }
  if (trimmed.startsWith('-') && !trimmed.slice(1).includes('+') && !trimmed.slice(1).includes('-') && !trimmed.slice(1).includes('*') && !trimmed.slice(1).includes('/')) {
    const delta = parseFloat(trimmed.slice(1));
    return Number.isNaN(delta) ? null : baseValue - delta;
  }

  // Tokenize numbers and operators
  const tokens = trimmed.match(/(\d+\.?\d*|\+|\-|\*|\/)/g);
  if (!tokens || tokens.length === 0) return null;

  try {
    // Process multiplication and division first
    const intermediateTokens: (number | string)[] = [];
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      if (token === '*' || token === '/') {
        const prev = intermediateTokens.pop();
        const next = parseFloat(tokens[i + 1]);
        if (typeof prev !== 'number' || Number.isNaN(next)) return null;
        if (token === '/' && next === 0) return null; // Avoid divide by zero
        const res = token === '*' ? prev * next : prev / next;
        intermediateTokens.push(res);
        i += 2;
      } else {
        const num = parseFloat(token);
        intermediateTokens.push(Number.isNaN(num) ? token : num);
        i++;
      }
    }

    // Process addition and subtraction
    let result = typeof intermediateTokens[0] === 'number' ? intermediateTokens[0] : null;
    if (result === null) return null;

    let j = 1;
    while (j < intermediateTokens.length) {
      const op = intermediateTokens[j];
      const nextNum = intermediateTokens[j + 1];
      if (typeof nextNum !== 'number') return null;
      if (op === '+') {
        result += nextNum;
      } else if (op === '-') {
        result -= nextNum;
      }
      j += 2;
    }

    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/**
 * ScrubbableNumberInput:
 * Professional NLE virtual scrub input (DaVinci Resolve / Premiere / Blender ergonomics).
 * - Click and drag horizontally on the label or input to scrub values smoothly.
 * - Shift + Drag: 10x coarse multiplier.
 * - Alt / Option + Drag: 0.1x micro multiplier.
 * - Double-click input to type direct text with safe math evaluation.
 * - Double-click label to reset to defaultValue.
 */
export const ScrubbableNumberInput: React.FC<ScrubbableNumberInputProps> = ({
  value,
  min = -Infinity,
  max = Infinity,
  step = 1,
  unit = '',
  disabled = false,
  label,
  defaultValue,
  onChange,
  className = '',
}) => {
  const [localText, setLocalText] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number>(0);
  const startValRef = useRef<number>(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setLocalText(String(value));
    }
  }, [value, isEditing]);

  const roundToStep = useCallback((val: number, stepVal: number): number => {
    const decimals = stepVal.toString().split('.')[1]?.length || 0;
    const factor = 10 ** Math.min(decimals, 4);
    return Math.round(val * factor) / factor;
  }, []);

  const clampValue = useCallback((val: number): number => {
    return Math.max(min, Math.min(max, val));
  }, [min, max]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || isEditing) return;
    // Only primary mouse button initiates drag scrub
    if (e.button !== 0) return;

    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startValRef.current = value;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startXRef.current;
      let multiplier = 1;
      if (moveEvent.shiftKey) multiplier = 10;
      else if (moveEvent.altKey || moveEvent.metaKey) multiplier = 0.1;

      const increment = deltaX * step * multiplier;
      const rawNewVal = startValRef.current + increment;
      const rounded = roundToStep(clampValue(rawNewVal), step * multiplier);
      onChange(rounded);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = () => {
    if (disabled) return;
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 10);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const evaluated = evaluateSafeMathExpression(localText, value);
    if (evaluated !== null && !Number.isNaN(evaluated)) {
      const clamped = clampValue(roundToStep(evaluated, step));
      onChange(clamped);
      setLocalText(String(clamped));
    } else {
      setLocalText(String(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setLocalText(String(value));
      setIsEditing(false);
    }
  };

  return (
    <div className={`flex items-center gap-1.5 select-none ${className}`}>
      {label && (
        <span
          onDoubleClick={() => {
            if (!disabled && defaultValue !== undefined) {
              onChange(defaultValue);
            }
          }}
          className={`text-[11px] text-muted-foreground transition-colors ${
            disabled
              ? 'cursor-not-allowed opacity-50'
              : 'hover:text-accent-theme cursor-pointer'
          }`}
          title={defaultValue !== undefined ? `Double-click to reset (${defaultValue})` : undefined}
        >
          {label}
        </span>
      )}

      <div
        onMouseDown={!isEditing ? handleMouseDown : undefined}
        onDoubleClick={handleDoubleClick}
        className={`relative flex items-center h-6 rounded border border-glass-border bg-glass-surface/50 px-1.5 transition-all ${
          disabled
            ? 'opacity-40 cursor-not-allowed'
            : isDragging
            ? 'border-accent-theme/80 bg-accent-theme/10 cursor-ew-resize ring-1 ring-accent-theme/40'
            : 'hover:border-accent-theme/40 hover:bg-glass-surface cursor-ew-resize'
        }`}
        title={
          disabled
            ? undefined
            : 'Click and drag to scrub (Shift: 10x, Alt: 0.1x). Double-click to type or enter math (e.g. 100/2).'
        }
      >
        <Input
          ref={inputRef}
          type="text"
          disabled={disabled}
          readOnly={!isEditing}
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          className={`h-5 w-14 border-0 p-0 text-right font-mono text-[10px] bg-transparent text-foreground shadow-none focus-visible:ring-0 ${
            !isEditing ? 'cursor-ew-resize pointer-events-none' : 'cursor-text'
          }`}
        />
        {unit && (
          <span className="ml-1 font-mono text-[9px] text-muted-foreground shrink-0">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};
