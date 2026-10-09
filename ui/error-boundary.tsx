import type { ComponentChildren, JSX } from "preact"
import { useErrorBoundary } from "preact/hooks"
import { Button } from "./button.tsx"
import { EmptyState } from "./empty-state.tsx"

export interface ErrorBoundaryProps {
  /** The view to guard. Rendered untouched until something inside it throws. */
  children?: ComponentChildren
  /**
   * Called once with each error the boundary catches, to report it. The prop is read when the error
   * arrives, so the latest one is called. It must not throw: an error it throws escapes the
   * boundary.
   */
  onError?: (error: unknown) => void
  /**
   * What the Reload button does. Defaults to `location.reload()`, which is read only when the button
   * is pressed, so the boundary renders on a server.
   */
  onReload?: () => void
  /** The screen's headline. Defaults to "Something went wrong." */
  title?: string
  /** The line under it. Defaults to "Reloading the page usually fixes it." */
  description?: string
  /** The button's text. Defaults to "Reload the page". */
  reloadLabel?: string
  /**
   * Level of the title's heading, as on `EmptyState`. Defaults to `3`; pass `1` when the boundary
   * guards the whole page, so the error screen still gives the page a top-level heading.
   */
  headingLevel?: 1 | 2 | 3 | 4
  /** `data-e2e` on the screen; the button gets the same value with `-reload` appended. */
  dataE2E?: string
}

/** Runs when no `onReload` port is given; only ever from the button's click handler. */
function reloadPage(): void {
  location.reload()
}

/**
 * Catches an error thrown while its children render and shows a reload screen in their place, so
 * the person sees a way out instead of a blank page.
 *
 * Use it around a whole view or app, for errors nobody expected. For an expected failure the page
 * can describe, such as a request that failed, show `ErrorState` with the message where the result
 * would have been. For a page-wide problem the reader must act on, such as a failed payment, show a
 * `Notice` with `tone="danger"` and an action.
 *
 * The screen is an `EmptyState` with a `Button`, inside a `role="alert"` wrapper so a screen reader
 * announces it the moment it replaces the view. Every string has an English default and a prop.
 *
 * It catches in the browser only. Preact's server renderer runs no error boundary, so a child that
 * throws during a server render throws out of that render.
 *
 * @param props See {@link ErrorBoundaryProps}.
 * @returns The children, or the reload screen once one of them has thrown.
 */
export function ErrorBoundary({
  children,
  onError,
  onReload,
  title = "Something went wrong.",
  description = "Reloading the page usually fixes it.",
  reloadLabel = "Reload the page",
  headingLevel,
  dataE2E,
}: ErrorBoundaryProps): JSX.Element {
  const [error] = useErrorBoundary((caught: unknown) => onError?.(caught))
  if (error === undefined) return <>{children}</>

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
