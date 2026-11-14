import type { Page } from "playwright-core"
import { AxeBuilder } from "@axe-core/playwright"
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

/** Waits for hydration, then opens the panel from its trigger and waits for focus on the heading. */
async function openHydrated(page: Page) {
  const { trigger } = parts(page)
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "true")
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await waitOpen(page, true)
  await waitFocus(page, "#guide-help-popover-title", "the heading")
}

/**
 * Once hydrated, Tab from the close button reaches the scrolling body, and Tab out of the panel
 * hides it; Shift+Tab from the heading to the trigger hides it too. Focus never sits on a control
 * the open panel covers.
 */
async function tabOutHides(page: Page): Promise<string> {
  await openHydrated(page)
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await waitFocus(page, `#guide-help-popover [role="region"]`, "the scrolling body")
  await page.keyboard.press("Tab")
  await waitOpen(page, false)

  await openHydrated(page)
  await page.keyboard.press("Shift+Tab")
  await waitFocus(page, `button[data-e2e="help-popover-demo"]`, "the trigger")
  await waitOpen(page, false)
  return "Tab out of the body and Shift+Tab to the trigger hide the panel"
}

/**
 * Once hydrated, a click on plain text inside the panel keeps it open, and a mouse click on the
 * visible trigger closes it and leaves it closed.
 */
async function mouseKeepsToggling(page: Page): Promise<string> {
  const { trigger, panel } = parts(page)
  await openHydrated(page)
  const box = await panel.boundingBox()
  if (!box) throw new Error("the open panel has no box")
  // The header's padding: plain, unfocusable surface, so focus leaves for the document body.
  await page.mouse.click(box.x + 6, box.y + 6)
  await page.waitForTimeout(100)
  if (!await panel.evaluate((el) => el.matches(":popover-open"))) {
    throw new Error("a click inside the panel closed it")
  }
  await page.keyboard.press("Escape")
  await waitOpen(page, false)

  await trigger.click()
  await waitOpen(page, true)
  await panel.evaluate((el) => (el as HTMLElement).style.translate = "0 -60vh")
  // Held as a person holds it: the focus that mousedown moves to the trigger settles before the
  // click, which a click in one step would let land first and so hide a reopened panel.
  await trigger.hover()
  await page.mouse.down()
  await page.waitForTimeout(150)
  await page.mouse.up()
  await page.waitForTimeout(100)
  await waitOpen(page, false)
  return "click inside stays open, trigger click closes"
}

/**
 * The open panel with far more text than the screen holds: its body scrolls and axe finds no
 * scrollable region a keyboard cannot reach.
 */
async function longBodyIsReachable(page: Page): Promise<string> {
  await page.setViewportSize({ width: 390, height: 600 })
  const { trigger } = parts(page)
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await waitOpen(page, true)
  const overflows = await page.evaluate(() => {
    const body = document.querySelector(`#guide-help-popover [role="region"]`)
    if (!body?.firstElementChild) throw new Error("the panel has no body region with content")
    for (let i = 0; i < 30; i++) body.append(body.firstElementChild.cloneNode(true))
    return body.scrollHeight > body.clientHeight
  })
  if (!overflows) throw new Error("the long body does not scroll, so the spec proves nothing")
  // Only this rule: the text scrolled out of view has no contrast axe can measure, and the
  // palette specs below already measure it on the short body.
  const { violations } = await new AxeBuilder({ page }).include("#guide-help-popover")
    .withRules(["scrollable-region-focusable"]).analyze()
  if (violations.length > 0) {
    throw new Error(violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`).join("; "))
  }
  return "the scrolling body is reachable by keyboard"
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
  {
    name: "HelpPopover: once hydrated, Tab or Shift+Tab out of the panel hides it",
    pageId: "ui",
    run: tabOutHides,
  },
  {
    name: "HelpPopover: once hydrated, a click inside keeps it open and a trigger click closes it",
    pageId: "ui",
    run: mouseKeepsToggling,
  },
  {
    name:
      "HelpPopover: at 390 px a body longer than the screen scrolls and is reachable by keyboard",
    pageId: "ui",
    run: longBodyIsReachable,
  },
  ...axeSpecs(),
]
