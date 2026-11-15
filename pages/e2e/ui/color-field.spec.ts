import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

/**
 * `ColorField`: round swatches on native radios. Arrow keys move the choice within one tab stop,
 * "Custom" shows a colour input and a hex field that Tab reaches, a valid hex reaches the caller in
 * lower case and an invalid one shows the error instead, a value changed from outside moves the
 * choice off Custom, and axe passes in both palettes.
 */
function colorFieldSpecs(): Spec[] {
  const card = (page: Page) => page.locator("#demo-ColorField")
  const group = (page: Page) => card(page).getByRole("group", { name: "Tag colour" })
  const radio = (page: Page, name: string, checked?: boolean) =>
    group(page).getByRole("radio", { name, exact: true, checked })
  /** Waits for the demo's tag chip, the caller's preview, to be drawn on this background. */
  const chipIs = (page: Page, rgb: string) =>
    page.waitForFunction(
      ([selector, expected]) => {
        const chip = document.querySelector(selector)
        return chip !== null && getComputedStyle(chip).backgroundColor === expected
      },
      [`#demo-ColorField [data-e2e="color-field-chip"]`, rgb] as const,
    )
  /** Clicks the Custom swatch, as a person does, and waits for its radio to be checked. */
  const openCustom = async (page: Page) => {
    await group(page).getByTitle("Pick a custom colour").click()
    await radio(page, "Pick a custom colour", true).waitFor()
  }
  /** Waits for the demo to show this as the value `onChange` last handed it. */
  const storedIs = (page: Page, text: string) =>
    card(page).locator(`[data-e2e="color-field-value"]`).getByText(text, { exact: true }).waitFor()
  return [
    {
      name:
        "ColorField: arrow keys move the one checked swatch and the preview follows; Custom shows the picker and the hex field, which Tab reaches next",
      pageId: "ui",
      run: async (page) => {
        const focused = page.locator(":focus")
        await radio(page, "Sky", true).focus()
        await chipIs(page, "rgb(3, 105, 161)")
        await page.keyboard.press("ArrowRight")
        await radio(page, "Blue", true).and(focused).waitFor()
        await radio(page, "Sky", false).waitFor()
        await chipIs(page, "rgb(29, 78, 216)")

        const hex = group(page).getByRole("textbox", { name: "Hex code" })
        if (await hex.count() !== 0) throw new Error("the hex field shows before Custom is chosen")
        await radio(page, "Gray").focus()
        await page.keyboard.press("ArrowLeft")
        await radio(page, "Pick a custom colour", true).and(focused).waitFor()
        await page.keyboard.press("Tab")
        await group(page).getByLabel("Colour picker").and(focused).waitFor()
        await page.keyboard.press("Tab")
        await hex.and(focused).waitFor()
        const shown = await hex.inputValue()
        // Focus moved to Gray without choosing it, so the colour is still Blue.
        if (shown !== "#1d4ed8") throw new Error(`the hex field shows ${shown}, not the colour`)
      },
    },
    {
      name:
        "ColorField: a typed or picked hex reaches onChange in lower case; an invalid one shows the error on blur and does not",
      pageId: "ui",
      run: async (page) => {
        await openCustom(page)
        const hex = group(page).getByRole("textbox", { name: "Hex code" })
        await hex.fill("#59168B")
        await chipIs(page, "rgb(89, 22, 139)")
        await storedIs(page, "#59168b")

        await hex.fill("#12")
        await hex.blur()
        const error = group(page).getByText("Enter # and 6 characters, such as #59168b.")
        await error.waitFor()
        await hex.and(page.locator(`[aria-invalid="true"]`)).waitFor()
        await chipIs(page, "rgb(89, 22, 139)")

        await group(page).getByLabel("Colour picker").fill("#123456")
        await chipIs(page, "rgb(18, 52, 86)")
        await error.waitFor({ state: "detached" })
        const shown = await hex.inputValue()
        if (shown !== "#123456") throw new Error(`the hex field shows ${shown} after a pick`)
      },
    },
    {
      name:
        "ColorField: an invalid hex refuses the form's submit, focuses the field and shows its error; a preset, a valid hex and None save",
      pageId: "ui",
      run: async (page) => {
        const save = card(page).getByRole("button", { name: "Save", exact: true })
        const savedIs = (text: string) =>
          card(page).locator(`[data-e2e="color-field-saves"]`).getByText(text, { exact: true })
            .waitFor()
        await save.click()
        await savedIs("saves: 1, saved: #0369a1, group none")

        await openCustom(page)
        const hex = group(page).getByRole("textbox", { name: "Hex code" })
        const message = "Enter # and 6 characters, such as #59168b."
        const error = group(page).getByText(message)
        // Enter submits from the field without blurring it, so only the refusal can show the error.
        // Records the browser's message at the moment it refuses, before the field re-renders.
        await hex.evaluate((input: HTMLInputElement) =>
          input.addEventListener(
            "invalid",
            () => input.dataset.refusedWith = input.validationMessage,
            {
              capture: true,
            },
          )
        )
        await hex.fill("#zzz")
        await hex.press("Enter")
        await savedIs("saves: 1, saved: #0369a1, group none")
        await error.waitFor()
        const bubble = await hex.getAttribute("data-refused-with")
        if (bubble !== message) throw new Error(`the browser's message is "${bubble}"`)

        await hex.fill("#12")
        await save.click()
        await hex.and(page.locator(":focus")).waitFor()
        await savedIs("saves: 1, saved: #0369a1, group none")

        await hex.fill("#59168b")
        await save.click()
        await savedIs("saves: 2, saved: #59168b, group none")

        const groupColour = card(page).getByRole("group", { name: "Group colour" })
        await groupColour.getByTitle("Red").click()
        await groupColour.getByTitle("No group colour").click()
        await save.click()
        await savedIs("saves: 3, saved: #59168b, group none")

        // Custom with nothing typed is no colour, so it refuses the submit too.
        await groupColour.getByTitle("Pick a custom colour").click()
        const groupHex = groupColour.getByRole("textbox", { name: "Hex code" })
        await save.click()
        await groupHex.and(page.locator(":focus")).waitFor()
        await groupColour.getByText(message).waitFor()
        await savedIs("saves: 3, saved: #59168b, group none")
      },
    },
    {
      name:
        "ColorField: picking Custom again after the caller changed the value drops the old invalid text",
      pageId: "ui",
      run: async (page) => {
        await openCustom(page)
        const hex = group(page).getByRole("textbox", { name: "Hex code" })
        await hex.fill("#59168b")
        await storedIs(page, "#59168b")
        await hex.fill("#zzz")
        // Blur first: the error it shows moves the button, which would make the click miss.
        await hex.blur()
        await group(page).getByText("Enter # and 6 characters, such as #59168b.").waitFor()
        await card(page).getByRole("button", { name: "Reset to Sky" }).click()
        await storedIs(page, "#0369a1")
        await hex.waitFor({ state: "detached" })
        await openCustom(page)
        const shown = await hex.inputValue()
        if (shown !== "#0369a1") throw new Error(`the hex field shows ${shown}, not the colour`)
      },
    },
    {
      name:
        "ColorField: a value the caller changes from outside to a preset checks that preset, unchecks Custom and hides the hex field",
      pageId: "ui",
      run: async (page) => {
        await openCustom(page)
        await group(page).getByRole("textbox", { name: "Hex code" }).fill("#59168b")
        await storedIs(page, "#59168b")
        await card(page).getByRole("button", { name: "Reset to Sky" }).click()
        await storedIs(page, "#0369a1")
        await radio(page, "Sky", true).waitFor()
        await radio(page, "Pick a custom colour", false).waitFor()
        await group(page).getByRole("textbox", { name: "Hex code" }).waitFor({ state: "detached" })
      },
    },
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name:
        `ColorField: axe finds no violation on the swatches, the hex field and the None swatch, ${colorScheme}`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        await openCustom(page)
        await group(page).getByRole("textbox", { name: "Hex code" }).waitFor()
        await card(page).getByRole("radio", { name: "No group colour", checked: true }).waitFor()
        return await axePasses(page, ["#demo-ColorField"])
      },
    })),
  ]
}

export const specs: readonly Spec[] = [
  ...colorFieldSpecs(),
]
