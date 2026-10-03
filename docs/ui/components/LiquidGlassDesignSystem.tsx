'use client';

import React, { useState } from 'react';

// ============================================================================
// DEFAULT LIGHT MODE LIQUID GLASS PANEL PRIMITIVE
// ============================================================================

export interface LiquidGlassPanelProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'cyan' | 'magenta' | 'emerald' | 'purple';
  isDarkMode?: boolean;
}

export const LiquidGlassPanel: React.FC<LiquidGlassPanelProps> = ({
  children,
  className = '',
  glowColor = 'cyan',
  isDarkMode = false
}) => {
  const glowMapLight = {
    cyan: 'shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(0,180,216,0.2)] border-cyan-500/30 bg-white/70',
    magenta: 'shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(217,70,239,0.2)] border-pink-500/30 bg-white/70',
    emerald: 'shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.2)] border-emerald-500/30 bg-white/70',
    purple: 'shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(168,85,247,0.2)] border-purple-500/30 bg-white/70'
  };

  const glowMapDark = {
    cyan: 'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:shadow-[0_12px_48px_0_rgba(0,240,255,0.2)] border-cyan-500/20 bg-slate-900/45',
    magenta: 'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:shadow-[0_12px_48px_0_rgba(255,0,127,0.2)] border-pink-500/20 bg-slate-900/45',
    emerald: 'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:shadow-[0_12px_48px_0_rgba(16,185,129,0.2)] border-emerald-500/20 bg-slate-900/45',
    purple: 'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:shadow-[0_12px_48px_0_rgba(168,85,247,0.2)] border-purple-500/20 bg-slate-900/45'
  };

  const activeGlowMap = isDarkMode ? glowMapDark[glowColor] : glowMapLight[glowColor];

  return (
    <div
      className={`
        relative rounded-2xl backdrop-blur-xl saturate-200
        border transition-all duration-300 ease-out
        ${activeGlowMap} ${className}
      `}
    >
      {/* Specular Top Rim Highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/90 via-white/40 to-cyan-400/40 rounded-t-2xl pointer-events-none" />
      {children}
    </div>
  );
};

// ============================================================================
// WORKSPACE 1: LIGHT MODE TRIGGER & SEED STUDIO
// ============================================================================

export const TriggerStudioWorkspace: React.FC<{ onLaunch: (pipelineId: string) => void }> = ({ onLaunch }) => {
  const [selectedPipeline, setSelectedPipeline] = useState('1');
  const [isDarkMode, setIsDarkMode] = useState(false);

  return (
    <div className={`min-h-screen p-8 font-sans relative overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className="absolute top-10 left-10 w-96 h-96 bg-cyan-400/20 rounded-full blur-[120px] pointer-events-none" />

      <LiquidGlassPanel isDarkMode={isDarkMode} className="p-6 mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wider">ACC CONTROL PLANE</h1>
          <p className="text-xs text-cyan-600 font-semibold">Light Mode Liquid Glass Studio (Default Theme)</p>
        </div>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white/80 hover:bg-white text-slate-800 shadow-sm"
        >
          Toggle Theme: {isDarkMode ? 'Dark Mode' : 'Default Light Mode'}
        </button>
      </LiquidGlassPanel>

      <div className="grid grid-cols-12 gap-6">
        <LiquidGlassPanel isDarkMode={isDarkMode} className="col-span-3 p-4 flex flex-col gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Pipeline</span>
          {['1', '2', '3', '4', '5', '6'].map((id) => (
            <button
              key={id}
              onClick={() => setSelectedPipeline(id)}
              className={`w-full text-left p-3 rounded-xl transition-all font-semibold text-sm ${
                selectedPipeline === id ? 'bg-cyan-500/20 text-cyan-700 border border-cyan-500/40 font-bold' : 'bg-white/50 text-slate-700 hover:bg-white/80'
              }`}
            >
              Pipeline {id} Configuration
            </button>
          ))}
        </LiquidGlassPanel>

        <LiquidGlassPanel isDarkMode={isDarkMode} className="col-span-9 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold mb-4">Pipeline {selectedPipeline} Ingestion Rules &amp; Seed Options</h2>
            <div className="bg-white/80 p-4 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 shadow-inner">
              {`{ "pipelineId": "${selectedPipeline}", "grammarRules": "vLLM Qwen2.5 Strict JSON", "whitelistedFeeds": ["RSS", "Webhooks", "GraphQL"] }`}
            </div>
          </div>
          <button
            onClick={() => onLaunch(selectedPipeline)}
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg transition-all"
          >
            Launch Pipeline {selectedPipeline} Workflow
          </button>
        </LiquidGlassPanel>
      </div>
    </div>
  );
};
