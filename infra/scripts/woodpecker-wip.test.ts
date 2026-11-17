import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { parse } from "@std/yaml"

interface When {
  event?: string | string[]
  branch?: string
  ref?: string
  evaluate?: string
}

interface Workflow {
  when: When[]
  steps: Record<string, { when?: When | When[] }>
}

const read = async (name: string) =>
  parse(await Deno.readTextFile(new URL(`../../.woodpecker/${name}`, import.meta.url))) as Workflow

const full = await read("woodpecker.yml")
const wip = await read("wip.yml")
const isWip = `CI_COMMIT_MESSAGE startsWith "[WIP]"`
const events = (when: When) => [when.event ?? []].flat()

describe("the [WIP] pull request workflows", () => {
  it("runs wip.yml only for a [WIP] pull request into main", () => {
    expect(wip.when).toEqual([{ event: "pull_request", branch: "main", evaluate: isWip }])
  })

  it("runs woodpecker.yml for every pull request wip.yml skips, and on a title edit", () => {
    const pulls = full.when.filter((w) => events(w).some((e) => e.startsWith("pull_request")))
    expect(pulls).toEqual([
      { event: "pull_request", branch: "main", evaluate: `not (${isWip})` },
      {
        event: "pull_request_metadata",
        branch: "main",
        evaluate: `CI_PIPELINE_EVENT_REASON contains "edited" && not (${isWip})`,
      },
    ])
  })

  it("runs every pull request step of woodpecker.yml on a title edit too", () => {
    const missing = Object.entries(full.steps).filter(([, step]) =>
      [step.when ?? []].flat().some((w) =>
        events(w).includes("pull_request") && !events(w).includes("pull_request_metadata")
      )
    ).map(([name]) => name)
    expect(missing).toEqual([])
  })

  it("runs no browser step on a push to main", () => {
    const browser = Object.entries(full.steps)
      .filter(([name]) => name === "pages-build" || name.startsWith("verify-"))
    expect(browser.length).toBe(7)
    const onPush = browser.filter(([, step]) =>
      !step.when || [step.when].flat().some((w) => !w.event || events(w).includes("push"))
    ).map(([name]) => name)
    expect(onPush).toEqual([])
  })

  it("keeps wip.yml's check step equal to woodpecker.yml's", () => {
    expect(Object.keys(wip.steps)).toEqual(["check"])
    expect(wip.steps.check).toEqual(full.steps.check)
  })
})
