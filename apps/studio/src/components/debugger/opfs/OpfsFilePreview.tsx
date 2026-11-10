import { createSignal, createEffect, onCleanup, createMemo, Show } from 'solid-js';
import {
  Download,
  Trash2,
  Copy,
  Check,
  FileText,
  FileCode,
  FileAudio,
  FileVideo,
  Image as ImageIcon,
  HardDrive,
  Info,
  Layers,
  Eye,
  FileQuestion,
} from 'lucide-solid';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';
import { OpfsHexViewer } from './OpfsHexViewer';
import { formatOpfsBytes } from '@acc/core-web';
import type { OpfsFileDetails, OpfsModalTab } from './types';
import { toast } from '../../ui/sonner';

interface OpfsFilePreviewProps {
  details: OpfsFileDetails | null;
  onDeleteFile?: (name: string) => Promise<void>;
}

export function OpfsFilePreview(props: OpfsFilePreviewProps) {
  const [activeTab, setActiveTab] = createSignal<OpfsModalTab>('preview');
  const [objectUrl, setObjectUrl] = createSignal<string | null>(null);
  const [copiedKey, setCopiedKey] = createSignal(false);
  const [copiedContent, setCopiedContent] = createSignal(false);

  // Manage Blob Object URL lifecycle
  createEffect(() => {
    const blob = props.details?.blob;
    if (!blob) {
      const prev = objectUrl();
      if (prev) {
        URL.revokeObjectURL(prev);
        setObjectUrl(null);
      }
      return;
    }

    const url = URL.createObjectURL(blob);
    setObjectUrl(url);

    onCleanup(() => {
      URL.revokeObjectURL(url);
    });
  });

  const mime = () => props.details?.node.mimeType || 'application/octet-stream';
  const name = () => props.details?.node.name || '';
  const isImage = () => mime().startsWith('image/') || /\.(png|jpe?g|webp|svg|gif)$/i.test(name());
  const isAudio = () => mime().startsWith('audio/') || /\.(wav|mp3|aac|ogg|flac|m4a)$/i.test(name());
  const isVideo = () => mime().startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(name());
  const isJson = () => mime() === 'application/json' || name().endsWith('.json') || name().endsWith('.meta.json');
  const isText = () => mime().startsWith('text/') || /\.(txt|md|csv|log)$/i.test(name());

  // Format creation / modified date
  const formattedDate = createMemo(() => {
    const lm = props.details?.node.lastModified;
    if (!lm) return 'Unknown';
    try {
      return new Date(lm).toLocaleString();
    } catch {
      return 'Unknown';
    }
  });

  const handleDownload = () => {
    const d = props.details;
    if (!d?.blob) return;
    const a = document.createElement('a');
    a.href = objectUrl() || URL.createObjectURL(d.blob);
    a.download = d.node.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${d.node.name}`);
  };

  const handleCopyKey = () => {
    const d = props.details;
    const key = d?.node.decodedKey || d?.node.name;
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    toast.success('Cache key copied');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyContent = () => {
    const text = props.details?.text;
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedContent(true);
    toast.success('Content copied to clipboard');
    setTimeout(() => setCopiedContent(false), 2000);
  };

  return (
    <Show
      when={props.details}
      fallback={
        <div class="flex flex-col items-center justify-center h-full text-center p-8 select-none">
          <div class="w-14 h-14 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-center mb-4 text-muted-foreground shadow-inner">
            <HardDrive class="w-7 h-7 text-accent-theme/60" />
          </div>
          <h3 class="text-base font-semibold text-foreground">No File Selected</h3>
          <p class="text-xs text-muted-foreground max-w-sm mt-1">
            Select a cached asset or companion metadata file from the explorer on the left to inspect its live bytes, preview media, or check storage properties.
          </p>
        </div>
      }
    >
      {(details) => (
        <Show
          when={!details().isLoading}
          fallback={
            <div class="flex flex-col items-center justify-center h-full text-center p-8">
              <div class="w-8 h-8 border-2 border-accent-theme/30 border-t-accent-theme rounded-full animate-spin mb-3" />
              <div class="text-xs text-muted-foreground font-mono">Reading OPFS storage stream...</div>
            </div>
          }
        >
          <Show
            when={!details().error}
            fallback={
              <div class="flex flex-col items-center justify-center h-full text-center p-8 text-rose-400">
                <FileQuestion class="w-10 h-10 mb-2 opacity-80" />
                <div class="text-sm font-semibold">Failed to read file</div>
                <div class="text-xs text-muted-foreground font-mono mt-1 max-w-md">{details().error}</div>
              </div>
            }
          >
            <div class="flex flex-col h-full overflow-hidden">
              {/* File Header Card */}
              <div class="p-4 border-b border-border/50 bg-muted/20">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-start gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-xl bg-accent-theme/10 border border-accent-theme/20 flex items-center justify-center shrink-0 text-accent-theme mt-0.5">
                      <Show when={isImage()}><ImageIcon class="w-5 h-5" /></Show>
                      <Show when={isAudio()}><FileAudio class="w-5 h-5" /></Show>
                      <Show when={isVideo()}><FileVideo class="w-5 h-5" /></Show>
                      <Show when={isJson()}><FileCode class="w-5 h-5" /></Show>
                      <Show when={isText()}><FileText class="w-5 h-5" /></Show>
                      <Show when={!isImage() && !isAudio() && !isVideo() && !isJson() && !isText()}>
                        <FileText class="w-5 h-5" />
                      </Show>
                    </div>

                    <div class="min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="text-sm font-bold text-foreground font-mono truncate" title={details().node.name}>
                          {details().node.name}
                        </h3>
                        <Show when={details().node.isMetadata}>
                          <Badge variant="outline" class="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                            Metadata (.meta.json)
                          </Badge>
                        </Show>
                      </div>

                      <Show when={details().node.decodedKey}>
                        <div class="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground font-mono">
                          <span class="text-[11px] text-accent-theme truncate max-w-md" title={details().node.decodedKey}>
                            Key: {details().node.decodedKey}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyKey}
                            title="Copy cache key"
                            class="hover:text-foreground transition-colors cursor-pointer"
                          >
                            <Show when={copiedKey()} fallback={<Copy class="w-3 h-3" />}>
                              <Check class="w-3 h-3 text-emerald-400" />
                            </Show>
                          </button>
                        </div>
                      </Show>

                      <div class="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground font-mono">
                        <span>{formatOpfsBytes(details().node.sizeBytes)}</span>
                        <span>•</span>
                        <span>{details().node.mimeType}</span>
                        <span>•</span>
                        <span>{formattedDate()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div class="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                      class="h-8 text-xs gap-1.5 border-border/60 hover:bg-muted"
                    >
                      <Download class="w-3.5 h-3.5 text-accent-theme" />
                      Download
                    </Button>
                    <Show when={props.onDeleteFile}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => props.onDeleteFile?.(details().node.name)}
                        class="h-8 text-xs gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                        Delete
                      </Button>
                    </Show>
                  </div>
                </div>

                {/* View Tabs */}
                <div class="mt-3">
                  <Tabs value={activeTab()} onChange={(v) => setActiveTab(v as OpfsModalTab)}>
                    <TabsList class="bg-background/60 border border-border/40 h-8 p-0.5">
                      <TabsTrigger value="preview" class="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-accent-theme/15 data-[state=active]:text-accent-theme">
                        <Eye class="w-3.5 h-3.5" />
                        Live Preview
                      </TabsTrigger>
                      <TabsTrigger value="metadata" class="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-accent-theme/15 data-[state=active]:text-accent-theme">
                        <Info class="w-3.5 h-3.5" />
                        Metadata Inspector
                      </TabsTrigger>
                      <TabsTrigger value="hex" class="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-accent-theme/15 data-[state=active]:text-accent-theme">
                        <FileCode class="w-3.5 h-3.5" />
                        Hex Dump
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              {/* Main Tab Content Body */}
              <div class="flex-1 overflow-auto p-4">
                <Show when={activeTab() === 'preview'}>
                  <div class="h-full flex flex-col justify-center items-center">
                    {/* Image Preview */}
                    <Show when={isImage() && objectUrl()}>
                      <div class="flex flex-col items-center justify-center max-w-full max-h-full">
                        <div class="p-2 rounded-xl bg-slate-950/60 border border-slate-800 shadow-xl overflow-hidden max-h-[420px] flex items-center justify-center">
                          <img
                            src={objectUrl()!}
                            alt={details().node.name}
                            class="max-h-[380px] max-w-full object-contain rounded-lg"
                          />
                        </div>
                        <div class="text-[11px] text-muted-foreground font-mono mt-2">
                          Image Preview • {details().node.name}
                        </div>
                      </div>
                    </Show>

                    {/* Audio Preview */}
                    <Show when={isAudio() && objectUrl()}>
                      <div class="w-full max-w-md p-6 rounded-2xl glass-card flex flex-col items-center gap-4 shadow-xl border border-[var(--glass-border)]">
                        <div class="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                          <FileAudio class="w-8 h-8" />
                        </div>
                        <div class="text-center font-mono">
                          <div class="font-semibold text-sm text-foreground">{details().node.name}</div>
                          <div class="text-xs text-muted-foreground mt-0.5">
                            {formatOpfsBytes(details().node.sizeBytes)} • {details().node.mimeType}
                          </div>
                        </div>
                        <audio controls src={objectUrl()!} class="w-full mt-2" />
                      </div>
                    </Show>

                    {/* Video Preview */}
                    <Show when={isVideo() && objectUrl()}>
                      <div class="flex flex-col items-center justify-center max-w-full max-h-full">
                        <div class="p-2 rounded-xl bg-slate-950/80 border border-slate-800 shadow-xl overflow-hidden max-h-[420px]">
                          <video
                            controls
                            src={objectUrl()!}
                            class="max-h-[380px] max-w-full rounded-lg"
                          />
                        </div>
                        <div class="text-[11px] text-muted-foreground font-mono mt-2">
                          Video Preview • {details().node.name}
                        </div>
                      </div>
                    </Show>

                    {/* JSON / Text Preview */}
                    <Show when={(isJson() || isText()) && details().text !== null}>
                      <div class="w-full h-full flex flex-col rounded-xl bg-slate-950/80 border border-slate-800/80 overflow-hidden font-mono text-xs">
                        <div class="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800 text-slate-400">
                          <span class="font-semibold text-slate-300">
                            {isJson() ? 'Formatted JSON Content' : 'Text Content'}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopyContent}
                            class="h-6 text-[10px] px-2 text-slate-400 hover:text-slate-100 gap-1"
                          >
                            <Show when={copiedContent()} fallback={<Copy class="w-3 h-3" />}>
                              <Check class="w-3 h-3 text-emerald-400" />
                            </Show>
                            Copy
                          </Button>
                        </div>
                        <pre class="flex-1 overflow-auto p-4 leading-relaxed text-slate-300 select-text whitespace-pre-wrap">
                          {details().text}
                        </pre>
                      </div>
                    </Show>

                    {/* Binary Fallback */}
                    <Show when={!isImage() && !isAudio() && !isVideo() && !isJson() && !isText() && details().blob}>
                      <OpfsHexViewer blob={details().blob} />
                    </Show>
                  </div>
                </Show>

                {/* Metadata Inspector Tab */}
                <Show when={activeTab() === 'metadata'}>
                  <div class="flex flex-col gap-4 font-mono text-xs select-text">
                    {/* File Info Card */}
                    <div class="p-4 rounded-xl glass-card border border-[var(--glass-border)]">
                      <div class="text-xs font-bold text-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                        <Info class="w-4 h-4 text-accent-theme" />
                        File System Descriptors
                      </div>
                      <div class="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                        <div>
                          <span class="text-muted-foreground block text-[10px]">Handle Name</span>
                          <span class="text-foreground font-semibold break-all">{details().node.name}</span>
                        </div>
                        <div>
                          <span class="text-muted-foreground block text-[10px]">Relative Path</span>
                          <span class="text-foreground break-all">{details().node.path}</span>
                        </div>
                        <div>
                          <span class="text-muted-foreground block text-[10px]">Decoded Cache Key</span>
                          <span class="text-cyan-400 font-semibold break-all">
                            {details().node.decodedKey || 'N/A (Direct file)'}
                          </span>
                        </div>
                        <div>
                          <span class="text-muted-foreground block text-[10px]">MIME Type</span>
                          <span class="text-foreground">{details().node.mimeType}</span>
                        </div>
                        <div>
                          <span class="text-muted-foreground block text-[10px]">Exact File Size</span>
                          <span class="text-foreground">
                            {details().node.sizeBytes.toLocaleString()} bytes ({formatOpfsBytes(details().node.sizeBytes)})
                          </span>
                        </div>
                        <div>
                          <span class="text-muted-foreground block text-[10px]">Last Modified</span>
                          <span class="text-foreground">{formattedDate()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Companion Metadata JSON Inspector */}
                    <div class="p-4 rounded-xl glass-card border border-[var(--glass-border)]">
                      <div class="text-xs font-bold text-foreground mb-2 uppercase tracking-wider flex items-center gap-2">
                        <Layers class="w-4 h-4 text-accent-theme" />
                        Companion Cache Metadata ({details().node.name}.meta.json)
                      </div>
                      <Show
                        when={details().companionMeta}
                        fallback={
                          <div class="text-muted-foreground text-xs italic py-2">
                            No companion .meta.json file found for this entry.
                          </div>
                        }
                      >
                        <pre class="p-3 bg-slate-950/80 rounded-lg text-emerald-300 overflow-auto border border-slate-800 max-h-60 text-[11px] leading-relaxed">
                          {JSON.stringify(details().companionMeta, null, 2)}
                        </pre>
                      </Show>
                    </div>
                  </div>
                </Show>

                {/* Hex Dump Tab */}
                <Show when={activeTab() === 'hex'}>
                  <div class="h-full">
                    <Show
                      when={details().blob}
                      fallback={
                        <div class="flex items-center justify-center h-full text-muted-foreground text-xs">
                          No binary stream available
                        </div>
                      }
                    >
                      <OpfsHexViewer blob={details().blob} />
                    </Show>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </Show>
      )}
    </Show>
  );
}
