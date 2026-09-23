/**
 * The two parts of the run ledger a browser cannot prove: that one package block's throw is
 * contained, and that the last line of the report says so.
 *
 * `verify.ts` needs a real browser and seven minutes to answer either question, which is why the
 * isolation and the summary line live on {@link Run} — an object this file drives with fake blocks
 * in milliseconds. Every case here holds one axis still and varies another: where the throwing
 * block sits in the order, how many blocks throw, what kind of value is thrown, and whether the
 * block recorded any checks before it threw.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { BlockOutcome, type CheckBlock, Run } from "./harness.ts"

/** A block that records one passing check per name it is given and returns. */
function passing(name: string, checkNames: readonly string[] = [name]): CheckBlock<Run> {
  return {
    name,
    run: (run) => {
      for (const checkName of checkNames) run.record(checkName, true)
      return Promise.resolve()
    },
  }
}

/** A block that records nothing and throws `thrown`. */
function throwing(name: string, thrown: unknown): CheckBlock<Run> {
  return {
    name,
    // deno-lint-ignore require-await -- a `throw` in an async body is the rejected promise case.
    run: async () => {
      throw thrown
    },
  }
}

/** A block that records `before` passing checks and then throws. */
function throwingLate(name: string, before: readonly string[]): CheckBlock<Run> {
  return {
    name,
    // deno-lint-ignore require-await -- as above: the rejection has to come from an async call.
    run: async (run: Run) => {
      for (const checkName of before) run.record(checkName, true)
      throw new Error(`${name} gave up`)
    },
  }
}

/** The names of every check the run recorded, in order. */
function recorded(run: Run): string[] {
  return run.checks.map((entry) => entry.name)
}

describe("Run.runBlocks", () => {
  it("runs every later block when the first one throws", async () => {
    const run = new Run()
    await run.runBlocks(
      [throwing("theme", new Error("deliberate")), passing("signals"), passing("ui")],
      run,
    )

    expect(recorded(run)).toEqual([
      "the theme checks ran to completion",
      "signals",
      "ui",
    ])
  })

  it("runs every later block when a middle one throws", async () => {
    const run = new Run()
    await run.runBlocks(
      [passing("theme"), throwing("signals", new Error("deliberate")), passing("ui")],
      run,
    )

    expect(recorded(run)).toEqual([
      "theme",
      "the signals checks ran to completion",
      "ui",
    ])
  })

  it("keeps the earlier blocks' checks when the last one throws", async () => {
    const run = new Run()
    await run.runBlocks(
      [passing("theme"), passing("signals"), throwing("ui", new Error("deliberate"))],
      run,
    )

    expect(recorded(run)).toEqual([
      "theme",
      "signals",
      "the ui checks ran to completion",
    ])
  })

  it("names the package whose checks threw, and only that package", async () => {
    const run = new Run()
    await run.runBlocks([passing("theme"), throwing("signals", new Error("deliberate"))], run)

    const failed = run.checks.filter((entry) => !entry.ok)
    expect(failed).toEqual([
      { name: "the signals checks ran to completion", ok: false, detail: "deliberate" },
    ])
  })

  it("keeps the checks a block recorded before it threw", async () => {
    const run = new Run()
    await run.runBlocks(
      [throwingLate("system", ["calendar grid", "lightbox opens"]), passing("ui")],
      run,
    )

    expect(recorded(run)).toEqual([
      "calendar grid",
      "lightbox opens",
      "the system checks ran to completion",
      "ui",
    ])
  })

  it("reports a thrown string the same way as a thrown Error", async () => {
    const run = new Run()
    await run.runBlocks([throwing("icons", "no such element"), passing("ui")], run)

    expect(run.checks[0]).toEqual({
      name: "the icons checks ran to completion",
      ok: false,
      detail: "no such element",
    })
    expect(recorded(run)).toContain("ui")
  })

  it("reports a rejected promise the same way as a throw", async () => {
    const run = new Run()
    const rejecting: CheckBlock<Run> = {
      name: "pages",
      run: () => Promise.reject(new Error("the click never landed")),
    }
    await run.runBlocks([rejecting, passing("ui")], run)

    expect(run.checks[0]).toEqual({
      name: "the pages checks ran to completion",
      ok: false,
      detail: "the click never landed",
    })
    expect(recorded(run)).toContain("ui")
  })

  it("contains two throwing blocks independently", async () => {
    const run = new Run()
    await run.runBlocks(
      [
        throwing("theme", new Error("first")),
        passing("pages"),
        throwing("signals", "second"),
        passing("ui"),
      ],
      run,
    )

    expect(recorded(run)).toEqual([
      "the theme checks ran to completion",
      "pages",
      "the signals checks ran to completion",
      "ui",
    ])
    expect(run.failures()).toBe(2)
  })

  it("records each block's outcome", async () => {
    const run = new Run()
    await run.runBlocks([passing("theme"), throwing("ui", new Error("deliberate"))], run)

    expect([...run.blocks]).toEqual([
      ["theme", BlockOutcome.Completed],
      ["ui", BlockOutcome.StoppedPartWay],
    ])
  })

  it("leaves a committed block that was never reached as never run", async () => {
    const run = new Run()
    run.commit(["theme", "signals", "ui"])
    await run.runBlocks([passing("theme")], run)

    expect([...run.blocks]).toEqual([
      ["theme", BlockOutcome.Completed],
      ["signals", BlockOutcome.NeverRan],
      ["ui", BlockOutcome.NeverRan],
    ])
  })

  it("exposes which block is currently running, and nothing between or after them", async () => {
    const run = new Run()
    const seen: Array<string | undefined> = []
    const watching = (name: string): CheckBlock<Run> => ({
      name,
      run: (ctx) => {
        seen.push(ctx.currentBlock)
        return Promise.resolve()
      },
    })

    expect(run.currentBlock).toBeUndefined()
    await run.runBlocks([watching("theme"), watching("ui")], run)

    expect(seen).toEqual(["theme", "ui"])
    expect(run.currentBlock).toBeUndefined()
  })

  it("still names the block that threw while its recovery runs", async () => {
    const run = new Run()
    let duringRecovery: string | undefined
    await run.runBlocks(
      [throwing("theme", new Error("deliberate")), passing("ui")],
      run,
      (ctx) => {
        duringRecovery = ctx.currentBlock
        return Promise.resolve()
      },
    )

    expect(duringRecovery).toBe("theme")
    expect(run.currentBlock).toBeUndefined()
  })
})

describe("Run.lastCheck", () => {
  it("is undefined before the first check", () => {
    const run = new Run()
    expect(run.lastCheck).toBeUndefined()
  })

  it("is the most recently recorded check", () => {
    const run = new Run()
    run.record("a", true)
    run.record("b", false, "why")

    expect(run.lastCheck).toEqual({ name: "b", ok: false, detail: "why" })
  })
})

describe("Run.runBlocks recovery", () => {
  it("recovers only after a block that threw", async () => {
    const run = new Run()
    const recovered: number[] = []
    await run.runBlocks(
      [passing("theme"), throwing("signals", new Error("deliberate")), passing("ui")],
      run,
      () => {
        recovered.push(run.checks.length)
        return Promise.resolve()
      },
    )

    expect(recovered).toEqual([2])
  })

  it("keeps running when the recovery itself fails", async () => {
    const run = new Run()
    await run.runBlocks(
      [throwing("theme", new Error("deliberate")), passing("ui")],
      run,
      () => Promise.reject(new Error("the page stopped answering")),
    )

    expect(recorded(run)).toEqual(["the theme checks ran to completion", "ui"])
  })
})

describe("Run.summaryLine", () => {
  it("says every block ran when none was lost", async () => {
    const run = new Run()
    await run.runBlocks([passing("theme", ["a", "b"]), passing("ui", ["c"])], run)

    expect(run.summaryLine()).toBe("3/3 checks passed — all 2 package blocks ran to completion")
  })

  it("names the lost block and marks the totals incomplete", async () => {
    const run = new Run()
    await run.runBlocks(
      [passing("theme", ["a", "b"]), throwing("ui", new Error("deliberate"))],
      run,
    )

    expect(run.summaryLine()).toBe(
      "INCOMPLETE — 2/3 checks passed, but ui stopped part-way; " +
        "the totals count only the checks that ran",
    )
  })

  it("names every lost block when more than one throws", async () => {
    const run = new Run()
    await run.runBlocks(
      [throwing("theme", "first"), passing("pages"), throwing("ui", "second")],
      run,
    )

    expect(run.summaryLine()).toBe(
      "INCOMPLETE — 1/3 checks passed, but theme, ui stopped part-way; " +
        "the totals count only the checks that ran",
    )
  })

  it("separates blocks that stopped part-way from blocks that never ran", async () => {
    const run = new Run()
    run.commit(["theme", "signals", "crud", "ui"])
    await run.runBlocks([passing("theme"), throwing("signals", "gave up")], run)

    expect(run.summaryLine()).toBe(
      "INCOMPLETE — 1/2 checks passed, but signals stopped part-way and crud, ui never ran; " +
        "the totals count only the checks that ran",
    )
  })

  it("marks a phase that died before reaching any block", () => {
    const run = new Run()
    run.commit(["theme", "ui"])
    run.record("a Chromium binary is available for the browser phase", false, "none ran")

    expect(run.summaryLine()).toBe(
      "INCOMPLETE — 0/1 checks passed, but theme, ui never ran; " +
        "the totals count only the checks that ran",
    )
  })

  it("claims no lost block when the run committed to none", () => {
    const run = new Run()
    run.record("stylesheet href is base-prefixed", true)

    expect(run.summaryLine()).toBe("1/1 checks passed — no package blocks were part of this run")
  })
})

describe("Run.reportLines", () => {
  it("prints one line per check, a blank line, then the summary", async () => {
    const run = new Run()
    await run.runBlocks([passing("theme"), throwing("ui", new Error("deliberate"))], run)

    expect(run.reportLines()).toEqual([
      "  ok   theme",
      "  FAIL the ui checks ran to completion — deliberate",
      "",
      "INCOMPLETE — 1/2 checks passed, but ui stopped part-way; " +
      "the totals count only the checks that ran",
    ])
  })
})
