import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Undo2, Redo2, FileJson, XCircle, Film, Sparkles, PanelLeft, PanelRight, Sun, Moon, Settings, Keyboard } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tooltip } from './ui/tooltip';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { IRStateManager } from '../lib/ir/irState';
import { useTheme } from '../lib/theme/ThemeProvider';
import { ShortcutsModal } from './ShortcutsModal';

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
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?' || (e.ctrlKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
              className={`h-8 w-8 transition-colors ${isLeftOpen ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <PanelLeft className="w-4 h-4" />
            </Button>
          </Tooltip>
        )}
        <div className="h-8 w-8 rounded-lg bg-[var(--accent-primary)] text-slate-950 flex items-center justify-center font-bold text-xs shadow-[0_0_12px_var(--accent-glow)] select-none">
          IR
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-foreground tracking-tight">{projectTitle}</h1>
            <Badge
              variant="outline"
              className="font-mono text-[10px] text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30"
            >
              Universal Video IR V1.0
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {currentFrame} / {totalFrames} f ({(currentFrame / fps).toFixed(2)}s / {(totalFrames / fps).toFixed(2)}s @ {fps}fps)
          </span>
        </div>

        {/* Demo Template Switcher */}
        <div className="ml-4 flex items-center gap-1.5">
          <Select
            value={state.activeTemplate}
            onValueChange={(val: 'scifi' | 'default') => manager.switchTemplate(val)}
          >
            <SelectTrigger className="h-7 text-[11px] w-48 bg-[var(--glass-bg)] border-[var(--glass-border)] text-foreground">
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
            className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-40"
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
            className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-40"
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
            className="gap-1.5 text-xs h-8 shadow-xs border-[var(--glass-border)] text-foreground hover:bg-foreground/5"
          >
            <Upload className="w-3.5 h-3.5 text-muted-foreground" />
            Import IR
          </Button>
        </Tooltip>

        {/* Export / Save Video IR JSON */}
        <Tooltip content="Export / Save Video IR JSON">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadIR}
            className="gap-1.5 text-xs h-8 text-[var(--accent-primary)] border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 shadow-xs"
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
                className="gap-1.5 h-8 text-xs shadow-xs"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel Export
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={onStartExport}
                className="gap-1.5 h-8 text-xs shadow-xs"
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
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {preferences.mode === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-[var(--accent-primary)]" />}
          </Button>
        </Tooltip>

        {/* Keyboard Shortcuts Cheat Sheet */}
        <Tooltip content="Keyboard Shortcuts (?)">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsShortcutsOpen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        {/* Liquid Glass Preferences Modal */}
        <Tooltip content="Liquid Glass Preferences">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
                className={`h-8 w-8 transition-colors ${isRightOpen ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <PanelRight className="w-4 h-4" />
              </Button>
            </Tooltip>
          </>
        )}
      </div>

      <ShortcutsModal open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
    </header>
  );
}
