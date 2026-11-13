import { check, type Devtools, PAGE_UNTIL } from "../harness.ts"

/** The `useSucceeded` demo's count after each step of {@link useSucceededChecks}. */
interface SucceededRun {
  /** The count on the hydrated page, before any press: mounting must not have run `onDone`. */
  mounted: number
  /** The count once a save has succeeded. */
  succeeded: number
  /** The count read again a while later, with nothing pressed in between. */
  later: number
  /** The count once a second save has failed. */
  failed: number
  /** The demo's caption after the failure, which shows the error. */
  failedText: string
  /** The count once that failure's error has been dismissed. */
  dismissed: number
  /** The step whose wait for the demo's buttons timed out, or `""` when none did. */
  stuck: string
}

/**
 * `useSucceeded`, driven through the `Button` card's "Save" demo, which counts every `onDone` call.
 *
 * The hook's work is an effect, so only a browser runs it. Mounting with `pending` false must not
 * count; a save that ends with "Succeed" counts once, and stays counted once while nothing else
 * happens; a save that ends with "Fail" does not count, and neither does dismissing its error
 * afterwards, which drops `failed` while `pending` stays false. Each step waits for the demo's
 * buttons to show the new state, then two animation frames and 100 ms more so the effect has run.
 * Each check compares a count with the one before its own step, so a broken step fails its own
 * check rather than every check after it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function useSucceededChecks(devtools: Devtools): Promise<void> {
  const run = await devtools.evaluate<SucceededRun>(`(async () => {
    const card = document.querySelector("#demo-Button")
    const button = (name) => card.querySelector('[data-e2e="succeeded-' + name + '"]')
    const caption = () => card.querySelector('[data-e2e="succeeded-count"]').textContent
    const count = () => Number((caption().match(/saved (\\d+)/) ?? [0, -1])[1])
    const settle = async () => {
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      await new Promise((done) => setTimeout(done, 100))
    }
    let stuck = ""
    const step = async (name, press, ready) => {
      button(press).click()
      if (!(await ${PAGE_UNTIL}(ready))) stuck ||= name
      await settle()
    }

    const mounted = count()
    await step("save", "save", () => !button("ok").disabled)
    await step("succeed", "ok", () => button("ok").disabled)
    const succeeded = count()
    await settle()
    const later = count()
    await step("second save", "save", () => !button("fail").disabled)
    await step("fail", "fail", () => !button("dismiss").disabled)
    const failed = count()
    const failedText = caption()
    await step("dismiss", "dismiss", () => button("dismiss").disabled)
    return { mounted, succeeded, later, failed, failedText, dismissed: count(), stuck }
  })()`)
  const detail =
    `counts: mounted ${run.mounted}, succeeded ${run.succeeded}, later ${run.later}, ` +
    `failed ${run.failed}, dismissed ${run.dismissed}` +
    (run.stuck ? `; stuck at ${run.stuck}` : "")
  check(
    "useSucceeded does not run onDone on mount with pending false",
    run.mounted === 0,
    detail,
  )
  check(
    "useSucceeded runs onDone once when a save succeeds",
    run.stuck === "" && run.succeeded - run.mounted === 1 && run.later === run.succeeded,
    detail,
  )
  check(
    "useSucceeded does not run onDone after a failure, nor when the failure is cleared",
    run.stuck === "" && run.failed === run.later && run.failedText.includes("Save failed") &&
      run.dismissed === run.failed,
    detail,
  )
}
