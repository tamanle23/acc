import React from 'react';
import type { PaletteFieldItem } from './studio-types';
import {
  Type,
  AlignLeft,
  Hash,
  ToggleLeft,
  ListFilter,
  Calendar,
  Code,
  Link2,
  Barcode,
  LocateIcon,
  Signature,
  Layers,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export const PALETTE_ITEMS: PaletteFieldItem[] = [
  // 1. Primitive Elements
  {
    id: 'text',
    uiComponent: 'text',
    defaultDataType: 'STRING',
    label: 'Single-line Text',
    description: 'Headline, names, titles, or SKU codes',
    iconName: 'Type',
    category: 'PRIMITIVE',
  },
  {
    id: 'textarea',
    uiComponent: 'textarea',
    defaultDataType: 'STRING',
    label: 'Rich Textarea',
    description: 'Long-form narrative, notes, or descriptions',
    iconName: 'AlignLeft',
    category: 'PRIMITIVE',
  },
  {
    id: 'number',
    uiComponent: 'number',
    defaultDataType: 'INTEGER',
    label: 'Numeric Value',
    description: 'Count, price, weight, or inventory stock',
    iconName: 'Hash',
    category: 'PRIMITIVE',
  },
  {
    id: 'switch',
    uiComponent: 'switch',
    defaultDataType: 'BOOLEAN',
    label: 'Boolean Toggle',
    description: 'True/False flag or binary status switch',
    iconName: 'ToggleLeft',
    category: 'PRIMITIVE',
  },
  // 2. Complex & Structured
  {
    id: 'select',
    uiComponent: 'select',
    defaultDataType: 'STRING',
    label: 'Single Choice',
    description: 'Strict enumeration dropdown selection',
    iconName: 'ListFilter',
    category: 'COMPLEX',
  },
  {
    id: 'datepicker',
    uiComponent: 'datepicker',
    defaultDataType: 'DATE',
    label: 'Date & Time',
    description: 'Calendar date or timestamp value',
    iconName: 'Calendar',
    category: 'COMPLEX',
  },
  {
    id: 'relation_picker',
    uiComponent: 'relation_picker',
    defaultDataType: 'RELATIONSHIP',
    label: 'Entity Relationship',
    description: 'Foreign entity reference & link picker',
    iconName: 'Link2',
    category: 'COMPLEX',
  },
  {
    id: 'json_editor',
    uiComponent: 'json_editor',
    defaultDataType: 'JSON',
    label: 'Raw JSON Payload',
    description: 'Nested schema documents or custom metadata',
    iconName: 'Code',
    category: 'COMPLEX',
  },
  // 3. Extended Custom Widgets (OCP Extensibility)
  {
    id: 'signature_pad',
    uiComponent: 'signature_pad',
    defaultDataType: 'STRING',
    label: 'Digital Signature',
    description: 'Handwritten sign-off vector stroke canvas',
    iconName: 'Signature',
    category: 'EXTENDED',
  },
  {
    id: 'geo_location',
    uiComponent: 'geo_location',
    defaultDataType: 'STRING',
    label: 'GPS Coordinates',
    description: 'Lat/Long geolocation pin selector',
    iconName: 'LocateIcon',
    category: 'EXTENDED',
  },
  {
    id: 'barcode_scanner',
    uiComponent: 'barcode_scanner',
    defaultDataType: 'STRING',
    label: 'Barcode / QR Reader',
    description: 'Camera optical barcode reader widget',
    iconName: 'Barcode',
    category: 'EXTENDED',
  },
];

const ICON_MAP: Record<string, LucideIcon> = {
  Type,
  AlignLeft,
  Hash,
  ToggleLeft,
  ListFilter,
  Calendar,
  Link2,
  Code,
  Signature,
  LocateIcon,
  Barcode,
};

interface Props {
  onSelectFieldType: (item: PaletteFieldItem) => void;
  disabled?: boolean;
}

export const AttributePalette: React.FC<Props> = ({ onSelectFieldType, disabled = false }) => {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg shadow-black/5">
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Attribute Palette
          </h3>
        </div>
        <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20">
          Click or Drag
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-2">
        {PALETTE_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.iconName] || Sparkles;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectFieldType(item)}
              draggable={!disabled}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/json', JSON.stringify(item));
              }}
              className={cn(
                'group relative flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all duration-200',
                'bg-white/40 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80',
                'border border-white/30 dark:border-white/5 hover:border-sky-500/30 dark:hover:border-sky-500/30',
                'shadow-xs hover:shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-grab active:cursor-grabbing',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:bg-sky-500 group-hover:text-white transition-colors shadow-inner">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {item.label}
                  </span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted/70 text-muted-foreground">
                    {item.defaultDataType}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-1 leading-snug">
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
