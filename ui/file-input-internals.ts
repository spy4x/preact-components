/**
 * The file checks and message wording behind `FileInput`, apart from the component so they can be
 * tested without a browser. Not an entry point of the package: an app imports `./file-input.tsx`
 * alone, which re-exports {@link matchesAccept}.
 *
 * @module
 */
import { formatBytes } from "@spy4x/platform/universal/format-number"
import type { FileInputLabels, FileRejection } from "./file-input.tsx"

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
 * Fills in every message-building label {@link FileInputLabels} leaves unset with its default,
 * exported so a caller's override — or the fallback it replaces — can be checked directly, without
 * driving a real file chooser to reach the code that would otherwise call it.
 */
export function resolveLabels(labels: FileInputLabels): {
  removeFile: (name: string) => string
  tooLarge: (name: string, maxSize: number) => string
  wrongType: (name: string) => string
  tooMany: (name: string) => string
} {
  return {
    removeFile: labels.removeFile ?? defaultRemoveFileLabel,
    tooLarge: labels.tooLarge ?? defaultTooLarge,
    wrongType: labels.wrongType ?? defaultWrongType,
    tooMany: labels.tooMany ?? defaultTooMany,
  }
}

/**
 * Splits `selected` into the files {@link FileInput} would keep and the files it would refuse,
 * applying `accept`, `maxSize` and `multiple` exactly as `handleFiles` does — extracted so the
 * classification itself (including the `maxSize` boundary) can be unit-tested without a browser.
 *
 * @param selected The files a chooser or drop just offered.
 * @param options `accept`/`maxSize`/`multiple`, read the same way {@link FileInputProps} does.
 */
export function classifyFiles(
  selected: File[],
  options: { accept?: string; maxSize?: number; multiple?: boolean },
): { accepted: File[]; rejected: FileRejection[] } {
  const accepted: File[] = []
  const rejected: FileRejection[] = []
  for (const file of selected) {
    if (options.maxSize !== undefined && file.size > options.maxSize) {
      rejected.push({ file, reason: "too-large" })
      continue
    }
    if (!matchesAccept(file, options.accept)) {
      rejected.push({ file, reason: "wrong-type" })
      continue
    }
    accepted.push(file)
  }

  // Without `multiple`, only the first accepted file has a slot: the rest are refused with
  // `"too-many"` rather than silently dropped, since a silent drop gives no reason a caller's
  // `onReject` — or the live region — could ever surface.
  let keep = accepted
  if (!options.multiple && accepted.length > 1) {
    keep = accepted.slice(0, 1)
    for (const file of accepted.slice(1)) rejected.push({ file, reason: "too-many" })
  }

  return { accepted: keep, rejected }
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
