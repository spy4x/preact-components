// The control for `island-bundle.test.ts`: an island that calls `cn`, so it carries tailwind-merge.
import { render } from "preact"
import { cn } from "@spy4x/preact-cn"

render(<p class={cn("p-2", "p-4")}>Merged</p>, document.body)
