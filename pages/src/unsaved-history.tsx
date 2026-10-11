/**
 * The host page's demo of `UnsavedGuard` and the browser's Back and Forward buttons.
 *
 * The catalogue's own `UnsavedGuard` card shows links and navigation from code, and never changes
 * the address: a card that wrote to `location` would write to whatever host embeds the catalogue.
 * Back and Forward need a page that owns an address and a router that follows it, so this demo
 * lives here, in the host application. `pages/e2e/ui.spec.ts` drives exactly this section.
 *
 * The router is wouter's, the one history-based router the apps use: `Router`, `useSearch` to read
 * the address and `useLocation`'s `navigate` to change it. The three views are told apart by the
 * `unsaved-note` query parameter rather than by the path, because this site is static files: a path
 * the server does not have would not survive a reload. A change of view unmounts the view before
 * it, as a change of route does, so a draft the guard fails to protect is lost here too.
 */

import { useSignal } from "@preact/signals"
import type { JSX } from "preact"
import { buttonClasses } from "@spy4x/preact-ui/button"
import { Input } from "@spy4x/preact-ui/input"
import { UnsavedGuard } from "@spy4x/preact-ui/unsaved-guard"
import { useEffect } from "preact/hooks"
import { Router, useLocation, useSearch } from "wouter-preact"

/** The query parameter that names the view. */
const VIEW_PARAM = "unsaved-note"

/** Classes of the links that move between the views. */
const CONTROL = buttonClasses("outline", "sm")

/** This page's address with another view in the query; the path and the fragment stay. */
function viewHref(view: string | null): string {
  const url = new URL(location.href)
  if (view === null) url.searchParams.delete(VIEW_PARAM)
  else url.searchParams.set(VIEW_PARAM, view)
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * The section: a list, an editor and a preview, each its own history entry.
 *
 * `ssrPath` and `ssrSearch` let the build prerender the list where there is no address; a browser
 * ignores both and reads the address bar.
 */
export function UnsavedHistoryDemo() {
  return (
    <section data-e2e="unsaved-history" class="border-t border-gray-200 pt-6 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
        UnsavedGuard, Back and Forward
      </h2>
      <p class="measure mt-2 text-sm text-gray-600 dark:text-gray-300">
        Open the editor, type, then press the browser's Back button. <code>UnsavedGuard</code>{" "}
        keeps the editor and its address and asks first: "Stay" keeps what you typed, "Leave" goes
        where Back was going. With nothing typed, Back leaves at once.
      </p>
      <Router ssrPath="/" ssrSearch="">
        <Views />
      </Router>
    </section>
  )
}

/** The view the address names, and the links between the views. */
function Views() {
  const view = new URLSearchParams(useSearch()).get(VIEW_PARAM)
  const [, navigate] = useLocation()
  /** A link that asks the router for a view; its address is worked out at the click. */
  const viewLink = (to: string | null, label: string) => (
    <a
      class={CONTROL}
      href={to === null ? "?" : `?${VIEW_PARAM}=${to}`}
      data-e2e={`unsaved-history-to-${to ?? "list"}`}
      onClick={(event) => {
        event.preventDefault()
        // The state is here for the check that "Stay" gives the editor's entry its state back.
        navigate(viewHref(to), { state: { view: to } })
      }}
    >
      {label}
    </a>
  )

  return (
    <div
      class="mt-3 flex flex-col items-start gap-3"
      data-e2e="unsaved-history-view"
      data-view={view ?? "list"}
    >
      {view === "edit"
        ? <Editor navigate={navigate} previewLink={viewLink("preview", "Preview")} />
        : view === "preview"
        ? (
          <>
            <p class="text-sm text-gray-600 dark:text-gray-300">Preview of the note.</p>
            {viewLink("edit", "Edit the note")}
          </>
        )
        : viewLink("edit", "Edit the note")}
    </div>
  )
}

/** The form: a draft that lives in this component only, so unmounting it loses the text. */
function Editor(
  { navigate, previewLink }: { navigate: (href: string) => void; previewLink: JSX.Element },
) {
  const dirty = useSignal(false)
  // What the line below reports. It is set in an effect, and a parent's effect runs after its
  // child's, so "yes" means the guard is already listening: a check that reads it and presses Back
  // at once cannot arrive between the render and the guard's own effect.
  const guarded = useSignal(false)
  const unsaved = dirty.value
  useEffect(() => {
    guarded.value = unsaved
  }, [unsaved])
  return (
    <>
      <Input
        aria-label="Note"
        placeholder="Type to make a change"
        onInput={() => dirty.value = true}
        data-e2e="unsaved-history-draft"
      />
      <p class="text-sm text-gray-600 dark:text-gray-300" data-e2e="unsaved-history-state">
        Unsaved: {guarded.value ? "yes" : "no"}
      </p>
      {previewLink}
      <UnsavedGuard
        when={dirty.value}
        owns={(url) => url.pathname === location.pathname}
        navigate={(href) =>
          navigate(viewHref(new URL(href, location.href).searchParams.get(VIEW_PARAM)))}
        onDiscard={() => dirty.value = false}
      />
    </>
  )
}
