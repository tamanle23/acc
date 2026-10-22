import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { IRStateManager } from '../../lib/ir/irState';

export interface VectorShapeOverlayProps {
  activeShapes: any[];
}

export function VectorShapeOverlay({ activeShapes }: VectorShapeOverlayProps) {
  if (activeShapes.length === 0) return null;

  return (
    <>
      {activeShapes.map((seq) => {
        const mod = seq.modifiers?.find((m: any) => m.type === 'shape/vector');
        const trans = seq.modifiers?.find((m: any) => m.type === 'transform');
        const p = (mod?.params || {}) as any;
        const tp = (trans?.params || {}) as any;
        const normX = tp.normX ?? 0.5;
        const normY = tp.normY ?? 0.5;

        if (p.shapeType === 'rect' || p.shapeType === 'rounded_box') {
          return (
            <div
              key={seq.id}
              onClick={() => IRStateManager.getInstance().setSelectedSequenceId(seq.id)}
              style={{
                left: `${normX * 100}%`,
                top: `${normY * 100}%`,
                width: `${(p.width ?? 320) / 19.2}%`,
                height: `${(p.height ?? 180) / 10.8}%`,
                borderRadius: p.radius ? `${p.radius}px` : undefined,
                border: `${p.strokeWidth || 2}px solid ${p.strokeColor || '#818cf8'}`,
                backgroundColor: p.fillColor || 'transparent',
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute pointer-events-auto cursor-pointer z-10 flex items-center justify-center shadow-md backdrop-blur-xs"
            />
          );
        }

        if (p.shapeType === 'circle') {
          return (
            <div
              key={seq.id}
              onClick={() => IRStateManager.getInstance().setSelectedSequenceId(seq.id)}
              style={{
                left: `${normX * 100}%`,
                top: `${normY * 100}%`,
                width: `${((p.radius ?? 90) * 2) / 19.2}%`,
                aspectRatio: '1',
                borderRadius: '50%',
                border: `${p.strokeWidth || 2}px ${p.isDashed ? 'dashed' : 'solid'} ${p.strokeColor || '#06b6d4'}`,
                backgroundColor: p.fillColor || 'transparent',
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute pointer-events-auto cursor-pointer z-10 flex items-center justify-center shadow-md"
            />
          );
        }

        if (p.shapeType === 'arrow') {
          return (
            <div
              key={seq.id}
              onClick={() => IRStateManager.getInstance().setSelectedSequenceId(seq.id)}
              style={{
                left: `${normX * 100}%`,
                top: `${normY * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute pointer-events-auto cursor-pointer z-10 text-rose-500 drop-shadow-[0_0_8px_#f43f5e]"
            >
              <ArrowUpRight className="w-10 h-10" />
            </div>
          );
        }

        return null;
      })}
    </>
  );
}
