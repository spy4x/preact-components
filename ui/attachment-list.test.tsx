import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  ATTACHMENT_LIST_LABELS,
  attachmentImages,
  type AttachmentItem,
  AttachmentList,
} from "./attachment-list.tsx"

const image: AttachmentItem = {
  id: "a1",
  name: "tickets.png",
  size: 820 * 1024,
  type: "image/png",
  status: "ready",
  thumbnailSrc: "thumb.png",
  src: "full.png",
  detail: "Maya Chen",
}
const pdf: AttachmentItem = {
  id: "a2",
  name: "scan.pdf",
  size: 1.5 * 1024 * 1024,
  type: "application/pdf",
  status: "ready",
}
const noop = () => {}

/** The markup of one row, found by the file's name. */
function row(html: string, name: string): string {
  const rows = html.split("<li").slice(1)
  const found = rows.find((candidate) => candidate.includes(`>${name}<`))
  if (found === undefined) throw new Error(`no row for ${name}`)
  return found
}

describe("AttachmentList", () => {
  it("renders nothing for no files, so the caller draws its own empty state", () => {
    expect(render(<AttachmentList id="files" items={[]} />)).toBe("")
  })

  it("is a list named Attachments, one item per file, and takes a list name override", () => {
    const html = render(<AttachmentList id="files" items={[image, pdf]} />)
    const renamed = render(
      <AttachmentList id="files" items={[image]} labels={{ list: "Pièces jointes" }} />,
    )

    expect(html).toContain('<ul aria-label="Attachments"')
    expect(html.match(/<li\b/g)?.length).toBe(2)
    expect(renamed).toContain('aria-label="Pièces jointes"')
  })

  it("shows the kind, size and detail of a ready file on its meta line", () => {
    const html = render(<AttachmentList id="files" items={[image, pdf]} />)

    expect(row(html, "tickets.png")).toContain("Image · 820 KB · Maya Chen")
    expect(row(html, "scan.pdf")).toContain("PDF · 1.5 MB")
  })

  it("puts the whole file name in a title, so a name cut to two lines can be read in full", () => {
    const html = render(<AttachmentList id="files" items={[pdf]} />)

    expect(html).toMatch(/<span[^>]*title="scan.pdf"[^>]*>scan.pdf<\/span>/)
  })

  it("lets a row hold focus without being a tab stop, so focus can stay when its control goes", () => {
    const html = render(<AttachmentList id="files" items={[pdf]} />)

    expect(html).toMatch(/<li[^>]*tabindex="-1"/)
  })

  it("draws the thumbnail with an empty alt, and an icon tile for a file without one", () => {
    const html = render(<AttachmentList id="files" items={[image, pdf]} />)

    expect(row(html, "tickets.png")).toMatch(/<img[^>]*src="thumb.png"/)
    expect(row(html, "tickets.png")).toMatch(/<img[^>]*\salt(=""|\s|\/)/)
    expect(row(html, "scan.pdf")).not.toContain("<img")
    expect(row(html, "scan.pdf")).toContain("<svg")
  })

  it("makes a ready image a button that opens it, described by its meta line", () => {
    const html = render(<AttachmentList id="files" items={[image]} />)

    expect(row(html, "tickets.png")).toMatch(
      /<button type="button"[^>]*aria-label="Open tickets.png"[^>]*aria-describedby="files-a1-meta"/,
    )
    expect(row(html, "tickets.png")).toContain('id="files-a1-meta"')
  })

  it("makes a ready file's name download it only when onDownload is given", () => {
    const withDownload = render(<AttachmentList id="files" items={[pdf]} onDownload={noop} />)
    const without = render(<AttachmentList id="files" items={[pdf]} />)

    expect(withDownload).toContain('aria-label="Download scan.pdf"')
    expect(without).not.toContain("<button")
  })

  it("gives a ready row a menu named after the file, and none on a read-only list", () => {
    const editable = render(
      <AttachmentList id="files" items={[pdf]} onDownload={noop} onRemove={noop} />,
    )
    const readOnly = render(<AttachmentList id="files" items={[image]} />)

    expect(editable).toContain('aria-label="Actions for scan.pdf"')
    expect(readOnly).not.toContain("Actions for")
  })

  it("shows an upload's progress as a named bar and a percentage, with a cancel button", () => {
    const html = render(
      <AttachmentList
        id="files"
        items={[{ ...pdf, status: "uploading", progress: 45.4 }]}
        onCancel={noop}
      />,
    )

    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-label="Uploading scan.pdf"')
    expect(html).toContain('aria-valuenow="45.4"')
    expect(html).toContain("Uploading, 45%")
    expect(html).toContain('aria-label="Cancel upload of scan.pdf"')
    expect(html).not.toContain("PDF · 1.5 MB")
  })

  it("shows a waiting file with its remove button and no bar", () => {
    const html = render(
      <AttachmentList id="files" items={[{ ...pdf, status: "waiting" }]} onRemove={noop} />,
    )

    expect(html).toContain("Waiting to upload")
    expect(html).toContain('aria-label="Remove scan.pdf"')
    expect(html).not.toContain('role="progressbar"')
  })

  it("shows a check in progress with an indeterminate bar and no action", () => {
    const html = render(
      <AttachmentList
        id="files"
        items={[{ ...pdf, status: "checking" }]}
        onRemove={noop}
        onCancel={noop}
      />,
    )

    expect(html).toContain("Checking…")
    expect(html).toContain('role="progressbar"')
    expect(html).not.toContain("aria-valuenow")
    expect(html).not.toContain("<button")
  })

  it("names the checking bar Checking, not Uploading, and takes an override", () => {
    const item: AttachmentItem = { ...pdf, status: "checking" }
    const html = render(<AttachmentList id="files" items={[item]} />)
    const renamed = render(
      <AttachmentList
        id="files"
        items={[item]}
        labels={{ checkingProgress: (name) => `Vérification de ${name}` }}
      />,
    )

    expect(html).toContain('aria-label="Checking scan.pdf"')
    expect(html).not.toContain("Uploading scan.pdf")
    expect(renamed).toContain('aria-label="Vérification de scan.pdf"')
  })

  it("describes a ready row's button by its error too, so the error is heard with it", () => {
    const html = render(
      <AttachmentList
        id="files"
        items={[{ ...pdf, error: "This link expired. Try again." }]}
        onDownload={noop}
      />,
    )

    expect(html).toContain('aria-describedby="files-a2-meta files-a2-meta-error"')
    expect(html).toMatch(/id="files-a2-meta-error"[^>]*>This link expired. Try again.</)
  })

  it("shows a failed upload in the danger tone with Retry and remove", () => {
    const html = render(
      <AttachmentList
        id="files"
        items={[{ ...pdf, status: "failed" }]}
        onRetry={noop}
        onRemove={noop}
      />,
    )

    expect(html).toContain('class="text-xs text-danger">Upload failed.</span>')
    expect(html).toMatch(/<button[^>]*aria-label="Retry scan.pdf"[^>]*>Retry<\/button>/)
    expect(html).toContain('aria-label="Remove scan.pdf"')
  })

  it("shows an item's own error instead of the default, in any state", () => {
    const html = render(
      <AttachmentList
        id="files"
        items={[{ ...pdf, error: "This link expired. Try again." }]}
      />,
    )

    expect(html).toContain("This link expired. Try again.")
    expect(html).toContain("PDF · 1.5 MB")
  })

  it("takes an override for every word it shows", () => {
    const html = render(
      <AttachmentList
        id="files"
        items={[
          { ...pdf, id: "u", status: "uploading", progress: 10 },
          { ...pdf, id: "w", name: "w.pdf", status: "waiting" },
          { ...pdf, id: "c", name: "c.pdf", status: "checking" },
          { ...pdf, id: "f", name: "f.pdf", status: "failed" },
          { ...pdf, id: "r", name: "r.pdf" },
        ]}
        onCancel={noop}
        onRemove={noop}
        onRetry={noop}
        onDownload={noop}
        labels={{
          kind: () => "Doc",
          uploading: (percent) => `Envoi ${percent}`,
          waiting: "En attente",
          checking: "Vérification",
          failed: "Échec",
          retry: "Réessayer",
          retryFile: (name) => `Réessayer ${name}`,
          progress: (name) => `Envoi de ${name}`,
          downloadFile: (name) => `Télécharger ${name}`,
          cancel: (name) => `Annuler ${name}`,
          remove: (name) => `Retirer ${name}`,
          actions: (name) => `Actions ${name}`,
        }}
      />,
    )

    for (
      const text of [
        "Envoi 10",
        "En attente",
        "Vérification",
        ">Échec<",
        ">Réessayer<",
        'aria-label="Réessayer f.pdf"',
        "Envoi de scan.pdf",
        "Télécharger r.pdf",
        "Annuler scan.pdf",
        "Retirer w.pdf",
        "Actions r.pdf",
        "Doc · 1.5 MB",
      ]
    ) expect(html).toContain(text)
  })
})

describe("ATTACHMENT_LIST_LABELS", () => {
  it("names the kind by MIME type", () => {
    expect(ATTACHMENT_LIST_LABELS.kind(image)).toBe("Image")
    expect(ATTACHMENT_LIST_LABELS.kind(pdf)).toBe("PDF")
    expect(ATTACHMENT_LIST_LABELS.kind({ ...pdf, type: "text/plain" })).toBe("File")
    expect(ATTACHMENT_LIST_LABELS.kind({ ...pdf, type: undefined })).toBe("File")
  })

  it("rounds and clamps the upload percentage, and drops it when unknown", () => {
    expect(ATTACHMENT_LIST_LABELS.uploading(44.6)).toBe("Uploading, 45%")
    expect(ATTACHMENT_LIST_LABELS.uploading(140)).toBe("Uploading, 100%")
    expect(ATTACHMENT_LIST_LABELS.uploading(undefined)).toBe("Uploading")
  })
})

describe("attachmentImages", () => {
  it("keeps only ready images with a full src, named by their file name, in order", () => {
    const second = { ...image, id: "a3", name: "map.jpg", src: "map.jpg" }
    const images = attachmentImages([
      image,
      pdf,
      { ...image, id: "up", status: "uploading" },
      { ...image, id: "nosrc", src: undefined },
      second,
    ])

    expect(images).toEqual([
      { id: "a1", src: "full.png", alt: "tickets.png" },
      { id: "a3", src: "map.jpg", alt: "map.jpg" },
    ])
  })
})
