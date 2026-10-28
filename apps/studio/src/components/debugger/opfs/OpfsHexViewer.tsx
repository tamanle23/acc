import React, { useState, useMemo } from 'react';
import { Copy, Check, FileCode2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { toast } from 'sonner';

interface OpfsHexViewerProps {
  bytes: Uint8Array;
  maxBytes?: number;
}

export function OpfsHexViewer({ bytes, maxBytes = 2048 }: OpfsHexViewerProps) {
  const [limit, setLimit] = useState(maxBytes);
  const [copied, setCopied] = useState(false);

  const displayedBytes = useMemo(() => {
    return bytes.slice(0, limit);
  }, [bytes, limit]);

  const rows = useMemo(() => {
    const result: Array<{
      offset: string;
      hexGroup1: string[];
      hexGroup2: string[];
      ascii: string;
    }> = [];

    const len = displayedBytes.length;
    for (let i = 0; i < len; i += 16) {
      const offset = i.toString(16).padStart(8, '0');
      const hexGroup1: string[] = [];
      const hexGroup2: string[] = [];
      let ascii = '';

      for (let j = 0; j < 16; j++) {
        const idx = i + j;
        if (idx < len) {
          const byte = displayedBytes[idx];
          const hex = byte.toString(16).padStart(2, '0');
          if (j < 8) {
            hexGroup1.push(hex);
          } else {
            hexGroup2.push(hex);
          }
          // ASCII character (printable 32-126)
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

      result.push({ offset, hexGroup1, hexGroup2, ascii });
    }
    return result;
  }, [displayedBytes]);

  const handleCopyHex = () => {
    const hexString = Array.from(displayedBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
    navigator.clipboard.writeText(hexString);
    setCopied(true);
    toast.success('Hex data copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/80 rounded-xl border border-slate-800/80 overflow-hidden font-mono text-[11px] select-text">
      {/* Hex Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800 text-slate-400">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold text-slate-300">
            Hex Dump ({displayedBytes.length} / {bytes.length} bytes)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {bytes.length > limit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLimit((prev) => prev + 4096)}
              className="h-6 text-[10px] px-2 border-slate-700 hover:bg-slate-800 text-slate-300"
            >
              Load +4KB
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyHex}
            className="h-6 text-[10px] px-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 gap-1"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy Hex'}
          </Button>
        </div>
      </div>

      {/* Hex Stream Container */}
      <div className="flex-1 overflow-auto p-3 leading-5">
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

        {bytes.length > limit && (
          <div className="mt-3 text-center text-slate-500 text-[10px] italic">
            Showing first {limit} bytes. Click "Load +4KB" above to view more.
          </div>
        )}
      </div>
    </div>
  );
}
