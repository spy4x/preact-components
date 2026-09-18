import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { createInViewObserver, useInView } from "./use-in-view.ts"

interface FakeObserver {
  callback: IntersectionObserverCallback
  options: IntersectionObserverInit | undefined
  observed: Element[]
  disconnected: boolean
  emit: (entries: { isIntersecting: boolean }[]) => void
}

/** Replace the global `IntersectionObserver` with a recorder, returning a restore function. */
function installFakeObserver(): { instances: FakeObserver[]; restore: () => void } {
  const original = Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver")
  const instances: FakeObserver[] = []

  class Recorder {
    callback: IntersectionObserverCallback
    options: IntersectionObserverInit | undefined
    observed: Element[] = []
    disconnected = false

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback
      this.options = options
      instances.push(this as unknown as FakeObserver)
    }

    observe(element: Element) {
      this.observed.push(element)
    }

    disconnect() {
      this.disconnected = true
    }

    emit(entries: { isIntersecting: boolean }[]) {
      this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver)
    }
  }

  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: Recorder,
  })

  return {
    instances,
    restore: () => {
      if (original) Object.defineProperty(globalThis, "IntersectionObserver", original)
      else delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver
    },
  }
}

/** Remove the global `IntersectionObserver`, returning a restore function. */
function removeObserver(): () => void {
  const original = Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver")
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver

  return () => {
    if (original) Object.defineProperty(globalThis, "IntersectionObserver", original)
  }
}

describe("createInViewObserver", () => {
  it("preloads 200px ahead of the viewport by default", () => {
    const fake = installFakeObserver()
    try {
      const element = { id: "panel" } as unknown as Element
      createInViewObserver(element, () => {})

      expect(fake.instances.length).toBe(1)
      expect(fake.instances[0].options?.rootMargin).toBe("200px")
      expect(fake.instances[0].options?.threshold).toBe(0)
      expect(fake.instances[0].observed).toEqual([element])
    } finally {
      fake.restore()
    }
  })

  it("takes the preload margin and threshold from the options", () => {
    const fake = installFakeObserver()
    try {
      createInViewObserver({} as Element, () => {}, { rootMargin: "600px", threshold: 0.5 })

      expect(fake.instances[0].options?.rootMargin).toBe("600px")
      expect(fake.instances[0].options?.threshold).toBe(0.5)
    } finally {
      fake.restore()
    }
  })

  it("reports every entry to the callback", () => {
    const fake = installFakeObserver()
    try {
      const seen: boolean[] = []
      createInViewObserver({} as Element, (isIntersecting) => seen.push(isIntersecting))

      fake.instances[0].emit([{ isIntersecting: true }, { isIntersecting: false }])

      expect(seen).toEqual([true, false])
    } finally {
      fake.restore()
    }
  })

  it("disconnects the observer on request", () => {
    const fake = installFakeObserver()
    try {
      const handle = createInViewObserver({} as Element, () => {})
      handle?.disconnect()

      expect(fake.instances[0].disconnected).toBe(true)
    } finally {
      fake.restore()
    }
  })

  it("returns null without an IntersectionObserver, so a server render is safe", () => {
    const restore = removeObserver()
    try {
      expect(createInViewObserver({} as Element, () => {})).toBe(null)
    } finally {
      restore()
    }
  })
})

/** Component under test: renders its view state so a server render can be asserted on. */
function Panel() {
  const { ref, inView } = useInView<HTMLDivElement>()
  return <div ref={ref}>{inView ? "visible" : "waiting"}</div>
}

describe("useInView", () => {
  it("server-renders as not in view", () => {
    const restore = removeObserver()
    try {
      const html = render(<Panel />)

      expect(html).toContain("waiting")
      expect(html).not.toContain("visible")
    } finally {
      restore()
    }
  })
})
