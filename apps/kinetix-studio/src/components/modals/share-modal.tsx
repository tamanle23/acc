// ============================================================================
// KINETIX STUDIO v5.0 - ZERO-BACKEND SHARE & MOBILE PREVIEW QR MODAL
// Generates compressed URL hash links (<900 bytes) and SVG QR code previews.
// ============================================================================

import { createSignal, createEffect, type Component } from 'solid-js';
import { useStudio } from '@/context/studio-context';
import { generateShareableUrl, generateSvgQrCode } from '@/lib/url-state';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, QrCode, Smartphone, ExternalLink } from 'lucide-solid';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: Component<ShareModalProps> = (props) => {
  const studio = useStudio();
  const [shareUrl, setShareUrl] = createSignal<string>('');
  const [qrSvg, setQrSvg] = createSignal<string>('');
  const [copied, setCopied] = createSignal<boolean>(false);
  const [urlBytes, setUrlBytes] = createSignal<number>(0);

  createEffect(async () => {
    if (!props.isOpen) return;
    const url = await generateShareableUrl(studio.state);
    setShareUrl(url);
    setUrlBytes(new TextEncoder().encode(url).length);
    setQrSvg(generateSvgQrCode(url, 180));
    setCopied(false);
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      studio.triggerToast('1-Click Shareable Poster Link Copied to Clipboard!');
      setTimeout(() => setCopied(false), 2400);
    } catch {
      studio.triggerToast('Could not access clipboard');
    }
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="Share & Mobile Live Preview"
      maxWidthClass="max-w-md"
    >
      <div class="space-y-4 text-xs font-sans text-foreground">
        {/* URL TELEMETRY BADGE ROW */}
        <div class="flex items-center justify-between p-2.5 rounded bg-muted/40 border border-border">
          <div class="flex items-center gap-2">
            <Badge variant="lime">ZERO-BACKEND LINK</Badge>
            <span class="text-xs font-mono text-muted-foreground">
              {urlBytes()} bytes (<span class="text-primary font-bold">Safe for Discord/Twitter</span>)
            </span>
          </div>
          <span class="text-xs font-mono text-muted-foreground flex items-center gap-1">
            <Smartphone class="w-3 h-3 text-primary" />
            9:16 Full Screen
          </span>
        </div>

        {/* COPY LINK INPUT ROW */}
        <div class="space-y-1">
          <span class="text-xs font-mono text-muted-foreground uppercase font-bold">
            Compressed Declarative State URL
          </span>
          <div class="flex items-center gap-1.5">
            <input
              type="text"
              readonly
              value={shareUrl()}
              class="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground select-all focus:outline-none focus:border-primary truncate"
            />
            <Button size="sm" variant={copied() ? 'primary' : 'outline'} onClick={handleCopy}>
              {copied() ? <Check class="w-3.5 h-3.5 mr-1 text-primary-foreground" /> : <Copy class="w-3.5 h-3.5 mr-1" />}
              {copied() ? 'Copied!' : 'Copy Link'}
            </Button>
          </div>
        </div>

        {/* QR CODE MOBILE SCANNING SECTION */}
        <div class="p-3 bg-card border border-border rounded-lg flex items-center gap-4">
          <div
            class="w-[120px] h-[120px] rounded overflow-hidden flex items-center justify-center shrink-0 border border-border"
            innerHTML={qrSvg()}
          />

          <div class="space-y-1.5">
            <div class="flex items-center gap-1.5">
              <QrCode class="w-4 h-4 text-primary" />
              <span class="font-bold text-xs">Scan for Instant Mobile Preview</span>
            </div>
            <p class="text-xs text-muted-foreground leading-relaxed">
              Scan this QR code with your iOS or Android camera on your local network to preview this 9:16 motion poster at real device scale with zero install.
            </p>
            <div class="pt-1">
              <a
                href={shareUrl()}
                target="_blank"
                rel="noreferrer"
                class="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono font-medium"
              >
                Open in New Tab <ExternalLink class="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
