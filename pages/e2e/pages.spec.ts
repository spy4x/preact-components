/**
 * Playwright specs for the site itself: the generated `llms.txt` and `llms-full.txt`, which the
 * build copies from the repository root to the site root. Each is fetched by its address relative
 * to the page's base, so the spec follows whatever base the site is built for. The catalogue's
 * `index.html` also answers a wrong path with a 200 on some hosts, so the body is checked too.
 */
import type { Page } from "playwright-core"
import type { Spec } from "./runner.ts"

/** What the site answered for one file. */
interface Served {
  status: number
  type: string
  text: string
}

/** Fetches a file next to the page, from inside the page. */
function read(page: Page, name: string): Promise<Served> {
  return page.evaluate(async (file) => {
    const response = await fetch(new URL(file, document.baseURI))
    return {
      status: response.status,
      type: response.headers.get("content-type") ?? "",
      text: await response.text(),
    }
  }, name)
}

/** Throws unless the file was served as plain text; returns what the check prints. */
function plainText(name: string, served: Served): string {
  const found = `${served.status} ${served.type}, ${served.text.length} characters`
  if (served.status !== 200 || !served.type.startsWith("text/plain")) {
    throw new Error(`${name} is not served as plain text: ${found}`)
  }
  return found
}

export const specs: readonly Spec[] = [
  {
    name:
      "the site serves llms.txt at its root, as plain text with one tab-separated line per export",
    pageId: "overview",
    run: async (page) => {
      const llms = await read(page, "llms.txt")
      const found = plainText("llms.txt", llms)
      if (
        !llms.text.startsWith("# preact-components: the exports of the @spy4x/preact-* packages")
      ) {
        throw new Error(`llms.txt starts with "${llms.text.slice(0, 80)}"`)
      }
      if (!llms.text.includes("\nBadge\tcomponent\t@spy4x/preact-ui\t")) {
        throw new Error(`llms.txt has no line "Badge<tab>component<tab>@spy4x/preact-ui<tab>"`)
      }
      return found
    },
  },
  {
    name: "the site serves llms-full.txt at its root, with the package READMEs after the header",
    pageId: "overview",
    run: async (page) => {
      const full = await read(page, "llms-full.txt")
      const found = plainText("llms-full.txt", full)
      if (!full.text.startsWith("# preact-components")) {
        throw new Error(`llms-full.txt starts with "${full.text.slice(0, 80)}"`)
      }
      if (!full.text.includes("## Components")) {
        throw new Error(`llms-full.txt has no "## Components" section of a package README`)
      }
      const llms = await read(page, "llms.txt")
      if (full.text.length <= llms.text.length) {
        throw new Error(`llms-full.txt (${full.text.length}) is not longer than llms.txt`)
      }
      return found
    },
  },
]
