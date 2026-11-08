import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { cn } from 'cn';
import {
  Download,
  Upload,
  Undo2,
  Redo2,
  FileJson,
  XCircle,
  PanelLeft,
  PanelRight,
  Sun,
  Moon,
  Settings,
  Keyboard,
  Code2,
  HardDrive,
  Maximize2,
  Minimize2,
  MoreHorizontal,
} from 'lucide-solid';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tooltip } from './ui/tooltip';
import { Separator } from './ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from './ui/popover';
import { IRStateManager } from '../lib/ir/irState';
import { useIRSelector } from '../lib/ir/useStudioStore';
import { inferAspectRatioFromCanvasSize } from '@acc/ir';
import { useTheme } from '../lib/theme';
import { ShortcutsModal } from './ShortcutsModal';
import { IrVisualEditorModal } from './debugger/IrVisualEditorModal';
import { OpfsExplorerModal } from './debugger/opfs/OpfsExplorerModal';
import { ThemeQuickSwitcher } from './ThemeQuickSwitcher';
import { useTitlebarLOD, type TitlebarLOD } from './preview/useContainerLOD';

export interface TitlebarProps {
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
  isZenMode?: boolean;
  onToggleZen?: () => void;
  lod?: TitlebarLOD;
}

export function Titlebar(props: TitlebarProps) {
  const [headerRef, setHeaderRef] = createSignal<HTMLElement | null>(null);
  let fileInputRef!: HTMLInputElement;

  const measuredLod = useTitlebarLOD(headerRef);
  const lod = () => props.lod ?? measuredLod();
  // lod === 'compact' lod === 'full' reactive proxy evaluation

  const manager = IRStateManager.getInstance();
  const activeTemplate = useIRSelector((s) => s.activeTemplate);
  const canUndo = useIRSelector((s) => s.canUndo);
  const canRedo = useIRSelector((s) => s.canRedo);
  const docMeta = useIRSelector((s) => s.doc?.meta);
  const theme = useTheme();

  const [isShortcutsOpen, setIsShortcutsOpen] = createSignal(false);
  const [isDebuggerOpen, setIsDebuggerOpen] = createSignal(false);
  const [isOpfsOpen, setIsOpfsOpen] = createSignal(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = createSignal(false);

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsDebuggerOpen((prev) => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setIsOpfsOpen((prev) => !prev);
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?' || (e.ctrlKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });

  const handleDownloadIR = () => {
    const jsonStr = manager.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${props.projectTitle.toLowerCase().replace(/\s+/g, '_')}_video_ir.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadIR = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
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
    input.value = '';
  };

  const meta = () =>
    docMeta() || {
      canvasSize: { w: 1920, h: 1080 },
      aspectRatio: '16:9',
    };

  const ratio = () =>
    meta().aspectRatio || inferAspectRatioFromCanvasSize(meta().canvasSize.w, meta().canvasSize.h);

  return (
    <header
      ref={setHeaderRef}
      class="h-14 glass-panel px-2.5 sm:px-4 flex items-center justify-between select-none z-20 transition-colors gap-2 overflow-hidden shrink-0 whitespace-nowrap"
    >
      {/* Left Brand & Workspace Controls */}
      <div class="flex items-center gap-1.5 sm:gap-2.5 shrink min-w-0">
        <Show when={props.onToggleLeft}>
          <Tooltip content={props.isLeftOpen ? 'Collapse Left Drawer ([)' : 'Expand Left Drawer ([)'}>
            <Button
              variant="ghost"
              size="icon"
              onClick={props.onToggleLeft}
              aria-label={props.isLeftOpen ? 'Collapse Left Drawer' : 'Expand Left Drawer'}
              class={cn(
                "h-8 w-8 shrink-0 transition-colors",
                props.isLeftOpen
                  ? 'bg-accent-theme/15 text-accent-theme'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <PanelLeft class="w-4 h-4" />
            </Button>
          </Tooltip>
        </Show>

        <div class="h-8 w-8 rounded-lg bg-accent-theme text-primary-foreground flex items-center justify-center font-bold text-xs shadow-accent-glow select-none shrink-0">
          IR
        </div>

        <div class="min-w-0 flex flex-col justify-center">
          <div class="flex items-center gap-1.5 sm:gap-2">
            <h1
              class={cn(
                "text-xs sm:text-sm font-semibold text-foreground tracking-tight truncate",
                lod() === 'compact'
                  ? 'max-w-[90px] sm:max-w-[120px]'
                  : lod() === 'medium'
                    ? 'max-w-[150px]'
                    : 'max-w-[220px]'
              )}
            >
              {props.projectTitle}
            </h1>

            <Show when={lod() === 'full'}>
              <Badge
                variant="outline"
                class="font-mono text-[9px] sm:text-[10px] text-accent-theme bg-accent-theme/10 border-accent-theme/30"
              >
                Universal Video IR V1.0
              </Badge>
            </Show>

            {/* Clickable Base Aspect Ratio Pill */}
            <Tooltip content="Base Aspect Ratio — Click to configure in Inspector">
              <button
                type="button"
                onClick={() => {
                  if (!props.isRightOpen && props.onToggleRight) props.onToggleRight();
                  manager.setSelectedSequenceId(null);
                  manager.setInspectorMode('timeline');
                }}
                class="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent-theme/15 text-accent-theme border border-accent-theme/40 hover:bg-accent-theme/25 hover:border-accent-theme transition-all cursor-pointer shadow-accent-glow shrink-0"
              >
                <span>{ratio()}</span>
                <Show when={lod() === 'full'}>
                  <span class="text-[8px] opacity-75 font-normal">
                    ({meta().canvasSize.w}×{meta().canvasSize.h})
                  </span>
                </Show>
              </button>
            </Tooltip>
          </div>

          <Show when={lod() !== 'compact'}>
            <span class="text-[10px] sm:text-xs text-muted-foreground font-mono truncate">
              {lod() === 'full'
                ? `${props.currentFrame} / ${props.totalFrames} f (${(props.currentFrame / props.fps).toFixed(2)}s / ${(props.totalFrames / props.fps).toFixed(2)}s @ ${props.fps}fps)`
                : `${props.currentFrame}/${props.totalFrames}f (${(props.currentFrame / props.fps).toFixed(1)}s)`}
            </span>
          </Show>
        </div>

        {/* Responsive Demo Template Switcher */}
        <div class="ml-1 flex items-center shrink-0">
          <Select
            value={activeTemplate()}
            onChange={(val: any) => manager.switchTemplate(val)}
          >
            <SelectTrigger
              class={cn(
                "h-7 text-[11px] bg-[var(--glass-bg)] border-[var(--glass-border)] text-foreground truncate",
                lod() === 'compact'
                  ? 'w-24 sm:w-28 text-[10px]'
                  : lod() === 'medium'
                    ? 'w-36 text-[11px]'
                    : 'w-48 xl:w-56'
              )}
            >
              <SelectValue placeholder="Select Demo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scifi">Sci-Fi Cyberpunk (10-Track Epic)</SelectItem>
              <SelectItem value="default">Default Cinematic Reel (5-Track)</SelectItem>
              <SelectItem value="broadcast">Broadcast News Matrix (4-Track)</SelectItem>
              <SelectItem value="visualizer">Cyber Audio Visualizer (4-Track)</SelectItem>
              <SelectItem value="quantum">Quantum Physics & Cymatics Lab (5-Track)</SelectItem>
              <SelectItem value="astro">Astroscientific Singularity (5-Track)</SelectItem>
              <SelectItem value="typography">Kinetic Typography Plexus (5-Track)</SelectItem>
              <SelectItem value="mastering">Cinema Mastering & Glare (6-Track)</SelectItem>
              <SelectItem value="spatial_audio">Spatial Soundscape & SFX (6-Track)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Right Control & Action Bar */}
      <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleUploadIR}
          class="hidden"
        />

        {/* Undo / Redo Actions (Inline on medium & full, in popover on compact) */}
        <Show when={lod() !== 'compact'}>
          <Tooltip content="Undo (Ctrl+Z)">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => manager.undo()}
              disabled={!canUndo()}
              aria-label="Undo action"
              class="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-40 shrink-0"
            >
              <Undo2 class="w-3.5 h-3.5" />
            </Button>
          </Tooltip>

          <Tooltip content="Redo (Ctrl+Y)">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => manager.redo()}
              disabled={!canRedo()}
              aria-label="Redo action"
              class="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-40 shrink-0"
            >
              <Redo2 class="w-3.5 h-3.5" />
            </Button>
          </Tooltip>

          <Separator orientation="vertical" class="h-4 mx-0.5" />
        </Show>

        {/* Import Video IR JSON */}
        <Show when={lod() !== 'compact'}>
          <Tooltip content="Import Video IR JSON">
            <Button
              variant="outline"
              size={lod() === 'full' ? 'sm' : 'icon'}
              onClick={() => fileInputRef?.click()}
              class={cn(
                "h-8 shadow-xs border-[var(--glass-border)] text-foreground hover:bg-foreground/5",
                lod() === 'full' ? "gap-1.5 text-xs px-2 sm:px-3" : "w-8 p-0"
              )}
            >
              <Upload class="w-3.5 h-3.5 text-muted-foreground" />
              <Show when={lod() === 'full'}>
                <span>Import IR</span>
              </Show>
            </Button>
          </Tooltip>
        </Show>

        {/* Export / Save Video IR JSON */}
        <Show when={lod() !== 'compact'}>
          <Tooltip content="Export / Save Video IR JSON">
            <Button
              variant="outline"
              size={lod() === 'full' ? 'sm' : 'icon'}
              onClick={handleDownloadIR}
              class={cn(
                "h-8 text-accent-theme border-accent-theme/40 bg-accent-theme/10 hover:bg-accent-theme/20 shadow-xs",
                lod() === 'full' ? "gap-1.5 text-xs px-2 sm:px-3" : "w-8 p-0"
              )}
            >
              <FileJson class="w-3.5 h-3.5" />
              <Show when={lod() === 'full'}>
                <span>Save IR</span>
              </Show>
            </Button>
          </Tooltip>
        </Show>

        {/* Debugger & OPFS (Inline on full LOD only, inside popover on medium & compact) */}
        <Show when={lod() === 'full'}>
          <Tooltip content="Visual VideoIR JSON Editor & Debugger (Ctrl+Shift+J)">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDebuggerOpen(true)}
              data-testid="titlebar-debugger-btn"
              class="gap-1.5 text-xs h-8 font-mono text-foreground border-border/50 bg-muted/40 hover:bg-muted/80 shadow-xs px-2 sm:px-3"
            >
              <Code2 class="w-3.5 h-3.5 text-accent-theme" />
              <span>Debugger</span>
            </Button>
          </Tooltip>

          <Tooltip content="Inspect & Debug OPFS Files & Folders (Ctrl+Shift+O)">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpfsOpen(true)}
              data-testid="titlebar-opfs-debugger-btn"
              class="gap-1.5 text-xs h-8 font-mono text-foreground border-border/50 bg-muted/40 hover:bg-muted/80 shadow-xs px-2 sm:px-3"
            >
              <HardDrive class="w-3.5 h-3.5 text-accent-theme" />
              <span>Cache</span>
            </Button>
          </Tooltip>
        </Show>

        <Show when={lod() !== 'compact'}>
          <Separator orientation="vertical" class="h-4 mx-0.5" />
        </Show>

        {/* MP4 Export Button (Primary CTA - always visible across all LODs) */}
        <Tooltip content="WebCodecs Client-Side MP4 Export">
          <div>
            <Show
              when={props.isExporting}
              fallback={
                <Button
                  variant="default"
                  size="sm"
                  onClick={props.onStartExport}
                  class="gap-1.5 h-8 text-xs shadow-xs px-2 sm:px-3 font-semibold"
                >
                  <Download class="w-3.5 h-3.5" />
                  <Show when={lod() === 'compact'} fallback={<span>Export MP4</span>}>
                    <span>Export</span>
                  </Show>
                </Button>
              }
            >
              <Button
                variant="destructive"
                size="sm"
                onClick={props.onCancelExport}
                class="gap-1.5 h-8 text-xs shadow-xs px-2 sm:px-3"
              >
                <XCircle class="w-3.5 h-3.5" />
                <Show when={lod() !== 'compact'}>
                  <span>Cancel Export</span>
                </Show>
              </Button>
            </Show>
          </div>
        </Tooltip>

        <Separator orientation="vertical" class="h-4 mx-0.5" />

        {/* 20 Presets Quick Palette Switcher */}
        <ThemeQuickSwitcher />

        {/* Quick Dark/Light Theme Toggle (Inline on full & medium) */}
        <Show when={lod() === 'full'}>
          <Tooltip
            content={
              theme.preferences.mode === 'dark'
                ? 'Switch to Light Frosted Acrylic'
                : 'Switch to Dark Obsidian'
            }
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={theme.toggleMode}
              aria-label={
                theme.preferences.mode === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'
              }
              class="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            >
              {theme.preferences.mode === 'dark' ? (
                <Sun class="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon class="w-3.5 h-3.5 text-accent-theme" />
              )}
            </Button>
          </Tooltip>
        </Show>

        {/* Keyboard Shortcuts Cheat Sheet (Inline on full LOD) */}
        <Show when={lod() === 'full'}>
          <Tooltip content="Keyboard Shortcuts (?)">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsShortcutsOpen(true)}
              aria-label="Open keyboard shortcuts"
              class="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            >
              <Keyboard class="w-3.5 h-3.5" />
            </Button>
          </Tooltip>
        </Show>

        {/* Zen Focus Mode (\) Toggle Button */}
        <Show when={props.onToggleZen}>
          <Tooltip content={props.isZenMode ? 'Exit Zen Mode (\\)' : 'Zen Focus Mode (\\)'}>
            <Button
              variant="ghost"
              size="icon"
              onClick={props.onToggleZen}
              aria-label="Toggle Zen Focus Mode"
              class={cn(
                "h-8 w-8 transition-colors shrink-0",
                props.isZenMode
                  ? 'bg-accent-theme/20 text-accent-theme shadow-accent-glow'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {props.isZenMode ? (
                <Minimize2 class="w-3.5 h-3.5" />
              ) : (
                <Maximize2 class="w-3.5 h-3.5" />
              )}
            </Button>
          </Tooltip>
        </Show>

        {/* Settings Modal (Inline on full & medium) */}
        <Show when={lod() !== 'compact'}>
          <Tooltip content="Theme & Optical Glass Settings">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => theme.setIsSettingsOpen(true)}
              aria-label="Open settings"
              class="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            >
              <Settings class="w-3.5 h-3.5" />
            </Button>
          </Tooltip>
        </Show>

        {/* More Tools & Actions Popover Menu (Visible when lod !== 'full') */}
        <Show when={lod() !== 'full'}>
          <Popover open={isMoreMenuOpen()} onOpenChange={setIsMoreMenuOpen}>
            <Tooltip content="More Actions & Dev Tools">
              <PopoverTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="More actions and developer tools"
                  class="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                >
                  <MoreHorizontal class="w-4 h-4" />
                </Button>
              </PopoverTrigger>
            </Tooltip>

            <PopoverContent
              side="bottom"
              align="end"
              sideOffset={8}
              class="w-60 p-3 rounded-2xl glass-panel shadow-glass border border-glass-border flex flex-col gap-2.5 text-xs select-none backdrop-blur-xl z-50"
            >
              {/* Compact-only Actions: Undo / Redo & File Import/Export */}
              <Show when={lod() === 'compact'}>
                <div class="flex flex-col gap-1 border-b border-glass-border pb-2">
                  <span class="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Edit & Project
                  </span>
                  <div class="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        manager.undo();
                        setIsMoreMenuOpen(false);
                      }}
                      disabled={!canUndo()}
                      class="justify-start gap-2 h-7 text-xs"
                    >
                      <Undo2 class="w-3.5 h-3.5" />
                      <span>Undo</span>
                      <span class="text-[9px] text-muted-foreground ml-auto">^Z</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        manager.redo();
                        setIsMoreMenuOpen(false);
                      }}
                      disabled={!canRedo()}
                      class="justify-start gap-2 h-7 text-xs"
                    >
                      <Redo2 class="w-3.5 h-3.5" />
                      <span>Redo</span>
                      <span class="text-[9px] text-muted-foreground ml-auto">^Y</span>
                    </Button>
                  </div>

                  <div class="grid grid-cols-2 gap-1.5 mt-1 font-mono text-[11px]">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        fileInputRef?.click();
                        setIsMoreMenuOpen(false);
                      }}
                      class="justify-start gap-1.5 h-7 text-xs border-glass-border"
                    >
                      <Upload class="w-3 h-3 text-muted-foreground" />
                      <span>Import IR</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleDownloadIR();
                        setIsMoreMenuOpen(false);
                      }}
                      class="justify-start gap-1.5 h-7 text-xs text-accent-theme border-accent-theme/40 bg-accent-theme/10"
                    >
                      <FileJson class="w-3 h-3" />
                      <span>Save IR</span>
                    </Button>
                  </div>
                </div>
              </Show>

              {/* Developer Diagnostics */}
              <div class="flex flex-col gap-1">
                <span class="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Developer Tools
                </span>
                <button
                  type="button"
                  data-testid="titlebar-debugger-btn"
                  onClick={() => {
                    setIsDebuggerOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  class="flex items-center justify-between px-2 py-1.5 rounded-lg border border-glass-border text-foreground hover:bg-foreground/5 transition-all cursor-pointer font-mono text-xs"
                >
                  <span class="flex items-center gap-1.5">
                    <Code2 class="w-3.5 h-3.5 text-accent-theme" />
                    Visual IR Debugger
                  </span>
                  <span class="text-[9px] text-muted-foreground font-sans">^⇧J</span>
                </button>

                <button
                  type="button"
                  data-testid="titlebar-opfs-debugger-btn"
                  onClick={() => {
                    setIsOpfsOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  class="flex items-center justify-between px-2 py-1.5 rounded-lg border border-glass-border text-foreground hover:bg-foreground/5 transition-all cursor-pointer font-mono text-xs"
                >
                  <span class="flex items-center gap-1.5">
                    <HardDrive class="w-3.5 h-3.5 text-accent-theme" />
                    Cache
                  </span>
                  <span class="text-[9px] text-muted-foreground font-sans">^⇧O</span>
                </button>
              </div>

              {/* Preferences & Help */}
              <div class="flex flex-col gap-1 border-t border-glass-border pt-1.5">
                <span class="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Preferences & Help
                </span>

                <button
                  type="button"
                  onClick={() => {
                    theme.toggleMode();
                    setIsMoreMenuOpen(false);
                  }}
                  class="flex items-center justify-between px-2 py-1.5 rounded-lg border border-glass-border text-foreground hover:bg-foreground/5 transition-all cursor-pointer text-xs"
                >
                  <span class="flex items-center gap-1.5">
                    {theme.preferences.mode === 'dark' ? (
                      <Sun class="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Moon class="w-3.5 h-3.5 text-accent-theme" />
                    )}
                    Theme: {theme.preferences.mode === 'dark' ? 'Dark Obsidian' : 'Light Frosted'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsShortcutsOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  class="flex items-center justify-between px-2 py-1.5 rounded-lg border border-glass-border text-foreground hover:bg-foreground/5 transition-all cursor-pointer text-xs"
                >
                  <span class="flex items-center gap-1.5">
                    <Keyboard class="w-3.5 h-3.5 text-accent-theme" />
                    Keyboard Shortcuts (?)
                  </span>
                  <span class="text-[9px] text-muted-foreground">?</span>
                </button>

                <Show when={lod() === 'compact'}>
                  <button
                    type="button"
                    onClick={() => {
                      theme.setIsSettingsOpen(true);
                      setIsMoreMenuOpen(false);
                    }}
                    class="flex items-center justify-between px-2 py-1.5 rounded-lg border border-glass-border text-foreground hover:bg-foreground/5 transition-all cursor-pointer text-xs"
                  >
                    <span class="flex items-center gap-1.5">
                      <Settings class="w-3.5 h-3.5 text-accent-theme" />
                      Theme & Glass Settings
                    </span>
                  </button>
                </Show>
              </div>
            </PopoverContent>
          </Popover>
        </Show>

        {/* Right Drawer Toggle */}
        <Show when={props.onToggleRight}>
          <Separator orientation="vertical" class="h-4 mx-0.5" />
          <Tooltip content={props.isRightOpen ? 'Collapse Inspector (])' : 'Expand Inspector (])'}>
            <Button
              variant="ghost"
              size="icon"
              onClick={props.onToggleRight}
              aria-label={props.isRightOpen ? 'Collapse Inspector' : 'Expand Inspector'}
              class={cn(
                "h-8 w-8 transition-colors shrink-0",
                props.isRightOpen
                  ? 'bg-accent-theme/15 text-accent-theme'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <PanelRight class="w-4 h-4" />
            </Button>
          </Tooltip>
        </Show>
      </div>

      <ShortcutsModal open={isShortcutsOpen()} onOpenChange={setIsShortcutsOpen} />
      <IrVisualEditorModal open={isDebuggerOpen()} onOpenChange={setIsDebuggerOpen} />
      <OpfsExplorerModal open={isOpfsOpen()} onOpenChange={setIsOpfsOpen} />
    </header>
  );
}
