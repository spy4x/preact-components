/**
 * `LanguagePicker` and `LanguageDialog`: how a person chooses the interface language.
 *
 * Every language is named in itself (Deutsch, Русский, العربية), from `Intl.DisplayNames`, so a
 * person who landed in a language they cannot read still finds their own. The picker is a radio
 * group for an app's dialog, or plain links for a website's footer; the dialog wraps the group in a
 * `Modal` and applies each choice at once.
 *
 * @module
 */

import { join } from "@spy4x/preact-cn/join"
import { IconCheck, IconGlobe, IconSpinner } from "@spy4x/preact-icons"
import { textDirection } from "@spy4x/platform/universal/i18n"
import { useSignal } from "@preact/signals"
import type { JSX } from "preact"
import { useEffect, useId, useRef } from "preact/hooks"
import { Button } from "./button.tsx"
import { useLabels } from "./i18n.tsx"
import { Modal } from "./modal.tsx"

/**
 * The name of a language in that language, first letter capitalised the way the language does it:
 * `languageName("ru")` is `"Русский"`, `languageName("pt-BR")` `"Português (Brasil)"`. A tag `Intl`
 * cannot parse comes back as it is.
 */
export function languageName(tag: string): string {
  try {
    const name = new Intl.DisplayNames([tag], { type: "language" }).of(tag)
    if (!name) return tag
    return name.slice(0, 1).toLocaleUpperCase(tag) + name.slice(1)
  } catch {
    return tag
  }
}

/** Every string {@link LanguagePicker} shows that is not a language's own name. */
export interface LanguagePickerLabels {
  /** The group's accessible name when nothing labels it. Defaults to `"Language"`. */
  label: string
  /** The "Automatic" option, given the device language's name. */
  automatic: (language: string) => string
  /** Read aloud while a language loads; never shown. */
  loading: (language: string) => string
  /** Shown under the list when a language failed to load. */
  error: (language: string) => string
  /** Under a language that needs a connection to load. Defaults to `"Needs a connection"`. */
  offline: string
}

const DEFAULT_LABELS: LanguagePickerLabels = {
  label: "Language",
  automatic: (language) => `Automatic: same as this device — ${language}`,
  loading: (language) => `Loading ${language}…`,
  error: (language) => `Could not load ${language}. Check your connection and try again.`,
  offline: "Needs a connection",
}

const LABEL_PARAMS = {
  automatic: ["language"],
  loading: ["language"],
  error: ["language"],
} as const

/** Props of {@link LanguagePicker}. */
export interface LanguagePickerProps {
  /** The languages offered, as BCP 47 tags (`"de"`, `"pt-BR"`), in the order shown. */
  languages: readonly string[]
  /** The language in use, or `null` when it follows the device ({@link automatic}). */
  current: string | null
  /**
   * `"list"`, the default, is a radio group for an app; `"links"` is a row of plain links for a
   * website, which works with no JavaScript and needs {@link href}.
   */
  mode?: "list" | "links"
  /** In `"links"` mode, the address of the page in a language. Required there. */
  href?: (tag: string) => string
  /** In `"list"` mode, called with the chosen tag, or `null` for "Automatic". */
  onSelect?: (tag: string | null) => void
  /**
   * The language being loaded after a choice: its row shows a spinner and a screen reader hears
   * "Loading …". `null` is "Automatic". Left out, nothing is loading.
   */
  pending?: string | null
  /** Languages that cannot load now, such as ones not cached while offline: disabled. */
  unavailable?: readonly string[]
  /** A language that failed to load: an error under the list names it. */
  failed?: string
  /**
   * The device's language. Given, the list starts with "Automatic: same as this device — …",
   * chosen when {@link current} is `null`.
   */
  automatic?: string
  /** Id of the element that names the group, such as a dialog's title. */
  labelledBy?: string
  /** Focus the chosen row when a dialog opens around the list (`autofocus`). */
  autoFocus?: boolean
  labels?: Partial<LanguagePickerLabels>
  /** Utilities on the root. */
  class?: string
}

/** A row of the list: 44 px tall at least, the text wrapping, never cut. */
const ROW =
  "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-start text-sm text-foreground hover:bg-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus disabled:cursor-default disabled:hover:bg-transparent"

/**
 * A language's own name, in its own language and direction. `notranslate` keeps page translators
 * (Google Translate honours the class) from translating it; the `translate` attribute cannot be
 * used, because Preact sets it as a property and the string `"no"` becomes `true`.
 */
function Name({ tag }: { tag: string }): JSX.Element {
  return (
    <span lang={tag} dir={textDirection(tag)} class="notranslate">
      {languageName(tag)}
    </span>
  )
}

/**
 * The language picker: every language by its own name, as a radio group (`mode="list"`) or as
 * links (`mode="links"`).
 *
 * **List.** A `role="radiogroup"` of buttons with `role="radio"` and `aria-checked`, one tab stop on
 * the chosen row. The arrow keys move to the next or previous enabled row and choose it, as a
 * radio group does (Left and Right swap in a right-to-left page); Home and End go to the ends.
 * Choosing calls `onSelect` and keeps focus on the row. The chosen row is the `pending` one while
 * it loads, with a spinner, and a live region says "Loading …", then the new language's name in
 * that language. A language in `unavailable` is disabled with "Needs a connection" under it; a
 * `failed` one is named in an error under the list.
 *
 * **Links.** A `<nav>` with one `<a href hreflang lang>` per language and `aria-current="page"` on
 * the current one, whose link is this very page: no script, so a website's footer works with
 * JavaScript off.
 */
export function LanguagePicker(
  {
    languages,
    current,
    mode = "list",
    href,
    onSelect,
    pending,
    unavailable = [],
    failed,
    automatic,
    labelledBy,
    autoFocus = false,
    labels: labelsProp,
    class: className,
  }: LanguagePickerProps,
): JSX.Element {
  const labels = useLabels("LanguagePicker", DEFAULT_LABELS, labelsProp, LABEL_PARAMS)
  const announced = useSignal<string | null>(null)
  const previous = useRef(current)
  const errorId = useId()

  // A new load starts with an empty region, so a failure is never followed by the old name.
  useEffect(() => {
    if (pending !== undefined) announced.value = null
  }, [pending])

  // Announce the new language once it is in use, in its own language.
  useEffect(() => {
    if (previous.current === current) return
    previous.current = current
    announced.value = current ?? automatic ?? null
  }, [current])

  if (mode === "links") {
    if (!href) throw new Error(`LanguagePicker: "links" mode needs href`)
    return (
      <nav aria-label={labels.label} class={join("flex items-start gap-2", className)}>
        <span class="flex h-5 shrink-0 items-center text-muted" aria-hidden="true">
          <IconGlobe class="size-4" />
        </span>
        <ul class="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {languages.map((tag) => (
            <li key={tag}>
              <a
                href={href(tag)}
                hreflang={tag}
                lang={tag}
                dir={textDirection(tag)}
                aria-current={tag === current ? "page" : undefined}
                class={join(
                  "notranslate inline-flex items-center gap-1 rounded-sm underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus",
                  tag === current ? "font-medium text-foreground" : "text-muted",
                )}
              >
                {languageName(tag)}
                {tag === current && <IconCheck class="size-3.5" aria-hidden="true" />}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    )
  }

  const options: (string | null)[] = automatic ? [null, ...languages] : [...languages]
  const chosen = pending !== undefined ? pending : current
  const enabled = (tag: string | null) =>
    tag === null || tag === current || !unavailable.includes(tag)
  const tabStop = options.find((tag) => tag === chosen && enabled(tag)) ??
    options.find(enabled)

  const choose = (tag: string | null, row: HTMLButtonElement) => {
    row.focus()
    if (tag !== chosen) onSelect?.(tag)
  }

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    const group = event.currentTarget
    const rows = [...group.querySelectorAll<HTMLButtonElement>(`[role="radio"]:not(:disabled)`)]
    const index = rows.indexOf(event.target as HTMLButtonElement)
    if (index < 0) return
    const rtl = getComputedStyle(group).direction === "rtl"
    const step: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      ArrowRight: rtl ? -1 : 1,
      ArrowLeft: rtl ? 1 : -1,
    }
    let next: number
    if (event.key in step) next = (index + step[event.key] + rows.length) % rows.length
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = rows.length - 1
    else return
    event.preventDefault()
    const row = rows[next]
    choose(valueOf(row), row)
  }

  const nameOf = (tag: string | null) => tag ?? automatic ?? ""
  const loading = pending !== undefined && nameOf(pending) !== ""

  return (
    <div class={join("flex flex-col gap-3", className)}>
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : labels.label}
        aria-describedby={failed ? errorId : undefined}
        class="flex flex-col gap-1"
        onKeyDown={onKeyDown}
      >
        {options.map((tag) => {
          const checked = tag === chosen
          const disabled = !enabled(tag)
          const isTabStop = tag === tabStop
          return (
            <button
              key={tag ?? ""}
              type="button"
              role="radio"
              aria-checked={checked ? "true" : "false"}
              aria-busy={checked && loading ? "true" : undefined}
              data-value={tag ?? AUTOMATIC}
              disabled={disabled}
              tabIndex={isTabStop ? 0 : -1}
              autofocus={autoFocus && isTabStop}
              class={join(ROW, checked && "font-medium")}
              onClick={(event) => choose(tag, event.currentTarget)}
            >
              {checked
                ? <IconCheck class="size-4 shrink-0 text-selected" aria-hidden="true" />
                : <span class="size-4 shrink-0" aria-hidden="true" />}
              <span class="flex min-w-0 flex-1 flex-col">
                {tag === null ? <Automatic tag={automatic ?? ""} labels={labels} /> : (
                  // A block in the row's direction, so a name in another script still lines up
                  // at the row's start. Dimmed when disabled; the note under it stays readable.
                  <span class={disabled ? "text-muted" : undefined}>
                    <Name tag={tag} />
                  </span>
                )}
                {disabled && <span class="text-xs text-muted">{labels.offline}</span>}
              </span>
              {checked && loading && (
                <IconSpinner class="size-4 shrink-0 text-muted" aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>
      {failed && (
        <p id={errorId} role="alert" class="text-sm text-danger">
          {labels.error(languageName(failed))}
        </p>
      )}
      <p role="status" aria-live="polite" class="sr-only">
        {loading
          ? labels.loading(languageName(nameOf(pending)))
          : announced.value
          ? <Name tag={announced.value} />
          : null}
      </p>
    </div>
  )
}

/** `data-value` of the "Automatic" row: nine letters, so never a language tag. */
const AUTOMATIC = "automatic"

/** The value a row stands for: its language tag, or `null` for "Automatic". */
function valueOf(row: HTMLElement): string | null {
  const value = row.dataset.value
  return value === undefined || value === AUTOMATIC ? null : value
}

/** The marker the "Automatic" text is filled with, to find where the language's name goes. */
const NAME_SLOT = "\u0001"

/**
 * "Automatic: same as this device — English", with the name in its own language: the message is
 * filled with a marker, and the name drawn where the marker landed.
 */
function Automatic(
  { tag, labels }: { tag: string; labels: LanguagePickerLabels },
): JSX.Element {
  const [before, after] = labels.automatic(NAME_SLOT).split(NAME_SLOT)
  if (after === undefined) return <span>{before}</span>
  return (
    <span>
      {before}
      <Name tag={tag} />
      {after}
    </span>
  )
}

/** Every string {@link LanguageDialog} shows besides the picker's own. */
export interface LanguageDialogLabels {
  /** The dialog's title. Defaults to `"Language"`. */
  title: string
  /** The sentence under the title. */
  description: string
  /** The button that closes the dialog. Defaults to `"Done"`. */
  done: string
  /** The header's close control. Defaults to `"Close"`. */
  closeLabel: string
}

const DEFAULT_DIALOG_LABELS: LanguageDialogLabels = {
  title: "Language",
  description: "The language of menus, buttons and messages. Dates and numbers follow Formats.",
  done: "Done",
  closeLabel: "Close",
}

/** Props of {@link LanguageDialog}. */
export interface LanguageDialogProps
  extends Omit<LanguagePickerProps, "mode" | "href" | "labelledBy" | "autoFocus" | "labels"> {
  /** Whether the dialog is on screen. */
  open: boolean
  /** Called on Done, Escape, the close control and a backdrop click. */
  onClose: () => void
  labels?: Partial<LanguageDialogLabels>
  /** The picker's own labels. */
  pickerLabels?: Partial<LanguagePickerLabels>
  /** `data-e2e` on the dialog. Defaults to `"language-dialog"`. */
  dataE2E?: string
}

/**
 * A `Modal` holding the {@link LanguagePicker} list. A choice applies at once and the dialog stays
 * open, now in the new language, so a wrong tap is undone by one more; Done closes it. It opens
 * with focus on the chosen row.
 */
export function LanguageDialog(
  {
    open,
    onClose,
    labels: labelsProp,
    pickerLabels,
    dataE2E = "language-dialog",
    ...picker
  }: LanguageDialogProps,
): JSX.Element | null {
  const labels = useLabels("LanguageDialog", DEFAULT_DIALOG_LABELS, labelsProp)
  const id = useId()
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={labels.title}
      titleId={titleId}
      ariaDescribedBy={descriptionId}
      cancelLabel={labels.closeLabel}
      dataE2E={dataE2E}
      footer={
        <Button variant="secondary" onClick={onClose} data-e2e="language-dialog-done">
          {labels.done}
        </Button>
      }
    >
      <div class="flex flex-col gap-4">
        <p id={descriptionId} class="text-sm text-muted">{labels.description}</p>
        <LanguagePicker {...picker} labelledBy={titleId} autoFocus labels={pickerLabels} />
      </div>
    </Modal>
  )
}

/** Props of {@link LanguageButton}: {@link LanguageDialogProps} without the open state it owns. */
export interface LanguageButtonProps extends Omit<LanguageDialogProps, "open" | "onClose"> {
  /** `data-e2e` on the button. Defaults to `"language-button"`. */
  buttonDataE2E?: string
}

/**
 * A ghost button with `IconGlobe` and the language in use, named in itself, that opens
 * {@link LanguageDialog}: the language switch of a signed-out header, so a visitor who landed in a
 * language they cannot read finds their own before signing in.
 *
 * The language in use is `current`, or `automatic` while it follows the device. A screen reader
 * hears the dialog's title before it ("Language Deutsch"), from a visually hidden word, so the
 * name keeps its own `lang`. With neither given, the button shows the title instead. Closing the
 * dialog (Done, Escape, the close control, the backdrop) returns focus to the button.
 */
export function LanguageButton(
  { buttonDataE2E = "language-button", ...dialog }: LanguageButtonProps,
): JSX.Element {
  const labels = useLabels("LanguageDialog", DEFAULT_DIALOG_LABELS, dialog.labels)
  const open = useSignal(false)
  const inUse = dialog.current ?? dialog.automatic
  return (
    <>
      <Button
        variant="ghost"
        aria-haspopup="dialog"
        data-e2e={buttonDataE2E}
        onClick={() => open.value = true}
      >
        <IconGlobe class="size-4" aria-hidden="true" />
        {inUse
          ? (
            <>
              <span class="sr-only">{labels.title}</span>
              <Name tag={inUse} />
            </>
          )
          : labels.title}
      </Button>
      <LanguageDialog {...dialog} open={open.value} onClose={() => open.value = false} />
    </>
  )
}
