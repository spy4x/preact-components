/**
 * The round play mark and focus ring both `DemoVideo` and `YouTubeVideo` draw over their poster,
 * kept in one place so the two posters look the same. Internal: not one of the package's entry
 * points.
 *
 * @module
 */

import { join } from "@spy4x/preact-cn/join"
import { IconPlaySolid } from "@spy4x/preact-icons"
import type { JSX } from "preact"

/** The poster link: the whole frame is the target; its focus ring is on the {@link PlayMark}. */
export const playLinkClass = join(
  "relative block w-full overflow-hidden",
  "group cursor-pointer focus-visible:outline-hidden",
)

/** The poster fills the frame. */
export const posterClass = "block h-full w-full object-cover"

/**
 * The layer over the poster: it centres the play mark and carries the focus ring, which the link
 * itself would paint under the image.
 */
const overlayClass =
  "pointer-events-none absolute inset-0 flex items-center justify-center group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-focus"

/** The play mark: a round dark disc with a white triangle, a little larger under the pointer. */
const discClass =
  "flex size-16 items-center justify-center rounded-full bg-scrim text-scrim-foreground shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-(--color-scrim-foreground) motion-safe:transition-transform motion-safe:group-hover:scale-110 motion-safe:group-focus-visible:scale-110"

/**
 * The decorative play mark over a poster inside a link with {@link playLinkClass}: a disc with a
 * triangle, hidden from assistive tech because the link carries the name.
 *
 * @returns The overlay span.
 */
export function PlayMark(): JSX.Element {
  return (
    <span aria-hidden="true" class={overlayClass}>
      <span class={discClass}>
        <IconPlaySolid class="size-8 translate-x-px" />
      </span>
    </span>
  )
}
