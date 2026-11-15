import type { Spec } from "../runner.ts"

/** `OnboardingChecklist`: what an app reaches through its ports. */
const onboardingChecklistSpecs: readonly Spec[] = [
  {
    name: "OnboardingChecklist: headingRef points at the heading, so after Dismiss and Show " +
      "again the demo puts focus on Get started",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-OnboardingChecklist")
      await card.getByRole("button", { name: "Dismiss", exact: true }).press("Enter")
      const showAgain = card.locator(`[data-e2e="onboarding-show-again"]`)
      await showAgain.and(page.locator(":focus")).waitFor()
      await showAgain.press("Enter")
      await card.getByRole("heading", { name: "Get started", exact: true })
        .and(page.locator(":focus")).waitFor()
    },
  },
]

export const specs: readonly Spec[] = [
  ...onboardingChecklistSpecs,
]
