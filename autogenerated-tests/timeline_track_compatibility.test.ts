import { describe, it, expect } from 'bun:test';
import {
  isTrackCompatibleWithSequence,
  SequenceMediaType,
  TrackMediaType,
} from '../apps/studio/src/lib/timeline/trackCompatibility';

describe('Timeline Track & Sequence Compatibility Rules', () => {
  describe('Audio Sequence Boundaries', () => {
    it('allows audio sequence on audio track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.Audio, SequenceMediaType.Audio)).toBe(true);
    });

    it('rejects audio sequence on video track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.Video, SequenceMediaType.Audio)).toBe(false);
    });

    it('rejects audio sequence on overlay track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.Overlay, SequenceMediaType.Audio)).toBe(false);
    });

    it('rejects audio sequence on timed_text track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.TimedText, SequenceMediaType.Audio)).toBe(false);
    });
  });

  describe('Video & Image Sequence Boundaries', () => {
    it('allows video sequence on video track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.Video, SequenceMediaType.Video)).toBe(true);
    });

    it('allows video sequence on overlay track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.Overlay, SequenceMediaType.Video)).toBe(true);
    });

    it('rejects video sequence on audio track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.Audio, SequenceMediaType.Video)).toBe(false);
    });

    it('rejects video sequence on timed_text track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.TimedText, SequenceMediaType.Video)).toBe(false);
    });

    it('allows image sequence on video track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.Video, SequenceMediaType.Image)).toBe(true);
    });

    it('allows image sequence on overlay track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.Overlay, SequenceMediaType.Image)).toBe(true);
    });

    it('rejects image sequence on audio track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.Audio, SequenceMediaType.Image)).toBe(false);
    });

    it('rejects image sequence on timed_text track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.TimedText, SequenceMediaType.Image)).toBe(false);
    });
  });

  describe('Text and TimedText Sequence Boundaries', () => {
    it('allows text sequence on timed_text track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.TimedText, SequenceMediaType.Text)).toBe(true);
      expect(isTrackCompatibleWithSequence(TrackMediaType.TimedText, SequenceMediaType.TimedText)).toBe(true);
    });

    it('allows text sequence on overlay track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.Overlay, SequenceMediaType.Text)).toBe(true);
    });

    it('rejects text sequence on audio track', () => {
      expect(isTrackCompatibleWithSequence(TrackMediaType.Audio, SequenceMediaType.Text)).toBe(false);
      expect(isTrackCompatibleWithSequence(TrackMediaType.Audio, SequenceMediaType.TimedText)).toBe(false);
    });
  });
});
