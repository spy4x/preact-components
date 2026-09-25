/**
 * Load a module the first time a card on the showing page needs it, instead of when the guide loads.
 *
 * The guide renders one page at a time, so a card whose component pulls a large dependency — the
 * charts page's d3 islands — can reach that dependency through a dynamic `import()` from an effect.
 * An app that mounts the guide then loads d3 only once someone opens the charts page, and a bundler
 * that splits code at dynamic imports ships it as its own file.
 *
 * Server rendering and hydration see the same thing: the module is never loaded during a render,
 * only from an effect, so the first render on either side is the caller's placeholder. Once one card
 * has loaded the module, a card mounted later renders with it straight away.
 */

import { useEffect, useState } from "preact/hooks"

/** What {@link LazyModule.use} returns while the module is loading, once it loaded, or failed. */
export type LazyModuleState<T> =
  | { status: "loading" }
  | { status: "loaded"; module: T }
  | { status: "failed"; message: string }

/** A module loaded on first use, shared by every card that uses it. */
export interface LazyModule<T> {
  /**
   * Hook: the module's state for this render. Starts loading from an effect the first time any
   * component calls it, never during a render.
   */
  use(): LazyModuleState<T>
}

/**
 * Wrap a dynamic import so cards can share one load of it.
 *
 * @param load The dynamic import, e.g. `() => import("@spy4x/preact-charts/d3-line-chart")`.
 * The specifier must be written literally inside it, so a bundler can see it and split it off.
 * @returns A {@link LazyModule} whose `use` hook reports the load.
 */
export function lazyModule<T>(load: () => Promise<T>): LazyModule<T> {
  let settled: LazyModuleState<T> | undefined
  let pending: Promise<LazyModuleState<T>> | undefined

  const start = (): Promise<LazyModuleState<T>> =>
    pending ??= load().then(
      (module): LazyModuleState<T> => (settled = { status: "loaded", module }),
      (error: unknown): LazyModuleState<T> => (settled = {
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    )

  return {
    use(): LazyModuleState<T> {
      const [state, setState] = useState<LazyModuleState<T>>(settled ?? { status: "loading" })

      useEffect(() => {
        if (state.status !== "loading") return
        let mounted = true
        start().then((next) => {
          if (mounted) setState(next)
        })
        return () => {
          mounted = false
        }
      }, [])

      return state
    },
  }
}
