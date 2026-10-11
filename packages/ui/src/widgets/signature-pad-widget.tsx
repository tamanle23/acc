import React, { useRef, useState, useEffect } from 'react';
import type { DynamicWidgetProps } from './widget-registry';

/**
 * Pluggable SignaturePad Dynamic Widget.
 * Captures vector stroke drawing on canvas and exports base64 data URL.
 */
export const SignaturePadWidget: React.FC<DynamicWidgetProps<string>> = ({
  value,
  onChange,
  attribute,
  disabled = false,
  readOnly = false,
  error,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(Boolean(value));

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (value && value.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = value;
    } else if (!value) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasStroke(false);
    }
  }, [value]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled || readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled || readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasStroke(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  };

  const handleClear = () => {
    if (disabled || readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
    onChange('');
  };

  return (
    <div
      data-testid="signature-pad-container"
      className="space-y-2 p-3 rounded-xl border border-white/20 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md shadow-xs"
    >
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{attribute.name || 'Digital Signature'}</span>
        {hasStroke && !disabled && !readOnly && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] text-red-500 hover:underline cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative border border-dashed border-muted-foreground/30 rounded-lg overflow-hidden bg-white/70 dark:bg-black/30">
        <canvas
          ref={canvasRef}
          width={320}
          height={120}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          aria-label={`Digital signature canvas for ${attribute.name}`}
          className={`w-full h-[120px] touch-none ${disabled || readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair'}`}
        />
        {!hasStroke && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-muted-foreground/50">
            Sign here with cursor or touch
          </div>
        )}
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
};
