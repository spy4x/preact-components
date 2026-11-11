import { AxeBuilder } from "@axe-core/playwright"
import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"

/**
 * The remote `CommandPalette` on its card, opened, once its answer for the empty query is listed.
 * Its pretend server answers a one-letter query in 900 ms, a longer one in 100 ms, and fails
 * "boom"; the card counts the searches started and answered, and shows what was picked.
 *
 * @param page The guide's UI page.
 * @param width The window's width.
 */
async function openRemotePalette(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 800 })
  const card = page.locator("#demo-CommandPalette")
  const dialog = page.locator(`[data-e2e="palette-remote"]`)
  const field = dialog.getByRole("combobox")
  const list = dialog.getByRole("listbox")
  const status = dialog.locator(`[data-e2e="palette-remote-status"]`)
  const counter = (name: string) => card.locator(`[data-e2e="palette-remote-${name}"]`)
  // Attached, not visible: an empty list has no height.
  const idle = list.and(page.locator(":not([aria-busy])"))
  /** Waits until the listed results are exactly these labels, in this order. */
  const resultsAre = (labels: readonly string[]) =>
    page.waitForFunction(
      (wanted) =>
        [...document.querySelectorAll(`[data-e2e="palette-remote"] [role="option"]`)]
          .map((option) => option.querySelector("span span")?.textContent ?? "")
          .join("|") === wanted,
      labels.join("|"),
    )
  /** Waits until the group headings are exactly these, each as "heading:number of rows". */
  const headingsAre = (headings: readonly string[]) =>
    page.waitForFunction(
      (wanted) =>
        [...document.querySelectorAll(`[data-e2e="palette-remote"] [role="group"]`)]
          .map((group) =>
            `${document.getElementById(group.getAttribute("aria-labelledby") ?? "")?.textContent}:${
              group.querySelectorAll(`[role="option"]`).length
            }`
          )
          .join("|") === wanted,
      headings.join("|"),
    )
  await card.locator(`[data-e2e="palette-remote-open"]`).click()
  await field.and(page.locator(":focus")).waitFor()
  await resultsAre(["Apple", "Apricot", "Banana", "Blackberry", "Cherry", "Grape", "Papaya"])
  await idle.waitFor({ state: "attached" })
  return {
    dialog,
    field,
    status,
    idle,
    resultsAre,
    headingsAre,
    /** Waits until the card's counter `name` ("searches", "answered") reads exactly `value`. */
    counterIs: (name: string, value: string) =>
      counter(name).filter({ hasText: new RegExp(`^${value}$`) }).waitFor(),
    /** Reads the card's counter `name`. */
    counter: async (name: string) => await counter(name).textContent() ?? "",
    /** Waits until the status line says `text` where a sighted reader sees it. */
    shows: (text: string) =>
      status.and(page.locator(":not(.sr-only)")).filter({ hasText: text }).waitFor(),
  }
}

/**
 * The forgiving `CommandPalette` on its card: its field trigger, its dialog, and what each of its
 * results says about how it matched.
 */
function forgivingPalette(page: Page) {
  const card = page.locator("#demo-CommandPalette")
  const dialog = page.locator(`dialog[data-e2e="palette-forgiving"]`)
  const field = dialog.getByRole("combobox")
  return {
    card,
    dialog,
    field,
    trigger: card.locator(`[data-e2e="palette-forgiving-open"]`),
    /** Each result's name, its `data-match` and its whole text, in list order. */
    results: () =>
      dialog.getByRole("option").evaluateAll((rows) =>
        rows.map((row) => ({
          name: row.querySelector("span span")?.textContent ?? "",
          match: row.getAttribute("data-match"),
          text: row.textContent ?? "",
        }))
      ),
    /** The field's selection, as `[start, end]`. */
    selection: () =>
      field.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd]),
  }
}

/**
 * Throws unless the first result is `name`, matched by `match`, and shows `words` beside it.
 *
 * @param palette The open palette.
 * @param name The result expected first.
 * @param match Its expected `data-match`.
 * @param words The match's words it should show.
 */
async function firstResultIs(
  palette: ReturnType<typeof forgivingPalette>,
  name: string,
  match: string,
  words: string,
): Promise<void> {
  await palette.dialog.getByRole("option").first().filter({ hasText: name }).waitFor()
  const [first] = await palette.results()
  if (first?.match !== match || !first.text.includes(words)) {
    throw new Error(`the first result is ${JSON.stringify(first)}, not ${name} by ${match}`)
  }
}

/** Specs for `CommandPalette`'s field trigger, `defaultQuery` and forgiving default filter. */
function forgivingPaletteSpecs(): Spec[] {
  return [
    {
      name: "CommandPalette field trigger at 390 px: shows its placeholder, opens on Enter with " +
        "the default query selected, a typo finds Combobox and the other layout finds Toast, " +
        "each saying how it matched, and Enter picks with focus back on the trigger",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 800 })
        const palette = forgivingPalette(page)
        await palette.trigger.getByText("Find a component…", { exact: true }).waitFor()
        await palette.trigger.focus()
        await page.keyboard.press("Enter")
        await palette.dialog.waitFor()
        await palette.field.and(page.locator(":focus")).waitFor()
        const query = await palette.field.inputValue()
        const selected = await palette.selection()
        if (query !== "combobx" || selected.join() !== "0,7") {
          throw new Error(`the field holds "${query}", selected ${selected.join("–")}`)
        }
        await firstResultIs(palette, "Combobox", "typo", "Typo fixed")
        // The selected default query is replaced by the first key typed.
        await page.keyboard.type("ещфые")
        await firstResultIs(palette, "Toast", "layout", "Other keyboard layout")
        const names = (await palette.results()).map((result) => result.name)
        if (names.join() !== "Toast") throw new Error(`"ещфые" lists ${names.join(", ")}`)
        await page.keyboard.press("Enter")
        await palette.dialog.waitFor({ state: "hidden" })
        await palette.card.locator(`[data-e2e="palette-forgiving-picked"]`)
          .getByText("Toast", { exact: true }).waitFor()
        await palette.trigger.and(page.locator(":focus")).waitFor()
      },
    },
    {
      name: "CommandPalette field trigger: a letter typed on it opens the palette with that " +
        "letter, the caret after it, and Escape gives focus back",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 800 })
        const palette = forgivingPalette(page)
        await palette.trigger.focus()
        await page.keyboard.press("m")
        await palette.dialog.waitFor()
        await palette.field.and(page.locator(":focus")).waitFor()
        const query = await palette.field.inputValue()
        const caret = await palette.selection()
        if (query !== "m" || caret.join() !== "1,1") {
          throw new Error(`the field holds "${query}", caret ${caret.join("–")}`)
        }
        await firstResultIs(palette, "Modal", "prefix", "Start of the name")
        await page.keyboard.press("Escape")
        await palette.dialog.waitFor({ state: "hidden" })
        await palette.trigger.and(page.locator(":focus")).waitFor()
      },
    },
    ...(["light", "dark"] as const).flatMap((colorScheme) =>
      [390, 1280].map((width): Spec => ({
        name: `CommandPalette forgiving at ${width} px in the ${colorScheme} palette: axe finds ` +
          "no violation on the field trigger or in the dialog with its match words, colour " +
          "contrast included",
        pageId: "ui",
        colorScheme,
        run: async (page) => {
          await page.setViewportSize({ width, height: 800 })
          const palette = forgivingPalette(page)
          await palette.trigger.scrollIntoViewIfNeeded()
          const scan = async (selector: string) => {
            const { violations } = await new AxeBuilder({ page }).include(selector).analyze()
            if (violations.length > 0) {
              throw new Error(
                violations.map(({ id, nodes }) =>
                  `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`
                ).join(" | "),
              )
            }
          }
          await scan(`[data-e2e="palette-forgiving-open"]`)
          await palette.trigger.click()
          // The highlighted row and a plain one both carry match words: "c" starts Combobox's name
          // and Date picker's alias "calendar".
          await palette.field.fill("c")
          await palette.dialog.getByRole("option").nth(1).waitFor()
          await scan(`dialog[data-e2e="palette-forgiving"]`)
        },
      }))
    ),
  ]
}

/** Specs for the remote data mode of `CommandPalette`, and its rows on a phone. */
function remotePaletteSpecs(): Spec[] {
  return [
    {
      name: "CommandPalette remote: a newer query aborts the stale search's signal, and the " +
        "stale answer changes nothing when it lands after the fresh one",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page)
        const started = Number(await palette.counter("searches"))
        await page.keyboard.type("a")
        // "a" must really start before "p" makes it stale; a debounced query never starts.
        await palette.counterIs("searches", String(started + 1))
        await page.keyboard.type("p")
        await palette.resultsAre(["Apple", "Apricot", "Grape", "Papaya"])
        await palette.counterIs("aborted", "“a”")
        // Every search has answered, the slow, stale one for "a" included.
        await palette.counterIs("answered", String(started + 2))
        await palette.resultsAre(["Apple", "Apricot", "Grape", "Papaya"])
        await palette.headingsAre(["Fruit with A:2", "Fruit with G:1", "Fruit with P:1"])
        await palette.idle.waitFor({ state: "attached" })
      },
    },
    {
      name: "CommandPalette remote: while the next search runs the last results stay listed, " +
        "neither moving nor fading, and only after 300 ms does Searching… show beside the field",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page)
        // Every change to the dialog, timed, from the keystroke to the answer.
        const log = await palette.dialog.evaluateHandle((dialog) => {
          const entries: {
            at: number
            busy: boolean
            searching: boolean
            opacity: number
            rows: number
            status: string
          }[] = []
          new MutationObserver(() => {
            const list = dialog.querySelector(`[role="listbox"]`)
            entries.push({
              at: performance.now(),
              busy: list?.getAttribute("aria-busy") === "true",
              searching: dialog.querySelector(`[data-e2e="palette-remote-searching"]`)
                ?.checkVisibility() ?? false,
              opacity: Math.min(
                ...[...dialog.querySelectorAll(`[role="option"]`)]
                  .map((option) => {
                    let opacity = 1
                    for (let node: Element | null = option; node; node = node.parentElement) {
                      opacity *= Number(getComputedStyle(node).opacity)
                    }
                    return opacity
                  }),
                1,
              ),
              rows: dialog.querySelectorAll(`[role="option"]`).length,
              status: dialog.querySelector(`[role="status"]`)?.textContent ?? "",
            })
          }).observe(dialog, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          })
          return entries
        })
        await page.keyboard.type("a")
        await palette.status.filter({ hasText: "Searching…" }).waitFor({ state: "attached" })
        await palette.idle.waitFor({ state: "attached" })
        const entries = await log.jsonValue()
        const busy = entries.findIndex((entry) => entry.busy)
        const slow = entries.findIndex((entry) => entry.status === "Searching…")
        const answered = entries.findIndex((entry, index) => index > busy && !entry.busy)
        if (busy < 0 || slow < 0 || answered < 0) {
          throw new Error(`busy at ${busy}, Searching… at ${slow}, answered at ${answered}`)
        }
        const first = entries[busy]
        if (first.rows !== 7 || first.status !== "" || first.searching) {
          throw new Error(
            `as the search starts: ${first.rows} rows, status "${first.status}", Searching… ` +
              `shown ${first.searching}`,
          )
        }
        const waited = entries[slow].at - first.at
        // A timer never fires early; the 10 ms are rendering's slack between the two records.
        if (waited < 290) throw new Error(`Searching… came ${Math.round(waited)} ms in`)
        if (entries[slow].rows !== 7 || !entries[slow].searching) {
          throw new Error(
            `with Searching… announced: ${entries[slow].rows} rows, shown beside the field ` +
              `${entries[slow].searching}`,
          )
        }
        const faded = entries.slice(busy, answered).find((entry) => entry.opacity < 1)
        if (faded) throw new Error(`a row faded to opacity ${faded.opacity} while "a" loaded`)
        const blank = entries.slice(busy, answered).find((entry) => entry.rows !== 7)
        if (blank) throw new Error(`the list fell to ${blank.rows} rows while "a" loaded`)
        return `Searching… after ${Math.round(waited)} ms, with the 7 rows kept as they were`
      },
    },
    ...(["light", "dark"] as const).flatMap((colorScheme) =>
      [390, 1280].map((width): Spec => ({
        name: `CommandPalette remote at ${width} px in the ${colorScheme} palette: while a slow ` +
          "search runs over the last results, axe finds no violation in the dialog, colour " +
          "contrast included",
        pageId: "ui",
        colorScheme,
        run: async (page) => {
          const dark = await page.evaluate(() =>
            document.documentElement.classList.contains("dark")
          )
          if (dark !== (colorScheme === "dark")) {
            throw new Error(`the page is drawn ${dark ? "dark" : "light"}, not ${colorScheme}`)
          }
          const palette = await openRemotePalette(page, width)
          // "slow" answers in twenty seconds: the kept rows and Searching… stay for the whole scan.
          await palette.field.fill("slow")
          await palette.dialog.locator(`[data-e2e="palette-remote-searching"]`).waitFor()
          // From `sm` up the seven rows overflow the list's 384 px, so the scan meets a list that
          // scrolls: axe's `scrollable-region-focusable` has a scroll box to judge.
          const scrolls = await palette.dialog.getByRole("listbox").evaluate((list) =>
            list.scrollHeight > list.clientHeight
          )
          if (width >= 640 && !scrolls) throw new Error("the results list does not scroll")
          // Every rule runs, colour contrast included.
          const { violations, passes } = await new AxeBuilder({ page })
            .include(`[data-e2e="palette-remote"]`)
            .analyze()
          if (violations.length > 0) {
            throw new Error(
              violations.map(({ id, nodes }) =>
                `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`
              ).join(" | "),
            )
          }
          const result = `${passes.length} rules pass`
          await palette.dialog.locator(`[data-e2e="palette-remote-searching"]`).waitFor()
          return result
        },
      }))
    ),
    {
      name: "CommandPalette remote: Enter while a search runs waits for its answer and picks its " +
        "first result, not the highlighted row of the previous query",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page)
        const picked = page.locator(`[data-e2e="palette-remote-picked"]`)
        await page.keyboard.type("b")
        await page.keyboard.press("Enter")
        // "b" answers 1.1 s after the keystroke: the palette is still open and nothing is picked.
        const midLoad = await page.evaluate(() => ({
          open: document.querySelector<HTMLDialogElement>(`[data-e2e="palette-remote"]`)?.open,
          picked: document.querySelector(`[data-e2e="palette-remote-picked"]`)?.textContent,
        }))
        if (!midLoad.open || midLoad.picked !== "nothing yet") {
          throw new Error(`right after Enter: open ${midLoad.open}, picked "${midLoad.picked}"`)
        }
        await picked.filter({ hasText: /^Banana$/ }).waitFor()
        await palette.dialog.waitFor({ state: "hidden" })
      },
    },
    {
      name: "CommandPalette remote: typing again after an Enter that waits for a search drops " +
        "that Enter, so the new answer is listed, not picked",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page)
        const picked = page.locator(`[data-e2e="palette-remote-picked"]`)
        await page.keyboard.type("b")
        await page.keyboard.press("Enter")
        await page.keyboard.type("l")
        await palette.resultsAre(["Blackberry"])
        await palette.idle.waitFor({ state: "attached" })
        await palette.field.and(page.locator(":focus")).waitFor()
        const now = await picked.textContent()
        if (now !== "nothing yet") throw new Error(`the answer for "bl" picked "${now}"`)
      },
    },
    {
      name: "CommandPalette remote: closing the palette drops an Enter that waits for a search, " +
        "so opening it again picks nothing",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page)
        const picked = page.locator(`[data-e2e="palette-remote-picked"]`)
        await page.keyboard.type("b")
        await page.keyboard.press("Enter")
        await page.keyboard.press("Escape")
        await palette.dialog.waitFor({ state: "hidden" })
        await page.locator(`[data-e2e="palette-remote-open"]`).click()
        await palette.resultsAre([
          "Apple",
          "Apricot",
          "Banana",
          "Blackberry",
          "Cherry",
          "Grape",
          "Papaya",
        ])
        await palette.idle.waitFor({ state: "attached" })
        const open = await palette.dialog.isVisible()
        const now = await picked.textContent()
        if (!open || now !== "nothing yet") {
          throw new Error(`after reopening: open ${open}, picked "${now}"`)
        }
      },
    },
    {
      name: "CommandPalette remote: a rejected search shows the error, and a query nothing " +
        "matches says so",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page)
        await palette.field.fill("boom")
        await palette.shows("Couldn't search. Try again.")
        await palette.resultsAre([])
        await palette.field.fill("zz")
        await palette.shows("Nothing matches.")
        await palette.idle.waitFor({ state: "attached" })
      },
    },
    {
      name: "CommandPalette at 1280 px: End scrolls the listbox itself, the results' scroll box, " +
        "to the last row while focus stays in the field",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page)
        const list = palette.dialog.getByRole("listbox")
        /** Whether the last row is highlighted and lies inside the list's box, which scrolls. */
        const read = () =>
          list.evaluate((box) => {
            const id = document.querySelector(`[data-e2e="palette-remote"] [role="combobox"]`)
              ?.getAttribute("aria-activedescendant")
            const option = document.getElementById(id ?? "")
            const row = option?.getBoundingClientRect()
            const edge = box.getBoundingClientRect()
            return {
              last: option !== null &&
                option === [...box.querySelectorAll(`[role="option"]`)].at(-1),
              top: box.scrollTop,
              scrolls: box.scrollHeight > box.clientHeight,
              shown: row !== undefined && row.top >= edge.top && row.bottom <= edge.bottom,
            }
          })
        await palette.field.press("End")
        await page.waitForFunction(() => {
          const box = document.querySelector(`[data-e2e="palette-remote"] [role="listbox"]`)
          return box !== null && box.scrollTop > 0
        })
        const end = await read()
        if (!end.last || !end.scrolls || !end.shown) {
          throw new Error(
            `after End: last row highlighted ${end.last}, list scrolls ${end.scrolls}, ` +
              `highlighted row shown ${end.shown}`,
          )
        }
        await palette.field.and(page.locator(":focus")).waitFor()
        return `End scrolled the list to ${Math.round(end.top)} px`
      },
    },
    {
      name: "CommandPalette at 390 px: the close button is a 44 px square, and the field is a " +
        "text combobox, so the browser draws no clear button of its own beside it",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page, 390)
        const close = await palette.dialog.locator(`[data-e2e="palette-remote-close"]`)
          .boundingBox()
        if (close === null || Math.round(close.width) !== 44 || Math.round(close.height) !== 44) {
          throw new Error(`the close button is ${close?.width}×${close?.height} px`)
        }
        const field = await palette.field.evaluate((input) => ({
          type: (input as HTMLInputElement).type,
          inputMode: (input as HTMLInputElement).inputMode,
          enterKeyHint: (input as HTMLInputElement).enterKeyHint,
        }))
        if (
          field.type !== "text" || field.inputMode !== "search" || field.enterKeyHint !== "search"
        ) {
          throw new Error(
            `the field is type ${field.type}, inputmode ${field.inputMode}, enterkeyhint ` +
              field.enterKeyHint,
          )
        }
        await palette.dialog.getByRole("combobox", { name: "Search" }).waitFor()
        return `close button ${close.width}×${close.height} px; field type ${field.type}`
      },
    },
    {
      name: "CommandPalette at 390 px: every result row is at least 44 px tall, a long label " +
        "stops at two lines and a long detail at one",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page, 390)
        // Short names with no detail, and the long one with its long detail.
        await palette.field.fill("e")
        await palette.dialog.getByRole("option").filter({ hasText: "Dragon fruit" }).waitFor()
        await palette.idle.waitFor({ state: "attached" })
        const read = await palette.dialog.evaluate((dialog) => {
          const lines = (element: Element | null) => {
            if (!(element instanceof HTMLElement)) return { lines: 0, clipped: false }
            const height = element.getBoundingClientRect().height
            return {
              lines: Math.round(height / parseFloat(getComputedStyle(element).lineHeight)),
              clipped: element.scrollHeight > element.clientHeight + 1,
            }
          }
          const rows = [...dialog.querySelectorAll(`[role="option"]`)]
          const long = rows.find((row) => row.textContent?.startsWith("Dragon fruit"))
          const texts = long?.querySelectorAll("span span")
          return {
            heights: rows.map((row) => row.getBoundingClientRect().height),
            label: lines(texts?.[0] ?? null),
            detail: lines(texts?.[1] ?? null),
          }
        })
        const short = read.heights.filter((height) => height < 44)
        if (read.heights.length < 2 || short.length > 0) {
          throw new Error(`row heights ${read.heights.join(", ")}`)
        }
        if (read.label.lines !== 2 || !read.label.clipped) {
          throw new Error(`label: ${read.label.lines} lines, clipped ${read.label.clipped}`)
        }
        if (read.detail.lines !== 1 || !read.detail.clipped) {
          throw new Error(`detail: ${read.detail.lines} lines, clipped ${read.detail.clipped}`)
        }
        return `row heights ${read.heights.map(Math.round).join(", ")} px`
      },
    },
    {
      name:
        "CommandPalette: Escape gives focus back to the trigger, or, with the trigger hidden, " +
        "to the element that had focus before it opened, and leaves none in the closed dialog",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 800 })
        const card = page.locator("#demo-CommandPalette")
        const trigger = card.locator(`[data-e2e="palette-local-open"]`)
        const other = card.locator(`[data-e2e="palette-remote-open"]`)
        const dialog = page.locator(`dialog[data-e2e="palette-local"]`)
        const field = dialog.getByRole("combobox")
        const closeWithEscape = async () => {
          await field.and(page.locator(":focus")).waitFor()
          await page.keyboard.press("Escape")
          await dialog.waitFor({ state: "hidden" })
        }

        await trigger.click()
        await closeWithEscape()
        await trigger.and(page.locator(":focus")).waitFor()

        // An app that opens the palette from controls of its own hides the trigger and clicks it,
        // here from a key of its own. Ctrl+F8: Ctrl+K would also open the guide's own search.
        await trigger.evaluate((button) => {
          const hidden = button as HTMLElement
          hidden.style.display = "none"
          document.addEventListener("keydown", (event) => {
            if (event.key !== "F8" || !event.ctrlKey) return
            event.preventDefault()
            hidden.click()
          })
        })
        await other.focus()
        await page.keyboard.press("Control+F8")
        await closeWithEscape()
        await other.and(page.locator(":focus")).waitFor()

        await other.evaluate((button) => (button as HTMLElement).blur())
        await page.keyboard.press("Control+F8")
        await closeWithEscape()
        const focused = await page.evaluate(() => {
          const active = document.activeElement
          return active === document.body ? "body" : active?.outerHTML.slice(0, 80) ?? "none"
        })
        if (focused !== "body") {
          throw new Error(`focus after Escape with nothing before: ${focused}`)
        }
      },
    },
  ]
}

/**
 * The commands `CommandPalette` on its card, opened at `width`: its dialog, its rows by label, its
 * status line and what the card says ran.
 *
 * @param page The guide's UI page.
 * @param width The window's width.
 */
async function openCommandsPalette(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 })
  const card = page.locator("#demo-CommandPalette")
  const dialog = page.locator(`dialog[data-e2e="palette-commands"]`)
  const field = dialog.getByRole("combobox")
  await card.locator(`[data-e2e="palette-commands-open"]`).click()
  await field.and(page.locator(":focus")).waitFor()
  const row = (label: string) => dialog.getByRole("option").filter({ hasText: label })
  return {
    dialog,
    field,
    row,
    status: dialog.locator(`[data-e2e="palette-commands-status"]`),
    ran: card.locator(`[data-e2e="palette-commands-ran"]`),
    /** Waits until the highlighted row is the one labelled `label`. */
    activeIs: (label: string) =>
      page.waitForFunction(
        (wanted) => {
          const dialog = document.querySelector(`dialog[data-e2e="palette-commands"]`)
          const id = dialog?.querySelector(`[role="combobox"]`)?.getAttribute(
            "aria-activedescendant",
          )
          return document.getElementById(id ?? "")?.querySelector("span span")?.textContent ===
            wanted
        },
        label,
      ),
  }
}

/** Specs for command rows: icon, state badge, shortcut, `keepOpen` and `disabledReason`. */
function commandPaletteSpecs(): Spec[] {
  return [
    {
      name: "CommandPalette commands: a row shows its icon, its state badge and its shortcut's " +
        "keys at 1440 px, and at 390 px the keys and the hint beside the badge hide",
      pageId: "ui",
      run: async (page) => {
        const palette = await openCommandsPalette(page, 1440)
        const theme = palette.row("Theme")
        await theme.locator("svg").waitFor()
        await theme.locator(`[id$="-state"]`).filter({ hasText: /^Light$/ }).waitFor()
        await theme.locator("[data-hotkey-hint]").waitFor()
        await theme.getByText("Setting", { exact: true }).waitFor()
        const shortcut = await theme.getAttribute("aria-keyshortcuts")
        if (shortcut !== "Control+Shift+L") throw new Error(`aria-keyshortcuts is ${shortcut}`)
        await page.setViewportSize({ width: 390, height: 800 })
        await theme.locator("[data-hotkey-hint]").waitFor({ state: "hidden" })
        await theme.getByText("Setting", { exact: true }).waitFor({ state: "hidden" })
        await theme.locator(`[id$="-state"]`).filter({ hasText: /^Light$/ }).waitFor()
        await theme.locator("svg").waitFor()
      },
    },
    {
      name: "CommandPalette commands: Enter on a kept-open toggle runs it, changes its badge in " +
        "place with the palette open and the row still highlighted, and announces the new state",
      pageId: "ui",
      run: async (page) => {
        const palette = await openCommandsPalette(page, 1440)
        const badge = palette.row("Theme").locator(`[id$="-state"]`)
        await palette.activeIs("Theme")
        await page.keyboard.press("Enter")
        await badge.filter({ hasText: /^Dark$/ }).waitFor()
        await palette.status.filter({ hasText: /^Theme: Dark$/ }).waitFor({ state: "attached" })
        await palette.field.and(page.locator(":focus")).waitFor()
        await palette.activeIs("Theme")
        await page.keyboard.press("Enter")
        await badge.filter({ hasText: /^Light$/ }).waitFor()
        await palette.status.filter({ hasText: /^Theme: Light$/ }).waitFor({ state: "attached" })
        if (!await palette.dialog.isVisible()) throw new Error("the toggle closed the palette")
        const ran = await palette.ran.textContent()
        if (ran !== "nothing yet") throw new Error(`the toggle also picked: ${ran}`)
      },
    },
    {
      name: "CommandPalette commands: a disabled row shows its reason, the arrow keys stop on " +
        "it, hovering does not light it, and Enter or a click runs nothing, keeps the palette " +
        "open with focus in the field and says the reason; Enter on a plain command runs it " +
        "and closes",
      pageId: "ui",
      run: async (page) => {
        const palette = await openCommandsPalette(page, 1440)
        const sync = palette.row("Sync now")
        await sync.and(page.locator(`[aria-disabled="true"]`)).waitFor()
        await sync.getByText("Needs a connection", { exact: true }).waitFor()
        await page.keyboard.press("ArrowDown")
        await page.keyboard.press("ArrowDown")
        await palette.activeIs("Sync now")
        await page.keyboard.press("Enter")
        await palette.status.filter({ hasText: /^Needs a connection$/ }).waitFor({
          state: "attached",
        })
        await page.keyboard.press("ArrowUp")
        await palette.activeIs("New note")
        await sync.hover()
        const background = await sync.evaluate((row) => getComputedStyle(row).backgroundColor)
        if (background !== "rgba(0, 0, 0, 0)") {
          throw new Error(`the hovered disabled row is lit: ${background}`)
        }
        // Playwright will not click an `aria-disabled` element on its own; a person still can.
        await sync.click({ force: true })
        if (!await palette.dialog.isVisible()) throw new Error("a disabled row closed the palette")
        await palette.field.and(page.locator(":focus")).waitFor()
        const ran = await palette.ran.textContent()
        if (ran !== "nothing yet") throw new Error(`a disabled row ran: ${ran}`)
        await page.keyboard.press("Enter")
        await palette.dialog.waitFor({ state: "hidden" })
        await palette.ran.filter({ hasText: /^New note$/ }).waitFor()
      },
    },
    ...(["light", "dark"] as const).flatMap((colorScheme) =>
      [390, 1440].map((width): Spec => ({
        name: `CommandPalette commands at ${width} px in the ${colorScheme} palette: axe finds ` +
          "no violation in the dialog with icons, a state badge, keys and a disabled row, colour " +
          "contrast included",
        pageId: "ui",
        colorScheme,
        run: async (page) => {
          const palette = await openCommandsPalette(page, width)
          await palette.row("Sign out").waitFor()
          const { violations, passes } = await new AxeBuilder({ page })
            .include(`dialog[data-e2e="palette-commands"]`)
            .analyze()
          if (violations.length > 0) {
            throw new Error(
              violations.map(({ id, nodes }) =>
                `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`
              ).join(" | "),
            )
          }
          return `${passes.length} rules pass`
        },
      }))
    ),
  ]
}

/**
 * Throws when axe finds a violation in the commands palette's dialog, as it stands now.
 *
 * @param page The guide's UI page.
 */
async function noViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .include(`dialog[data-e2e="palette-commands"]`)
    .analyze()
  if (violations.length > 0) {
    throw new Error(
      violations.map(({ id, nodes }) =>
        `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`
      ).join(" | "),
    )
  }
}

/** Specs for the palette's keys: the alternative pick, groups, submenus, text rows and ">". */
function paletteKeySpecs(): Spec[] {
  return [
    {
      name: "CommandPalette keys: Ctrl+Enter, a middle click and a Ctrl+click each pick a row " +
        "the alternative way and close the palette",
      pageId: "ui",
      run: async (page) => {
        let palette = await openCommandsPalette(page, 1440)
        await page.keyboard.type("sign out")
        await palette.activeIs("Sign out")
        await page.keyboard.press("Control+Enter")
        await palette.dialog.waitFor({ state: "hidden" })
        await palette.ran.filter({ hasText: /^Sign out \(alternative\)$/ }).waitFor()
        palette = await openCommandsPalette(page, 1440)
        await palette.row("New note").click({ button: "middle" })
        await palette.dialog.waitFor({ state: "hidden" })
        await palette.ran.filter({ hasText: /^New note \(alternative\)$/ }).waitFor()
        palette = await openCommandsPalette(page, 1440)
        await palette.row("Sign out").click({ modifiers: ["ControlOrMeta"] })
        await palette.dialog.waitFor({ state: "hidden" })
        await palette.ran.filter({ hasText: /^Sign out \(alternative\)$/ }).waitFor()
      },
    },
    {
      name: "CommandPalette keys: PageDown and PageUp move the highlight to the first row of " +
        "the next and the previous group, and stop at the first and the last group",
      pageId: "ui",
      run: async (page) => {
        const palette = await openCommandsPalette(page, 1440)
        await palette.activeIs("Theme")
        await page.keyboard.press("PageUp")
        // Had PageUp wrapped round to the last group, PageDown would stay there.
        await page.keyboard.press("PageDown")
        await palette.activeIs("New note")
        await page.keyboard.press("ArrowDown")
        await palette.activeIs("Sync now")
        await page.keyboard.press("PageDown")
        await palette.activeIs("Add a task")
        await page.keyboard.press("PageDown")
        // Had PageDown wrapped round to the first group, PageUp would stay there.
        await page.keyboard.press("PageUp")
        await palette.activeIs("New note")
        await page.keyboard.press("PageUp")
        await palette.activeIs("Theme")
        await palette.field.and(page.locator(":focus")).waitFor()
      },
    },
    {
      name: "CommandPalette keys: Tab on a text row puts its label before the empty field and " +
        "lists that row alone with the typed text; Enter with nothing typed does nothing, " +
        "Backspace in the empty field goes back, and Enter passes the text; axe finds no " +
        "violation in the text mode",
      pageId: "ui",
      run: async (page) => {
        const palette = await openCommandsPalette(page, 1440)
        const path = palette.dialog.locator(`[data-e2e="palette-commands-path"]`)
        await page.keyboard.type("add a")
        await palette.activeIs("Add a task")
        await page.keyboard.press("Tab")
        await path.filter({ hasText: /^Add a task$/ }).waitFor()
        await palette.dialog.getByRole("combobox", { name: "Add a task" }).waitFor()
        await palette.field.and(page.locator(":focus")).waitFor()
        await page.keyboard.press("Enter")
        await page.keyboard.type("buy milk")
        await palette.row("Add a task: “buy milk”").waitFor()
        const rows = await palette.dialog.getByRole("option").count()
        if (rows !== 1) throw new Error(`the text mode lists ${rows} rows`)
        if (!await palette.dialog.isVisible()) throw new Error("Enter with no text closed it")
        const ran = await palette.ran.textContent()
        if (ran !== "nothing yet") throw new Error(`Enter with no text picked: ${ran}`)
        await noViolations(page)
        for (let typed = 0; typed < "buy milk".length; typed++) {
          await page.keyboard.press("Backspace")
        }
        await page.keyboard.press("Backspace")
        await path.waitFor({ state: "detached" })
        const query = await palette.field.inputValue()
        if (query !== "add a") throw new Error(`back at the top the field holds "${query}"`)
        await palette.activeIs("Add a task")
        await page.keyboard.press("Enter")
        await path.waitFor()
        await page.keyboard.type("  buy milk ")
        await page.keyboard.press("Enter")
        await palette.dialog.waitFor({ state: "hidden" })
        await palette.ran.filter({ hasText: /^Add a task: “buy milk”$/ }).waitFor()
      },
    },
    {
      name: "CommandPalette keys: Tab or Enter on a row with children lists them under a path, " +
        "filtered by the query, two levels deep; Backspace in the empty field goes back a " +
        "level with the parent row highlighted; the back button and a click work too; a child " +
        "is picked; axe finds no violation in a submenu",
      pageId: "ui",
      run: async (page) => {
        let palette = await openCommandsPalette(page, 1440)
        const path = palette.dialog.locator(`[data-e2e="palette-commands-path"]`)
        const labels = () =>
          palette.dialog.getByRole("option").evaluateAll((rows) =>
            rows.map((row) => row.querySelector("span span")?.textContent).join("|")
          )
        const account = palette.dialog.getByRole("option", { name: "Account", exact: true })
        // Account is the seventh row, so going back can only highlight it on purpose.
        await page.keyboard.press("PageDown")
        await page.keyboard.press("PageDown")
        await page.keyboard.press("ArrowDown")
        await palette.activeIs("Account")
        await page.keyboard.press("Tab")
        await path.filter({ hasText: /^Account$/ }).waitFor()
        await palette.row("Billing").waitFor()
        const children = await labels()
        if (children !== "Profile|Billing|Security") throw new Error(`children: ${children}`)
        await noViolations(page)
        await page.keyboard.type("sec")
        await palette.activeIs("Security")
        await page.keyboard.press("Enter")
        await path.filter({ hasText: /^Account › Security$/ }).waitFor()
        await palette.row("Two-step sign-in").waitFor()
        await page.keyboard.press("Backspace")
        await path.filter({ hasText: /^Account$/ }).waitFor()
        const query = await palette.field.inputValue()
        if (query !== "sec") throw new Error(`back in Account the field holds "${query}"`)
        for (let typed = 0; typed < "sec".length; typed++) await page.keyboard.press("Backspace")
        await palette.row("Profile").waitFor()
        await page.keyboard.press("ArrowDown")
        await page.keyboard.press("ArrowDown")
        await palette.activeIs("Security")
        await page.keyboard.press("Enter")
        await path.filter({ hasText: /^Account › Security$/ }).waitFor()
        await page.keyboard.press("Backspace")
        await path.filter({ hasText: /^Account$/ }).waitFor()
        await palette.activeIs("Security")
        await page.keyboard.press("Backspace")
        await path.waitFor({ state: "detached" })
        await palette.activeIs("Account")
        await account.click()
        await path.filter({ hasText: /^Account$/ }).waitFor()
        await palette.dialog.locator(`[data-e2e="palette-commands-back"]`).click()
        await path.waitFor({ state: "detached" })
        await palette.field.and(page.locator(":focus")).waitFor()
        await palette.activeIs("Account")
        await page.keyboard.press("Tab")
        await palette.row("Profile").waitFor()
        await page.keyboard.press("Escape")
        await palette.dialog.waitFor({ state: "hidden" })
        palette = await openCommandsPalette(page, 1440)
        await path.waitFor({ state: "detached" })
        await page.keyboard.type("acc")
        await page.keyboard.press("Enter")
        await page.keyboard.press("Enter")
        await palette.dialog.waitFor({ state: "hidden" })
        await palette.ran.filter({ hasText: /^Profile$/ }).waitFor()
      },
    },
    {
      name: "CommandPalette keys: Tab on a row with neither children nor text leaves the field " +
        "for the next control",
      pageId: "ui",
      run: async (page) => {
        const palette = await openCommandsPalette(page, 1440)
        await palette.activeIs("Theme")
        await page.keyboard.press("Tab")
        await palette.dialog.locator(`[data-e2e="palette-commands-close"]:focus`).waitFor()
      },
    },
    {
      name: 'CommandPalette keys: the empty field hints at ">", which lists only the ' +
        "commands, filtered by the rest of the query",
      pageId: "ui",
      run: async (page) => {
        const palette = await openCommandsPalette(page, 1440)
        const hint = palette.dialog.getByText("> for commands", { exact: true })
        await hint.waitFor()
        const described = await palette.field.getAttribute("aria-describedby")
        if (described !== await hint.getAttribute("id")) {
          throw new Error(`the field is described by ${described}`)
        }
        const account = palette.dialog.getByRole("option", { name: "Account", exact: true })
        await account.waitFor()
        await page.keyboard.type(">")
        await hint.waitFor({ state: "detached" })
        await account.waitFor({ state: "detached" })
        const rows = await palette.dialog.getByRole("option").evaluateAll((rows) =>
          rows.map((row) => row.querySelector("span span")?.textContent).join("|")
        )
        if (rows !== "Theme|New note|Sync now|Sign out|Jump to the log") {
          throw new Error(`">" lists ${rows}`)
        }
        await page.keyboard.type(" sign")
        await palette.row("New note").waitFor({ state: "detached" })
        await palette.activeIs("Sign out")
        const count = await palette.dialog.getByRole("option").count()
        if (count !== 1) throw new Error(`"> sign" lists ${count} rows`)
      },
    },
    {
      name: "CommandPalette keys: a command that moves focus elsewhere keeps it there once the " +
        "palette has closed, rather than focus going back to the trigger",
      pageId: "ui",
      run: async (page) => {
        const palette = await openCommandsPalette(page, 1440)
        await page.keyboard.type("jump")
        await palette.activeIs("Jump to the log")
        // Marks the dialog once its `close` event, where the palette restores focus, has run.
        await palette.dialog.evaluate((dialog) =>
          dialog.addEventListener(
            "close",
            () => setTimeout(() => dialog.setAttribute("data-close-ran", "")),
            { once: true },
          )
        )
        await page.keyboard.press("Enter")
        await palette.dialog.and(page.locator("[data-close-ran]")).waitFor({ state: "attached" })
        await page.locator(`[data-e2e="palette-commands-ran"]:focus`).waitFor()
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...remotePaletteSpecs(),
  ...forgivingPaletteSpecs(),
  ...commandPaletteSpecs(),
  ...paletteKeySpecs(),
]
