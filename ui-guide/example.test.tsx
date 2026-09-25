import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { UIGuide } from "./+index.tsx"
import { formatOutput, toExampleDemos } from "./example.tsx"
import { exampleDemos } from "./registry.ts"

describe("example cards", () => {
  it("run the export when the card renders, not when the section is built", () => {
    let calls = 0
    const cards = toExampleDemos({
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
    const [key, example] = Object.entries(exampleDemos).find(([, demo]) =>
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

describe("every registered example", () => {
  it("calls each export it covers, in its snippet and in its run", () => {
    // Without this, a name could be added to `covers` and struck from the pending list with no
    // example ever running it.
    const examples = Object.entries(exampleDemos)
    expect(examples.length).toBeGreaterThan(0)

    for (const [key, example] of examples) {
      expect(example.snippet.trim(), `${key}: empty snippet`).not.toBe("")
      const code = example.run.toString()
      for (const name of example.covers) {
        const word = new RegExp(`\\b${name}\\b`)
        expect(word.test(example.snippet), `${key}: ${name} is not in the snippet`).toBe(true)
        expect(word.test(code), `${key}: ${name} is not in run`).toBe(true)
      }
    }
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
