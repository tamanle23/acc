/**
 * Track and Sequence Type Compatibility Rules
 * Enforces strict domain rules preventing invalid media assignments
 * (e.g., video/image cannot drop into audio or timed_text tracks).
 */

export const SequenceMediaType = {
  Video: 'video',
  Image: 'image',
  Audio: 'audio',
  Text: 'text',
  TimedText: 'timed_text',
} as const;

export type SequenceMediaType = (typeof SequenceMediaType)[keyof typeof SequenceMediaType];

export const TrackMediaType = {
  Video: 'video',
  Audio: 'audio',
  Overlay: 'overlay',
  TimedText: 'timed_text',
} as const;

export type TrackMediaType = (typeof TrackMediaType)[keyof typeof TrackMediaType];

/**
 * Validates whether a sequence of given type can be placed on a track of target type.
 */
export function isTrackCompatibleWithSequence(trackType: string, sequenceType: string): boolean {
  const normSeq = sequenceType.toLowerCase();
  const normTrack = trackType.toLowerCase();

  // Audio sequences strictly belong to audio tracks
  if (normSeq === 'audio') {
    return normTrack === 'audio';
  }

  // Audio tracks strictly reject any non-audio sequences
  if (normTrack === 'audio') {
    return normSeq === 'audio';
  }

  // Video and image sequences belong to video or overlay tracks
  if (normSeq === 'video' || normSeq === 'image') {
    return normTrack === 'video' || normTrack === 'overlay';
  }

  // Text and timed_text sequences belong to timed_text, text, or overlay tracks
  if (normSeq === 'text' || normSeq === 'timed_text') {
    return normTrack === 'timed_text' || normTrack === 'overlay' || normTrack === 'text';
  }

  // Generic fallback: overlay tracks accept any visual media
  if (normTrack === 'overlay') {
    return normSeq !== 'audio';
  }

  return true;
}
