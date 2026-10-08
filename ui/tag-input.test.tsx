import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Field } from "./field.tsx"
import { addTags, splitTagText, TagInput, tagInputKeyAction, tagSuggestions } from "./tag-input.tsx"

/** A key press with no modifier held. */
const key = (name: string) => ({ key: name, altKey: false, ctrlKey: false, metaKey: false })

const closed = { activeIndex: -1, isOpen: false }

describe("addTags", () => {
  it("adds a trimmed tag at the end", () => {
    expect(addTags(["work"], ["  home "])).toEqual({
      tags: ["work", "home"],
      added: ["home"],
      duplicates: [],
    })
  })

  it("leaves out a tag the list holds in another case, and reports it", () => {
    const tags = ["Work"]
    const result = addTags(tags, ["work"])
    expect(result).toEqual({ tags: ["Work"], added: [], duplicates: ["work"] })
    expect(result.tags).toBe(tags)
  })

  it("skips blank text without reporting it", () => {
    expect(addTags([], ["", "   "])).toEqual({ tags: [], added: [], duplicates: [] })
  })

  it("compares a later text against the earlier ones of the same batch", () => {
    expect(addTags([], ["a", "A", "b"])).toEqual({
      tags: ["a", "b"],
      added: ["a", "b"],
      duplicates: ["A"],
    })
  })

  it("keeps accents apart, so résumé and resume are two tags", () => {
    expect(addTags(["résumé"], ["resume"]).added).toEqual(["resume"])
  })
})

describe("splitTagText", () => {
  it("keeps text with no comma as the unfinished rest", () => {
    expect(splitTagText("wor")).toEqual({ tags: [], rest: "wor" })
  })

  it("finishes every part before the last comma", () => {
    expect(splitTagText("a, b,, c")).toEqual({ tags: ["a", "b"], rest: " c" })
  })

  it("leaves an empty rest after a trailing comma", () => {
    expect(splitTagText("work,")).toEqual({ tags: ["work"], rest: "" })
  })
})

describe("tagSuggestions", () => {
  it("hides suggestions already chosen, in any case", () => {
    expect(tagSuggestions(["work", "Home", "errand"], ["home"], "")).toEqual(["work", "errand"])
  })

  it("filters by the typed text the way Combobox does", () => {
    expect(tagSuggestions(["São Paulo", "Lisbon"], [], "sao")).toEqual(["São Paulo"])
  })

  it("offers each spelling once", () => {
    expect(tagSuggestions(["work", "Work", "home"], [], "")).toEqual(["work", "home"])
  })
})

describe("tagInputKeyAction", () => {
  it("adds the typed text on Enter when no suggestion is highlighted", () => {
    const action = tagInputKeyAction(key("Enter"), { activeIndex: -1, isOpen: true }, 3, "new")
    expect(action).toEqual({
      state: closed,
      preventDefault: true,
      pick: -1,
      commit: true,
      removeLast: false,
    })
  })

  it("picks the highlighted suggestion on Enter", () => {
    const action = tagInputKeyAction(key("Enter"), { activeIndex: 1, isOpen: true }, 3, "")
    expect(action?.pick).toBe(1)
    expect(action?.commit).toBe(false)
  })

  it("adds the typed text on a comma and keeps the comma out of the field", () => {
    const action = tagInputKeyAction(key(","), { activeIndex: 0, isOpen: true }, 3, "new")
    expect(action).toMatchObject({ commit: true, pick: -1, preventDefault: true, state: closed })
  })

  it("removes the last tag on Backspace in an empty field", () => {
    const action = tagInputKeyAction(key("Backspace"), closed, 0, "")
    expect(action).toMatchObject({ removeLast: true, preventDefault: true })
  })

  it("leaves Backspace to the field while it holds text", () => {
    expect(tagInputKeyAction(key("Backspace"), closed, 0, "w")).toBeUndefined()
  })

  it("moves through suggestions with Combobox's arrow keys, wrapping", () => {
    const down = tagInputKeyAction(key("ArrowDown"), closed, 2, "")
    expect(down?.state).toEqual({ activeIndex: 0, isOpen: true })
    const wrap = tagInputKeyAction(key("ArrowDown"), { activeIndex: 1, isOpen: true }, 2, "")
    expect(wrap?.state).toEqual({ activeIndex: 0, isOpen: true })
    const up = tagInputKeyAction(key("ArrowUp"), { activeIndex: 0, isOpen: true }, 2, "")
    expect(up?.state).toEqual({ activeIndex: 1, isOpen: true })
  })

  it("leaves a key held with Ctrl or Meta to the browser, so Ctrl+Enter reaches the form", () => {
    expect(tagInputKeyAction({ ...key("Enter"), ctrlKey: true }, closed, 0, "x")).toBeUndefined()
    expect(tagInputKeyAction({ ...key(","), metaKey: true }, closed, 0, "x")).toBeUndefined()
  })

  it("leaves a letter to the field", () => {
    expect(tagInputKeyAction(key("a"), closed, 0, "")).toBeUndefined()
  })
})

describe("TagInput", () => {
  it("renders one chip per tag, each with a remove button named after it", () => {
    const html = render(
      <TagInput id="tags" ariaLabel="Tags" value={["work", "home"]} onChange={() => {}} />,
    )
    expect(html).toContain('<ul aria-label="Tags"')
    expect([...html.matchAll(/aria-label="(Remove tag [^"]+)"/g)].map((m) => m[1])).toEqual([
      "Remove tag work",
      "Remove tag home",
    ])
  })

  it("names the remove buttons in the caller's words", () => {
    const html = render(
      <TagInput
        ariaLabel="Etiquetas"
        value={["casa"]}
        onChange={() => {}}
        removeLabel={(tag) => `Quitar ${tag}`}
      />,
    )
    expect(html).toContain('aria-label="Quitar casa"')
  })

  it("wires the input to its listbox the way Combobox does", () => {
    const html = render(
      <TagInput id="tags" ariaLabel="Tags" value={[]} onChange={() => {}} suggestions={["a"]} />,
    )
    expect(html).toMatch(/<input[^>]*id="tags"[^>]*role="combobox"/)
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls="tags-listbox"')
    expect(html).toContain('aria-autocomplete="list"')
    expect(html).toMatch(/<ul id="tags-listbox" role="listbox" aria-label="Suggestions" hidden/)
    expect(html).toContain('<li id="tags-option-0" role="option" aria-selected="false"')
  })

  it("leaves chosen tags out of the suggestion list", () => {
    const html = render(
      <TagInput
        ariaLabel="Tags"
        value={["Work"]}
        onChange={() => {}}
        suggestions={["work", "home"]}
      />,
    )
    const options = [...html.matchAll(/role="option"[^>]*>([^<]+)</g)].map((m) => m[1])
    expect(options).toEqual(["home"])
  })

  it("gets its id, description and invalid state from Field", () => {
    const html = render(
      <Field id="task-tags" label="Tags" error="Too many tags" hint="Comma separates">
        <TagInput value={[]} onChange={() => {}} />
      </Field>,
    )
    expect(html).toContain('<label for="task-tags"')
    expect(html).toMatch(/<input[^>]*id="task-tags"/)
    expect(html).toContain('aria-describedby="task-tags-error task-tags-hint"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain("border-danger")
  })

  it("shows its own error, described and invalid, outside Field", () => {
    const html = render(
      <TagInput id="t" label="Tags" value={[]} onChange={() => {}} error="Required" />,
    )
    expect(html).toContain('<label for="t"')
    expect(html).toContain('<p id="t-error" class="mt-2 text-sm text-danger">Required</p>')
    expect(html).toContain('aria-describedby="t-error"')
    expect(html).toContain('aria-invalid="true"')
  })

  it("disables typing and every remove button when disabled", () => {
    const html = render(
      <TagInput ariaLabel="Tags" value={["a", "b"]} onChange={() => {}} disabled />,
    )
    expect(html).toMatch(/<input[^>]*\sdisabled(?=[\s>\/])/)
    expect(html.match(/<button[^>]*\sdisabled(?=[\s>])/g)?.length).toBe(2)
  })

  it("gives every remove button and the text field a 44 px target, and lets chips wrap", () => {
    const html = render(<TagInput ariaLabel="Tags" value={["a"]} onChange={() => {}} />)
    expect(html).toMatch(/<button[^>]*class="[^"]*\bsize-11\b/)
    expect(html).toMatch(/<input[^>]*class="[^"]*\bh-11\b/)
    const list = html.match(/<ul aria-label="Tags" class="([^"]*)"/)?.[1].split(" ")
    expect(list).toEqual(expect.arrayContaining(["flex-wrap", "max-w-full"]))
  })

  it("renders an empty polite live region from the first render", () => {
    const html = render(<TagInput ariaLabel="Tags" value={[]} onChange={() => {}} />)
    expect(html).toContain(
      '<div role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>',
    )
  })
})
