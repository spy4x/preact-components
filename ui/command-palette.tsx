import { join } from "@spy4x/preact-cn/join"
import { IconSearch, IconXMark } from "@spy4x/preact-icons"
import type { JSX } from "preact"
import { useSignal } from "@preact/signals"
import { useEffect, useId, useRef } from "preact/hooks"
import { matchEntry, type SearchMatchKind } from "@spy4x/platform/universal/text"
import { comboboxKey, comboboxKeyAction, fold } from "./combobox.tsx"
import { HotkeyHint } from "./hotkey-hint.tsx"
import { focusBefore, focusOnClose } from "./palette-focus.ts"
import { ariaKeyShortcuts, hotkeyClickBinding, useApplePlatform, useHotkeys } from "./hotkeys.ts"
import { isComposingInput, useComposedQuery } from "./composed-query.ts"
import { isImeKeyPress } from "./ime.ts"
import type { KbdLabels } from "./kbd-keys.tsx"
import { acquireScrollLock, type ScrollLock } from "./scroll-lock.ts"
import { useBackdropPress } from "./backdrop-press.ts"

/** One result the palette lists. Extend it with whatever `onSelect` needs, such as an `href`. */
export interface CommandPaletteOption {
  /** Unique among the options shown at once. */
  id: string
  /** The name a reader types and sees. */
  label: string
  /** A second line under the label, such as where the result lives. */
  detail?: string
  /** A short word at the row's end, such as the result's kind. */
  hint?: string
  /** The heading the option is listed under. Options without one are listed first, unheaded. */
  group?: string
  /**
   * Other names the default filter finds the option by, such as `["calendar", "календарь"]`.
   * Never shown.
   */
  aliases?: readonly string[]
}

/**
 * How a query matched an option, strongest first: one of `matchEntry`'s kinds from
 * `@spy4x/platform/universal/text` (`exact`, `prefix`, `words`, `alias`, `layout`, `translit`,
 * `typo`), or `detail` when only the option's `detail` holds the query.
 */
export type CommandPaletteMatchKind = SearchMatchKind | "detail"

/** English defaults for the words `showMatch` puts beside a result, one per {@link CommandPaletteMatchKind}. */
export const defaultCommandPaletteMatchLabels: Readonly<Record<CommandPaletteMatchKind, string>> = {
  exact: "Exact name",
  prefix: "Start of the name",
  words: "Words in any order",
  alias: "Another name",
  layout: "Other keyboard layout",
  translit: "Other alphabet",
  typo: "Typo fixed",
  detail: "In the details",
}

/** The palette's own words. Each has an English default in {@link defaultCommandPaletteLabels}. */
export interface CommandPaletteLabels {
  /** The dialog's, the field's and the result list's accessible name. */
  search: string
  /** The field's placeholder, and the trigger's visible text and accessible name. */
  placeholder: string
  /** The dialog's close button's accessible name. */
  close: string
  /** What the list says when nothing matches. */
  empty: string
  /**
   * What the palette says while a `search` call runs, once the reader has waited 300 ms for it:
   * beside the field while earlier results are listed, in the list when it is empty.
   */
  loading: string
  /** What the list says when a `search` call failed. */
  error: string
}

/** English defaults for every {@link CommandPaletteLabels} entry. */
export const defaultCommandPaletteLabels: Readonly<CommandPaletteLabels> = {
  search: "Search",
  placeholder: "Search…",
  close: "Close the search",
  empty: "Nothing matches.",
  loading: "Searching…",
  error: "The search failed. Try again.",
}

/**
 * The hotkeys a palette opens on when the caller names none: `/`, and ⌘K on Apple platforms or
 * Ctrl+K elsewhere. `mod+k` rather than both chords, so a Mac keeps Ctrl+K, which deletes to the
 * end of the line in a text field.
 */
const DEFAULT_HOTKEYS: readonly string[] = ["/", "mod+k"]

/**
 * How long, in milliseconds after a keystroke, the remote mode waits for its answer before it says
 * it is searching. A quicker answer changes the list without a flash of the loading label in between.
 */
const SLOW_SEARCH_MS = 300

/** Props every {@link CommandPalette} takes, whichever data mode it uses. */
export interface CommandPaletteBaseProps<T extends CommandPaletteOption> {
  /** Called with the option the reader picked, after the palette has closed. */
  onSelect: (option: T) => void
  /**
   * The combinations that open the palette, written the way `useHotkeys` takes them. Defaults to
   * `["/", "mod+k"]`: `/`, and ⌘K on Apple platforms or Ctrl+K elsewhere. `[]` turns them off.
   * Each one clicks the trigger, by the rule a button's `hotkey` follows, so it does nothing while
   * the trigger is hidden. The trigger announces them all in `aria-keyshortcuts` and shows the
   * first one, as a button's `hotkey` hint, where the screen is wide and the pointer fine. While the reader types in a text field, a combination with
   * Control, Command or `mod` still opens it; a plain key or an Alt combination does not, since
   * both type text, and the field keeps its editing chords (`mod` with A, C, V, X, Z or Y). See
   * `firesInFields`.
   */
  hotkeys?: readonly string[]
  /** The words the trigger's hotkey hint shows for a key; see `KBD_LABELS`. */
  kbdLabels?: Partial<KbdLabels>
  /** Overrides for the palette's words; see {@link defaultCommandPaletteLabels}. */
  labels?: Partial<CommandPaletteLabels>
  /**
   * The dialog's `data-e2e`. The trigger gets the same name with `-open` and the close button
   * with `-close`.
   */
  dataE2E?: string
  /**
   * Extra classes for the trigger, appended after its own and not merged into them, so
   * `tailwind-merge` stays out of the bundle. To replace one of the trigger's own utilities, such
   * as its width, mark the replacement important with a trailing `!`: `w-80!`.
   */
  class?: string
  /**
   * The trigger's shape. `"button"`, the default, is an icon button on a phone and a field-shaped
   * button with the placeholder and the hotkey hint from `sm`. `"field"` is the field-shaped button
   * at every width, as wide as its container. A printable key typed on a focused `"field"` trigger
   * opens the palette with that key as the query, as a real field would take it; a key that is
   * one of `hotkeys` opens it as the hotkey does.
   */
  trigger?: "button" | "field"
  /**
   * The query the field holds each time the palette opens, selected, so the first key typed
   * replaces it. Defaults to the empty query.
   */
  defaultQuery?: string
  /**
   * Shows beside each result how the query matched it ({@link CommandPaletteMatchKind}), in the
   * words of `matchLabels`. Every result carries the kind in `data-match` either way.
   */
  showMatch?: boolean
  /** Overrides for the words `showMatch` shows; see {@link defaultCommandPaletteMatchLabels}. */
  matchLabels?: Partial<Record<CommandPaletteMatchKind, string>>
}

/** The local data mode: the palette filters `options` itself. */
export interface CommandPaletteLocalProps<T extends CommandPaletteOption>
  extends CommandPaletteBaseProps<T> {
  /** Every option, filtered as the reader types. */
  options: readonly T[]
  /**
   * The options a query shows, in order. Defaults to {@link matchOptions}, which forgives typos,
   * word order, the other keyboard layout and the other alphabet. {@link rankOptions} is the plain
   * substring ranking the palette used before.
   */
  filter?: (options: readonly T[], query: string) => readonly T[]
  search?: never
  debounce?: never
}

/** The remote data mode: the palette asks `search` for the options of each query. */
export interface CommandPaletteRemoteProps<T extends CommandPaletteOption>
  extends CommandPaletteBaseProps<T> {
  /**
   * The options for a query. Called with the empty query when the palette opens, then once per
   * pause in typing. `signal` aborts when a newer query or a close makes the answer stale; a stale
   * answer is ignored even when the function does not listen to `signal`. A rejection shows the
   * error label. While the next answer loads, the previous results stay listed as they are; past
   * 300 ms the loading label shows beside the field and is announced. Enter pressed
   * while it loads waits for the answer and picks its first result.
   */
  search: (query: string, signal: AbortSignal) => Promise<readonly T[]>
  /** Milliseconds of quiet typing before `search` is called. Defaults to `200`. */
  debounce?: number
  options?: never
  filter?: never
}

/** Props of {@link CommandPalette}: exactly one of `options` and `search`. */
export type CommandPaletteProps<T extends CommandPaletteOption> =
  | CommandPaletteLocalProps<T>
  | CommandPaletteRemoteProps<T>

/** One heading and the options under it, in the order the palette lists them. */
export interface CommandPaletteGroup<T extends CommandPaletteOption> {
  /** The heading, or `undefined` for the options that name no group. */
  label: string | undefined
  options: T[]
}

/**
 * The plain substring ranking, kept for callers that want it over {@link matchOptions}: the
 * options that match `query`, best first, at most `limit` of them: names equal to the query,
 * then names that start with it, then names that contain it, then options whose `detail` contains
 * it. The input order breaks ties. Matching folds case and accents the way `Combobox` does, and an
 * empty query matches every option. It reads only `label` and `detail`, so any list with those
 * fields can be ranked.
 *
 * @param options The options to search.
 * @param query What the reader typed.
 * @param limit The most results to return.
 */
export function rankOptions<T extends Pick<CommandPaletteOption, "label" | "detail">>(
  options: readonly T[],
  query: string,
  limit = 50,
): T[] {
  const needle = fold(query.trim())
  if (needle === "") return options.slice(0, limit)
  const rank = (option: T): number => {
    const label = fold(option.label)
    if (label === needle) return 0
    if (label.startsWith(needle)) return 1
    if (label.includes(needle)) return 2
    if (option.detail !== undefined && fold(option.detail).includes(needle)) return 3
    return -1
  }
  return options
    .map((option, index) => ({ option, index, rank: rank(option) }))
    .filter((scored) => scored.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((scored) => scored.option)
}

/** What {@link matchOptions} and {@link matchOption} read of an option. */
export type MatchableOption = Pick<CommandPaletteOption, "label" | "detail" | "aliases">

/** Whether the option's `detail` holds the query, folding case and accents. */
function detailHolds(needle: string, option: MatchableOption): boolean {
  return option.detail !== undefined && fold(option.detail).includes(needle)
}

/**
 * How `query` matched one option, or `undefined` when it did not or the query is empty: what
 * `matchEntry` from `@spy4x/platform/universal/text` says of its `label` and `aliases`, else
 * `"detail"` when its `detail` holds the query.
 *
 * @param query What the reader typed.
 * @param option The option to test.
 */
export function matchOption(
  query: string,
  option: MatchableOption,
): CommandPaletteMatchKind | undefined {
  const needle = fold(query.trim())
  if (needle === "") return undefined
  const match = matchEntry(query, option)
  if (match) return match.how
  return detailHolds(needle, option) ? "detail" : undefined
}

/**
 * The options that match `query`, best first, at most `limit` of them: the palette's default
 * filter. Labels and aliases are matched by `matchEntry` from `@spy4x/platform/universal/text`,
 * which ignores case, accents and word order, lets each query word start a word of the name, fixes
 * one typo in a word of four letters or more, and reads a query typed in the other keyboard layout
 * (ЙЦУКЕН and QWERTY) or the other alphabet (Cyrillic and Latin): `"combobx"` finds `"Combobox"`
 * and `"ещфые"` finds `"Toast"`. Options whose `detail` alone holds the query come last. The input
 * order breaks ties, and an empty query matches every option.
 *
 * @param options The options to search.
 * @param query What the reader typed.
 * @param limit The most results to return.
 */
export function matchOptions<T extends MatchableOption>(
  options: readonly T[],
  query: string,
  limit = 50,
): T[] {
  const needle = fold(query.trim())
  if (needle === "") return options.slice(0, limit)
  const scored: { option: T; index: number; score: number }[] = []
  options.forEach((option, index) => {
    const match = matchEntry(query, option)
    if (match) scored.push({ option, index, score: match.score })
    else if (detailHolds(needle, option)) scored.push({ option, index, score: -1 })
  })
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((match) => match.option)
}

/**
 * The options under their headings: the unheaded ones first, then each group in the order it first
 * appears, each keeping its options' order.
 *
 * @param options The options to group.
 */
export function groupOptions<T extends CommandPaletteOption>(
  options: readonly T[],
): CommandPaletteGroup<T>[] {
  const groups = new Map<string | undefined, T[]>([[undefined, []]])
  for (const option of options) {
    const list = groups.get(option.group)
    if (list) list.push(option)
    else groups.set(option.group, [option])
  }
  return [...groups].filter(([, list]) => list.length > 0).map(([label, list]) => ({
    label,
    options: list,
  }))
}

/** Where a `search` call stands. */
enum Status {
  IDLE = 1,
  /** Loading for less than {@link SLOW_SEARCH_MS}: the previous results show as they were. */
  LOADING = 2,
  ERROR = 3,
  /** Loading for {@link SLOW_SEARCH_MS} or longer: the loading label shows. */
  SLOW = 4,
}

/** The remote mode's last answer and where the current call stands. */
interface Remote<T> {
  status: Status
  options: readonly T[]
}

/**
 * A search trigger and the dialog it opens: one field and a list of results that the arrow keys
 * move through, as `Combobox` does. Home and End jump to either end, Enter picks the highlighted
 * result, and Escape, the close button or a click on the backdrop closes it, with focus back on the
 * trigger. When the trigger is hidden, such as when an app opens the palette from controls of its
 * own by clicking it, focus goes back to the element that had it before the palette opened. `/` and ⌘K (Ctrl+K off Apple platforms) open it unless `hotkeys` says otherwise. The page
 * behind does not scroll while it is open.
 *
 * Give `options` to have it filter a list itself, or `search` to ask a server, which it calls after
 * a pause in typing, cancelling a stale call. The default filter forgives typos, word order, the
 * other keyboard layout and the other alphabet ({@link matchOptions}), and each result carries how
 * it matched in `data-match`, shown in words with `showMatch`. Results with a `group` are listed
 * under headings. On a phone the trigger is an icon button unless `trigger` is `"field"`, and the
 * dialog fills the screen. `defaultQuery` opens it with a query already typed.
 *
 * @param props See {@link CommandPaletteProps}.
 */
export function CommandPalette<T extends CommandPaletteOption>(
  props: CommandPaletteProps<T>,
): JSX.Element {
  const {
    hotkeys = DEFAULT_HOTKEYS,
    kbdLabels,
    dataE2E,
    class: className,
    trigger: triggerShape = "button",
    showMatch = false,
  } = props
  const labels = { ...defaultCommandPaletteLabels, ...props.labels }
  const matchLabels = { ...defaultCommandPaletteMatchLabels, ...props.matchLabels }
  const field = triggerShape === "field"
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  // What had focus when the palette opened: where focus goes back to while the trigger is hidden.
  const before = useRef<HTMLElement | null>(null)
  const id = useId()
  const query = useSignal(props.defaultQuery ?? "")
  const activeIndex = useSignal(0)
  const remote = useSignal<Remote<T>>({ status: Status.IDLE, options: [] })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const slowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Enter was pressed while a search ran: pick the answer's first result when it lands.
  const pickWhenAnswered = useRef(false)
  const call = useRef<AbortController | null>(null)
  const lock = useRef<ScrollLock | null>(null)
  const latest = useRef(props)
  latest.current = props
  // A click on the backdrop lands on the dialog element itself; the press has to begin there too.
  const backdrop = useBackdropPress((event) => event.target === dialog.current)

  const remoteMode = props.search !== undefined
  const busy = remoteMode &&
    (remote.value.status === Status.LOADING || remote.value.status === Status.SLOW)
  // While an input method composes, the results stay those of the text from before it began.
  const composedQuery = useComposedQuery(input, query.value, (text) => onTyped(text))
  const results = props.search !== undefined
    ? remote.value.options
    : (props.filter ?? matchOptions)(props.options, composedQuery)
  const groups = groupOptions(results)
  const flat = groups.flatMap((group) => group.options)

  /**
   * Drops a waiting or running `search` call, and an Enter waiting for it; its answer, if it still
   * comes, is ignored.
   */
  const cancel = () => {
    clearTimeout(timer.current)
    timer.current = undefined
    clearTimeout(slowTimer.current)
    slowTimer.current = undefined
    pickWhenAnswered.current = false
    call.current?.abort()
    call.current = null
  }

  /** Asks `search` for `text` after `delay` milliseconds, replacing any earlier call. */
  const ask = (text: string, delay: number) => {
    cancel()
    const search = latest.current.search
    if (search === undefined) return
    // The previous query's answer stays listed, so the list does not blink on every keystroke. Enter
    // waits for the new answer instead of picking from it (see `onKeyDown`).
    remote.value = { status: Status.LOADING, options: remote.value.options }
    slowTimer.current = setTimeout(() => {
      slowTimer.current = undefined
      if (remote.value.status === Status.LOADING) {
        remote.value = { ...remote.value, status: Status.SLOW }
      }
    }, SLOW_SEARCH_MS)
    timer.current = setTimeout(() => {
      timer.current = undefined
      const controller = new AbortController()
      call.current = controller
      const settle = (next: Remote<T>) => {
        if (call.current !== controller) return
        call.current = null
        clearTimeout(slowTimer.current)
        slowTimer.current = undefined
        remote.value = next
        activeIndex.value = 0
        if (pickWhenAnswered.current) {
          pickWhenAnswered.current = false
          choose(next.options[0])
        }
      }
      let answer: Promise<readonly T[]>
      try {
        answer = Promise.resolve(search(text, controller.signal))
      } catch (error) {
        answer = Promise.reject(error)
      }
      answer.then(
        (options) => settle({ status: Status.IDLE, options }),
        () => settle({ status: Status.ERROR, options: [] }),
      )
    }, delay)
  }

  /** Lets the page scroll again, if the palette locked it. */
  const unlock = () => {
    lock.current?.release()
    lock.current = null
  }

  useEffect(() => () => {
    cancel()
    unlock()
  }, [])

  /**
   * Opens the palette with `typed` in the field, the caret after it, or else with `defaultQuery`
   * selected.
   */
  const open = (typed?: string) => {
    if (dialog.current?.open) return
    const text = typed ?? latest.current.defaultQuery ?? ""
    query.value = text
    activeIndex.value = 0
    if (latest.current.search !== undefined) {
      remote.value = { status: Status.IDLE, options: [] }
      ask(text, 0)
    }
    // The page behind stays put, as it does behind `Modal`, padded by the scrollbar it loses. The
    // lock is the one `Modal` holds too, counted: a page something else has already locked, such as
    // an open `Modal` behind the palette or an app dialog that adds a class, keeps that lock, and a
    // `Modal` the palette's `onSelect` opens keeps the page locked after the palette lets go.
    lock.current ??= acquireScrollLock()
    before.current = focusBefore(document.activeElement as HTMLElement | null, document.body)
    dialog.current?.showModal()
    const box = input.current
    if (!box) return
    // The signal renders the text on the next frame; the field needs it now, to select it.
    box.value = text
    box.focus()
    if (typed === undefined) box.select()
    else box.setSelectionRange(text.length, text.length)
  }

  /** A printable key on a focused field-shaped trigger opens the palette with that key typed. */
  const onTriggerKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLButtonElement>) => {
    if (!field || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
    // A space presses the button, and a hotkey opens the palette the hotkey's way.
    if ([...event.key].length !== 1 || event.key === " " || hotkeys.includes(event.key)) return
    event.preventDefault()
    open(event.key)
  }
  const close = () => dialog.current?.close()
  const choose = (option: T | undefined) => {
    if (!option) return
    close()
    // The latest `onSelect`: a pick that waited for a search runs after later renders.
    latest.current.onSelect(option)
  }

  useHotkeys(
    // A button's `hotkey` binding on the trigger: a Control, Command or `mod` chord opens the
    // palette from a text field too, unless it is one of the field's editing chords.
    hotkeys.map((keys) => hotkeyClickBinding(keys, () => trigger.current)),
    { enabled: hotkeys.length > 0 },
  )
  const apple = useApplePlatform()

  /** Follow a finished keystroke: highlight the first result, and ask `search` after the pause. */
  const onTyped = (text: string) => {
    query.value = text
    activeIndex.value = 0
    if (remoteMode) ask(text, latest.current.debounce ?? 200)
  }

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    // An input method confirms or cancels a word with Enter and Escape; the word is not finished.
    if (isImeKeyPress(event)) return
    const key = comboboxKey(event)
    if (key === undefined) return
    if (key === "Escape") {
      event.preventDefault()
      close()
      return
    }
    if (key === "Enter" && busy) {
      // The highlighted row belongs to the previous query: wait for this one's answer instead.
      event.preventDefault()
      pickWhenAnswered.current = true
      return
    }
    const action = comboboxKeyAction(
      key,
      { activeIndex: activeIndex.value, isOpen: true },
      flat.length,
    )
    if (action.preventDefault) event.preventDefault()
    if (action.select >= 0) return choose(flat[action.select])
    activeIndex.value = action.state.activeIndex
  }

  const listbox = `${id}-results`
  // Keyed by the option's own id, not its row: when an answer puts another option in the
  // highlighted row, the active descendant changes and a screen reader announces the new one.
  const optionId = (option: T) => `${id}-result-${encodeURIComponent(option.id)}`
  const active = flat.length === 0 ? -1 : Math.min(activeIndex.value, flat.length - 1)

  // Keep the highlighted result on screen, as `Combobox` does: the list scrolls by just the row
  // that went past its edge, and a row already in view does not move it.
  useEffect(() => {
    if (active < 0 || !dialog.current?.open) return
    document.getElementById(optionId(flat[active]))?.scrollIntoView({ block: "nearest" })
  }, [active, flat.length, flat[active]?.id])
  const status = !remoteMode || remote.value.status === Status.IDLE
    ? flat.length === 0 ? labels.empty : ""
    : remote.value.status === Status.SLOW
    ? labels.loading
    : remote.value.status === Status.ERROR
    ? labels.error
    : ""
  const firstHotkey = hotkeys[0]
  const shortcuts = hotkeys.length === 0
    ? undefined
    : hotkeys.map((keys) => ariaKeyShortcuts(keys, apple)).join(" ")

  const row = (option: T, index: number) => {
    const how = matchOption(composedQuery, option)
    const shownMatch = showMatch && how !== undefined ? matchLabels[how] : undefined
    return (
      <li
        key={option.id}
        id={optionId(option)}
        role="option"
        aria-selected={index === active}
        data-match={how}
        onClick={() => choose(option)}
        // No pointer handler moves the highlight, as in `Combobox`: `aria-activedescendant` is where a
        // screen reader is reading, and a pointer its user is not holding must not drag it around.
        // The row under the pointer still lights up, in CSS, announcing nothing.
        class={join(
          "flex cursor-pointer items-baseline justify-between gap-4 rounded-lg px-3 py-2",
          // A touch target on a phone, however short its text.
          "max-sm:min-h-11 max-sm:items-center",
          index === active ? "bg-selected-soft text-selected" : "hover:bg-hover",
        )}
      >
        <span class="min-w-0">
          {
            /* A long name stops at two lines and a long detail at one, so one result cannot push the
        rest off the screen. */
          }
          <span class="line-clamp-2 text-sm font-medium [overflow-wrap:anywhere]">
            {option.label}
          </span>
          {option.detail !== undefined && (
            <span class="line-clamp-1 text-xs text-muted [overflow-wrap:anywhere]">
              {option.detail}
            </span>
          )}
        </span>
        {(shownMatch !== undefined || option.hint !== undefined) && (
          <span class="flex shrink-0 items-baseline gap-2">
            {shownMatch !== undefined && (
              // How the query found the result, in words: a typo fixed, the other layout.
              <span class="rounded-md border border-subtle px-2 text-xs text-muted">
                {shownMatch}
              </span>
            )}
            {option.hint !== undefined && <span class="text-xs text-muted">{option.hint}</span>}
          </span>
        )}
      </li>
    )
  }

  let index = 0
  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => open()}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="dialog"
        aria-label={labels.placeholder}
        aria-keyshortcuts={shortcuts}
        data-e2e={dataE2E === undefined ? undefined : `${dataE2E}-open`}
        class={join(
          field
            // A field-shaped button at every width, as wide as its container.
            ? "flex h-9 w-full items-center gap-2 rounded-lg border border-subtle bg-surface px-3 text-sm text-muted hover:border-control hover:text-foreground"
            // An icon button on a phone; a field-shaped button with its placeholder and hotkey
            // from `sm`.
            : "flex h-9 items-center gap-2 rounded-lg border border-transparent px-2 text-sm text-muted hover:text-foreground sm:w-56 sm:border-subtle sm:bg-surface sm:px-3 sm:hover:border-control lg:w-72",
          className,
        )}
      >
        <IconSearch class={field ? "size-4 shrink-0" : "size-5 shrink-0 sm:size-4"} />
        <span
          class={field ? "min-w-0 flex-1 truncate text-left" : "hidden flex-1 text-left sm:inline"}
        >
          {labels.placeholder}
        </span>
        {firstHotkey !== undefined && (
          // The hint is a button hotkey's own, which shows only for a fine pointer; the wrapper
          // also keeps it off the icon-only trigger a narrow screen gets.
          <span class={field ? "contents" : "hidden sm:contents"}>
            <HotkeyHint keys={firstHotkey} apple={apple} labels={kbdLabels} />
          </span>
        )}
      </button>
      <dialog
        ref={dialog}
        aria-label={labels.search}
        data-e2e={dataE2E}
        onClose={() => {
          cancel()
          unlock()
          focusOnClose(trigger.current, before.current, input.current)
          before.current = null
        }}
        onPointerDown={backdrop.onPointerDown}
        onClick={(event) => {
          if (backdrop.isBackdropClick(event)) close()
        }}
        class={join(
          "inset-x-0 top-16 bottom-auto mx-auto my-0 w-[min(36rem,calc(100vw-2rem))] max-w-none rounded-xl border border-subtle bg-surface p-0 text-foreground shadow-2xl",
          "backdrop:bg-scrim backdrop:backdrop-blur-sm",
          // A full-screen sheet on a phone.
          "max-sm:inset-0 max-sm:m-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:rounded-none max-sm:border-0 max-sm:open:flex max-sm:open:flex-col",
        )}
      >
        <div class="flex items-center gap-2 border-b border-subtle px-4">
          <IconSearch class="size-4 shrink-0 text-muted" />
          <input
            ref={input}
            // A text field rather than `type="search"`, whose own clear button Chromium draws
            // beside the close button: a second "×". The role is `combobox` either way, and the
            // phone keyboard still offers its search key.
            type="text"
            inputMode="search"
            enterkeyhint="search"
            role="combobox"
            aria-expanded="true"
            aria-controls={listbox}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? optionId(flat[active]) : undefined}
            aria-label={labels.search}
            placeholder={labels.placeholder}
            autocomplete="off"
            spellcheck={false}
            value={query.value}
            onInput={(event) => {
              const text = event.currentTarget.value
              // A step of a word an input method is still building is only shown: the results
              // and the search wait for the composition to end.
              if (isComposingInput(event)) query.value = text
              else onTyped(text)
            }}
            onKeyDown={onKeyDown}
            class="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-placeholder"
          />
          {
            /* A slow search over results still listed says so here, beside the field, so the rows
            neither move nor fade. Hidden from screen readers: the status line below tells them. */
          }
          {remote.value.status === Status.SLOW && flat.length > 0 && (
            <span
              aria-hidden="true"
              data-e2e={dataE2E === undefined ? undefined : `${dataE2E}-searching`}
              class="shrink-0 text-xs text-muted"
            >
              {labels.loading}
            </span>
          )}
          {
            /* Escape and a backdrop click close it too, but a phone has neither a key nor much
            backdrop: the button is the way out a reader can see. */
          }
          <button
            type="button"
            aria-label={labels.close}
            data-e2e={dataE2E === undefined ? undefined : `${dataE2E}-close`}
            onClick={close}
            class="-mr-2 flex size-11 shrink-0 sm:size-9 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-foreground"
          >
            <IconXMark class="size-5" />
          </button>
        </div>
        {
          /* The listbox is the scroll box itself, so the field's `aria-controls` names the box that
          scrolls: a combobox's popup, which the arrow keys scroll by moving the highlight (the
          effect above), while focus stays in the field. A plain box around it would scroll with
          nothing in it to focus. */
        }
        <div class="flex min-h-0 flex-col max-sm:flex-1">
          {
            /* Always in the page, so a screen reader hears each change; shown only when there is no
            list to show it beside. */
          }
          <p
            role="status"
            data-e2e={dataE2E === undefined ? undefined : `${dataE2E}-status`}
            class={flat.length === 0 ? "m-2 px-3 py-6 text-center text-sm text-muted" : "sr-only"}
          >
            {status}
          </p>
          <ul
            id={listbox}
            role="listbox"
            aria-label={labels.search}
            aria-busy={busy ? "true" : undefined}
            class={join(
              "max-h-96 overflow-y-auto max-sm:max-h-none max-sm:min-h-0 max-sm:flex-1",
              flat.length > 0 && "p-2",
            )}
          >
            {groups.map((group, groupIndex) =>
              group.label === undefined ? group.options.map((option) => row(option, index++)) : (
                // A listbox holds options and groups of options; the `<li>` around the group is
                // only there for the HTML list, so it has no role.
                <li key={`group ${group.label}`} role="none">
                  <ul role="group" aria-labelledby={`${id}-group-${groupIndex}`}>
                    <li
                      id={`${id}-group-${groupIndex}`}
                      role="presentation"
                      class="px-3 pb-1 pt-3 text-xs font-medium text-muted"
                    >
                      {group.label}
                    </li>
                    {group.options.map((option) => row(option, index++))}
                  </ul>
                </li>
              )
            )}
          </ul>
        </div>
      </dialog>
    </>
  )
}
