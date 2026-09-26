/**
 * Where a chart's tooltip goes: beside the point it describes, inside the chart's own box and the
 * viewport, flipped to the other side of the point when the preferred side has no room.
 *
 * {@link placeTooltip} is pure, so the rules are unit-tested without a browser;
 * {@link positionTooltip} measures the page and applies them. Both `LineChart` and `DonutChart` use
 * them. Nothing here is exported by the package.
 */

/** A rectangle in viewport coordinates, like `DOMRect`'s edges. */
export interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}

/** A placed tooltip: its top-left corner, and the side of the anchor it ended up on. */
export interface Placement {
  left: number
  top: number
  side: "right" | "left"
}

/** The text colour of a tooltip: the page's own, not the muted axis colour. */
export const TOOLTIP_TEXT_COLOR = "var(--color-foreground, oklch(0.13 0.028 261.692))"

/** Space kept between the tooltip and the viewport's edge. */
export const VIEWPORT_MARGIN = 8

/**
 * Put a `width` × `height` tooltip beside `anchor`, `gap` pixels away, within `bounds`.
 *
 * The tooltip prefers the anchor's right and flips to its left when the right has no room; when
 * neither side has, it is pushed back inside. Vertically it centres on the anchor and is clamped to
 * the bounds. A tooltip larger than the bounds keeps its top-left corner on theirs, so its start —
 * its heading — stays readable.
 */
export function placeTooltip(
  anchor: { x: number; y: number },
  size: { width: number; height: number },
  bounds: Bounds,
  gap = 12,
): Placement {
  let side: Placement["side"] = "right"
  let left = anchor.x + gap
  if (left + size.width > bounds.right) {
    side = "left"
    left = anchor.x - gap - size.width
  }
  left = clamp(left, bounds.left, bounds.right - size.width)
  const top = clamp(anchor.y - size.height / 2, bounds.top, bounds.bottom - size.height)
  return { left, top, side }
}

/** `value` pushed inside `[low, high]`; `low` wins when the range is empty. */
function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high))
}

/** The overlap of the chart's box and the viewport, less {@link VIEWPORT_MARGIN}. */
export function visibleBounds(box: Bounds, viewport: { width: number; height: number }): Bounds {
  return {
    left: Math.max(box.left, VIEWPORT_MARGIN),
    top: Math.max(box.top, VIEWPORT_MARGIN),
    right: Math.min(box.right, viewport.width - VIEWPORT_MARGIN),
    bottom: Math.min(box.bottom, viewport.height - VIEWPORT_MARGIN),
  }
}

/**
 * Measure and place `tooltip`, absolutely positioned inside `root`, beside `anchor`.
 *
 * @param root The chart's own box, and the tooltip's containing block.
 * @param tooltip The tooltip element, already holding its text.
 * @param anchor The point it describes, in viewport coordinates.
 */
export function positionTooltip(
  root: HTMLElement,
  tooltip: HTMLElement,
  anchor: { x: number; y: number },
): void {
  const box = root.getBoundingClientRect()
  const viewport = {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  }
  const placed = placeTooltip(
    anchor,
    { width: tooltip.offsetWidth, height: tooltip.offsetHeight },
    visibleBounds(box, viewport),
  )
  tooltip.style.left = `${Math.round(placed.left - box.left)}px`
  tooltip.style.top = `${Math.round(placed.top - box.top)}px`
  tooltip.dataset.side = placed.side
}
