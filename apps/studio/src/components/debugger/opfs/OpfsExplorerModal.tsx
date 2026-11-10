import { createSignal, createEffect, createMemo, Show } from 'solid-js';
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
  X,
} from 'lucide-solid';
import { toast } from '../../ui/sonner';
import {
  OpfsCacheStrategy,
  formatOpfsBytes,
  type OpfsTreeNode,
  type OpfsStorageEstimate,
} from '@acc/core-web';
import { ContentCacheRegistry, ContentCacheStrategyId } from '@acc/core-isomorphic';
import { IRStateManager } from '../../../lib/ir/irState';
import { OpfsTree } from './OpfsTree';
import { OpfsFilePreview } from './OpfsFilePreview';
import type { OpfsFileDetails } from './types';

export interface OpfsDebuggerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpfsExplorerModal(props: OpfsDebuggerModalProps) {
  // Obtain or instantiate OpfsCacheStrategy
  const strategy = (() => {
    try {
      if (ContentCacheRegistry.hasStrategy(ContentCacheStrategyId.Opfs)) {
        const found = ContentCacheRegistry.getStrategy(ContentCacheStrategyId.Opfs);
        if (found instanceof OpfsCacheStrategy) {
          return found;
        }
      }
    } catch { }
    return new OpfsCacheStrategy();
  })();

  const [isSupported, setIsSupported] = createSignal<boolean>(true);
  const [quota, setQuota] = createSignal<OpfsStorageEstimate | null>(null);
  const [tree, setTree] = createSignal<OpfsTreeNode | null>(null);
  const [selectedNode, setSelectedNode] = createSignal<OpfsTreeNode | null>(null);
  const [fileDetails, setFileDetails] = createSignal<OpfsFileDetails | null>(null);
  const [isRefreshing, setIsRefreshing] = createSignal<boolean>(false);
  const [isPurging, setIsPurging] = createSignal<boolean>(false);
  const [showNewFileDialog, setShowNewFileDialog] = createSignal<boolean>(false);
  const [newFileName, setNewFileName] = createSignal<string>('sample-debug.json');
  const [newFileContent, setNewFileContent] = createSignal<string>(
    JSON.stringify({ timestamp: Date.now(), purpose: 'OPFS debug verification' }, null, 2)
  );

  // Load file details when a node is selected
  const loadFileDetails = async (node: OpfsTreeNode) => {
    setSelectedNode(node);
    if (node.kind === 'directory') {
      setFileDetails(null);
      return;
    }

    setFileDetails({
      node,
      blob: null,
      text: null,
      companionMeta: node.metadata || null,
      isLoading: true,
      error: null,
    });

    try {
      const blob = await strategy.readEntryBlob(node.path || node.name);
      if (!blob) {
        setFileDetails((prev) =>
          prev ? { ...prev, isLoading: false, error: 'File handle inaccessible' } : null
        );
        return;
      }

      let text: string | null = null;
      const mime = node.mimeType || blob.type || '';
      const isTextual =
        mime.startsWith('text/') ||
        mime === 'application/json' ||
        node.name.endsWith('.json') ||
        node.name.endsWith('.meta.json') ||
        node.name.endsWith('.txt');

      // Only read text for textual formats, sliced to at most 1 MB to prevent heap freeze
      if (isTextual) {
        try {
          const maxTextBytes = 1024 * 1024;
          const textSlice = blob.slice(0, maxTextBytes);
          text = await textSlice.text();
          if (blob.size > maxTextBytes) {
            text += `\n\n--- [TRUNCATED] Showing first 1 MB of ${formatOpfsBytes(blob.size)} ---`;
          }
        } catch { }
      }

      setFileDetails({
        node,
        blob,
        text,
        companionMeta: node.metadata || null,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      setFileDetails((prev) =>
        prev
          ? { ...prev, isLoading: false, error: err?.message || 'Error reading file' }
          : null
      );
    }
  };

  // Load Tree and Quota
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const supported = strategy.isSupported();
      setIsSupported(supported);

      let [treeData, quotaData] = await Promise.all([
        strategy.inspectTree(),
        strategy.getStorageEstimate(),
      ]);

      // Seed active VideoIR project snapshot into OPFS if directory is completely empty on first inspection
      if (supported && (!treeData.children || treeData.children.length === 0)) {
        try {
          const irJson = IRStateManager.getInstance().exportJSON();
          await strategy.set('project/active_video_ir.json', irJson, {
            mimeType: 'application/json',
          });
          [treeData, quotaData] = await Promise.all([
            strategy.inspectTree(),
            strategy.getStorageEstimate(),
          ]);
        } catch { }
      }

      setTree(treeData);
      setQuota(quotaData);

      // If a file was selected, re-read it
      const currentSelected = selectedNode();
      if (currentSelected && currentSelected.kind === 'file') {
        await loadFileDetails(currentSelected);
      }
    } catch {
      toast.error('Failed to inspect OPFS tree');
    } finally {
      setIsRefreshing(false);
    }
  };

  createEffect(() => {
    if (props.open) {
      refreshData();
    }
  });

  // Purge entire OPFS cache
  const handlePurge = async () => {
    if (!confirm('Are you sure you want to purge all cached files in OPFS?')) return;
    setIsPurging(true);
    try {
      await strategy.clear();
      setSelectedNode(null);
      setFileDetails(null);
      await refreshData();
      toast.success('Cache purged successfully');
    } catch {
      toast.error('Failed to purge cache');
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
        if (selectedNode()?.name === fileName) {
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
    const name = newFileName().trim();
    if (!name) return;
    try {
      await strategy.writeCustomFile(name, newFileContent(), 'application/json');
      toast.success(`Created file ${name}`);
      setShowNewFileDialog(false);
      await refreshData();
    } catch (err: any) {
      toast.error(`Failed to create file: ${err?.message || 'Unknown error'}`);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="sm:max-w-6xl max-w-7xl w-[95vw] h-[88vh] glass-panel text-foreground border-[var(--glass-border)] p-0 rounded-2xl shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader class="p-4 border-b border-[var(--glass-border)] shrink-0 flex flex-row items-center justify-between px-5 py-3 gap-4">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-accent-theme/15 border border-accent-theme/30 flex items-center justify-center text-accent-theme shadow-xs">
              <HardDrive class="w-5 h-5" />
            </div>
            <div>
              <DialogTitle class="text-base font-bold text-foreground flex items-center gap-2">
                File Explorer
                <Badge
                  variant="outline"
                  class={`text-[10px] font-mono ${
                    isSupported()
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {isSupported() ? 'OPFS Active' : 'IndexedDB Fallback'}
                </Badge>
              </DialogTitle>
              <DialogDescription class="text-xs text-muted-foreground font-mono mt-0.5">
                Directory: <span class="text-foreground font-semibold">{strategy.getDirectoryName()}</span>
                <Show when={tree()}>
                  {(t) => (
                    <span>
                      {' '}• Total: <span class="text-cyan-400">{formatOpfsBytes(t().sizeBytes)}</span>
                    </span>
                  )}
                </Show>
              </DialogDescription>
            </div>
          </div>
          {/* Quota Progress & Action Controls */}
          <div class="flex items-center gap-2">
            <Show when={quota()}>
              {(q) => (
                <div class="hidden md:flex flex-col items-end text-[11px] font-mono mr-2">
                  <div class="text-muted-foreground">
                    Storage Quota: <span class="text-foreground font-semibold">{q().formattedUsage}</span> / {q().formattedQuota}
                  </div>
                  <div class="w-36 h-1.5 bg-muted/60 rounded-full overflow-hidden mt-1 border border-border/40">
                    <div
                      class="h-full bg-accent-theme transition-all duration-500"
                      style={{ width: `${Math.max(1, Math.min(100, q().usagePercent))}%` }}
                    />
                  </div>
                </div>
              )}
            </Show>

            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={isRefreshing()}
              class="h-8 text-xs gap-1.5 border-border/60 hover:bg-muted"
            >
              <RefreshCw class={`w-3.5 h-3.5 ${isRefreshing() ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewFileDialog(true)}
              class="h-8 text-xs gap-1.5 border-border/60 hover:bg-muted text-accent-theme"
            >
              <Plus class="w-3.5 h-3.5" />
              Write Test File
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePurge}
              disabled={isPurging()}
              class="h-8 text-xs gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Trash2 class="w-3.5 h-3.5" />
              Purge Cache
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => props.onOpenChange(false)}
              class="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X class="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Split Explorer Body */}
        <div class="flex-1 flex overflow-hidden">
          {/* Left Tree Explorer (340px) */}
          <div class="w-80 shrink-0 h-full">
            <OpfsTree
              rootNode={tree()}
              selectedPath={selectedNode()?.path || null}
              onSelectNode={loadFileDetails}
              onDeleteNode={(name, isDir) => handleDeleteFile(name, isDir)}
            />
          </div>

          {/* Right Live Preview / Inspector */}
          <div class="flex-1 h-full bg-background/30">
            <OpfsFilePreview
              details={fileDetails()}
              onDeleteFile={(name) => handleDeleteFile(name, false)}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter class="p-3 border-t border-[var(--glass-border)] bg-muted/20 shrink-0 flex items-center justify-between">
          <div class="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
            <span>Disk-backed zero-heap streaming storage</span>
            <span>•</span>
            <span class="text-accent-theme font-medium">Ctrl+Shift+O</span> to toggle
          </div>
          <Button
            variant="accent"
            size="sm"
            onClick={() => props.onOpenChange(false)}
            class="px-5 cursor-pointer text-xs h-8"
          >
            Close
          </Button>
        </DialogFooter>

        {/* New Test File Modal Dialog */}
        <Show when={showNewFileDialog()}>
          <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div class="w-full max-w-lg glass-panel p-6 rounded-2xl border border-[var(--glass-border)] shadow-2xl flex flex-col gap-4">
              <div class="flex items-center justify-between border-b border-border/40 pb-3">
                <div class="flex items-center gap-2 text-foreground font-semibold text-sm">
                  <Plus class="w-4 h-4 text-accent-theme" />
                  Write Test File to OPFS
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewFileDialog(false)}
                  class="text-muted-foreground hover:text-foreground"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>

              <div class="flex flex-col gap-3 font-mono text-xs">
                <div>
                  <label class="text-muted-foreground block text-[10px] mb-1">File Name</label>
                  <input
                    type="text"
                    value={newFileName()}
                    onInput={(e: InputEvent & { currentTarget: HTMLInputElement }) => setNewFileName(e.currentTarget.value)}
                    class="w-full h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 text-foreground"
                  />
                </div>

                <div>
                  <label class="text-muted-foreground block text-[10px] mb-1">Content (UTF-8)</label>
                  <textarea
                    rows={6}
                    value={newFileContent()}
                    onInput={(e: InputEvent & { currentTarget: HTMLTextAreaElement }) => setNewFileContent(e.currentTarget.value)}
                    class="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-foreground leading-relaxed font-mono"
                  />
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewFileDialog(false)}
                  class="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={handleCreateTestFile}
                  class="text-xs h-8"
                >
                  Write to OPFS
                </Button>
              </div>
            </div>
          </div>
        </Show>
      </DialogContent>
    </Dialog>
  );
}
