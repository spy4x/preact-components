import { h } from "preact"
import { render as renderToString } from "preact-render-to-string"
import type { Page } from "playwright-core"
import { ScreenTour } from "@spy4x/preact-ui/screen-tour"
import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

/** The guide's browser `ScreenTour`, its tab named `name`, and the panel that tab controls. */
function screenTourStep(page: Page, name: string) {
  const card = page.locator("#demo-ScreenTour")
  const tab = card.getByRole("tablist", { name: "Pages of the app" }).getByRole("tab", {
    name,
    exact: true,
  })
  return {
    card,
    tab,
    /** Waits until this step is the selected one and owns the focus. */
    isSelectedAndFocused: () =>
      tab.and(page.locator(`[aria-selected="true"][tabindex="0"]:focus`)).waitFor(),
  }
}

/**
 * `ScreenTour`: the keyboard, `onSelect`, screenshots that load on first pick, the lightbox, the
 * reduced-motion switch, and a tab row that scrolls inside itself at 390 px. The guide's card clips
 * what overflows it, so the page-width read below only catches a tour that escapes the card.
 */
function screenTourSpecs(): Spec[] {
  return [
    {
      name: "ScreenTour: arrows, Up and Down, Home and End move the selection and the focus, " +
        "wrapping, and show only the selected step's text",
      pageId: "ui",
      run: async (page) => {
        const dashboard = screenTourStep(page, "Dashboard")
        await dashboard.tab.click()
        await dashboard.isSelectedAndFocused()
        const moves: [string, string][] = [
          ["ArrowRight", "Alerts"],
          ["ArrowDown", "Schedules"],
          ["End", "Users"],
          ["ArrowRight", "Dashboard"],
          ["ArrowUp", "Users"],
          ["Home", "Dashboard"],
          ["ArrowLeft", "Users"],
        ]
        for (const [key, name] of moves) {
          await page.keyboard.press(key)
          await screenTourStep(page, name).isSelectedAndFocused()
        }
        const card = dashboard.card
        await card.locator("#guide-tour-users-panel").waitFor({ state: "visible" })
        await card.locator("#guide-tour-alerts-panel").waitFor({ state: "hidden" })
        await card.locator("#guide-tour-dashboard-panel").waitFor({ state: "hidden" })
      },
    },
    {
      name: "ScreenTour: onSelect reports a picked step, and nothing before the first pick",
      pageId: "ui",
      run: async (page) => {
        const alerts = screenTourStep(page, "Alerts")
        const picked = alerts.card.locator(`[data-e2e="screen-tour-picked"]`)
        await picked.getByText("onSelect: not called yet", { exact: true }).waitFor()
        await alerts.tab.click()
        await picked.getByText("onSelect: guide-tour-alerts, 1 call", { exact: true }).waitFor()
      },
    },
    {
      name: "ScreenTour: a click on the selected tab does not call onSelect again",
      pageId: "ui",
      run: async (page) => {
        const alerts = screenTourStep(page, "Alerts")
        const picked = alerts.card.locator(`[data-e2e="screen-tour-picked"]`)
        await alerts.tab.click()
        await picked.getByText("onSelect: guide-tour-alerts, 1 call", { exact: true }).waitFor()
        await alerts.tab.click()
        // A third pick shows the count: 2 calls when the second click on Alerts was not counted.
        await screenTourStep(page, "Schedules").tab.click()
        await picked.getByText(/^onSelect: guide-tour-schedules, \d+ calls$/).waitFor()
        const text = await picked.textContent()
        if (text !== "onSelect: guide-tour-schedules, 2 calls") throw new Error(`read "${text}"`)
      },
    },
    {
      name: "ScreenTour: Tab right after an arrow key lands on the new step's panel, not on the " +
        "fading one",
      pageId: "ui",
      run: async (page) => {
        const dashboard = screenTourStep(page, "Dashboard")
        await dashboard.tab.click()
        await dashboard.isSelectedAndFocused()
        // Both presses in one task, well inside the 150 ms fade.
        await page.keyboard.press("ArrowRight")
        await page.keyboard.press("Tab")
        const panel = dashboard.card.locator("#guide-tour-alerts-panel")
        await panel.and(page.locator(":focus")).waitFor().catch(async () => {
          const focused = await page.evaluate(() => document.activeElement?.id ?? "")
          throw new Error(`focus is on "${focused || "body"}", expected the Alerts panel`)
        })
        // Past the fade, the focus is still there rather than dropped to the page.
        await page.waitForTimeout(400)
        const after = await page.evaluate(() => document.activeElement?.id ?? "")
        if (after !== "guide-tour-alerts-panel") throw new Error(`focus moved to "${after}"`)
      },
    },
    {
      name: "ScreenTour: the server markup shows one step's text where scripts run, and every " +
        "step's text without them",
      pageId: "ui",
      run: async (page) => {
        const sheets = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLLinkElement>(`link[rel="stylesheet"]`)].map((link) =>
            link.href
          )
        )
        if (sheets.length === 0) throw new Error("the guide links no stylesheet")
        const tour = renderToString(h(ScreenTour, {
          frame: "browser",
          steps: ["one", "two", "three"].map((id, index) => ({
            id: `ssr-${id}`,
            label: id,
            text: `Text ${id}. `.repeat(index * 6 + 1),
            image: { src: "data:,", alt: `Screen ${id}`, width: 1280, height: 800 },
          })),
        }))
        const html = `<!doctype html><html><head>${
          sheets.map((href) => `<link rel="stylesheet" href="${href}">`).join("")
        }</head><body style="width: 390px">${tour}</body></html>`
        const browser = page.context().browser()
        if (browser === null) throw new Error("the page has no browser")
        const read = async (javaScriptEnabled: boolean) => {
          // Reduced motion: no fade runs while the stylesheet arrives, so the first read is final.
          const context = await browser.newContext({ javaScriptEnabled, reducedMotion: "reduce" })
          try {
            const bare = await context.newPage()
            await bare.setContent(html, { waitUntil: "load" })
            return await bare.locator(`[role="tabpanel"]`).evaluateAll((panels) => ({
              visible: panels.filter((panel) => getComputedStyle(panel).visibility === "visible")
                .length,
              stack: Math.round(panels[0].parentElement!.getBoundingClientRect().height),
              tallest: Math.round(Math.max(...panels.map((p) => p.getBoundingClientRect().height))),
              // The first step is the selected one in the server markup. Its own lines, not its
              // box: a grid item stretches to the cell, which the tallest panel would set.
              selected: Math.round(
                panels[0].lastElementChild!.getBoundingClientRect().bottom -
                  panels[0].getBoundingClientRect().top,
              ),
            }))
          } finally {
            await context.close()
          }
        }
        const scripted = await read(true)
        const bare = await read(false)
        // Where scripts run, the stack is as tall as the selected step's text alone, so a short
        // step leaves no gap under it (#991).
        if (scripted.visible !== 1 || scripted.stack !== scripted.selected) {
          throw new Error(
            `with scripts: ${JSON.stringify(scripted)}, expected one panel, the stack its height`,
          )
        }
        if (bare.visible !== 3 || bare.stack <= bare.tallest) {
          throw new Error(`without scripts: ${JSON.stringify(bare)}, expected three in a column`)
        }
        return `with scripts ${scripted.stack}px high, without ${bare.stack}px`
      },
    },
    {
      name: "ScreenTour: only the first screenshot is in the page until another step is picked",
      pageId: "ui",
      run: async (page) => {
        const schedules = screenTourStep(page, "Schedules")
        const tour = schedules.card.locator(`[role="tablist"][aria-label="Pages of the app"]`)
          .locator("xpath=..")
        const images = tour.locator("img[data-screen-tour-image]")
        await images.first().waitFor({ state: "attached" })
        const before = await images.evaluateAll((all) =>
          all.map((image) => image.getAttribute("data-screen-tour-image"))
        )
        if (before.join() !== "guide-tour-dashboard") {
          throw new Error(`before a pick the page holds ${before.join(", ")}`)
        }
        await schedules.tab.click()
        await tour.locator(`img[data-screen-tour-image="guide-tour-schedules"]`).waitFor()
        const after = await images.count()
        if (after !== 2) throw new Error(`after one pick the page holds ${after} screenshots`)
        return "1 screenshot, then 2 after picking Schedules"
      },
    },
    {
      name: "ScreenTour: View full size opens the lightbox on the selected screenshot, and Next " +
        "moves the tour along with it",
      pageId: "ui",
      run: async (page) => {
        const alerts = screenTourStep(page, "Alerts")
        await alerts.tab.click()
        const tour = alerts.card.locator(`[role="tablist"][aria-label="Pages of the app"]`)
          .locator("xpath=..")
        await tour.getByRole("link", { name: "View full size", exact: true }).click()
        const dialog = page.locator("dialog[open]")
        await dialog.getByText("The alerts list, newest first", { exact: true }).first().waitFor()
        await dialog.getByRole("button", { name: "Next image", exact: true }).click()
        await dialog.getByText("The schedules calendar", { exact: true }).first().waitFor()
        await page.keyboard.press("Escape")
        await dialog.waitFor({ state: "detached" })
        await screenTourStep(page, "Schedules").tab.and(page.locator(`[aria-selected="true"]`))
          .waitFor()
      },
    },
    ...(["reduce", "no-preference"] as const).map((motion): Spec => ({
      name: `ScreenTour: the screenshots ${
        motion === "reduce" ? "switch at once under reduced motion" : "cross-fade in 150 ms"
      }`,
      pageId: "ui",
      run: async (page) => {
        await page.emulateMedia({ reducedMotion: motion })
        const image = page.locator(`#demo-ScreenTour img[data-screen-tour-image]`).first()
        await image.waitFor()
        const duration = await image.evaluate((node) => getComputedStyle(node).transitionDuration)
        const expected = motion === "reduce" ? "0s" : "0.15s"
        if (duration !== expected) throw new Error(`transition ${duration}, expected ${expected}`)
        return `transition-duration ${duration}`
      },
    })),
    {
      name: "ScreenTour at 390 px: the line above the frame names the selected step's group and " +
        "follows the selection; from 1024 px the column's labels take over and it hides",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        const dashboard = screenTourStep(page, "Dashboard")
        const tour = dashboard.tab.locator("xpath=../..")
        const line = tour.locator("[data-screen-tour-group]")
        await line.scrollIntoViewIfNeeded()
        await line.filter({ hasText: /^Monitor$/ }).waitFor({ state: "visible" })
        await screenTourStep(page, "Schedules").tab.click()
        await line.filter({ hasText: /^Automate$/ }).waitFor({ state: "visible" })
        await page.setViewportSize({ width: 1440, height: 900 })
        await line.waitFor({ state: "hidden" })
      },
    },
    ...([390, 1440] as const).map((width): Spec => ({
      name: `ScreenTour at ${width} px: a step without text leaves no more room above View full ` +
        "size than a step with text does",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width, height: 900 })
        const tour = screenTourStep(page, "Dashboard").tab.locator("xpath=../..")
        const button = tour.locator("[data-screen-tour-full-size]")
        await button.scrollIntoViewIfNeeded()
        /**
         * The space between the selected step's last line and View full size, in px: its lines, not
         * its box, which a grid cell stretches to the tallest panel.
         */
        const space = () =>
          button.evaluate((link) => {
            const panel = link.parentElement!.querySelector(
              `[role="tabpanel"]:not([tabindex="-1"])`,
            )!
            return link.getBoundingClientRect().top -
              panel.lastElementChild!.getBoundingClientRect().bottom
          })
        const withText = await space()
        await screenTourStep(page, "Users").tab.click()
        await tour.locator(`[role="tabpanel"][id="guide-tour-users-panel"]:not([tabindex="-1"])`)
          .waitFor()
        const withoutText = await space()
        if (Math.abs(withoutText - withText) > 0.5) {
          throw new Error(`${withoutText}px above the button without text, ${withText}px with`)
        }
      },
    })),
    {
      name: "ScreenTour in the phone frame: nothing of the notch covers the screenshot's top 40 px",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        const image = page.locator("#demo-ScreenTour").getByRole("tablist", {
          name: "Steps to a clip",
        }).locator("xpath=..").locator("img[data-screen-tour-image]").first()
        await image.scrollIntoViewIfNeeded()
        const covered = await image.evaluate((element) => {
          // Centred, so the guide's sticky header covers none of the image's top.
          element.scrollIntoView({ block: "center" })
          const box = element.getBoundingClientRect()
          const misses: string[] = []
          for (const y of [1, 10, 20, 30, 39]) {
            for (const x of [0.2, 0.5, 0.8]) {
              const hit = document.elementFromPoint(box.left + box.width * x, box.top + y)
              if (hit !== element) misses.push(`${y}px at ${x}: ${hit?.outerHTML.slice(0, 60)}`)
            }
          }
          return misses
        })
        if (covered.length > 0) throw new Error(`covered: ${covered.join("; ")}`)
      },
    },
    {
      name: "ScreenTour in the phone frame at 1440 px: the caption and View full size start at " +
        "the phone's left edge",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        const tour = page.locator("#demo-ScreenTour").getByRole("tablist", {
          name: "Steps to a clip",
        }).locator("xpath=..")
        const image = tour.locator("img[data-screen-tour-image]").first()
        await image.scrollIntoViewIfNeeded()
        const edges = await image.evaluate((element) => {
          const phone = element.closest(`[class*="aspect-"]`)!.getBoundingClientRect()
          const root = element.closest(`[class*="lg:grid-cols"]`)!
          const caption = root.querySelector(`[role="tabpanel"]:not([tabindex="-1"]) p`)!
          const button = root.querySelector("[data-screen-tour-full-size]")!
          return {
            phone: phone.left,
            caption: caption.getBoundingClientRect().left,
            button: button.getBoundingClientRect().left,
          }
        })
        if (
          Math.abs(edges.caption - edges.phone) > 0.5 || Math.abs(edges.button - edges.phone) > 0.5
        ) throw new Error(`left edges: ${JSON.stringify(edges)}`)
      },
    },
    ...(["light", "dark"] as const).map((palette): Spec => ({
      name: `ScreenTour: at 390 px the tabs scroll inside their own row, and axe finds no ` +
        `violation at 390 and 1440 px, ${palette}`,
      pageId: "ui",
      colorScheme: palette,
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        const row = page.locator(`#demo-ScreenTour [role="tablist"]`).first()
        await row.scrollIntoViewIfNeeded()
        // Scrolled by script: a row that only overflows, without scrolling, keeps `scrollLeft` at 0.
        const overflow = await row.evaluate((node) => {
          node.scrollLeft = 40
          const scrolled = node.scrollLeft
          node.scrollLeft = 0
          return {
            scrolled,
            page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          }
        })
        if (overflow.page > 0) throw new Error(`the page scrolls ${overflow.page}px sideways`)
        if (overflow.scrolled <= 0) throw new Error("the tab row does not scroll inside itself")
        await page.addStyleTag({ content: `[data-card-part="demo"] { background-image: none; }` })
        const narrow = await axePasses(page, ["#demo-ScreenTour"])
        // From 1024 px the tabs are a column with the group labels showing.
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.locator(`#demo-ScreenTour [role="tablist"] [role="none"]`).first()
          .waitFor({ state: "visible" })
        return `390 px: ${narrow}; 1440 px: ${await axePasses(page, ["#demo-ScreenTour"])}`
      },
    })),
  ]
}

export const specs: readonly Spec[] = [
  ...screenTourSpecs(),
]
