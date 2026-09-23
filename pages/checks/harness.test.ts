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
import {
  BlockOutcome,
  type CheckBlock,
  connect,
  Devtools,
  DevtoolsClosedError,
  poll,
  Run,
} from "./harness.ts"

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
      {
        name: "the signals checks ran to completion",
        ok: false,
        detail: "deliberate (last completed check: theme)",
      },
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
      "  FAIL the ui checks ran to completion — deliberate (last completed check: theme)",
      "",
      "INCOMPLETE — 1/2 checks passed, but ui stopped part-way; " +
      "the totals count only the checks that ran",
    ])
  })
})

describe("poll", () => {
  it("stops immediately and rethrows once the predicate reports the connection is closed", async () => {
    // Left to the previous, unconditional `catch { /* retry */ }`, this would instead keep polling
    // for the rest of `timeoutMs` and resolve `false` — a dead browser reported as its own condition
    // never having become true, found in review as a kill mid-run once printing
    // `FAIL Toastr's own timer dismisses a toast`, not a word about the browser that had died.
    const error = new DevtoolsClosedError("the DevTools socket closed")
    let calls = 0

    const result = await poll(() => {
      calls++
      return Promise.reject(error)
    }, 5_000).catch((caught: unknown) => caught)

    expect(result).toBe(error)
    expect(calls).toBe(1)
  })

  it("keeps retrying past an ordinary transient error, until the predicate succeeds", async () => {
    let calls = 0

    const result = await poll(() => {
      calls++
      if (calls === 1) return Promise.reject(new Error("element not there yet"))
      return Promise.resolve(true)
    }, 5_000)

    expect(result).toBe(true)
    expect(calls).toBe(2)
  })

  it("keeps retrying past an ordinary transient error until the deadline, and returns false", async () => {
    let calls = 0

    const result = await poll(() => {
      calls++
      return Promise.reject(new Error("never ready"))
    }, 250)

    expect(result).toBe(false)
    expect(calls).toBeGreaterThan(1)
  })
})

describe("Run.runBlocks — failure detail", () => {
  it("names the last completed check next to the reason, when there was one", async () => {
    const run = new Run()
    await run.runBlocks(
      [passing("theme", ["a", "b"]), throwing("ui", new DevtoolsClosedError("socket closed"))],
      run,
    )

    expect(run.checks.at(-1)).toEqual({
      name: "the ui checks ran to completion",
      ok: false,
      detail: "socket closed (last completed check: b)",
    })
  })

  it("names only the reason when nothing had completed yet", async () => {
    const run = new Run()
    await run.runBlocks([throwing("theme", new Error("no Chromium"))], run)

    expect(run.checks).toEqual([
      { name: "the theme checks ran to completion", ok: false, detail: "no Chromium" },
    ])
  })

  it("does not name a previous block's own failure marker as a completed check", async () => {
    // `lastCheck` (the most recent entry, pass or fail) used to feed this detail directly — found in
    // review: when two blocks throw in a row, the second one's detail named the first block's own
    // "the theme checks ran to completion" — itself recorded with ok: false — as though it were a
    // check that had passed.
    const run = new Run()
    await run.runBlocks(
      [
        throwing("theme", new Error("first failure")),
        throwing("icons", new Error("second failure")),
      ],
      run,
    )

    expect(run.checks).toEqual([
      { name: "the theme checks ran to completion", ok: false, detail: "first failure" },
      { name: "the icons checks ran to completion", ok: false, detail: "second failure" },
    ])
  })

  it("skips a failed block's own marker to find the last check that actually passed", async () => {
    const run = new Run()
    await run.runBlocks(
      [
        passing("theme", ["a"]),
        throwing("icons", new Error("icons died")),
        throwing("ui-guide", new Error("ui-guide died")),
      ],
      run,
    )

    expect(run.checks.at(-1)).toEqual({
      name: "the ui-guide checks ran to completion",
      ok: false,
      detail: "ui-guide died (last completed check: a)",
    })
  })
})

describe("Devtools", () => {
  /** The subset of `WebSocket` `Devtools` actually uses, driven by hand instead of a real socket. */
  class FakeSocket {
    onopen: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    onclose: (() => void) | null = null
    onerror: (() => void) | null = null
    closed = false
    sent: string[] = []
    send(data: string): void {
      this.sent.push(data)
    }
    close(): void {
      this.closed = true
    }
  }

  /** Swaps the global `WebSocket` constructor for one that always hands back `socket`. */
  async function withFakeSocket<T>(socket: FakeSocket, run: () => Promise<T>): Promise<T> {
    const real = globalThis.WebSocket
    Object.defineProperty(globalThis, "WebSocket", {
      configurable: true,
      value: function FakeWebSocketConstructor() {
        return socket
      },
    })
    try {
      return await run()
    } finally {
      Object.defineProperty(globalThis, "WebSocket", { configurable: true, value: real })
    }
  }

  it("fails every pending and future call the moment the socket closes", async () => {
    const socket = new FakeSocket()
    await withFakeSocket(socket, async () => {
      const connecting = Devtools.connect("ws://fake")
      socket.onopen?.()
      const devtools = await connecting

      const pending = devtools.send("Runtime.enable", {})
      socket.onclose?.()

      const pendingOutcome = await pending.catch((error: unknown) => error)
      expect(pendingOutcome).toBeInstanceOf(DevtoolsClosedError)

      // A call made *after* the socket has already closed must fail exactly the same way, not hang
      // waiting for a reply that can never arrive.
      const futureOutcome = await devtools.send("Runtime.enable", {}).catch((error: unknown) =>
        error
      )
      expect(futureOutcome).toBeInstanceOf(DevtoolsClosedError)
    })
  })

  it("closes the socket when the open times out", async () => {
    const socket = new FakeSocket()
    const outcome = await withFakeSocket(
      socket,
      () => Devtools.connect("ws://fake", 10).catch((error: unknown) => error),
    )

    expect(outcome).toBeInstanceOf(Error)
    expect(socket.closed).toBe(true)
  })
})

describe("connect", () => {
  /**
   * Stands in for a debugging endpoint that accepts a request and never answers it — the shape
   * review used to catch `connect()` hanging past its own stated timeout: this never resolves or
   * rejects on its own, only when the `signal` it was given fires an abort. A `fetch` call made
   * without a `signal` at all — the pre-fix shape — never settles here, the same as it never would
   * against a real unresponsive server.
   */
  function neverAnswers(): typeof fetch {
    return ((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal
        if (!signal) return
        if (signal.aborted) {
          reject(signal.reason ?? new Error("aborted"))
          return
        }
        signal.addEventListener("abort", () => reject(signal.reason ?? new Error("aborted")))
      })
    }) as typeof fetch
  }

  it("aborts its request to the debugging endpoint instead of waiting on one that never answers", async () => {
    const realFetch = globalThis.fetch
    globalThis.fetch = neverAnswers()
    try {
      // A generous guard, well past connect()'s own 300ms budget: if the request were not aborted,
      // it would hang here indefinitely (`neverAnswers` above never settles without one), and this
      // is what turns that into a failed assertion instead of a hung test suite.
      const outcome = await Promise.race([
        connect(1, 300).then(() => "resolved" as const).catch(() => "rejected" as const),
        new Promise<"timed-out-waiting">((resolve) =>
          setTimeout(() => resolve("timed-out-waiting"), 2_000)
        ),
      ])

      expect(outcome).toBe("rejected")
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
