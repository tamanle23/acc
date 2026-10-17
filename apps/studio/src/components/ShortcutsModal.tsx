import React from 'react';
import { Keyboard, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export interface ShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUT_GROUPS = [
  {
    category: 'Playback & Transport',
    shortcuts: [
      { key: 'Space', description: 'Play / Pause timeline playback' },
      { key: 'Left / Right', description: 'Step backward / forward 1 frame' },
      { key: 'Shift + Left / Right', description: 'Jump backward / forward 1 second' },
      { key: 'Home', description: 'Rewind playhead to start (0:00)' },
    ],
  },
  {
    category: 'Editing & Timeline Tools',
    shortcuts: [
      { key: 'V', description: 'Select Tool (standard pointer mode)' },
      { key: 'C', description: 'Razor Cut Tool (split sequence at playhead or click)' },
      { key: 'H', description: 'Hand Tool (interactive viewport panning)' },
      { key: 'Z', description: 'Zoom to Fit timeline duration' },
      { key: 'Ctrl + D', description: 'Duplicate active sequence selection' },
      { key: 'Delete / Backspace', description: 'Delete selected sequence' },
    ],
  },
  {
    category: 'History & Workspace Layout',
    shortcuts: [
      { key: 'Ctrl + Z', description: 'Undo last operation' },
      { key: 'Ctrl + Shift + Z / Ctrl + Y', description: 'Redo last operation' },
      { key: '[', description: 'Toggle Left Sidebar (Library & Assets Vault)' },
      { key: ']', description: 'Toggle Right Sidebar (Inspector & GSAP Motion)' },
      { key: '?', description: 'Open Keyboard Shortcuts cheat sheet' },
    ],
  },
];

export function ShortcutsModal({ open, onOpenChange }: ShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl glass-panel border border-[var(--glass-border)] p-6 rounded-2xl shadow-2xl backdrop-blur-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">Keyboard Shortcuts</DialogTitle>
              <p className="text-xs text-muted-foreground">Universal hotkeys for enterprise NLE workflow</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.category} className="space-y-2">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                {group.category}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((sc) => (
                  <div
                    key={sc.key}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded-md bg-white/5 border border-white/5 hover:border-white/10"
                  >
                    <span className="text-muted-foreground">{sc.description}</span>
                    <Badge variant="outline" className="font-mono text-[11px] bg-white/10 border-white/10 text-foreground px-1.5 py-0.5">
                      {sc.key}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
