/**
 * TimeSpacePalette:
 * Theme and aesthetic color definitions for the isomorphic Time-Space motion graphic engine.
 */

export interface TimeSpacePalette {
  primary: string;    // Main foreground lines, active target reticle, key geometry
  secondary: string;  // Supporting dials, background ticks, leader lines, inactive grid
  accent: string;     // Critical targets, alert indicators, head phosphor glow
  surface: string;    // Translucent background fills, acrylic backing card, dialog plates
  glow: string;       // Radial glow, shadowBlur color, bloom falloff
}

export type TimeSpaceThemeName =
  | 'cyberpunk'
  | 'solar_flare'
  | 'emerald_matrix'
  | 'monochrome_titanium'
  | 'synthwave_neon'
  | 'tactical_amber'
  | 'custom';

export const TIME_SPACE_PALETTES: Record<Exclude<TimeSpaceThemeName, 'custom'>, TimeSpacePalette> = {
  cyberpunk: {
    primary: '#00f0ff',
    secondary: '#0088cc',
    accent: '#ff0055',
    surface: 'rgba(10, 15, 28, 0.85)',
    glow: 'rgba(0, 240, 255, 0.6)',
  },
  solar_flare: {
    primary: '#ffaa00',
    secondary: '#ff6600',
    accent: '#ff0033',
    surface: 'rgba(25, 15, 8, 0.85)',
    glow: 'rgba(255, 170, 0, 0.6)',
  },
  emerald_matrix: {
    primary: '#00ff88',
    secondary: '#009944',
    accent: '#ffffff',
    surface: 'rgba(5, 20, 10, 0.85)',
    glow: 'rgba(0, 255, 136, 0.6)',
  },
  monochrome_titanium: {
    primary: '#ffffff',
    secondary: '#888888',
    accent: '#00e5ff',
    surface: 'rgba(15, 15, 15, 0.85)',
    glow: 'rgba(255, 255, 255, 0.4)',
  },
  synthwave_neon: {
    primary: '#ff71ce',
    secondary: '#01cdfe',
    accent: '#05ffa1',
    surface: 'rgba(20, 8, 30, 0.85)',
    glow: 'rgba(255, 113, 206, 0.6)',
  },
  tactical_amber: {
    primary: '#ffb300',
    secondary: '#ff8f00',
    accent: '#d50000',
    surface: 'rgba(20, 16, 5, 0.85)',
    glow: 'rgba(255, 179, 0, 0.6)',
  },
};

/**
 * Resolves effective palette from theme name and optional custom color overrides.
 */
export function resolveTimeSpacePalette(params: {
  theme?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  surfaceColor?: string;
  glowColor?: string;
} = {}): TimeSpacePalette {
  const themeName = (params.theme as Exclude<TimeSpaceThemeName, 'custom'>) || 'cyberpunk';
  const basePalette = TIME_SPACE_PALETTES[themeName] || TIME_SPACE_PALETTES.cyberpunk;

  return {
    primary: params.primaryColor || basePalette.primary,
    secondary: params.secondaryColor || basePalette.secondary,
    accent: params.accentColor || basePalette.accent,
    surface: params.surfaceColor || basePalette.surface,
    glow: params.glowColor || basePalette.glow,
  };
}

/**
 * Formats a time in seconds to standard SMPTE timecode (HH:MM:SS:FF).
 */
export function formatSMPTETimecode(timeSec: number, fps: number = 30): string {
  const totalFrames = Math.max(0, Math.floor(timeSec * fps));
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

/**
 * Replaces live telemetry macros in template strings.
 * Supports: {{timecode}}, {{frame}}, {{fps}}, {{heading}}, {{pitch}}, {{azimuth}}
 */
export function interpolateTelemetryTokens(
  templateText: string,
  context: { frame: number; fps: number; timeSec: number }
): string {
  if (!templateText || !templateText.includes('{{')) return templateText;

  const tc = formatSMPTETimecode(context.timeSec, context.fps);
  const heading = (Math.floor(context.frame * 2.3) % 360).toString().padStart(3, '0');
  const pitch = (Math.sin(context.frame * 0.05) * 45).toFixed(1);
  const azimuth = ((context.frame * 1.5) % 360).toFixed(0).padStart(3, '0');

  return templateText
    .replace(/\{\{timecode\}\}/g, tc)
    .replace(/\{\{frame\}\}/g, String(context.frame))
    .replace(/\{\{fps\}\}/g, String(context.fps))
    .replace(/\{\{heading\}\}/g, heading)
    .replace(/\{\{pitch\}\}/g, pitch)
    .replace(/\{\{azimuth\}\}/g, azimuth);
}
