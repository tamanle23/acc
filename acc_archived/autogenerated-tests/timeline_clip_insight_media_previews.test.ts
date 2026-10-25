import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Task 319: ClipInsightCard Rich Media Previews (Video, Audio, Image)', () => {
  const cardPath = join(process.cwd(), 'apps/studio/src/components/timeline/ClipInsightCard.tsx');
  const hudPath = join(process.cwd(), 'apps/studio/src/components/timeline/ClipHoverHUD.tsx');
  const code = readFileSync(cardPath, 'utf-8');
  const hudCode = readFileSync(hudPath, 'utf-8');

  it('ClipInsightCard.tsx should exist and export ClipInsightCard and TimelineClipInsightCard', () => {
    expect(code).toContain('export const ClipInsightCard');
    expect(code).toContain('export const TimelineClipInsightCard');
  });

  it('should support interactive video playback preview with controls and external link', () => {
    expect(code).toContain('<video');
    expect(code).toContain('isVideoPlaying');
    expect(code).toContain('toggleVideoPlayback');
    expect(code).toContain('VIDEO PREVIEW');
    expect(code).toContain('ExternalLink');
  });

  it('should support interactive audio playback with play/pause and mute controls', () => {
    expect(code).toContain('<audio');
    expect(code).toContain('isAudioPlaying');
    expect(code).toContain('toggleAudioPlayback');
    expect(code).toContain('isAudioMuted');
    expect(code).toContain('Volume2');
    expect(code).toContain('VolumeX');
  });

  it('should display image thumbnail with enlarge modal and external link', () => {
    expect(code).toContain('<img');
    expect(code).toContain('IMAGE THUMBNAIL');
    expect(code).toContain('imageModalOpen');
    expect(code).toContain('Maximize2');
    expect(code).toContain('Dialog');
    expect(code).toContain('ExternalLink');
  });

  it('ClipHoverHUD.tsx should allow pointer-events and interactive hover card content', () => {
    expect(hudCode).toContain('pointer-events-auto');
  });
});
