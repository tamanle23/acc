import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Magnet,
  Scissors,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  MousePointer,
  Hand,
  Maximize,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Slider } from './ui/slider';
import { Tooltip } from './ui/tooltip';
import { Toggle } from './ui/toggle';
import { Separator } from './ui/separator';
import { AudioWaveform } from './timeline/AudioWaveform';
import { TimecodeRuler } from './timeline/TimecodeRuler';
import { FilmstripThumbnail } from './timeline/FilmstripThumbnail';
import { MasterAudioMeter } from './audio/MasterAudioMeter';
import { IRStateManager } from '../lib/ir/irState';
import { WebAudioEngine } from '../lib/audio/WebAudioEngine';

interface TimelineProps {
  playhead: {
    currentFrame: number;
    totalFrames: number;
    fps: number;
  };
  onScrub: (frame: number) => void;
}

export function Timeline({ playhead, onScrub }: TimelineProps) {
  const currentFrame = playhead?.currentFrame || 0;
  const fps = playhead?.fps || 30;

  const [isPlaying, setIsPlaying] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoomScale, setZoomScale] = useState(1.0); // 1.0 = ~4px per frame
  const [activeTool, setActiveTool] = useState<'select' | 'razor' | 'hand'>('select');
  const [lockedTracks, setLockedTracks] = useState<Record<string, boolean>>({});
  const [mutedTracks, setMutedTracks] = useState<Record<string, boolean>>({});

  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());

  useEffect(() => {
    return IRStateManager.getInstance().subscribe(setIrState);
  }, []);

  const totalFrames = irState.timeline?.totalDurationFrames || playhead?.totalFrames || 300;
  const rawTracks = irState.timeline?.tracks;
  const tracks = rawTracks instanceof Map
    ? Array.from(rawTracks.values())
    : Array.isArray(rawTracks)
    ? rawTracks
    : [];
  const selectedSeqId = irState.selectedSequenceId;

  // Playhead transport animation loop & real audio playback
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      WebAudioEngine.getInstance().startPlayback(currentFrame, fps, irState);
      interval = setInterval(() => {
        onScrub(currentFrame >= totalFrames ? 0 : currentFrame + 1);
      }, 1000 / fps);
    } else {
      WebAudioEngine.getInstance().stopPlayback();
    }
    return () => {
      if (interval) clearInterval(interval);
      WebAudioEngine.getInstance().stopPlayback();
    };
  }, [isPlaying, fps, irState]);

  const handleScrub = (frame: number) => {
    WebAudioEngine.getInstance().playScrubFeedback(frame, fps, irState);
    onScrub(frame);
  };

  const handleSplit = () => {
    if (!selectedSeqId) return;
    IRStateManager.getInstance().splitSequence(selectedSeqId, currentFrame);
  };

  const handleTrim = (seqId: string, deltaStart: number, deltaDuration: number) => {
    IRStateManager.getInstance().trimSequence(seqId, deltaStart, deltaDuration);
  };

  const toggleLock = (trackId: string) => {
    setLockedTracks((prev) => ({ ...prev, [trackId]: !prev[trackId] }));
  };

  const toggleMute = (trackId: string) => {
    setMutedTracks((prev) => ({ ...prev, [trackId]: !prev[trackId] }));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleScrub(Math.max(0, currentFrame - (e.shiftKey ? fps : 1)));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleScrub(Math.min(totalFrames, currentFrame + (e.shiftKey ? fps : 1)));
      } else if (e.key === 'c' || e.key === 'C') {
        setActiveTool('razor');
        handleSplit();
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
      } else if (e.key === 'h' || e.key === 'H') {
        setActiveTool('hand');
      } else if (e.key === 'z' || e.key === 'Z') {
        // Zoom to fit
        setZoomScale(1.0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFrame, totalFrames, fps, selectedSeqId]);

  const pixelsPerFrame = Math.max(1, 4 * zoomScale);
  const timelineWidth = Math.max(800, totalFrames * pixelsPerFrame);

  const getTrackBadgeStyle = (track: any) => {
    if (track.type === 'audio') return 'bg-emerald-600 border-emerald-700 text-white';
    if (track.id.includes('v2') || track.id.includes('depth')) return 'bg-violet-600 border-violet-700 text-white';
    if (track.type === 'video') return 'bg-indigo-600 border-indigo-700 text-white';
    return 'bg-amber-600 border-amber-700 text-white';
  };

  return (
    <footer className="h-72 bg-white border-t border-slate-200 flex flex-col select-none shadow-sm">
      {/* 1. Pro Transport & Utility Bar */}
      <div className="h-11 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50/80">
        <div className="flex items-center gap-1.5">
          {/* Tool Selector Bar */}
          <Tooltip content="Selection Tool (V)">
            <Button
              variant={activeTool === 'select' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setActiveTool('select')}
              className="h-7 w-7 text-slate-700"
            >
              <MousePointer className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>

          <Tooltip content="Razor Split Tool (C)">
            <Button
              variant={activeTool === 'razor' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => {
                setActiveTool('razor');
                handleSplit();
              }}
              className="h-7 w-7 text-slate-700"
            >
              <Scissors className="w-3.5 h-3.5 text-indigo-600" />
            </Button>
          </Tooltip>

          <Tooltip content="Hand Pan Tool (H)">
            <Button
              variant={activeTool === 'hand' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setActiveTool('hand')}
              className="h-7 w-7 text-slate-700"
            >
              <Hand className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>

          <Separator orientation="vertical" className="h-4 mx-1" />

          {/* Transport Controls */}
          <Tooltip content="Rewind to Start (Home)">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleScrub(0)}
              className="h-7 w-7 text-slate-600 hover:text-slate-900"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>

          <Tooltip content={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
            <Button
              variant={isPlaying ? 'secondary' : 'default'}
              size="icon"
              onClick={() => setIsPlaying(!isPlaying)}
              className="h-7 w-7"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
            </Button>
          </Tooltip>

          <Tooltip content="Fast Forward 1s">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleScrub(Math.min(totalFrames, currentFrame + fps))}
              className="h-7 w-7 text-slate-600 hover:text-slate-900"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <Tooltip content="Magnetic Snapping">
            <Toggle
              pressed={snapEnabled}
              onPressedChange={setSnapEnabled}
              size="sm"
              className="h-7 px-2 text-[11px] gap-1 data-[state=on]:bg-indigo-50 data-[state=on]:text-indigo-600"
            >
              <Magnet className="w-3 h-3" />
              Snap
            </Toggle>
          </Tooltip>
        </div>

        {/* Center: Zoom Controls & Fit */}
        <div className="flex items-center gap-2">
          <ZoomOut
            className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-700"
            onClick={() => setZoomScale((z) => Math.max(0.4, z - 0.2))}
          />
          <Slider
            min={0.4}
            max={3.0}
            step={0.1}
            value={zoomScale}
            onValueChange={setZoomScale}
            className="w-24 cursor-pointer"
          />
          <ZoomIn
            className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-700"
            onClick={() => setZoomScale((z) => Math.min(3.0, z + 0.2))}
          />

          <Tooltip content="Zoom to Fit (Z)">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoomScale(1.0)}
              className="h-7 w-7 text-slate-500 hover:text-slate-800"
            >
              <Maximize className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>
        </div>

        {/* Right: Master Audio VU Meter & Timecode Readout */}
        <div className="flex items-center gap-3">
          <MasterAudioMeter isPlaying={isPlaying} currentFrame={currentFrame} />

          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[11px] border-slate-200 text-slate-700 bg-white">
              {(currentFrame / fps).toFixed(2)}s / {(totalFrames / fps).toFixed(2)}s
            </Badge>
            <Badge variant="secondary" className="font-mono text-[11px] text-indigo-700 bg-indigo-50 font-semibold">
              F {currentFrame} / {totalFrames}
            </Badge>
          </div>
        </div>
      </div>

      {/* 2. Scrollable Multi-Track Lanes with Integrated Timecode Ruler */}
      <div className="flex-1 overflow-x-auto overflow-y-auto px-6 py-1">
        <div style={{ minWidth: `${timelineWidth + 180}px` }} className="space-y-1 relative">
          {/* Header Row: Left spacer + Timecode Ruler */}
          <div className="flex items-center gap-2">
            <div className="w-44 shrink-0 text-[10px] font-mono text-slate-400 pl-2">
              TRACK HEADERS
            </div>
            <div className="flex-1">
              <TimecodeRuler
                totalFrames={totalFrames}
                fps={fps}
                pixelsPerFrame={pixelsPerFrame}
                timelineWidth={timelineWidth}
                onScrub={handleScrub}
              />
            </div>
          </div>

          {/* Global Playhead Vertical Needle */}
          <div
            className="absolute top-0 bottom-0 z-30 pointer-events-none transition-all duration-75 flex flex-col items-center"
            style={{
              left: `${180 + currentFrame * pixelsPerFrame}px`,
            }}
          >
            <div className="w-2.5 h-2.5 bg-rose-500 rotate-45 -mt-1 shadow-xs" />
            <div className="w-0.5 flex-1 bg-rose-500/80" />
          </div>

          {tracks.length === 0 ? (
            <div className="flex items-center justify-center h-28 text-xs text-slate-400 italic">
              Compiling Video IR Tracks...
            </div>
          ) : (
            tracks.map((track) => {
              const isLocked = lockedTracks[track.id] || false;
              const isMuted = mutedTracks[track.id] || false;

              return (
                <div key={track.id} className="h-10 flex items-center gap-2">
                  {/* Track Header / Controls */}
                  <div className="w-44 h-full bg-slate-100/90 rounded-md border border-slate-200 flex items-center justify-between px-2.5 shrink-0 shadow-2xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-[11px] font-medium text-slate-800 truncate">
                        {track.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleLock(track.id)}
                        className={`p-1 rounded hover:bg-slate-200 text-slate-600 ${isLocked ? 'text-amber-600 font-bold' : ''}`}
                      >
                        {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      </button>

                      <button
                        onClick={() => toggleMute(track.id)}
                        className={`p-1 rounded hover:bg-slate-200 text-slate-600 ${isMuted ? 'text-rose-600 font-bold' : ''}`}
                      >
                        {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Track Sequence Lane */}
                  <div
                    className={`flex-1 h-full rounded-md border relative overflow-hidden bg-slate-50/50 ${
                      isLocked ? 'opacity-60 pointer-events-none' : ''
                    }`}
                  >
                    {track.sequences.map((seq) => {
                      const isSelected = selectedSeqId === seq.id;
                      const leftPx = seq.startFrame * pixelsPerFrame;
                      const widthPx = Math.max(16, seq.durationFrames * pixelsPerFrame);
                      const isAudio = track.type === 'audio';

                      return (
                        <div
                          key={seq.id}
                          onClick={() => IRStateManager.getInstance().setSelectedSequenceId(seq.id)}
                          style={{
                            left: `${leftPx}px`,
                            width: `${widthPx}px`,
                          }}
                          className={`absolute top-1 bottom-1 rounded-sm border px-2 flex items-center justify-between cursor-pointer transition-all select-none group ${
                            isSelected
                              ? 'ring-2 ring-indigo-500 shadow-md z-20'
                              : 'hover:brightness-95 z-10'
                          } ${getTrackBadgeStyle(track)}`}
                        >
                          {/* Left Trim Handle */}
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleTrim(seq.id, 5, -5);
                            }}
                            className="w-1.5 h-full -ml-1 cursor-ew-resize hover:bg-white/40 rounded-xs"
                            title="Trim Start (+5f)"
                          />

                          {/* Sequence Label & Visuals */}
                          <div className="flex-1 truncate px-1 flex items-center gap-1.5 relative overflow-hidden h-full">
                            {isAudio ? (
                              <AudioWaveform
                                id={seq.id}
                                durationFrames={seq.durationFrames}
                                width={widthPx}
                                height={28}
                              />
                            ) : (
                              <FilmstripThumbnail
                                assetId={seq.assetId || seq.id}
                                width={widthPx}
                                height={28}
                              />
                            )}
                            <span className="text-[10px] font-mono font-medium truncate relative z-10 drop-shadow-xs">
                              {seq.id}
                            </span>
                            {seq.modifiers && seq.modifiers.length > 0 && (
                              <span className="text-[8px] bg-white/20 px-1 py-0.5 rounded-xs relative z-10 backdrop-blur-xs">
                                {seq.modifiers.length} mod
                              </span>
                            )}
                          </div>

                          {/* Right Trim Handle */}
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleTrim(seq.id, 0, 5);
                            }}
                            className="w-1.5 h-full -mr-1 cursor-ew-resize hover:bg-white/40 rounded-xs"
                            title="Trim End (+5f)"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </footer>
  );
}
