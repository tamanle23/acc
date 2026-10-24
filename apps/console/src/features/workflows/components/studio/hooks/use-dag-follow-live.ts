import { useCallback, useEffect, useRef, useState } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';
import type { DagNodeData } from '../canvas/dag-node';

/**
 * useDagFollowLive — smoothly pans the canvas to the active node(s) while
 * an execution is running. Auto-disables when the user manually pans/zooms,
 * and surfaces a "Resume Follow" callback to re-enable it.
 *
 * Parallel FORK_JOIN: when ≥2 nodes are IN_PROGRESS, uses fitBounds on the
 * bounding box of all active nodes (capped at maxZoom 1.1).
 */
export function useDagFollowLive({
  nodes,
  isExecutionMode,
  enabled: externalEnabled,
}: {
  nodes: Node<DagNodeData>[];
  isExecutionMode: boolean;
  enabled?: boolean;
}) {
  const { fitBounds, setCenter, getZoom } = useReactFlow();
  const [followLive, setFollowLive] = useState(true);
  // Guard against running follow logic before layout measurements settle
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset follow-live ON whenever execution mode is entered
  useEffect(() => {
    if (isExecutionMode) {
      setFollowLive(true);
    }
  }, [isExecutionMode]);

  // When externalEnabled is controlled, sync it
  useEffect(() => {
    if (externalEnabled !== undefined) {
      setFollowLive(externalEnabled);
    }
  }, [externalEnabled]);

  // Detect user-initiated pan/zoom and auto-disable follow
  const handleMoveStart = useCallback(
    (event: { sourceEvent?: Event | null }) => {
      // sourceEvent is non-null only for user-initiated moves (mouse/touch/wheel)
      if (event.sourceEvent != null && followLive) {
        setFollowLive(false);
      }
    },
    [followLive]
  );

  const handleResumeFollow = useCallback(() => {
    setFollowLive(true);
  }, []);

  const handleToggleFollowLive = useCallback(() => {
    setFollowLive((prev) => !prev);
  }, []);

  // Core pan effect — fires whenever nodes update and followLive is on
  useEffect(() => {
    if (!isExecutionMode || !followLive || !mountedRef.current) return;

    const activeNodes = nodes.filter(
      (n) => n.data.executionState === 'IN_PROGRESS'
    );

    if (activeNodes.length === 0) return;

    if (activeNodes.length === 1) {
      const n = activeNodes[0];
      const nodeW = n.measured?.width ?? n.width ?? 200;
      const nodeH = n.measured?.height ?? n.height ?? 80;
      const cx = (n.position.x ?? 0) + nodeW / 2;
      const cy = (n.position.y ?? 0) + nodeH / 2;
      // Keep current zoom; don't zoom in aggressively on a single node
      const currentZoom = typeof getZoom === 'function' ? getZoom() : 1;
      if (typeof setCenter === 'function') {
        setCenter(cx, cy, { duration: 400, zoom: Math.max(currentZoom, 0.8) });
      }
    } else {
      // Multiple active nodes — fitBounds to their union bounding box
      const xs = activeNodes.map((n) => n.position.x ?? 0);
      const ys = activeNodes.map((n) => n.position.y ?? 0);
      const x2s = activeNodes.map(
        (n) => (n.position.x ?? 0) + (n.measured?.width ?? n.width ?? 200)
      );
      const y2s = activeNodes.map(
        (n) => (n.position.y ?? 0) + (n.measured?.height ?? n.height ?? 80)
      );

      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...x2s);
      const maxY = Math.max(...y2s);

      if (typeof fitBounds === 'function') {
        fitBounds(
          { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
          { duration: 400, padding: 0.25, maxZoom: 1.1 }
        );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, isExecutionMode, followLive]);

  return {
    followLive,
    handleMoveStart,
    handleResumeFollow,
    handleToggleFollowLive,
  };
}
