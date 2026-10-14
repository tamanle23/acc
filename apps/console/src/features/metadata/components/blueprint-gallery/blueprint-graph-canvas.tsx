import React from 'react';
import type { BlueprintEntityType, BlueprintRelationship } from '../../api/types';
import { Database, GitFork, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  entityTypes: BlueprintEntityType[];
  relationshipTypes: BlueprintRelationship[];
}

export const BlueprintGraphCanvas: React.FC<Props> = ({
  entityTypes,
  relationshipTypes,
}) => {
  if (!entityTypes || entityTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
        <GitFork className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-xs">No graph topology defined for this blueprint.</p>
      </div>
    );
  }

  // Calculate dynamic 2D positions for entity nodes in a clean DAG circle / row layout
  const width = 640;
  const height = 300;
  const nodeWidth = 150;
  const nodeHeight = 60;

  const positions: Record<string, { x: number; y: number }> = {};
  const total = entityTypes.length;

  entityTypes.forEach((et, index) => {
    if (total === 1) {
      positions[et.systemName] = { x: width / 2 - nodeWidth / 2, y: height / 2 - nodeHeight / 2 };
    } else if (total === 2) {
      const x = index === 0 ? 80 : width - 80 - nodeWidth;
      positions[et.systemName] = { x, y: height / 2 - nodeHeight / 2 };
    } else {
      // Semi-elliptical placement
      const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
      const radiusX = 190;
      const radiusY = 85;
      const cx = width / 2;
      const cy = height / 2;
      positions[et.systemName] = {
        x: cx + radiusX * Math.cos(angle) - nodeWidth / 2,
        y: cy + radiusY * Math.sin(angle) - nodeHeight / 2,
      };
    }
  });

  return (
    <div className="relative w-full h-[320px] md:h-[380px] lg:h-[420px] min-h-[300px] rounded-2xl bg-slate-950/20 dark:bg-slate-950/50 backdrop-blur-md border border-white/20 dark:border-white/10 overflow-hidden shadow-inner flex items-center justify-center">
      {/* SVG Canvas for Relationship Edges */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <defs>
          <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.8" />
          </linearGradient>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#8B5CF6" />
          </marker>
        </defs>

        {relationshipTypes.map((rel, i) => {
          const source = positions[rel.sourceEntityType];
          const target = positions[rel.targetEntityType];
          if (!source || !target) return null;

          const sx = source.x + nodeWidth / 2;
          const sy = source.y + nodeHeight / 2;
          const tx = target.x + nodeWidth / 2;
          const ty = target.y + nodeHeight / 2;

          // Bezier control point for smooth curvature
          const mx = (sx + tx) / 2;
          const my = (sy + ty) / 2 - 25;

          return (
            <g key={`${rel.systemName}-${i}`}>
              <path
                d={`M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}`}
                fill="none"
                stroke="url(#edgeGradient)"
                strokeWidth="2"
                strokeDasharray="4 2"
                markerEnd="url(#arrow)"
                className="transition-all duration-300"
              />
              {/* Midpoint Label badge */}
              <foreignObject x={mx - 40} y={my - 14} width="80" height="24">
                <div className="flex items-center justify-center">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-900/80 text-violet-300 border border-violet-500/30 shadow-xs">
                    {rel.cardinality === 'MANY_TO_ONE'
                      ? 'N : 1'
                      : rel.cardinality === 'ONE_TO_MANY'
                      ? '1 : N'
                      : rel.cardinality === 'ONE_TO_ONE'
                      ? '1 : 1'
                      : 'N : N'}
                  </span>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>

      {/* Render Entity Nodes */}
      {entityTypes.map((et) => {
        const pos = positions[et.systemName];
        if (!pos) return null;

        return (
          <div
            key={et.systemName}
            style={{
              position: 'absolute',
              left: `${(pos.x / width) * 100}%`,
              top: `${(pos.y / height) * 100}%`,
              width: `${(nodeWidth / width) * 100}%`,
            }}
            className="p-3 rounded-xl bg-white/75 dark:bg-slate-900/85 backdrop-blur-xl border border-white/40 dark:border-white/20 shadow-md shadow-black/10 dark:shadow-black/30 flex flex-col gap-1 transition-transform hover:scale-105"
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Database className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="font-semibold text-xs text-foreground truncate">
                  {et.name}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
              <span className="truncate">{et.systemName}</span>
              <span className="text-primary font-semibold shrink-0">
                {et.attributes.length} fields
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
