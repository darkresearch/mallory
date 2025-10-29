/**
 * React Native Mock for Tests
 */

export const Platform = {
  OS: 'web' as const,
  Version: '1.0',
  select: (obj: any) => obj.web || obj.default || Object.values(obj)[0],
  constants: {},
  isTV: false,
  isTesting: true,
};

export const StyleSheet = {
  create: (styles: any) => styles,
  flatten: (style: any) => style,
};

export const Dimensions = {
  get: () => ({ width: 375, height: 667 }),
  addEventListener: () => ({ remove: () => {} }),
};

export const AppState = {
  currentState: 'active',
  addEventListener: () => ({ remove: () => {} }),
};

export const Alert = {
  alert: () => {},
};

export const View = 'View';
export const Text = 'Text';
export const TouchableOpacity = 'TouchableOpacity';
export const ScrollView = 'ScrollView';
export const TextInput = 'TextInput';
export const Image = 'Image';
export const Button = 'Button';

