import React, { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';

export interface ParameterSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function ParameterSlider({
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  unit = '',
  onChange,
}: ParameterSliderProps) {
  const [localVal, setLocalVal] = useState(String(value));

  useEffect(() => {
    setLocalVal(String(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVal(e.target.value);
    const num = parseFloat(e.target.value);
    if (!isNaN(num)) {
      onChange(Math.max(min, Math.min(max, num)));
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[11px]">
        <span
          onDoubleClick={() => onChange(defaultValue)}
          className="text-slate-600 select-none cursor-pointer hover:text-indigo-600 transition-colors"
          title="Double-click to reset"
        >
          {label}
        </span>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step={step}
            value={localVal}
            onChange={handleInputChange}
            className="w-14 h-5 text-[10px] text-right font-mono px-1 py-0 border-slate-200 bg-white"
          />
          {unit && <span className="text-[10px] text-slate-400 font-mono">{unit}</span>}
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(val) => onChange(val[0])}
        onDoubleClick={() => onChange(defaultValue)}
      />
    </div>
  );
}

export interface ColorPickerRowProps {
  label: string;
  value: string;
  presets: { name: string; hex: string }[];
  onChange: (hex: string) => void;
}

export function ColorPickerRow({ label, value, presets, onChange }: ColorPickerRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[11px] text-slate-600">
        <span>{label}</span>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-5 h-5 rounded cursor-pointer border border-slate-300 p-0"
          />
          <span className="font-mono text-[10px] text-slate-500 uppercase">{value}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {presets.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onChange(preset.hex)}
            className={`w-4 h-4 rounded-full border transition-transform hover:scale-125 ${
              value.toLowerCase() === preset.hex.toLowerCase()
                ? 'ring-2 ring-indigo-500 border-white scale-110'
                : 'border-slate-300'
            }`}
            style={{ backgroundColor: preset.hex }}
            title={preset.name}
          />
        ))}
      </div>
    </div>
  );
}
