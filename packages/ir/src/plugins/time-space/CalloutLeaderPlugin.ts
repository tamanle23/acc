import { BaseTimeSpacePlugin } from './BaseTimeSpacePlugin';
import type { CalloutLeaderModifierParams } from '../../types/modifiers';
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

export class CalloutLeaderPlugin extends BaseTimeSpacePlugin<CalloutLeaderModifierParams> {
  public readonly type = 'time_space/callout_leader';
  public readonly templateId = 'callout_leader';
  public readonly schema: ModifierParameterSchema = {
    displayName: 'Tracking Callout Leader',
    category: 'motion',
    fields: {
      text: {
        key: 'text',
        label: 'Callout Text',
        type: 'string',
        defaultValue: 'TARGET ACQUIRED',
      },
      targetX: TARGET_X_FIELD,
      targetY: TARGET_Y_FIELD,
      labelX: {
        key: 'labelX',
        label: 'Label X Offset',
        type: 'number',
        min: -1.0,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.35,
      },
      labelY: {
        key: 'labelY',
        label: 'Label Y Offset',
        type: 'number',
        min: -1.0,
        max: 1.0,
        step: 0.05,
        defaultValue: -0.25,
      },
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
