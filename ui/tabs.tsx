import { cn } from "@preact-components/signals/cn"
import type { ComponentChildren } from "preact"
import { useRef } from "preact/hooks"

/** Axis a tablist is laid out along, which decides which arrow keys it answers. */
export type TabOrientation = "horizontal" | "vertical"

/** One tab and the panel it controls. */
export interface TabItem {
  /**
   * Stable identity of the tab, unique in the document.
   *
   * Every ARIA id in the markup is derived from it — `${id}-tab` on the button, `${id}-panel`
   * on the panel — so the pairing is deterministic without the component generating an id.
   */
  id: string
  /** Tab label. */
  label: ComponentChildren
  /** Panel content. Whether it is in the DOM depends on {@link TabsProps.lazy}. */
  content?: ComponentChildren
  /** Disabled tabs are not clickable, not focusable and skipped by arrow navigation. */
  disabled?: boolean
}

export interface TabsProps {
  /** Tabs in render order. Ids must be unique in the document. */
  tabs: readonly TabItem[]
  /** `id` of the selected tab. The component renders it and never changes it. */
  active: string
  /** Called with the `id` of the tab the user asked for; persistence and routing belong to the caller. */
  onChange: (id: string) => void
  /** Defaults to `"horizontal"`. A horizontal tablist answers Left/Right, a vertical one Up/Down. */
  orientation?: TabOrientation
  /**
   * `true` renders only the active panel and drops `aria-controls` from the inactive tabs;
   * `false` (default) renders every panel, `hidden`, so each `aria-controls` resolves.
   */
  lazy?: boolean
  /** Accessible name for the tablist, applied as `aria-label`. */
  label?: string
  /** Extra utilities for the root container. */
  class?: string
  /** Extra utilities for the tablist. */
  listClass?: string
  /** Extra utilities for every tab button. */
  tabClass?: string
  /** Extra utilities for every panel. */
  panelClass?: string
  /** Sets `data-e2e` on every tab button, for end-to-end selectors. */
  tabDataE2E?: string
}

const listBase = "flex gap-1"
const listHorizontal = "border-b border-gray-200 dark:border-gray-600"
const listVertical = "flex-col border-l border-gray-200 dark:border-gray-600"

const tabBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"

const edgeHorizontal = "border-b-2 -mb-px"
const edgeVertical = "border-l-2 -ml-px"

const tabSelected = "border-purple-900 text-purple-900 dark:border-purple-500 dark:text-purple-400"

const tabIdle =
  "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"

const panelBase = "pt-4 text-sm text-gray-700 focus-visible:outline-hidden dark:text-gray-300"

/** `id` of the tab button controlling panel `tabId`. */
function tabElementId(tabId: string): string {
  return `${tabId}-tab`
}

/** `id` of the panel controlled by tab button `tabId`. */
function panelElementId(tabId: string): string {
  return `${tabId}-panel`
}

/**
 * Resolve the tab index that gets `tabindex="0"`, the rest being `-1`.
 *
 * The active tab owns the single tab stop. When `active` matches no tab — a stale value the
 * caller handed over — the first enabled tab takes it instead, so the tablist never drops out
 * of the focus order with every tab at `-1`.
 *
 * @param flags One entry per tab: `true` when that tab is disabled.
 * @param activeIndex Index of the tab matching `active`, or `-1`.
 * @returns Index of the tab that carries `tabindex="0"`.
 */
function rovingIndex(flags: readonly boolean[], activeIndex: number): number {
  if (activeIndex >= 0 && !flags[activeIndex]) return activeIndex
  const firstEnabled = flags.indexOf(false)
  return firstEnabled === -1 ? 0 : firstEnabled
}

/**
 * Index the tablist should move focus to for `key`, given the tab currently focused.
 *
 * Pure and exported so the keyboard map is unit-testable: the DOM wiring that calls it can only
 * be checked in a real browser, this decision table cannot. Focus wraps around both ends, and a
 * disabled tab is skipped rather than landed on. `Home`/`End` answer first/last *enabled* tab on
 * both axes; arrows answer only the axis the tablist declares, so a horizontal tablist leaves
 * Up/Down to the page and its panels.
 *
 * @param key Value of `KeyboardEvent.key`.
 * @param current Index of the tab that has focus; out-of-range values wrap.
 * @param count Number of tabs in the tablist.
 * @param orientation Axis of the tablist; defaults to `"horizontal"`.
 * @param disabled One entry per tab: `true` when that tab is disabled.
 * @returns Index to focus, or `undefined` when the key is not one this tablist owns — which
 * includes "the tablist has no tabs" and "every tab is disabled".
 */
export function nextTabIndex(
  key: string,
  current: number,
  count: number,
  orientation: TabOrientation = "horizontal",
  disabled: readonly boolean[] = [],
): number | undefined {
  if (count <= 0) return undefined

  const flags = Array.from({ length: count }, (_, index) => disabled[index] ?? false)

  if (key === "Home") {
    const firstEnabled = flags.indexOf(false)
    return firstEnabled === -1 ? undefined : firstEnabled
  }
  if (key === "End") {
    const lastEnabled = flags.lastIndexOf(false)
    return lastEnabled === -1 ? undefined : lastEnabled
  }

  const forward = orientation === "horizontal" ? "ArrowRight" : "ArrowDown"
  const backward = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp"
  const step = key === forward ? 1 : key === backward ? -1 : 0
  if (step === 0) return undefined

  // Walk one tab at a time, wrapping past both ends, until an enabled tab comes back around.
  for (let offset = 1; offset <= count; offset++) {
    const index = (((current + step * offset) % count) + count) % count
    if (!flags[index]) return index
  }
  return undefined
}

/**
 * Controlled tabbed interface: a tablist plus one panel per tab.
 *
 * The caller owns the selected tab — `active` in, `onChange` out — so the component holds no
 * active state and is a pure function of its props. It is not a router and not URL-aware: wire
 * `active`/`onChange` to whatever state the app uses.
 *
 * Every panel is rendered and the inactive ones carry `hidden` by default, because a tab that
 * points at a panel which is not in the document is a broken `aria-controls`, and the panels of
 * a hidden tab also disappear from the accessibility tree and from a crawler's view of the page.
 * `lazy` trades that for payload: only the active panel is rendered, and the inactive tabs drop
 * `aria-controls` instead of pointing at an element that does not exist.
 *
 * Ids are never generated. Each `TabItem.id` yields `${id}-tab` and `${id}-panel`, so the
 * `aria-controls`/`aria-labelledby` pairing is deterministic and the caller keeps ownership of
 * document-wide uniqueness.
 *
 * Details the markup follows: the active tab carries `tabindex="0"` and the rest `-1` (roving),
 * selection follows focus on arrow keys, panels are `tabindex="0"` so a long panel is reachable
 * by keyboard, and `hidden` is set as both an attribute and a utility so a `display` utility in
 * `panelClass` cannot resurrect a hidden panel.
 */
export function Tabs(
  {
    tabs,
    active,
    onChange,
    orientation = "horizontal",
    lazy = false,
    label,
    class: className,
    listClass,
    tabClass,
    panelClass,
    tabDataE2E,
  }: TabsProps,
) {
  const listRef = useRef<HTMLDivElement>(null)
  const activeIndex = tabs.findIndex((tab) => tab.id === active)
  const flags = tabs.map((tab) => tab.disabled === true)
  const focusIndex = rovingIndex(flags, activeIndex)

  /**
   * Focus the tab at `index` and report it as selected.
   *
   * `querySelectorAll` on the tablist rather than `document`, so nothing outside this component
   * is touched; this runs from an event handler, never during render.
   */
  const moveTo = (index: number | undefined) => {
    if (index === undefined) return
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')?.[index]?.focus()
    if (index !== activeIndex) onChange(tabs[index].id)
  }

  /**
   * Route a key press on a tab through {@link nextTabIndex} and act on its answer.
   *
   * `preventDefault` fires only for keys the tablist owns, so page scrolling and normal tab
   * traversal keep working.
   */
  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const next = nextTabIndex(event.key, index, tabs.length, orientation, flags)
    if (next === undefined) return
    event.preventDefault()
    moveTo(next)
  }

  const isVertical = orientation === "vertical"

  return (
    <div class={className}>
      <div
        role="tablist"
        aria-orientation={orientation}
        aria-label={label}
        ref={listRef}
        class={cn(listBase, isVertical ? listVertical : listHorizontal, listClass)}
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tabElementId(tab.id)}
              aria-selected={isActive}
              aria-controls={lazy && !isActive ? undefined : panelElementId(tab.id)}
              tabindex={index === focusIndex ? 0 : -1}
              disabled={tab.disabled}
              data-e2e={tabDataE2E}
              class={cn(
                tabBase,
                isVertical ? edgeVertical : edgeHorizontal,
                isActive ? tabSelected : tabIdle,
                tabClass,
              )}
              onClick={() => {
                if (!isActive) onChange(tab.id)
              }}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {tabs.map((tab) => {
        const isActive = tab.id === active
        if (lazy && !isActive) return null
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={panelElementId(tab.id)}
            aria-labelledby={tabElementId(tab.id)}
            tabindex={0}
            hidden={!isActive}
            class={cn(panelBase, !isActive && "hidden", panelClass)}
          >
            {tab.content}
          </div>
        )
      })}
    </div>
  )
}
