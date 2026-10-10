/**
 * The setup `docs/app-checks.md` gives an app for `playwright.config.ts`, loaded by Playwright.
 *
 * Importing `playwrightBaseConfig` in a Deno test proves nothing about that file: Playwright loads
 * its configuration with its own loader, which finds only packages in `node_modules`, and the
 * documented import once failed there while every Deno test passed. So this test takes the two
 * blocks from the docs as they are written (`deno.jsonc`, `playwright.config.ts`), puts
 * them in an empty folder with two spec files, and runs `playwright test --list` on it, the way an
 * app's `e2e` task starts Playwright.
 *
 * It installs the published package the docs name, not this checkout, so it needs the network. A
 * failed install fails the test; nothing here skips. The run has a deadline, and it may not start
 * another process (`--deny-run`): listing needs neither a browser nor a worker.
 *
 * Runs on its own in the root `test` task, with `--allow-run=deno` and `--allow-write` for the
 * folder.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { join } from "@std/path"

const DOCS = new URL("../docs/app-checks.md", import.meta.url)

/** How long the install and the listing may take together before the run is killed. */
const DEADLINE_MS = 240_000

/**
 * The body of the fenced block in the docs whose first line is `marker`, that line included.
 *
 * @throws When the docs hold no such block, so a renamed block fails instead of testing nothing.
 */
function docsBlock(docs: string, marker: string): string {
  for (const match of docs.matchAll(/```[a-z]*\n([\s\S]*?)```/g)) {
    if (match[1].startsWith(`${marker}\n`)) return match[1]
  }
  throw new Error(`docs/app-checks.md has no code block that starts with "${marker}"`)
}

/** What one `playwright test --list` run printed. */
interface Listing {
  /** The exit code; `0` when Playwright loaded the configuration and found the specs. */
  code: number
  /** Standard output and standard error, in that order. */
  output: string
}

/**
 * Write the docs' setup and two spec files into a new folder and list the tests through
 * Playwright.
 *
 * @param config The text of `playwright.config.ts`.
 */
async function listThroughPlaywright(docs: string, config: string): Promise<Listing> {
  const manifest = docsBlock(docs, "// deno.jsonc")
  const version = /"npm:@playwright\/test@([0-9.]+)"/.exec(manifest)?.[1]
  if (!version) throw new Error("the docs' deno.jsonc block pins no @playwright/test version")

  const folder = await Deno.makeTempDir({ prefix: "playwright-config-" })
  try {
    await Deno.writeTextFile(join(folder, "deno.jsonc"), manifest)
    await Deno.writeTextFile(join(folder, "playwright.config.ts"), config)
    await Deno.mkdir(join(folder, "e2e"))
    const spec = `import { test } from "@playwright/test"\ntest("is listed", () => {})\n`
    // The shared `testMatch` takes the first file and leaves the second.
    await Deno.writeTextFile(join(folder, "e2e", "listed.e2e.ts"), spec)
    await Deno.writeTextFile(join(folder, "e2e", "left-out.spec.ts"), spec)

    const { code, stdout, stderr } = await new Deno.Command("deno", {
      args: ["run", "-A", "--deny-run", `npm:playwright@${version}`, "test", "--list"],
      cwd: folder,
      env: { NO_COLOR: "1" },
      signal: AbortSignal.timeout(DEADLINE_MS),
    }).output()
    const decoder = new TextDecoder()
    return { code, output: decoder.decode(stdout) + decoder.decode(stderr) }
  } finally {
    await Deno.remove(folder, { recursive: true })
  }
}

describe("the Playwright setup in docs/app-checks.md", () => {
  it("loads through Playwright and lists the spec the shared options match", async () => {
    const docs = await Deno.readTextFile(DOCS)
    const { code, output } = await listThroughPlaywright(
      docs,
      docsBlock(docs, "// playwright.config.ts"),
    )

    expect(output).toContain("Total: 1 test in 1 file")
    expect(output).toMatch(/\[chromium\] › .*listed\.e2e\.ts.* › is listed/)
    expect(output).not.toContain("left-out.spec.ts")
    expect(code).toBe(0)
  })
})
