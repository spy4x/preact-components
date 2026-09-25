import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Field } from "./field.tsx"
import {
  classifyFiles,
  FileInput,
  formatBytes,
  matchesAccept,
  resolveLabels,
} from "./file-input.tsx"

/** A minimal real `File`, the same platform primitive the browser hands the component. */
function file(name: string, size: number, type = ""): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe("matchesAccept", () => {
  it("accepts everything when accept is undefined or empty", () => {
    const f = file("photo.png", 10, "image/png")

    expect(matchesAccept(f, undefined)).toBe(true)
    expect(matchesAccept(f, "")).toBe(true)
    expect(matchesAccept(f, "   ")).toBe(true)
  })

  it("matches a file extension pattern, case-insensitively", () => {
    const f = file("PHOTO.PNG", 10, "image/png")

    expect(matchesAccept(f, ".png")).toBe(true)
    expect(matchesAccept(f, ".jpg")).toBe(false)
  })

  it("matches an exact MIME type", () => {
    const f = file("report.pdf", 10, "application/pdf")

    expect(matchesAccept(f, "application/pdf")).toBe(true)
    expect(matchesAccept(f, "application/json")).toBe(false)
  })

  it("matches a MIME wildcard against the file's type prefix", () => {
    const image = file("photo.png", 10, "image/png")
    const doc = file("report.pdf", 10, "application/pdf")

    expect(matchesAccept(image, "image/*")).toBe(true)
    expect(matchesAccept(doc, "image/*")).toBe(false)
  })

  it("matches any one pattern of a comma-separated list", () => {
    const f = file("report.pdf", 10, "application/pdf")

    expect(matchesAccept(f, ".png,image/*,application/pdf")).toBe(true)
    expect(matchesAccept(f, ".png,image/*")).toBe(false)
  })
})

describe("formatBytes", () => {
  it("renders a byte count under 1024 as whole bytes", () => {
    expect(formatBytes(512)).toBe("512 B")
  })

  it("renders a whole unit with no decimal", () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe("2 MB")
  })

  it("renders a fractional unit to one decimal place", () => {
    expect(formatBytes(1.5 * 1024)).toBe("1.5 KB")
  })
})

describe("classifyFiles", () => {
  it("accepts a file exactly at maxSize", () => {
    const f = file("photo.png", 100, "image/png")

    const { accepted, rejected } = classifyFiles([f], { maxSize: 100 })

    expect(accepted).toEqual([f])
    expect(rejected).toEqual([])
  })

  it("refuses a file one byte over maxSize", () => {
    const f = file("photo.png", 101, "image/png")

    const { accepted, rejected } = classifyFiles([f], { maxSize: 100 })

    expect(accepted).toEqual([])
    expect(rejected).toEqual([{ file: f, reason: "too-large" }])
  })

  it("refuses everything past the first file when multiple is unset", () => {
    const a = file("a.png", 10, "image/png")
    const b = file("b.png", 10, "image/png")

    const { accepted, rejected } = classifyFiles([a, b], { multiple: false })

    expect(accepted).toEqual([a])
    expect(rejected).toEqual([{ file: b, reason: "too-many" }])
  })

  it("keeps every accepted file when multiple is set", () => {
    const a = file("a.png", 10, "image/png")
    const b = file("b.png", 10, "image/png")

    const { accepted, rejected } = classifyFiles([a, b], { multiple: true })

    expect(accepted).toEqual([a, b])
    expect(rejected).toEqual([])
  })
})

describe("resolveLabels", () => {
  it("uses the labels.removeFile override instead of the default", () => {
    const { removeFile } = resolveLabels({ removeFile: (name) => `Drop ${name}` })

    expect(removeFile("a.png")).toBe("Drop a.png")
  })

  it("uses the labels.tooLarge override instead of the default", () => {
    const { tooLarge } = resolveLabels({ tooLarge: (name) => `${name} is huge` })

    expect(tooLarge("a.png", 10)).toBe("a.png is huge")
  })

  it("uses the labels.wrongType override instead of the default", () => {
    const { wrongType } = resolveLabels({ wrongType: (name) => `${name} is wrong` })

    expect(wrongType("a.png")).toBe("a.png is wrong")
  })

  it("uses the labels.tooMany override instead of the default", () => {
    const { tooMany } = resolveLabels({ tooMany: (name) => `${name} is extra` })

    expect(tooMany("a.png")).toBe("a.png is extra")
  })

  it("falls back to the built-in message when a label is not overridden", () => {
    const { removeFile, tooLarge, wrongType, tooMany } = resolveLabels({})

    expect(removeFile("a.png")).toBe("Remove a.png")
    expect(tooLarge("a.png", 1024)).toBe("a.png is larger than 1 KB")
    expect(wrongType("a.png")).toBe("a.png is not an accepted file type")
    expect(tooMany("a.png")).toBe("a.png was not chosen — only one file is allowed")
  })
})

describe("FileInput", () => {
  it("hides the native input visually without display:none, so it stays tabbable", () => {
    const html = render(<FileInput id="attachments" />)

    expect(html).toContain('type="file"')
    expect(html).toContain('id="attachments"')
    expect(html).toMatch(/<input[^>]*class="sr-only"/)
    expect(html).not.toContain("display:none")
    expect(html).not.toContain("display: none")
  })

  it("forwards accept, multiple and name onto the native input", () => {
    const html = render(
      <FileInput id="attachments" name="attachments" accept="image/*" multiple />,
    )

    expect(html).toContain('name="attachments"')
    expect(html).toContain('accept="image/*"')
    expect(html).toMatch(/<input[^>]*\smultiple(\s|>|=)/)
  })

  it("renders the label above the drop zone, pointing at the input's id", () => {
    const html = render(<FileInput id="attachments" label="Attachments" />)

    expect(html).toContain('for="attachments"')
    expect(html.indexOf(">Attachments<")).toBeLessThan(html.indexOf('id="attachments"'))
  })

  it("renders no label element when label is omitted", () => {
    const html = render(<FileInput id="attachments" />)

    expect(html).not.toContain("<label")
  })

  it("marks a required field on the label and on the input", () => {
    const html = render(<FileInput id="attachments" label="Attachments" required />)

    expect(html).toMatch(/<input[^>]*\srequired(\s|>|=)/)
    expect(html).toContain(
      '<span aria-hidden="true" class="ml-1 text-red-700 dark:text-red-300">*</span>',
    )
  })

  it("disables the input and dims the label", () => {
    const html = render(<FileInput id="attachments" label="Attachments" disabled />)

    expect(html).toMatch(/<input[^>]*\sdisabled(\s|>|=)/)
    expect(html).toContain("opacity-50")
  })

  it("renders an always-present, initially empty live region for refusals", () => {
    const html = render(<FileInput id="attachments" />)

    expect(html).toContain('id="attachments-rejection"')
    expect(html).toContain('role="status"')
    expect(html).toMatch(/id="attachments-rejection"[^>]*>\s*<\/p>/)
  })

  it("describes the input by the rejection region even with no error or hint", () => {
    const html = render(<FileInput id="attachments" />)

    expect(html).toContain('aria-describedby="attachments-rejection"')
  })

  it("describes the input by its error, hint and the rejection region together", () => {
    const html = render(
      <FileInput id="attachments" hint="Up to 5 files" error="Something is wrong" />,
    )

    expect(html).toContain(
      'aria-describedby="attachments-error attachments-hint attachments-rejection"',
    )
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain("Something is wrong")
    expect(html).toContain("Up to 5 files")
  })

  it("renders no error paragraph and no aria-invalid for an empty error", () => {
    const html = render(<FileInput id="attachments" error="" />)

    expect(html).not.toContain("attachments-error")
    expect(html).not.toContain("aria-invalid")
  })

  it("appends the caller's own aria-describedby alongside its own ids", () => {
    const html = render(<FileInput id="attachments" aria-describedby="external-note" />)

    expect(html).toContain('aria-describedby="attachments-rejection external-note"')
  })

  it("renders no file list when nothing has been chosen yet", () => {
    const html = render(<FileInput id="attachments" />)

    expect(html).not.toContain("<ul")
  })

  it("puts the caller's class on the wrapper", () => {
    const html = render(<FileInput id="attachments" class="sm:col-span-3" />)

    expect(html.startsWith('<div class="sm:col-span-3">')).toBe(true)
  })

  it("defaults the drop-zone text to English and takes an override for each string", () => {
    const defaults = render(<FileInput id="attachments" />)
    const overridden = render(
      <FileInput
        id="attachments"
        labels={{ browse: "Parcourir", dropHint: "ou glisser-déposer" }}
      />,
    )

    expect(defaults).toContain("Choose files")
    expect(defaults).toContain("or drag and drop")
    expect(overridden).toContain("Parcourir")
    expect(overridden).toContain("ou glisser-déposer")
    expect(overridden).not.toContain("Choose files")
  })

  it("nests inside Field with exactly one label, naming the real input", () => {
    const html = render(
      <Field id="attachments" label="Attachments" hint="Up to 2 MB each" error="Too many files">
        <FileInput id="attachments" />
      </Field>,
    )

    expect(html.match(/<label\b/g)?.length).toBe(1)
    expect(html).toContain('for="attachments"')
    expect(html.match(/id="attachments"/g)?.length).toBe(1)
  })

  it("folds Field's aria-describedby together with its own rejection-region id", () => {
    const html = render(
      <Field id="attachments" label="Attachments" hint="Up to 2 MB each" error="Too many files">
        <FileInput id="attachments" />
      </Field>,
    )

    // FileInput's own errorId/hintId are unset here (its local `hint`/`error` props are never
    // passed when nested — only Field's are), so its own rejection id leads, followed by the
    // merged value Field's clone already carries (Field's own error id then its own hint id).
    expect(html).toContain(
      'aria-describedby="attachments-rejection attachments-error attachments-hint"',
    )
  })

  it("reads aria-invalid from Field's clone when nested, alongside its own error prop", () => {
    const nested = render(
      <Field id="attachments" label="Attachments" error="Too many files">
        <FileInput id="attachments" />
      </Field>,
    )
    const standalone = render(<FileInput id="attachments" error="Too many files" />)
    const neither = render(<FileInput id="attachments" />)

    expect(nested).toContain('aria-invalid="true"')
    expect(standalone).toContain('aria-invalid="true"')
    expect(neither).not.toContain("aria-invalid")
  })
})
