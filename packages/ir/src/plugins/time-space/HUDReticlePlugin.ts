import { BaseTimeSpacePlugin } from './BaseTimeSpacePlugin';
import type { HUDReticleModifierParams } from '../../types/modifiers';
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

export class HUDReticlePlugin extends BaseTimeSpacePlugin<HUDReticleModifierParams> {
  public readonly type = 'time_space/hud_reticle';
  public readonly templateId = 'hud_tactical_reticle';
  public readonly schema: ModifierParameterSchema = {
    displayName: 'HUD Tactical Reticle',
    category: 'motion',
    fields: {
      text: {
        key: 'text',
        label: 'Reticle Header',
        type: 'string',
        defaultValue: 'LOCK // 00:44',
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
