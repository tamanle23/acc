import { createSignal, Show } from 'solid-js';
import { SunMedium } from 'lucide-solid';
import { IRStateManager } from '../../lib/ir/irState';
import type { ModifierNode } from '@acc/ir';
import type { StudioSequence } from '../../lib/ir/studioTypes';

export interface LightGizmoOverlayProps {
  selectedSeqId: string | null;
  activeSequences: StudioSequence[];
  width: number;
  height: number;
  zoomLevel: number | 'fit';
}

export function LightGizmoOverlay(props: LightGizmoOverlayProps) {
  const selectedSeq = () => {
    if (!props.selectedSeqId) return null;
    const timelineSeqs = IRStateManager.getInstance().getState().timeline?.sequences;
    return (
      props.activeSequences.find((s) => s.id === props.selectedSeqId) ||
      (timelineSeqs ? timelineSeqs.get(props.selectedSeqId) : undefined)
    );
  };

  const relightMod = () => {
    const seq = selectedSeq();
    const mod = seq?.modifiers?.find(
      (m: ModifierNode) => m.type === 'vfx/depth_relighting' || m.type === 'vfx/depth3d_relighting'
    );
    if (!mod || mod.params?.enabled === false) return null;
    return mod;
  };

  const lightX = () => {
    const mod = relightMod();
    return typeof mod?.params?.lightX === 'number' ? mod.params.lightX : 0.0;
  };

  const lightY = () => {
    const mod = relightMod();
    return typeof mod?.params?.lightY === 'number' ? mod.params.lightY : 0.0;
  };

  const [dragOffset, setDragOffset] = createSignal<{ x: number; y: number } | null>(null);
  let dragStartCoords: { clientX: number; clientY: number } | null = null;

  const handlePointerDown = (e: PointerEvent) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    dragStartCoords = { clientX: e.clientX, clientY: e.clientY };
    setDragOffset({ x: 0, y: 0 });
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!dragStartCoords) return;
    e.stopPropagation();
    setDragOffset({
      x: e.clientX - dragStartCoords.clientX,
      y: e.clientY - dragStartCoords.clientY,
    });
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!dragStartCoords) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const offset = dragOffset();
    dragStartCoords = null;
    setDragOffset(null);

    const mod = relightMod();
    if (!mod || !props.selectedSeqId || !offset) return;

    const deltaNormX = offset.x / (props.width / 2);
    const deltaNormY = offset.y / (props.height / 2);

    const nextX = Math.max(-1.5, Math.min(1.5, Number((lightX() + deltaNormX).toFixed(2))));
    const nextY = Math.max(-1.5, Math.min(1.5, Number((lightY() + deltaNormY).toFixed(2))));

    IRStateManager.getInstance().updateModifier(props.selectedSeqId, mod.type, {
      ...mod.params,
      lightX: nextX,
      lightY: nextY,
    });
  };

  return (
    <Show when={relightMod()}>
      {(() => {
        const centerX = () => props.width / 2;
        const centerY = () => props.height / 2;
        const currentOffset = () => dragOffset() || { x: 0, y: 0 };
        const pixelX = () => centerX() + lightX() * (props.width / 2) + currentOffset().x;
        const pixelY = () => centerY() + lightY() * (props.height / 2) + currentOffset().y;

        return (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: 'absolute',
              left: `${pixelX()}px`,
              top: `${pixelY()}px`,
              transform: 'translate(-50%, -50%)',
              'touch-action': 'none',
            }}
            class={`group cursor-grab active:cursor-grabbing pointer-events-auto z-20 transition-shadow ${
              dragOffset() ? 'scale-110' : ''
            }`}
            title="3D Point Light Source (Drag to position azimuth / elevation)"
          >
            {/* Light Vector Line to Center */}
            <svg
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: `${props.width}px`,
                height: `${props.height}px`,
                transform: `translate(${-pixelX()}px, ${-pixelY()}px)`,
                'pointer-events': 'none',
              }}
            >
              <line
                x1={pixelX()}
                y1={pixelY()}
                x2={centerX()}
                y2={centerY()}
                stroke="rgba(6, 182, 212, 0.45)"
                stroke-width="1.5"
                stroke-dasharray="4 3"
              />
            </svg>

            {/* Point Light Glowing Sphere */}
            <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.8)] backdrop-blur-xs">
              <SunMedium class="w-4 h-4 text-cyan-300 animate-pulse" />
              <span class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-cyan-300 bg-black/60 px-1 py-0.5 rounded border border-cyan-500/40 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                X: {lightX().toFixed(2)} | Y: {lightY().toFixed(2)}
              </span>
            </div>
          </div>
        );
      })()}
    </Show>
  );
}
