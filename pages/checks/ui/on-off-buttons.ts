import { check, type Devtools, PAGE_UNTIL } from "../harness.ts"

/** OnOffButtons switches the selected half. */
export async function onOffButtonsChecks(devtools: Devtools): Promise<void> {
  const segmented = await devtools.evaluate<{ before: string; after: string }>(
    `(async () => {
      const card = document.querySelector("#demo-OnOffButtons")
      const off = [...card.querySelectorAll("button")].find((b) => b.textContent.includes("OFF"))
      const before = off.className
      off.click()
      await ${PAGE_UNTIL}(() => off.className !== before)
      return { before, after: off.className }
    })()`,
  )
  check("OnOffButtons switches the selected half", segmented.before !== segmented.after)
}
