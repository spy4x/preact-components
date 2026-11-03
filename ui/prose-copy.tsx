import { useEffect } from "preact/hooks"
import { type CopyPort, copyText, DEFAULT_COPIED_FOR_MS } from "./copy-text.ts"

/** The undo of each button some call of {@link enhanceCodeCopy} has wired, so none is wired twice. */
const wired = new WeakMap<Element, () => void>()

/**
 * Wire one copy button `Prose` rendered with `copyCode`: reveal it, copy its block's text on a
 * press, and show and announce the outcome until `DEFAULT_COPIED_FOR_MS` has passed.
 *
 * @param button The `[data-prose-copy]` button.
 * @param copy The caller's clipboard port, if any.
 * @returns The undo, or nothing when the button's block or live region is missing.
 */
function wire(button: HTMLButtonElement, copy?: CopyPort): (() => void) | undefined {
  const pre = button.closest("[data-prose-code]")?.querySelector("pre")
  const status = button.nextElementSibling
  if (!pre || !status?.hasAttribute("data-prose-copy-status")) return
  let latest = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const settle = (outcome?: "copied" | "failed") => {
    clearTimeout(timer)
    if (outcome) button.setAttribute("data-status", outcome)
    else button.removeAttribute("data-status")
    status.textContent = outcome ? button.getAttribute(`data-${outcome}`) ?? "" : ""
    if (outcome) timer = setTimeout(() => settle(), DEFAULT_COPIED_FOR_MS)
  }
  const press = async () => {
    const id = ++latest
    // Back to rest first, so a second copy empties the live region and is announced again.
    settle()
    const worked = await copyText(() => pre.textContent ?? "", copy)
    if (id === latest) settle(worked ? "copied" : "failed")
  }
  const onClick = () => void press()
  button.addEventListener("click", onClick)
  button.hidden = false
  return () => {
    latest++
    settle()
    button.removeEventListener("click", onClick)
    button.hidden = true
  }
}

/**
 * Reveal and wire every code block's copy button that `Prose` rendered with `copyCode` inside
 * `root`: a press copies the block's text exactly as it reads, trailing newline included or not,
 * then a checkmark (or a cross) shows and the polite live region beside the button says "Copied"
 * (or "Couldn't copy") in the labels `Prose` rendered.
 *
 * Calling it again wires only the buttons not wired yet. Without a script the buttons stay
 * `hidden`, so a page with JavaScript off shows no dead control.
 *
 * @param root Where to look for the buttons. Defaults to `document`.
 * @param copy Clipboard port; left out, the browser clipboard with an `execCommand` fallback.
 * @returns A function that hides and unwires the buttons this call wired.
 */
export function enhanceCodeCopy(root: ParentNode = document, copy?: CopyPort): () => void {
  const undos: (() => void)[] = []
  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-prose-copy]")) {
    if (wired.has(button)) continue
    const undo = wire(button, copy)
    if (!undo) continue
    wired.set(button, undo)
    undos.push(() => {
      wired.delete(button)
      undo()
    })
  }
  return () => undos.forEach((undo) => undo())
}

/** Props of {@link ProseCodeCopy}. */
export interface ProseCodeCopyProps {
  /** Clipboard port; left out, the browser clipboard. A Fresh island cannot take a function. */
  copy?: CopyPort
}

/**
 * Renders nothing; once mounted, wires every copy button `Prose` drew with `copyCode` on the page,
 * through {@link enhanceCodeCopy}, and unwires them when it unmounts.
 *
 * Made to be a Fresh island on a page that ships no other script: it imports Preact's hooks and
 * the clipboard helper only. Re-export it from a file in `islands/` and render it once per page:
 *
 * ```tsx
 * // islands/code-copy.tsx
 * export { ProseCodeCopy as default } from "@spy4x/preact-ui/prose-copy"
 *
 * // a route
 * import CodeCopy from "../islands/code-copy.tsx"
 * <Prose as="article" html={guide.html} copyCode />
 * <CodeCopy />
 * ```
 *
 * @param props The optional clipboard port.
 * @returns Nothing.
 */
export function ProseCodeCopy({ copy }: ProseCodeCopyProps): null {
  useEffect(() => enhanceCodeCopy(document, copy), [copy])
  return null
}
