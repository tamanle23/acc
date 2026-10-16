import React, { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';

interface MasterAudioMeterProps {
  isPlaying: boolean;
  currentFrame: number;
}

export function MasterAudioMeter({ isPlaying, currentFrame }: MasterAudioMeterProps) {
  const [levelL, setLevelL] = useState(0);
  const [levelR, setLevelR] = useState(0);

  useEffect(() => {
    if (!isPlaying) {
      setLevelL(0);
      setLevelR(0);
      return;
    }

    // Simulate responsive stereo VU meter dynamics based on playback oscillation
    const interval = setInterval(() => {
      const base = 0.45 + Math.sin(currentFrame * 0.3) * 0.35;
      const noiseL = (Math.random() - 0.5) * 0.15;
      const noiseR = (Math.random() - 0.5) * 0.15;

      setLevelL(Math.max(0.05, Math.min(0.95, base + noiseL)));
      setLevelR(Math.max(0.05, Math.min(0.95, base + noiseR)));
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, currentFrame]);

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 text-slate-300 rounded-md border border-slate-700/80 shadow-inner select-none">
      <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <div className="flex flex-col gap-1 w-20">
        {/* Left Channel */}
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-mono text-slate-500 w-2.5">L</span>
          <div className="flex-1 h-1.5 bg-slate-950 rounded-xs overflow-hidden flex">
            <div
              className={`h-full transition-all duration-75 rounded-xs ${
                levelL > 0.85 ? 'bg-rose-500' : levelL > 0.65 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${levelL * 100}%` }}
            />
          </div>
        </div>

        {/* Right Channel */}
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-mono text-slate-500 w-2.5">R</span>
          <div className="flex-1 h-1.5 bg-slate-950 rounded-xs overflow-hidden flex">
            <div
              className={`h-full transition-all duration-75 rounded-xs ${
                levelR > 0.85 ? 'bg-rose-500' : levelR > 0.65 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${levelR * 100}%` }}
            />
          </div>
        </div>
      </div>
      <span className="text-[9px] font-mono text-slate-400">
        {isPlaying ? `-${(1.0 - Math.max(levelL, levelR)) * 30 < 1 ? '0' : ((1.0 - Math.max(levelL, levelR)) * 30).toFixed(0)}dB` : '-inf'}
      </span>
    </div>
  );
}
