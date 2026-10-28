import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Undo2, Redo2, FileJson, XCircle, Film, Sparkles, PanelLeft, PanelRight, Sun, Moon, Settings, Keyboard, Code2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tooltip } from './ui/tooltip';
import { TooltipProvider } from "./ui/tooltip";
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { IRStateManager } from '../lib/ir/irState';
import { useIRSelector } from '../lib/ir/useStudioStore';
import { useTheme } from '../lib/theme/ThemeProvider';
import { ShortcutsModal } from './ShortcutsModal';
import { VisualIRJsonDebuggerModal } from './debugger/VisualIRJsonDebuggerModal';

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
  const activeTemplate = useIRSelector((s) => s.activeTemplate);
  const canUndo = useIRSelector((s) => s.canUndo);
  const canRedo = useIRSelector((s) => s.canRedo);
  const { preferences, toggleMode, setIsSettingsOpen } = useTheme();
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isDebuggerOpen, setIsDebuggerOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsDebuggerOpen((prev) => !prev);
        return;
      }
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
    <header className="h-14 glass-panel px-4 flex justify-between select-none z-20 transition-colors">
      <div className="flex items-center gap-3">
        {onToggleLeft && (
          <Tooltip content={isLeftOpen ? 'Collapse Left Drawer ([)' : 'Expand Left Drawer ([)'}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleLeft}
              aria-label={isLeftOpen ? 'Collapse Left Drawer' : 'Expand Left Drawer'}
              className={`h-8 w-8 transition-colors ${isLeftOpen ? 'bg-accent-theme/15 text-accent-theme' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <PanelLeft className="w-4 h-4" />
            </Button>
          </Tooltip>
        )}
        <div className="h-8 w-8 rounded-lg bg-accent-theme text-primary-foreground flex items-center justify-center font-bold text-xs shadow-accent-glow select-none">
          IR
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-foreground tracking-tight">{projectTitle}</h1>
            <Badge
              variant="outline"
              className="font-mono text-[10px] text-accent-theme bg-accent-theme/10 border-accent-theme/30"
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
            value={activeTemplate}
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
            disabled={!canUndo}
            aria-label="Undo action"
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
            disabled={!canRedo}
            aria-label="Redo action"
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
            className="gap-1.5 text-xs h-8 text-accent-theme border-accent-theme/40 bg-accent-theme/10 hover:bg-accent-theme/20 shadow-xs"
          >
            <FileJson className="w-3.5 h-3.5" />
            Save IR
          </Button>
        </Tooltip>

        {/* Visual VideoIR JSON Debugger Modal Trigger */}
        <Tooltip content="Visual VideoIR JSON Editor & Debugger (Ctrl+Shift+J)">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDebuggerOpen(true)}
            data-testid="titlebar-debugger-btn"
            className="gap-1.5 text-xs h-8 font-mono text-foreground border-border/50 bg-muted/40 hover:bg-muted/80 shadow-xs"
          >
            <Code2 className="w-3.5 h-3.5 text-accent-theme" />
            Debugger
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
            aria-label={preferences.mode === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {preferences.mode === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-accent-theme" />}
          </Button>
        </Tooltip>

        {/* Keyboard Shortcuts Cheat Sheet */}
        <Tooltip content="Keyboard Shortcuts (?)">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsShortcutsOpen(true)}
            aria-label="Open keyboard shortcuts"
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
            aria-label="Open settings"
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
                aria-label={isRightOpen ? 'Collapse Inspector' : 'Expand Inspector'}
                className={`h-8 w-8 transition-colors ${isRightOpen ? 'bg-accent-theme/15 text-accent-theme' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <PanelRight className="w-4 h-4" />
              </Button>
            </Tooltip>
          </>
        )}
      </div>

      <ShortcutsModal open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
      <VisualIRJsonDebuggerModal open={isDebuggerOpen} onOpenChange={setIsDebuggerOpen} />
    </header>
  );
}
