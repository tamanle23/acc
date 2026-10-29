import type { ParamFieldDescriptor } from '../ModifierPluginRegistry';

export const THEME_FIELD: ParamFieldDescriptor = {
  key: 'theme',
  label: 'Aesthetic Theme',
  type: 'select',
  defaultValue: 'cyberpunk',
  options: [
    { label: 'Cyberpunk Neon', value: 'cyberpunk' },
    { label: 'Solar Flare Warmth', value: 'solar_flare' },
    { label: 'Emerald Matrix', value: 'emerald_matrix' },
    { label: 'Monochrome Titanium', value: 'monochrome_titanium' },
    { label: 'Synthwave Neon', value: 'synthwave_neon' },
    { label: 'Tactical Amber', value: 'tactical_amber' },
  ],
};

export const BOUNDARY_FIELD: ParamFieldDescriptor = {
  key: 'boundary',
  label: 'Temporal Boundary Mode',
  type: 'select',
  defaultValue: 'loop',
  options: [
    { label: 'Loop Continuously', value: 'loop' },
    { label: 'Ping-Pong Oscillate', value: 'pingpong' },
    { label: 'Clamp Terminal Frame', value: 'clamp' },
    { label: 'Play Once', value: 'once' },
  ],
};

export const PRIMARY_COLOR_FIELD: ParamFieldDescriptor = {
  key: 'primaryColor',
  label: 'Primary Accent Color',
  type: 'string',
  defaultValue: '',
};

export const ACCENT_COLOR_FIELD: ParamFieldDescriptor = {
  key: 'accentColor',
  label: 'Secondary / Highlight Color',
  type: 'string',
  defaultValue: '',
};

export const SPEED_MULTIPLIER_FIELD: ParamFieldDescriptor = {
  key: 'speedMultiplier',
  label: 'Motion Speed Multiplier',
  type: 'number',
  min: 0.1,
  max: 5.0,
  step: 0.1,
  defaultValue: 1.0,
};

export const SCALE_FIELD: ParamFieldDescriptor = {
  key: 'scale',
  label: 'Geometric Scale',
  type: 'number',
  min: 0.2,
  max: 3.0,
  step: 0.1,
  defaultValue: 1.0,
};

export const STROKE_WIDTH_FIELD: ParamFieldDescriptor = {
  key: 'strokeWidth',
  label: 'Vector Stroke Width',
  type: 'number',
  min: 0.5,
  max: 8.0,
  step: 0.5,
  defaultValue: 1.5,
};

export const DENSITY_FIELD: ParamFieldDescriptor = {
  key: 'density',
  label: 'Lattice / Particle Density',
  type: 'number',
  min: 8,
  max: 128,
  step: 4,
  defaultValue: 32,
};

export const TARGET_X_FIELD: ParamFieldDescriptor = {
  key: 'targetX',
  label: 'Target X Position',
  type: 'number',
  min: -1.0,
  max: 1.0,
  step: 0.05,
  defaultValue: 0.0,
};

export const TARGET_Y_FIELD: ParamFieldDescriptor = {
  key: 'targetY',
  label: 'Target Y Position',
  type: 'number',
  min: -1.0,
  max: 1.0,
  step: 0.05,
  defaultValue: 0.0,
};
