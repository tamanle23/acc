import React, { useRef } from 'react';
import { useDraggable } from '@neodrag/react';
import type { TransformHandleType } from '../../lib/gizmo';

export interface TransformHandleProps {
  handleType: TransformHandleType;
  isLocked: boolean;
  className: string;
  title: string;
  onDragStart: (handle: TransformHandleType) => void;
  onDrag: (handle: TransformHandleType, delta: { x: number; y: number }) => void;
  onDragEnd: (handle: TransformHandleType) => void;
  children?: React.ReactNode;
}

export function TransformHandle({
  handleType,
  isLocked,
  className,
  title,
  onDragStart,
  onDrag,
  onDragEnd,
  children,
}: TransformHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);

  useDraggable(handleRef, {
    disabled: isLocked,
    threshold: { distance: 3 },
    transform: () => '',
    onDragStart: () => onDragStart(handleType),
    onDrag: ({ offsetX, offsetY }) => onDrag(handleType, { x: offsetX, y: offsetY }),
    onDragEnd: () => onDragEnd(handleType),
  });

  return (
    <div
      ref={handleRef}
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
  onDragStart: (handle: TransformHandleType) => void;
  onDrag: (handle: TransformHandleType, delta: { x: number; y: number }) => void;
  onDragEnd: (handle: TransformHandleType) => void;
}

export function TransformBodyDraggable({
  children,
  isLocked,
  style,
  className,
  onDoubleClick,
  onDragStart,
  onDrag,
  onDragEnd,
}: TransformBodyDraggableProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useDraggable(bodyRef, {
    disabled: isLocked,
    threshold: { distance: 3 },
    transform: () => '',
    onDragStart: () => onDragStart('body'),
    onDrag: ({ offsetX, offsetY }) => onDrag('body', { x: offsetX, y: offsetY }),
    onDragEnd: () => onDragEnd('body'),
  });

  return (
    <div
      ref={bodyRef}
      onDoubleClick={onDoubleClick}
      style={style}
      className={className}
    >
      {children}
    </div>
  );
}
