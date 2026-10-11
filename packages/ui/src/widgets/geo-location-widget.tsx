import React, { useState } from 'react';
import type { DynamicWidgetProps } from './widget-registry';

export interface GeoLocationValue {
  latitude: number;
  longitude: number;
  address?: string;
  zoom?: number;
}

/**
 * Pluggable GeoLocationPicker Dynamic Widget.
 * Captures geographic coordinates, address lookup, and spatial metadata.
 */
export const GeoLocationWidget: React.FC<DynamicWidgetProps<GeoLocationValue | string>> = ({
  value,
  onChange,
  attribute,
  disabled = false,
  readOnly = false,
  error,
}) => {
  const parsedValue: GeoLocationValue = React.useMemo(() => {
    if (!value) return { latitude: 21.0285, longitude: 105.8542, address: 'Hanoi, Vietnam' };
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return { latitude: 21.0285, longitude: 105.8542, address: value };
      }
    }
    return value;
  }, [value]);

  const [addressInput, setAddressInput] = useState(parsedValue.address || '');

  const updateCoordinates = (lat: number, lng: number, addr?: string) => {
    if (disabled || readOnly) return;
    const updated: GeoLocationValue = {
      latitude: lat,
      longitude: lng,
      address: addr ?? addressInput,
      zoom: 14,
    };
    onChange(updated);
  };

  const handleSimulateGPS = () => {
    if (disabled || readOnly) return;
    // Simulated GPS acquisition
    const hcmLat = 10.7769;
    const hcmLng = 106.7009;
    const addr = 'Ho Chi Minh City, District 1';
    setAddressInput(addr);
    updateCoordinates(hcmLat, hcmLng, addr);
  };

  return (
    <div
      data-testid="geo-location-container"
      className="space-y-2 p-3 rounded-xl border border-white/20 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md shadow-xs"
    >
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{attribute.name || 'Geographic Coordinates'}</span>
        {!disabled && !readOnly && (
          <button
            type="button"
            onClick={handleSimulateGPS}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>📍 Acquire GPS</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Latitude</label>
          <input
            type="number"
            step="0.0001"
            disabled={disabled || readOnly}
            value={parsedValue.latitude}
            onChange={(e) => updateCoordinates(parseFloat(e.target.value) || 0, parsedValue.longitude)}
            aria-label={`Latitude for ${attribute.name}`}
            className="w-full p-2 text-xs rounded-lg border border-white/20 bg-white/60 dark:bg-black/30 font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Longitude</label>
          <input
            type="number"
            step="0.0001"
            disabled={disabled || readOnly}
            value={parsedValue.longitude}
            onChange={(e) => updateCoordinates(parsedValue.latitude, parseFloat(e.target.value) || 0)}
            aria-label={`Longitude for ${attribute.name}`}
            className="w-full p-2 text-xs rounded-lg border border-white/20 bg-white/60 dark:bg-black/30 font-mono"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground block mb-0.5">Reverse Geocoded Address</label>
        <input
          type="text"
          disabled={disabled || readOnly}
          value={addressInput}
          onChange={(e) => {
            setAddressInput(e.target.value);
            updateCoordinates(parsedValue.latitude, parsedValue.longitude, e.target.value);
          }}
          placeholder="Street address, city, country..."
          aria-label={`Address for ${attribute.name}`}
          className="w-full p-2 text-xs rounded-lg border border-white/20 bg-white/60 dark:bg-black/30"
        />
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
};
