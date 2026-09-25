import { assert, assertAlmostEquals, assertEquals } from "@std/assert"
import { describe, it } from "@std/testing/bdd"
import { extent, linearScale, niceScale, paddedDomain, xLabelStride } from "./scales.ts"

// `niceStep` and `ticks` themselves — the pair now imported from `@spy4x/platform/universal/axis`
// (spy4x/ts-libs#70) — are tested once, there; `axis.test.ts` covers most of the cases this file
// used to, but not the subnormal-span sweep (`Number.MIN_VALUE`, `1e-320`, `1e-310`),
// `ticks(-1e18, 1e18)` or the 1e-12..1e12 target sweep — see "Needs ts-libs" in the PR body. The
// termination regression below stays: it proves `./scales.ts`'s own re-export still behaves, not
// just the upstream implementation in isolation.

/** Every tick must be a multiple of `step`, allowing for float noise at extreme magnitudes. */
function assertTickInvariants(values: number[], step: number): void {
  for (let index = 0; index < values.length; index++) {
    const remainder = Math.abs(values[index] / step - Math.round(values[index] / step))
    assert(remainder < 1e-6, `tick ${values[index]} is not a multiple of ${step}`)
    if (index > 0) {
      assert(values[index] > values[index - 1], `ticks are not strictly increasing: ${values}`)
    }
  }
}

/**
 * Call `ticks` in a worker and give up after `timeoutMs`.
 *
 * A tick loop that cannot advance its cursor never returns, and `deno test` has no per-test timeout,
 * so an in-process call would hang the suite rather than fail it. Returns `"timeout"` when the
 * worker neither answered nor crashed in time.
 */
async function probeTicks(
  request: { min: number; max: number; maxTicks?: number },
  timeoutMs: number,
): Promise<number[] | "timeout"> {
  const worker = new Worker(new URL("./ticks.worker.ts", import.meta.url), { type: "module" })

  try {
    return await new Promise<number[] | "timeout">((resolve) => {
      const timer = setTimeout(() => resolve("timeout"), timeoutMs)
      worker.onmessage = (event: MessageEvent<number[]>) => {
        clearTimeout(timer)
        resolve(event.data)
      }
      worker.onerror = () => {
        clearTimeout(timer)
        resolve("timeout")
      }
      worker.postMessage(request)
    })
  } finally {
    worker.terminate()
  }
}

// Sanitizers are disabled because the worker terminates asynchronously; the promise settles via
// the message handler, the error handler or the deadline, and `terminate()` runs in `finally`.
Deno.test({
  name: "ticks - terminates when the step is smaller than the float precision",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    // 1e18 + 100 is not representable: it rounds to 1e18 + 128, and one ulp at 1e18 is 128 while the
    // nice step is 20. A loop that advances with `v += step` therefore never moves — the source ran
    // forever here. The index-driven loop returns the two representable bounds.
    const min = 1e18
    const max = 1e18 + 100
    const result = await probeTicks({ min, max }, 2_000)

    if (result === "timeout") {
      throw new Error(
        `ticks(${min}, ${max}) did not terminate within 2000ms: the tick loop must not advance its cursor with \`v += step\``,
      )
    }

    assertEquals(result.length, 2)
    assertEquals(result[0], min)
    assertEquals(result[1], max)
  },
})

/**
 * Call `niceScale` in a worker and give up after `timeoutMs`.
 *
 * `niceScale`'s own `ticksForStep` can loop as many times as an absurd `target` option asks for;
 * see the deadline note on `probeTicks` above for why this runs off the main thread.
 */
async function probeNiceScale(
  request: { min: number; max: number; options?: { target?: number; padRatio?: number } },
  timeoutMs: number,
): Promise<number[] | "timeout"> {
  const worker = new Worker(new URL("./nice-scale.worker.ts", import.meta.url), { type: "module" })

  try {
    return await new Promise<number[] | "timeout">((resolve) => {
      const timer = setTimeout(() => resolve("timeout"), timeoutMs)
      worker.onmessage = (event: MessageEvent<number[]>) => {
        clearTimeout(timer)
        resolve(event.data)
      }
      worker.onerror = () => {
        clearTimeout(timer)
        resolve("timeout")
      }
      worker.postMessage(request)
    })
  } finally {
    worker.terminate()
  }
}

// Sanitizers are disabled for the same reason as the `ticks` termination test above.
Deno.test({
  name: "niceScale - terminates for an absurd tick target instead of hanging",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    // A target of 1e25 makes niceStep's step many orders of magnitude smaller than the float
    // precision at this magnitude, so `ticksForStep`'s index climbed toward a `steps` of 1e25 while
    // `out.length` almost stopped growing — `out.length < MAX_TICKS` alone never stopped the loop.
    // This shipped on `main` (spy4x/preact-components#123) until the same fix landed in
    // `@spy4x/platform/universal/axis` (spy4x/ts-libs#70) and was ported back here.
    const min = 1e6
    const max = 2e6
    const result = await probeNiceScale({ min, max, options: { target: 1e25 } }, 2_000)

    if (result === "timeout") {
      throw new Error(
        `niceScale(${min}, ${max}, { target: 1e25 }) did not terminate within 2000ms: ` +
          "ticksForStep must cap its loop at MAX_TICKS iterations, not just its output length",
      )
    }

    assert(result.length >= 1, `expected at least one tick, got ${result}`)
  },
})

describe("extent", () => {
  it("returns null when nothing is plottable", () => {
    assertEquals(extent([]), null)
    assertEquals(extent([NaN, Infinity, -Infinity]), null)
  })

  it("ignores non-finite entries", () => {
    assertEquals(extent([-1, NaN, 5, Infinity, 3]), [-1, 5])
  })

  it("handles a single finite value", () => {
    assertEquals(extent([7]), [7, 7])
  })
})

describe("paddedDomain", () => {
  it("pads a span by 10% on both sides by default", () => {
    assertEquals(paddedDomain(0, 100), { min: -10, max: 110 })
  })

  it("honours the pad ratio and rejects a negative one", () => {
    assertEquals(paddedDomain(0, 100, 0.5), { min: -50, max: 150 })
    assertEquals(paddedDomain(0, 100, 0), { min: 0, max: 100 })
    assertEquals(paddedDomain(0, 100, -1), { min: 0, max: 100 })
  })

  it("expands a degenerate domain around the value", () => {
    assertEquals(paddedDomain(5, 5), { min: 4.5, max: 5.5 })
    assertEquals(paddedDomain(-5, -5), { min: -5.5, max: -4.5 })
    assertEquals(paddedDomain(0, 0), { min: -1, max: 1 })
  })

  it("falls back to a plottable domain for non-finite input", () => {
    assertEquals(paddedDomain(NaN, 5), { min: 0, max: 1 })
    assertEquals(paddedDomain(0, Infinity), { min: 0, max: 1 })
  })

  it("sorts reversed bounds", () => {
    assertEquals(paddedDomain(100, 0), paddedDomain(0, 100))
  })

  it("keeps a degenerate domain non-empty even without padding", () => {
    const domain = paddedDomain(7, 7, 0)

    assert(domain.max > domain.min, `degenerate domain collapsed: ${JSON.stringify(domain)}`)
  })
})

describe("niceScale", () => {
  it("rounds the domain outward to multiples of the step", () => {
    const scale = niceScale(0, 100)

    assertEquals(scale.step, 20)
    assertEquals(scale.min, -20)
    assertEquals(scale.max, 120)
    assertEquals(scale.ticks, [-20, 0, 20, 40, 60, 80, 100, 120])
  })

  it("produces a usable domain for a single-value series", () => {
    const scale = niceScale(5, 5)

    assert(scale.max > scale.min, "degenerate input produced a degenerate domain")
    assert(scale.ticks.length >= 2, `expected at least two ticks, got ${scale.ticks}`)
    assertEquals(scale.ticks.includes(5), true)
  })

  it("produces a usable domain for an all-zero series", () => {
    const scale = niceScale(0, 0)

    assertEquals(scale.min, -1.2)
    assertEquals(scale.max, 1.2)
    assertEquals(scale.ticks.includes(0), true)
  })

  it("keeps every tick inside the bounds and on the step", () => {
    for (const [min, max] of [[0, 1], [-3, 7], [1e-9, 3e-9], [-1e15, 4e15], [0.4, 0.6]]) {
      const scale = niceScale(min, max)

      assertTickInvariants(scale.ticks, scale.step)
      assert(scale.ticks[0] >= scale.min, `tick below min for [${min}, ${max}]`)
      assert(
        scale.ticks[scale.ticks.length - 1] <= scale.max,
        `tick above max for [${min}, ${max}]`,
      )
      assert(scale.min <= min, `domain min ${scale.min} excludes data for [${min}, ${max}]`)
      assert(scale.max >= max, `domain max ${scale.max} excludes data for [${min}, ${max}]`)
    }
  })

  it("ends the domain on exact multiples of the step", () => {
    const scale = niceScale(0, 1)

    assertEquals(scale.max, 1.2)
    assertEquals(scale.min, -0.2)
    assertEquals(scale.ticks, [-0.2, 0, 0.2, 0.4, 0.6, 0.8, 1, 1.2])
  })

  it("honours a requested tick target", () => {
    assertEquals(niceScale(0, 100, { target: 10 }).ticks.length, 13)
    assertEquals(niceScale(0, 100, { target: 2 }).ticks.length, 5)
  })

  it("does not shrink a data range with a zero pad ratio", () => {
    const scale = niceScale(-8, 42, { padRatio: 0 })

    assert(scale.min <= -8)
    assert(scale.max >= 42)
  })

  it("handles a huge span without losing the endpoints", () => {
    const scale = niceScale(-1e18, 1e18)

    assert(scale.min <= -1e18)
    assert(scale.max >= 1e18)
    assert(scale.ticks.length >= 5)
  })

  it("handles a tiny span", () => {
    const scale = niceScale(0, 1e-12)

    assertEquals(scale.ticks.length, 8)
    assertEquals(new Set(scale.ticks).size, 8)
    assertAlmostEquals(scale.min, -2e-13, 1e-26)
    assertAlmostEquals(scale.max, 1.2e-12, 1e-25)
  })
})

describe("linearScale", () => {
  it("maps the domain ends onto the range ends", () => {
    const scale = linearScale([0, 10], [0, 100])

    assertEquals(scale(0), 0)
    assertEquals(scale(5), 50)
    assertEquals(scale(10), 100)
  })

  it("supports a flipped range for a Y axis", () => {
    const scale = linearScale([0, 10], [100, 0])

    assertEquals(scale(0), 100)
    assertEquals(scale(10), 0)
    assertEquals(scale(2.5), 75)
  })

  it("maps a degenerate domain to the middle of the range", () => {
    const scale = linearScale([4, 4], [0, 100])

    assertEquals(scale(4), 50)
    assertEquals(scale(0), 50)
  })

  it("maps non-finite values to the middle instead of NaN", () => {
    const scale = linearScale([0, 10], [0, 100])

    assertEquals(scale(NaN), 50)
    assertEquals(scale(Infinity), 50)
  })

  it("maps a non-finite domain to the middle", () => {
    assertEquals(linearScale([0, Infinity], [0, 100])(5), 50)
  })

  it("extrapolates outside the domain", () => {
    assertEquals(linearScale([0, 10], [0, 100])(12), 120)
  })
})

describe("xLabelStride", () => {
  it("keeps a short axis labelled on every point", () => {
    assertEquals(xLabelStride(8), 1)
    assertEquals(xLabelStride(1), 1)
    assertEquals(xLabelStride(0), 1)
  })

  it("thins a dense axis down to the label budget", () => {
    assertEquals(xLabelStride(10), 2)
    assertEquals(xLabelStride(100), 13)
    assertEquals(xLabelStride(1000, 8), 125)
  })

  it("honours a custom label budget", () => {
    assertEquals(xLabelStride(10, 2), 5)
    assertEquals(xLabelStride(10, 1), 10)
  })

  it("falls back to the default budget for garbage input", () => {
    assertEquals(xLabelStride(100, 0), xLabelStride(100))
    assertEquals(xLabelStride(100, NaN), xLabelStride(100))
    assertEquals(xLabelStride(NaN), 1)
  })
})
