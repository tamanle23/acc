import React, { useState, useEffect, useMemo } from 'react';
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
  Calendar,
  Layers,
  Sparkles,
  Eye,
  FileQuestion,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/tabs';
import { OpfsHexViewer } from './OpfsHexViewer';
import { formatOpfsBytes } from '@acc/core-web';
import type { OpfsFileDetails, OpfsModalTab } from './types';
import { toast } from 'sonner';

interface OpfsFilePreviewProps {
  details: OpfsFileDetails | null;
  onDeleteFile?: (name: string) => Promise<void>;
}

export function OpfsFilePreview({ details, onDeleteFile }: OpfsFilePreviewProps) {
  const [activeTab, setActiveTab] = useState<OpfsModalTab>('preview');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);

  // Manage Blob Object URL lifecycle
  useEffect(() => {
    if (!details?.blob) {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setObjectUrl(null);
      }
      return;
    }

    const url = URL.createObjectURL(details.blob);
    setObjectUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [details?.blob]);

  const mime = details?.node.mimeType || 'application/octet-stream';
  const name = details?.node.name || '';
  const isImage = mime.startsWith('image/') || /\.(png|jpe?g|webp|svg|gif)$/i.test(name);
  const isAudio = mime.startsWith('audio/') || /\.(wav|mp3|aac|ogg|flac|m4a)$/i.test(name);
  const isVideo = mime.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(name);
  const isJson = mime === 'application/json' || name.endsWith('.json') || name.endsWith('.meta.json');
  const isText = mime.startsWith('text/') || /\.(txt|md|csv|log)$/i.test(name);

  // Format creation / modified date
  const formattedDate = useMemo(() => {
    if (!details?.node.lastModified) return 'Unknown';
    try {
      return new Date(details.node.lastModified).toLocaleString();
    } catch {
      return 'Unknown';
    }
  }, [details?.node.lastModified]);

  const handleDownload = () => {
    if (!details?.blob) return;
    const a = document.createElement('a');
    a.href = objectUrl || URL.createObjectURL(details.blob);
    a.download = details.node.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${details.node.name}`);
  };

  const handleCopyKey = () => {
    const key = details?.node.decodedKey || details?.node.name;
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    toast.success('Cache key copied');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyContent = () => {
    if (!details?.text) return;
    navigator.clipboard.writeText(details.text);
    setCopiedContent(true);
    toast.success('Content copied to clipboard');
    setTimeout(() => setCopiedContent(false), 2000);
  };

  if (!details) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 select-none">
        <div className="w-14 h-14 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-center mb-4 text-muted-foreground shadow-inner">
          <HardDrive className="w-7 h-7 text-accent-theme/60" />
        </div>
        <h3 className="text-base font-semibold text-foreground">No File Selected</h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1">
          Select a cached asset or companion metadata file from the explorer on the left to inspect its live bytes, preview media, or check storage properties.
        </p>
      </div>
    );
  }

  if (details.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-8 h-8 border-2 border-accent-theme/30 border-t-accent-theme rounded-full animate-spin mb-3" />
        <div className="text-xs text-muted-foreground font-mono">Reading OPFS storage stream...</div>
      </div>
    );
  }

  if (details.error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 text-rose-400">
        <FileQuestion className="w-10 h-10 mb-2 opacity-80" />
        <div className="text-sm font-semibold">Failed to read file</div>
        <div className="text-xs text-muted-foreground font-mono mt-1 max-w-md">{details.error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* File Header Card */}
      <div className="p-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-accent-theme/10 border border-accent-theme/20 flex items-center justify-center shrink-0 text-accent-theme mt-0.5">
              {isImage && <ImageIcon className="w-5 h-5" />}
              {isAudio && <FileAudio className="w-5 h-5" />}
              {isVideo && <FileVideo className="w-5 h-5" />}
              {isJson && <FileCode className="w-5 h-5" />}
              {isText && <FileText className="w-5 h-5" />}
              {!isImage && !isAudio && !isVideo && !isJson && !isText && (
                <FileText className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-foreground font-mono truncate" title={details.node.name}>
                  {details.node.name}
                </h3>
                {details.node.isMetadata && (
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                    Metadata (.meta.json)
                  </Badge>
                )}
              </div>

              {details.node.decodedKey && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground font-mono">
                  <span className="text-[11px] text-accent-theme truncate max-w-md" title={details.node.decodedKey}>
                    Key: {details.node.decodedKey}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    title="Copy cache key"
                    className="hover:text-foreground transition-colors cursor-pointer"
                  >
                    {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground font-mono">
                <span>{formatOpfsBytes(details.node.sizeBytes)}</span>
                <span>•</span>
                <span>{details.node.mimeType}</span>
                <span>•</span>
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-8 text-xs gap-1.5 border-border/60 hover:bg-muted"
            >
              <Download className="w-3.5 h-3.5 text-accent-theme" />
              Download
            </Button>
            {onDeleteFile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDeleteFile(details.node.name)}
                className="h-8 text-xs gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* View Tabs */}
        <div className="mt-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OpfsModalTab)}>
            <TabsList className="bg-background/60 border border-border/40 h-8 p-0.5">
              <TabsTrigger value="preview" className="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-accent-theme/15 data-[state=active]:text-accent-theme">
                <Eye className="w-3.5 h-3.5" />
                Live Preview
              </TabsTrigger>
              <TabsTrigger value="metadata" className="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-accent-theme/15 data-[state=active]:text-accent-theme">
                <Info className="w-3.5 h-3.5" />
                Metadata Inspector
              </TabsTrigger>
              <TabsTrigger value="hex" className="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-accent-theme/15 data-[state=active]:text-accent-theme">
                <FileCode className="w-3.5 h-3.5" />
                Hex Dump
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Tab Content Body */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'preview' && (
          <div className="h-full flex flex-col justify-center items-center">
            {/* Image Preview */}
            {isImage && objectUrl && (
              <div className="flex flex-col items-center justify-center max-w-full max-h-full">
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 shadow-xl overflow-hidden max-h-[420px] flex items-center justify-center">
                  <img
                    src={objectUrl}
                    alt={details.node.name}
                    className="max-h-[380px] max-w-full object-contain rounded-lg"
                  />
                </div>
                <div className="text-[11px] text-muted-foreground font-mono mt-2">
                  Image Preview • {details.node.name}
                </div>
              </div>
            )}

            {/* Audio Preview */}
            {isAudio && objectUrl && (
              <div className="w-full max-w-md p-6 rounded-2xl glass-card flex flex-col items-center gap-4 shadow-xl border border-[var(--glass-border)]">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <FileAudio className="w-8 h-8" />
                </div>
                <div className="text-center font-mono">
                  <div className="font-semibold text-sm text-foreground">{details.node.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{formatOpfsBytes(details.node.sizeBytes)} • {details.node.mimeType}</div>
                </div>
                <audio controls src={objectUrl} className="w-full mt-2" />
              </div>
            )}

            {/* Video Preview */}
            {isVideo && objectUrl && (
              <div className="flex flex-col items-center justify-center max-w-full max-h-full">
                <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 shadow-xl overflow-hidden max-h-[420px]">
                  <video
                    controls
                    src={objectUrl}
                    className="max-h-[380px] max-w-full rounded-lg"
                  />
                </div>
                <div className="text-[11px] text-muted-foreground font-mono mt-2">
                  Video Preview • {details.node.name}
                </div>
              </div>
            )}

            {/* JSON / Text Preview */}
            {(isJson || isText) && details.text !== null && (
              <div className="w-full h-full flex flex-col rounded-xl bg-slate-950/80 border border-slate-800/80 overflow-hidden font-mono text-xs">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800 text-slate-400">
                  <span className="font-semibold text-slate-300">
                    {isJson ? 'Formatted JSON Content' : 'Text Content'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyContent}
                    className="h-6 text-[10px] px-2 text-slate-400 hover:text-slate-100 gap-1"
                  >
                    {copiedContent ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    Copy
                  </Button>
                </div>
                <pre className="flex-1 overflow-auto p-4 leading-relaxed text-slate-300 select-text whitespace-pre-wrap">
                  {details.text}
                </pre>
              </div>
            )}

            {/* Binary Fallback */}
            {!isImage && !isAudio && !isVideo && !isJson && !isText && details.hexBytes && (
              <OpfsHexViewer bytes={details.hexBytes} />
            )}
          </div>
        )}

        {/* Metadata Inspector Tab */}
        {activeTab === 'metadata' && (
          <div className="flex flex-col gap-4 font-mono text-xs select-text">
            {/* File Info Card */}
            <div className="p-4 rounded-xl glass-card border border-[var(--glass-border)]">
              <div className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                <Info className="w-4 h-4 text-accent-theme" />
                File System Descriptors
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Handle Name</span>
                  <span className="text-foreground font-semibold break-all">{details.node.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Relative Path</span>
                  <span className="text-foreground break-all">{details.node.path}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Decoded Cache Key</span>
                  <span className="text-cyan-400 font-semibold break-all">
                    {details.node.decodedKey || 'N/A (Direct file)'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">MIME Type</span>
                  <span className="text-foreground">{details.node.mimeType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Exact File Size</span>
                  <span className="text-foreground">
                    {details.node.sizeBytes.toLocaleString()} bytes ({formatOpfsBytes(details.node.sizeBytes)})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Last Modified</span>
                  <span className="text-foreground">{formattedDate}</span>
                </div>
              </div>
            </div>

            {/* Companion Metadata JSON Inspector */}
            <div className="p-4 rounded-xl glass-card border border-[var(--glass-border)]">
              <div className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent-theme" />
                Companion Cache Metadata ({details.node.name}.meta.json)
              </div>
              {details.companionMeta ? (
                <pre className="p-3 bg-slate-950/80 rounded-lg text-emerald-300 overflow-auto border border-slate-800 max-h-60 text-[11px] leading-relaxed">
                  {JSON.stringify(details.companionMeta, null, 2)}
                </pre>
              ) : (
                <div className="text-muted-foreground text-xs italic py-2">
                  No companion .meta.json file found for this entry.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hex Dump Tab */}
        {activeTab === 'hex' && (
          <div className="h-full">
            {details.hexBytes ? (
              <OpfsHexViewer bytes={details.hexBytes} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                No binary stream available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
