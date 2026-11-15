/** An axe check shared by the specs of components drawn on a guide page's demo stage. */
import { AxeBuilder } from "@axe-core/playwright"
import type { Page } from "playwright-core"

/** Throws when axe finds a violation in `selector`, or could not or did not measure its contrast. */
export async function axeCleanIn(page: Page, selector: string): Promise<string> {
  // The guide's demo stage draws dots with a gradient, under which axe can read no colour; the
  // guide's own axe spec takes them off the same way.
  await page.addStyleTag({
    content: `[class*="bg-[radial-gradient(var(--color-border-subtle)_1px"] ` +
      `{ background-image: none !important; }`,
  })
  const { violations, passes, incomplete } = await new AxeBuilder({ page }).include(selector)
    .analyze()
  if (violations.length > 0) {
    throw new Error(
      `${selector}: ` +
        violations.map((rule) => `${rule.id}: ${rule.help} (${rule.nodes.length})`).join("; "),
    )
  }
  const unsure = incomplete.filter((rule) => rule.id === "color-contrast")
  if (unsure.length > 0) {
    throw new Error(
      `${selector}: axe could not decide colour contrast on ` +
        `${unsure[0].nodes.map((node) => node.target.join(" ")).join(", ")}`,
    )
  }
  if (!passes.some((rule) => rule.id === "color-contrast")) {
    throw new Error(`axe did not measure colour contrast in ${selector}`)
  }
  return `${passes.length} rules`
}
