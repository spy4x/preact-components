import { assert, assertAlmostEquals, assertEquals } from "@std/assert"
import { describe, it } from "@std/testing/bdd"
import {
  extent,
  linearScale,
  niceScale,
  niceStep,
  paddedDomain,
  ticks,
  xLabelStride,
} from "./scales.ts"

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

// The sanitizers would flag the worker's asynchronous teardown as a leaked resource.
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

describe("niceStep", () => {
  it("returns 1 for spans it cannot scale", () => {
    assertEquals(niceStep(0), 1)
    assertEquals(niceStep(-3), 1)
    assertEquals(niceStep(NaN), 1)
    assertEquals(niceStep(Infinity), 1)
  })

  it("picks a sensible magnitude for the requested target", () => {
    assertEquals(niceStep(12), 2)
    assertEquals(niceStep(80), 20)
    assertEquals(niceStep(250), 40)
    assertEquals(niceStep(9_500), 2_000)
  })

  it("scales the step with the target tick count", () => {
    assertEquals(niceStep(100, 10), 10)
    assertEquals(niceStep(100, 2), 50)
    assertEquals(niceStep(100, 1), 100)
  })

  it("falls back to the default target for a garbage target", () => {
    assertEquals(niceStep(100, 0), niceStep(100))
    assertEquals(niceStep(100, NaN), niceStep(100))
    assertEquals(niceStep(100, -4), niceStep(100))
  })

  it("floors a fractional target instead of producing fractional steps", () => {
    assertEquals(niceStep(100, 4.9), niceStep(100, 4))
  })

  it("keeps a readable step for tiny spans", () => {
    assertAlmostEquals(niceStep(1e-12), 2e-13, 1e-25)
    assertAlmostEquals(niceStep(1e-9, 10), 1e-10, 1e-20)
  })

  it("keeps a finite step for huge spans", () => {
    assertEquals(niceStep(2e18), 4e17)
    assertEquals(niceStep(1e300) > 0, true)
    assert(Number.isFinite(niceStep(1e300)))
  })

  it("never returns a subnormal or zero step", () => {
    for (const span of [Number.MIN_VALUE, 5e-324, 1e-320, 1e-310]) {
      const step = niceStep(span)
      assert(step > 0, `step for span ${span} was ${step}`)
      assert(Number.isFinite(step), `step for span ${span} was ${step}`)
    }
  })

  it("lands on roughly the requested number of steps for spans 1e-12..1e12", () => {
    for (let exponent = -12; exponent <= 12; exponent++) {
      for (const multiplier of [1, 2.5, 7.5]) {
        const span = multiplier * 10 ** exponent
        const count = ticks(0, span, 5).length
        assert(count >= 5 && count <= 8, `span ${span} produced ${count} ticks`)
      }
    }
  })
})

describe("ticks", () => {
  it("returns a single value when min equals max", () => {
    assertEquals(ticks(4, 4), [4])
    assertEquals(ticks(0, 0), [0])
    assertEquals(ticks(-3.5, -3.5), [-3.5])
  })

  it("expands outward to the next nice step", () => {
    assertEquals(ticks(0, 1), [0, 0.2, 0.4, 0.6, 0.8, 1])
    assertEquals(ticks(2, 6), [2, 3, 4, 5, 6])
  })

  it("covers negative ranges", () => {
    assertEquals(ticks(-10, -2), [-10, -8, -6, -4, -2])
    // The axis may reach half a step outside the data on either end.
    assertEquals(ticks(-5, 5), [-6, -4, -2, 0, 2, 4, 6])
  })

  it("treats reversed bounds as the same range", () => {
    assertEquals(ticks(6, 2), ticks(2, 6))
    assertEquals(ticks(1, -1), ticks(-1, 1))
  })

  it("returns an empty axis for non-finite bounds", () => {
    assertEquals(ticks(NaN, 10), [])
    assertEquals(ticks(0, Infinity), [])
    assertEquals(ticks(-Infinity, Infinity), [])
  })

  it("keeps distinct values for a span far below one unit", () => {
    const values = ticks(0, 1e-12)

    assertEquals(values.length, 6)
    assertEquals(new Set(values).size, 6)
    assertAlmostEquals(values[1], 2e-13, 1e-25)
    assertAlmostEquals(values[5], 1e-12, 1e-25)
  })

  it("does not collapse a sub-nanosecond range to zero", () => {
    const values = ticks(1e-15, 5e-15)

    assert(values.length >= 3, `expected a usable axis, got ${values}`)
    assert(values.every((value) => value > 0))
  })

  it("stays usable across a span of 1e36", () => {
    const values = ticks(-1e18, 1e18)

    assert(values.length >= 5 && values.length <= 8, `got ${values.length} ticks`)
    assert(values.some((value) => value === 0), `expected a zero tick, got ${values}`)
    assertTickInvariants(values, 4e17)
  })

  it("returns about target + 1 ticks, bounds inclusive", () => {
    assertEquals(ticks(0, 100, 10).length, 11)
    assertEquals(ticks(0, 100, 5).length, 6)
    assertEquals(ticks(0, 100, 1).length, 2)
    assertEquals(ticks(0, 100, 2).length, 3)
  })

  it("never returns more than about the requested tick count plus a buffer", () => {
    for (const target of [1, 2, 3, 4, 5, 8, 10, 20]) {
      const count = ticks(0, 37.5, target).length
      assert(count <= target + 2, `target ${target} produced ${count} ticks`)
      assert(count >= 2, `target ${target} produced ${count} ticks`)
    }
  })

  it("returns strictly increasing ticks for an awkward span", () => {
    const values = ticks(0.9, 1.1)

    assertTickInvariants(values, 0.04)
    assert(values[0] >= 0.9 - 0.02, `${values[0]} starts before the range`)
    assert(values[values.length - 1] <= 1.1 + 0.02, `axis ends after the range`)
  })

  it("keeps ticks inside the padded bounds for a large negative span", () => {
    const values = ticks(-9_500, -50)

    assertTickInvariants(values, niceStep(9_450))
    assert(values[0] >= -9_500 - niceStep(9_450) / 2)
  })

  it("tolerates a garbage tick target", () => {
    assertEquals(ticks(0, 100, 0), ticks(0, 100))
    assertEquals(ticks(0, 100, NaN), ticks(0, 100))
  })
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
