// An island that renders a library `PricingTable` with a choice callback (`island-bundle.test.ts`).
import { render } from "preact"
import { BillingInterval, PricingTable } from "@spy4x/preact-ui/billing"

render(
  <PricingTable
    plans={[{
      id: "pro",
      name: "Pro",
      amount: 1200,
      currency: "EUR",
      interval: BillingInterval.Month,
    }]}
    onChoose={(plan) => console.log(plan.id)}
  />,
  document.body,
)
