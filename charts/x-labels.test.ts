import { assert, assertEquals } from "@std/assert"
import { describe, it } from "@std/testing/bdd"
import { type AxisLabel, fitXLabels } from "./x-labels.ts"

describe("fitXLabels", () => {
  /** Thirty daily labels, "Oct 1" to "Oct 30", spread evenly across the axis. */
  const days: AxisLabel[] = Array.from({ length: 30 }, (_, index) => ({
    position: index / 29,
    label: `Oct ${index + 1}`,
  }))

  /** The pixel span of a label at 7 px a character, placed as `LineChart` draws it. */
  function span({ position, label }: AxisLabel, width: number): [number, number] {
    const size = label.length * 7
    const at = position * width
    if (position < 0.05) return [at, at + size]
    if (position > 0.95) return [at - size, at]
    return [at - size / 2, at + size / 2]
  }

  for (const width of [320, 1280]) {
    it(`keeps 30 daily labels apart at ${width} px, the first and the last among them`, () => {
      const kept = fitXLabels(days, width)

      assertEquals(kept[0].label, "Oct 1")
      assertEquals(kept.at(-1)?.label, "Oct 30")
      for (let index = 1; index < kept.length; index++) {
        const gap = span(kept[index], width)[0] - span(kept[index - 1], width)[1]
        assert(gap >= 8, `"${kept[index - 1].label}" and "${kept[index].label}" are ${gap}px apart`)
      }
    })
  }

  it("keeps more labels on a wide axis than on a narrow one", () => {
    assert(fitXLabels(days, 1280).length > fitXLabels(days, 320).length)
  })

  it("keeps every label when each has room", () => {
    assertEquals(fitXLabels(days, 5000), days)
  })

  it("drops the label before the last one when the two would touch", () => {
    const labels: AxisLabel[] = [0, 0.5, 0.9, 1].map((position) => ({ position, label: "Oct 10" }))

    assertEquals(fitXLabels(labels, 300).map((item) => item.position), [0, 0.5, 1])
  })

  it("keeps only the first label when even the first and the last overlap", () => {
    assertEquals(fitXLabels(days, 40), [days[0]])
  })

  it("keeps every label when the width is unknown", () => {
    assertEquals(fitXLabels(days, 0), days)
    assertEquals(fitXLabels(days, NaN), days)
  })
})
