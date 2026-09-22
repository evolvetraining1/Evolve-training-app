import { forwardRef } from 'react';
import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { screenPadding } from '@/src/lib/screen-layout';

/** Root scrolling surface. Use ordinary ScrollView for nested lists. */
export const ScreenScrollView = forwardRef<ScrollView, ScrollViewProps & { compactHeader?: boolean }>(
  function ScreenScrollView({ contentContainerStyle, style, compactHeader = false, ...props }, ref) {
    const insets = useSafeAreaInsets();
    const contentStyle = StyleSheet.flatten(contentContainerStyle) ?? {};
    return <ScrollView ref={ref}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets={true}
      {...props}
      contentInsetAdjustmentBehavior="never"
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[contentContainerStyle, screenPadding(insets, contentStyle, compactHeader)]}
    />;
  }
);
