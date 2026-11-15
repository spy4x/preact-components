import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  findOffScaleSpacing,
  findPhysicalDirection,
  SPACING_GAPS,
  SPACING_STEPS,
} from "./spacing.ts"

/** The classes `findOffScaleSpacing` reports in `source`, in order. */
function flagged(source: string): string[] {
  return findOffScaleSpacing(source).map((violation) => violation.className)
}

describe("SPACING_STEPS", () => {
  it("holds the nine steps from 4 px to 64 px after 0 and px", () => {
    expect([...SPACING_STEPS]).toEqual(["0", "px", "1", "2", "3", "4", "6", "8", "12", "16"])
  })

  it("names every layout gap after a step on the scale", () => {
    expect(SPACING_GAPS).toEqual({
      none: "0",
      xs: "1",
      sm: "2",
      md: "4",
      lg: "6",
      xl: "8",
      "2xl": "12",
    })
    for (const step of Object.values(SPACING_GAPS)) {
      expect(SPACING_STEPS as readonly string[]).toContain(step)
    }
  })
})

describe("findOffScaleSpacing", () => {
  it("accepts every step on the scale for every spacing utility", () => {
    const utilities = ["p", "px", "py", "pt", "m", "mx", "mb", "gap", "gap-x", "space-y"]
    const source = utilities.flatMap((u) => SPACING_STEPS.map((step) => `${u}-${step}`))
    expect(flagged(`<div class="${source.join(" ")}">`)).toEqual([])
  })

  it("reports a step between two on the scale", () => {
    expect(flagged(`<div class="p-5 mt-2.5 gap-1.5 px-0.5 py-10 pr-11 pt-20">`)).toEqual([
      "p-5",
      "mt-2.5",
      "gap-1.5",
      "px-0.5",
      "py-10",
      "pr-11",
      "pt-20",
    ])
  })

  it("reports the line, the column and a reason naming the step", () => {
    expect(findOffScaleSpacing(`const a = 1\n  <p class="text-sm p-5">`)).toEqual([
      {
        line: 2,
        column: 21,
        className: "p-5",
        reason: "step 5 is not on the scale (0 px 1 2 3 4 6 8 12 16)",
      },
    ])
  })

  it("keeps the variant prefix as part of the class", () => {
    expect(flagged(`class="sm:p-5 dark:hover:mt-7 md:gap-4 group-hover:px-2.5"`)).toEqual([
      "sm:p-5",
      "dark:hover:mt-7",
      "group-hover:px-2.5",
    ])
  })

  it("reads variants with brackets, like data-[open]: and [&>*]:", () => {
    expect(flagged(`class="data-[state=open]:p-5 [&>*]:mb-10 aria-[expanded]:p-4"`)).toEqual([
      "data-[state=open]:p-5",
      "[&>*]:mb-10",
    ])
  })

  it("reports a negative margin off the scale and accepts one on it", () => {
    expect(flagged(`class="-mt-2 -mx-px -mt-7 sm:-ml-5"`)).toEqual(["-mt-7", "sm:-ml-5"])
  })

  it("reads the important modifier on either side", () => {
    expect(flagged(`class="p-5! !mt-10 p-4!"`)).toEqual(["p-5!", "!mt-10"])
  })

  it("checks space-x and space-y and leaves their reverse alone", () => {
    expect(flagged(`class="space-x-2.5 space-y-5 space-y-4 space-x-reverse"`)).toEqual([
      "space-x-2.5",
      "space-y-5",
    ])
  })

  it("checks scroll margin and scroll padding", () => {
    expect(flagged(`class="scroll-mt-20 scroll-p-5 scroll-mx-4 scroll-pb-1.5"`)).toEqual([
      "scroll-mt-20",
      "scroll-p-5",
      "scroll-pb-1.5",
    ])
  })

  it("checks the logical sides ps, pe, ms and me", () => {
    expect(flagged(`class="ps-5 pe-4 ms-7 me-2"`)).toEqual(["ps-5", "ms-7"])
  })

  it("checks the classes on an @apply line in CSS", () => {
    const css = `.btn {\n  @apply flex gap-x-2.5 px-6 h-12;\n  @apply py-5;\n}`
    expect(findOffScaleSpacing(css).map(({ line, className }) => `${line} ${className}`)).toEqual([
      "2 gap-x-2.5",
      "3 py-5",
    ])
  })

  it("reports every arbitrary spacing value, on the scale or not", () => {
    expect(flagged(`class="p-[13px] gap-(--x) mt-[calc(1rem+2px)] -mb-[4px] px-[1rem]"`)).toEqual([
      "p-[13px]",
      "gap-(--x)",
      "mt-[calc(1rem+2px)]",
      "-mb-[4px]",
      "px-[1rem]",
    ])
    expect(findOffScaleSpacing(`p-[13px]`)[0].reason).toBe(
      "arbitrary spacing value [13px]; use a step from the scale",
    )
  })

  it("reports an arbitrary property that sets spacing, with its variants", () => {
    const source = `class="[padding:13px] md:[margin-top:calc(1rem+2px)]! [gap:4px] ` +
      `[padding-inline-start:1px] [row-gap:2px] [scroll-padding-top:3rem] hover:[margin:0]"`
    expect(flagged(source)).toEqual([
      "[padding:13px]",
      "md:[margin-top:calc(1rem+2px)]!",
      "[gap:4px]",
      "[padding-inline-start:1px]",
      "[row-gap:2px]",
      "[scroll-padding-top:3rem]",
      "hover:[margin:0]",
    ])
    expect(findOffScaleSpacing(`[padding:13px]`)[0].reason).toBe(
      "arbitrary spacing property padding; use a spacing utility with a step",
    )
  })

  it("leaves an arbitrary property that is not spacing alone", () => {
    expect(flagged(`class="[top:5px] [height:13px] [mask-type:luminance] [inset:2px]"`))
      .toEqual([])
  })

  it("reports the spacing function with an argument that is not a step", () => {
    const css = `.a {\n  padding: calc(--spacing(5) + 1px);\n  margin: --spacing(4);\n` +
      `  gap: --spacing( 12 );\n  top: --spacing(px);\n}`
    expect(findOffScaleSpacing(css).map(({ line, className }) => `${line} ${className}`)).toEqual([
      "2 --spacing(5)",
      "5 --spacing(px)",
    ])
    expect(findOffScaleSpacing(`--spacing(7)`)[0].reason).toBe(
      "--spacing(7) is not a step on the scale (0 1 2 3 4 6 8 12 16)",
    )
  })

  it("reports the spacing function inside an @apply arbitrary value too", () => {
    expect(flagged(`@apply p-[--spacing(3)] mt-[--spacing(5)];`)).toEqual([
      "p-[--spacing(3)]",
      "mt-[--spacing(5)]",
      "--spacing(5)",
    ])
  })

  it("leaves sizes, positions and other utilities that end in a number alone", () => {
    const source =
      `class="h-12 w-5 size-9 top-5 left-2.5 inset-2 -inset-x-7 max-w-6xl grid-cols-5 ` +
      `z-10 col-span-7 min-h-24 translate-x-5 border-2 rounded-md text-5xl mx-auto m-auto"`
    expect(flagged(source)).toEqual([])
  })

  it("does not read a spacing class out of a longer word or a custom property", () => {
    const source = `step-5 setup-10 laptop-5 --p-5 var(--m-7) item.p-5 /p-5/ $p-5 @m-5`
    expect(flagged(source)).toEqual([])
  })

  it("leaves prose that only looks like a class alone", () => {
    const prose = `// a gap-free layout, the p-value, an m-dash, top-5 lists and a 5-step plan`
    expect(flagged(prose)).toEqual([])
  })

  it("reports a class-shaped token inside a comment, because Tailwind reads comments too", () => {
    expect(flagged(`/* was p-5 before the snap */ // and mt-7.`)).toEqual(["p-5", "mt-7"])
  })

  it("finds classes in a template literal and a class map", () => {
    const source = 'const sizes = { sm: `px-2.5 py-1.5`, md: "px-4 py-2" }\n' +
      '<div class={`flex ${open ? "gap-5" : "gap-4"}`} />'
    expect(flagged(source)).toEqual(["px-2.5", "py-1.5", "gap-5"])
  })
})

/** Each physical class `findPhysicalDirection` reports in `source`, beside its logical class. */
function physical(source: string): string[] {
  return findPhysicalDirection(source).map((v) => `${v.className} → ${v.logical}`)
}

describe("findPhysicalDirection", () => {
  it("names the logical class for every physical margin, padding and scroll side", () => {
    expect(physical(`<div class="ml-2 mr-auto pl-4 pr-px scroll-ml-4 scroll-pr-2">`)).toEqual([
      "ml-2 → ms-2",
      "mr-auto → me-auto",
      "pl-4 → ps-4",
      "pr-px → pe-px",
      "scroll-ml-4 → scroll-ms-4",
      "scroll-pr-2 → scroll-pe-2",
    ])
  })

  it("names the logical class for every left and right inset", () => {
    expect(physical(`<i class="left-0 right-1.5 left-1/2 right-full left-[3px] right-(--x)">`))
      .toEqual([
        "left-0 → start-0",
        "right-1.5 → end-1.5",
        "left-1/2 → start-1/2",
        "right-full → end-full",
        "left-[3px] → start-[3px]",
        "right-(--x) → end-(--x)",
      ])
  })

  it("names the logical class for a padding or inset that clears one side's safe area", () => {
    expect(physical(`<aside class="pl-safe pr-safe-3 ml-safe left-safe right-safe-2">`)).toEqual([
      "pl-safe → ps-safe",
      "pr-safe-3 → pe-safe-3",
      "ml-safe → ms-safe",
      "left-safe → start-safe",
      "right-safe-2 → end-safe-2",
    ])
  })

  it("names the logical class for text alignment, float and clear", () => {
    expect(physical(`<p class="text-left text-right float-left float-right clear-left">`))
      .toEqual([
        "text-left → text-start",
        "text-right → text-end",
        "float-left → float-start",
        "float-right → float-end",
        "clear-left → clear-start",
      ])
  })

  it("names the logical class for a one-sided radius and border, with or without a value", () => {
    expect(
      physical(`<b class="rounded-l rounded-r-lg rounded-tl-none rounded-br-[4px] rounded-bl">`),
    ).toEqual([
      "rounded-l → rounded-s",
      "rounded-r-lg → rounded-e-lg",
      "rounded-tl-none → rounded-ss-none",
      "rounded-br-[4px] → rounded-ee-[4px]",
      "rounded-bl → rounded-es",
    ])
    expect(physical(`<b class="border-l border-r-2 border-l-red-500/50 border-r-transparent">`))
      .toEqual([
        "border-l → border-s",
        "border-r-2 → border-e-2",
        "border-l-red-500/50 → border-s-red-500/50",
        "border-r-transparent → border-e-transparent",
      ])
  })

  it("keeps variants, a negative sign and the important mark in the logical class", () => {
    expect(physical(`<a class="sm:-ml-4 hover:!pr-2 lg:last:pr-0 focus:left-4! @max-md:pr-0">`))
      .toEqual([
        "sm:-ml-4 → sm:-ms-4",
        "hover:!pr-2 → hover:!pe-2",
        "lg:last:pr-0 → lg:last:pe-0",
        "focus:left-4! → focus:start-4!",
        "@max-md:pr-0 → @max-md:pe-0",
      ])
  })

  it("accepts logical classes, both-sides classes and other words that share a prefix", () => {
    const source = `<div class="ms-2 me-auto ps-4 pe-px start-0 end-full text-start text-end ` +
      `rounded-s rounded-ee-lg border-s border-e-2 px-4 mx-auto inset-x-0 rounded-lg ` +
      `border-lime-500 text-lg space-x-2 float-start ps-safe pb-safe pb-safe-3 ` +
      `motion-safe:transition-colors">`
    expect(physical(source)).toEqual([])
  })

  it("accepts prose that names a side without a class's value", () => {
    expect(physical(`// a left-hand menu; right-click it; the left-to-right order; top-left`))
      .toEqual([])
  })

  it("accepts a physical class behind an rtl or ltr variant, which already picks a direction", () => {
    expect(physical(`<i class="rtl:mr-2 ltr:ml-2 md:rtl:left-0 rtl:text-right">`)).toEqual([])
  })

  it("reports the line, the column and a reason naming the logical class", () => {
    expect(findPhysicalDirection(`const a = 1\n  <p class="text-sm pl-4">`)).toEqual([
      {
        line: 2,
        column: 21,
        className: "pl-4",
        logical: "ps-4",
        reason: `pl is a physical side, which does not flip under dir="rtl"; use ps-4`,
      },
    ])
  })
})
