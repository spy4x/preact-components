/**
 * What a page that renders `SiteSearch` loads before anyone searches (#1361).
 *
 * arktype is about 157 KB, and its `new Function` probe trips a strict `script-src 'self'` policy,
 * so it may load only with the index: `fetchSiteIndex` imports the check with `import()`, which a
 * bundler splits into a chunk of its own. This walks the module graph `deno info --json` reports
 * for `site-search.tsx` along static imports alone, the code a bundle's entry carries, and fails
 * when arktype is on it.
 *
 * Runs on its own in the root `test` task, with `--allow-run=deno`: no other test gets that grant.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { fromFileUrl } from "@std/path"

/** One module as `deno info --json` lists it. */
interface InfoModule {
  specifier: string
  dependencies?: { code?: { specifier: string }; isDynamic?: boolean }[]
}

/** What `deno info --json` prints: the graph's modules and the redirects between specifiers. */
interface Info {
  roots: string[]
  modules: InfoModule[]
  redirects: Record<string, string>
}

/** The module graph of `file`, as Deno resolves it. */
async function moduleGraph(file: string): Promise<Info> {
  const path = fromFileUrl(new URL(file, import.meta.url))
  const { success, stdout, stderr } = await new Deno.Command("deno", {
    args: ["info", "--json", path],
    stdout: "piped",
    stderr: "piped",
  }).output()
  if (!success) throw new Error(`deno info failed: ${new TextDecoder().decode(stderr)}`)
  return JSON.parse(new TextDecoder().decode(stdout))
}

/**
 * Every module reachable from the graph's root through runtime imports: type-only imports are
 * skipped, since a bundle erases them, and dynamic ones too unless `dynamic` is set.
 */
function reachable(info: Info, dynamic: boolean): Set<string> {
  const modules = new Map(info.modules.map((module) => [module.specifier, module]))
  const resolve = (specifier: string) => info.redirects[specifier] ?? specifier
  const seen = new Set<string>()
  const queue = info.roots.map(resolve)
  for (let specifier = queue.pop(); specifier !== undefined; specifier = queue.pop()) {
    if (seen.has(specifier)) continue
    seen.add(specifier)
    for (const dependency of modules.get(specifier)?.dependencies ?? []) {
      if (dependency.code === undefined || (dependency.isDynamic && !dynamic)) continue
      queue.push(resolve(dependency.code.specifier))
    }
  }
  return seen
}

/** The arktype modules among `specifiers`. */
const arktypeIn = (specifiers: Set<string>) =>
  [...specifiers].filter((specifier) => /(^npm:\/?|\/)(arktype|@ark\/)/.test(specifier))

describe("SiteSearch's module graph", () => {
  it("reaches arktype only through a dynamic import", async () => {
    const info = await moduleGraph("./site-search.tsx")
    // The control: with dynamic imports followed, the walk must find arktype, or a change in
    // `deno info`'s output would make the real check pass for the wrong reason.
    expect(arktypeIn(reachable(info, true))).not.toEqual([])
    expect(arktypeIn(reachable(info, false))).toEqual([])
  })
})
