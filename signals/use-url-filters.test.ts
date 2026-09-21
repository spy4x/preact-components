import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  clearFilterFields,
  type FilterField,
  filterSearch,
  filterWrite,
  resolveFilterValue,
  restoredAddress,
  shouldPersistFilter,
} from "./use-url-filters.ts"
import { effect, signal } from "@preact/signals"

function stringField(urlParam: string, initialValue: string): FilterField<string> {
  return { signal: signal(initialValue), urlParam, initialValue }
}

function numberField(urlParam: string, initialValue: number): FilterField<number> {
  return { signal: signal(initialValue), urlParam, initialValue }
}

describe("resolveFilterValue", () => {
  it("falls back to the default for an absent parameter", () => {
    expect(resolveFilterValue(stringField("status", "all"), null)).toBe("all")
    expect(resolveFilterValue(numberField("page", 1), null)).toBe(1)
  })

  it("reads a string parameter", () => {
    expect(resolveFilterValue(stringField("status", "all"), "active")).toBe("active")
  })

  it("treats an empty parameter as the default", () => {
    expect(resolveFilterValue(stringField("status", "all"), "")).toBe("all")
  })

  it("parses a number parameter", () => {
    expect(resolveFilterValue(numberField("page", 1), "7")).toBe(7)
  })

  it("ignores a number parameter that is not a number", () => {
    expect(resolveFilterValue(numberField("page", 1), "abc")).toBe(1)
  })

  it("prefers a custom parser", () => {
    const field: FilterField<string[]> = {
      signal: signal<string[]>([]),
      urlParam: "tags",
      initialValue: [],
      parser: (value) => value ? value.split("|") : [],
    }
    expect(resolveFilterValue(field, "a|b")).toEqual(["a", "b"])
    expect(resolveFilterValue(field, null)).toEqual([])
  })

  it("lets a parser see the raw null for an absent parameter", () => {
    const field: FilterField<number | null> = {
      signal: signal<number | null>(null),
      urlParam: "zoneId",
      initialValue: null,
      parser: (value) => value === null ? null : Number(value),
    }
    expect(resolveFilterValue(field, "3")).toBe(3)
    expect(resolveFilterValue(field, null)).toBeNull()
  })
})

describe("shouldPersistFilter", () => {
  it("keeps a value that differs from the default", () => {
    expect(shouldPersistFilter(stringField("status", "all"), "active")).toBe(true)
    expect(shouldPersistFilter(numberField("page", 1), 2)).toBe(true)
  })

  it("drops the default so the URL stays clean", () => {
    expect(shouldPersistFilter(stringField("status", "all"), "all")).toBe(false)
    expect(shouldPersistFilter(numberField("page", 1), 1)).toBe(false)
  })

  it("drops the empty values", () => {
    expect(shouldPersistFilter(stringField("status", ""), "")).toBe(false)
    expect(shouldPersistFilter(stringField("status", "all"), "")).toBe(false)
  })

  it("drops null", () => {
    const field: FilterField<number | null> = {
      signal: signal<number | null>(null),
      urlParam: "zoneId",
      initialValue: 5,
      parser: (value) => value === null ? null : Number(value),
    }
    expect(shouldPersistFilter(field, null)).toBe(false)
  })

  it("keeps a falsy value that is not the default", () => {
    expect(shouldPersistFilter(numberField("page", 1), 0)).toBe(true)
  })
})

describe("filterWrite", () => {
  it("writes a value that is not the default", () => {
    expect(filterWrite(stringField("status", "all"), "active")).toEqual({
      urlParam: "status",
      value: "active",
    })
  })

  it("removes a filter holding its default, so an unfiltered address stays clean", () => {
    expect(filterWrite(numberField("page", 1), 1)).toEqual({ urlParam: "page", value: undefined })
  })

  it("prints a number rather than handing the query string a number", () => {
    expect(filterWrite(numberField("page", 1), 7)).toEqual({ urlParam: "page", value: "7" })
  })
})

describe("filterSearch", () => {
  it("sets the parameters it is given", () => {
    expect(filterSearch("", [{ urlParam: "status", value: "open" }])).toBe("status=open")
  })

  it("removes a parameter whose filter holds its default", () => {
    expect(filterSearch("page=1&status=open", [{ urlParam: "page" }])).toBe("status=open")
  })

  it("carries a parameter the filters do not own", () => {
    expect(filterSearch("tab=inbox", [{ urlParam: "status", value: "open" }]))
      .toBe("tab=inbox&status=open")
  })

  it("carries a repeated key it does not own, both values", () => {
    expect(filterSearch("tag=a&tag=b", [{ urlParam: "status", value: "open" }]))
      .toBe("tag=a&tag=b&status=open")
  })

  it("replaces every copy of a repeated key it does own", () => {
    expect(filterSearch("status=open&status=closed", [{ urlParam: "status", value: "open" }]))
      .toBe("status=open")
  })

  it("leaves a clear holding nothing but the parameters somebody else put there", () => {
    const cleared = filterSearch("tab=inbox&status=open&page=2", [
      { urlParam: "status" },
      { urlParam: "page" },
    ])
    expect(cleared).toBe("tab=inbox")
  })

  it("answers with the string it was given when no filter changes it", () => {
    // The premise of the hook's write: an address the filters already agree with produces the same
    // string back, and a string that has not changed is a write that does not happen.
    expect(filterSearch("status=open", [{ urlParam: "status", value: "open" }])).toBe("status=open")
    expect(filterSearch("", [{ urlParam: "status" }])).toBe("")
  })

  it("re-spells a carried parameter, because it rebuilds through URLSearchParams", () => {
    // Cosmetic and deliberate: both spellings decode to `x y`, and a read alone never rewrites the
    // address, so this only shows up after a filter has changed.
    expect(filterSearch("q=x%20y", [{ urlParam: "status", value: "open" }])).toBe(
      "q=x+y&status=open",
    )
  })

  it("takes a query string with or without its leading question mark", () => {
    // `URLSearchParams` strips it, so a caller handing over `location.search` untouched gets the
    // same answer as one handing over the router's own `?`-less string.
    expect(filterSearch("?status=open", [{ urlParam: "page", value: "2" }]))
      .toBe("status=open&page=2")
  })
})

describe("restoredAddress", () => {
  /**
   * An address the way `location` reports it, with `href` derived rather than passed.
   *
   * Only `href` distinguishes `/list?` from `/list` — `search` reads as the empty string for both
   * — so a fixture that let the two drift apart could assert something no browser produces.
   *
   * @param pathname The path.
   * @param search The query string, `?` included, or empty.
   * @param hash The fragment, `#` included, or empty.
   * @param trailingQuestionMark Whether the address ends in a bare `?`, which is what the router
   *                             leaves behind when a write empties the query string.
   */
  function address(pathname: string, search: string, hash: string, trailingQuestionMark = false) {
    const query = search || (trailingQuestionMark ? "?" : "")
    return { pathname, search, hash, href: `https://example.com${pathname}${query}${hash}` }
  }

  it("puts a fragment back on the address the router's write left behind", () => {
    expect(restoredAddress("#section", address("/list", "?page=2", ""))).toBe(
      "/list?page=2#section",
    )
  })

  it("leaves an address that never had a fragment without one, and without a bare hash", () => {
    // `location.hash` reads as the empty string both for an address with no fragment and for one
    // ending in a bare `#`, so both arrive here the same way and neither gains a `#`.
    expect(restoredAddress("", address("/list", "?page=2", ""))).toBeUndefined()
  })

  it("does nothing when the write set a different fragment of its own", () => {
    // What a router keeping its location in the fragment does: `useHashLocation` sets the fragment
    // as part of navigating, so there is nothing lost and nothing to put back. Answering with an
    // address here would overwrite that router's new route with the one it had just left.
    expect(restoredAddress("#/list", address("/", "?page=2", "#/list-2"))).toBeUndefined()
  })

  it("does nothing when the write left the fragment it started with", () => {
    // The same guard from the other side: a router that navigated to the route it was already on.
    // Replacing here would be a history entry's worth of work for an address already correct.
    expect(restoredAddress("#/list", address("/", "?page=2", "#/list"))).toBeUndefined()
  })

  it("carries a hash route whose own text contains a question mark", () => {
    // The case naive string handling mangles: everything after the `#` belongs to the fragment,
    // including a `?`, an `&` and an `=`, and none of it is the query string.
    expect(restoredAddress("#/list?tab=2&sort=name", address("/", "?page=2", "")))
      .toBe("/?page=2#/list?tab=2&sort=name")
  })

  it("carries a percent-encoded fragment exactly as it was", () => {
    // Neither decoded nor re-encoded: the fragment came out of `location.hash` and goes back in
    // the spelling the address had, so a round trip through a filter change changes nothing.
    expect(restoredAddress("#a%20b", address("/list", "?page=2", ""))).toBe("/list?page=2#a%20b")
  })

  it("keeps a base path, because it rebuilds from the path the address already has", () => {
    // Whether the prefix comes from the site being served under one or from a router `base`, it is
    // in `location.pathname` by the time this runs, so nothing here has to know about it.
    expect(restoredAddress("#section", address("/app/list", "?page=2", "")))
      .toBe("/app/list?page=2#section")
  })

  it("puts the fragment straight after the path when a clear empties the query string", () => {
    expect(restoredAddress("#section", address("/list", "", "", true))).toBe("/list#section")
  })

  it("takes off the bare question mark a clear leaves on an address with no fragment", () => {
    // The same clear on an address carrying no fragment. The router navigated to `pathname + "?"`,
    // and without this the two addresses would end a clear differently — `/list#section` against
    // `/list?` — for no reason a reader could see.
    expect(restoredAddress("", address("/list", "", "", true))).toBe("/list")
  })

  it("leaves an address alone when the query string is genuinely absent", () => {
    // No trailing `?` to take off and no fragment to put back, so there is nothing to replace: a
    // write that answered here would cost a history operation for an identical address.
    expect(restoredAddress("", address("/list", "", ""))).toBeUndefined()
  })
})

describe("clearFilterFields", () => {
  it("takes every field back to its default", () => {
    const fields = {
      status: stringField("status", "all"),
      page: numberField("page", 1),
    }
    fields.status.signal.value = "active"
    fields.page.signal.value = 7

    clearFilterFields(fields)

    expect(fields.status.signal.value).toBe("all")
    expect(fields.page.signal.value).toBe(1)
  })

  it("clears every field as one change, not one change per field", () => {
    // What the hook does with this: one change is one write to the address, so one press of Back
    // undoes a clear. Preact's signals adapter batches writes made inside an event handler, so a
    // clear driven by a button looks the same either way — this is the path an application takes
    // when it clears from a timer or after a request, where nothing else is batching.
    const fields = {
      status: stringField("status", "all"),
      page: numberField("page", 1),
    }
    fields.status.signal.value = "active"
    fields.page.signal.value = 7

    let runs = 0
    const stop = effect(() => {
      fields.status.signal.value
      fields.page.signal.value
      runs++
    })
    const before = runs

    clearFilterFields(fields)
    stop()

    expect(runs - before).toBe(1)
  })
})
