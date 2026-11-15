import { type Devtools, PAGE_UNTIL, pointerToCorner, poll } from "../harness.ts"
import { type Hold, type Point } from "./shared.ts"

/** The outcome of clearing the stack and pushing the one toast that dismisses itself. */
interface Pushed {
  ok: boolean
  /** What was missing from the card, when `ok` is false. */
  reason: string
  /** The duration the card pushed, read off its own button rather than written down here. */
  duration: number
  toasts: number
}

/**
 * Clear the stack and push the card's one self-dismissing toast.
 *
 * The duration comes back from the button's own `data-duration` rather than being written down
 * here, so the checks wait multiples of what the card really pushed and the two cannot drift apart.
 *
 * @param devtools The connected session.
 * @returns What the card did, including which control was missing when it could do nothing.
 */
export async function pushAutoToast(devtools: Devtools): Promise<Pushed> {
  return await devtools.evaluate<Pushed>(`(async () => {
    const { region, auto, clear } = globalThis.__verifyToastr ?? {}
    if (!region || !auto || !clear) {
      const missing = !region
        ? "its live area"
        : !auto
        ? 'its auto-dismiss button (data-e2e="toast-auto")'
        : 'its clear button (data-e2e="toast-clear")'
      return { ok: false, reason: "the Toastr card is missing " + missing, duration: 0, toasts: -1 }
    }
    const until = ${PAGE_UNTIL}
    clear.click()
    await until(() => region.children.length === 0)
    auto.click()
    await until(() => region.children.length > 0)
    const duration = Number(auto.dataset.duration ?? 0)
    if (!Number.isFinite(duration) || duration <= 0) {
      return {
        ok: false,
        reason: "the card's auto-dismiss button carries no usable data-duration",
        duration: 0,
        toasts: region.children.length,
      }
    }
    return { ok: true, reason: "", duration, toasts: region.children.length }
  })()`)
}

/**
 * Move the pointer to the corner {@link pointerToCorner} parks it in, off the stack.
 *
 * @param devtools The connected session.
 * @returns What is under the corner, so a check can say the pointer really is clear of the stack.
 */
export async function pointerAway(devtools: Devtools): Promise<Point> {
  const { x, y } = await pointerToCorner(devtools)

  return await devtools.evaluate<Point>(`(() => {
    const region = globalThis.__verifyToastr?.region ?? null
    const target = document.elementFromPoint(${x}, ${y})
    return {
      x: ${x},
      y: ${y},
      inViewport: true,
      insideRegion: region !== null && target !== null && region.contains(target),
      tag: target === null ? "nothing" : target.tagName,
    }
  })()`)
}

/**
 * Wait for the stack to empty, and report how long that took.
 *
 * @param devtools The connected session.
 * @param timeoutMs How long to wait before giving up.
 */
export async function goneWithin(devtools: Devtools, timeoutMs: number): Promise<Hold> {
  const startedAt = Date.now()
  const held = await poll(
    () =>
      devtools.evaluate<boolean>(
        `(globalThis.__verifyToastr?.region?.children.length ?? -1) === 0`,
      ),
    timeoutMs,
  )

  return { held, elapsedMs: Date.now() - startedAt }
}
