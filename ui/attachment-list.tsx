import { IconDocument, IconImage, IconXMark } from "@spy4x/preact-icons"
import { useSignal } from "@preact/signals"
import type { JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"
import { formatBytes } from "@spy4x/platform/universal/format-number"
import { Button, buttonClasses } from "./button.tsx"
import { Card } from "./card.tsx"
import { DropdownItem } from "./dropdown.tsx"
import { describedImages, Lightbox, type LightboxImage, type LightboxProps } from "./lightbox.tsx"
import { MoreMenu } from "./page-header.tsx"
import { Progress } from "./progress.tsx"
import { TOUCH_TARGET } from "./touch-target.ts"
import { useFocusAfterRemoval, useFocusFallback } from "./use-focus-after-removal.ts"

/**
 * Where one file of an {@link AttachmentList} stands: `"uploading"` (bytes on the way),
 * `"waiting"` (queued, such as offline or before its record exists), `"checking"` (uploaded, the
 * server is still confirming it), `"failed"` and `"ready"`.
 */
export type AttachmentStatus = "uploading" | "waiting" | "checking" | "failed" | "ready"

/** One file of an {@link AttachmentList}. */
export interface AttachmentItem {
  /** Stable id of the file, the row's key. */
  id: string
  /** The file's name, the row's title. */
  name: string
  /** Size in bytes, shown through `formatBytes`. */
  size: number
  /** MIME type. An `image/*` type makes the row an image: it opens in the lightbox. */
  type?: string
  /** Where the file stands. */
  status: AttachmentStatus
  /**
   * Upload progress from 0 to 100, read while `status` is `"uploading"`. Left out, the bar is
   * indeterminate.
   */
  progress?: number
  /** A small image for the 40 px tile. Left out, the tile shows an icon. */
  thumbnailSrc?: string
  /** The full image the lightbox shows. An image without it does not open. */
  src?: string
  /** Extra text after the kind and size on the meta line, such as who added the file. */
  detail?: string
  /**
   * A message in the danger tone under the name, in any state. A failed row without one shows
   * `labels.failed`.
   */
  error?: string
}

/** The words an {@link AttachmentList} shows. */
export interface AttachmentListLabels {
  /** Accessible name of the list. Default: `"Attachments"`. */
  list: string
  /** The kind word on the meta line. Default: `"Image"`, `"PDF"` or `"File"` by MIME type. */
  kind: (item: AttachmentItem) => string
  /**
   * The meta line while uploading. Default: `"Uploading, 45%"`, or `"Uploading"` with no progress.
   */
  uploading: (percent: number | undefined) => string
  /** The meta line while waiting. Default: `"Waiting to upload"`. */
  waiting: string
  /** The meta line while checking. Default: `"Checking…"`. */
  checking: string
  /** The danger line of a failed row without its own `error`. Default: `"Upload failed."`. */
  failed: string
  /** The retry button's text. Default: `"Retry"`. */
  retry: string
  /** Accessible name of the retry button. Default: `"Retry scan.pdf"`. */
  retryFile: (name: string) => string
  /** Accessible name of the progress bar while uploading. Default: `"Uploading scan.pdf"`. */
  progress: (name: string) => string
  /** Accessible name of the progress bar while checking. Default: `"Checking scan.pdf"`. */
  checkingProgress: (name: string) => string
  /** Accessible name of a ready image's open button. Default: `"Open tickets.png"`. */
  open: (name: string) => string
  /** Accessible name of a ready file's download button. Default: `"Download scan.pdf"`. */
  downloadFile: (name: string) => string
  /**
   * Accessible name of the cancel button while uploading. Default: `"Cancel upload of scan.pdf"`.
   */
  cancel: (name: string) => string
  /**
   * Accessible name of the remove button of a waiting or failed row. Default: `"Remove scan.pdf"`.
   */
  remove: (name: string) => string
  /** Accessible name of a ready row's menu. Default: `"Actions for scan.pdf"`. */
  actions: (name: string) => string
  /** The menu item that downloads. Default: `"Download"`. */
  download: string
  /** The menu item that removes. Default: `"Remove"`. */
  removeItem: string
}

/** The English words {@link AttachmentList} shows when the caller passes none. */
export const ATTACHMENT_LIST_LABELS: AttachmentListLabels = {
  list: "Attachments",
  kind: (item) => isImage(item) ? "Image" : item.type === "application/pdf" ? "PDF" : "File",
  uploading: (percent) =>
    percent === undefined ? "Uploading" : `Uploading, ${Math.round(clampPercent(percent))}%`,
  waiting: "Waiting to upload",
  checking: "Checking…",
  failed: "Upload failed.",
  retry: "Retry",
  retryFile: (name) => `Retry ${name}`,
  progress: (name) => `Uploading ${name}`,
  checkingProgress: (name) => `Checking ${name}`,
  open: (name) => `Open ${name}`,
  downloadFile: (name) => `Download ${name}`,
  cancel: (name) => `Cancel upload of ${name}`,
  remove: (name) => `Remove ${name}`,
  actions: (name) => `Actions for ${name}`,
  download: "Download",
  removeItem: "Remove",
}

/** Props of {@link AttachmentList}. */
export interface AttachmentListProps {
  /** Prefix of the rows' element ids. Required and not generated, as `Field`'s `id` is. */
  id: string
  /**
   * The files, in the order shown. An empty list renders nothing, so the caller draws its own empty
   * state.
   */
  items: readonly AttachmentItem[]
  /** Downloads a ready file. Left out, a ready file has no download. */
  onDownload?: (item: AttachmentItem) => void
  /**
   * Removes a file: a ready one from its menu, a waiting or failed one from its button. Left out,
   * the list is read-only.
   */
  onRemove?: (item: AttachmentItem) => void
  /** Cancels an upload. Left out, an uploading row has no button. */
  onCancel?: (item: AttachmentItem) => void
  /** Starts a failed upload again. Left out, a failed row has no Retry. */
  onRetry?: (item: AttachmentItem) => void
  /**
   * The id of the file whose removal is running, else `null`. When that row leaves `items`, focus
   * moves to the next row's action, else the one before, else `focusAfterLast()`.
   */
  removingId?: string | null
  /** Where focus goes when the last file was removed, such as the "Attach files" button. */
  focusAfterLast?: () => HTMLElement | null | undefined
  /** The words shown; see {@link ATTACHMENT_LIST_LABELS}. */
  labels?: Partial<AttachmentListLabels>
  /** The lightbox's own words. */
  lightboxLabels?: Pick<
    LightboxProps,
    "label" | "closeLabel" | "previousLabel" | "nextLabel" | "counterLabel"
  >
  /** Utilities on the card. */
  class?: string
}

/** Whether the item is an image by its MIME type. */
function isImage(item: AttachmentItem): boolean {
  return item.type?.toLowerCase().startsWith("image/") ?? false
}

/** Keeps a percentage inside 0 to 100; anything not a number is 0. */
function clampPercent(percent: number): number {
  return Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0
}

/** The row's control that takes focus after a removal: its action, else its first control. */
function rowAction(row: Element): HTMLElement | null {
  return row.querySelector<HTMLElement>(
    "[data-attachment-action], [data-attachment-action-wrap] button",
  ) ??
    row.querySelector<HTMLElement>("button:not([disabled]), a[href]")
}

/**
 * The images of `items` the lightbox can show, in order: ready images with a `src`, named by
 * their file name. Exported so a caller's index and the list's own agree.
 *
 * @param items The list's files.
 */
export function attachmentImages(
  items: readonly AttachmentItem[],
): (LightboxImage & { id: string })[] {
  return describedImages(
    items.filter((item) => item.status === "ready" && isImage(item) && item.src)
      .map((item) => ({ id: item.id, src: item.src as string, alt: item.name })),
  )
}

/**
 * The files attached to a record: one row each with a thumbnail or a file icon, the name, its kind
 * and size, and what it is doing — uploading with a bar, waiting, checking, failed with Retry, or
 * ready with a menu (Download, Remove). A ready image opens in {@link Lightbox}, which pages
 * through every ready image of the list; a ready file's name downloads it.
 *
 * Pure: it uploads, downloads and removes nothing itself. Every action is a callback, and a
 * callback left out removes its control, so a read-only page passes none but `onDownload`. Ask
 * before a removal in the caller (`ConfirmDialog`) and pass `removingId` while it runs, so focus
 * lands on the next row instead of the page's body.
 *
 * The list is a `<ul>` named by `labels.list`. Each row has at most two tab stops: the open or
 * download button (thumbnail, name and meta line in one target, described by the meta line) and
 * the row's action. Every icon-only button is named after the file. The only state it keeps is
 * whether the lightbox is open and on which image.
 *
 * @param props See {@link AttachmentListProps}.
 */
export function AttachmentList({
  id,
  items,
  onDownload,
  onRemove,
  onCancel,
  onRetry,
  removingId,
  focusAfterLast,
  labels,
  lightboxLabels,
  class: className,
}: AttachmentListProps): JSX.Element | null {
  const words = { ...ATTACHMENT_LIST_LABELS, ...labels }
  const list = useRef<HTMLUListElement>(null)
  const viewing = useSignal<number | null>(null)
  useFocusAfterRemoval(list, items.map((item) => item.id), removingId, {
    target: rowAction,
    fallback: focusAfterLast,
  })

  if (items.length === 0) return null
  const images = attachmentImages(items)

  return (
    <Card class={className}>
      <ul ref={list} aria-label={words.list} class="divide-y divide-subtle">
        {items.map((item) => {
          const metaId = `${id}-${item.id}-meta`
          const imageIndex = images.findIndex((image) => image.id === item.id)
          const opens = imageIndex >= 0
          const downloads = !opens && item.status === "ready" && onDownload !== undefined &&
            !isImage(item)
          return (
            <Row
              key={item.id}
              item={item}
              words={words}
              metaId={metaId}
              label={opens
                ? words.open(item.name)
                : downloads
                ? words.downloadFile(item.name)
                : undefined}
              onPress={() => opens ? viewing.value = imageIndex : onDownload?.(item)}
              onDownload={onDownload}
              onRemove={onRemove}
              onCancel={onCancel}
              onRetry={onRetry}
            />
          )
        })}
      </ul>
      {images.length > 0 && (
        <Lightbox
          {...lightboxLabels}
          images={images}
          index={viewing.value ?? 0}
          open={viewing.value !== null}
          onClose={() => viewing.value = null}
          onIndexChange={(index) => viewing.value = index}
        />
      )}
    </Card>
  )
}

/** The controls a row's focus can land on, in the order Tab reaches them. */
const ROW_CONTROLS = "button:not([disabled]), a[href]"

/**
 * One row. When the control that holds focus goes because the row changed state (Retry gives
 * way to "Checking…", Cancel to a finished upload), focus stays in the row: on its first control,
 * else on the row itself, and from there on to its first control once it has one again. A row
 * that leaves the list is `useFocusAfterRemoval`'s, in the list.
 */
function Row(
  { item, words, metaId, label, onPress, ...actions }:
    & { item: AttachmentItem; words: AttachmentListLabels; metaId: string }
    & { label: string | undefined; onPress: () => void }
    & Pick<AttachmentListProps, "onDownload" | "onRemove" | "onCancel" | "onRetry">,
): JSX.Element {
  const row = useRef<HTMLLIElement>(null)
  const firstControl = () => row.current?.querySelector<HTMLElement>(ROW_CONTROLS) ?? row.current
  useFocusFallback(row, firstControl)
  useEffect(() => {
    const element = row.current
    if (element === null || element.ownerDocument.activeElement !== element) return
    element.querySelector<HTMLElement>(ROW_CONTROLS)?.focus()
  }, [item.status])
  const body = <RowBody item={item} words={words} metaId={metaId} />
  return (
    <li
      ref={row}
      tabIndex={-1}
      data-e2e="attachment-row"
      data-status={item.status}
      class="flex min-h-14 items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus sm:px-6"
    >
      {label !== undefined
        ? (
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"
            aria-label={label}
            aria-describedby={item.error === undefined ? metaId : `${metaId} ${metaId}-error`}
            onClick={onPress}
          >
            {body}
          </button>
        )
        : <div class="flex min-w-0 flex-1 items-center gap-3">{body}</div>}
      <RowAction item={item} words={words} {...actions} />
    </li>
  )
}

/** The tile, the name and the meta line of one row. */
function RowBody(
  { item, words, metaId }: { item: AttachmentItem; words: AttachmentListLabels; metaId: string },
): JSX.Element {
  const Icon = isImage(item) ? IconImage : IconDocument
  const meta = item.status === "uploading"
    ? words.uploading(item.progress)
    : item.status === "waiting"
    ? words.waiting
    : item.status === "checking"
    ? words.checking
    : [words.kind(item), formatBytes(item.size), item.detail].filter(Boolean).join(" · ")
  const error = item.error ?? (item.status === "failed" ? words.failed : undefined)
  return (
    <>
      {item.thumbnailSrc
        ? (
          <img
            src={item.thumbnailSrc}
            alt=""
            class="size-10 shrink-0 rounded-md object-cover"
            loading="lazy"
          />
        )
        : (
          <span class="flex size-10 shrink-0 items-center justify-center rounded-md bg-hover text-muted">
            <Icon class="size-5" aria-hidden="true" />
          </span>
        )}
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span
          class="line-clamp-2 text-sm font-medium wrap-anywhere text-foreground"
          title={item.name}
        >
          {item.name}
        </span>
        {(item.status === "uploading" || item.status === "checking") && (
          <Progress
            value={item.status === "uploading" && item.progress !== undefined
              ? clampPercent(item.progress)
              : null}
            showValue={false}
            ariaLabel={item.status === "uploading"
              ? words.progress(item.name)
              : words.checkingProgress(item.name)}
          />
        )}
        {item.status !== "failed" && (
          <span id={metaId} class="text-xs text-muted">
            {meta}
          </span>
        )}
        {error !== undefined && (
          <span
            id={item.status === "failed" ? metaId : `${metaId}-error`}
            class="text-xs text-danger"
          >
            {error}
          </span>
        )}
      </span>
    </>
  )
}

/** The control at the right of one row, by its state. */
function RowAction(
  { item, words, onDownload, onRemove, onCancel, onRetry }:
    & { item: AttachmentItem; words: AttachmentListLabels }
    & Pick<AttachmentListProps, "onDownload" | "onRemove" | "onCancel" | "onRetry">,
): JSX.Element | null {
  const iconButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      data-attachment-action=""
      class={buttonClasses("icon", "md", TOUCH_TARGET)}
      aria-label={label}
      onClick={onClick}
    >
      <IconXMark class="size-5" aria-hidden="true" />
    </button>
  )
  if (item.status === "uploading") {
    return onCancel ? iconButton(words.cancel(item.name), () => onCancel(item)) : null
  }
  if (item.status === "waiting") {
    return onRemove ? iconButton(words.remove(item.name), () => onRemove(item)) : null
  }
  if (item.status === "failed") {
    if (!onRetry && !onRemove) return null
    return (
      <span class="flex shrink-0 items-center gap-1">
        {onRetry && (
          <Button
            variant="secondary"
            size="sm"
            class={TOUCH_TARGET}
            data-attachment-action=""
            aria-label={words.retryFile(item.name)}
            onClick={() => onRetry(item)}
          >
            {words.retry}
          </Button>
        )}
        {onRemove && iconButton(words.remove(item.name), () => onRemove(item))}
      </span>
    )
  }
  if (item.status === "ready" && (onDownload || onRemove)) {
    return (
      <span class="shrink-0" data-attachment-action-wrap="">
        <MoreMenu label={words.actions(item.name)} dataE2E="attachment-actions">
          {onDownload && (
            <DropdownItem onClick={() => onDownload(item)}>{words.download}</DropdownItem>
          )}
          {onRemove && (
            <DropdownItem danger onClick={() => onRemove(item)}>{words.removeItem}</DropdownItem>
          )}
        </MoreMenu>
      </span>
    )
  }
  return null
}
