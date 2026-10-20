import React, { useState } from 'react';
import { Braces, Copy, Check, Search, Maximize2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { VisualJsonEditor } from './visual-json-editor';

export interface JsonCellPopoverProps {
  value: unknown;
  attributeName?: string;
  readOnly?: boolean;
}

export const JsonCellPopover: React.FC<JsonCellPopoverProps> = ({
  value,
  attributeName = 'JSON Document',
  readOnly = true,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground/60 text-xs">-</span>;
  }

  const isObject = typeof value === 'object' && value !== null;
  const isArray = Array.isArray(value);

  const keyCount = isArray
    ? (value as unknown[]).length
    : isObject
    ? Object.keys(value as Record<string, unknown>).length
    : 1;

  const summaryLabel = isArray
    ? `[ ${keyCount} items ]`
    : isObject
    ? `{ ${keyCount} keys }`
    : String(value);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('JSON copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="group/badge inline-flex items-center gap-1.5 py-0.5 px-2 rounded-md font-mono text-[11px] font-medium bg-muted/40 hover:bg-primary/10 border border-white/20 dark:border-white/10 hover:border-primary/30 text-foreground transition-all cursor-pointer"
          title="Click to visually inspect JSON"
        >
          <Braces className="size-3 text-primary shrink-0 opacity-80 group-hover/badge:opacity-100" />
          <span className="truncate max-w-[130px]">{summaryLabel}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[460px] p-3 rounded-2xl border border-white/20 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl space-y-2.5 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex items-center gap-2">
            <Braces className="size-4 text-primary" />
            <span className="font-semibold text-xs text-foreground truncate">
              {attributeName}
            </span>
            <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5">
              {isArray ? 'array' : typeof value}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="size-6 text-muted-foreground hover:text-foreground"
              title="Copy JSON"
            >
              {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            </Button>
          </div>
        </div>

        {/* Search inside JSON keys */}
        {isObject && (
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search keys..."
              className="h-8 pl-8 text-xs font-mono bg-muted/30 border-border/50"
            />
          </div>
        )}

        {/* Embedded Visual Editor */}
        <VisualJsonEditor
          value={value}
          onChange={() => {}}
          readOnly={readOnly}
          defaultMode="tree"
          height="280px"
          className="border-border/40 shadow-xs"
        />
      </PopoverContent>
    </Popover>
  );
};
