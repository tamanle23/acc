import type { Component, JSX } from 'solid-js';
import { Show, createSignal, createEffect, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { cn } from '@/lib/utils';

export type PopoverPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end';

export interface PopoverPositionResult {
  top: number;
  left: number;
  placement: PopoverPlacement;
  maxHeight: number;
  maxWidth: number;
}

export interface PopoverPositionOptions {
  placement?: PopoverPlacement;
  offset?: number;
  padding?: number;
  autoFlip?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
}

/**
 * Pure mathematical calculation of popover fixed viewport coordinates with collision
 * avoidance, auto-flipping, and boundary clamping.
 */
export function computePopoverPosition(
  anchorRect: { top: number; bottom: number; left: number; right: number; width: number; height: number },
  popoverRect: { width: number; height: number },
  options: PopoverPositionOptions = {}
): PopoverPositionResult {
  const offset = options.offset ?? 8;
  const padding = options.padding ?? 8;
  const autoFlip = options.autoFlip !== false;
  const viewportWidth = options.viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1920);
  const viewportHeight = options.viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 1080);

  const popoverWidth = Math.min(popoverRect.width || 280, viewportWidth - 2 * padding);
  const popoverHeight = Math.min(popoverRect.height || 300, viewportHeight - 2 * padding);

  const preferredPlacement = options.placement ?? 'top';
  const parts = preferredPlacement.split('-');
  const preferredSide = parts[0] as 'top' | 'bottom' | 'left' | 'right';
  const preferredAlign = (parts[1] ?? 'center') as 'start' | 'end' | 'center';

  let resolvedSide: 'top' | 'bottom' | 'left' | 'right' = preferredSide;

  if (autoFlip) {
    const spaceAbove = anchorRect.top - offset - padding;
    const spaceBelow = viewportHeight - anchorRect.bottom - offset - padding;
    const spaceLeft = anchorRect.left - offset - padding;
    const spaceRight = viewportWidth - anchorRect.right - offset - padding;

    if (preferredSide === 'bottom' && spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
      resolvedSide = 'top';
    } else if (preferredSide === 'top' && spaceAbove < popoverHeight && spaceBelow > spaceAbove) {
      resolvedSide = 'bottom';
    } else if (preferredSide === 'right' && spaceRight < popoverWidth && spaceLeft > spaceRight) {
      resolvedSide = 'left';
    } else if (preferredSide === 'left' && spaceLeft < popoverWidth && spaceRight > spaceLeft) {
      resolvedSide = 'right';
    }
  }

  let top = 0;
  let left = 0;

  if (resolvedSide === 'top') {
    top = anchorRect.top - popoverHeight - offset;
    if (preferredAlign === 'start') {
      left = anchorRect.left;
    } else if (preferredAlign === 'end') {
      left = anchorRect.right - popoverWidth;
    } else {
      left = anchorRect.left + (anchorRect.width - popoverWidth) / 2;
    }
  } else if (resolvedSide === 'bottom') {
    top = anchorRect.bottom + offset;
    if (preferredAlign === 'start') {
      left = anchorRect.left;
    } else if (preferredAlign === 'end') {
      left = anchorRect.right - popoverWidth;
    } else {
      left = anchorRect.left + (anchorRect.width - popoverWidth) / 2;
    }
  } else if (resolvedSide === 'left') {
    left = anchorRect.left - popoverWidth - offset;
    if (preferredAlign === 'start') {
      top = anchorRect.top;
    } else if (preferredAlign === 'end') {
      top = anchorRect.bottom - popoverHeight;
    } else {
      top = anchorRect.top + (anchorRect.height - popoverHeight) / 2;
    }
  } else if (resolvedSide === 'right') {
    left = anchorRect.right + offset;
    if (preferredAlign === 'start') {
      top = anchorRect.top;
    } else if (preferredAlign === 'end') {
      top = anchorRect.bottom - popoverHeight;
    } else {
      top = anchorRect.top + (anchorRect.height - popoverHeight) / 2;
    }
  }

  // Viewport clamping
  const maxAvailableHeight = Math.max(100, viewportHeight - 2 * padding);
  const maxAvailableWidth = Math.max(100, viewportWidth - 2 * padding);
  const clampedLeft = Math.max(padding, Math.min(left, viewportWidth - popoverWidth - padding));
  const clampedTop = Math.max(padding, Math.min(top, viewportHeight - popoverHeight - padding));

  const resolvedPlacement = (preferredAlign !== 'center'
    ? `${resolvedSide}-${preferredAlign}`
    : resolvedSide) as PopoverPlacement;

  return {
    top: Math.round(clampedTop),
    left: Math.round(clampedLeft),
    placement: resolvedPlacement,
    maxHeight: maxAvailableHeight,
    maxWidth: maxAvailableWidth,
  };
}

export interface PopoverProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly anchorRef?: HTMLElement | null;
  readonly placement?: PopoverPlacement;
  readonly offset?: number;
  readonly padding?: number;
  readonly autoFlip?: boolean;
  readonly closeOnEscape?: boolean;
  readonly closeOnOutsideClick?: boolean;
  readonly ariaLabel?: string;
  readonly role?: JSX.HTMLAttributes<HTMLDivElement>['role'];
  readonly class?: string;
  readonly className?: string;
  readonly style?: JSX.CSSProperties | string;
  readonly children: JSX.Element;
}

export const Popover: Component<PopoverProps> = (props) => {
  let popoverRef: HTMLDivElement | undefined;
  const [position, setPosition] = createSignal<PopoverPositionResult>({
    top: -9999,
    left: -9999,
    placement: props.placement ?? 'top',
    maxHeight: 480,
    maxWidth: 400,
  });

  const updatePosition = () => {
    if (!props.isOpen || !props.anchorRef || !popoverRef) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const anchorRect = props.anchorRef.getBoundingClientRect();
    const popoverRect = popoverRef.getBoundingClientRect();

    if (anchorRect.width === 0 && anchorRect.height === 0 && anchorRect.top === 0) return;

    const computed = computePopoverPosition(anchorRect, popoverRect, {
      placement: props.placement ?? 'top',
      offset: props.offset ?? 8,
      padding: props.padding ?? 8,
      autoFlip: props.autoFlip ?? true,
    });

    setPosition(computed);
  };

  createEffect(() => {
    if (!props.isOpen || !props.anchorRef) return;

    // Run position sync immediately and on next RAF for layout stabilization
    updatePosition();
    const rafId = requestAnimationFrame(updatePosition);

    // Track window resize and capture any scroll event in the DOM tree
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    onCleanup(() => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    });
  });

  // Handle outside click & escape key
  createEffect(() => {
    if (!props.isOpen) return;

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      if (props.closeOnOutsideClick === false) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef && popoverRef.contains(target)) return;
      if (props.anchorRef && props.anchorRef.contains(target)) return;
      props.onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (props.closeOnEscape !== false && e.key === 'Escape') {
        props.onClose();
      }
    };

    // Delay registration to next macro-task to prevent immediate trigger by the opening click
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
      window.addEventListener('keydown', handleKeyDown);
    }, 0);

    onCleanup(() => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    });
  });

  return (
    <Show when={props.isOpen}>
      <Portal mount={typeof document !== 'undefined' ? document.body : undefined}>
        <div
          ref={popoverRef}
          role={props.role ?? 'dialog'}
          aria-label={props.ariaLabel}
          aria-modal="false"
          tabIndex={-1}
          style={{
            position: 'fixed',
            top: `${position().top}px`,
            left: `${position().left}px`,
            'max-height': `${position().maxHeight}px`,
            'max-width': `${position().maxWidth}px`,
            'z-index': 60,
          }}
          class={cn(
            'bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl backdrop-blur-md overflow-hidden flex flex-col',
            'animate-in fade-in zoom-in-95 duration-150',
            props.class || props.className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {props.children}
        </div>
      </Portal>
    </Show>
  );
};
