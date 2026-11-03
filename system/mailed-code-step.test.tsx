import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { MailedCodeStep } from "./mailed-code-step.tsx"

const noop = () => {}

/** The step rendered to a string, with the given props over a minimal set. */
function html(props: Partial<Parameters<typeof MailedCodeStep>[0]> = {}): string {
  return render(
    <MailedCodeStep
      sentence="We sent a code to ana@example.com."
      onSubmit={noop}
      onResend={noop}
      onChangeEmail={noop}
      {...props}
    />,
  )
}

/** The code `<input>`'s opening tag, or `""`. */
function codeInput(markup: string): string {
  return markup.match(/<input[^>]*data-e2e="mailed-code-step-code"[^>]*>/)?.[0] ?? ""
}

describe("MailedCodeStep", () => {
  it("draws a code field that takes any characters and no length limit", () => {
    const input = codeInput(html())
    expect(input).toContain('autocomplete="one-time-code"')
    expect(input).toContain('autocapitalize="off"')
    expect(input).toContain('autocorrect="off"')
    expect(input).toContain('spellcheck="false"')
    expect(input).toContain('inputmode="text"')
    expect(input).toContain("font-mono")
    expect(input).toContain("text-lg")
    expect(input).not.toContain("maxlength")
  })

  it("posts its form, so the code never lands in the address bar before the script runs", () => {
    expect(html()).toMatch(/<form[^>]*method="post"/)
  })

  it("says how long the code works only when minutes is given, one minute in the singular", () => {
    expect(html()).not.toContain("The code works for")
    expect(html({ minutes: 15 })).toContain(
      "We sent a code to ana@example.com. The code works for 15 minutes.",
    )
    expect(html({ minutes: 1 })).toContain("The code works for 1 minute.")
  })

  it("ties a refused code's message to the field and marks it invalid", () => {
    const markup = html({ error: "That code is wrong." })
    const input = codeInput(markup)
    expect(input).toContain('aria-invalid="true"')
    const described = input.match(/aria-describedby="([^"]+)"/)?.[1] ?? ""
    expect(markup).toMatch(new RegExp(`id="${described}"[^>]*>That code is wrong\\.<`))
  })

  it("orders the controls code, Continue, Send a new code, Use a different one", () => {
    const markup = html()
    const at = (text: string) => markup.indexOf(text)
    expect(at("mailed-code-step-code")).toBeGreaterThan(-1)
    expect(at("mailed-code-step-code")).toBeLessThan(at("mailed-code-step-submit"))
    expect(at("mailed-code-step-submit")).toBeLessThan(at("Send a new code"))
    expect(at("Send a new code")).toBeLessThan(at("mailed-code-step-change-email"))
  })

  it("draws the heading at the level asked for, 2 by default", () => {
    expect(html()).toMatch(/<h2[^>]*>Check your inbox<\/h2>/)
    expect(html({ headingLevel: 1 })).toMatch(/<h1[^>]*>Check your inbox<\/h1>/)
  })

  it("takes every word from labels", () => {
    const markup = html({
      minutes: 2,
      labels: { title: "Look", submit: "Go", expires: (n) => `${n} min.` },
    })
    expect(markup).toContain(">Look<")
    expect(markup).toContain(">Go<")
    expect(markup).toContain("2 min.")
  })
})
