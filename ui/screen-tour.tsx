/**
 * `ScreenTour`: a product walkthrough. Named steps as tabs beside one framed screenshot that swaps
 * when a step is picked, for a product or case-study page.
 *
 * It composes its classes with `join`, never `cn`, and draws its frame with the same chrome as
 * `WindowFrame` (`frame-chrome.tsx`), so an island that renders it carries no `tailwind-merge`
 * (`island-bundle.test.ts`). The arrow-key map is `Tabs`' own {@link nextTabIndex}.
 *
 * @module
 */

import { useSignal } from "@preact/signals"
import { join } from "@spy4x/preact-cn/join"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"
import { buttonClasses } from "./button.tsx"
import { FrameChrome } from "./frame-chrome.tsx"
import { Lightbox } from "./lightbox.tsx"
import { nextTabIndex } from "./tabs.tsx"

/** The screenshot of one {@link ScreenTourStep}. */
export interface ScreenTourImage {
  /** The full image, also what "View full size" shows. */
  src: string
  /** What the screenshot shows. Required and not blank: it is also the caption under the frame. */
  alt: string
  /** The image's intrinsic width, so the frame keeps its size while the image loads. */
  width: number
  /** The image's intrinsic height. */
  height: number
  /** Smaller copies for the frame, as an `<img srcset>`. */
  srcset?: string
  /** The `<img sizes>` that goes with `srcset`. */
  sizes?: string
}

/** One step of a {@link ScreenTour}: a tab, its screenshot and its line of text. */
export interface ScreenTourStep {
  /**
   * Stable identity, unique in the document. The tab is `${id}-tab` and its panel `${id}-panel`, as
   * in `Tabs`, and it is what `onSelect` reports.
   */
  id: string
  /** The tab's name, a few words. */
  label: string
  /** One line about the step, under the caption. Every step's text is in the server-rendered HTML. */
  text?: ComponentChildren
  /**
   * A small label shown above the first step of a run of steps with the same group, in the vertical
   * list from 1024 px. Decorative: the tabs keep their own names.
   */
  group?: string
  /** The screenshot. */
  image: ScreenTourImage
}

/** Props of {@link ScreenTour}. */
export interface ScreenTourProps {
  /** The steps, in order; at least one. */
  steps: readonly ScreenTourStep[]
  /** The device drawn around the screenshot. */
  frame: "browser" | "phone"
  /** The address in the browser frame's bar. Decorative. */
  browserUrl?: string
  /** Number the tabs 1, 2, 3, for a sequence a person follows in order. */
  numbered?: boolean
  /**
   * Set on the first screenshot as `fetchpriority`. Left out by default: only the page knows whether
   * the tour is its largest first-screen image.
   */
  fetchPriority?: "high" | "low" | "auto"
  /** Called with a step's `id` each time the person picks another step, never on the first render. */
  onSelect?: (id: string) => void
  /** Accessible name of the tab list. Defaults to `"Screens"`. */
  label?: string
  /** The words of the button that opens the screenshot in the lightbox. Defaults to `"View full size"`. */
  viewFullSizeLabel?: string
  /** The lightbox's close control. Defaults to `"Close"`. */
  closeLabel?: string
  /** The lightbox's previous control. Defaults to `"Previous image"`. */
  previousLabel?: string
  /** The lightbox's next control. Defaults to `"Next image"`. */
  nextLabel?: string
  /** The lightbox's counter. Defaults to `` (position, total) => `${position} of ${total}` ``. */
  counterLabel?: (position: number, total: number) => string
  /** Extra utilities for the root, appended after its own and not merged into them. */
  class?: string
}

/** Below 1024 px a row that scrolls inside itself; from 1024 px a column. `p-1` keeps the focus ring. */
const listClass =
  "flex min-w-0 gap-2 overflow-x-auto p-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:p-0"

const tabBase =
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-3 whitespace-nowrap rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors lg:w-full lg:whitespace-normal focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"
const tabSelected = "border-selected bg-selected-soft text-selected lg:border-transparent"
const tabIdle =
  "border-subtle text-muted hover:bg-hover hover:text-foreground lg:border-transparent"

const numberClass =
  "inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs tabular-nums"

const groupClass = "hidden px-3 pt-4 pb-1 text-xs font-medium text-muted first:pt-0 lg:block"

/** Every layer in a stack shares one grid cell, so the stack is as tall as its tallest layer. */
const layer = "[grid-area:1/1] motion-safe:transition-[opacity,visibility] motion-safe:duration-150"
const shown = "opacity-100"
const gone = "invisible opacity-0"

const panelClass =
  "flex flex-col gap-1 rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"

/** `id` of the tab of step `id`. */
function tabId(id: string): string {
  return `${id}-tab`
}

/** `id` of the panel of step `id`. */
function panelId(id: string): string {
  return `${id}-panel`
}

/**
 * Index of the step a key press on the tab at `current` moves to: `Tabs`' {@link nextTabIndex},
 * with Up and Down stepping like Left and Right, because the list is a column from 1024 px and a
 * row below it. Wraps at both ends; Home and End jump.
 *
 * @param key Value of `KeyboardEvent.key`.
 * @param current Index of the focused tab.
 * @param count Number of steps.
 * @returns The index to move to, or `undefined` for a key the tour does not own.
 */
export function nextStepIndex(key: string, current: number, count: number): number | undefined {
  const rowKey = key === "ArrowUp" ? "ArrowLeft" : key === "ArrowDown" ? "ArrowRight" : key
  return nextTabIndex(rowKey, current, count)
}

/**
 * A product walkthrough: named steps as tabs, beside one browser or phone frame whose screenshot
 * swaps when a step is picked, with the step's caption and line of text under it.
 *
 * The tabs are a column from 1024 px and a row that scrolls inside itself below. The tab list is one
 * Tab stop; the arrow keys move and select, Home and End jump. The server renders the first step
 * selected and every step's caption and text, so a reader without JavaScript sees them all; once
 * hydrated, only the selected step's text shows. Only the first screenshot is in the HTML (and so
 * eager); another loads the first time its step is picked. Screenshots and texts cross-fade in
 * 150 ms, and switch at once under reduced motion. "View full size" links to the image and, once
 * hydrated, opens it in `Lightbox`, whose Previous and Next move the tour along with it.
 *
 * @param props The steps, the frame and the labels, see {@link ScreenTourProps}.
 * @returns The tour's root `<div>`.
 * @throws When `steps` is empty, or a step's image has a blank `alt`.
 */
export function ScreenTour(
  {
    steps,
    frame,
    browserUrl,
    numbered = false,
    fetchPriority,
    onSelect,
    label = "Screens",
    viewFullSizeLabel = "View full size",
    closeLabel,
    previousLabel,
    nextLabel,
    counterLabel,
    class: className,
  }: ScreenTourProps,
): JSX.Element {
  if (steps.length === 0) throw new Error("ScreenTour needs at least one step")
  for (const step of steps) {
    if (step.image.alt.trim() === "") {
      throw new Error(`ScreenTour step "${step.id}" needs an image alt: it is also the caption`)
    }
  }

  const selected = useSignal(steps[0].id)
  const visited = useSignal<readonly string[]>([steps[0].id])
  const hydrated = useSignal(false)
  const lightboxOpen = useSignal(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    hydrated.value = true
  }, [])

  const selectedIndex = Math.max(0, steps.findIndex((step) => step.id === selected.value))
  const current = steps[selectedIndex]
  const isHydrated = hydrated.value

  /** Select the step at `index` because the person asked for it. */
  const pick = (index: number) => {
    const id = steps[index].id
    if (id === selected.value) return
    selected.value = id
    if (!visited.value.includes(id)) visited.value = [...visited.value, id]
    onSelect?.(id)
  }

  /** Focus the tab at `index`, keep it in the row's view, and select it. */
  const moveTo = (index: number) => {
    const tab = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]
    tab?.focus()
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" })
    pick(index)
  }

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const next = nextStepIndex(event.key, index, steps.length)
    if (next === undefined) return
    event.preventDefault()
    moveTo(next)
  }

  const imageClass = frame === "phone"
    ? "h-full w-full object-cover object-top"
    : "block h-auto w-full"

  return (
    <div
      class={join(
        "grid min-w-0 gap-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:items-start",
        className,
      )}
    >
      <div role="tablist" aria-label={label} ref={listRef} class={listClass}>
        {steps.map((step, index) => {
          const isSelected = index === selectedIndex
          const startsGroup = step.group !== undefined && step.group !== steps[index - 1]?.group
          return [
            startsGroup && (
              <div key={`${step.id}-group`} role="none" aria-hidden="true" class={groupClass}>
                {step.group}
              </div>
            ),
            <button
              key={step.id}
              type="button"
              role="tab"
              id={tabId(step.id)}
              aria-selected={isSelected}
              aria-controls={panelId(step.id)}
              tabindex={isSelected ? 0 : -1}
              class={join(tabBase, isSelected ? tabSelected : tabIdle)}
              onClick={(event) => {
                event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })
                pick(index)
              }}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {numbered && <span aria-hidden="true" class={numberClass}>{index + 1}</span>}
              {step.label}
            </button>,
          ]
        })}
      </div>
      <div class="flex min-w-0 flex-col gap-4">
        <FrameChrome variant={frame} title={browserUrl}>
          <div class={join("grid", frame === "phone" && "h-full")}>
            {steps.map((step, index) => {
              if (!visited.value.includes(step.id)) return null
              const isSelected = index === selectedIndex
              return (
                <img
                  key={step.id}
                  src={step.image.src}
                  srcset={step.image.srcset}
                  sizes={step.image.sizes}
                  alt={step.image.alt}
                  width={step.image.width}
                  height={step.image.height}
                  decoding="async"
                  fetchpriority={index === 0 ? fetchPriority : undefined}
                  data-screen-tour-image={step.id}
                  class={join(imageClass, layer, isSelected ? shown : gone)}
                />
              )
            })}
          </div>
        </FrameChrome>
        <div class={isHydrated ? "grid" : "flex flex-col gap-6"}>
          {steps.map((step, index) => {
            const isSelected = index === selectedIndex
            return (
              <div
                key={step.id}
                role="tabpanel"
                id={panelId(step.id)}
                aria-labelledby={tabId(step.id)}
                tabindex={0}
                class={join(panelClass, isHydrated && layer, isHydrated && !isSelected && gone)}
              >
                <p class="text-sm text-muted">{step.image.alt}</p>
                {step.text !== undefined && <p class="text-base text-foreground">{step.text}</p>}
              </div>
            )
          })}
        </div>
        <a
          href={current.image.src}
          class={buttonClasses("secondary", "md", "self-start")}
          onClick={(event) => {
            event.preventDefault()
            lightboxOpen.value = true
          }}
        >
          {viewFullSizeLabel}
        </a>
      </div>
      <Lightbox
        images={steps.map((step) => ({ src: step.image.src, alt: step.image.alt }))}
        index={selectedIndex}
        open={lightboxOpen.value}
        onClose={() => {
          lightboxOpen.value = false
        }}
        onIndexChange={pick}
        closeLabel={closeLabel}
        previousLabel={previousLabel}
        nextLabel={nextLabel}
        counterLabel={counterLabel}
      />
    </div>
  )
}
