import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { DialogActions } from "./dialog-actions.tsx"

/** The classes that stack the buttons full width on a phone and line them up from `sm`. */
const ROW_CLASSES = [
  "flex",
  "flex-col",
  "gap-3",
  "sm:flex-row",
  "sm:justify-end",
]

/** The root element's classes, one per entry. */
function rootClasses(html: string): string[] {
  const openingTag = /^<[a-z0-9]+([^>]*)>/.exec(html)?.[1] ?? ""
  return (/ class="([^"]*)"/.exec(openingTag)?.[1] ?? "").split(" ")
}

describe("DialogActions", () => {
  it("carries the classes that stack its buttons on a phone and right-align them from sm", () => {
    const html = render(
      <DialogActions>
        <button type="button">Cancel</button>
      </DialogActions>,
    )
    expect(html.startsWith("<div ")).toBe(true)
    expect(rootClasses(html)).toEqual(ROW_CLASSES)
    expect(rootClasses(html)).not.toContain("flex-col-reverse")
  })

  it("renders Cancel before the submit, in the order they are written", () => {
    const html = render(
      <DialogActions>
        <button type="button">Cancel</button>
        <button type="submit">Save</button>
      </DialogActions>,
    )
    expect(html.indexOf("Cancel")).toBeGreaterThan(-1)
    expect(html.indexOf("Cancel")).toBeLessThan(html.indexOf("Save"))
  })

  it("adds class after its own and passes other attributes through", () => {
    const html = render(<DialogActions id="actions" data-e2e="row" class="pt-2" />)
    expect(html).toBe(
      `<div id="actions" data-e2e="row" class="${ROW_CLASSES.join(" ")} pt-2"></div>`,
    )
  })
})
