import React, { ReactElement, useState } from 'react';
import type { DynamicWidgetProps } from './widget-registry';

/**
 * Pluggable BarcodeScanner Dynamic Widget.
 * Simulates and captures 1D/2D optical codes (QR, EAN-13, Code-128).
 */
export const BarcodeScannerWidget = ({
  value,
  onChange,
  attribute,
  disabled = false,
  readOnly = false,
  error,
}: DynamicWidgetProps<string>): ReactElement => {
  const [isScanning, setIsScanning] = useState(false);

  const handleSimulateScan = (mockCode: string) => {
    if (disabled || readOnly) return;
    setIsScanning(false);
    onChange(mockCode);
  };

  return (
    <div
      data-testid="barcode-scanner-container"
      className="space-y-2 p-3 rounded-xl border border-white/20 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md shadow-xs"
    >
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{attribute.name || 'Barcode / Optical Code'}</span>
        {!disabled && !readOnly && (
          <button
            type="button"
            onClick={() => setIsScanning(!isScanning)}
            className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>{isScanning ? 'Cancel Camera' : '📷 Scan Code'}</span>
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          disabled={disabled || readOnly}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Code value (e.g. 8934567890123, QR-VN-2026)"
          aria-label={`Barcode value for ${attribute.name}`}
          className="flex-1 p-2 text-xs rounded-lg border border-white/20 bg-white/60 dark:bg-black/30 font-mono font-bold"
        />
        {value && !disabled && !readOnly && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground border border-white/20 rounded-lg"
          >
            Clear
          </button>
        )}
      </div>

      {isScanning && !disabled && !readOnly && (
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-2">
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Optical Code Simulation Chamber (Sandbox)
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleSimulateScan('VN-EAN13-893500188201')}
              className="px-2 py-1 text-[10px] rounded bg-white/80 dark:bg-black/50 border border-white/30 hover:border-emerald-500 font-mono"
            >
              Simulate EAN-13
            </button>
            <button
              type="button"
              onClick={() => handleSimulateScan('UNIPOST-QR-DOC-99214')}
              className="px-2 py-1 text-[10px] rounded bg-white/80 dark:bg-black/50 border border-white/30 hover:border-emerald-500 font-mono"
            >
              Simulate QR Code
            </button>
            <button
              type="button"
              onClick={() => handleSimulateScan('PKG-CODE128-TRACK-001')}
              className="px-2 py-1 text-[10px] rounded bg-white/80 dark:bg-black/50 border border-white/30 hover:border-emerald-500 font-mono"
            >
              Simulate Code-128
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
};
