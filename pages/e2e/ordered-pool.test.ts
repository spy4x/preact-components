import { assertEquals, assertRejects } from "@std/assert"
import { runInOrder } from "./ordered-pool.ts"

/** A promise and the function that settles it, so a test decides when each item finishes. */
function gate(): { promise: Promise<void>; open: () => void } {
  let open = () => {}
  const promise = new Promise<void>((resolve) => open = resolve)
  return { promise, open }
}

Deno.test("records results in list order when later items finish first", async () => {
  const gates = [gate(), gate(), gate()]
  const recorded: number[] = []
  const run = runInOrder([0, 1, 2], 3, async (item) => {
    await gates[item].promise
    return item
  }, (result) => recorded.push(result))
  gates[2].open()
  gates[1].open()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assertEquals(recorded, [], "nothing is recorded before the first item finishes")
  gates[0].open()
  await run
  assertEquals(recorded, [0, 1, 2])
})

Deno.test("never has more calls in flight than workers", async () => {
  let inFlight = 0
  let most = 0
  const recorded: number[] = []
  await runInOrder([...Array(10).keys()], 3, async (item) => {
    inFlight++
    most = Math.max(most, inFlight)
    await new Promise((resolve) => setTimeout(resolve, item % 3))
    inFlight--
    return item
  }, (result) => recorded.push(result))
  assertEquals(most, 3)
  assertEquals(recorded, [...Array(10).keys()])
})

Deno.test("starts items in list order", async () => {
  const started: number[] = []
  await runInOrder([0, 1, 2, 3, 4], 2, async (item) => {
    started.push(item)
    await new Promise((resolve) => setTimeout(resolve, 4 - item))
    return item
  }, () => {})
  assertEquals(started, [0, 1, 2, 3, 4])
})

Deno.test("rejects a worker count below one", async () => {
  await assertRejects(
    () => runInOrder([1], 0, (item) => Promise.resolve(item), () => {}),
    Error,
    "workers",
  )
})

Deno.test("stops recording after a call throws and rejects with its error", async () => {
  const recorded: number[] = []
  await assertRejects(
    () =>
      runInOrder([0, 1, 2], 1, (item) => {
        if (item === 1) return Promise.reject(new Error("boom"))
        return Promise.resolve(item)
      }, (result) => recorded.push(result)),
    Error,
    "boom",
  )
  assertEquals(recorded, [0])
})
