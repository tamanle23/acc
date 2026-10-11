import { vi } from 'vitest';

const memoryStorage = new Map<string, string>();

export const mockAsyncStorage = {
  getItem: vi.fn(async (key: string) => memoryStorage.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => {
    memoryStorage.set(key, value);
  }),
  removeItem: vi.fn(async (key: string) => {
    memoryStorage.delete(key);
  }),
  clear: vi.fn(async () => {
    memoryStorage.clear();
  }),
  getAllKeys: vi.fn(async () => Array.from(memoryStorage.keys())),
};

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: mockAsyncStorage,
}));

vi.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('div', props),
    Text: (props: any) => React.createElement('span', props),
    TextInput: (props: any) => React.createElement('input', props),
    Switch: (props: any) => React.createElement('input', { type: 'checkbox', ...props }),
    TouchableOpacity: (props: any) => React.createElement('button', props),
    Pressable: (props: any) => React.createElement('button', props),
    Image: (props: any) => React.createElement('img', props),
    Modal: (props: any) => (props.visible ? React.createElement('div', props) : null),
    FlatList: ({ data, renderItem, ListEmptyComponent }: any) => {
      if (!data || data.length === 0) return ListEmptyComponent || null;
      return React.createElement(
        'div',
        null,
        data.map((item: any, idx: number) => renderItem({ item, index: idx }))
      );
    },
    ActivityIndicator: (props: any) => React.createElement('div', props),
    SafeAreaView: (props: any) => React.createElement('div', props),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (style: any) => style,
    },
    Platform: {
      OS: 'ios',
      Version: 17,
      select: (objs: any) => objs.ios ?? objs.default,
    },
    Dimensions: {
      get: () => ({ width: 390, height: 844 }),
    },
    useColorScheme: () => 'dark',
  };
});

vi.mock('expo-blur', () => {
  const React = require('react');
  return {
    BlurView: (props: any) => React.createElement('div', props),
  };
});

vi.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: (props: any) => React.createElement('div', props),
  };
});

vi.mock('@react-navigation/native', () => ({
  useTheme: () => ({
    dark: true,
    colors: {
      primary: '#3B82F6',
      background: '#0F172A',
      card: '#1E293B',
      text: '#F8FAFC',
      border: '#334155',
      notification: '#EF4444',
    },
  }),
}));
