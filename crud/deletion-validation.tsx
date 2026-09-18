import { IconAlertTriangle } from "@preact-components/icons"
import { useEffect, useRef } from "preact/hooks"
import type { DeletionDependency } from "./types.ts"

export interface DeletionValidationProps {
  /** Entities blocking the archive. An empty list renders nothing. */
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
 */
export function DeletionValidation({ dependencies, model }: DeletionValidationProps) {
  const block = useRef<HTMLDivElement>(null)

  // No dependency array: the block must also scroll into view when a second archive attempt
  // replaces one dependency list with another.
  useEffect(() => {
    if (dependencies.length > 0) {
      block.current?.scrollIntoView({ behavior: "smooth" })
    }
  })

  if (dependencies.length === 0) return null

  return (
    <div
      ref={block}
      class="rounded-primary bg-white p-4 border border-red-600 text-red-600"
      role="alert"
    >
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
    </div>
  )
}
