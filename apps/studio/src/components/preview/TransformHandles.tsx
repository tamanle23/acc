import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { TransformHandleType } from '../../lib/gizmo';

export interface TransformHandleProps {
  handleType: TransformHandleType;
  isLocked: boolean;
  className: string;
  title: string;
  children?: React.ReactNode;
}

export function TransformHandle({
  handleType,
  isLocked,
  className,
  title,
  children,
}: TransformHandleProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `transform-handle-${handleType}`,
    data: {
      type: 'handle',
      handleType,
    },
    disabled: isLocked,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
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
}

export function TransformBodyDraggable({
  children,
  isLocked,
  style,
  className,
  onDoubleClick,
}: TransformBodyDraggableProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'transform-handle-body',
    data: {
      type: 'handle',
      handleType: 'body' as TransformHandleType,
    },
    disabled: isLocked,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onDoubleClick={onDoubleClick}
      style={style}
      className={className}
    >
      {children}
    </div>
  );
}
