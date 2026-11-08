import { createSignal, createEffect, onCleanup, createMemo, Show, For } from 'solid-js';
import {
  Copy,
  Check,
  FileCode2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
} from 'lucide-solid';
import { Button } from '../../ui/button';
import { formatOpfsBytes } from '@acc/core-web';
import { toast } from '../../ui/sonner';

interface OpfsHexViewerProps {
  blob?: Blob | null;
  fallbackBytes?: Uint8Array | null;
  maxChunkSize?: number;
}

export function OpfsHexViewer(props: OpfsHexViewerProps) {
  const maxChunk = () => props.maxChunkSize || 2048;
  const [offset, setOffset] = createSignal<number>(0);
  const [chunkSize, setChunkSize] = createSignal<number>(maxChunk());
  const [currentBytes, setCurrentBytes] = createSignal<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = createSignal<boolean>(false);
  const [copied, setCopied] = createSignal<boolean>(false);

  const totalSize = createMemo(() => {
    if (props.blob) return props.blob.size;
    if (props.fallbackBytes) return props.fallbackBytes.byteLength;
    return 0;
  });

  // Lazily slice and load only the requested chunk
  createEffect(() => {
    let cancelled = false;
    const blob = props.blob;
    const fallback = props.fallbackBytes;
    const curOffset = offset();
    const curChunk = chunkSize();

    async function loadChunk() {
      if (fallback) {
        const slice = fallback.slice(curOffset, curOffset + curChunk);
        setCurrentBytes(slice);
        return;
      }

      if (!blob) {
        setCurrentBytes(null);
        return;
      }

      setIsLoading(true);
      try {
        const end = Math.min(blob.size, curOffset + curChunk);
        const sliceBlob = blob.slice(curOffset, end);
        const ab = await sliceBlob.arrayBuffer();
        if (!cancelled) {
          setCurrentBytes(new Uint8Array(ab));
        }
      } catch {
        if (!cancelled) {
          setCurrentBytes(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadChunk();

    onCleanup(() => {
      cancelled = true;
    });
  });

  // When blob changes, reset offset to 0
  createEffect(() => {
    // track props.blob
    const _ = props.blob;
    setOffset(0);
  });

  const rows = createMemo(() => {
    const bytes = currentBytes();
    if (!bytes || bytes.length === 0) return [];
    const result: Array<{
      offset: string;
      hexGroup1: string[];
      hexGroup2: string[];
      ascii: string;
    }> = [];

    const len = bytes.length;
    const baseOffset = offset();
    for (let i = 0; i < len; i += 16) {
      const globalOffset = baseOffset + i;
      const offsetHex = globalOffset.toString(16).padStart(8, '0');
      const hexGroup1: string[] = [];
      const hexGroup2: string[] = [];
      let ascii = '';

      for (let j = 0; j < 16; j++) {
        const idx = i + j;
        if (idx < len) {
          const byte = bytes[idx];
          const hex = byte.toString(16).padStart(2, '0');
          if (j < 8) {
            hexGroup1.push(hex);
          } else {
            hexGroup2.push(hex);
          }
          ascii += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '·';
        } else {
          if (j < 8) {
            hexGroup1.push('  ');
          } else {
            hexGroup2.push('  ');
          }
          ascii += ' ';
        }
      }

      result.push({ offset: offsetHex, hexGroup1, hexGroup2, ascii });
    }
    return result;
  });

  const handleCopyHex = () => {
    const bytes = currentBytes();
    if (!bytes) return;
    const hexString = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
    navigator.clipboard.writeText(hexString);
    setCopied(true);
    toast.success('Hex chunk copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNextChunk = () => {
    const nextOffset = offset() + chunkSize();
    if (nextOffset < totalSize()) {
      setOffset(nextOffset);
    }
  };

  const handlePrevChunk = () => {
    const prevOffset = Math.max(0, offset() - chunkSize());
    setOffset(prevOffset);
  };

  const handleJumpStart = () => {
    setOffset(0);
  };

  const handleJumpEnd = () => {
    const total = totalSize();
    if (total <= 0) return;
    const lastOffset = Math.max(0, Math.floor((total - 1) / chunkSize()) * chunkSize());
    setOffset(lastOffset);
  };

  const currentEnd = () => Math.min(totalSize(), offset() + chunkSize());

  return (
    <div class="flex flex-col h-full bg-slate-950/80 rounded-xl border border-slate-800/80 overflow-hidden font-mono text-[11px] select-text">
      {/* Hex Toolbar */}
      <div class="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800 text-slate-400 gap-2 flex-wrap">
        <div class="flex items-center gap-2">
          <FileCode2 class="w-3.5 h-3.5 text-cyan-400" />
          <span class="font-semibold text-slate-300">
            Hex Stream ({offset().toLocaleString()} – {currentEnd().toLocaleString()} of {formatOpfsBytes(totalSize())})
          </span>
          <Show when={isLoading()}>
            <RefreshCw class="w-3 h-3 text-cyan-400 animate-spin" />
          </Show>
        </div>

        {/* Chunk Navigation & Controls */}
        <div class="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleJumpStart}
            disabled={offset() === 0 || isLoading()}
            title="First chunk"
            class="h-6 w-6 p-0 text-slate-400 hover:text-slate-100 disabled:opacity-30"
          >
            <ChevronsLeft class="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevChunk}
            disabled={offset() === 0 || isLoading()}
            title="Previous chunk"
            class="h-6 w-6 p-0 text-slate-400 hover:text-slate-100 disabled:opacity-30"
          >
            <ChevronLeft class="w-3.5 h-3.5" />
          </Button>

          <span class="text-[10px] text-slate-400 px-1">
            {formatOpfsBytes(chunkSize())} / window
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextChunk}
            disabled={currentEnd() >= totalSize() || isLoading()}
            title="Next chunk"
            class="h-6 w-6 p-0 text-slate-400 hover:text-slate-100 disabled:opacity-30"
          >
            <ChevronRight class="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleJumpEnd}
            disabled={currentEnd() >= totalSize() || isLoading()}
            title="Last chunk"
            class="h-6 w-6 p-0 text-slate-400 hover:text-slate-100 disabled:opacity-30"
          >
            <ChevronsRight class="w-3.5 h-3.5" />
          </Button>

          <div class="h-3 w-px bg-slate-800 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyHex}
            disabled={!currentBytes() || currentBytes()!.length === 0}
            class="h-6 text-[10px] px-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 gap-1"
          >
            <Show when={copied()} fallback={<Copy class="w-3 h-3" />}>
              <Check class="w-3 h-3 text-emerald-400" />
            </Show>
            {copied() ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      {/* Hex Stream Container */}
      <div class="flex-1 overflow-auto p-3 leading-5">
        <Show
          when={rows().length > 0}
          fallback={
            <div class="flex items-center justify-center h-full text-muted-foreground text-xs">
              {isLoading() ? 'Streaming bytes from OPFS...' : 'Empty file or no data available.'}
            </div>
          }
        >
          <table class="w-full border-collapse">
            <thead>
              <tr class="text-slate-500 border-b border-slate-800/60 pb-1 text-left select-none">
                <th class="pr-4 font-normal w-20">Offset</th>
                <th class="pr-4 font-normal">00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F</th>
                <th class="pl-4 font-normal">Decoded Text</th>
              </tr>
            </thead>
            <tbody>
              <For items={rows()}>
                {(row) => (
                  <tr class="hover:bg-slate-900/60 transition-colors">
                    <td class="text-cyan-500/80 pr-4 select-none font-bold">{row.offset}</td>
                    <td class="pr-4 text-slate-300 tracking-wider">
                      <span class="text-cyan-300">{row.hexGroup1.join(' ')}</span>
                      <span class="text-slate-600 mx-1.5">|</span>
                      <span class="text-slate-400">{row.hexGroup2.join(' ')}</span>
                    </td>
                    <td class="pl-4 text-emerald-400/90 whitespace-pre border-l border-slate-800/80">
                      {row.ascii}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </div>
    </div>
  );
}
