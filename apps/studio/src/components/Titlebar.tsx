import React, { useRef } from 'react';
import { Download, Upload, Undo2, Redo2, FileJson, XCircle, Film, Sparkles, PanelLeft, PanelRight, Sun, Moon, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tooltip } from './ui/tooltip';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { IRStateManager } from '../lib/ir/irState';
import { useTheme } from '../lib/theme/ThemeProvider';

interface TitlebarProps {
  projectTitle: string;
  fps: number;
  currentFrame: number;
  totalFrames: number;
  isExporting: boolean;
  onStartExport: () => void;
  onCancelExport: () => void;
  isLeftOpen?: boolean;
  onToggleLeft?: () => void;
  isRightOpen?: boolean;
  onToggleRight?: () => void;
}

export function Titlebar({
  projectTitle,
  fps,
  currentFrame,
  totalFrames,
  isExporting,
  onStartExport,
  onCancelExport,
  isLeftOpen,
  onToggleLeft,
  isRightOpen,
  onToggleRight,
}: TitlebarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const manager = IRStateManager.getInstance();
  const state = manager.getState();
  const { preferences, toggleMode, setIsSettingsOpen } = useTheme();

  const handleDownloadIR = () => {
    const jsonStr = manager.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectTitle.toLowerCase().replace(/\s+/g, '_')}_video_ir.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadIR = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = manager.loadFromJSON(content);
        if (!result.valid) {
          alert(`Invalid Video IR JSON:\n- ${result.errors.join('\n- ')}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="h-14 glass-panel px-4 flex items-center justify-between select-none z-20 transition-colors">
      <div className="flex items-center gap-3">
        {onToggleLeft && (
          <Tooltip content={isLeftOpen ? 'Collapse Left Drawer ([)' : 'Expand Left Drawer ([)'}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleLeft}
              className={`h-8 w-8 text-slate-500 hover:text-slate-200 dark:hover:text-white ${isLeftOpen ? 'bg-indigo-500/10 text-indigo-400' : ''}`}
            >
              <PanelLeft className="w-4 h-4" />
            </Button>
          </Tooltip>
        )}
        <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
          IR
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">{projectTitle}</h1>
            <Badge
              variant="secondary"
              className="font-mono text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800"
            >
              Universal Video IR V1.0
            </Badge>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {currentFrame} / {totalFrames} f ({(currentFrame / fps).toFixed(2)}s / {(totalFrames / fps).toFixed(2)}s @ {fps}fps)
          </span>
        </div>

        {/* Demo Template Switcher */}
        <div className="ml-4 flex items-center gap-1.5">
          <Select
            value={state.activeTemplate}
            onValueChange={(val: 'scifi' | 'default') => manager.switchTemplate(val)}
          >
            <SelectTrigger className="h-7 text-[11px] w-48 bg-slate-50 border-slate-200">
              <SelectValue placeholder="Select Demo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scifi">Sci-Fi Cyberpunk (9-Track Epic)</SelectItem>
              <SelectItem value="default">Default Cinematic Reel (5-Track)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Undo / Redo with Strategy Pattern */}
        <Tooltip content="Undo (Ctrl+Z)">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => manager.undo()}
            disabled={!manager.canUndo()}
            className="h-8 w-8 text-slate-600"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        <Tooltip content="Redo (Ctrl+Y)">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => manager.redo()}
            disabled={!manager.canRedo()}
            className="h-8 w-8 text-slate-600"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-1" />

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleUploadIR}
          className="hidden"
        />

        {/* Import Video IR JSON */}
        <Tooltip content="Import Video IR JSON">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 text-xs h-8 text-slate-700 shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            Import IR
          </Button>
        </Tooltip>

        {/* Export / Save Video IR JSON */}
        <Tooltip content="Export / Save Video IR JSON">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadIR}
            className="gap-1.5 text-xs h-8 text-indigo-700 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 shadow-2xs"
          >
            <FileJson className="w-3.5 h-3.5" />
            Save IR
          </Button>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-1" />

        {/* MP4 Export Button */}
        <Tooltip content="WebCodecs Client-Side MP4 Export">
          <div>
            {isExporting ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={onCancelExport}
                className="gap-1.5 h-8 text-xs shadow-2xs"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel Export
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={onStartExport}
                className="gap-1.5 h-8 text-xs shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                Export MP4
              </Button>
            )}
          </div>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-1" />

        {/* Quick Dark/Light Theme Toggle */}
        <Tooltip content={preferences.mode === 'dark' ? 'Switch to Light Frosted Acrylic' : 'Switch to Dark Obsidian'}>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMode}
            className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            {preferences.mode === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
          </Button>
        </Tooltip>

        {/* Liquid Glass Preferences Modal */}
        <Tooltip content="Liquid Glass Preferences">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        {onToggleRight && (
          <>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <Tooltip content={isRightOpen ? 'Collapse Inspector (])' : 'Expand Inspector (])'}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleRight}
                className={`h-8 w-8 text-slate-600 dark:text-slate-400 ${isRightOpen ? 'bg-indigo-500/10 text-indigo-500' : ''}`}
              >
                <PanelRight className="w-4 h-4" />
              </Button>
            </Tooltip>
          </>
        )}
      </div>
    </header>
  );
}
