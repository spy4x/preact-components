import type { Spec } from "../runner.ts"

/** Avatar's early failure, CommandPalette's pointer rule, Badge's port and Modal's backdrop record. */
function smallFixSpecs(): Spec[] {
  return [
    {
      name: "Avatar: an image that failed before the bundle ran shows the initials",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-Avatar")
        await card.locator(`span[role="img"][aria-label="Alan Turing"]`)
          .getByText("AT", { exact: true }).waitFor()
        const images = await card.locator(`img[alt="Alan Turing"]`).count()
        if (images !== 0) throw new Error(`the broken image is still drawn (${images})`)
      },
    },
    {
      name: "CommandPalette: the pointer over a result leaves the highlight where the keys put it",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 800 })
        await page.locator(`#demo-CommandPalette [data-e2e="palette-local-open"]`).click()
        const dialog = page.locator(`dialog[data-e2e="palette-local"]`)
        const options = dialog.getByRole("option")
        await options.nth(1).waitFor()
        await options.nth(0).and(page.locator(`[aria-selected="true"]`)).waitFor()
        await options.nth(1).hover()
        // Effects and handlers have run by the next frame.
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(done)))
        const selected = await options.evaluateAll((rows) =>
          rows.map((row) => row.getAttribute("aria-selected"))
        )
        if (selected[0] !== "true" || selected[1] !== "false") {
          throw new Error(`aria-selected after a hover: ${JSON.stringify(selected.slice(0, 2))}`)
        }
        await page.keyboard.press("ArrowDown")
        await options.nth(1).and(page.locator(`[aria-selected="true"]`)).waitFor()
      },
    },
    {
      name: "Badge: a plain click on a linked badge with navigate calls it and stays on the page",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-Badge")
        const before = page.url()
        await card.getByRole("link", { name: "system page" }).click()
        await card.locator(`[data-e2e="badge-navigated"]`)
          .getByText("navigate(#/system)", { exact: true }).waitFor()
        if (page.url() !== before) throw new Error(`the page moved to ${page.url()}`)
      },
    },
    {
      name:
        "Modal: a scripted click after a backdrop press that never became a click keeps it open",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 800 })
        await page.locator(`#demo-Modal [data-e2e="modal-form-open"]`).click()
        const dialog = page.locator(`dialog[data-e2e="guide-modal-form"]`)
        const open = page.locator(`dialog[data-e2e="guide-modal-form"]:modal`)
        await open.waitFor()
        await dialog.evaluate((element) => {
          // A press on the backdrop, in its top-left corner, that no click follows.
          element.dispatchEvent(
            new PointerEvent("pointerdown", { bubbles: true, clientX: 5, clientY: 5 }),
          )
          ;(element as HTMLElement).click()
        })
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(done)))
        if (await open.count() !== 1) throw new Error("the scripted click closed the dialog")
        await page.mouse.click(5, 5)
        await open.waitFor({ state: "detached" })
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...smallFixSpecs(),
]
