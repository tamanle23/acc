import { BaseTimeSpacePlugin } from './BaseTimeSpacePlugin';
import type { NetworkPlexusModifierParams } from '../../types/modifiers';
import type { ModifierParameterSchema } from '../ModifierPluginRegistry';
import {
  THEME_FIELD,
  PRIMARY_COLOR_FIELD,
  ACCENT_COLOR_FIELD,
  SPEED_MULTIPLIER_FIELD,
  SCALE_FIELD,
  STROKE_WIDTH_FIELD,
  DENSITY_FIELD,
  BOUNDARY_FIELD,
} from './common';

export class NetworkPlexusPlugin extends BaseTimeSpacePlugin<NetworkPlexusModifierParams> {
  public readonly type = 'time_space/network_plexus';
  public readonly templateId = 'network_plexus';
  public readonly schema: ModifierParameterSchema = {
    displayName: 'Proximity Network Plexus',
    category: 'motion',
    fields: {
      density: DENSITY_FIELD,
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
