import { assertEquals } from "@std/assert"
import { ofComponent } from "./ui.ts"

Deno.test("a component filter takes its own file and its dash-named siblings only", () => {
  assertEquals(ofComponent(`dropdown`, `dropdown`), true)
  assertEquals(ofComponent(`dropdown-no-script`, `dropdown`), true)
  assertEquals(ofComponent(`dropdown`, `dropdown-no-script`), false)
  assertEquals(ofComponent(`toastr`, `toast`), false)
  assertEquals(ofComponent(`toastr`, ``), false)
})
