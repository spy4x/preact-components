import { cn } from "@preact-components/cn"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"

/**
 * One file a {@link FileInput} refused, and why.
 *
 * `reason` is one of the two checks the component itself runs — `maxSize` and `accept` — never a
 * server-side rejection, which arrives through the app's own upload flow and has nothing to do
 * with this component.
 */
export interface FileRejection {
  file: File
  /**
   * `"too-many"` is the third reason: a caller without `multiple` who drops (or otherwise hands
   * in) more than one file at once. The native picker already limits a click-driven choice to one,
   * so this reason only ever fires from a drop.
   */
  reason: "too-large" | "wrong-type" | "too-many"
}

/**
 * Every user-visible string of {@link FileInput} that is not `label`, `hint` or `error` — those
 * three already take `ComponentChildren`/`string` directly, the same as every other field in this
 * package. The four here are functions rather than plain strings because each one has to name a
 * file (or, for `tooLarge`, a size) inside a sentence whose shape is a translator's business, not
 * this component's — the same reason `ExportButton`'s `resultLabel` and `Pagination`'s `pageLabel`
 * are functions instead of strings with a placeholder to find-and-replace.
 */
export interface FileInputLabels {
  /** Visible text inside the drop zone. Defaults to `"Choose files"`. */
  browse?: string
  /** Visible text next to `browse`. Defaults to `"or drag and drop"`. */
  dropHint?: string
  /** Accessible name of one chosen file's remove button, given its name. */
  removeFile?: (name: string) => string
  /** Refusal text for a file over `maxSize`, given its name and the limit in bytes. */
  tooLarge?: (name: string, maxSize: number) => string
  /** Refusal text for a file `accept` does not match, given its name. */
  wrongType?: (name: string) => string
  /** Refusal text for an extra file beyond one, when `multiple` is not set, given its name. */
  tooMany?: (name: string) => string
}

export interface FileInputProps {
  /**
   * `id` of the native `<input type="file">`. Required and **not generated** — `Field`'s and
   * `ToggleField`'s own convention — so a caller can point a test or a `<label for>` at it.
   */
  id: string
  /** `name` of the native input, so a plain form post carries the chosen files under this key. */
  name?: string
  /**
   * What the browser's own file chooser offers, and what a drop or a programmatic selection is
   * checked against — extensions (`.png`), MIME types (`image/png`) and MIME wildcards
   * (`image/*`), comma-separated, matched the way `<input accept>` itself is documented to match.
   * Omitted or empty accepts everything.
   */
  accept?: string
  /**
   * Allows more than one file. Without it, a drop that carries more than one file keeps the first
   * accepted one and refuses the rest with reason `"too-many"` — the native picker already limits
   * a click-driven choice to one, so only a drop can offer more than the single slot allows.
   */
  multiple?: boolean
  /** Largest accepted file size, in bytes. Omitted accepts any size. */
  maxSize?: number
  /** Visible label text, above the drop zone. */
  label?: ComponentChildren
  /** Helper text under the file list. */
  hint?: ComponentChildren
  /** Message to show under the control. Empty, `null` or `undefined` renders nothing and wires nothing —
   * the same rule `Field` and `ToggleField` use. */
  error?: string | null
  /** Adds `required` on the input and a `*` after the label. */
  required?: boolean
  /** Dims the label and disables the input, the drop zone and every remove button. */
  disabled?: boolean
  /**
   * Renders a small `URL.createObjectURL` preview next to an image file. Defaults to `true`. Every
   * preview is revoked the moment its file leaves the list, and every remaining one is revoked on
   * unmount — see {@link FileInput}'s own doc.
   */
  previews?: boolean
  /** Called with the full accepted file list after a selection, a drop, or a removal. */
  onFiles?: (files: File[]) => void
  /** Called with what a selection or a drop refused, and why. Not called when nothing was refused. */
  onReject?: (reasons: FileRejection[]) => void
  /** Every other user-visible string. English defaults, one override each. */
  labels?: FileInputLabels
  /** Extra utilities on the wrapper. */
  class?: string
  /**
   * Extra ids to describe the input by, alongside the ones this component wires itself. This is
   * exactly the slot `Field`'s element-child clone fills when `FileInput` is nested inside one:
   * `<Field id={id} label="Attachments" hint="…" error={error}><FileInput id={id} /></Field>`
   * clones `id` and `aria-describedby` onto `FileInput`, and this component folds the incoming
   * value in alongside its own rejection-region id rather than replacing it — see this component's
   * own doc for the nested form.
   */
  "aria-describedby"?: string
  /**
   * Set by `Field`'s element-child clone when it carries an error — the same prop a plain `<input>`
   * gets from `Field`, added here so `FileInput` reads it too rather than only computing its own
   * from a local `error` prop that, nested inside `Field`, is never passed. Either source marking
   * it invalid is enough: this component's own `error` prop still works standalone. `Field` clones
   * this on as the JS boolean `true` (not the string `"true"`), so the type accepts either — a
   * caller writing JSX by hand tends to write the string.
   */
  "aria-invalid"?: boolean | string
}

const dropZoneBase = cn(
  "flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed",
  "border-gray-300 px-6 py-8 text-center transition-colors dark:border-gray-600",
)
const dropZoneInteractive = "cursor-pointer hover:border-gray-400 dark:hover:border-gray-500"
const dropZoneDragging = "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
const dropZoneDisabled = "cursor-not-allowed opacity-50"
const errorText = "mt-2 text-sm text-red-700 dark:text-red-300"
const hintText = "mt-2 text-sm text-gray-500 dark:text-gray-400"

/**
 * File picker built on a real `<input type="file">`, with a drop zone and a keyboard/screen-reader
 * story the input already has for free.
 *
 * **The input is visually hidden with `sr-only`, never `display: none`.** `sr-only` clips it to a
 * 1px box rather than removing it from layout or the accessibility tree, which is what keeps it
 * reachable by Tab and activatable with a real Space or Enter press — a `display: none` input drops
 * out of the tab order entirely. The visible drop zone is a plain `<div>` around it, not a second
 * `<label>`: `for={id}` on the one label this component renders (from `label`) is the only explicit
 * association, so there is exactly one accessible name to reason about, the same guarantee `Field`
 * asserts for every other control in this package. Clicking the drop zone forwards to the input
 * through a ref (`inputRef.current.click()`) rather than relying on a second `<label>`'s implicit
 * association; the guard against the click having landed on the input itself stops that forward from
 * re-opening a chooser the browser already opened on its own.
 *
 * **A drop sets the real input's `files`.** `Input.dispatchDragEvent`-style drops (and a real mouse
 * drag) call `handleDrop`, which reads `event.dataTransfer.files` and writes the accepted result back
 * onto the input through a fresh `DataTransfer` — the one documented way to set a file input's
 * `FileList` from script. A rejected file is left out of that `DataTransfer`, so a plain `<form>`
 * post never carries it even though nothing here touches the network.
 *
 * **`accept` is checked the way the browser checks it**: an extension (`.png`) compared against the
 * file's name, a bare MIME type (`image/png`) compared against `file.type`, and a MIME wildcard
 * (`image/*`) compared against `file.type`'s first half — see `matchesAccept`, exported for its own
 * tests. `maxSize` is a plain byte comparison. Either refusal is pushed onto `onReject` and rendered
 * into a `role="status"` paragraph that exists — empty — on every render, so a screen reader already
 * has something to listen to before the first refusal ever happens; the same live-region-exists-
 * first shape `ExportButton`'s announcement uses, and for the same reason: setting a live region's
 * text for the first time, on the same render it appears, is not guaranteed to be read.
 *
 * **Without `multiple`, an extra file is a refusal, not a silent drop.** A click-driven choice
 * cannot offer more than one file when `multiple` is absent — the browser's own picker enforces
 * that — but a drop can still carry several. The first accepted file keeps its slot; every other
 * accepted file is refused with reason `"too-many"`, through the same `onReject` and the same live
 * region every other refusal uses, rather than disappearing with nothing for a caller or a screen
 * reader to notice.
 *
 * **Previews.** Every image file in the list gets a `URL.createObjectURL` thumbnail, tracked in a
 * `Map` kept in a ref (mutating it does not itself re-render, so an effect that changes it also
 * bumps a counter state to force the repaint the new URL needs). The same effect revokes a preview
 * the instant its file is no longer in the list, and an unmount effect revokes every preview still
 * outstanding — both are what `URL.revokeObjectURL` is for, and both are counted by mutation in
 * this component's `pages/checks/ui.ts` proof, since neither can be seen in a render-to-string test.
 *
 * **Works inside `Field`.** The native `<input type="file">` is a labelable element, so `Field`'s
 * ordinary element-child clone works unmodified:
 *
 * ```tsx
 * <Field id={id} label="Attachments" hint="Up to 2 MB each" error={error}>
 *   <FileInput id={id} accept="image/*" onFiles={(files) => …} />
 * </Field>
 * ```
 *
 * Omit `label`, `hint` and `error` on `FileInput` itself when nesting it this way — `Field` already
 * renders the one visible label the association needs, and this component would otherwise render a
 * second one describing the same control. `Field`'s clone hands `FileInput` its own `id` (already
 * the same value) and an `aria-describedby` built from `Field`'s own hint and error ids; this
 * component reads that through its `"aria-describedby"` prop and folds it in alongside its own
 * rejection-region id, rather than letting either replace the other, so the region a screen reader
 * hears a refusal in is never left off the input's description just because `Field` is the one
 * naming it. `Field`'s clone also adds `aria-invalid="true"` while its own `error` is set; this
 * component reads that through its `"aria-invalid"` prop too, since nested inside `Field` its own
 * local `error` prop is never passed and so would never mark the input invalid on its own. A caller
 * using `FileInput` standalone never passes either prop, and nothing here changes for it.
 *
 * `document`, `File`, `DataTransfer` and `URL` are only touched inside effects and event handlers,
 * so the component still server-renders with an empty file list and an empty live region.
 */
export function FileInput(
  {
    id,
    name,
    accept,
    multiple,
    maxSize,
    label,
    hint,
    error,
    required,
    disabled,
    previews = true,
    onFiles,
    onReject,
    labels = {},
    class: className,
    "aria-describedby": callerDescribedBy,
    "aria-invalid": callerInvalid,
  }: FileInputProps,
): JSX.Element {
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [rejectionMessage, setRejectionMessage] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrls = useRef<Map<File, string>>(new Map())
  const [, forceRender] = useState(0)

  // Creates a preview for every image newly in `files`, revokes one for every file that left it.
  // `previews={false}` leaves the map empty, so nothing here creates a URL to revoke either.
  useEffect(() => {
    const map = previewUrls.current
    let changed = false
    if (previews) {
      for (const file of files) {
        if (!map.has(file) && file.type.startsWith("image/")) {
          map.set(file, URL.createObjectURL(file))
          changed = true
        }
      }
    }
    for (const [file, url] of [...map]) {
      if (!files.includes(file)) {
        URL.revokeObjectURL(url)
        map.delete(file)
        changed = true
      }
    }
    if (changed) forceRender((n) => n + 1)
  }, [files, previews])

  // Revokes whatever is still outstanding when the component leaves the page — the instance the
  // effect above closed over at mount would otherwise miss anything created after that.
  useEffect(() => {
    return () => {
      for (const url of previewUrls.current.values()) URL.revokeObjectURL(url)
      previewUrls.current.clear()
    }
  }, [])

  const message = typeof error === "string" && error.length > 0 ? error : undefined
  const errorId = message === undefined ? undefined : `${id}-error`
  const hintId = hint === undefined || hint === null || hint === false ? undefined : `${id}-hint`
  const rejectionId = `${id}-rejection`
  const describedBy = [errorId, hintId, rejectionId, callerDescribedBy].filter(Boolean).join(" ") ||
    undefined
  const invalid = message !== undefined || callerInvalid === true || callerInvalid === "true"
    ? "true"
    : undefined

  const resolvedBrowse = labels.browse ?? "Choose files"
  const resolvedDropHint = labels.dropHint ?? "or drag and drop"
  const removeFileLabel = labels.removeFile ?? defaultRemoveFileLabel
  const tooLargeLabel = labels.tooLarge ?? defaultTooLarge
  const wrongTypeLabel = labels.wrongType ?? defaultWrongType
  const tooManyLabel = labels.tooMany ?? defaultTooMany

  const announceRejection = (text: string) => {
    // Cleared, then set on the next tick — the same two-step `ExportButton` uses, so a second
    // refusal with the exact same text is a real DOM mutation and not a silent no-op a screen
    // reader never hears.
    setRejectionMessage("")
    setTimeout(() => setRejectionMessage(text), 0)
  }

  const syncInputFiles = (list: File[]) => {
    const input = inputRef.current
    if (input === null) return
    const transfer = new DataTransfer()
    for (const file of list) transfer.items.add(file)
    input.files = transfer.files
  }

  const handleFiles = (selected: File[]) => {
    const accepted: File[] = []
    const rejected: FileRejection[] = []
    for (const file of selected) {
      if (maxSize !== undefined && file.size > maxSize) {
        rejected.push({ file, reason: "too-large" })
        continue
      }
      if (!matchesAccept(file, accept)) {
        rejected.push({ file, reason: "wrong-type" })
        continue
      }
      accepted.push(file)
    }

    // Without `multiple`, only the first accepted file has a slot: the rest are refused with
    // `"too-many"` rather than silently dropped, since a silent drop gives no reason a caller's
    // `onReject` — or the live region — could ever surface.
    let keep = accepted
    if (!multiple && accepted.length > 1) {
      keep = accepted.slice(0, 1)
      for (const file of accepted.slice(1)) rejected.push({ file, reason: "too-many" })
    }

    const next = multiple ? dedupeFiles([...files, ...keep]) : keep
    setFiles(next)
    syncInputFiles(next)
    onFiles?.(next)

    if (rejected.length > 0) {
      const text = rejected.map((rejection) =>
        rejection.reason === "too-large"
          ? tooLargeLabel(rejection.file.name, maxSize ?? 0)
          : rejection.reason === "wrong-type"
          ? wrongTypeLabel(rejection.file.name)
          : tooManyLabel(rejection.file.name)
      ).join(" ")
      announceRejection(text)
      onReject?.(rejected)
    } else {
      setRejectionMessage("")
    }
  }

  const removeFile = (file: File) => {
    const next = files.filter((candidate) => candidate !== file)
    setFiles(next)
    syncInputFiles(next)
    onFiles?.(next)
  }

  const handleChange = (event: JSX.TargetedEvent<HTMLInputElement>) => {
    const selected = event.currentTarget.files ? Array.from(event.currentTarget.files) : []
    handleFiles(selected)
  }

  const handleDrop = (event: JSX.TargetedDragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    const dropped = event.dataTransfer ? Array.from(event.dataTransfer.files) : []
    if (dropped.length > 0) handleFiles(dropped)
  }

  const handleZoneClick = (event: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    if (disabled || event.target === inputRef.current) return
    inputRef.current?.click()
  }

  return (
    <div class={className}>
      {label !== undefined && label !== null && (
        <label for={id} class={cn("label", disabled && "opacity-50")}>
          {label}
          {required && (
            <span aria-hidden="true" class="ml-1 text-red-700 dark:text-red-300">*</span>
          )}
        </label>
      )}
      <div
        data-e2e="file-input-zone"
        class={cn(
          dropZoneBase,
          disabled ? dropZoneDisabled : dropZoneInteractive,
          dragging && !disabled && dropZoneDragging,
          "mt-2",
        )}
        onClick={handleZoneClick}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault()
          const next = event.relatedTarget as Node | null
          if (next !== null && event.currentTarget.contains(next)) return
          setDragging(false)
        }}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          id={id}
          name={name}
          accept={accept}
          multiple={multiple}
          required={required}
          disabled={disabled}
          class="sr-only"
          aria-describedby={describedBy}
          aria-invalid={invalid}
          onChange={handleChange}
        />
        <UploadIcon />
        <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{resolvedBrowse}</span>
        <span class="text-xs text-gray-500 dark:text-gray-400">{resolvedDropHint}</span>
      </div>
      {files.length > 0 && (
        <ul class="mt-3 space-y-2">
          {files.map((file) => (
            <li
              key={fileKey(file)}
              class="flex items-center gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
            >
              {previews && previewUrls.current.has(file) && (
                <img
                  src={previewUrls.current.get(file)}
                  alt=""
                  class="size-10 shrink-0 rounded object-cover"
                />
              )}
              <span class="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-200">
                {file.name}
              </span>
              <span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                {formatBytes(file.size)}
              </span>
              <button
                type="button"
                class="shrink-0 rounded p-1 text-gray-400 hover:text-gray-600 disabled:pointer-events-none disabled:opacity-50 dark:hover:text-gray-200"
                aria-label={removeFileLabel(file.name)}
                disabled={disabled}
                onClick={() => removeFile(file)}
              >
                <RemoveIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p id={rejectionId} role="status" aria-live="polite" class={errorText}>
        {rejectionMessage}
      </p>
      {message !== undefined && <p id={errorId} class={errorText} aria-live="polite">{message}</p>}
      {hintId !== undefined && <p id={hintId} class={hintText}>{hint}</p>}
    </div>
  )
}

/** Default {@link FileInputLabels.removeFile}. */
function defaultRemoveFileLabel(name: string): string {
  return `Remove ${name}`
}

/** Default {@link FileInputLabels.tooLarge}. */
function defaultTooLarge(name: string, maxSize: number): string {
  return `${name} is larger than ${formatBytes(maxSize)}`
}

/** Default {@link FileInputLabels.wrongType}. */
function defaultWrongType(name: string): string {
  return `${name} is not an accepted file type`
}

/** Default {@link FileInputLabels.tooMany}. */
function defaultTooMany(name: string): string {
  return `${name} was not chosen — only one file is allowed`
}

/**
 * `file.name` plus `file.size` and `file.lastModified` — the closest thing a browser `File` has to
 * an identity, used as this component's list key and as {@link dedupeFiles}'s dedupe key. Two
 * distinct files can share a name; they cannot share all three.
 */
function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

/** Drops a later file whose {@link fileKey} repeats an earlier one, keeping the first occurrence. */
function dedupeFiles(files: File[]): File[] {
  const seen = new Set<string>()
  const result: File[] = []
  for (const file of files) {
    const key = fileKey(file)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(file)
  }
  return result
}

/**
 * Whether `file` matches an `<input accept>`-style pattern list: comma-separated extensions
 * (`.png`), MIME types (`image/png`) and MIME wildcards (`image/*`) — exactly the three shapes the
 * browser's own file chooser filters by. Case-insensitive, since neither a file extension nor a MIME
 * type is. An empty or missing `accept` matches everything, the same as the attribute's own absence.
 *
 * @param file The file to check.
 * @param accept The `accept` pattern list, or `undefined` for "anything".
 */
export function matchesAccept(file: File, accept: string | undefined): boolean {
  const patterns = (accept ?? "").split(",").map((pattern) => pattern.trim().toLowerCase())
    .filter((pattern) => pattern.length > 0)
  if (patterns.length === 0) return true

  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()

  return patterns.some((pattern) => {
    if (pattern.startsWith(".")) return name.endsWith(pattern)
    if (pattern.endsWith("/*")) return type.startsWith(pattern.slice(0, -1))
    return type === pattern
  })
}

/** A byte count as `"12.3 MB"` — whole units with no decimal, everything else to one. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  const rounded = Math.round(value * 10) / 10
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} ${units[unitIndex]}`
}

function UploadIcon(): JSX.Element {
  return (
    <svg
      class="size-6 shrink-0 text-gray-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4m0 0-4 4m4-4 4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}

function RemoveIcon(): JSX.Element {
  return (
    <svg
      class="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  )
}
