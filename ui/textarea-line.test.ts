import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { selectTextareaLine, textLineRange } from "./textarea-line.ts"

describe("textLineRange", () => {
  const text = "first\nsecond line\n\nfourth"

  it("finds each line without its line break", () => {
    expect(textLineRange(text, 1)).toEqual([0, 5])
    expect(textLineRange(text, 2)).toEqual([6, 17])
    expect(textLineRange(text, 3)).toEqual([18, 18])
    expect(textLineRange(text, 4)).toEqual([19, 25])
  })

  it("lands on the nearest line for a line out of range", () => {
    expect(textLineRange(text, 0)).toEqual([0, 5])
    expect(textLineRange(text, 99)).toEqual([19, 25])
    expect(textLineRange("", 3)).toEqual([0, 0])
  })

  it("leaves a carriage return before the break out of the line", () => {
    expect(textLineRange("a\r\nbc\r\n", 1)).toEqual([0, 1])
    expect(textLineRange("a\r\nbc\r\n", 2)).toEqual([3, 5])
  })
})

describe("selectTextareaLine", () => {
  it("focuses the textarea, then selects the line", () => {
    const calls: string[] = []
    const textarea = {
      value: "one\ntwo\nthree",
      clientHeight: 100,
      scrollTop: 0,
      ownerDocument: { defaultView: null },
      focus: () => calls.push("focus"),
      setSelectionRange: (start: number, end: number) => calls.push(`select ${start}-${end}`),
    }
    selectTextareaLine(textarea as unknown as HTMLTextAreaElement, 2)
    expect(calls).toEqual(["focus", "select 4-7"])
  })
})
