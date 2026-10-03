'use client';

import React, { useState } from 'react';

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
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 p-8 relative overflow-hidden font-sans">
      {/* Light Mode Ambient Glows */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-cyan-400/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-pink-400/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Header Bar */}
      <div className="p-4 mb-6 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-wider text-slate-900">
            ACC CONTROL PLANE
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-700 border border-cyan-500/30 font-mono font-semibold">
            {contentTypeId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-pink-500 animate-pulse" />
          <span className="text-xs font-bold text-pink-600 uppercase tracking-wide">
            Paused at Conductor Gate ({taskId})
          </span>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Side: Video Preview Canvas */}
        <div className="col-span-8 p-6 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col items-center">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 self-start">
            Zero-Copy WebGL Frame Preview
          </h2>
          <div className="relative w-[340px] h-[600px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl flex items-center justify-center">
            <span className="text-cyan-400 font-mono text-xs">[ 9:16 TikTok Frame Stream ]</span>
            <div className="absolute bottom-0 inset-x-0 h-36 border-t border-dashed border-pink-500/50 bg-pink-500/10 flex items-center justify-center">
              <span className="text-[10px] text-pink-300 font-mono font-bold">TikTok Safe Zone</span>
            </div>
          </div>
        </div>

        {/* Right Side: Script Editor */}
        <div className="col-span-4 p-6 rounded-2xl bg-white/70 backdrop-blur-xl border border-pink-500/30 shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
              AI Narrative Script Editor
            </h2>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={12}
              className="w-full bg-white/90 border border-slate-300 rounded-xl p-4 text-slate-900 focus:outline-none focus:border-cyan-500 transition-colors font-mono text-sm leading-relaxed resize-none shadow-inner"
            />
          </div>

          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'Resuming Workflow...' : 'Approve & Resume Workflow'}
            </button>
            <button
              onClick={onReject}
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl border border-red-200 transition-all active:scale-[0.98]"
            >
              Reject &amp; Re-prompt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
