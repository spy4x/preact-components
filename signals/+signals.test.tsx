/** @jsxImportSource preact */
/** @jsxRuntime automatic */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { computed, signal } from "@preact/signals"
import { renderToString } from "preact-render-to-string"
import { For, Show } from "./+signals.tsx"

describe("For", () => {
  it("renders every element of the signal's array", () => {
    const items = signal(["a", "b", "c"])
    expect(renderToString(<ul>{<For each={items}>{(v) => <li>{String(v)}</li>}</For>}</ul>))
      .toBe("<ul><li>a</li><li>b</li><li>c</li></ul>")
  })

  it("renders nothing for an empty array", () => {
    const items = signal<string[]>([])
    expect(renderToString(<For each={items}>{(v) => <li>{String(v)}</li>}</For>)).toBe("")
  })

  it("does not render the fallback for an empty array", () => {
    const items = signal<string[]>([])
    // `fallback` is for an absent array; an empty one renders nothing, as in the source.
    expect(
      renderToString(
        <For each={items} fallback={<p>nothing</p>}>{(v) => <li>{String(v)}</li>}</For>,
      ),
    ).toBe("")
  })

  it("renders the fallback for a missing array", () => {
    const items = signal<string[] | null>(null)
    expect(
      renderToString(
        <For each={items} fallback={<p>nothing</p>}>{(v) => <li>{String(v)}</li>}</For>,
      ),
    ).toBe("<p>nothing</p>")
  })

  it("re-renders when the signal is replaced", () => {
    const items = signal(["a"])
    expect(renderToString(<For each={items}>{(v) => <li>{String(v)}</li>}</For>)).toBe("<li>a</li>")
    items.value = ["b"]
    expect(renderToString(<For each={items}>{(v) => <li>{String(v)}</li>}</For>)).toBe("<li>b</li>")
  })

  it("passes the index to the child", () => {
    const items = signal(["a", "b"])
    expect(
      renderToString(<For each={items}>{(v, k) => <li>{`${k}:${String(v)}`}</li>}</For>),
    ).toBe("<li>0:a</li><li>1:b</li>")
  })
})

describe("Show", () => {
  it("renders children for a truthy value", () => {
    const when = signal(true)
    expect(renderToString(<Show when={when}>{(v) => <p>{String(v)}</p>}</Show>)).toBe("<p>true</p>")
  })

  it("renders the fallback for a falsy value", () => {
    const when = signal("")
    expect(renderToString(<Show when={when} fallback={<p>empty</p>}>{() => <p>full</p>}</Show>))
      .toBe("<p>empty</p>")
  })

  it("renders nothing when a falsy value has no fallback", () => {
    const when = signal(0)
    expect(renderToString(<Show when={when}>{() => <p>full</p>}</Show>)).toBe("")
  })

  it("accepts plain children instead of a function", () => {
    const when = signal(1)
    expect(renderToString(
      <Show when={when}>
        <p>plain</p>
      </Show>,
    )).toBe("<p>plain</p>")
  })

  it("hands the value to the child function", () => {
    const when = signal<{ name: string } | null>({ name: "Ada" })
    expect(renderToString(<Show when={when}>{(v) => <p>{String(v)}</p>}</Show>))
      .toBe("<p>[object Object]</p>")
  })
})

describe("Signal.prototype.map", () => {
  it("renders the signal's array through For", () => {
    const items = signal(["a", "b"])
    // deno-lint-ignore jsx-key -- `map` here is the signal augmentation, and `For` keys its items
    expect(renderToString(<ul>{items.map((value) => <li>{value.toUpperCase()}</li>)}</ul>))
      .toBe("<ul><li>A</li><li>B</li></ul>")
  })

  it("works on a computed signal", () => {
    const doubled = computed(() => [2, 4])
    // deno-lint-ignore jsx-key -- `map` here is the signal augmentation, and `For` keys its items
    expect(renderToString(<ul>{doubled.map((value) => <li>{String(value)}</li>)}</ul>))
      .toBe("<ul><li>2</li><li>4</li></ul>")
  })

  it("passes the element, not the array", () => {
    const counts = signal([1])
    // deno-lint-ignore jsx-key -- `map` here is the signal augmentation, and `For` keys its items
    expect(renderToString(<p>{counts.map((value) => <b>{String(value + 1)}</b>)}</p>)).toBe(
      "<p><b>2</b></p>",
    )
  })
})
