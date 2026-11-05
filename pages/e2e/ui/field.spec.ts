import { AxeBuilder } from "@axe-core/playwright"
import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"

/** One required control of the Field card's order form, and how a spec fills it. */
interface RequiredControl {
  /** The control's name in the spec's own name. */
  name: string
  /** `id` of the element the browser focuses when it refuses the submit for this control. */
  focusId: string
  /** Gives the control a value. */
  fill: (form: Locator) => Promise<void>
}

const REQUIRED_CONTROLS: readonly RequiredControl[] = [
  {
    name: "MoneyInput",
    focusId: "guide-required-price",
    fill: (form) => form.locator("#guide-required-price").fill("12"),
  },
  {
    name: "TagInput",
    focusId: "guide-required-tags",
    // A comma ends the tag, so the text field is empty again while the field holds a chip.
    fill: async (form) => {
      await form.locator("#guide-required-tags").pressSequentially("work,")
      await form.getByRole("button", { name: "Remove tag work", exact: true }).waitFor()
    },
  },
  {
    name: "Combobox",
    focusId: "guide-required-city",
    fill: async (form) => {
      await form.locator("#guide-required-city").click()
      await form.getByRole("option", { name: "Lisbon", exact: true }).click()
    },
  },
  {
    name: "RadioGroup",
    focusId: "guide-required-plan-0",
    fill: (form) => form.getByRole("radio", { name: "Express", exact: true }).check(),
  },
]

/** A required `Field` around each control that enforces `required` in its own way. */
function requiredFieldSpecs(): Spec[] {
  const blocked = REQUIRED_CONTROLS.map((control): Spec => ({
    name:
      `Field required around ${control.name}: a submit with only that field empty is refused and focus goes to it, and the same submit goes through once it has a value`,
    pageId: "ui",
    run: async (page) => {
      const form = page.locator(`[data-e2e="required-form"]`)
      const submits = form.locator(`[data-e2e="required-submits"]`)
      const submit = form.locator(`[data-e2e="required-submit"]`)
      await form.locator(`[data-e2e="required-reset"]`).click()
      for (const other of REQUIRED_CONTROLS) {
        if (other !== control) await other.fill(form)
      }
      await submit.click()
      // The browser focuses the first control it refuses, and only an invalid one.
      await form.locator(`#${control.focusId}:invalid:focus`).waitFor()
      const refused = (await submits.textContent())?.trim()
      if (refused !== "submits: 0") throw new Error(`a refused submit left "${refused}"`)
      await control.fill(form)
      await submit.click()
      await submits.getByText("submits: 1", { exact: true }).waitFor()
    },
  }))
  /** The form of required fields, reset, with every control but `empty` filled. */
  const formWithOneEmpty = async (page: Page, empty: string) => {
    const form = page.locator(`[data-e2e="required-form"]`)
    await form.locator(`[data-e2e="required-reset"]`).click()
    for (const other of REQUIRED_CONTROLS) {
      if (other.name !== empty) await other.fill(form)
    }
    const control = form.locator(
      `#${REQUIRED_CONTROLS.find(({ name }) => name === empty)!.focusId}`,
    )
    /** The browser refused the submit at the control, and the count of submits is still `count`. */
    const refusedAt = async (count: number) => {
      await control.and(form.locator(":invalid:focus")).waitFor()
      const text = (await form.locator(`[data-e2e="required-submits"]`).textContent())?.trim()
      if (text !== `submits: ${count}`) throw new Error(`a refused submit left "${text}"`)
    }
    const submittedTimes = (count: number) =>
      form.locator(`[data-e2e="required-submits"]`)
        .getByText(`submits: ${count}`, { exact: true }).waitFor()
    return {
      form,
      control,
      refusedAt,
      submittedTimes,
      submit: form.locator(`[data-e2e="required-submit"]`),
      // A submit that takes focus nowhere, so the text typed in the control is still there when
      // the browser validates: a click on the button would blur the control first.
      submitInPlace: () => form.evaluate((node) => (node as HTMLFormElement).requestSubmit()),
    }
  }
  return [
    ...blocked,
    {
      name:
        "Field required around MoneyInput: Enter in a field that holds only spaces submits nothing",
      pageId: "ui",
      run: async (page) => {
        const { control, refusedAt, submittedTimes } = await formWithOneEmpty(page, "MoneyInput")
        await control.pressSequentially("   ")
        await control.press("Enter")
        await refusedAt(0)
        // A second submit proves the first one counted nothing, even if it was slow to show.
        await control.pressSequentially("12")
        await control.press("Enter")
        await submittedTimes(1)
      },
    },
    {
      name:
        "Field required around TagInput: text typed but not made a tag is refused, and so is a submit after the last tag is removed",
      pageId: "ui",
      run: async (page) => {
        const { form, control, refusedAt, submittedTimes, submit, submitInPlace } =
          await formWithOneEmpty(page, "TagInput")
        await control.pressSequentially("draft")
        await submitInPlace()
        await refusedAt(0)
        await control.press(",")
        const remove = form.getByRole("button", { name: "Remove tag draft", exact: true })
        await remove.waitFor()
        await submit.click()
        await submittedTimes(1)
        await remove.click()
        await remove.waitFor({ state: "detached" })
        await submit.click()
        await refusedAt(1)
      },
    },
    {
      name:
        "Field required around Combobox: a typed query that chose nothing is refused, and so is a submit after the selection is cleared",
      pageId: "ui",
      run: async (page) => {
        const { form, control, refusedAt, submittedTimes, submit, submitInPlace } =
          await formWithOneEmpty(page, "Combobox")
        await control.pressSequentially("Lis")
        await submitInPlace()
        await refusedAt(0)
        await form.getByRole("option", { name: "Lisbon", exact: true }).click()
        await submit.click()
        await submittedTimes(1)
        await form.getByRole("button", { name: "Clear selection", exact: true }).click()
        await submit.click()
        await refusedAt(1)
      },
    },
    {
      name:
        "Field around Combobox: an error under it marks the input invalid and describes it, and axe passes the form of required fields",
      pageId: "ui",
      run: async (page) => {
        const form = page.locator(`[data-e2e="required-form"]`)
        const city = form.locator("#guide-required-city")
        await city.click()
        await form.getByRole("option", { name: "Atlantis", exact: true }).click()
        await form.locator("#guide-required-city-error")
          .getByText("We do not ship to Atlantis", { exact: true }).waitFor()
        await city.and(
          page.locator(`[aria-invalid="true"][aria-describedby~="guide-required-city-error"]`),
        ).waitFor()
        const { violations } = await new AxeBuilder({ page })
          .include(`[data-e2e="required-form"]`).analyze()
        if (violations.length > 0) {
          throw new Error(violations.map((found) => `${found.id}: ${found.help}`).join("; "))
        }
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  {
    name: "Field: a required field's control is required to the browser, and no other is",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-Field")
      // The demo's `Input` carries no `required` of its own: only its `Field` does.
      const email = card.locator("#guide-email")
      await email.and(page.locator(":required")).waitFor()
      await card.locator("#guide-name").and(page.locator(":optional")).waitFor()
      await email.fill("")
      if (!await email.evaluate((input: HTMLInputElement) => input.validity.valueMissing)) {
        throw new Error("the browser accepts the required field left empty")
      }
    },
  },
  ...requiredFieldSpecs(),
]
