import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { quietOutput } from "./quiet.ts"

const run = `running 2 tests from ./a.test.ts\none ... ok (1ms)\ntwo ... ok (1ms)\n\n`

describe("quietOutput", () => {
  it("keeps only the summary line of a passing run", () => {
    expect(quietOutput(`${run}ok | 2 passed | 0 failed (5ms)\n`, true)).toBe(
      `ok | 2 passed | 0 failed (5ms)\n`,
    )
  })

  it("finds the summary line through terminal colours", () => {
    const coloured = `${run}\x1b[0m\x1b[32mok\x1b[0m | 2 passed | 0 failed\n`
    expect(quietOutput(coloured, true)).toBe(`\x1b[0m\x1b[32mok\x1b[0m | 2 passed | 0 failed\n`)
  })

  it("prints all of a failing run", () => {
    const failed = `${run}ERRORS\ntwo => ./a.test.ts:2:6\nFAILED | 1 passed | 1 failed\n`
    expect(quietOutput(failed, false)).toBe(failed)
  })

  it("prints all of a passing run that has no summary line", () => {
    expect(quietOutput(`Checked 3 files\n`, true)).toBe(`Checked 3 files\n`)
  })
})
