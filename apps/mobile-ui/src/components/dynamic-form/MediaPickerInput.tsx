import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { LiquidGlassView } from '../LiquidGlassView';
import { colors } from '../../theme/colors';

export interface MediaPickerInputProps {
  label?: string;
  value?: string;
  onChange: (uri: string) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}

/**
 * MediaPickerInput with Liquid Glass styling.
 * Supports image preview, upload simulation to acc-ms-fs, and removal.
 */
export const MediaPickerInput: React.FC<MediaPickerInputProps> = ({
  label = 'Media Asset',
  value,
  onChange,
  disabled = false,
  required = false,
  error,
}) => {
  const { dark } = useTheme();
  const themeColors = dark ? colors.dark : colors.light;
  const [isUploading, setIsUploading] = useState(false);

  const handlePickImage = async () => {
    if (disabled || isUploading) return;
    setIsUploading(true);

    try {
      // Simulate client-side compression & streaming upload to acc-ms-fs
      await new Promise((resolve) => setTimeout(resolve, 300));
      const simulatedObjectId = `obj_${Date.now()}`;
      const contentUri = `https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80#${simulatedObjectId}`;
      onChange(contentUri);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    if (disabled) return;
    onChange('');
  };

  return (
    <View style={styles.container}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: themeColors.text }]}>
            {label}
            {required && <Text style={styles.requiredAsterisk}> *</Text>}
          </Text>
        </View>
      ) : null}

      <LiquidGlassView
        intensity={dark ? 40 : 70}
        tint={dark ? 'dark' : 'light'}
        fallbackColor={themeColors.solidCardFallback}
        borderRadius={16}
        style={[
          styles.glassCard,
          {
            borderColor: error
              ? '#EF4444'
              : dark
              ? themeColors.glassBorder
              : 'rgba(255, 255, 255, 0.4)',
          },
        ]}
      >
        {value ? (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: value }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            {!disabled && (
              <TouchableOpacity
                onPress={handleRemoveImage}
                style={styles.removeBadge}
                accessibilityLabel="Remove image"
                accessibilityRole="button"
              >
                <Text style={styles.removeBadgeText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            onPress={handlePickImage}
            disabled={disabled || isUploading}
            style={styles.placeholderButton}
            accessibilityLabel="Pick or take photo"
            accessibilityRole="button"
          >
            {isUploading ? (
              <ActivityIndicator color={themeColors.tint} size="small" />
            ) : (
              <>
                <Text style={[styles.cameraIcon, { color: themeColors.tint }]}>📷</Text>
                <Text style={[styles.placeholderText, { color: themeColors.textMuted }]}>
                  Tap to upload or take a photo
                </Text>
                <Text style={[styles.subHint, { color: themeColors.textMuted }]}>
                  JPG, PNG, WebP up to 10MB
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </LiquidGlassView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  labelRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  requiredAsterisk: {
    color: '#EF4444',
  },
  glassCard: {
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderButton: {
    width: '100%',
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  subHint: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7,
  },
  previewContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  removeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBadgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});
