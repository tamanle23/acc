import React from 'react';
import type { TransformHandleType } from '../../lib/gizmo';

export interface TransformHandleProps {
  handleType: TransformHandleType;
  isLocked: boolean;
  className: string;
  title: string;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerCancel?: (e: React.PointerEvent) => void;
  children?: React.ReactNode;
}

export function TransformHandle({
  handleType: _handleType,
  isLocked,
  className,
  title,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  children,
}: TransformHandleProps) {
  return (
    <div
      onPointerDown={(e) => {
        if (isLocked) return;
        onPointerDown?.(e);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={className}
      title={title}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export interface TransformBodyDraggableProps {
  children: React.ReactNode;
  isLocked: boolean;
  style: React.CSSProperties;
  className: string;
  onDoubleClick: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerCancel?: (e: React.PointerEvent) => void;
}

export function TransformBodyDraggable({
  children,
  isLocked,
  style,
  className,
  onDoubleClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: TransformBodyDraggableProps) {
  return (
    <div
      onPointerDown={(e) => {
        if (isLocked) return;
        onPointerDown?.(e);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      style={style}
      className={className}
    >
      {children}
    </div>
  );
}
