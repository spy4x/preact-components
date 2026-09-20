/**
 * Guards the `roley` bookkeeping in `README.md`.
 *
 * `README.md` keeps claiming more than the code does — four counts in the round-2 review alone — and
 * every attempt to fix it by editing sentences produced a new wrong number, because the numbers only
 * existed in prose. A hand-kept count is the failure mode, exactly as `ui-guide/classes.test.tsx`
 * argues for classes; this is the same shape of guard for the merge ledger.
 *
 * The audit itself lives in `check-readme.ts` so it can also be run by hand for the full report:
 *
 * ```bash
 * deno run --allow-read icons/check-readme.ts
 * ```
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { audit, BARREL_EXPORTED, ROLEY_FILES } from "./check-readme.ts"

const { findings, checked } = await audit()

describe("roley bookkeeping in README.md", () => {
  it("accounts for every file in the pinned roley inventory", () => {
    // The pinned list is the expected set. It is deliberately not read from README.md, which is the
    // file under test, and not derived from `+index.tsx`, which is what the README describes.
    expect(ROLEY_FILES.length).toBe(52)
    expect(new Set(ROLEY_FILES).size).toBe(ROLEY_FILES.length)
    expect(BARREL_EXPORTED.length).toBe(49)
  })

  it("agrees with the module and with roley, naming every mismatch", () => {
    // One assertion per finding so a red run reads as a list of named defects rather than a count.
    expect(
      findings.map((finding) => `${finding.case}: ${finding.detail}`),
      `${findings.length} finding(s); ${checked.length} check(s) passed`,
    ).toEqual([])
  })
})
