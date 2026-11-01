/**
 * Selecting one line of a `<textarea>`, for an editor that sends the reader to a problem on a line.
 *
 * @module
 */

/**
 * Where a 1-based line starts and ends in a text, its line break left out. A line past the last
 * one is the last line, and one below 1 is the first, so a stale line number still lands
 * somewhere. A `\r` before a line break is left out of the line.
 *
 * @param text The whole text.
 * @param line The 1-based line.
 * @returns `[start, end]` offsets for `setSelectionRange`.
 */
export function textLineRange(text: string, line: number): [number, number] {
  let start = 0
  for (let n = 1; n < line; n++) {
    const next = text.indexOf("\n", start)
    if (next < 0) break
    start = next + 1
  }
  const end = text.indexOf("\n", start)
  const stop = end < 0 ? text.length : end
  return [start, text[stop - 1] === "\r" ? stop - 1 : stop]
}

/** The styles that decide where a textarea wraps its text, copied onto the measuring copy. */
const WRAP_STYLES = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "tabSize",
  "textIndent",
  "wordSpacing",
] as const

/**
 * How far down a textarea's content the row holding `offset` ends, soft wraps included: a hidden
 * copy with the textarea's width and font holds the text up to there, and its height is the
 * answer. A zero-width space after the text keeps a trailing line break's empty row in the copy.
 */
function rowBottom(textarea: HTMLTextAreaElement, offset: number): number {
  const doc = textarea.ownerDocument
  const view = doc.defaultView
  if (!view) return 0
  const style = view.getComputedStyle(textarea)
  const copy = doc.createElement("div")
  for (const name of WRAP_STYLES) copy.style[name] = style[name]
  copy.style.position = "absolute"
  copy.style.visibility = "hidden"
  copy.style.whiteSpace = "pre-wrap"
  copy.style.overflowWrap = "break-word"
  copy.style.height = "auto"
  copy.textContent = `${textarea.value.slice(0, offset)}\u200b`
  doc.body.append(copy)
  const bottom = copy.scrollHeight
  copy.remove()
  return bottom
}

/**
 * Focuses a textarea, selects one of its lines and scrolls the textarea so that line sits in the
 * middle of it. The focus brings the textarea itself into view on the page. Only call it from an
 * event handler or an effect: it reads layout.
 *
 * @param textarea The textarea.
 * @param line The 1-based line; out of range, the nearest line, as {@link textLineRange}.
 */
export function selectTextareaLine(textarea: HTMLTextAreaElement, line: number): void {
  const [start, end] = textLineRange(textarea.value, line)
  textarea.focus()
  textarea.setSelectionRange(start, end)
  textarea.scrollTop = Math.max(0, rowBottom(textarea, start) - textarea.clientHeight / 2)
}
