import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { findFixedColours } from "./fixed-colours.ts"

const classes = (text: string) => findFixedColours(text).map((found) => found.className)

describe("findFixedColours", () => {
  it("finds every fixed palette step, white and black, with their variants", () => {
    const text = `class="text-gray-500 dark:bg-slate-800 hover:border-zinc-200 bg-neutral-50 ` +
      `ring-stone-300 bg-white text-black dark:hover:bg-black/50 divide-gray-100"`
    expect(classes(text)).toEqual([
      "text-gray-500",
      "dark:bg-slate-800",
      "hover:border-zinc-200",
      "bg-neutral-50",
      "ring-stone-300",
      "bg-white",
      "text-black",
      "dark:hover:bg-black/50",
      "divide-gray-100",
    ])
  })

  it("leaves token classes and other palettes alone", () => {
    const text = `class="bg-surface text-muted border-subtle bg-accent-900 text-red-600 ` +
      `bg-danger-fill text-whitespace-nowrap grayscale bg-gray"`
    expect(classes(text)).toEqual([])
  })

  it("reports the line of each class", () => {
    expect(findFixedColours("a\nb text-gray-900\n")).toEqual([
      { line: 2, className: "text-gray-900" },
    ])
  })
})
