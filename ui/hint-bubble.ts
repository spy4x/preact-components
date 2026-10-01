/**
 * The look of a small hint bubble: `Tooltip`'s bubble and `ThemeToggle`'s "Auto mode" hint.
 *
 * One string in a module of its own, not exported from the package: two components draw the same
 * bubble, and a module with no imports lets `ThemeToggle` share it without loading `Tooltip`, whose
 * `cn` brings `tailwind-merge` into a bundle. The placement helper below is not exported either.
 */
export const hintBubbleClasses =
  "block rounded-md bg-foreground px-2 py-1 text-xs text-canvas shadow-raised dark:bg-hover dark:text-foreground"

/** The least room, in pixels, the hint keeps from either edge of the viewport. */
const viewportGutter = 8

/**
 * How far to move a box sideways so it fits the viewport with {@link viewportGutter} to spare:
 * right when it starts past the left edge, left when it ends past the right one, `0` when it fits.
 *
 * @param left The box's left edge, in viewport pixels.
 * @param right The box's right edge, in viewport pixels.
 * @param width The viewport's width without its scrollbar.
 */
export function shiftIntoView(left: number, right: number, width: number): number {
  if (left < viewportGutter) return viewportGutter - left
  if (right > width - viewportGutter) {
    return Math.max(width - viewportGutter - right, viewportGutter - left)
  }
  return 0
}
