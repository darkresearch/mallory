# PressableButton

Mallory's delightful, consistent button component with smooth spring animations.

## Features

- ✨ **Smooth "squish" animation** - Gentle scale effect on press with spring physics
- 🎨 **Multiple variants** - Primary, secondary, ghost, and pill styles
- 📏 **Three sizes** - Small, medium, and large
- ⏳ **Built-in loading states** - Integrated spinner animation
- ♿ **Accessible** - Proper ARIA labels and disabled states
- 🎯 **Consistent feedback** - Same delightful interaction across the entire app

## Usage

### Basic Button

```tsx
import { PressableButton } from '@/components/ui/PressableButton';

<PressableButton onPress={handlePress}>
  Click me!
</PressableButton>
```

### With Icon

```tsx
<PressableButton 
  onPress={handlePress}
  icon={<Ionicons name="create-outline" size={20} color="#000000" />}
>
  New Chat
</PressableButton>
```

### Loading State

```tsx
<PressableButton 
  onPress={handlePress}
  loading={isLoading}
>
  Save Changes
</PressableButton>
```

### Variants

```tsx
// Primary (default) - Warm brown background
<PressableButton variant="primary">Primary</PressableButton>

// Secondary - Outlined with border
<PressableButton variant="secondary">Secondary</PressableButton>

// Ghost - Transparent background
<PressableButton variant="ghost">Ghost</PressableButton>

// Pill - Light orange/peach background
<PressableButton variant="pill">Pill</PressableButton>
```

### Sizes

```tsx
<PressableButton size="small">Small</PressableButton>
<PressableButton size="medium">Medium</PressableButton> {/* default */}
<PressableButton size="large">Large</PressableButton>
```

### Full Width

```tsx
<PressableButton fullWidth onPress={handlePress}>
  Full Width Button
</PressableButton>
```

### Disabled

```tsx
<PressableButton disabled onPress={handlePress}>
  Disabled Button
</PressableButton>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `React.ReactNode` | - | Button content (text or custom elements) |
| `onPress` | `() => void` | - | Press handler callback |
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'pill'` | `'primary'` | Visual style variant |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | Size variant |
| `disabled` | `boolean` | `false` | Disabled state |
| `loading` | `boolean` | `false` | Loading state (shows spinner) |
| `icon` | `React.ReactNode` | - | Icon to display before text |
| `fullWidth` | `boolean` | `false` | Make button full width |
| `style` | `ViewStyle` | - | Custom container styles |
| `textStyle` | `TextStyle` | - | Custom text styles |

## Design Philosophy

The button is designed to feel **warm, friendly, and responsive** - matching Mallory's personality:

1. **Spring physics** - The 0.96 scale with spring bounce feels natural and playful
2. **Warm palette** - Browns and oranges from Mallory's design system
3. **Smooth transitions** - All state changes are animated
4. **Clear feedback** - Users always know when they've pressed a button

## Animation Details

- **Press down**: Scales to 0.96 with spring damping
- **Release**: Bounces back to 1.0
- **Spring config**: `{ damping: 15, stiffness: 400 }`
- **Press sequence**: Quick down-up for extra satisfying tactile feel

## Accessibility

- Uses `accessibilityRole="button"`
- Properly sets `accessibilityState` for disabled buttons
- Loading states are clearly indicated
- All text has proper contrast ratios

## Migration Guide

### Before (old TouchableOpacity):

```tsx
<TouchableOpacity 
  style={styles.button}
  onPress={handlePress}
  activeOpacity={0.7}
>
  <Text style={styles.buttonText}>Press me</Text>
</TouchableOpacity>
```

### After (PressableButton):

```tsx
<PressableButton onPress={handlePress}>
  Press me
</PressableButton>
```

Much simpler! The button handles all styling, animation, and states automatically.

