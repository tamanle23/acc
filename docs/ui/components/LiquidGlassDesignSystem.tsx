'use client';

import React, { useState } from 'react';

// ============================================================================
// 1. LIQUID GLASS UI PRIMITIVES
// ============================================================================

export interface LiquidGlassPanelProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'cyan' | 'magenta' | 'emerald' | 'purple';
}

export const LiquidGlassPanel: React.FC<LiquidGlassPanelProps> = ({
  children,
  className = '',
  glowColor = 'cyan'
}) => {
  const glowMap = {
    cyan: 'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:shadow-[0_12px_48px_0_rgba(0,240,255,0.2)] border-cyan-500/20',
    magenta: 'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:shadow-[0_12px_48px_0_rgba(255,0,127,0.2)] border-pink-500/20',
    emerald: 'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:shadow-[0_12px_48px_0_rgba(16,185,129,0.2)] border-emerald-500/20',
    purple: 'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:shadow-[0_12px_48px_0_rgba(168,85,247,0.2)] border-purple-500/20'
  };

  return (
    <div
      className={`
        relative rounded-2xl bg-slate-900/45 backdrop-blur-xl saturate-200
        border transition-all duration-300 ease-out
        ${glowMap[glowColor]} ${className}
      `}
    >
      {/* Specular Top Rim Highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/40 via-white/10 to-cyan-400/30 rounded-t-2xl pointer-events-none" />
      {children}
    </div>
  );
};

// ============================================================================
// 2. WORKSPACE 1: TRIGGER & SEED STUDIO (BEFORE STAGE)
// ============================================================================

export const TriggerStudioWorkspace: React.FC<{ onLaunch: (pipelineId: string) => void }> = ({ onLaunch }) => {
  const [selectedPipeline, setSelectedPipeline] = useState('1');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans relative overflow-hidden">
      <div className="absolute top-10 left-10 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px] pointer-events-none" />
      <LiquidGlassPanel className="p-6 mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wider text-white">ACC CONTROL PLANE</h1>
          <p className="text-xs text-cyan-400">Pipeline Trigger & Seed Studio (Before Stage)</p>
        </div>
      </LiquidGlassPanel>

      <div className="grid grid-cols-12 gap-6">
        <LiquidGlassPanel className="col-span-3 p-4 flex flex-col gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Pipeline</span>
          {['1', '2', '3', '4', '5', '6'].map((id) => (
            <button
              key={id}
              onClick={() => setSelectedPipeline(id)}
              className={`w-full text-left p-3 rounded-xl transition-all font-semibold text-sm ${
                selectedPipeline === id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-slate-900/40 text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              Pipeline {id} Configuration
            </button>
          ))}
        </LiquidGlassPanel>

        <LiquidGlassPanel className="col-span-9 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-4">Pipeline {selectedPipeline} Ingestion Rules &amp; Seed Options</h2>
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 font-mono text-xs text-cyan-300">
              {`{ "pipelineId": "${selectedPipeline}", "grammarRules": "vLLM Qwen2.5 Strict JSON", "whitelistedFeeds": ["RSS", "Webhooks", "GraphQL"] }`}
            </div>
          </div>
          <button
            onClick={() => onLaunch(selectedPipeline)}
            className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl shadow-lg transition-all"
          >
            Launch Pipeline {selectedPipeline} Workflow
          </button>
        </LiquidGlassPanel>
      </div>
    </div>
  );
};

// ============================================================================
// 3. WORKSPACE 2: FORMAT 3 ZERO-COPY VIDEO TIMELINE INTERVENTION
// ============================================================================

export const VideoTimelineWorkspace: React.FC<{
  taskId: string;
  onApprove: () => Promise<void>;
}> = ({ taskId, onApprove }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans relative overflow-hidden">
      <div className="absolute top-20 right-20 w-96 h-96 bg-pink-500/15 rounded-full blur-[140px] pointer-events-none" />

      <LiquidGlassPanel className="p-4 mb-6 flex items-center justify-between" glowColor="magenta">
        <span className="text-lg font-bold text-white">Video Intervene Workspace ({taskId})</span>
        <span className="text-xs text-pink-400 font-mono">Paused at Conductor Gate</span>
      </LiquidGlassPanel>

      <div className="grid grid-cols-12 gap-6">
        <LiquidGlassPanel className="col-span-8 p-6 flex flex-col items-center">
          <div className="relative w-[320px] h-[560px] bg-black rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden">
            <span className="text-cyan-400 font-mono text-xs">[ WebGL 9:16 Video Canvas ]</span>
            <div className="absolute bottom-0 inset-x-0 h-32 border-t border-dashed border-pink-500/40 bg-pink-500/5 flex items-center justify-center">
              <span className="text-[10px] text-pink-400 font-mono">TikTok Safe Zone</span>
            </div>
          </div>
        </LiquidGlassPanel>

        <LiquidGlassPanel className="col-span-4 p-6 flex flex-col justify-between" glowColor="emerald">
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase mb-4">Depth3D Controls</h3>
            <label className="text-xs text-slate-400">Pop-out Intensity</label>
            <input type="range" className="w-full accent-cyan-400 mb-4" />
          </div>
          <button
            onClick={onApprove}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl"
          >
            Approve &amp; Resume Video Workflow
          </button>
        </LiquidGlassPanel>
      </div>
    </div>
  );
};
