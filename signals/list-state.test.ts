import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { createInitialListState, createListState } from "./list-state.ts"

interface Row {
  id: number
  name: string
}

describe("createInitialListState", () => {
  it("starts empty with room for pagination", () => {
    expect(createInitialListState<Row>()).toEqual({
      list: { data: [], total: 0, page: 0, perPage: 0 },
      operations: {},
    })
  })

  it("merges what it is given over the defaults", () => {
    const initial = createInitialListState<Row>({ perPage: 25 }, { load: {} })
    expect(initial.list.perPage).toBe(25)
    expect(initial.list.page).toBe(0)
    expect(initial.operations).toEqual({ load: {} })
  })
})

describe("createListState mutations", () => {
  it("merges a patch without mutating the previous state", () => {
    const store = createListState<Row>()
    const before = store.state.value
    store.mutate({ list: { total: 5 } })
    expect(store.state.value).not.toBe(before)
    expect(store.state.value.list.total).toBe(5)
    expect(before.list.total).toBe(0)
  })

  it("patches the list and leaves operations alone", () => {
    const store = createListState<Row>()
    store.mutateOperation("load", { inProgress: true })
    store.mutateList({ data: [{ id: 1, name: "a" }], total: 1 })
    expect(store.state.value.list.total).toBe(1)
    // The operation survives the list patch untouched.
    expect(store.state.value.operations.load["0"].inProgress).toBe(true)
  })

  it("keeps sibling operations when one entity's slot changes", () => {
    const store = createListState<Row>()
    store.startOperation("save", 1)
    store.startOperation("save", 2)
    expect(store.state.value.operations.save[1].inProgress).toBe(true)
    expect(store.state.value.operations.save[2].inProgress).toBe(true)
  })

  it("merges into a slot that does not exist yet", () => {
    const store = createListState<Row>()
    store.mutateOperation("save", { inProgress: true }, 7)
    expect(store.state.value.operations.save[7]).toEqual({ inProgress: true })
  })

  it("writes a complete slot when an operation starts", () => {
    const store = createListState<Row>()
    store.startOperation("save", 7)
    expect(store.state.value.operations.save[7]).toEqual({
      inProgress: true,
      error: null,
      result: null,
    })
  })

  it("defaults to the collection slot when no entity is named", () => {
    const store = createListState<Row>()
    store.startOperation("load")
    expect(store.state.value.operations.load[0].inProgress).toBe(true)
  })
})

describe("createListState operation lifecycle", () => {
  it("clears the previous outcome when an operation starts again", () => {
    const store = createListState<Row>()
    store.endOperation("save", "boom", null, 1)
    store.startOperation("save", 1)
    expect(store.state.value.operations.save[1]).toEqual({
      inProgress: true,
      error: null,
      result: null,
    })
  })

  it("settles an operation with its error and result", () => {
    const store = createListState<Row>()
    store.startOperation("save", 1)
    store.endOperation("save", null, { id: 1, name: "a" }, 1)
    expect(store.state.value.operations.save[1]).toEqual({
      inProgress: false,
      error: null,
      result: { id: 1, name: "a" },
    })
  })

  it("keeps a falsy result", () => {
    const store = createListState<Row>()
    store.endOperation("count", null, 0, 1)
    expect(store.state.value.operations.count[1].result).toBe(0)
  })

  it("keeps a falsy error", () => {
    const store = createListState<Row>()
    store.endOperation("count", false, 1, 1)
    expect(store.state.value.operations.count[1].error).toBe(false)
  })
})

describe("createListState reset", () => {
  it("returns to the state it was created with", () => {
    const store = createListState<Row>({ list: { perPage: 10 } })
    store.mutateList({ data: [{ id: 1, name: "a" }], total: 1 })
    store.startOperation("load")
    store.reset()
    expect(store.state.value.list).toEqual({ data: [], total: 0, page: 0, perPage: 10 })
    expect(store.state.value.operations).toEqual({})
  })
})
