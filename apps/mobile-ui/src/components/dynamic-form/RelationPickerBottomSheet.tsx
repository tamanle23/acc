import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { LiquidGlassView } from '../LiquidGlassView';
import { colors } from '../../theme/colors';

export interface RelationRecordItem {
  id: string | number;
  label: string;
  sublabel?: string;
}

export interface RelationPickerBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (recordId: string | number) => void;
  selectedId?: string | number | null;
  targetEntityType?: string;
  records?: RelationRecordItem[];
}

export const RelationPickerBottomSheet: React.FC<RelationPickerBottomSheetProps> = ({
  visible,
  onClose,
  onSelect,
  selectedId,
  targetEntityType = 'Entity Record',
  records = [],
}) => {
  const { dark } = useTheme();
  const themeColors = dark ? colors.dark : colors.light;
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = records.filter((r) =>
    r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(r.id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheetContainer}>
          <LiquidGlassView
            intensity={dark ? 80 : 95}
            tint={dark ? 'dark' : 'light'}
            fallbackColor={themeColors.solidCardFallback}
            borderRadius={24}
            style={[
              styles.sheetContent,
              {
                borderColor: themeColors.glassBorder,
                backgroundColor: themeColors.glassBackground,
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.dragHandle} />
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: themeColors.text }]}>
                  Select {targetEntityType}
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={[styles.closeText, { color: themeColors.textMuted }]}>Done</Text>
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    color: themeColors.text,
                    borderColor: themeColors.solidBorder,
                    backgroundColor: dark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)',
                  },
                ]}
                placeholder="Search records..."
                placeholderTextColor={themeColors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
              />
            </View>

            {/* Records List */}
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const isSelected = String(item.id) === String(selectedId);
                return (
                  <TouchableOpacity
                    onPress={() => {
                      onSelect(item.id);
                      onClose();
                    }}
                    style={[
                      styles.recordItem,
                      isSelected && {
                        backgroundColor: dark
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(0,0,0,0.06)',
                      },
                    ]}
                  >
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemLabel, { color: themeColors.text }]}>
                        {item.label}
                      </Text>
                      {item.sublabel ? (
                        <Text style={[styles.itemSublabel, { color: themeColors.textMuted }]}>
                          {item.sublabel}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected && (
                      <Text style={[styles.checkIcon, { color: themeColors.tint }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
                    No records found
                  </Text>
                </View>
              }
            />
          </LiquidGlassView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    maxHeight: '80%',
  },
  sheetContent: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    height: '100%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150, 150, 150, 0.4)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  list: {
    paddingVertical: 4,
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 2,
  },
  itemInfo: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  itemSublabel: {
    fontSize: 12,
    marginTop: 2,
  },
  checkIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
