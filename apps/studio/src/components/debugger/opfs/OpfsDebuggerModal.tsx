import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  HardDrive,
  RefreshCw,
  Trash2,
  Plus,
  Layers,
  Database,
  Sparkles,
  AlertTriangle,
  FolderPlus,
  CheckCircle2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  OpfsCacheStrategy,
  formatOpfsBytes,
  type OpfsTreeNode,
  type OpfsStorageEstimate,
} from '@acc/core-web';
import { ContentCacheRegistry, ContentCacheStrategyId } from '@acc/core-isomorphic';
import { OpfsTreeExplorer } from './OpfsTreeExplorer';
import { OpfsFilePreview } from './OpfsFilePreview';
import type { OpfsFileDetails } from './types';

export interface OpfsDebuggerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpfsDebuggerModal({ open, onOpenChange }: OpfsDebuggerModalProps) {
  // Obtain or instantiate OpfsCacheStrategy
  const strategy = useMemo(() => {
    try {
      if (ContentCacheRegistry.has(ContentCacheStrategyId.Opfs)) {
        const found = ContentCacheRegistry.get(ContentCacheStrategyId.Opfs);
        if (found instanceof OpfsCacheStrategy) {
          return found;
        }
      }
    } catch {}
    return new OpfsCacheStrategy();
  }, []);

  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [quota, setQuota] = useState<OpfsStorageEstimate | null>(null);
  const [tree, setTree] = useState<OpfsTreeNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<OpfsTreeNode | null>(null);
  const [fileDetails, setFileDetails] = useState<OpfsFileDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('sample-debug.json');
  const [newFileContent, setNewFileContent] = useState<string>(
    JSON.stringify({ timestamp: Date.now(), purpose: 'OPFS debug verification' }, null, 2)
  );

  // Load Tree and Quota
  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const supported = strategy.isSupported();
      setIsSupported(supported);

      const [treeData, quotaData] = await Promise.all([
        strategy.inspectTree(),
        strategy.getStorageEstimate(),
      ]);

      setTree(treeData);
      setQuota(quotaData);

      // If a file was selected, re-read it
      if (selectedNode && selectedNode.kind === 'file') {
        await loadFileDetails(selectedNode);
      }
    } catch (err: unknown) {
      toast.error('Failed to inspect OPFS tree');
    } finally {
      setIsRefreshing(false);
    }
  }, [strategy, selectedNode]);

  // Load file details when a node is selected
  const loadFileDetails = useCallback(
    async (node: OpfsTreeNode) => {
      setSelectedNode(node);
      if (node.kind === 'directory') {
        setFileDetails(null);
        return;
      }

      setFileDetails({
        node,
        blob: null,
        text: null,
        hexBytes: null,
        companionMeta: node.metadata || null,
        isLoading: true,
        error: null,
      });

      try {
        const blob = await strategy.readEntryBlob(node.name);
        if (!blob) {
          setFileDetails((prev) =>
            prev ? { ...prev, isLoading: false, error: 'File handle inaccessible' } : null
          );
          return;
        }

        const ab = await blob.arrayBuffer();
        const hexBytes = new Uint8Array(ab);

        let text: string | null = null;
        const mime = node.mimeType || blob.type || '';
        const isTextual =
          mime.startsWith('text/') ||
          mime === 'application/json' ||
          node.name.endsWith('.json') ||
          node.name.endsWith('.meta.json') ||
          node.name.endsWith('.txt');

        if (isTextual && hexBytes.byteLength < 5 * 1024 * 1024) {
          try {
            text = new TextDecoder('utf-8').decode(hexBytes);
          } catch {}
        }

        setFileDetails({
          node,
          blob,
          text,
          hexBytes,
          companionMeta: node.metadata || null,
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        setFileDetails((prev) =>
          prev
            ? { ...prev, isLoading: false, error: err?.message || 'Error reading stream' }
            : null
        );
      }
    },
    [strategy]
  );

  useEffect(() => {
    if (open) {
      refreshData();
    }
  }, [open, refreshData]);

  // Purge entire OPFS cache
  const handlePurge = async () => {
    if (!confirm('Are you sure you want to purge all cached files in OPFS?')) return;
    setIsPurging(true);
    try {
      await strategy.clear();
      setSelectedNode(null);
      setFileDetails(null);
      await refreshData();
      toast.success('OPFS cache purged successfully');
    } catch {
      toast.error('Failed to purge OPFS cache');
    } finally {
      setIsPurging(false);
    }
  };

  // Delete single file
  const handleDeleteFile = async (fileName: string, isDirectory: boolean = false) => {
    try {
      const ok = await strategy.removeCustomEntry(fileName, isDirectory);
      if (ok) {
        toast.success(`Removed ${fileName}`);
        if (selectedNode?.name === fileName) {
          setSelectedNode(null);
          setFileDetails(null);
        }
        await refreshData();
      } else {
        toast.error(`Could not delete ${fileName}`);
      }
    } catch {
      toast.error(`Error deleting ${fileName}`);
    }
  };

  // Create test file
  const handleCreateTestFile = async () => {
    if (!newFileName.trim()) return;
    try {
      await strategy.writeCustomFile(newFileName.trim(), newFileContent, 'application/json');
      toast.success(`Created file ${newFileName.trim()}`);
      setShowNewFileDialog(false);
      await refreshData();
    } catch (err: any) {
      toast.error(`Failed to create file: ${err?.message || 'Unknown error'}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-w-7xl w-[95vw] h-[88vh] glass-panel text-foreground border-[var(--glass-border)] p-0 rounded-2xl shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-[var(--glass-border)] shrink-0 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-theme/15 border border-accent-theme/30 flex items-center justify-center text-accent-theme shadow-xs">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Origin Private File System (OPFS) Debugger
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono ${
                    isSupported
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {isSupported ? 'OPFS Active' : 'IndexedDB Fallback'}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-mono mt-0.5">
                Directory: <span className="text-foreground font-semibold">{strategy.getDirectoryName()}</span>
                {tree && (
                  <span>
                    {' '}• Total: <span className="text-cyan-400">{formatOpfsBytes(tree.sizeBytes)}</span>
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>

          {/* Quota Progress & Action Controls */}
          <div className="flex items-center gap-3">
            {quota && (
              <div className="hidden md:flex flex-col items-end text-[11px] font-mono mr-2">
                <div className="text-muted-foreground">
                  Storage Quota: <span className="text-foreground font-semibold">{quota.formattedUsage}</span> / {quota.formattedQuota}
                </div>
                <div className="w-36 h-1.5 bg-muted/60 rounded-full overflow-hidden mt-1 border border-border/40">
                  <div
                    className="h-full bg-accent-theme transition-all duration-500"
                    style={{ width: `${Math.max(1, Math.min(100, quota.usagePercent))}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={isRefreshing}
              className="h-8 text-xs gap-1.5 border-border/60 hover:bg-muted"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewFileDialog(true)}
              className="h-8 text-xs gap-1.5 border-border/60 hover:bg-muted text-accent-theme"
            >
              <Plus className="w-3.5 h-3.5" />
              Write Test File
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePurge}
              disabled={isPurging}
              className="h-8 text-xs gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Purge Cache
            </Button>
          </div>
        </DialogHeader>

        {/* Split Explorer Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Tree Explorer (340px) */}
          <div className="w-80 shrink-0 h-full">
            <OpfsTreeExplorer
              rootNode={tree}
              selectedPath={selectedNode?.path || null}
              onSelectNode={loadFileDetails}
              onDeleteNode={(name, isDir) => handleDeleteFile(name, isDir)}
            />
          </div>

          {/* Right Live Preview / Inspector */}
          <div className="flex-1 h-full bg-background/30">
            <OpfsFilePreview
              details={fileDetails}
              onDeleteFile={(name) => handleDeleteFile(name, false)}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-3 border-t border-[var(--glass-border)] bg-muted/20 shrink-0 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
            <span>Disk-backed zero-heap streaming storage</span>
            <span>•</span>
            <span className="text-accent-theme font-medium">Ctrl+Shift+O</span> to toggle
          </div>
          <Button
            variant="accent"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="px-5 cursor-pointer text-xs h-8"
          >
            Close
          </Button>
        </DialogFooter>

        {/* New Test File Modal Dialog */}
        {showNewFileDialog && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-[var(--glass-border)] shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                  <Plus className="w-4 h-4 text-accent-theme" />
                  Write Test File to OPFS
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewFileDialog(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-3 font-mono text-xs">
                <div>
                  <label className="text-muted-foreground block text-[10px] mb-1">File Name</label>
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    className="w-full h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 text-foreground"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground block text-[10px] mb-1">Content (UTF-8)</label>
                  <textarea
                    rows={6}
                    value={newFileContent}
                    onChange={(e) => setNewFileContent(e.target.value)}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-foreground leading-relaxed font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewFileDialog(false)}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={handleCreateTestFile}
                  className="text-xs h-8"
                >
                  Write to OPFS
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
