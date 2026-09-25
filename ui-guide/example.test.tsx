import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { UIGuide } from "./+index.tsx"
import { exampleDemos, formatOutput } from "./example.tsx"
import { exampleDemos as registeredExamples } from "./registry.ts"

describe("example cards", () => {
  it("run the export when the card renders, not when the section is built", () => {
    let calls = 0
    const cards = exampleDemos({
      counter: {
        title: "counter()",
        summary: "Counts its own calls.",
        snippet: "counter()",
        covers: ["counter"],
        run: () => ({ calls: ++calls }),
      },
    })
    expect(calls).toBe(0)

    expect(render(<>{cards.counter.render()}</>)).toContain("&quot;calls&quot;: 1")
    expect(render(<>{cards.counter.render()}</>)).toContain("&quot;calls&quot;: 2")
  })

  it("render on their package's page with their title, output and open code", () => {
    const html = render(<UIGuide hash="#/signals" />)
    const [key, example] = Object.entries(registeredExamples).find(([, demo]) =>
      demo.covers.includes("toggleSort")
    )!

    const card = html.match(new RegExp(`<article id="demo-${key}"[\\s\\S]*?</article>`))?.[0]
    expect(card, "the card is on the signals page").toBeDefined()
    expect(card).toContain(example.title)
    expect(card).toContain(`data-e2e="example-output"`)
    expect(card).toMatch(/<details[^>]* open/)
    expect(render(<UIGuide hash="#/ui" />), "not on another page").not.toContain(`demo-${key}"`)
  })
})

describe("formatOutput", () => {
  it("prints JSON, and names what JSON would drop", () => {
    expect(formatOutput("px-4")).toBe(`"px-4"`)
    expect(formatOutput([1, "a"])).toBe(`[\n  1,\n  "a"\n]`)
    expect(formatOutput(undefined)).toBe(`"<undefined>"`)
    expect(formatOutput(function named() {})).toBe(`"<function named>"`)
    expect(formatOutput(10n)).toBe(`"10n"`)
    expect(formatOutput(new Map([["a", 1]]))).toBe(`{\n  "a": 1\n}`)
    expect(formatOutput(new Set([1]))).toBe(`[\n  1\n]`)
  })
})
