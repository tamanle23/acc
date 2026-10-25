import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { AttributeDefinition } from '@acc/client';
import { LiquidGlassView } from '../LiquidGlassView';
import { MediaPickerInput } from './MediaPickerInput';
import {
  RelationPickerBottomSheet,
  RelationRecordItem,
} from './RelationPickerBottomSheet';
import { colors } from '../../theme/colors';
import { MobileWidgetRegistry } from './MobileWidgetRegistry';

export interface DynamicFieldRendererProps {
  attribute: AttributeDefinition;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
  relationRecords?: RelationRecordItem[];
}

/**
 * Renders an interactive input for a dynamic attribute schema definition
 * adhering to Liquid Glass design guidelines.
 */
export const DynamicFieldRenderer: React.FC<DynamicFieldRendererProps> = ({
  attribute,
  value,
  onChange,
  error,
  disabled = false,
  relationRecords = [],
}) => {
  const {
    name,
    systemName,
    dataType,
    uiComponent,
    isRequired,
    options = {},
  } = attribute;

  // 0. OCP Invariant: Pluggable Mobile Widget Check (checked before local hooks)
  const CustomMobileWidget = MobileWidgetRegistry.get(uiComponent);
  if (CustomMobileWidget) {
    return (
      <CustomMobileWidget
        attribute={attribute}
        value={value}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );
  }

  const { dark } = useTheme();
  const themeColors = dark ? colors.dark : colors.light;
  const [isRelationModalOpen, setIsRelationModalOpen] = useState(false);

  const placeholder = options?.placeholder as string || `Enter ${name}...`;

  // 1. Boolean / Switch
  if (dataType === 'BOOLEAN' || uiComponent === 'switch') {
    return (
      <View style={styles.fieldContainer}>
        <LiquidGlassView
          intensity={dark ? 30 : 60}
          tint={dark ? 'dark' : 'light'}
          fallbackColor={themeColors.solidCardFallback}
          borderRadius={14}
          style={[
            styles.switchCard,
            { borderColor: themeColors.glassBorder },
          ]}
        >
          <View style={styles.switchInfo}>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>
              {name}
              {isRequired && <Text style={styles.requiredAsterisk}> *</Text>}
            </Text>
            <Text style={[styles.fieldSystemName, { color: themeColors.textMuted }]}>
              {systemName}
            </Text>
          </View>
          <Switch
            value={Boolean(value)}
            onValueChange={onChange}
            disabled={disabled}
            trackColor={{ false: '#767577', true: themeColors.tint }}
            thumbColor="#f4f3f4"
          />
        </LiquidGlassView>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  // 2. Media Picker
  if (uiComponent === 'relation_picker' && options?.mediaType === 'image') {
    return (
      <MediaPickerInput
        label={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={isRequired}
        error={error}
      />
    );
  }

  // 3. Relation Picker
  if (dataType === 'RELATIONSHIP' || uiComponent === 'relation_picker') {
    const selectedRecord = relationRecords.find(
      (r) => String(r.id) === String(value)
    );

    return (
      <View style={styles.fieldContainer}>
        <Text style={[styles.fieldLabel, { color: themeColors.text }]}>
          {name}
          {isRequired && <Text style={styles.requiredAsterisk}> *</Text>}
        </Text>

        <TouchableOpacity
          onPress={() => !disabled && setIsRelationModalOpen(true)}
          disabled={disabled}
          style={styles.touchableWrapper}
        >
          <LiquidGlassView
            intensity={dark ? 30 : 60}
            tint={dark ? 'dark' : 'light'}
            fallbackColor={themeColors.solidCardFallback}
            borderRadius={14}
            style={[
              styles.inputCard,
              {
                borderColor: error ? '#EF4444' : themeColors.glassBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.relationValueText,
                {
                  color: selectedRecord
                    ? themeColors.text
                    : themeColors.textMuted,
                },
              ]}
            >
              {selectedRecord ? selectedRecord.label : placeholder}
            </Text>
            <Text style={[styles.chevronText, { color: themeColors.textMuted }]}>▼</Text>
          </LiquidGlassView>
        </TouchableOpacity>

        <RelationPickerBottomSheet
          visible={isRelationModalOpen}
          onClose={() => setIsRelationModalOpen(false)}
          onSelect={onChange}
          selectedId={value}
          targetEntityType={name}
          records={relationRecords}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  // 4. Select / Enum Dropdown options
  const choices = options?.choices as string[] | undefined;
  if (choices && Array.isArray(choices) && choices.length > 0) {
    return (
      <View style={styles.fieldContainer}>
        <Text style={[styles.fieldLabel, { color: themeColors.text }]}>
          {name}
          {isRequired && <Text style={styles.requiredAsterisk}> *</Text>}
        </Text>

        <View style={styles.choicesRow}>
          {choices.map((choice) => {
            const isSelected = value === choice;
            return (
              <TouchableOpacity
                key={choice}
                onPress={() => onChange(choice)}
                disabled={disabled}
                style={[
                  styles.choiceChip,
                  {
                    backgroundColor: isSelected
                      ? themeColors.tint
                      : dark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.04)',
                    borderColor: isSelected ? themeColors.tint : themeColors.solidBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    { color: isSelected ? '#FFF' : themeColors.text },
                  ]}
                >
                  {choice}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  // 5. Textarea / Multiline Text
  const isTextArea = uiComponent === 'textarea';

  // 6. Number / Decimal
  const isNumber = dataType === 'INTEGER' || dataType === 'DECIMAL' || uiComponent === 'number';

  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.fieldLabel, { color: themeColors.text }]}>
        {name}
        {isRequired && <Text style={styles.requiredAsterisk}> *</Text>}
      </Text>

      <LiquidGlassView
        intensity={dark ? 30 : 60}
        tint={dark ? 'dark' : 'light'}
        fallbackColor={themeColors.solidCardFallback}
        borderRadius={14}
        style={[
          styles.inputCard,
          isTextArea && styles.textAreaCard,
          {
            borderColor: error ? '#EF4444' : themeColors.glassBorder,
          },
        ]}
      >
        <TextInput
          style={[
            styles.textInput,
            isTextArea && styles.textAreaInput,
            { color: themeColors.text },
          ]}
          value={value !== undefined && value !== null ? String(value) : ''}
          onChangeText={(text) => {
            if (isNumber) {
              const num = dataType === 'INTEGER' ? parseInt(text, 10) : parseFloat(text);
              onChange(isNaN(num) ? text : num);
            } else {
              onChange(text);
            }
          }}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textMuted}
          editable={!disabled}
          multiline={isTextArea}
          numberOfLines={isTextArea ? 4 : 1}
          keyboardType={isNumber ? 'numeric' : 'default'}
        />
      </LiquidGlassView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fieldContainer: {
    marginVertical: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  fieldSystemName: {
    fontSize: 11,
    marginTop: 2,
  },
  requiredAsterisk: {
    color: '#EF4444',
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  switchInfo: {
    flex: 1,
  },
  touchableWrapper: {
    width: '100%',
  },
  inputCard: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textAreaCard: {
    alignItems: 'flex-start',
    minHeight: 100,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  textAreaInput: {
    textAlignVertical: 'top',
    height: 90,
  },
  relationValueText: {
    fontSize: 15,
    flex: 1,
  },
  chevronText: {
    fontSize: 12,
    marginLeft: 8,
  },
  choicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  choiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  choiceText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});
