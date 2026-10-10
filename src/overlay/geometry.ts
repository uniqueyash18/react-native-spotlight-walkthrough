import type { Insets, Rect, SpotlightShape, TooltipPlacement } from '../types';

// Pure layout maths — no React Native imports so it can be unit-tested in Node.

/** The spotlight hole, in the overlay's own coordinate space. */
export interface Hole {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Corner radius; `width / 2` for circles and pills. */
  radius: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Converts a window-space target into the hole drawn in the overlay.
 * `origin` is the overlay's own window position (it isn't always 0,0 — e.g.
 * under a translucent Android status bar).
 */
export function computeHole(
  target: Rect | null,
  origin: Point,
  container: Size,
  shape: SpotlightShape,
  padding: number,
  borderRadius: number,
): Hole {
  if (!target || shape === 'none') {
    return { x: container.width / 2, y: container.height / 2, width: 0, height: 0, radius: 0 };
  }
  const x = target.x - origin.x - padding;
  const y = target.y - origin.y - padding;
  const width = target.width + padding * 2;
  const height = target.height + padding * 2;

  if (shape === 'circle') {
    const r = Math.hypot(width, height) / 2;
    const cx = x + width / 2;
    const cy = y + height / 2;
    return { x: cx - r, y: cy - r, width: r * 2, height: r * 2, radius: r };
  }
  if (shape === 'pill') {
    return { x, y, width, height, radius: Math.min(width, height) / 2 };
  }
  return { x, y, width, height, radius: Math.min(borderRadius, width / 2, height / 2) };
}

/**
 * SVG path for "whole screen minus a rounded-rect hole", filled with the
 * even-odd rule. A path (rather than an SVG <Mask>) can be animated through
 * Reanimated's animatedProps on both platforms.
 */
/** SVG path for a rounded rectangle (clockwise). */
export function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  'worklet';
  if (w <= 0 || h <= 0) return '';
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    `M${x + rr},${y}` +
    `H${x + w - rr}` +
    `A${rr},${rr} 0 0 1 ${x + w},${y + rr}` +
    `V${y + h - rr}` +
    `A${rr},${rr} 0 0 1 ${x + w - rr},${y + h}` +
    `H${x + rr}` +
    `A${rr},${rr} 0 0 1 ${x},${y + h - rr}` +
    `V${y + rr}` +
    `A${rr},${rr} 0 0 1 ${x + rr},${y}Z`
  );
}

/**
 * SVG path for "whole screen minus a rounded-rect hole", filled with the
 * even-odd rule. A path (rather than an SVG <Mask>) can be animated through
 * Reanimated's animatedProps on both platforms.
 */
export function overlayPath(
  containerWidth: number,
  containerHeight: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  'worklet';
  return `M0,0H${containerWidth}V${containerHeight}H0Z` + roundedRectPath(x, y, w, h, r);
}

export type TooltipPosition =
  | { mode: 'center' }
  | { mode: 'below'; top: number }
  | { mode: 'above'; bottom: number };

/**
 * Picks the side of the hole with more room (or honours `placement`) and
 * clamps inside the safe area. `minSpace` is roughly the tooltip's height: if
 * neither side has that much room (a target that fills the screen), the
 * tooltip is centred over it instead of being pushed off-screen.
 */
export function computeTooltipPosition(
  hole: Hole,
  container: Size,
  insets: Insets,
  placement: TooltipPlacement,
  offset: number,
  minSpace = 140,
): TooltipPosition {
  if (placement === 'center' || hole.width === 0 || hole.height === 0) return { mode: 'center' };

  const safeTop = insets.top + 8;
  const safeBottom = container.height - insets.bottom - 8;
  const holeBottom = hole.y + hole.height;
  const roomBelow = safeBottom - holeBottom - offset;
  const roomAbove = hole.y - safeTop - offset;

  if (placement === 'auto' && roomBelow < minSpace && roomAbove < minSpace) return { mode: 'center' };

  const below = placement === 'bottom' || (placement === 'auto' && roomBelow >= roomAbove);
  if (below) {
    return {
      mode: 'below',
      top: clamp(holeBottom + offset, safeTop, Math.max(safeTop, safeBottom - minSpace)),
    };
  }
  const minBottom = container.height - safeBottom;
  return {
    mode: 'above',
    bottom: clamp(
      container.height - hole.y + offset,
      minBottom,
      Math.max(minBottom, container.height - safeTop - minSpace),
    ),
  };
}

/** Horizontal offset of the tooltip's arrow so it points at the hole's centre, kept off the rounded corners. */
export function computeArrowOffset(
  hole: Hole,
  tooltipLeft: number,
  tooltipWidth: number,
  arrowSize: number,
  cornerRadius: number,
): number {
  const centre = hole.x + hole.width / 2 - tooltipLeft - arrowSize;
  const min = cornerRadius;
  const max = tooltipWidth - cornerRadius - arrowSize * 2;
  return clamp(centre, min, Math.max(min, max));
}

/** Rectangles covering everything except the hole's bounding box — they swallow touches around an interactive hole. */
export function computeBlockers(hole: Hole, container: Size): Rect[] {
  const { width: W, height: H } = container;
  const top = Math.max(hole.y, 0);
  const bottom = Math.min(hole.y + hole.height, H);
  const left = Math.max(hole.x, 0);
  const right = Math.min(hole.x + hole.width, W);
  return [
    { x: 0, y: 0, width: W, height: top },
    { x: 0, y: bottom, width: W, height: Math.max(H - bottom, 0) },
    { x: 0, y: top, width: left, height: Math.max(bottom - top, 0) },
    { x: right, y: top, width: Math.max(W - right, 0), height: Math.max(bottom - top, 0) },
  ].filter((r) => r.width > 0 && r.height > 0);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ─── Scroll into view ────────────────────────────────────────────────────────

export interface ScrollAxisInput {
  /** Target position along the axis, in the scroll content's coordinates. */
  targetStart: number;
  targetSize: number;
  /** The scroll viewport's position along the axis, in window coordinates. */
  viewportStart: number;
  viewportSize: number;
  /** What's actually visible along the axis (viewport ∩ safe area), in window coordinates. */
  visibleStart: number;
  visibleEnd: number;
  /** Current scroll offset and total content size. */
  offset: number;
  contentSize: number;
  /** Space to keep between the target and the visible edge. */
  margin: number;
  /** Room the tooltip needs beside the target (0 for the horizontal axis). */
  reserve: number;
}

/**
 * New scroll offset that brings the target into view with room for the
 * tooltip, or `null` when it's already fine. Targets that fit with a
 * tooltip-sized gap on both sides are centred; taller ones are top-aligned
 * so the tooltip goes below. Never scrolls past either end of the content.
 */
export function computeScrollOffset(input: ScrollAxisInput): number | null {
  const { targetStart, targetSize, viewportStart, viewportSize, offset, contentSize, margin, reserve } =
    input;
  const visStart = offset + (input.visibleStart - viewportStart);
  const visEnd = offset + (input.visibleEnd - viewportStart);
  const visSize = visEnd - visStart;
  if (visSize <= 0) return null;
  const targetEnd = targetStart + targetSize;

  const outOfView = targetStart < visStart + margin || targetEnd > visEnd - margin;
  const roomBefore = targetStart - visStart;
  const roomAfter = visEnd - targetEnd;
  const couldFitTooltip = targetSize + reserve + margin * 2 <= visSize;
  const noTooltipRoom = reserve > 0 && Math.max(roomBefore, roomAfter) < reserve && couldFitTooltip;
  if (!outOfView && !noTooltipRoom) return null;

  let newVisStart: number;
  if (targetSize + reserve * 2 + margin * 2 <= visSize) {
    newVisStart = targetStart - (visSize - targetSize) / 2;
  } else {
    newVisStart = targetStart - margin;
  }
  const maxOffset = Math.max(0, contentSize - viewportSize);
  const next = clamp(offset + (newVisStart - visStart), 0, maxOffset);
  return Math.abs(next - offset) > 1 ? next : null;
}

/** Max finger travel, in points, for a touch to still count as a tap. */
export const TAP_SLOP = 10;

/** True if a touch released at `end` after starting at `start` was a tap rather than a drag. */
export function isTap(start: Point, end: Point, slop = TAP_SLOP): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) <= slop;
}
