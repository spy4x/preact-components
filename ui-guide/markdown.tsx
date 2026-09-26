/**
 * The inline Markdown the guide's prose is written in: `` `code` `` and `**strong**`, nothing more.
 *
 * Every blurb and card summary in the registry is a plain string, and many of them name an export
 * in backticks. Rendering them through here is what keeps a literal backtick off the page. The
 * subset is deliberately tiny: a sentence that needs a link or a list is written as JSX instead
 * (`Demo.description`).
 */

import type { JSX } from "preact"

/** One run of inline text: plain, code or strong. */
export interface InlineToken {
  kind: "text" | "code" | "strong"
  text: string
}

/**
 * Split a line of inline Markdown into runs.
 *
 * A backtick pair makes code, and nothing inside it is read as Markdown. A `**` pair outside code
 * makes strong text. An unmatched backtick or `**` stays as the literal characters, so a typo shows
 * up on the page rather than swallowing the rest of the sentence.
 *
 * @param source The Markdown text.
 * @returns The runs, in order, with empty plain runs left out.
 */
export function inlineTokens(source: string): InlineToken[] {
  const tokens: InlineToken[] = []
  const push = (kind: InlineToken["kind"], text: string) => {
    if (text === "") return
    const last = tokens.at(-1)
    if (kind === "text" && last?.kind === "text") last.text += text
    else tokens.push({ kind, text })
  }
  let rest = source
  while (rest.length > 0) {
    const tick = rest.indexOf("`")
    const star = rest.indexOf("**")
    const next = [tick, star].filter((index) => index >= 0)
    if (next.length === 0) {
      push("text", rest)
      break
    }
    const at = Math.min(...next)
    push("text", rest.slice(0, at))
    const marker = at === tick ? "`" : "**"
    const close = rest.indexOf(marker, at + marker.length)
    if (close < 0) {
      push("text", rest.slice(at))
      break
    }
    push(marker === "`" ? "code" : "strong", rest.slice(at + marker.length, close))
    rest = rest.slice(close + marker.length)
  }
  return tokens
}

/**
 * Inline Markdown rendered as text, `<code>` and `<strong>`.
 *
 * @param props.text The Markdown text.
 */
export function InlineMarkdown({ text }: { text: string }): JSX.Element {
  return (
    <>
      {inlineTokens(text).map((token, index) =>
        token.kind === "code"
          ? (
            <code
              key={index}
              class="rounded bg-gray-100 px-1 font-mono text-[0.875em] [overflow-wrap:anywhere] text-gray-900 dark:bg-gray-700/60 dark:text-gray-100"
            >
              {token.text}
            </code>
          )
          : token.kind === "strong"
          ? <strong key={index} class="font-semibold">{token.text}</strong>
          : token.text
      )}
    </>
  )
}
