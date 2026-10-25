import { liquidGlassTokens } from '@acc/tokens';

export const colors = {
  light: liquidGlassTokens.light.native,
  dark: liquidGlassTokens.dark.native,
  amber: liquidGlassTokens.amber,
};

export type ThemeColors = typeof colors.light;
