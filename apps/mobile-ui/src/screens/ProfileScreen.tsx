import React from 'react';
import { View, Text, Switch, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePostStore } from '../store/usePostStore';
import { useMobileContextStore } from '../store/useMobileContextStore';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';

export const ProfileScreen = () => {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { theme, setTheme, liquidGlass, toggleLiquidGlass, glassIntensity, setGlassIntensity } = useSettingsStore();
  const clearPosts = usePostStore(state => state.clearPosts);
  const resetPosts = usePostStore(state => state.resetPosts);
  const { activePersonaId, activeTenantId, setActivePersona } = useMobileContextStore();

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 54,
        paddingBottom: insets.bottom + 90,
      }}
    >
      <View style={styles.header}>
        <View style={styles.avatarPlaceholder} />
        <Text style={[styles.username, { color: colors.text }]}>GuestUser</Text>
        <Text style={[styles.bio, { color: colors.text }]}>Exploring Liquid Glass UI</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance & Effects</Text>
      
      <GlassCard style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Theme</Text>
          <View style={styles.themeOptions}>
            {['system', 'light', 'dark'].map((t) => (
              <Text 
                key={t}
                onPress={() => setTheme(t as any)}
                style={[
                  styles.themeText, 
                  { color: theme === t ? colors.primary : '#888' }
                ]}
              >
                {t.toUpperCase()}
              </Text>
            ))}
          </View>
        </View>
        <View style={styles.separator} />
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Liquid Glass Effect</Text>
            <Text style={{ fontSize: 12, color: colors.text, opacity: 0.6 }}>Translucent blur, grain & specular sheen</Text>
          </View>
          <Switch 
            value={liquidGlass} 
            onValueChange={toggleLiquidGlass} 
          />
        </View>
        {liquidGlass && (
          <>
            <View style={styles.separator} />
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Glass Intensity</Text>
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
                  {Math.round(glassIntensity)}%
                </Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={10}
                maximumValue={100}
                step={5}
                value={glassIntensity}
                onValueChange={setGlassIntensity}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={dark ? '#444444' : '#E5E5EA'}
                thumbTintColor={colors.primary}
              />
            </View>
          </>
        )}
      </GlassCard>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Unified Sandbox & Tenancy</Text>
      <GlassCard style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Active Persona</Text>
          <View style={styles.themeOptions}>
            {(['system', 'admin', 'creator', 'user'] as const).map((p) => (
              <Text
                key={p}
                onPress={() => setActivePersona(p)}
                style={[
                  styles.themeText,
                  {
                    color: activePersonaId === p ? (p === 'system' ? '#f59e0b' : colors.primary) : '#888',
                    fontWeight: activePersonaId === p ? 'bold' : 'normal',
                  },
                ]}
              >
                {p === 'system' ? '👑 SYSTEM' : p.toUpperCase()}
              </Text>
            ))}
          </View>
        </View>
        <View style={styles.separator} />
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Active Tenant</Text>
          <Text style={{ fontSize: 13, color: colors.text, opacity: 0.8, fontFamily: 'monospace' }}>
            {activeTenantId}
          </Text>
        </View>
      </GlassCard>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Management</Text>
      <GlassCard style={styles.settingsCard}>
        <View style={{ padding: 16, gap: 12 }}>
          <GlassButton title="Restore Demo Posts" onPress={resetPosts} />
          <GlassButton title="Clear All Posts" onPress={clearPosts} />
        </View>
      </GlassCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 32,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ccc',
    marginBottom: 16,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  settingsCard: {
    padding: 0, // override default padding for rows
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(150,150,150,0.2)',
  },
  settingLabel: {
    fontSize: 16,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  themeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sliderContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
});
