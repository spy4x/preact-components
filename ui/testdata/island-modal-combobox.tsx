// An island: a library `Modal` holding a `Combobox` (`island-bundle.test.ts`).
import { render } from "preact"
import { Combobox } from "@spy4x/preact-ui/combobox"
import { Modal } from "@spy4x/preact-ui/modal"

render(
  <Modal open title="Pick a coin" onClose={() => {}}>
    <Combobox items={["BTC", "ETH"]} ariaLabel="Coin" onChange={() => {}} />
  </Modal>,
  document.body,
)
