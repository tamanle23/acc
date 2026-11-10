import type { JSX } from 'solid-js';
import type { TransformHandleType } from '../../lib/gizmo';

export interface TransformHandleProps {
  handleType: TransformHandleType;
  isLocked: boolean;
  class?: string;
  className?: string;
  title: string;
  onPointerDown?: (e: PointerEvent) => void;
  onPointerMove?: (e: PointerEvent) => void;
  onPointerUp?: (e: PointerEvent) => void;
  onPointerCancel?: (e: PointerEvent) => void;
  children?: JSX.Element;
}

export function TransformHandle(props: TransformHandleProps) {
  return (
    <div
      onPointerDown={(e) => {
        if (props.isLocked) return;
        props.onPointerDown?.(e);
      }}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerCancel}
      class={props.class || props.className}
      title={props.title}
      onClick={(e) => e.stopPropagation()}
    >
      {props.children}
    </div>
  );
}

export interface TransformBodyDraggableProps {
  children?: JSX.Element;
  isLocked: boolean;
  style?: JSX.CSSProperties | string;
  class?: string;
  className?: string;
  onDoubleClick?: () => void;
  onPointerDown?: (e: PointerEvent) => void;
  onPointerMove?: (e: PointerEvent) => void;
  onPointerUp?: (e: PointerEvent) => void;
  onPointerCancel?: (e: PointerEvent) => void;
}

export function TransformBodyDraggable(props: TransformBodyDraggableProps) {
  return (
    <div
      onPointerDown={(e) => {
        if (props.isLocked) return;
        props.onPointerDown?.(e);
      }}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerCancel}
      onDblClick={props.onDoubleClick}
      style={props.style}
      class={props.class || props.className}
    >
      {props.children}
    </div>
  );
}
