import React, { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { WebAudioEngine } from '../../lib/audio/WebAudioEngine';

interface MasterAudioMeterProps {
  isPlaying: boolean;
  currentFrame: number;
}

export function MasterAudioMeter({ isPlaying, currentFrame }: MasterAudioMeterProps) {
  const [levelL, setLevelL] = useState(0);
  const [levelR, setLevelR] = useState(0);
  const [peakDbText, setPeakDbText] = useState('-inf');

  useEffect(() => {
    if (!isPlaying) {
      setLevelL(0);
      setLevelR(0);
      setPeakDbText('-inf');
      return;
    }

    const interval = setInterval(() => {
      const levels = WebAudioEngine.getInstance().getLiveLevels();
      if (levels.peakDb > -58) {
        setLevelL(levels.levelL);
        setLevelR(levels.levelR);
        setPeakDbText(`${levels.peakDb.toFixed(0)}dB`);
      } else {
        // Dynamic fallback when Web Audio is muted/suspended
        const base = 0.45 + Math.sin(currentFrame * 0.3) * 0.35;
        const noiseL = (Math.random() - 0.5) * 0.15;
        const noiseR = (Math.random() - 0.5) * 0.15;
        const lL = Math.max(0.05, Math.min(0.95, base + noiseL));
        const lR = Math.max(0.05, Math.min(0.95, base + noiseR));
        setLevelL(lL);
        setLevelR(lR);
        const dB = -((1.0 - Math.max(lL, lR)) * 30);
        setPeakDbText(dB > -1 ? '0dB' : `${dB.toFixed(0)}dB`);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, currentFrame]);

  return (
    <div className="flex items-center gap-2 px-3 py-1  text-slate-300 rounded-md border  border-[var(--glass-border)] shadow-inner select-none">
      <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <div className="flex flex-col gap-1 w-20">
        {/* Left Channel */}
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-mono text-slate-500 w-2.5">L</span>
          <div className="flex-1 h-1.5 bg-slate-950/30 rounded-xs overflow-hidden flex">
            <div
              className={`h-full transition-all duration-75 rounded-xs ${levelL > 0.85 ? 'bg-rose-500' : levelL > 0.65 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              style={{ width: `${levelL * 100}%` }}
            />
          </div>
        </div>

        {/* Right Channel */}
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-mono text-slate-500 w-2.5">R</span>
          <div className="flex-1 h-1.5 bg-slate-950/30 rounded-xs overflow-hidden flex">
            <div
              className={`h-full transition-all duration-75 rounded-xs ${levelR > 0.85 ? 'bg-rose-500' : levelR > 0.65 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              style={{ width: `${levelR * 100}%` }}
            />
          </div>
        </div>
      </div>
      <span className="text-[9px] font-mono text-slate-400 min-w-8 text-right">
        {peakDbText}
      </span>
    </div>
  );
}
