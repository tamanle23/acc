import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Check, FileCode2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/button';
import { formatOpfsBytes } from '@acc/core-web';
import { toast } from 'sonner';

interface OpfsHexViewerProps {
  blob?: Blob | null;
  fallbackBytes?: Uint8Array | null;
  maxChunkSize?: number;
}

export function OpfsHexViewer({
  blob,
  fallbackBytes,
  maxChunkSize = 2048,
}: OpfsHexViewerProps) {
  const [offset, setOffset] = useState<number>(0);
  const [chunkSize, setChunkSize] = useState<number>(maxChunkSize);
  const [currentBytes, setCurrentBytes] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const totalSize = blob ? blob.size : fallbackBytes ? fallbackBytes.byteLength : 0;

  // Lazily slice and load only the requested chunk
  useEffect(() => {
    let cancelled = false;

    async function loadChunk() {
      if (fallbackBytes) {
        const slice = fallbackBytes.slice(offset, offset + chunkSize);
        setCurrentBytes(slice);
        return;
      }

      if (!blob) {
        setCurrentBytes(null);
        return;
      }

      setIsLoading(true);
      try {
        const end = Math.min(blob.size, offset + chunkSize);
        const sliceBlob = blob.slice(offset, end);
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

    return () => {
      cancelled = true;
    };
  }, [blob, fallbackBytes, offset, chunkSize]);

  // When blob changes, reset offset to 0
  useEffect(() => {
    setOffset(0);
  }, [blob]);

  const rows = useMemo(() => {
    if (!currentBytes || currentBytes.length === 0) return [];
    const result: Array<{
      offset: string;
      hexGroup1: string[];
      hexGroup2: string[];
      ascii: string;
    }> = [];

    const len = currentBytes.length;
    for (let i = 0; i < len; i += 16) {
      const globalOffset = offset + i;
      const offsetHex = globalOffset.toString(16).padStart(8, '0');
      const hexGroup1: string[] = [];
      const hexGroup2: string[] = [];
      let ascii = '';

      for (let j = 0; j < 16; j++) {
        const idx = i + j;
        if (idx < len) {
          const byte = currentBytes[idx];
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
  }, [currentBytes, offset]);

  const handleCopyHex = () => {
    if (!currentBytes) return;
    const hexString = Array.from(currentBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
    navigator.clipboard.writeText(hexString);
    setCopied(true);
    toast.success('Hex chunk copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNextChunk = () => {
    const nextOffset = offset + chunkSize;
    if (nextOffset < totalSize) {
      setOffset(nextOffset);
    }
  };

  const handlePrevChunk = () => {
    const prevOffset = Math.max(0, offset - chunkSize);
    setOffset(prevOffset);
  };

  const handleJumpStart = () => {
    setOffset(0);
  };

  const handleJumpEnd = () => {
    if (totalSize <= 0) return;
    const lastOffset = Math.max(0, Math.floor((totalSize - 1) / chunkSize) * chunkSize);
    setOffset(lastOffset);
  };

  const currentEnd = Math.min(totalSize, offset + chunkSize);

  return (
    <div className="flex flex-col h-full bg-slate-950/80 rounded-xl border border-slate-800/80 overflow-hidden font-mono text-[11px] select-text">
      {/* Hex Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800 text-slate-400 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold text-slate-300">
            Hex Stream ({offset.toLocaleString()} – {currentEnd.toLocaleString()} of {formatOpfsBytes(totalSize)})
          </span>
          {isLoading && <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />}
        </div>

        {/* Chunk Navigation & Controls */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleJumpStart}
            disabled={offset === 0 || isLoading}
            title="First chunk"
            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-100 disabled:opacity-30"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevChunk}
            disabled={offset === 0 || isLoading}
            title="Previous chunk"
            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-100 disabled:opacity-30"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>

          <span className="text-[10px] text-slate-400 px-1">
            {formatOpfsBytes(chunkSize)} / window
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextChunk}
            disabled={currentEnd >= totalSize || isLoading}
            title="Next chunk"
            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-100 disabled:opacity-30"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleJumpEnd}
            disabled={currentEnd >= totalSize || isLoading}
            title="Last chunk"
            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-100 disabled:opacity-30"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </Button>

          <div className="h-3 w-px bg-slate-800 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyHex}
            disabled={!currentBytes || currentBytes.length === 0}
            className="h-6 text-[10px] px-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 gap-1"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      {/* Hex Stream Container */}
      <div className="flex-1 overflow-auto p-3 leading-5">
        {rows.length > 0 ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800/60 pb-1 text-left select-none">
                <th className="pr-4 font-normal w-20">Offset</th>
                <th className="pr-4 font-normal">00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F</th>
                <th className="pl-4 font-normal">Decoded Text</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.offset} className="hover:bg-slate-900/60 transition-colors">
                  <td className="text-cyan-500/80 pr-4 select-none font-bold">{row.offset}</td>
                  <td className="pr-4 text-slate-300 tracking-wider">
                    <span className="text-cyan-300">{row.hexGroup1.join(' ')}</span>
                    <span className="text-slate-600 mx-1.5">|</span>
                    <span className="text-slate-400">{row.hexGroup2.join(' ')}</span>
                  </td>
                  <td className="pl-4 text-emerald-400/90 whitespace-pre border-l border-slate-800/80">
                    {row.ascii}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            {isLoading ? 'Streaming bytes from OPFS...' : 'Empty file or no data available.'}
          </div>
        )}
      </div>
    </div>
  );
}
