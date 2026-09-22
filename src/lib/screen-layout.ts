export const SCREEN_HEADER_TOP = 110;
export type ScreenInsets = { top: number; bottom: number; left: number; right: number };
const numericPadding = (value: unknown, fallback = 0) => typeof value === 'number' ? value : fallback;

/** Explicit safe areas: do not combine with automatic content insets. */
export function screenPadding(insets: ScreenInsets, style: Partial<Record<"padding" | "paddingHorizontal" | "paddingVertical" | "paddingTop" | "paddingBottom" | "paddingLeft" | "paddingRight", unknown>> = {}, compact = false) {
  const padding = numericPadding(style.padding);
  const horizontal = numericPadding(style.paddingHorizontal, padding);
  const vertical = numericPadding(style.paddingVertical, padding);
  return {
    paddingTop: Math.max(compact ? numericPadding(style.paddingTop, vertical) : SCREEN_HEADER_TOP, insets.top + 18),
    paddingBottom: Math.max(numericPadding(style.paddingBottom, vertical), insets.bottom + 24),
    paddingLeft: Math.max(numericPadding(style.paddingLeft, horizontal), insets.left + 12),
    paddingRight: Math.max(numericPadding(style.paddingRight, horizontal), insets.right + 12),
  };
}
export function compactFields(width: number, fontScale: number) {
  return width < 380 || fontScale > 1.15;
}
