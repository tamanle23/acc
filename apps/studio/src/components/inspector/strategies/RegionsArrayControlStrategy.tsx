import React from 'react';
import { Plus, Trash2, Crosshair } from 'lucide-react';
import type { PartialVFXRegionConfig } from '@acc/ir';
import { Button } from '../../ui/button';
import {
  type ControlStrategyProps,
  NumberControlStrategy,
  ColorControlStrategy,
} from './PrimitiveControlStrategies';

/**
 * Strategy 6: RegionsArrayControlStrategy (Specialized for vfx/partial)
 * Renders an interactive 2D coordinate pad and per-region cards for spotlights, glitches, blurs, and spark emitters.
 */
export const RegionsArrayControlStrategy: React.FC<ControlStrategyProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const regions: PartialVFXRegionConfig[] = Array.isArray(value) ? value : [];
  const [selectedIdx, setSelectedIdx] = React.useState<number>(0);

  const activeIndex = Math.max(0, Math.min(regions.length - 1, selectedIdx));
  const activeRegion = regions[activeIndex];

  const handleAddRegion = () => {
    if (disabled) return;
    const newRegion: PartialVFXRegionConfig = {
      type: 'spotlight',
      x: 0.5,
      y: 0.5,
      radius: 180,
      width: 0.35,
      height: 0.25,
      intensity: 1.5,
      color: '#00ffff',
    };
    const next = [...regions, newRegion];
    onChange(next);
    setSelectedIdx(next.length - 1);
  };

  const handleRemoveRegion = (idx: number) => {
    if (disabled) return;
    const next = regions.filter((_, i) => i !== idx);
    onChange(next);
    setSelectedIdx(Math.max(0, idx - 1));
  };

  const updateRegion = (idx: number, patch: Partial<PartialVFXRegionConfig>) => {
    if (disabled) return;
    const next = regions.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const handlePadPointer = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !activeRegion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = Math.max(
      0,
      Math.min(1, Number(((e.clientX - rect.left) / rect.width).toFixed(2)))
    );
    const normY = Math.max(
      0,
      Math.min(1, Number(((e.clientY - rect.top) / rect.height).toFixed(2)))
    );
    updateRegion(activeIndex, { x: normX, y: normY });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Localized Regions ({regions.length})
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddRegion}
          className="h-5 px-1.5 text-[10px] gap-1 border-accent-theme/40 text-accent-theme bg-accent-theme/10 hover:bg-accent-theme/20"
        >
          <Plus className="w-3 h-3" />
          Add Region
        </Button>
      </div>

      {regions.length === 0 ? (
        <div className="p-3 text-center text-[10px] text-muted-foreground border border-dashed border-glass-border rounded">
          No regions active. Click &quot;+ Add Region&quot; to place a spotlight or glitch zone.
        </div>
      ) : (
        <>
          {/* Region Selector Pills */}
          <div className="flex flex-wrap gap-1">
            {regions.map((reg, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer transition-colors ${
                  idx === activeIndex
                    ? 'bg-accent-theme/15 border-accent-theme text-accent-theme font-bold'
                    : 'bg-glass-surface border-glass-border text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setSelectedIdx(idx)}
              >
                <span>
                  #{idx + 1} {reg.type}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveRegion(idx);
                  }}
                  className="hover:text-destructive ml-0.5"
                  title="Delete region"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>

          {activeRegion && (
            <div className="p-2.5 rounded-md border border-glass-border bg-glass-surface/60 space-y-2.5">
              {/* Interactive 2D Coordinate Pad */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span className="flex items-center gap-1">
                    <Crosshair className="w-3 h-3 text-accent-theme" />
                    2D Region Target Pad (Click to position)
                  </span>
                  <span>
                    ({Math.round((activeRegion.x ?? 0.5) * 100)}%,{' '}
                    {Math.round((activeRegion.y ?? 0.5) * 100)}%)
                  </span>
                </div>
                <div
                  onClick={handlePadPointer}
                  className="relative w-full h-24 rounded border border-glass-border bg-black/80 overflow-hidden cursor-crosshair select-none"
                >
                  {/* Grid lines */}
                  <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none opacity-20">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div key={i} className="border border-accent-theme/30" />
                    ))}
                  </div>
                  {/* Reticle marker */}
                  <div
                    style={{
                      left: `${(activeRegion.x ?? 0.5) * 100}%`,
                      top: `${(activeRegion.y ?? 0.5) * 100}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-accent-theme shadow-accent-glow pointer-events-none flex items-center justify-center"
                  >
                    <div className="w-1 h-1 rounded-full bg-white" />
                  </div>
                </div>
              </div>

              {/* Region Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground block">
                  Effect Type
                </label>
                <select
                  value={activeRegion.type || 'spotlight'}
                  onChange={(e) => updateRegion(activeIndex, { type: e.target.value as PartialVFXRegionConfig['type'] })}
                  className="w-full h-6 rounded border border-glass-border bg-glass-surface text-foreground px-1.5 text-[11px] focus:outline-none focus:border-accent-theme"
                >
                  <option value="spotlight">Spotlight Beam</option>
                  <option value="glitch">Chromatic Glitch Slice</option>
                  <option value="blur">Frosted Glass Blur</option>
                  <option value="point_emitter">Spark Point Emitter</option>
                </select>
              </div>

              <NumberControlStrategy
                descriptor={{
                  key: 'x',
                  label: 'Center X',
                  type: 'number',
                  min: 0,
                  max: 1,
                  step: 0.01,
                  defaultValue: 0.5,
                }}
                value={activeRegion.x ?? 0.5}
                onChange={(v) => updateRegion(activeIndex, { x: v })}
              />

              <NumberControlStrategy
                descriptor={{
                  key: 'y',
                  label: 'Center Y',
                  type: 'number',
                  min: 0,
                  max: 1,
                  step: 0.01,
                  defaultValue: 0.5,
                }}
                value={activeRegion.y ?? 0.5}
                onChange={(v) => updateRegion(activeIndex, { y: v })}
              />

              {activeRegion.type === 'spotlight' || activeRegion.type === 'point_emitter' ? (
                <NumberControlStrategy
                  descriptor={{
                    key: 'radius',
                    label: 'Radius',
                    type: 'number',
                    min: 20,
                    max: 600,
                    step: 5,
                    defaultValue: 180,
                    unit: 'px',
                  }}
                  value={activeRegion.radius ?? 180}
                  onChange={(v) => updateRegion(activeIndex, { radius: v })}
                />
              ) : (
                <>
                  <NumberControlStrategy
                    descriptor={{
                      key: 'width',
                      label: 'Zone Width',
                      type: 'number',
                      min: 0.05,
                      max: 1.0,
                      step: 0.05,
                      defaultValue: 0.35,
                    }}
                    value={activeRegion.width ?? 0.35}
                    onChange={(v) => updateRegion(activeIndex, { width: v })}
                  />
                  <NumberControlStrategy
                    descriptor={{
                      key: 'height',
                      label: 'Zone Height',
                      type: 'number',
                      min: 0.05,
                      max: 1.0,
                      step: 0.05,
                      defaultValue: 0.25,
                    }}
                    value={activeRegion.height ?? 0.25}
                    onChange={(v) => updateRegion(activeIndex, { height: v })}
                  />
                </>
              )}

              <NumberControlStrategy
                descriptor={{
                  key: 'intensity',
                  label: 'Effect Intensity',
                  type: 'number',
                  min: 0.1,
                  max: 4.0,
                  step: 0.1,
                  defaultValue: 1.5,
                }}
                value={activeRegion.intensity ?? 1.5}
                onChange={(v) => updateRegion(activeIndex, { intensity: v })}
              />

              <ColorControlStrategy
                descriptor={{
                  key: 'color',
                  label: 'Tint Color',
                  type: 'color',
                  defaultValue: '#00ffff',
                }}
                value={activeRegion.color ?? '#00ffff'}
                onChange={(v) => updateRegion(activeIndex, { color: v })}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
