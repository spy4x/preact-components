import type { Spec } from "../runner.ts"

/**
 * A spec proving one component hands its `ref` the native element: the card's "Focus via ref"
 * button calls `.focus()` through the ref, and focus must land on the marked element, which must be
 * the element the component draws.
 *
 * @param name The component, which is also its card's name.
 * @param element A selector the focused element must match.
 */
function refSpec(name: string, element: string): Spec {
  return {
    name: `${name}: a ref reaches the native element, so "Focus via ref" focuses it`,
    pageId: "ui",
    run: async (page) => {
      const card = page.locator(`#demo-${name}`)
      const target = card.locator(`${element}[data-e2e="ref-target"]`)
      await target.waitFor()
      if (await target.evaluate((node) => node === document.activeElement)) {
        throw new Error("the target had focus before the button was pressed")
      }
      await card.locator(`[data-e2e="ref-focus"]`).click()
      await target.and(page.locator(":focus")).waitFor()
    },
  }
}

export const specs: readonly Spec[] = [
  // Forms and accessibility (#116): refs, `required`, `aria-pressed`, reduced motion.
  refSpec("Textarea", "textarea"),
  refSpec("Select", "select"),
  refSpec("InputButton", "input"),
  refSpec("Card", "div.pc-card"),
]
