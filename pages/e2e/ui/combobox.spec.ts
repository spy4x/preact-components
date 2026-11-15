import type { Locator } from "playwright-core"
import type { Spec } from "../runner.ts"

/**
 * A controlled `Combobox` keeps its query when it closes (#874), and every `EnhancedForm` demo keeps
 * a gap between its last field and its submit button.
 */
function comboboxAndFormGapSpecs(): Spec[] {
  return [
    {
      name:
        "Combobox: blurring a controlled search field leaves its query alone and fetches nothing",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-Combobox")
        const field = card.locator("#guide-combobox-fetch")
        const note = card.locator(`[data-e2e="combobox-fetch"]`)
        await field.click()
        await field.pressSequentially("B")
        await note.filter({ hasText: /^\d+ options · nothing selected · query "B"$/ }).waitFor()
        await field.press("Tab")
        await field.and(page.locator(`[aria-expanded="false"]`)).waitFor()
        // `onQueryChange` would be called inside the blur handler, so the render that closes the
        // list is the one that would show the call: no later read can see more.
        const calls = await countedCalls(card)
        if (calls !== 1) {
          throw new Error(`${calls} onQueryChange calls after one keystroke and a blur`)
        }
        const closed = (await note.textContent())?.replace(/\s+/g, " ").trim()
        if (closed?.includes("fetching") || !closed?.endsWith(`query "B"`)) {
          throw new Error(`after the blur the card reads "${closed}"`)
        }
      },
    },
    {
      name:
        "Combobox: the clear button calls a controlled caller's onQueryChange once, open or closed",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-Combobox")
        const field = card.locator("#guide-combobox-fetch")
        // The field's own clear button, beside the input: every field on the card has one.
        const clear = field.locator("xpath=..").getByRole("button", { name: "Clear selection" })
        const note = card.locator(`[data-e2e="combobox-fetch"]`)
        const cleared = async (expected: number, how: string) => {
          await note.filter({ hasText: /· nothing selected$/ }).waitFor()
          const calls = await countedCalls(card)
          if (calls !== expected) throw new Error(`${calls} calls after clearing ${how}`)
        }

        await field.click()
        await field.pressSequentially("B")
        await note.filter({ hasText: `query "B"` }).waitFor()
        await clear.click()
        await cleared(2, "the open field")

        await field.click()
        await field.pressSequentially("B")
        await note.filter({ hasText: `query "B"` }).waitFor()
        await field.press("Tab")
        await field.and(page.locator(`[aria-expanded="false"]`)).waitFor()
        await clear.click()
        await cleared(4, "the closed field")
      },
    },
    // The `EnhancedForm` demos whose submit row sits under a field, by their `data-e2e` hook.
    ...["enhanced-form", "contact-form", "controlled-form", "focus-demo"].map((hook): Spec => ({
      name: `EnhancedForm demo "${hook}": a gap separates the last field from the submit button`,
      pageId: "ui",
      run: async (page) => {
        const form = page.locator(`[data-e2e="${hook}"] form`).first()
        const gap = await form.evaluate((element) => {
          const row = element.querySelector(`button[type="submit"]`)?.parentElement
          let above = row?.previousElementSibling ?? null
          // The honeypot is positioned out of the flow; the gap is to the field a person sees.
          while (above !== null && getComputedStyle(above).position === "absolute") {
            above = above.previousElementSibling
          }
          if (row === undefined || row === null || above === null) return null
          return row.getBoundingClientRect().top - above.getBoundingClientRect().bottom
        })
        if (gap === null) throw new Error("no submit row with a field above it")
        if (gap < 12) throw new Error(`${gap} px between the last field and the submit row`)
        return `${gap} px`
      },
    })),
  ]
}

/**
 * How many times the Combobox card's fetching field has called `onQueryChange`, read off the
 * `data-query-calls` attribute of its wrapper.
 *
 * @param card The Combobox card.
 */
async function countedCalls(card: Locator): Promise<number> {
  const text = await card.locator(`[data-e2e="combobox-fetch-card"]`)
    .getAttribute("data-query-calls") ?? ""
  const calls = Number(text === "" ? Number.NaN : text)
  if (Number.isNaN(calls)) throw new Error(`the card reports no call count: "${text}"`)
  return calls
}

export const specs: readonly Spec[] = [
  ...comboboxAndFormGapSpecs(),
]
