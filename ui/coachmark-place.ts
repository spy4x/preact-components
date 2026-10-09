/**
 * Where a `Coachmark` sits when the browser has no CSS anchor positioning. Pure geometry, kept out
 * of the component so it is tested without a browser; not exported from the package.
 */

import { shiftIntoView } from "./hint-bubble.ts"

/** Side of the target a coachmark sits on. */
export type CoachmarkSide = "top" | "right" | "bottom" | "left"

/** A box in viewport pixels. */
export interface PlaceBox {
  top: number
  left: number
  width: number
  height: number
}

/** The space between the target and the coachmark, in pixels. */
export const COACHMARK_GAP = 8

const opposite: Record<CoachmarkSide, CoachmarkSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
}

/** The surface's top-left corner on `side` of the target, centred along the other axis. */
function besides(side: CoachmarkSide, target: PlaceBox, width: number, height: number) {
  const centreX = target.left + (target.width - width) / 2
  const centreY = target.top + (target.height - height) / 2
  switch (side) {
    case "top":
      return { top: target.top - COACHMARK_GAP - height, left: centreX }
    case "bottom":
      return { top: target.top + target.height + COACHMARK_GAP, left: centreX }
    case "left":
      return { top: centreY, left: target.left - COACHMARK_GAP - width }
    case "right":
      return { top: centreY, left: target.left + target.width + COACHMARK_GAP }
  }
}

/** Whether a surface at `top`/`left` fits the viewport along the axis `side` moves it on. */
function fits(side: CoachmarkSide, top: number, left: number, width: number, height: number, view: {
  width: number
  height: number
}): boolean {
  return side === "top" || side === "bottom"
    ? top >= 0 && top + height <= view.height
    : left >= 0 && left + width <= view.width
}

/**
 * Place a surface of `width` × `height` on `side` of `target`. When it would leave the viewport on
 * that side and fits on the opposite one, it flips there. It is then shifted along the other axis
 * so it stays inside the viewport, the way `Tooltip`'s hint is.
 *
 * @param side The side the app asked for.
 * @param target The target's box, from `getBoundingClientRect()`.
 * @param width The surface's width.
 * @param height The surface's height.
 * @param view The viewport's width and height, without scrollbars.
 * @returns The surface's top-left corner and the side it ended on.
 */
export function placeCoachmark(
  side: CoachmarkSide,
  target: PlaceBox,
  width: number,
  height: number,
  view: { width: number; height: number },
): { top: number; left: number; side: CoachmarkSide } {
  let chosen = side
  let spot = besides(side, target, width, height)
  if (!fits(side, spot.top, spot.left, width, height, view)) {
    const flipped = besides(opposite[side], target, width, height)
    if (fits(opposite[side], flipped.top, flipped.left, width, height, view)) {
      chosen = opposite[side]
      spot = flipped
    }
  }
  const across = chosen === "top" || chosen === "bottom"
  const top = across ? spot.top : spot.top + shiftIntoView(spot.top, spot.top + height, view.height)
  const left = across
    ? spot.left + shiftIntoView(spot.left, spot.left + width, view.width)
    : spot.left
  return { top: Math.round(top), left: Math.round(left), side: chosen }
}
