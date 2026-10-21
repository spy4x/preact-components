import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { listboxOptionClass } from "./listbox-parts.tsx"

/** The classes of one group in a row's class list, such as its fills or its text colours. */
const group = (classes: string, pattern: RegExp) =>
  classes.split(" ").filter((name) => pattern.test(name))

const FILL = /^bg-/
const TEXT_COLOUR = /^text-(foreground|selected)$/
const WEIGHT = /^font-/

describe("listboxOptionClass", () => {
  it("gives a highlighted selected row one fill, the darker selected one", () => {
    const classes = listboxOptionClass({ active: true, selected: true, disabled: false })
    expect(group(classes, FILL)).toEqual(["bg-selected-soft-hover"])
    expect(group(classes, TEXT_COLOUR)).toEqual(["text-selected"])
    expect(group(classes, WEIGHT)).toEqual(["font-semibold"])
  })

  it("gives every state one fill at most, one text colour and one weight at most", () => {
    for (const active of [false, true]) {
      for (const selected of [false, true]) {
        for (const disabled of [false, true]) {
          const classes = listboxOptionClass({ active, selected, disabled })
          const state = JSON.stringify({ active, selected, disabled })
          expect(group(classes, FILL).length, state).toBeLessThanOrEqual(1)
          expect(group(classes, TEXT_COLOUR), state).toHaveLength(1)
          expect(group(classes, WEIGHT).length, state).toBeLessThanOrEqual(1)
          expect(group(classes, /^cursor-/), state).toHaveLength(1)
        }
      }
    }
  })
})
