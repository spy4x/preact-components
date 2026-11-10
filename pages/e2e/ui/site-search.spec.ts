import { AxeBuilder } from "@axe-core/playwright"
import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { siteSearchDemoEntries } from "../../../ui-guide/sections/site-search-entries.ts"

/** The pretend site's index, as `pages/build.ts` writes it. */
const INDEX = "**/site-search-demo/search.json"

/**
 * The field `SiteSearch` on its card: its trigger, its dialog, and the note that shows what
 * `onSearched` heard.
 *
 * @param page The guide's UI page.
 */
function siteSearch(page: Page) {
  const card = page.locator("#demo-SiteSearch")
  const dialog = page.locator(`dialog[data-e2e="site-search"]`)
  const note = (name: string) => card.locator(`[data-e2e="site-search-${name}"]`)
  return {
    card,
    dialog,
    field: dialog.getByRole("combobox"),
    trigger: card.locator(`[data-e2e="site-search-open"]`),
    options: dialog.getByRole("option"),
    /** Waits until the status line shows `text` where a sighted reader sees it. */
    shows: (text: string) =>
      dialog.locator(`[data-e2e="site-search-status"]:not(.sr-only)`).filter({ hasText: text })
        .waitFor(),
    /** Waits until `onSearched` has been called exactly `count` times. */
    sessionsAre: (count: number) =>
      note("sessions").filter({ hasText: new RegExp(`^${count}$`) }).waitFor(),
    /** The last `onSearched` event. */
    last: async () => JSON.parse(await note("last").textContent() ?? "null"),
  }
}

/** Throws with every violation axe finds inside `selector`. */
async function scan(page: Page, selector: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).include(selector).analyze()
  if (violations.length > 0) {
    throw new Error(
      violations.map(({ id, nodes }) =>
        `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`
      ).join(" | "),
    )
  }
}

export const specs: readonly Spec[] = [
  {
    name: "SiteSearch: a 500 from the index shows the error, and the next keystroke fetches it " +
      "again and lists results",
    pageId: "ui",
    run: async (page) => {
      let failing = true
      let requests = 0
      await page.route(INDEX, (route) => {
        requests++
        return failing ? route.fulfill({ status: 500, body: "down" }) : route.continue()
      })
      const search = siteSearch(page)
      await search.trigger.click()
      await search.field.and(page.locator(":focus")).waitFor()
      await page.keyboard.type("p")
      await search.shows("Search couldn't load. Check your connection and type again.")
      const failed = requests
      failing = false
      await page.keyboard.type("alette")
      await search.options.filter({ hasText: "Command palette" }).waitFor()
      if (requests <= failed) throw new Error(`no fetch after the failure: ${requests} in all`)
      return `${failed} failed fetches, then ${requests - failed} more`
    },
  },
  {
    name: "SiteSearch never lists an entry whose link is javascript:, and lists a mailto: one",
    pageId: "ui",
    run: async (page) => {
      const search = siteSearch(page)
      await search.trigger.click()
      await search.field.fill("contact")
      await search.options.filter({ hasText: "Email the maintainer" }).waitFor()
      await search.field.fill("tricky")
      await search.shows("Nothing for “tricky”")
      const listed = await search.options.count()
      if (listed !== 0) throw new Error(`"tricky" lists ${listed} rows`)
    },
  },
  {
    name: "SiteSearch: onSearched fires once per session with the chosen position, and a heading " +
      "on the page that a result names takes focus",
    pageId: "ui",
    run: async (page) => {
      const search = siteSearch(page)
      await search.trigger.click()
      await search.field.fill("search")
      await search.options.nth(1).waitFor()
      const rows = await search.options.count()
      const second = (await search.options.nth(1).locator("span span").first().textContent())
        ?.trim()
      const href = siteSearchDemoEntries.find((entry) => entry.label === second)?.href
      if (href === undefined) throw new Error(`the second row, "${second}", is no demo entry`)
      await page.keyboard.press("ArrowDown")
      await page.keyboard.press("Enter")
      await search.dialog.waitFor({ state: "hidden" })
      await page.locator(`${href}:focus`).waitFor()
      await search.sessionsAre(1)
      const chosen = await search.last()
      const wanted = { query: "search", results: rows, chosenPosition: 2, chosenKind: "result" }
      if (JSON.stringify(chosen) !== JSON.stringify(wanted)) {
        throw new Error(`onSearched heard ${JSON.stringify(chosen)}`)
      }
      // A second session closed without a choice: one more call, so the first was not repeated.
      await search.trigger.click()
      await search.field.and(page.locator(":focus")).waitFor()
      await page.keyboard.press("Escape")
      await search.dialog.waitFor({ state: "hidden" })
      await search.sessionsAre(2)
      const closed = await search.last()
      if (JSON.stringify(closed) !== JSON.stringify({ query: "", results: 1 })) {
        throw new Error(`the closed session reported ${JSON.stringify(closed)}`)
      }
      return JSON.stringify(chosen)
    },
  },
  {
    name: "SiteSearch: Ctrl+Enter opens the highlighted result in a new tab",
    pageId: "ui",
    run: async (page) => {
      const search = siteSearch(page)
      await search.trigger.click()
      await search.field.fill("timeline")
      await search.options.filter({ hasText: "Timeline" }).waitFor()
      const [opened] = await Promise.all([
        page.context().waitForEvent("page"),
        page.keyboard.press("Control+Enter"),
      ])
      try {
        await opened.waitForURL(/#demo-Timeline$/)
      } finally {
        await opened.close()
      }
    },
  },
  {
    name: "SiteSearch: with JavaScript off, the trigger is a link to /search?q=",
    pageId: "ui",
    run: async (page) => {
      const browser = page.context().browser()
      if (browser === null) throw new Error("the page has no browser")
      const context = await browser.newContext({ javaScriptEnabled: false })
      try {
        const bare = await context.newPage()
        await bare.goto(page.url(), { waitUntil: "load" })
        const link = bare.locator(`#demo-SiteSearch a[data-e2e="site-search-open"]`)
        const href = await link.getAttribute("href")
        if (href !== "/search?q=") throw new Error(`the trigger links to ${href}`)
        await link.getByText("Search the guide…").waitFor()
      } finally {
        await context.close()
      }
    },
  },
  ...(["light", "dark"] as const).map((colorScheme): Spec => ({
    name: `SiteSearch in the ${colorScheme} palette: axe finds no violation on either trigger or ` +
      "in the dialog with results, colour contrast included",
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      const search = siteSearch(page)
      await search.trigger.scrollIntoViewIfNeeded()
      await scan(page, "#demo-SiteSearch")
      await search.trigger.click()
      await search.field.fill("keys")
      await search.options.first().waitFor()
      await scan(page, `dialog[data-e2e="site-search"]`)
    },
  })),
]
