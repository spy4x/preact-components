import { assertEquals } from "@std/assert"
import { byName, parseRepeat, repeated } from "./select.ts"

const specs = [
  { name: `Shell: a plain click on a user-menu link goes through navigate` },
  { name: `Shell: the user menu closes on Escape` },
  { name: `TagInput: Backspace removes the last tag` },
]

Deno.test("keeps only the specs whose name contains the text, ignoring case", () => {
  assertEquals(byName(specs, `USER-MENU LINK`), [specs[0]])
  assertEquals(byName(specs, ` shell: `), [specs[0], specs[1]])
  assertEquals(byName(specs, `nosuchspec`), [])
})

Deno.test("reads a repeat count of at least 1", () => {
  assertEquals(parseRepeat(`20`), 20)
  assertEquals(parseRepeat(` 1 `), 1)
})

Deno.test("refuses a repeat count that is not a whole number of at least 1", () => {
  for (const text of [`0`, `-1`, `1.5`, `2x`, `x`, ``, ` `]) {
    assertEquals(parseRepeat(text), undefined, text)
  }
})

Deno.test("repeats the whole list in order, once per time", () => {
  assertEquals(repeated([`a`, `b`], 3), [`a`, `b`, `a`, `b`, `a`, `b`])
  assertEquals(repeated([`a`, `b`], 1), [`a`, `b`])
})
