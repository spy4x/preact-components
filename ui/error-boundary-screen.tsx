import type { JSX } from "preact"
import { Button } from "./button.tsx"
import { EmptyState } from "./empty-state.tsx"

/*
 * `ErrorBoundary`'s reload screen, in a file of its own so a server-render test can reach it and its
 * button without a throw: Preact's server renderer runs no error boundary. Internal: not listed in
 * `ui/deno.json`'s exports.
 */

/** Everything the screen shows, already resolved to its defaults by `ErrorBoundary`. */
export interface ErrorBoundaryScreenProps {
  onReload?: () => void
  title: string
  description: string
  reloadLabel: string
  headingLevel?: 1 | 2 | 3 | 4
  dataE2E?: string
}

/** Runs when no `onReload` port is given; only ever from the button's click handler. */
function reloadPage(): void {
  location.reload()
}

/**
 * The alert with its reload button that `ErrorBoundary` shows in place of a view that threw.
 *
 * @param props See {@link ErrorBoundaryScreenProps}.
 * @returns A `role="alert"` wrapper around an `EmptyState` whose action is the reload `Button`.
 */
export function ErrorBoundaryScreen(
  { onReload, title, description, reloadLabel, headingLevel, dataE2E }: ErrorBoundaryScreenProps,
): JSX.Element {
  return (
    <div role="alert" data-e2e={dataE2E}>
      <EmptyState
        title={title}
        description={description}
        headingLevel={headingLevel}
        action={
          <Button
            data-e2e={dataE2E === undefined ? undefined : `${dataE2E}-reload`}
            onClick={() => (onReload ?? reloadPage)()}
          >
            {reloadLabel}
          </Button>
        }
      />
    </div>
  )
}
