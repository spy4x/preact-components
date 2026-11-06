import { AxeBuilder } from "@axe-core/playwright"
import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"

/** The parts of the first `QuickAdd` on its guide card, and the line that lists what it added. */
function quickAdd(page: Page) {
  const card = page.locator("#demo-QuickAdd")
  const part = (name: string) => card.locator(`[data-e2e="quick-add${name}"]`)
  return {
    card,
    form: part(""),
    input: part("-input"),
    submit: part("-submit"),
    chips: part("-chips"),
    live: part("-live"),
    /** The message a person sees, which assistive technology must be able to read too. */
    notice: card.locator(`[data-e2e="quick-add"] p[id$="-notice"]:not([aria-hidden])`),
    added: part("-added"),
    busy: part("-busy"),
  }
}

/** Throws unless the element's text is exactly `text` now; for a state already waited for. */
async function textIs(locator: Locator, text: string): Promise<void> {
  const found = await locator.textContent()
  if (found !== text) throw new Error(`expected "${text}", found "${found}"`)
}

/**
 * Records every text the live region holds from now on, so an announcement cannot come and go
 * unseen. Empty text is left out: a screen reader has nothing to say for it.
 *
 * @returns A function that reads what was recorded so far, in order.
 */
async function recordSpoken(page: Page, live: Locator): Promise<() => Promise<string[]>> {
  await live.evaluate((region) => {
    const spoken: string[] = []
    Object.assign(globalThis, { quickAddSpoken: spoken })
    new MutationObserver(() => {
      if (region.textContent) spoken.push(region.textContent)
    }).observe(region, { childList: true, characterData: true, subtree: true })
  })
  return () =>
    page.evaluate(() => (globalThis as unknown as { quickAddSpoken: string[] }).quickAddSpoken)
}

/** `QuickAdd` with badges and the empty-title message showing has no axe violation. */
function quickAddAxe(colorScheme: "light" | "dark"): Spec {
  return {
    name:
      `QuickAdd: axe finds no violation with badges and the empty-title message showing, ${colorScheme}`,
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      const { input, submit, chips, notice } = quickAdd(page)
      await input.fill("#work 2099-01-05 !high")
      await submit.click()
      await chips.locator("li").nth(2).waitFor()
      await notice.waitFor()
      const { violations, passes } = await new AxeBuilder({ page })
        .include(`#demo-QuickAdd [data-e2e="quick-add"]`)
        .include(`#demo-QuickAdd [data-e2e="quick-add-clock"]`)
        .include(`#demo-QuickAdd [data-e2e="quick-add-worded"]`)
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
  }
}

/** The `QuickAdd` specs: typing, the timed announcement, refused sends, busy, the clock, axe. */
function quickAddSpecs(): Spec[] {
  return [
    {
      name:
        "QuickAdd: a tag typed letter by letter is announced once, whole, after the typing stops",
      pageId: "ui",
      run: async (page) => {
        const { input, chips, live } = quickAdd(page)
        const spoken = await recordSpoken(page, live)
        // A person's pace: slower than a frame, so each letter is drawn, and well inside the pause.
        await input.pressSequentially("a #work", { delay: 100 })
        await chips.locator("li").filter({ hasText: /^Tag work$/ }).waitFor()
        await live.filter({ hasText: /^Tag work$/ }).waitFor()
        const heard = await spoken()
        if (heard.join("|") !== "Tag work") {
          throw new Error(`the live region held, in order: ${JSON.stringify(heard)}`)
        }
        return "heard: Tag work"
      },
    },
    {
      name:
        "QuickAdd: the button adds the title, tag, due and priority, empties the field and moves focus into it",
      pageId: "ui",
      run: async (page) => {
        const { card, input, submit, chips, live, added } = quickAdd(page)
        await input.fill("Call Anna #work 2099-01-05 3pm !high")
        const named = card.getByRole("list", { name: "Picked up from what you typed", exact: true })
        for (const badge of ["Tag work", "Due Mon 5 Jan 15:00", "High priority"]) {
          await named.locator("li").filter({ hasText: new RegExp(`^${badge}$`) }).waitFor()
        }
        await live.filter({ hasText: /^Tag work, Due Mon 5 Jan 15:00, High priority$/ }).waitFor()
        await submit.click()
        await added.filter({ hasText: "added 1:" }).waitFor()
        await textIs(
          added,
          `added 1: {"title":"Call Anna","tags":["work"],"contexts":[],` +
            `"due":{"date":"2099-01-05","time":"15:00"},"priority":1}`,
        )
        await input.and(page.locator(":focus:placeholder-shown")).waitFor()
        await chips.waitFor({ state: "detached" })
        await live.filter({ hasText: /^$/ }).waitFor()
      },
    },
    {
      name:
        "QuickAdd: a line of only tokens sent with the button adds nothing, and its message is shown, spoken once and tied to the invalid, focused field until the next key",
      pageId: "ui",
      run: async (page) => {
        const { input, submit, live, notice, added } = quickAdd(page)
        const spoken = await recordSpoken(page, live)
        await input.fill("#work !high")
        await live.filter({ hasText: /^Tag work, High priority$/ }).waitFor()
        await input.and(page.locator(":not([aria-invalid])")).waitFor()
        await submit.click()
        await notice.filter({ hasText: /^Add a title first$/ }).waitFor()
        await live.filter({ hasText: /^Add a title first$/ }).waitFor()
        await input.and(page.locator(`:focus[aria-invalid="true"]`)).waitFor()
        // The message comes first in the field's description, before the hint.
        const described = await input.evaluate((field) => {
          const [first] = (field.getAttribute("aria-describedby") ?? "").split(" ")
          return field.ownerDocument.getElementById(first)?.textContent ?? `nothing at "${first}"`
        })
        if (described !== "Add a title first") {
          throw new Error(`the field is described first by: ${described}`)
        }
        if (await input.inputValue() !== "#work !high") throw new Error("the typed line was lost")
        await input.pressSequentially(" x")
        await notice.waitFor({ state: "detached" })
        await input.and(page.locator(":not([aria-invalid])")).waitFor()
        await live.filter({ hasText: /^$/ }).waitFor()
        await textIs(added, "added 0: ")
        const heard = await spoken()
        if (heard.join("|") !== "Tag work, High priority|Add a title first") {
          throw new Error(`the live region held, in order: ${JSON.stringify(heard)}`)
        }
      },
    },
    {
      name: "QuickAdd: a blank line sent with the button says nothing and moves focus to the field",
      pageId: "ui",
      run: async (page) => {
        const { input, submit, notice, added } = quickAdd(page)
        await input.fill("   ")
        await submit.click()
        await input.and(page.locator(":focus")).waitFor()
        if (await notice.count() !== 0) throw new Error("a blank line showed a message")
        await textIs(added, "added 0: ")
      },
    },
    {
      name:
        "QuickAdd: while busy the field takes no typing and neither Enter nor a scripted submit adds; afterwards Enter adds the kept text",
      pageId: "ui",
      run: async (page) => {
        const { form, input, added, busy } = quickAdd(page)
        await input.fill("Second")
        await busy.click()
        await input.and(page.locator("[readonly]")).waitFor()
        await input.focus()
        await input.pressSequentially("x")
        await input.press("Enter")
        // The button is off, so Enter never reaches the handler; a script's submit does.
        await form.evaluate((element: HTMLFormElement) => element.requestSubmit())
        // A send that got through would have emptied the field and listed the item by now.
        await busy.click()
        await input.and(page.locator(":not([readonly])")).waitFor()
        if (await input.inputValue() !== "Second") throw new Error("the text changed while busy")
        await textIs(added, "added 0: ")
        await input.press("Enter")
        await added.filter({ hasText: `added 1: {"title":"Second"` }).waitFor()
      },
    },
    {
      name:
        "QuickAdd: at 01:00 in the given zone, a day ahead of UTC, 'tomorrow' is that zone's tomorrow in the badge and in what is added",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-QuickAdd")
        const part = (name: string) => card.locator(`[data-e2e="quick-add-clock${name}"]`)
        await part("-input").fill("Water the plants tomorrow 3pm")
        await part("-chips").locator("li").filter({ hasText: /^Due Tomorrow 15:00$/ }).waitFor()
        await part("-input").press("Enter")
        await part("-added").filter({ hasText: "plants" }).waitFor()
        await textIs(part("-added"), "added: Water the plants, due 2026-03-09")
      },
    },
    quickAddAxe("light"),
    quickAddAxe("dark"),
  ]
}

export const specs: readonly Spec[] = [
  ...quickAddSpecs(),
]
