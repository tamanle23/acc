import { BaseTimeSpacePlugin } from './BaseTimeSpacePlugin';
import type { GlitchDataStreamModifierParams } from '../../types/modifiers';
import type { ModifierParameterSchema } from '../ModifierPluginRegistry';
import {
  THEME_FIELD,
  PRIMARY_COLOR_FIELD,
  ACCENT_COLOR_FIELD,
  SPEED_MULTIPLIER_FIELD,
  SCALE_FIELD,
  DENSITY_FIELD,
  BOUNDARY_FIELD,
} from './common';

export class GlitchDataStreamPlugin extends BaseTimeSpacePlugin<GlitchDataStreamModifierParams> {
  public readonly type = 'time_space/glitch_data_stream';
  public readonly templateId = 'glitch_data_stream';
  public readonly schema: ModifierParameterSchema = {
    displayName: 'Glitch Data Stream Matrix',
    category: 'motion',
    fields: {
      density: DENSITY_FIELD,
      theme: THEME_FIELD,
      primaryColor: PRIMARY_COLOR_FIELD,
      accentColor: ACCENT_COLOR_FIELD,
      speedMultiplier: SPEED_MULTIPLIER_FIELD,
      scale: SCALE_FIELD,
      boundary: BOUNDARY_FIELD,
    },
  };
}
