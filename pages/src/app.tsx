/**
 * The demo's host page — the app shell this library deliberately does not ship.
 *
 * Everything stateful lives in its own component, and the catalogue is a sibling of all of them:
 * nothing the navigation or the colour-scheme toggle does can re-render the guide, so the DOM the
 * deep links mark up is exactly the DOM that hydration produced.
 */

import { IconGitHub } from "@preact-components/icons"
import { buttonClasses } from "@preact-components/ui/button"
import { copyToClipboard } from "@preact-components/ui/copy-button"
import { iconNames, UIGuide } from "@preact-components/ui-guide"
import {
  catalogueSections,
  type ComponentName,
  componentNames,
  demoRegistry,
} from "@preact-components/ui-guide/registry"
import { cn } from "@preact-components/signals/cn"
import { useEffect, useState } from "preact/hooks"
import { componentFromFragment, demoElementId, demoSlug } from "./deep-link.ts"
import { PAGE_TITLE, REPOSITORY } from "./site.ts"

/** Storage key shared with the bootstrap script in `<head>` (`document.ts`). */
const THEME_KEY = "pc-theme"

/** How long a chip reports "copied" before it goes back to "copy". */
const COPIED_FEEDBACK_MS = 1600

/**
 * The page.
 *
 * Prerendered by `src/prerender.tsx` and hydrated by `src/+main.tsx` — the same component, so the
 * markup on the wire and the island's first render are the same tree.
 */
export function App() {
  useEffect(() => {
    // The island's boot marker. `verify.ts` asserts it, which is how the check tells "hydrated" from
    // "the script was fetched and threw".
    document.documentElement.dataset.hydrated = "true"
  }, [])

  return (
    <div id="top" class="min-h-dvh">
      <SiteHeader />
      <main class="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6">
        <Intro />
        <ComponentIndex />
      </main>
      <UIGuide />
      <SiteFooter />
    </div>
  )
}

/** Title, links and the colour-scheme switch. */
function SiteHeader() {
  return (
    <header class="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
      <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <a
          href="#top"
          class="font-mono text-sm font-semibold text-purple-900 dark:text-purple-300"
        >
          preact-components
        </a>
        <span class="text-sm text-gray-500 dark:text-gray-400">live UI guide</span>
        <div class="ml-auto flex items-center gap-2">
          <a
            href={REPOSITORY}
            class={buttonClasses("outline", "sm")}
            rel="noreferrer"
          >
            <IconGitHub class="size-4" />
            <span>Source</span>
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

/**
 * Light/dark switch.
 *
 * The class on `<html>` is set by the inline script in `<head>` before first paint; this reads it
 * back in an effect, so the island's first render still matches the prerendered button.
 */
function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light")
    } catch {
      // Storage blocked (private mode): the palette still switches for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      title={dark ? "Switch to the light palette" : "Switch to the dark palette"}
      class={buttonClasses("outline", "sm")}
    >
      {dark ? "Light" : "Dark"}
    </button>
  )
}

/** What the page is, in two sentences, generated from the modules themselves. */
function Intro() {
  return (
    <section class="space-y-3">
      <h1 class="h1">The whole library, running in your browser</h1>
      <p class="max-w-2xl text-sm text-gray-600 dark:text-gray-300">
        {componentNames.length} components from <code>@preact-components/ui</code> and{" "}
        {iconNames.length} icons from{" "}
        <code>@preact-components/icons</code>, one live demo each, with the JSX next to it. Nothing
        here is a screenshot: the dropdowns open, the switches report through their ports, the icon
        filter runs in the page.
      </p>
      <p class="text-sm text-gray-600 dark:text-gray-300">
        <code class="rounded bg-gray-100 px-2 py-1 font-mono text-xs dark:bg-gray-800">
          {`import { Badge } from "@preact-components/ui"`}
        </code>
      </p>
    </section>
  )
}

/**
 * The navigation: one chip per component, grouped the way the catalogue groups them.
 *
 * It owns the deep links, because it is also what writes them. On load and on every `hashchange` it
 * resolves `location.hash` to a component, marks that card in the catalogue ({@link demoElementId})
 * and scrolls it into view; `styles.css` outlines whatever carries `data-deep-link`.
 */
function ComponentIndex() {
  const [active, setActive] = useState<ComponentName | undefined>(undefined)
  const [copied, setCopied] = useState<ComponentName | undefined>(undefined)

  useEffect(() => {
    const applyFragment = () => {
      const name = componentFromFragment(location.hash, componentNames)
      setActive(name)
      document.title = name ? `${name} — ${PAGE_TITLE}` : PAGE_TITLE

      for (const marked of document.querySelectorAll("[data-deep-link]")) {
        marked.removeAttribute("data-deep-link")
      }

      if (!name) return
      const card = document.getElementById(demoElementId(name))
      if (!card) return

      card.setAttribute("data-deep-link", "")
      card.scrollIntoView({ block: "start" })
    }

    applyFragment()
    globalThis.addEventListener("hashchange", applyFragment)
    return () => globalThis.removeEventListener("hashchange", applyFragment)
  }, [])

  const copySnippet = (name: ComponentName) => {
    // The library's own clipboard helper, so the legacy `execCommand` path is not reimplemented.
    copyToClipboard(demoRegistry[name].snippet)
    setCopied(name)
    setTimeout(
      () => setCopied((current) => (current === name ? undefined : current)),
      COPIED_FEEDBACK_MS,
    )
  }

  return (
    <nav aria-label="Components" class="space-y-4">
      <h2 class="h2">Jump to a demo</h2>
      {catalogueSections.map((section) => (
        <div key={section.id} class="space-y-2">
          <h3 class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            {section.title}
          </h3>
          <ul class="flex flex-wrap gap-2">
            {section.names.map((name) => (
              <li
                key={name}
                class={cn(
                  "flex items-stretch overflow-hidden rounded-md border",
                  active === name
                    ? "border-purple-900 dark:border-purple-400"
                    : "border-gray-200 dark:border-gray-700",
                )}
              >
                <a
                  href={`#${demoSlug(name)}`}
                  aria-current={active === name ? "true" : undefined}
                  class={cn(
                    "px-2 py-1 font-mono text-xs",
                    active === name
                      ? "bg-purple-900 text-purple-50 dark:bg-purple-700"
                      : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
                  )}
                >
                  {name}
                </a>
                <button
                  type="button"
                  onClick={() => copySnippet(name)}
                  title={`Copy the <${name} /> snippet`}
                  aria-label={`Copy the ${name} snippet`}
                  class="border-l border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  {copied === name ? "copied" : "copy"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Every chip is a deep link — <code>#{demoSlug("Badge")}</code>,{" "}
        <code>#{demoSlug("ToggleSwitch")}</code>{" "}
        and friends open this page with that demo outlined — and <em>copy</em>{" "}
        puts its JSX on the clipboard.
      </p>
    </nav>
  )
}

/** Where the library lives and what the demo is built from. */
function SiteFooter() {
  return (
    <footer class="border-t border-gray-200 py-8 dark:border-gray-700">
      <div class="mx-auto max-w-5xl space-y-2 px-4 text-xs text-gray-500 sm:px-6 dark:text-gray-400">
        <p>
          Prerendered with <code>preact-render-to-string</code>{" "}
          and hydrated with one Preact island. Styled with{" "}
          <code>theme/preset.css</code>, the same stylesheet an app imports.
        </p>
        <p>
          <a class="link" href={REPOSITORY} rel="noreferrer">github.com/spy4x/preact-components</a>
        </p>
      </div>
    </footer>
  )
}
