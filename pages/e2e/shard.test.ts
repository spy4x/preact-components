import { assertEquals } from "@std/assert"
import { inShard, parseShard, type Shard, shardGaps } from "./shard.ts"

Deno.test("reads a shard written as index/count", () => {
  assertEquals(parseShard(`2/4`), { index: 2, count: 4 })
  assertEquals(parseShard(` 1/1 `), { index: 1, count: 1 })
})

Deno.test("refuses a shard outside 1..count or not written as two numbers", () => {
  for (const text of [`0/4`, `5/4`, `2`, `2/`, `/4`, `a/4`, `2/4/1`, `-1/4`, `1.5/4`, ``]) {
    assertEquals(parseShard(text), undefined, text)
  }
})

Deno.test("the shards of a split run every item exactly once, each in its original order", () => {
  const items = Array.from({ length: 23 }, (_, position) => position)
  for (const count of [1, 2, 3, 4, 7, 23, 30]) {
    const shards = Array.from({ length: count }, (_, i) => inShard(items, { index: i + 1, count }))
    for (const shard of shards) assertEquals(shard, [...shard].sort((a, b) => a - b))
    assertEquals(shards.flat().sort((a, b) => a - b), items, `${count} shards`)
    const sizes = shards.map((shard) => shard.length)
    assertEquals(Math.max(...sizes) - Math.min(...sizes) <= 1, true, `${count} shards: ${sizes}`)
  }
})

Deno.test("finds a missing, a repeated and a miscounted shard", () => {
  const all: Shard[] = [{ index: 1, count: 3 }, { index: 2, count: 3 }, { index: 3, count: 3 }]
  assertEquals(shardGaps(all), [])
  assertEquals(shardGaps([all[0], all[2]]), [`shard 2/3 is missing, so its specs never run`])
  assertEquals(shardGaps([...all, all[1]]), [`shard 2/3 is listed 2 times`])
  assertEquals(shardGaps([...all.slice(0, 2), { index: 3, count: 4 }]), [
    `the shards disagree on their count: 3, 4`,
  ])
  assertEquals(shardGaps([]), [`no shard is listed`])
})
