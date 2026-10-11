import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { LiquidGlassView } from '../LiquidGlassView';
import { OutboxMutationJob } from '../../store/useOutboxStore';
import { colors } from '../../theme/colors';

export interface ConflictResolutionModalProps {
  visible: boolean;
  conflictJob: OutboxMutationJob | null;
  onResolve: (resolution: 'KEEP_LOCAL' | 'ACCEPT_SERVER' | 'CUSTOM_MERGE') => void;
  onDismiss: () => void;
}

/**
 * Three-Way Conflict Resolution Modal with Liquid Glass aesthetics.
 * Compares local uncommitted changes with server state.
 */
export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  visible,
  conflictJob,
  onResolve,
  onDismiss,
}) => {
  const { dark } = useTheme();
  const themeColors = dark ? colors.dark : colors.light;

  if (!conflictJob) return null;

  const localPayload = conflictJob.payload || {};
  const serverState = conflictJob.serverState || {};

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.container}>
          <LiquidGlassView
            intensity={dark ? 80 : 95}
            tint={dark ? 'dark' : 'light'}
            fallbackColor={themeColors.solidCardFallback}
            borderRadius={24}
            style={[
              styles.card,
              {
                borderColor: '#EF4444',
                backgroundColor: themeColors.glassBackground,
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.alertIcon}>⚠️</Text>
              <Text style={[styles.title, { color: themeColors.text }]}>
                Sync Conflict Detected
              </Text>
              <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
                Another user or session updated this record while you were offline.
              </Text>
            </View>

            {/* Comparison Grid */}
            <ScrollView style={styles.scrollArea}>
              <View style={styles.diffContainer}>
                {/* Local State */}
                <View
                  style={[
                    styles.diffColumn,
                    {
                      borderColor: themeColors.glassBorder,
                      backgroundColor: dark
                        ? 'rgba(59, 130, 246, 0.08)'
                        : 'rgba(59, 130, 246, 0.04)',
                    },
                  ]}
                >
                  <Text style={[styles.columnTitle, { color: '#3B82F6' }]}>
                    Your Changes (Local)
                  </Text>
                  <Text style={[styles.jsonText, { color: themeColors.text }]}>
                    {JSON.stringify(localPayload, null, 2)}
                  </Text>
                </View>

                {/* Server State */}
                <View
                  style={[
                    styles.diffColumn,
                    {
                      borderColor: themeColors.glassBorder,
                      backgroundColor: dark
                        ? 'rgba(239, 68, 68, 0.08)'
                        : 'rgba(239, 68, 68, 0.04)',
                    },
                  ]}
                >
                  <Text style={[styles.columnTitle, { color: '#EF4444' }]}>
                    Remote Server State
                  </Text>
                  <Text style={[styles.jsonText, { color: themeColors.text }]}>
                    {JSON.stringify(serverState, null, 2)}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() => onResolve('KEEP_LOCAL')}
                style={[styles.btn, styles.btnLocal, { backgroundColor: '#3B82F6' }]}
              >
                <Text style={styles.btnTextLight}>Keep My Changes (Overwrite)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onResolve('ACCEPT_SERVER')}
                style={[
                  styles.btn,
                  styles.btnServer,
                  {
                    borderColor: themeColors.solidBorder,
                    backgroundColor: dark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                  },
                ]}
              >
                <Text style={[styles.btnTextDark, { color: themeColors.text }]}>
                  Discard Mine (Accept Server)
                </Text>
              </TouchableOpacity>
            </View>
          </LiquidGlassView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 500,
  },
  card: {
    borderWidth: 1.5,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  alertIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
  },
  scrollArea: {
    maxHeight: 280,
    marginVertical: 10,
  },
  diffContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  diffColumn: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  columnTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  jsonText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  actions: {
    marginTop: 16,
    gap: 10,
  },
  btn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLocal: {
    elevation: 2,
  },
  btnServer: {
    borderWidth: 1,
  },
  btnTextLight: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  btnTextDark: {
    fontSize: 14,
    fontWeight: '600',
  },
});
