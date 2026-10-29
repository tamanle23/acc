import { BaseTimeSpacePlugin } from './BaseTimeSpacePlugin';
import type { CyberLowerThirdModifierParams } from '../../types/modifiers';
import type { ModifierParameterSchema } from '../ModifierPluginRegistry';
import {
  THEME_FIELD,
  PRIMARY_COLOR_FIELD,
  ACCENT_COLOR_FIELD,
  SPEED_MULTIPLIER_FIELD,
  SCALE_FIELD,
  STROKE_WIDTH_FIELD,
  BOUNDARY_FIELD,
  TARGET_X_FIELD,
  TARGET_Y_FIELD,
} from './common';

export class CyberLowerThirdPlugin extends BaseTimeSpacePlugin<CyberLowerThirdModifierParams> {
  public readonly type = 'time_space/cyber_lower_third';
  public readonly templateId = 'cyber_lower_third';
  public readonly schema: ModifierParameterSchema = {
    displayName: 'Cyber Tech Lower-Third',
    category: 'motion',
    fields: {
      text: {
        key: 'text',
        label: 'Headline / Name',
        type: 'string',
        defaultValue: 'COMMANDER SARAH CONNER',
      },
      subtitle: {
        key: 'subtitle',
        label: 'Role / Subtitle',
        type: 'string',
        defaultValue: 'SPECIAL OPERATIONS // DIVISION 9',
      },
      targetX: TARGET_X_FIELD,
      targetY: TARGET_Y_FIELD,
      theme: THEME_FIELD,
      primaryColor: PRIMARY_COLOR_FIELD,
      accentColor: ACCENT_COLOR_FIELD,
      speedMultiplier: SPEED_MULTIPLIER_FIELD,
      scale: SCALE_FIELD,
      strokeWidth: STROKE_WIDTH_FIELD,
      boundary: BOUNDARY_FIELD,
    },
  };
}
