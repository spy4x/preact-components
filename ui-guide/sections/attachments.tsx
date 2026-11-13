/**
 * The `AttachmentList` card: the files of one record in every state a row can be in, with the
 * `FileInput` button that adds to them, as a note editor draws its attachments.
 */

import {
  type AttachmentItem,
  AttachmentList,
  FileInput,
  type FileRejection,
  Stack,
} from "@spy4x/preact-ui"
import { batch, useSignal } from "@preact/signals"
import { useEffect, useRef } from "preact/hooks"
import type { DemoFragment } from "../registry.ts"

/** A flat picture of `width` by `height` in one colour, so the card needs no image files. */
function picture(fill: string, width: number, height: number): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'%3E%3Crect width='${width}' height='${height}' fill='%23${fill}'/%3E%3C/svg%3E`
}

const KB = 1024
const MB = 1024 * KB

/** One file in each state, and two ready images so the lightbox has a next one. */
const START: readonly AttachmentItem[] = [
  {
    id: "tickets",
    name: "tickets.png",
    size: 820 * KB,
    type: "image/png",
    status: "ready",
    thumbnailSrc: picture("0d9488", 80, 80),
    src: picture("0d9488", 640, 400),
    detail: "Maya Chen",
  },
  {
    id: "booking",
    name: "booking-confirmation-hotel-ribeira-porto-three-nights.pdf",
    size: 1.4 * MB,
    type: "application/pdf",
    status: "ready",
  },
  {
    id: "map",
    name: "map.jpg",
    size: 1.1 * MB,
    type: "image/jpeg",
    status: "uploading",
    progress: 70,
  },
  { id: "receipt", name: "receipt.pdf", size: 96 * KB, type: "application/pdf", status: "waiting" },
  {
    id: "invoice",
    name: "invoice.pdf",
    size: 210 * KB,
    type: "application/pdf",
    status: "checking",
  },
  { id: "scan", name: "scan.pdf", size: 640 * KB, type: "application/pdf", status: "failed" },
  {
    id: "beach",
    name: "beach.jpg",
    size: 1.8 * MB,
    type: "image/jpeg",
    status: "ready",
    thumbnailSrc: picture("ea580c", 80, 80),
    src: picture("ea580c", 640, 400),
  },
]

/** Words for what the card's own handlers did, so a check can read them. */
function said(reasons: readonly FileRejection[]): string {
  return reasons.map((r) => `${r.file.name} (${r.reason})`).join(", ")
}

/**
 * The list with every callback wired to local state, as an app wires them to its store. A removal
 * runs for 300 ms with `removingId` set, so focus moves to the next row's action when the row goes;
 * Retry checks for 600 ms and then the file is ready. "Attach files" adds each choice as waiting.
 */
function AttachmentListDemo() {
  const items = useSignal<readonly AttachmentItem[]>(START)
  const removing = useSignal<string | null>(null)
  const last = useSignal("none")
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (ms: number, run: () => void) => timers.current.push(setTimeout(run, ms))
  const patch = (id: string, change: Partial<AttachmentItem>) =>
    items.value = items.value.map((item) => item.id === id ? { ...item, ...change } : item)

  const remove = (item: AttachmentItem) => {
    removing.value = item.id
    later(300, () =>
      batch(() => {
        items.value = items.value.filter((candidate) => candidate.id !== item.id)
        removing.value = null
        last.value = `removed ${item.name}`
      }))
  }

  return (
    <Stack gap="sm">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-medium text-foreground">
          Attachments <span class="font-normal text-muted">{items.value.length} of 10</span>
        </p>
        <FileInput
          id="guide-attachments-attach"
          appearance="button"
          label="Attach files"
          accept="image/png,image/jpeg,application/pdf"
          maxSize={2 * MB}
          multiple
          onFiles={(files) => {
            items.value = [
              ...items.value,
              ...files.map((file, n): AttachmentItem => ({
                id: `added-${Date.now()}-${n}`,
                name: file.name,
                size: file.size,
                type: file.type,
                status: "waiting",
              })),
            ]
            last.value = `attached ${files.map((file) => file.name).join(", ")}`
          }}
          onReject={(reasons) => last.value = `refused ${said(reasons)}`}
        />
      </div>
      <AttachmentList
        id="guide-attachments"
        items={items.value}
        removingId={removing.value}
        focusAfterLast={() => document.getElementById("guide-attachments-attach")}
        onDownload={(item) => last.value = `downloaded ${item.name}`}
        onRemove={remove}
        onCancel={remove}
        onRetry={(item) => {
          patch(item.id, { status: "checking" })
          later(600, () => {
            patch(item.id, { status: "ready" })
            last.value = `retried ${item.name}`
          })
        }}
      />
      <p class="text-xs text-muted" data-e2e="attachments-last">Last action: {last.value}</p>
    </Stack>
  )
}

/** The guide's card for `AttachmentList`. */
export const attachmentDemos = {
  AttachmentList: {
    summary:
      "The files attached to a record, each uploading, waiting, checking, failed or ready, with a menu per file and images that open in a lightbox.",
    wide: true,
    props: [
      { name: "id", type: "string", description: "Prefix of the rows' element ids." },
      {
        name: "items",
        type: "AttachmentItem[]",
        description:
          "The files: `id`, `name`, `size`, `type`, `status`, `progress`, `thumbnailSrc`, `src`, `detail`, `error`.",
      },
      {
        name: "onDownload / onRemove",
        type: "(item) => void",
        description:
          "A ready file's menu items; left out, the item goes and the list is read-only.",
      },
      {
        name: "onCancel / onRetry",
        type: "(item) => void",
        description: "Cancel while uploading, Retry once failed; left out, no button.",
      },
      {
        name: "removingId / focusAfterLast",
        type: "string | null / () => HTMLElement",
        description:
          "The removal running, so focus moves to the next row; where it goes after the last.",
      },
      {
        name: "labels",
        type: "Partial<AttachmentListLabels>",
        description: "Every word it shows, English by default.",
      },
    ],
    snippet: `<AttachmentList
  id="note-files"
  items={[
    { id: "1", name: "tickets.png", size: 839680, type: "image/png", status: "ready",
      thumbnailSrc: thumb, src: full },
    { id: "2", name: "map.jpg", size: 1153434, type: "image/jpeg", status: "uploading",
      progress: 70 },
  ]}
  removingId={removingId}
  onDownload={download}
  onRemove={confirmRemove}
  onCancel={cancel}
  onRetry={retry}
/>`,
    render: () => <AttachmentListDemo />,
  },
} satisfies DemoFragment
