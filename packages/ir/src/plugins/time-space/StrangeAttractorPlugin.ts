import { BaseTimeSpacePlugin } from './BaseTimeSpacePlugin';
import type { StrangeAttractorModifierParams } from '../../types/modifiers';
import type { ModifierParameterSchema } from '../ModifierPluginRegistry';
import {
  THEME_FIELD,
  PRIMARY_COLOR_FIELD,
  ACCENT_COLOR_FIELD,
  SPEED_MULTIPLIER_FIELD,
  SCALE_FIELD,
  DENSITY_FIELD,
  BOUNDARY_FIELD,
  TARGET_X_FIELD,
  TARGET_Y_FIELD,
} from './common';

export class StrangeAttractorPlugin extends BaseTimeSpacePlugin<StrangeAttractorModifierParams> {
  public readonly type = 'time_space/strange_attractor';
  public readonly templateId = 'strange_attractor';
  public readonly schema: ModifierParameterSchema = {
    displayName: 'Chaotic Strange Attractor',
    category: 'motion',
    fields: {
      targetX: TARGET_X_FIELD,
      targetY: TARGET_Y_FIELD,
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
