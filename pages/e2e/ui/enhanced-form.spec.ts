import en from "@spy4x/preact-ui/i18n/en"
import type { Locator, Page } from "playwright-core"
import { axeCleanIn } from "../axe-clean.ts"
import type { Spec } from "../runner.ts"

const DEMO = `[data-e2e="required-enhanced-form"]`

/** The `EnhancedForm` card's required-fields demo, and each control in it. */
function requiredDemo(page: Page) {
  const demo = page.locator(DEMO)
  return {
    demo,
    email: demo.locator("#guide-required-enhanced-email"),
    free: demo.getByRole("radio", { name: "Free", exact: true }),
    team: demo.getByRole("radio", { name: "Team", exact: true }),
    size: demo.locator("#guide-required-enhanced-size"),
    tags: demo.locator("#guide-required-enhanced-tags"),
    terms: demo.locator(`[data-e2e="required-enhanced-terms"]`),
    submit: demo.getByRole("button", { name: "Create account", exact: true }),
    submits: demo.locator(`[data-e2e="required-enhanced-submits"]`),
  }
}

/** The control's `validationMessage`, and whether a script set it. */
function validity(control: Locator) {
  return control.evaluate((node) => {
    const field = node as HTMLInputElement
    return { message: field.validationMessage, custom: field.validity.customError }
  })
}

/** Throws unless `control`'s `validationMessage` reads `expected`. */
async function says(control: Locator, what: string, expected: string) {
  const { message } = await validity(control)
  if (message !== expected) throw new Error(`${what} says "${message}", not "${expected}"`)
}

/** Throws unless the count under the demo reads `submits: <count>`. */
async function submitted(submits: Locator, count: number) {
  const text = (await submits.textContent())?.trim()
  if (text !== `submits: ${count}`) throw new Error(`the count reads "${text}"`)
}

/** An empty required control says what it needs in the app's words, not the browser's (#1256). */
export const specs: Spec[] = [
  {
    name:
      "EnhancedForm: an empty required field, checkbox, radio group and select each get the catalog's message, and TagInput keeps its own",
    pageId: "ui",
    run: async (page) => {
      const form = requiredDemo(page)
      await form.submit.click()
      await form.email.and(page.locator(":invalid:focus")).waitFor()
      await says(form.email, "the empty email field", en["EnhancedForm.requiredField"])
      await says(form.terms, "the unticked checkbox", en["EnhancedForm.requiredCheckbox"])
      await says(form.free, "the first radio", en["EnhancedForm.requiredChoice"])
      await says(form.team, "the second radio", en["EnhancedForm.requiredChoice"])
      await says(form.size, "the empty select", en["EnhancedForm.requiredChoice"])
      await says(form.tags, "the empty TagInput", "Add at least one tag")
      await submitted(form.submits, 0)
      await axeCleanIn(page, DEMO)
    },
  },
  {
    name: "EnhancedForm: a required field holding a wrong value keeps the browser's own message",
    pageId: "ui",
    run: async (page) => {
      const form = requiredDemo(page)
      await form.email.fill("nope")
      await form.submit.click()
      await form.email.and(page.locator(":invalid:focus")).waitFor()
      const { message, custom } = await validity(form.email)
      if (custom || message === "" || message === en["EnhancedForm.requiredField"]) {
        throw new Error(`"nope" in the email field says "${message}" (set by script: ${custom})`)
      }
    },
  },
  {
    name: "EnhancedForm: an empty required field whose own code set a message keeps that message",
    pageId: "ui",
    run: async (page) => {
      const form = requiredDemo(page)
      // What an app's own check, or a component with native `required`, does to an empty field.
      await form.email.evaluate((node) =>
        (node as HTMLInputElement).setCustomValidity("This address is taken.")
      )
      await form.submit.click()
      await form.email.and(page.locator(":invalid:focus")).waitFor()
      await says(form.email, "the email field with its own message", "This address is taken.")
    },
  },
  {
    name:
      "EnhancedForm: typing clears every required message the form set, picking one radio releases its sibling, and the filled form submits",
    pageId: "ui",
    run: async (page) => {
      const form = requiredDemo(page)
      await form.submit.click()
      await form.email.and(page.locator(":invalid:focus")).waitFor()
      await form.email.fill("someone@example.com")
      for (const [what, control] of [["checkbox", form.terms], ["radio", form.free]] as const) {
        const { custom } = await validity(control)
        if (custom) throw new Error(`typing in the email field left the ${what}'s message set`)
      }
      await form.size.selectOption("small")
      await form.tags.pressSequentially("work,")
      await form.demo.getByRole("button", { name: "Remove tag work", exact: true }).waitFor()
      await form.terms.check()
      await form.submit.click()
      await says(form.free, "the first radio", en["EnhancedForm.requiredChoice"])
      await submitted(form.submits, 0)
      await form.team.check()
      await form.submit.click()
      await form.submits.getByText("submits: 1", { exact: true }).waitFor()
    },
  },
  {
    name:
      "EnhancedForm: a value set by code after a refused submit, with no event, does not keep the form's message blocking the next submit",
    pageId: "ui",
    run: async (page) => {
      const form = requiredDemo(page)
      await form.email.fill("someone@example.com")
      await form.free.check()
      await form.size.selectOption("small")
      await form.tags.pressSequentially("work,")
      await form.demo.getByRole("button", { name: "Remove tag work", exact: true }).waitFor()
      await form.submit.click()
      await says(form.terms, "the unticked checkbox", en["EnhancedForm.requiredCheckbox"])
      // What FileInput's drop does to its input: a value written in code, which fires no event.
      await form.terms.evaluate((node) => (node as HTMLInputElement).checked = true)
      await form.submit.click()
      await form.submits.getByText("submits: 1", { exact: true }).waitFor()
    },
  },
]
