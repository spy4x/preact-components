import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"

/** The parts of the `EnhancedForm` card's focus demo a spec drives. */
function focusDemo(page: Page) {
  const demo = page.locator(`#demo-EnhancedForm [data-e2e="focus-demo"]`)
  const line = demo.locator(`[data-e2e="focus-demo-line"]`)
  return {
    email: demo.locator(`[data-e2e="focus-demo-email"]`),
    submit: demo.locator(`[data-e2e="focus-demo-submit"]`),
    startOver: demo.locator(`[data-e2e="focus-demo-start-over"]`),
    line,
    /**
     * Waits for the demo's last line to carry this state in `data-settled`. The demo writes it from
     * an effect declared after both hooks, so once it shows, the hooks have done all they do for it.
     */
    settledIs: (text: string) =>
      demo.locator(`[data-e2e="focus-demo-settled"][data-settled="${text}"]`).waitFor(),
    /** Waits for the focus to be on one element. */
    focusIsOn: (target: Locator) => target.and(page.locator(":focus")).waitFor(),
    /** Throws when the step's line holds the focus. */
    lineIsNotFocused: async (when: string) => {
      if (await line.evaluate((element) => element === document.activeElement)) {
        throw new Error(`the step's line took focus ${when}`)
      }
    },
  }
}

/** `useFocusOnError` and `useFocusOnChange`, on the `EnhancedForm` card's two-step form. */
function focusHookSpecs(): Spec[] {
  return [
    {
      name:
        "useFocusOnError: each new error puts focus on the field, though the submit button held it",
      pageId: "ui",
      run: async (page) => {
        const { email, submit, settledIs, focusIsOn } = focusDemo(page)
        await submit.click()
        await settledIs("step ask · submits 1")
        await focusIsOn(email)
        await email.fill("not an address")
        await submit.click()
        await settledIs("step ask · submits 2")
        await focusIsOn(email)
      },
    },
    {
      name: "useFocusOnError: the same error again moves nothing, so focus stays on the button",
      pageId: "ui",
      run: async (page) => {
        const { email, submit, settledIs, focusIsOn } = focusDemo(page)
        await submit.click()
        await settledIs("step ask · submits 1")
        await focusIsOn(email)
        await submit.click()
        await settledIs("step ask · submits 2")
        await focusIsOn(submit)
      },
    },
    {
      name:
        "useFocusOnChange: mounting moves nothing, a new step puts focus on its line, and the step it mounted with moves nothing",
      pageId: "ui",
      run: async (page) => {
        const { email, submit, startOver, line, settledIs, focusIsOn, lineIsNotFocused } =
          focusDemo(page)
        await settledIs("step ask · submits 0")
        await lineIsNotFocused("on mount")
        await email.fill("ada@example.com")
        await submit.click()
        await settledIs("step sent · submits 1")
        await focusIsOn(line.filter({ hasText: "a link is on its way to ada@example.com" }))
        await startOver.click()
        await settledIs("step ask · submits 0")
        await focusIsOn(startOver)
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...focusHookSpecs(),
]
