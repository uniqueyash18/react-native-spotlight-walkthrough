import { Dimensions, type View } from 'react-native';
import { computeScrollOffset } from './overlay/geometry';
import type { Insets } from './types';

/**
 * Anything that holds a scrollable: a ScrollView ref, a FlatList / SectionList
 * ref (resolved through `getNativeScrollRef`), or an Animated / gesture-handler
 * ScrollView that forwards the same methods.
 */
export type ScrollableRef = React.RefObject<unknown>;

interface ScrollViewLike {
  scrollTo(options: { x?: number; y?: number; animated?: boolean }): void;
  getInnerViewRef?: () => unknown;
  getInnerViewNode?: () => unknown;
  measureInWindow(cb: (x: number, y: number, w: number, h: number) => void): void;
}

interface Measurable {
  measureInWindow(cb: (x: number, y: number, w: number, h: number) => void): void;
  measureLayout(
    relativeTo: unknown,
    onSuccess: (x: number, y: number, w: number, h: number) => void,
    onFail?: () => void,
  ): void;
}

function resolveScrollView(instance: unknown): ScrollViewLike | null {
  const i = instance as Record<string, unknown> | null | undefined;
  if (!i) return null;
  // FlatList / SectionList / VirtualizedList expose the underlying ScrollView.
  const nested =
    (typeof i.getNativeScrollRef === 'function' && (i.getNativeScrollRef as () => unknown)()) ||
    (typeof i.getScrollResponder === 'function' && (i.getScrollResponder as () => unknown)()) ||
    i;
  const sv = nested as Partial<ScrollViewLike>;
  return typeof sv.scrollTo === 'function' && typeof sv.measureInWindow === 'function'
    ? (sv as ScrollViewLike)
    : null;
}

const windowRect = (m: { measureInWindow: Measurable['measureInWindow'] }) =>
  new Promise<{ x: number; y: number; w: number; h: number }>((resolve) =>
    m.measureInWindow((x, y, w, h) => resolve({ x, y, w, h })),
  );

const layoutIn = (m: Measurable, relativeTo: unknown) =>
  new Promise<{ x: number; y: number; w: number; h: number } | null>((resolve) => {
    try {
      m.measureLayout(relativeTo, (x, y, w, h) => resolve({ x, y, w, h }), () => resolve(null));
    } catch {
      resolve(null);
    }
  });

export interface ScrollIntoViewOptions {
  insets: Insets;
  margin: number;
  /** Room to leave beside the target for the tooltip (vertical axis). */
  tooltipReserve: number;
}

/**
 * Scrolls `scrollable` so `target` is visible with room for the tooltip.
 * Resolves `true` if it scrolled (the caller should wait and re-measure),
 * `false` if nothing needed to move or the scrollable couldn't be used.
 */
export async function scrollTargetIntoView(
  target: View,
  scrollable: unknown,
  { insets, margin, tooltipReserve }: ScrollIntoViewOptions,
): Promise<boolean> {
  const sv = resolveScrollView(scrollable);
  if (!sv) return false;
  const inner = (sv.getInnerViewRef?.() ?? sv.getInnerViewNode?.()) as Measurable | null;
  if (!inner) return false;

  const [viewport, content, pos] = await Promise.all([
    windowRect(sv),
    windowRect(inner),
    layoutIn(target as unknown as Measurable, inner),
  ]);
  if (!pos || viewport.w === 0 || viewport.h === 0) return false;

  const screen = Dimensions.get('window');
  // Content's window position = viewport position − scroll offset.
  const offsetY = viewport.y - content.y;
  const offsetX = viewport.x - content.x;

  const y = computeScrollOffset({
    targetStart: pos.y,
    targetSize: pos.h,
    viewportStart: viewport.y,
    viewportSize: viewport.h,
    visibleStart: Math.max(viewport.y, insets.top),
    visibleEnd: Math.min(viewport.y + viewport.h, screen.height - insets.bottom),
    offset: offsetY,
    contentSize: content.h,
    margin,
    reserve: tooltipReserve,
  });
  const x = computeScrollOffset({
    targetStart: pos.x,
    targetSize: pos.w,
    viewportStart: viewport.x,
    viewportSize: viewport.w,
    visibleStart: Math.max(viewport.x, insets.left),
    visibleEnd: Math.min(viewport.x + viewport.w, screen.width - insets.right),
    offset: offsetX,
    contentSize: content.w,
    margin,
    reserve: 0,
  });
  if (x === null && y === null) return false;

  sv.scrollTo({ x: x ?? offsetX, y: y ?? offsetY, animated: true });
  return true;
}
