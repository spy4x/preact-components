import type { Page } from "playwright-core"
import { axeCleanIn } from "../axe-clean.ts"
import type { Spec } from "../runner.ts"

/** The `HelpPopover` card's trigger and panel, by the `data-e2e` the guide demo gives them. */
function parts(page: Page) {
  return {
    trigger: page.locator(`button[data-e2e="help-popover-demo"]`),
    panel: page.locator(`[data-e2e="help-popover-demo-panel"]`),
    heading: page.locator(`#guide-help-popover-title`),
    close: page.locator(`[data-e2e="help-popover-demo-panel"] button[popovertargetaction="hide"]`),
  }
}

/** Waits until the panel is open (`open`) or closed, by the platform's own `:popover-open`. */
async function waitOpen(page: Page, open: boolean) {
  await page.waitForFunction(
    (want) => document.querySelector(`#guide-help-popover`)?.matches(":popover-open") === want,
    open,
  )
}

/** Waits until the element matching `selector` has focus, and throws naming what has it instead. */
async function waitFocus(page: Page, selector: string, what: string) {
  const ok = await page.waitForFunction(
    (wanted) => document.activeElement?.matches(wanted) === true,
    selector,
    { timeout: 5_000 },
  ).then(() => true, () => false)
  if (!ok) {
    const actual = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120))
    throw new Error(`${what} does not have focus; ${actual} does`)
  }
}

/**
 * Opens and closes the panel every way a person can, in a page that may have no script at all:
 * the trigger opens it and moves focus to its heading, Tab reaches the close button, Escape
 * closes it and returns focus to the trigger, the close button closes it, and a click outside
 * closes it.
 */
async function openAndCloseEveryWay(page: Page): Promise<string> {
  const { trigger, panel, close } = parts(page)
  await trigger.scrollIntoViewIfNeeded()

  await trigger.click()
  await waitOpen(page, true)
  await waitFocus(page, "#guide-help-popover-title", "the heading")
  await page.keyboard.press("Tab")
  await waitFocus(page, `#guide-help-popover button[popovertargetaction="hide"]`, "close button")

  await page.keyboard.press("Escape")
  await waitOpen(page, false)
  await waitFocus(page, `button[data-e2e="help-popover-demo"]`, "the trigger")

  await trigger.click()
  await waitOpen(page, true)
  await close.click()
  await waitOpen(page, false)

  await trigger.click()
  await waitOpen(page, true)
  await page.mouse.click(4, 4)
  await waitOpen(page, false)
  await panel.waitFor({ state: "hidden" })
  return "trigger, Tab, Escape, close button and click outside"
}

/** Throws when the open panel is wider than the viewport less 16 px each side, or sits outside. */
async function fitsTheViewport(page: Page): Promise<string> {
  const { trigger, panel } = parts(page)
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await waitOpen(page, true)
  const box = await panel.boundingBox()
  const width = page.viewportSize()?.width ?? 0
  if (!box || box.x < 16 || box.x + box.width > width - 16 + 0.5) {
    throw new Error(`panel at ${JSON.stringify(box)} in a ${width} px viewport`)
  }
  return `${Math.round(box.width)} px wide in ${width} px`
}

/** Opens the guide page again in a context of its own with scripts off, at `width`. */
async function withoutScripts<T>(
  page: Page,
  width: number,
  run: (bare: Page) => Promise<T>,
): Promise<T> {
  const browser = page.context().browser()
  if (browser === null) throw new Error("the spec's page has no browser to open a context in")
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width, height: 844 },
  })
  try {
    const bare = await context.newPage()
    await bare.goto(page.url())
    if (await bare.evaluate(() => document.documentElement.dataset.hydrated === "true")) {
      throw new Error("the page hydrated with scripts off")
    }
    return await run(bare)
  } finally {
    await context.close()
  }
}

/** One axe spec per palette: the card with the panel closed, then the open panel. */
function axeSpecs(): Spec[] {
  return (["light", "dark"] as const).map((colorScheme) => ({
    name:
      `HelpPopover: the card and the open panel have no axe violation in the ${colorScheme} palette`,
    pageId: "ui",
    colorScheme,
    run: async (page: Page) => {
      const { trigger } = parts(page)
      await trigger.scrollIntoViewIfNeeded()
      const card = await axeCleanIn(page, "#demo-HelpPopover")
      await trigger.click()
      await waitOpen(page, true)
      // axe orders what is under a point by z-index and knows nothing of the top layer, so the
      // guide's cards beneath the open panel read as covering part of its text, and it cannot
      // decide that text's contrast. The page is hidden from it, still laid out; the panel and
      // its own background are measured as drawn.
      await page.addStyleTag({
        content: `body * { visibility: hidden !important; } ` +
          `#guide-help-popover, #guide-help-popover * { visibility: visible !important; }`,
      })
      const panel = await axeCleanIn(page, "#guide-help-popover")
      return `panel ${panel}, card ${card}`
    },
  }))
}

export const specs: readonly Spec[] = [
  {
    name: "HelpPopover: without JavaScript the trigger opens it, and Escape, the close button " +
      "and a click outside close it, with focus moved in and back",
    pageId: "ui",
    run: (page) => withoutScripts(page, 1440, openAndCloseEveryWay),
  },
  {
    name: "HelpPopover: once hydrated it opens and closes the same way",
    pageId: "ui",
    run: openAndCloseEveryWay,
  },
  {
    name: "HelpPopover: at 390 px without JavaScript the open panel fits inside the screen",
    pageId: "ui",
    run: (page) => withoutScripts(page, 390, fitsTheViewport),
  },
  ...axeSpecs(),
]
