import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

/**
 * `LookTile`, `StoryTile`, `LookGrid`, `SwatchChips` and `OrderBar`: the storefront patterns. The
 * grid's columns follow the width and line up, a lead story spans two columns from 1440 px, the
 * colour choice moves with the arrow keys, the order bar
 * sticks to a phone's screen, the order form submits its choices with JavaScript off, and axe
 * passes in both palettes.
 */
function storefrontSpecs(): Spec[] {
  const cards = [
    "#demo-LookTile",
    "#demo-StoryTile",
    "#demo-LookGrid",
    "#demo-SwatchChips",
    "#demo-OrderBar",
  ] as const
  return [
    {
      name:
        "StoryTile: one link per post, named by its title; the lead fills the width at 390 px and spans two of three columns at 1440 px, level with the post beside it",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-StoryTile")
        const links = card.locator(`[data-e2e="story-tile"] a`)
        if (await links.count() !== 5) throw new Error(`${await links.count()} links in 5 tiles`)
        await card.getByRole("link", { name: "How we choose our fabrics", exact: true }).waitFor()
        const items = card.locator(`[data-e2e="look-grid"] > li`)
        /** The grid's width, and each of the first two posts' left edge, top and width, rounded. */
        const read = () =>
          items.evaluateAll((all) => ({
            grid: Math.round(all[0].parentElement!.getBoundingClientRect().width),
            posts: all.slice(0, 2).map((item) => {
              const box = item.getBoundingClientRect()
              return {
                x: Math.round(box.left),
                y: Math.round(box.top),
                width: Math.round(box.width),
              }
            }),
          }))
        const seen: string[] = []
        for (const width of [390, 1440] as const) {
          await page.setViewportSize({ width, height: 900 })
          await items.first().scrollIntoViewIfNeeded()
          const { grid, posts: [lead, next] } = await read()
          const fits = width === 390
            ? lead.width === grid
            : lead.width > 1.9 * next.width && next.x > lead.x + lead.width && next.y === lead.y
          if (!fits) {
            throw new Error(
              `at ${width} px the lead does not fit: ${JSON.stringify({ grid, lead, next })}`,
            )
          }
          seen.push(`${width}: ${JSON.stringify({ grid, lead, next })}`)
        }
        return seen.join("; ")
      },
    },
    {
      name:
        "LookGrid: one column at 390 px, two at 768 px and three at 1440 px, every look of the first row at the same height",
      pageId: "ui",
      run: async (page) => {
        const items = page.locator(`#demo-LookGrid [data-e2e="look-grid"] > li`)
        /** Each of the first three looks' left edge and top, rounded. */
        const read = () =>
          items.evaluateAll((all) =>
            all.slice(0, 3).map((item) => {
              const box = item.getBoundingClientRect()
              return { x: Math.round(box.left), y: Math.round(box.top) }
            })
          )
        const seen: string[] = []
        for (const [width, columns] of [[390, 1], [768, 2], [1440, 3]] as const) {
          await page.setViewportSize({ width, height: 900 })
          await items.first().scrollIntoViewIfNeeded()
          const looks = await read()
          const lefts = new Set(looks.map((look) => look.x)).size
          if (lefts !== columns) {
            throw new Error(
              `at ${width} px the looks sit in ${lefts} columns: ${JSON.stringify(looks)}`,
            )
          }
          const tops = new Set(looks.slice(0, columns).map((look) => look.y)).size
          if (tops !== 1) {
            throw new Error(
              `at ${width} px the first row's looks start at ${tops} heights: ${
                JSON.stringify(looks)
              }`,
            )
          }
          seen.push(`${width}: ${JSON.stringify(looks)}`)
        }
        return seen.join("; ")
      },
    },
    {
      name:
        "SwatchChips: arrow keys move the checked colour within one tab stop and skip the colour with none left",
      pageId: "ui",
      run: async (page) => {
        const group = page.locator("#demo-SwatchChips").getByRole("group", { name: "Colour" })
        const radio = (name: string, checked: boolean) =>
          group.getByRole("radio", { name, exact: true, checked })
        const focused = page.locator(":focus")
        await radio("Brown", true).focus()
        await page.keyboard.press("ArrowRight")
        await radio("Grey", true).and(focused).waitFor()
        await page.keyboard.press("ArrowRight")
        await radio("Black", true).and(focused).waitFor()
        await page.keyboard.press("ArrowRight")
        await radio("Brown", true).and(focused).waitFor()
        await page.keyboard.press("Tab")
        const left = await group.evaluate((element) => !element.contains(document.activeElement))
        if (!left) throw new Error("Tab stayed inside the group: more than one tab stop")
      },
    },
    {
      name:
        "OrderBar: on a phone it sticks to the bottom of the screen and shows short words; from 1440 px the full words",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-OrderBar")
        const bar = card.locator(`[data-e2e="order-bar"]`)
        const telegram = bar.getByRole("link", { name: "Order on Telegram", exact: true })
        await page.setViewportSize({ width: 390, height: 600 })
        // The card's top at the top of the screen: the bar's own place is below the fold.
        await card.evaluate((element) => element.scrollIntoView({ block: "start" }))
        await page.waitForFunction(() => {
          const bar = document.querySelector(`#demo-OrderBar [data-e2e="order-bar"]`)
          return bar !== null && Math.round(bar.getBoundingClientRect().bottom) === innerHeight
        })
        /** The words the button draws on screen: a screen-reader-only span is 1 px wide. */
        const drawn = () =>
          telegram.evaluate((link) =>
            [...link.children].filter((child) => child.getBoundingClientRect().width > 1)
              .map((child) => child.textContent).join(" ")
          )
        const phone = await drawn()
        if (phone !== "Telegram") throw new Error(`on a phone the button reads "${phone}"`)
        const add = bar.getByRole("button", { name: "Add to list", exact: true })
        const box = await add.boundingBox()
        if (box === null || box.width < 44 || box.height < 44) {
          throw new Error(`"Add to list" is ${box?.width}x${box?.height} px`)
        }
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.waitForFunction(() => innerWidth === 1440)
        const wide = await drawn()
        if (wide !== "Order on Telegram") throw new Error(`at 1440 px the button reads "${wide}"`)
        return `phone "${phone}", wide "${wide}"`
      },
    },
    {
      name:
        "OrderBar: at 390x667 the size chip reached by Tab stops fully above the bar stuck to the bottom of the screen",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 667 })
        const card = page.locator("#demo-OrderBar")
        const bar = card.locator(`[data-e2e="order-bar"]`)
        // `has` is matched inside each label, so it takes a locator from the page, not the card.
        const chip = card.locator("label").filter({
          has: page.getByRole("radio", { name: "M", exact: true, checked: true }),
        })
        // The card's top at the top of the screen (under the guide's header), where the size chips
        // start under the bar. Cards above draw late and push it down, so it is scrolled there
        // again until a scroll no longer moves it.
        await page.waitForFunction(
          () => {
            const card = document.getElementById("demo-OrderBar")
            if (card === null) return false
            const top = card.getBoundingClientRect().top
            card.scrollIntoView({ block: "start", behavior: "instant" })
            return Math.abs(card.getBoundingClientRect().top - top) < 1
          },
          undefined,
          { polling: "raf" },
        )
        const before = await chip.evaluate((label) =>
          Math.round(label.getBoundingClientRect().bottom)
        )
        await card.getByRole("radio", { name: "Brown", exact: true }).focus()
        await page.keyboard.press("Tab")
        const size = card.getByRole("radio", { name: "M", exact: true, checked: true })
        await size.and(page.locator(":focus")).waitFor()
        const read = async () => {
          const [chipBox, barBox] = [await chip.boundingBox(), await bar.boundingBox()]
          if (chipBox === null || barBox === null) {
            throw new Error("the chip or the bar is not drawn")
          }
          return {
            chipTop: Math.round(chipBox.y),
            chipBottom: Math.round(chipBox.y + chipBox.height),
            barTop: Math.round(barBox.y),
          }
        }
        await page.waitForFunction(() => {
          const bar = document.querySelector(`#demo-OrderBar [data-e2e="order-bar"]`)
          return bar !== null && Math.round(bar.getBoundingClientRect().bottom) === innerHeight
        })
        if (before <= (await read()).barTop) throw new Error("the chip did not start under the bar")
        // The guide scrolls smoothly, so the chip is waited for until it is fully above the bar.
        await page.waitForFunction(() => {
          const card = document.getElementById("demo-OrderBar")
          const bar = card?.querySelector(`[data-e2e="order-bar"]`)
          const chip = card?.querySelector(`input[value="M"]`)?.closest("label")
          if (!bar || !chip) return false
          const box = chip.getBoundingClientRect()
          return box.top >= 0 && box.bottom <= bar.getBoundingClientRect().top
        }).catch(async () => {
          throw new Error(`the focused chip stays under the bar: ${JSON.stringify(await read())}`)
        })
        return `chip bottom ${before} before Tab, then ${JSON.stringify(await read())}`
      },
    },
    {
      name:
        "SwatchChips and OrderBar: with JavaScript off, a picked colour and the order button's value are sent with the form",
      pageId: "ui",
      run: async (page) => {
        const browser = page.context().browser()
        if (browser === null) throw new Error("the page has no browser")
        const context = await browser.newContext({ javaScriptEnabled: false })
        try {
          const bare = await context.newPage()
          await bare.goto(page.url(), { waitUntil: "load" })
          const card = bare.locator("#demo-OrderBar")
          // A person clicks the chip; the radio inside it is drawn 1 px wide.
          await card.locator("label").filter({ hasText: "Grey" }).click()
          await card.getByRole("radio", { name: "Grey", exact: true, checked: true }).waitFor()
          await Promise.all([
            bare.waitForURL(/guide-order-colour=grey/),
            card.getByRole("button", { name: "Order on Zalo", exact: true }).click(),
          ])
          const query = new URL(bare.url()).searchParams
          const sent = {
            colour: query.get("guide-order-colour"),
            size: query.get("guide-order-size"),
            via: query.get("via"),
          }
          if (sent.colour !== "grey" || sent.size !== "M" || sent.via !== "zalo") {
            throw new Error(`the form sent ${JSON.stringify(sent)}`)
          }
          return JSON.stringify(sent)
        } finally {
          await context.close()
        }
      },
    },
    ...(["light", "dark"] as const).flatMap((colorScheme): Spec[] =>
      ([390, 1440] as const).map((width): Spec => ({
        name:
          `LookTile, StoryTile, LookGrid, SwatchChips and OrderBar: axe finds no violation, contrast included, ${colorScheme}, ${width} px`,
        pageId: "ui",
        colorScheme,
        run: async (page) => {
          await page.setViewportSize({ width, height: 900 })
          await page.locator(cards[0]).waitFor()
          await page.addStyleTag({ content: `[data-card-part="demo"] { background-image: none; }` })
          return await axePasses(page, cards)
        },
      }))
    ),
  ]
}

export const specs: readonly Spec[] = [
  ...storefrontSpecs(),
]
