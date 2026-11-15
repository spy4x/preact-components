// An island: an `Explorable` figure whose `Slider` drives a stacked `Bars` and a `DotPlot`, the
// way an article's interactive figure renders them (`island-bundle.test.ts`).
import { render } from "preact"
import { useState } from "preact/hooks"
import { Explorable } from "@spy4x/preact-ui/explorable"
import { Slider } from "@spy4x/preact-ui/slider"
import { Bars } from "@spy4x/preact-charts/bars"
import { DotPlot } from "@spy4x/preact-charts/dot-plot"

function Figure() {
  const [share, setShare] = useState(75)
  return (
    <Explorable
      title="The same call on two models"
      controls={<Slider label="Cached share" value={share} onInput={setShare} />}
    >
      <Bars
        data={[
          {
            label: "A",
            segments: [{ series: "cached", value: share }, { series: "rest", value: 100 - share }],
          },
        ]}
        reference={{ value: 200, label: "List price" }}
      />
      <DotPlot rows={[{ id: "a", label: "A", value: share - 50 }]} domain={[-50, 50]} />
    </Explorable>
  )
}

render(<Figure />, document.body)
