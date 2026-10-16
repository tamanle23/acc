import React, { useState, useEffect } from 'react';
import { Folder, Sliders, Film, Volume2, Image as ImageIcon, Search, Palette, Sparkles, Layers, SlidersHorizontal, Box } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { IRStateManager } from '../lib/ir/irState';

interface SidebarProps {
  activeTab: 'vault' | 'inspector';
  setActiveTab: (tab: 'vault' | 'inspector') => void;
  assets?: { inputs: any[]; outputs: any[] };
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());

  useEffect(() => {
    return IRStateManager.getInstance().subscribe(setIrState);
  }, []);

  const selectedSeqId = irState.selectedSequenceId;

  // Find the selected sequence in doc
  let selectedSeq: any = null;
  let selectedTrack: any = null;

  for (const track of irState.doc.tracks) {
    for (const seq of track.sequences) {
      if (seq.id === selectedSeqId) {
        selectedSeq = seq;
        selectedTrack = track;
        break;
      }
    }
    if (selectedSeq) break;
  }

  // Find color grading modifier
  const colorGradingMod = selectedSeq?.modifiers?.find((m: any) => m.type === 'vfx/color_grading');
  const contrast = colorGradingMod?.params?.contrast ?? 1.0;
  const saturation = colorGradingMod?.params?.saturation ?? 1.0;
  const exposure = colorGradingMod?.params?.exposure ?? 0.0;

  // Find ducking modifier if audio
  const duckingMod = selectedSeq?.modifiers?.find((m: any) => m.type === 'sfx/dynamic_ducking');
  const duckVolume = duckingMod?.params?.duckVolume ?? 0.25;

  // Find 3D Depth modifier
  const depth3dMod = selectedSeq?.modifiers?.find((m: any) => m.type === 'vfx/depth3d');
  const popOutIntensity = depth3dMod?.params?.popOutIntensity ?? 1.2;
  const depthMode = depth3dMod?.params?.mode ?? 'frame_breaker';

  const handleColorGradeChange = (param: string, value: number) => {
    if (!selectedSeqId) return;
    IRStateManager.getInstance().updateModifier(selectedSeqId, 'vfx/color_grading', {
      contrast: param === 'contrast' ? value : contrast,
      saturation: param === 'saturation' ? value : saturation,
      exposure: param === 'exposure' ? value : exposure,
    });
  };

  const handleDepthChange = (value: number) => {
    if (!selectedSeqId) return;
    IRStateManager.getInstance().updateModifier(selectedSeqId, 'vfx/depth3d', {
      mode: depthMode,
      popOutIntensity: value,
    });
  };

  const handleDuckingChange = (value: number) => {
    if (!selectedSeqId) return;
    IRStateManager.getInstance().updateModifier(selectedSeqId, 'sfx/dynamic_ducking', {
      duckVolume: value,
      attackMs: 150,
      releaseMs: 300,
      targetBus: 'track-a2',
    });
  };

  const assetList = Object.entries(irState.doc.assets || {}).map(([id, asset]) => ({
    id,
    ...asset,
  }));

  const filteredAssets = assetList.filter(
    (a) => a.id.toLowerCase().includes(filterQuery.toLowerCase()) || a.src.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <aside className="w-84 bg-white border-l border-slate-200 flex flex-col h-full select-none shadow-xs">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'vault' | 'inspector')}
        className="flex flex-col h-full"
      >
        {/* Tabs Header */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/50">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vault" className="gap-2">
              <Folder className="w-3.5 h-3.5" />
              IR Assets
            </TabsTrigger>
            <TabsTrigger value="inspector" className="gap-2">
              <Sliders className="w-3.5 h-3.5" />
              Inspector
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Video IR Asset Vault */}
        <TabsContent value="vault" className="flex-1 flex flex-col m-0 overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Filter IR assets..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-50/50"
              />
            </div>
          </div>

          <ScrollArea className="flex-1 p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Registered IR Assets
              </h3>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {filteredAssets.length}
              </Badge>
            </div>

            {filteredAssets.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No assets registered in Video IR.</p>
            ) : (
              <div className="space-y-2">
                {filteredAssets.map((asset) => (
                  <Card
                    key={asset.id}
                    className="p-2.5 border-slate-200 hover:border-indigo-300 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-900 truncate text-xs font-mono">
                        {asset.id}
                      </span>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono">
                        {asset.type}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate font-mono">{asset.src}</p>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Tab 2: Live Modifier Inspector */}
        <TabsContent value="inspector" className="flex-1 flex flex-col m-0 overflow-hidden">
          <ScrollArea className="flex-1 p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Sequence Inspector
              </h3>
              <Badge variant="outline" className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border-indigo-200">
                {selectedSeqId || 'None'}
              </Badge>
            </div>

            {!selectedSeq ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                Select a sequence on the timeline to inspect and edit its Video IR modifiers.
              </p>
            ) : (
              <div className="space-y-4">
                {/* General Sequence Info Card */}
                <Card className="p-3 bg-slate-50/70 border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Track:</span>
                    <span className="font-mono font-medium text-slate-800">{selectedTrack?.id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Type:</span>
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                      {selectedTrack?.type}
                    </Badge>
                  </div>
                  {selectedSeq.assetId && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Asset:</span>
                      <span className="font-mono text-slate-700 truncate max-w-[140px]">
                        {selectedSeq.assetId}
                      </span>
                    </div>
                  )}
                </Card>

                {/* Color Grading Modifier Controls */}
                <Card className="p-3 border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-800">Color Grade (vfx)</span>
                    </div>
                    <Badge variant="secondary" className="text-[9px] font-mono">
                      WebGL Shader
                    </Badge>
                  </div>

                  {/* Contrast */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Contrast</span>
                      <span className="font-mono">{contrast.toFixed(2)}x</span>
                    </div>
                    <Slider
                      min={0.5}
                      max={2.0}
                      step={0.05}
                      value={contrast}
                      onValueChange={(val) => handleColorGradeChange('contrast', val)}
                    />
                  </div>

                  {/* Saturation */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Saturation</span>
                      <span className="font-mono">{saturation.toFixed(2)}x</span>
                    </div>
                    <Slider
                      min={0.0}
                      max={2.0}
                      step={0.05}
                      value={saturation}
                      onValueChange={(val) => handleColorGradeChange('saturation', val)}
                    />
                  </div>

                  {/* Exposure */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Exposure</span>
                      <span className="font-mono">{exposure >= 0 ? `+${exposure.toFixed(2)}` : exposure.toFixed(2)}</span>
                    </div>
                    <Slider
                      min={-1.0}
                      max={1.0}
                      step={0.05}
                      value={exposure}
                      onValueChange={(val) => handleColorGradeChange('exposure', val)}
                    />
                  </div>
                </Card>

                {/* 3D Depth Modifier Controls */}
                {depth3dMod && (
                  <Card className="p-3 border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Box className="w-3.5 h-3.5 text-violet-600" />
                        <span className="text-xs font-bold text-slate-800">3D Depth (vfx)</span>
                      </div>
                      <Badge variant="secondary" className="text-[9px] font-mono">
                        {depthMode}
                      </Badge>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Pop-Out Intensity</span>
                        <span className="font-mono">{popOutIntensity.toFixed(2)}x</span>
                      </div>
                      <Slider
                        min={0.5}
                        max={2.5}
                        step={0.05}
                        value={popOutIntensity}
                        onValueChange={(val) => handleDepthChange(val)}
                      />
                    </div>
                  </Card>
                )}

                {/* Audio Dynamic Ducking Controls (if audio track) */}
                {selectedTrack?.type === 'audio' && (
                  <Card className="p-3 border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-800">Dynamic Ducking (sfx)</span>
                      </div>
                      <Badge variant="secondary" className="text-[9px] font-mono">
                        Auto-Bus
                      </Badge>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Duck Volume</span>
                        <span className="font-mono">{Math.round(duckVolume * 100)}%</span>
                      </div>
                      <Slider
                        min={0.0}
                        max={1.0}
                        step={0.05}
                        value={duckVolume}
                        onValueChange={(val) => handleDuckingChange(val)}
                      />
                    </div>
                  </Card>
                )}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
