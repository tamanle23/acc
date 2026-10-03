'use client';

import React, { useState } from 'react';

export interface LiquidGlassPanelProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'cyan' | 'magenta' | 'emerald';
}

export const LiquidGlassPanel: React.FC<LiquidGlassPanelProps> = ({
  children,
  className = '',
  glowColor = 'cyan'
}) => {
  const glowMap = {
    cyan: 'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:shadow-[0_12px_48px_0_rgba(0,240,255,0.2)]',
    magenta: 'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:shadow-[0_12px_48px_0_rgba(255,0,127,0.2)]',
    emerald: 'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:shadow-[0_12px_48px_0_rgba(16,185,129,0.2)]'
  };

  return (
    <div
      className={`
        relative rounded-2xl bg-slate-900/45 backdrop-blur-xl saturate-200
        border border-white/20 transition-all duration-300 ease-out
        ${glowMap[glowColor]} ${className}
      `}
    >
      {/* Specular Top Rim Highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/40 via-white/10 to-cyan-400/30 rounded-t-2xl pointer-events-none" />
      {children}
    </div>
  );
};

export interface LiquidGlassWorkspaceProps {
  taskId: string;
  contentTypeId: string;
  scriptText: string;
  onApprove: (updatedScript: string) => Promise<void>;
  onReject: () => Promise<void>;
}

export const LiquidGlassWorkspace: React.FC<LiquidGlassWorkspaceProps> = ({
  taskId,
  contentTypeId,
  scriptText: initialScript,
  onApprove,
  onReject
}) => {
  const [script, setScript] = useState(initialScript);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApprove(script);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-8 relative overflow-hidden font-sans">
      {/* Background Ambient Mesh Glows */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-pink-500/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Header Bar */}
      <LiquidGlassPanel className="p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-wider text-white">
            ACC CONTROL PLANE
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
            {contentTypeId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-pink-500 animate-pulse" />
          <span className="text-xs font-semibold text-pink-400 uppercase tracking-wide">
            Paused at Conductor Gate ({taskId})
          </span>
        </div>
      </LiquidGlassPanel>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Side: Video Preview Canvas (9:16) */}
        <LiquidGlassPanel className="col-span-8 p-6 flex flex-col items-center">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 self-start">
            Zero-Copy WebGL Frame Preview
          </h2>
          <div className="relative w-[340px] h-[600px] bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
            <span className="text-cyan-400/70 text-sm font-mono">[ 9:16 TikTok Frame Stream ]</span>
            {/* Safe Zone Overlay */}
            <div className="absolute bottom-0 inset-x-0 h-36 border-t border-dashed border-pink-500/40 bg-pink-500/5 flex items-center justify-center">
              <span className="text-[10px] text-pink-400 font-mono">TikTok Safe Zone</span>
            </div>
          </div>
        </LiquidGlassPanel>

        {/* Right Side: Script Editor & Controls */}
        <LiquidGlassPanel className="col-span-4 p-6 flex flex-col justify-between" glowColor="magenta">
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              AI Narrative Script Editor
            </h2>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={12}
              className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl p-4 text-slate-200 focus:outline-none focus:border-cyan-400/80 transition-colors font-mono text-sm leading-relaxed resize-none"
            />
          </div>

          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'Resuming Workflow...' : 'Approve & Resume Workflow'}
            </button>
            <button
              onClick={onReject}
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold rounded-xl border border-red-500/30 transition-all active:scale-[0.98]"
            >
              Reject & Re-prompt
            </button>
          </div>
        </LiquidGlassPanel>
      </div>
    </div>
  );
};
