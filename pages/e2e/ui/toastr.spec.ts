import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"

const TOAST_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const

/** The `Toastr` card at a window 800 px tall and as wide as asked, with its stack and its picker. */
async function toastrCard(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 })
  const card = page.locator("#demo-Toastr")
  const stack = page.locator(`[data-e2e="guide-toastr"]`)
  const toast = stack.locator(`[data-e2e="guide-toast-info"]`)
  return {
    stack,
    toast,
    dismiss: toast.getByRole("button", { name: "Dismiss" }),
    /** Pushes the card's info toast and waits until its slide has ended, so its box is final. */
    push: async () => {
      await card.locator(`[data-e2e="toast-info"]`).click()
      await toast.waitFor()
      await toast.evaluate((element) =>
        Promise.all(element.getAnimations().map((animation) => animation.finished))
      )
    },
    /**
     * Pushes the card's info toast and reads its horizontal `translate` the moment it is in the
     * document, which is where its slide starts: negative from the left, positive from the right,
     * 0 with no slide.
     */
    pushAndReadStart: async (): Promise<number> => {
      // The observer is in place before the click: this call returns once it watches the stack.
      const start = await stack.evaluateHandle((element) => ({
        translate: new Promise<string>((done) => {
          new MutationObserver((records, observer) => {
            const added = records.flatMap((record) => [...record.addedNodes])
              .find((node) => node instanceof HTMLElement)
            if (!added) return
            observer.disconnect()
            done(getComputedStyle(added as HTMLElement).translate)
          }).observe(element, { childList: true })
        }),
      }))
      await card.locator(`[data-e2e="toast-info"]`).click()
      return parseFloat((await start.evaluate((held) => held.translate)).split(" ")[0]) || 0
    },
    /** Empties the stack. A dispatched click, as for the picker below. */
    clear: async () => {
      await card.locator(`[data-e2e="toast-clear"]`).dispatchEvent("click")
      await toast.waitFor({ state: "detached" })
    },
    /** Puts the stack in a corner. A dispatched click: a toast may lie over the radio by now. */
    moveTo: async (corner: typeof TOAST_CORNERS[number]) => {
      await card.locator(`input[name="guide-toastr-corner"][value="${corner}"]`)
        .dispatchEvent("click")
      // An empty stack has no height, so it is attached and never "visible".
      await stack.and(page.locator(":not(.static)")).waitFor({ state: "attached" })
    },
    /** The window's width without the page's own scrollbar, which a desktop browser draws. */
    innerWidth: () => page.evaluate(() => document.documentElement.clientWidth),
  }
}

/** A locator's box, or an error naming what had none. */
async function boxOf(locator: Locator, what: string) {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`${what} has no box`)
  return box
}

/** A spec that a toast's slide starts on its corner's side at the given window width. */
function toastSlideSpec(width: number): Spec {
  return {
    name:
      `Toastr: at ${width} px wide a toast slides in from the left in a left corner and from the right in a right one`,
    pageId: "ui",
    run: async (page) => {
      const { moveTo, pushAndReadStart, clear } = await toastrCard(page, width)
      const starts: string[] = []
      for (const corner of TOAST_CORNERS) {
        await moveTo(corner)
        const x = await pushAndReadStart()
        if (corner.endsWith("left") ? x >= 0 : x <= 0) {
          throw new Error(`${corner}: the slide starts at translate x ${x}px`)
        }
        starts.push(`${corner} ${x}px`)
        await clear()
      }
      return starts.join(", ")
    },
  }
}

/**
 * `Toastr` on a phone and from `sm` up: where the stack sits in each corner, which side a toast
 * slides in from, and how large the dismiss button is.
 */
function toastrSpecs(): Spec[] {
  return [
    ...([320, 414] as const).map((width): Spec => ({
      name:
        `Toastr: at ${width} px wide, in each of the four corners, a toast is inside the window, 16 px from the left, the right and the corner's top or bottom edge`,
      pageId: "ui",
      run: async (page) => {
        const { toast, push, moveTo, innerWidth } = await toastrCard(page, width)
        await push()
        const inner = await innerWidth()
        for (const corner of TOAST_CORNERS) {
          await moveTo(corner)
          const box = await boxOf(toast, `the toast in ${corner}`)
          const [left, right] = [box.x, inner - box.x - box.width]
          const edge = corner.startsWith("top") ? box.y : 800 - box.y - box.height
          if ([left, right, edge].some((gap) => Math.abs(gap - 16) > 0.5)) {
            throw new Error(
              `${corner}: ${left}px to the left, ${right}px to the right, ${edge}px from its edge`,
            )
          }
        }
      },
    })),
    {
      name:
        "Toastr: at 320 px wide the dismiss button is at least 44 px each way inside its toast, and Enter on it closes the toast",
      pageId: "ui",
      run: async (page) => {
        const { toast, dismiss, push, moveTo } = await toastrCard(page, 320)
        await push()
        await moveTo("top-right")
        const frame = await boxOf(toast, "the toast")
        const box = await boxOf(dismiss, "the dismiss button")
        if (box.width < 44 || box.height < 44) {
          throw new Error(`the dismiss button is ${box.width} × ${box.height} px`)
        }
        if (
          box.x < frame.x || box.y < frame.y || box.x + box.width > frame.x + frame.width + 0.5 ||
          box.y + box.height > frame.y + frame.height + 0.5
        ) {
          throw new Error(
            `the button leaves its toast: ${JSON.stringify(box)} in ${JSON.stringify(frame)}`,
          )
        }
        await dismiss.focus()
        await page.keyboard.press("Enter")
        await toast.waitFor({ state: "detached" })
        return `${box.width} × ${box.height} px`
      },
    },
    ...([[640, 320], [1440, 384]] as const).map(([width, stackWidth]): Spec => ({
      name:
        `Toastr: at ${width} px wide the stack is ${stackWidth} px wide, 32 px from both edges of its corner, and the dismiss button is at least 36 px each way`,
      pageId: "ui",
      run: async (page) => {
        const { stack, dismiss, push, moveTo, innerWidth } = await toastrCard(page, width)
        await push()
        const inner = await innerWidth()
        for (const corner of TOAST_CORNERS) {
          await moveTo(corner)
          const box = await boxOf(stack, `the stack in ${corner}`)
          const side = corner.endsWith("left") ? box.x : inner - box.x - box.width
          const edge = corner.startsWith("top") ? box.y : 800 - box.y - box.height
          if (
            Math.abs(box.width - stackWidth) > 0.5 || Math.abs(side - 32) > 0.5 ||
            Math.abs(edge - 32) > 0.5
          ) {
            throw new Error(
              `${corner}: ${box.width}px wide, ${side}px and ${edge}px from its edges`,
            )
          }
        }
        const button = await boxOf(dismiss, "the dismiss button")
        if (button.width < 36 || button.height < 36) {
          throw new Error(`the dismiss button is ${button.width} × ${button.height} px`)
        }
      },
    })),
    {
      name:
        "Toastr: the dismiss button adds no height: at 414 and 1440 px a toast is as tall as its text plus 16 px above and below",
      pageId: "ui",
      run: async (page) => {
        const heights: string[] = []
        // At 414 px the title and a one-line body are 40 px, less than the 44 px button.
        for (const width of [414, 1440]) {
          const { toast, push, moveTo, clear } = await toastrCard(page, width)
          await push()
          await moveTo("top-right")
          const box = await boxOf(toast, "the toast")
          const first = await boxOf(toast.locator("p").first(), "the toast's first line")
          const last = await boxOf(toast.locator("p").last(), "the toast's last line")
          const text = last.y + last.height - first.y
          if (Math.abs(box.height - text - 32) > 0.5) {
            throw new Error(
              `at ${width} px the toast is ${box.height}px tall around ${text}px of text`,
            )
          }
          heights.push(`${width}: ${box.height}px around ${text}px`)
          await clear()
        }
        return heights.join(", ")
      },
    },
    {
      name:
        "Toastr: a caller's own offsets place the stack from 640 px up: the mini-app's toast sits 17 px from the bottom and the right of its frame, and its empty stack has no height",
      pageId: "overview",
      run: async (page) => {
        const frame = page.locator(`[data-e2e="mini-app"]`)
        const stack = frame.locator(`[data-e2e="mini-app-toasts"]`)
        const toast = stack.locator(`[role="status"]`)
        const gaps: string[] = []
        for (const width of [640, 768, 1440]) {
          await page.setViewportSize({ width, height: 800 })
          const empty = await stack.evaluate((element) => element.getBoundingClientRect().height)
          if (empty !== 0) throw new Error(`at ${width} px the empty stack is ${empty}px tall`)
          await frame.locator(`[data-e2e="mini-app-toast"]`).click()
          await toast.waitFor()
          await toast.evaluate((element) =>
            Promise.all(element.getAnimations().map((animation) => animation.finished))
          )
          const outer = await boxOf(frame, "the mini-app's frame")
          const box = await boxOf(toast, "the mini-app's toast")
          const bottom = outer.y + outer.height - box.y - box.height
          const right = outer.x + outer.width - box.x - box.width
          if (Math.abs(bottom - 17) > 1 || Math.abs(right - 17) > 1) {
            throw new Error(
              `at ${width} px the toast is ${bottom}px from the bottom and ${right}px from the right`,
            )
          }
          gaps.push(`${width}: ${bottom}px, ${right}px`)
          await toast.getByRole("button", { name: "Dismiss" }).click()
          await toast.waitFor({ state: "detached" })
        }
        return gaps.join("; ")
      },
    },
    toastSlideSpec(320),
    toastSlideSpec(1440),
    {
      name: "Toastr: with reduced motion requested, a toast does not slide in, left or right",
      pageId: "ui",
      run: async (page) => {
        await page.emulateMedia({ reducedMotion: "reduce" })
        const { moveTo, pushAndReadStart, clear } = await toastrCard(page, 1440)
        for (const corner of ["top-left", "top-right"] as const) {
          await moveTo(corner)
          const x = await pushAndReadStart()
          if (x !== 0) throw new Error(`${corner}: the toast starts at translate x ${x}px`)
          await clear()
        }
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...toastrSpecs(),
]
