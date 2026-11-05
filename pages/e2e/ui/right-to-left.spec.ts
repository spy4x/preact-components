import type { Locator, Page } from "playwright-core"
import { Buffer } from "node:buffer"
import type { Spec } from "../runner.ts"
import { kanbanDemo } from "./shared.ts"

/** Lays one demo card out right to left, as an Arabic page would, and returns it. */
async function rightToLeft(page: Page, name: string): Promise<Locator> {
  const card = page.locator(`#demo-${name}`)
  await card.evaluate((element) => element.setAttribute("dir", "rtl"))
  await card.scrollIntoViewIfNeeded()
  return card
}

/** Throws unless `actual` is within a pixel of `expected`. */
function nearly(what: string, actual: number, expected: number): void {
  if (Math.abs(actual - expected) > 1) throw new Error(`${what}: ${actual}, expected ${expected}`)
}

/** The horizontal edges of an element, in viewport pixels. */
async function edges(locator: Locator): Promise<{ left: number; right: number }> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("the element is not drawn")
  return { left: box.x, right: box.x + box.width }
}

/** Where one line of text is drawn, and the box it is drawn in, in viewport pixels. */
interface DrawnLine {
  text: string
  words: { left: number; right: number }
  box: { left: number; right: number }
}

/**
 * Puts `title` and `subtitle` into the long-titled page header of `card`, short enough to fit, and
 * returns where the words of each are drawn inside the line they sit on.
 */
async function headerLines(card: Locator, title: string, subtitle: string): Promise<DrawnLine[]> {
  const heading = card.locator(`[data-e2e="page-header-long-title"]`)
  return await heading.evaluate((element, texts) => {
    const lines = [element.querySelector(`span`), element.parentElement?.querySelector(`p`)]
    return lines.map((line, index) => {
      if (!(line instanceof HTMLElement)) throw new Error(`the header has no line ${index + 1}`)
      line.textContent = texts[index]
      const range = document.createRange()
      range.selectNodeContents(line)
      const words = range.getBoundingClientRect()
      const box = line.getBoundingClientRect()
      if (words.width >= box.width) throw new Error(`"${texts[index]}" fills its line`)
      return {
        text: texts[index],
        words: { left: Math.round(words.left), right: Math.round(words.right) },
        box: { left: Math.round(box.left), right: Math.round(box.right) },
      }
    })
  }, [title, subtitle])
}

/**
 * The `ui` components in a right-to-left page (#876): keys that move along a line follow `dir`,
 * menus and hints open toward the line's end, and a Latin title keeps its start in an Arabic page.
 * Each spec sets `dir="rtl"` on its card only, so the rest of the page stays as the other specs
 * expect it.
 */
function rightToLeftSpecs(): Spec[] {
  return [
    {
      name: "Tabs in a right-to-left page: ArrowLeft moves to the next tab and ArrowRight back",
      pageId: "ui",
      run: async (page) => {
        const card = await rightToLeft(page, "Tabs")
        const tab = (name: string) => card.getByRole("tab", { name, exact: true })
        const selected = (name: string) =>
          tab(name).and(page.locator(`[aria-selected="true"]:focus`)).waitFor()
        await tab("Overview").click()
        await selected("Overview")
        await page.keyboard.press("ArrowLeft")
        await selected("Detail")
        await page.keyboard.press("ArrowRight")
        await selected("Overview")
        return "ArrowLeft → Detail, ArrowRight → Overview"
      },
    },
    {
      name: "Dropdown in a right-to-left page: the menu lines up with the trigger's end, the " +
        "left edge, and a start-aligned one with its right edge",
      pageId: "ui",
      run: async (page) => {
        const card = await rightToLeft(page, "Dropdown")
        const measure = async (label: string) => {
          const trigger = card.getByRole("button", { name: label, exact: true })
          await trigger.click()
          const menu = page.getByRole("menu", { name: label, exact: true })
          await menu.waitFor()
          const result = { trigger: await edges(trigger), menu: await edges(menu) }
          await page.keyboard.press("Escape")
          await menu.waitFor({ state: "hidden" })
          return result
        }
        const end = await measure("Row actions")
        nearly("the end-aligned menu's left edge", end.menu.left, end.trigger.left)
        const start = await measure("Start-anchored actions")
        nearly("the start-aligned menu's right edge", start.menu.right, start.trigger.right)
        return `end: menu left ${end.menu.left}, start: menu right ${start.menu.right}`
      },
    },
    {
      name: "Tooltip in a right-to-left page: an end hint opens to the trigger's left, a start " +
        "hint to its right",
      pageId: "ui",
      run: async (page) => {
        const card = await rightToLeft(page, "Tooltip")
        const placed = async (label: string) => {
          const cell = card.locator(`[data-e2e="tooltip-placement"]`).filter({
            has: page.getByRole("button", { name: label, exact: true }),
          })
          const trigger = cell.getByRole("button", { name: label, exact: true })
          return {
            trigger: await edges(trigger),
            bubble: await edges(cell.locator(`[role="tooltip"] > span`)),
          }
        }
        const end = await placed("end")
        if (end.bubble.right > end.trigger.left) {
          throw new Error(`the end hint ends at ${end.bubble.right}, right of ${end.trigger.left}`)
        }
        const start = await placed("start")
        if (start.bubble.left < start.trigger.right) {
          throw new Error(
            `the start hint starts at ${start.bubble.left}, left of ${start.trigger.right}`,
          )
        }
        const top = await placed("top (default)")
        nearly(
          "the top hint's centre",
          (top.bubble.left + top.bubble.right) / 2,
          (top.trigger.left + top.trigger.right) / 2,
        )
        return `end hint right ${end.bubble.right} ≤ ${end.trigger.left}, start hint left ` +
          `${start.bubble.left} ≥ ${start.trigger.right}`
      },
    },
    {
      name: "PageHeader at 390 px in a right-to-left page: a long Latin title shows its first " +
        "letters and loses its end to the ellipsis",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 })
        const card = await rightToLeft(page, "PageHeader")
        const title = card.locator(`[data-e2e="page-header-long-title"] > span`)
        const result = await title.evaluate((span) => {
          const box = span.getBoundingClientRect()
          const range = document.createRange()
          const text = span.firstChild as Text
          range.setStart(text, 0)
          range.setEnd(text, 1)
          const first = range.getBoundingClientRect()
          return {
            clipped: span.scrollWidth > span.clientWidth,
            first: { left: first.left, right: first.right },
            box: { left: box.left, right: box.right },
          }
        })
        if (!result.clipped) throw new Error("the title fits, so nothing is truncated to check")
        if (result.first.left < result.box.left - 1 || result.first.right > result.box.right + 1) {
          throw new Error(
            `the first letter is at [${result.first.left}, ${result.first.right}], outside the ` +
              `title's box [${result.box.left}, ${result.box.right}]`,
          )
        }
        return `"G" at ${Math.round(result.first.left)}, inside [${Math.round(result.box.left)}, ` +
          `${Math.round(result.box.right)}]`
      },
    },
    {
      name: "PageHeader in a right-to-left page: a short Latin title and subtitle line up with " +
        "the right edge, the page's start",
      pageId: "ui",
      run: async (page) => {
        const card = await rightToLeft(page, "PageHeader")
        const lines = await headerLines(card, "Design team", "Personal")
        for (const line of lines) {
          nearly(`"${line.text}"'s right edge`, line.words.right, line.box.right)
        }
        return lines.map((line) =>
          `"${line.text}" ends at ${line.words.right} of ${line.box.right}`
        )
          .join(", ")
      },
    },
    {
      name: "PageHeader in a left-to-right page: a short Arabic title and subtitle line up with " +
        "the left edge, the page's start",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator(`#demo-PageHeader`)
        await card.scrollIntoViewIfNeeded()
        const lines = await headerLines(card, "فريق التصميم", "شخصي")
        for (const line of lines) {
          nearly(`"${line.text}"'s left edge`, line.words.left, line.box.left)
        }
        return lines.map((line) =>
          `"${line.text}" starts at ${line.words.left} of ${line.box.left}`
        )
          .join(", ")
      },
    },
    {
      name: "ImageGallery strip in a right-to-left page: Next slide scrolls the row toward its " +
        "end, on the left, and the counter follows",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 })
        const card = await rightToLeft(page, "ImageGallery")
        const strip = card.locator(`[data-e2e="gallery-strip-nav"]`)
        const next = strip.getByRole("button", { name: "Next slide", exact: true })
        const previous = strip.getByRole("button", { name: "Previous slide", exact: true })
        const counter = strip.locator("[data-gallery-counter]")
        await previous.and(page.locator(`[aria-disabled="true"]`)).waitFor()
        await next.click()
        await counter.getByText("2 / 5", { exact: true }).waitFor().catch(async () => {
          throw new Error(`after Next slide the counter reads "${await counter.textContent()}"`)
        })
        await previous.and(page.locator(`:not([aria-disabled])`)).waitFor()
        const scrolled = await strip.locator("ul").first().evaluate((row) => row.scrollLeft)
        if (scrolled >= 0) {
          throw new Error(`the row's scrollLeft is ${scrolled}, not toward the left`)
        }
        return `counter 2 / 5, scrollLeft ${Math.round(scrolled)}`
      },
    },
    {
      name: "Lightbox in a right-to-left page: ArrowLeft opens the next image and ArrowRight " +
        "the previous one",
      pageId: "ui",
      run: async (page) => {
        const card = await rightToLeft(page, "ImageGallery")
        const strip = card.locator(`[data-e2e="gallery-strip-nav"]`)
        await strip.getByRole("button", { name: "The sign-in screen" }).first().click()
        const named = (name: string) => page.getByRole("dialog", { name, exact: true }).waitFor()
        await named("The sign-in screen")
        await page.keyboard.press("ArrowLeft")
        await named("The dashboard")
        await page.keyboard.press("ArrowRight")
        await named("The sign-in screen")
        await page.keyboard.press("Escape")
        return "ArrowLeft → The dashboard, ArrowRight → The sign-in screen"
      },
    },
    {
      name: "ToggleSwitch in a right-to-left page: an on switch's knob stays inside its track, " +
        "at the track's end",
      pageId: "ui",
      run: async (page) => {
        const card = await rightToLeft(page, "ToggleSwitch")
        const on = card.locator(`[role="switch"][aria-checked="true"]`).first()
        await on.waitFor()
        const thumb = on.locator("span").first()
        // Turning the card right to left slides the knob over 200 ms: measure where it comes to
        // rest, not a frame of the slide.
        await thumb.evaluate((knob) => Promise.all(knob.getAnimations().map((a) => a.finished)))
        const track = await edges(on)
        const knob = await edges(thumb)
        if (knob.left < track.left - 1 || knob.right > track.right + 1) {
          throw new Error(
            `the knob spans [${knob.left}, ${knob.right}], outside the track [${track.left}, ` +
              `${track.right}]`,
          )
        }
        nearly("the knob's distance from the track's left edge", knob.left - track.left, 2)
        return `knob [${knob.left}, ${knob.right}] in track [${track.left}, ${track.right}]`
      },
    },
    {
      name: "FileInput: a refused file's name is announced inside a bidi isolate, so an Arabic " +
        "message keeps it whole",
      pageId: "ui",
      run: async (page) => {
        await page.locator("#demo-FileInput #guide-file-input").setInputFiles({
          name: "notes.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("notes"),
        })
        const region = page.locator("#guide-file-input-rejection")
        await region.getByText("isn't a file type you can add here").waitFor()
        const text = (await region.textContent()) ?? ""
        if (!text.includes("\u2068notes.txt\u2069")) {
          throw new Error(`the name is not isolated: ${JSON.stringify(text)}`)
        }
        return JSON.stringify(text)
      },
    },
    {
      name: "Slider in a right-to-left page: a mark's tick sits under its value, measured from " +
        "the track's right end, and its label stays inside the card",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 })
        const card = await rightToLeft(page, "Slider")
        const input = await edges(card.locator("#slider-rate"))
        const mark = card.locator("#slider-rate-marks > span").first()
        const tick = await edges(mark.locator("span").first())
        // The mark is at 2 of 0 to 10: a fifth of the way along the thumb's travel.
        const expected = input.right - (10 + (input.right - input.left - 20) * 0.2)
        nearly("the tick's centre", Math.round((tick.left + tick.right) / 2), Math.round(expected))
        const label = await edges(mark)
        const box = await edges(card)
        if (label.left < box.left || label.right > box.right) {
          throw new Error(`the label spans [${label.left}, ${label.right}], outside the card`)
        }
        return `tick at ${Math.round(tick.left)}, expected ${Math.round(expected)}`
      },
    },
    {
      name: "KanbanBoard in a right-to-left page: a lifted card moves to the next column with " +
        "ArrowLeft",
      pageId: "ui",
      run: async (page) => {
        const kanban = await kanbanDemo(page)
        await kanban.card.evaluate((element) => element.setAttribute("dir", "rtl"))
        await kanban.handle("notes").focus()
        await page.keyboard.press(" ")
        await kanban.liveIs("Picked up Write the release notes. To do, position 1 of 3.")
        await page.keyboard.press("ArrowLeft")
        await kanban.card.locator("[data-kanban-live]").getByText(/: Doing, position/).waitFor()
        await page.keyboard.press("Escape")
        return "ArrowLeft → Doing"
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...rightToLeftSpecs(),
]
