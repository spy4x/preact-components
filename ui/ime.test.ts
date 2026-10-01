import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { isImeKeyPress } from "./ime.ts"

describe("isImeKeyPress", () => {
  it("reads a key press sent while an input method composes as the input method's", () => {
    expect(isImeKeyPress({ isComposing: true, keyCode: 13 })).toBe(true)
  })

  it("reads Safari's composition-ending key press, keyCode 229 with isComposing false, as the input method's", () => {
    expect(isImeKeyPress({ isComposing: false, keyCode: 229 })).toBe(true)
  })

  it("leaves a plain Enter or Escape to the component", () => {
    expect(isImeKeyPress({ isComposing: false, keyCode: 13 })).toBe(false)
    expect(isImeKeyPress({ isComposing: false, keyCode: 27 })).toBe(false)
  })
})
