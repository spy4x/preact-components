import { AxeBuilder } from "@axe-core/playwright"
import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"

/** One guide demo that shows a key the app binds elsewhere. */
interface ShownKey {
  /** The name each spec starts with. */
  name: string
  /** The `data-e2e` of the control. */
  e2e: string
  /** The key the control shows. */
  key: string
  /** The `aria-keyshortcuts` value the control carries. */
  announced: string
}

const SHOWN_KEYS: readonly ShownKey[] = [
  { name: "Button", e2e: "shown-key-button", key: "b", announced: "B" },
  { name: "Button link", e2e: "shown-key-link", key: "l", announced: "L" },
  { name: "PageAction link", e2e: "page-action-shown-key", key: "e", announced: "E" },
  { name: "DateRangePicker", e2e: "guide-date-range-shown-key", key: "d", announced: "D" },
]

/** What became of one key press. */
interface KeyWatch {
  /** How many presses of the key reached the page. */
  keydowns: number
  /** Whether a listener on the page cancelled the press. */
  taken: boolean
  /** How many clicks reached the control. */
  clicks: number
}

/** The page's global that holds the {@link KeyWatch} between two `evaluate` calls. */
type WatchedPage = typeof globalThis & { shownKeyWatch: KeyWatch }

/**
 * Press `key` on the page and answer what became of it. Focus leaves the control first, so the
 * press cannot activate whatever was focused.
 */
async function pressAndWatch(page: Page, control: Locator, key: string): Promise<KeyWatch> {
  await control.evaluate((element, pressed) => {
    const watch: KeyWatch = { keydowns: 0, taken: false, clicks: 0 }
    ;(globalThis as WatchedPage).shownKeyWatch = watch
    ;(document.activeElement as HTMLElement | null)?.blur()
    element.addEventListener("click", () => watch.clicks++)
    // On `window`, in the bubbling phase: it runs after every listener on the page.
    addEventListener("keydown", (event) => {
      if (event.key !== pressed) return
      watch.keydowns++
      watch.taken = event.defaultPrevented
    })
  }, key)
  await page.keyboard.press(key)
  // A click the key caused would have run by the time the next frame is drawn.
  return await page.evaluate(async () => {
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    return (globalThis as WatchedPage).shownKeyWatch
  })
}

/** Throw when `control` is missing its hint or its announcement. */
async function assertShown(control: Locator, { announced }: ShownKey): Promise<void> {
  await control.and(control.page().locator(`[aria-keyshortcuts="${announced}"]`)).waitFor()
  const hint = control.locator("[data-hotkey-hint]")
  await hint.waitFor()
  const text = (await hint.innerText()).trim()
  if (text !== announced) throw new Error(`the hint reads "${text}", not "${announced}"`)
}

/** The spec that presses one control's key. */
function pressSpec(shown: ShownKey): Spec {
  return {
    name: `keyshortcuts: ${shown.name} shows ${shown.announced}, and pressing it does not click`,
    pageId: "ui",
    run: async (page) => {
      const control = page.locator(`[data-e2e="${shown.e2e}"]`)
      await control.scrollIntoViewIfNeeded()
      await assertShown(control, shown)
      const { keydowns, taken, clicks } = await pressAndWatch(page, control, shown.key)
      if (keydowns !== 1) throw new Error(`the page received ${keydowns} presses of the key`)
      if (taken) throw new Error("something on the page took the key")
      if (clicks !== 0) throw new Error(`the key clicked the control ${clicks} times`)
      if (await control.getAttribute("aria-expanded") === "true") {
        throw new Error("the key opened the picker")
      }
      return `${shown.key} reached the page, took no action and clicked nothing`
    },
  }
}

/** The long range gives way on a phone-sized screen, so the hint and the arrow stay visible. */
const truncationSpec: Spec = {
  name:
    "keyshortcuts: at 360 px a long range truncates, with the hint and the arrow in the trigger",
  pageId: "ui",
  run: async (page) => {
    await page.setViewportSize({ width: 360, height: 800 })
    const trigger = page.locator(`[data-e2e="guide-date-range-shown-key"]`)
    await trigger.scrollIntoViewIfNeeded()
    const drawn = await trigger.evaluate((button) => {
      const box = button.getBoundingClientRect()
      const inside = (element: Element | null) => {
        const part = element?.getBoundingClientRect()
        return part !== undefined && part.width > 0 && part.left >= box.left - 0.5 &&
          part.right <= box.right + 0.5
      }
      const text = button.firstElementChild as HTMLElement
      return {
        cut: text.scrollWidth > text.clientWidth,
        hint: inside(button.querySelector("[data-hotkey-hint]")),
        arrow: inside(button.lastElementChild),
        onScreen: box.right <= innerWidth,
      }
    })
    if (!drawn.cut) throw new Error("the long range is not cut, so the spec proves nothing")
    if (!drawn.hint) throw new Error("the hint is outside the trigger")
    if (!drawn.arrow) throw new Error("the arrow is outside the trigger")
    if (!drawn.onScreen) throw new Error("the trigger runs past the screen")
    return "the text is cut; the hint and the arrow are inside the trigger"
  },
}

/** One axe spec per palette, over the cards that hold the demos. */
function axeSpecs(): Spec[] {
  return (["light", "dark"] as const).map((colorScheme) => ({
    name: `keyshortcuts: the demos with a shown key pass axe (${colorScheme})`,
    pageId: "ui",
    colorScheme,
    run: async (page: Page) => {
      for (const { e2e } of SHOWN_KEYS) await page.locator(`[data-e2e="${e2e}"]`).waitFor()
      const axe = new AxeBuilder({ page })
      for (const { e2e } of SHOWN_KEYS) axe.include(`[data-e2e="${e2e}"]`)
      const { violations, passes } = await axe.analyze()
      if (violations.length > 0) {
        throw new Error(violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`).join("; "))
      }
      if (passes.length === 0) throw new Error("axe checked nothing")
      return `${passes.length} rules passed`
    },
  }))
}

export const specs: readonly Spec[] = [
  ...SHOWN_KEYS.map(pressSpec),
  truncationSpec,
  ...axeSpecs(),
]
