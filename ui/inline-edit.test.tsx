import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { InlineEdit, inlineEditCommit } from "./inline-edit.tsx"

describe("inlineEditCommit", () => {
  it("saves the trimmed text when it differs from the value", () => {
    expect(inlineEditCommit("  Groceries  ", "Shopping")).toBe("Groceries")
  })

  it("saves nothing for an empty or blank text", () => {
    expect(inlineEditCommit("", "Shopping")).toBeNull()
    expect(inlineEditCommit("   ", "Shopping")).toBeNull()
  })

  it("saves nothing for a text that matches the value once trimmed", () => {
    expect(inlineEditCommit(" Shopping ", "Shopping")).toBeNull()
  })
})

describe("InlineEdit", () => {
  it("renders the value as a button named by the English default", () => {
    const html = render(<InlineEdit value="Shopping" onSave={() => {}} />)

    expect(html).toContain(`<button type="button"`)
    expect(html).toContain(`aria-label="Edit Shopping"`)
    expect(html).toContain(`<span class="truncate">Shopping</span>`)
    expect(html).not.toContain("<input")
  })

  it("names the button with the caller's wording", () => {
    const html = render(
      <InlineEdit value="Shopping" editLabel={(value) => `Renommer ${value}`} onSave={() => {}} />,
    )

    expect(html).toContain(`aria-label="Renommer Shopping"`)
  })

  it("disables the button when disabled", () => {
    const html = render(<InlineEdit value="Shopping" disabled onSave={() => {}} />)

    expect(html).toMatch(/<button[^>]* disabled[ >]/)
  })
})
