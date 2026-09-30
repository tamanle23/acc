import type { CaptionConfig, CaptionSettings, ResolvedSceneConfig } from '../types';
import { getResolvedCaptionStyle, getHighlightAssTag } from '../styles';

function formatAssTimestamp(seconds: number): string {
  const pad = (num: number, size = 2) => String(num).padStart(size, '0');
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centis = Math.floor((seconds % 1) * 100);
  return `${hours}:${pad(minutes)}:${pad(secs)}.${pad(centis, 2)}`;
}

function groupCaptionsIntoPhrases(captions: CaptionConfig[], wordsPerPhrase: number): CaptionConfig[][] {
  if (wordsPerPhrase <= 1) return captions.map(c => [c]);

  const phrases: CaptionConfig[][] = [];
  let currentPhrase: CaptionConfig[] = [];

  for (let i = 0; i < captions.length; i++) {
    const word = captions[i];
    currentPhrase.push(word);

    // End phrase conditions:
    const isPunctuation = /[.!?]$/.test(word.text.trim());
    const nextWord = captions[i + 1];
    const isLongPause = nextWord && (nextWord.start - word.end) > 0.5;

    if (currentPhrase.length >= wordsPerPhrase || isPunctuation || isLongPause) {
      phrases.push(currentPhrase);
      currentPhrase = [];
    }
  }

  if (currentPhrase.length > 0) {
    phrases.push(currentPhrase);
  }

  return phrases;
}

export function generateAssContent(
  captions: CaptionConfig[],
  captionSettings: CaptionSettings | undefined,
  width: number,
  height: number
): string {
  const style = getResolvedCaptionStyle(captionSettings);
  const wordsPerPhrase = captionSettings?.wordsPerPhrase || 1;
  const highlightTag = getHighlightAssTag(captionSettings?.highlightPreset, captionSettings?.highlightColor);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontName},${style.fontSize},${style.primaryColor},&H000000FF,${style.outlineColor},${style.shadowColor},-1,0,0,0,100,100,0,0,${style.borderStyle},${style.outlineSize},${style.shadowSize},${style.alignment},${style.marginL},${style.marginR},${style.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let dialogues: string[] = [];

  if (wordsPerPhrase <= 1 || !highlightTag) {
    // Basic Rendering (One-by-one or without highlighting)
    dialogues = captions.map((caption) => {
      const start = formatAssTimestamp(caption.start);
      const end = formatAssTimestamp(caption.end);
      const cleanText = caption.text.replace(/\r?\n/g, '\\N').trim();
      const text = highlightTag ? `${highlightTag}${cleanText}{\\r}` : cleanText;
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    });
  } else {
    // Phrase-level Karaoke Rendering
    const phrases = groupCaptionsIntoPhrases(captions, wordsPerPhrase);

    for (const phrase of phrases) {
      const phraseStart = phrase[0].start;
      const phraseEnd = phrase[phrase.length - 1].end;

      for (let i = 0; i < phrase.length; i++) {
        // Time window for this specific word to be highlighted
        const lineStart = i === 0 ? phraseStart : phrase[i].start;
        // Keep the word highlighted until the next word starts, or until phrase ends
        const lineEnd = (i === phrase.length - 1) ? phraseEnd : phrase[i + 1].start;

        const startAss = formatAssTimestamp(lineStart);
        const endAss = formatAssTimestamp(lineEnd);

        // Build the full phrase text, applying the tag to the active word only
        const textParts = phrase.map((w, index) => {
          const cleanText = w.text.replace(/\r?\n/g, '\\N').trim();
          if (index === i) {
            return `${highlightTag}${cleanText}{\\r}`;
          }
          return cleanText;
        });

        const fullLineText = textParts.join(' ');
        dialogues.push(`Dialogue: 0,${startAss},${endAss},Default,,0,0,0,,${fullLineText}`);
      }
    }
  }

  return header + dialogues.join('\n') + '\n';
}

export function getSceneDuration(scene: ResolvedSceneConfig, audioDuration?: number): number {
  if (audioDuration && audioDuration > 0) {
    return audioDuration;
  }

  if (scene.captions.length > 0) {
    const lastCaption = scene.captions[scene.captions.length - 1];
    return Math.max(lastCaption.end + 0.5, 2);
  }

  return 3;
}
