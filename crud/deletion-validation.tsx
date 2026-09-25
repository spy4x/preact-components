import { IconAlertTriangle } from "@preact-components/icons"
import type { JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"
import type { DeletionDependency } from "./types.ts"

export interface DeletionValidationProps {
  /** Entities blocking the archive. An empty list renders nothing visible. */
  dependencies: DeletionDependency[]
  /** Model name used in the sentence, for example `"Region"`. */
  model: string
}

/**
 * The list of entities that block a soft delete.
 *
 * A row can only be archived once everything pointing at it has been archived, and the store hands
 * back what still points at it. The block scrolls itself into view, because the checkbox that
 * produced it sits in the form footer and the answer appears under the form.
 *
 * **Scrolling stays in this component rather than becoming a port.** It reacts to one thing only —
 * a new, non-empty dependency list — and every caller wants the same outcome: bring the reason an
 * archive was refused in front of the person who just tried it. A port would only make every caller
 * write the same `scrollIntoView` call back in, for no caller-specific behaviour to control. The
 * effect is keyed on the list's content, not its identity or a plain render, so a caller that
 * rebuilds the same dependencies on every render (a keystroke elsewhere, a timer) never moves the
 * page — only a dependency list whose content actually changed does, which also covers a second
 * archive attempt that replaces one non-empty list with another.
 *
 * **The `role="alert"` region is rendered on every render, empty until there is something to say** —
 * the pattern `ui/`'s toasts and combobox use, and `system/`'s `AuthForm` for its own assertive
 * region. A region created already holding its text is not reliably announced by assistive
 * technology; a region that starts empty and is later filled is. Empty, this element carries no
 * class, so it is an ordinary, zero-pixel in-flow node until a dependency list gives it content.
 */
export function DeletionValidation(
  { dependencies, model }: DeletionValidationProps,
): JSX.Element {
  const block = useRef<HTMLDivElement>(null)
  const lastScrolledFor = useRef<string | null>(null)
  const hasDependencies = dependencies.length > 0

  // No dependency array: this must run on every render so it can tell a render with the same
  // content from one with new content. It scrolls only when the serialized list differs from the
  // one it last scrolled for, so a re-render with an equal (even freshly built) list is a no-op.
  useEffect(() => {
    if (!hasDependencies) {
      lastScrolledFor.current = null
      return
    }
    const signature = JSON.stringify(dependencies)
    if (signature !== lastScrolledFor.current) {
      lastScrolledFor.current = signature
      block.current?.scrollIntoView({ behavior: "smooth" })
    }
  })

  return (
    <div
      ref={block}
      class={hasDependencies
        ? "rounded-primary bg-white p-4 border border-red-600 text-red-600"
        : undefined}
      role="alert"
    >
      {hasDependencies && (
        <div class="flex">
          <div class="shrink-0">
            <IconAlertTriangle class="size-5 text-red-500" />
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-600">
              To archive this {model}, please first archive:
            </h3>
            <div class="mt-2 text-sm text-red-600 max-w-xl">
              <ul role="list" class="list-disc space-y-1 pl-5">
                {dependencies.map((dependency) => (
                  <li key={dependency.kind}>
                    <div>{dependency.kind}:</div>
                    <div class="my-2 ml-5 space-x-2">
                      {dependency.values.map((item) => (
                        <div key={item.url} class="inline-block">
                          <a class="link text-primary" href={item.url}>{item.title}</a>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
