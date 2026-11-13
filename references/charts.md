# Charts

Read this before you put a chart on a slide. `kit/charts.js` draws every chart in the deck from a
JSON config. It has no dependencies and makes no network calls.

```html
<figure class="chart"><script type="application/json">
{"type":"hbar","highlight":"Sourdough","alt":"Loaves sold a week; sourdough leads with 412",
 "data":[{"label":"Sourdough","value":412},{"label":"White tin","value":205},{"label":"Rye","value":131}]}
</script></figure>
```

Load `charts.js` before `deck.js`. Every chart type is on show in `examples/charts.html`; open it
and copy the nearest slide. A bad config draws a red "Chart error" box that names the fix, so
nothing fails silently.

## 1. Pick the form

Write the finding as the slide's `<h2>` first ("Sourdough outsells the next loaf two to one"). The
chart is the evidence for that sentence. If you cannot write the sentence, you do not need a chart.

| The finding is about | Use | Notes |
|---|---|---|
| One number | `stat` | A stat tile, not a chart. One bar on its own is never a chart. |
| Two to four headline numbers | `stat` | Tiles, each with an optional delta or sparkline. |
| A share people can picture ("1 in 4") | `dots` | Counted units. Use a `stat` if the share is not the story. |
| Ranking named things | `hbar` | Sorted for you. The default for comparing categories. |
| A few categories with a natural order (days, months) | `bar` | Vertical. Up to about 12 bars. |
| How one whole splits | `segmented` | One horizontal bar. This replaces the pie. |
| How one measure is spread | `histogram` | Raw values or ready-made bins. |
| Change over time | `line` | One to four series, or one highlighted among grey. |
| Before and after, several items | `slope` | The direction of each line is the story. |
| The gap between two values, per row | `dumbbell` | When the size of the gap matters more than the direction. |
| Order changing over time | `rank` | When position matters and amounts do not. |
| Events in sequence | `timeline` | Four to seven dated events. |
| How two measures relate | `scatter` | Add a trend line, a region, quadrants or a frontier. |
| Two categories and one number | `heatmap` | Day by hour, product by region. |

If two forms fit, take the simpler one. If the data is three numbers, say them in a sentence.

## 2. The emphasis rule

One accent colour, grey for everything else. Name the item the headline is about in `highlight`
and it turns green while the rest turn grey. Every type takes `highlight` (a label, or a list of
labels; for `histogram`, a value, whose bin is marked; for `heatmap`, a row, a column or
`"row|col"` for a cell).

With no `highlight`, `line`, `slope`, `rank` and `segmented` give each item its own colour, up to
four, and every other type draws all its marks in the accent colour. With five or
more they stop with an error: set `highlight`, or cut to four. Text is never coloured; a coloured
mark beside the label carries identity.

## 3. Options every type takes

| Key | Meaning |
|---|---|
| `type` | Required. One of the 13 types above. |
| `w`, `h` | Size of the drawing in slide pixels. Default 1168 × 430. See Sizing. |
| `highlight` | The item or items that wear the accent. |
| `reveal` | Click-to-reveal staging. See Staging. |
| `prefix`, `suffix`, `decimals`, `compact` | Number formatting. See Numbers. |
| `source`, `note` | One small grey line under the chart. |
| `alt` | A sentence for screen readers. Always write it; say the finding, not "bar chart". |

There is no title option. The slide's `<h2>` is the title.

## 4. Config for each type

**stat** — big numbers, drawn as HTML tiles. `data` holds one to four tiles.
Per tile: `value`, `label`, `prefix`, `suffix`, `decimals`, `delta` (with `deltaSuffix`,
`deltaDecimals`, `deltaLabel`), `good` (`"up"` or `"down"`: which direction is welcome, which sets
the arrow colour), `trend` (an array, drawn as a sparkline). One tile becomes a hero number;
`"hero":false` stops that. Numbers count up when the slide appears.
```json
{"type":"stat","data":[{"value":26,"suffix":"%","label":"of commuters now cycle","delta":8,"deltaSuffix":" pts","deltaLabel":"since 2019","good":"up"}]}
```

**dots** — a grid of counted units. `value`, `total` (default 100, at most 1000), `label`, `rest`
(name for the remainder), `cols`. For more than one group use `data` instead of `value`.
```json
{"type":"dots","value":26,"total":100,"label":"cycle to work","rest":"travel another way"}
```

**hbar** — ranked horizontal bars with the value at the tip. `data` rows are `{label, value}`.
`sort`: descending by default, `"asc"`, or `false` to keep your order. `ref` draws a reference
line: `{"value":150,"label":"Target 150"}`. `max` fixes the axis. No negative values.
```json
{"type":"hbar","highlight":"Rye","data":[{"label":"Sourdough","value":412},{"label":"Rye","value":131}]}
```

**bar** — vertical bars, in the order given. `data` rows are `{label, value}`. Values print above
each bar; `"values":false` swaps them for a y axis with gridlines (use that past 12 bars). `ref`,
`yLabel`, `max` as for `hbar`. Negative values are allowed.
```json
{"type":"bar","prefix":"£","highlight":"Sat","data":[{"label":"Fri","value":890},{"label":"Sat","value":1460}]}
```

**segmented** — one whole as a single horizontal bar. `data` rows are `{label, value}`, at most
eight parts and at most four colours (highlight one for more). Prints percentages; `"show":"value"`
prints the values. The figures sit on the segments when every one fits; if any segment is too
narrow they all move to the key. Its height fits itself, so leave `h` out.
```json
{"type":"segmented","data":[{"label":"Ingredients","value":85},{"label":"Staff","value":120},{"label":"Rent","value":95}]}
```

**histogram** — how values are spread. Either raw `values` (binned for you; steer with `bins` or
`step`) or `data` rows of `{from, to, count}`. `highlight` takes a value and marks its bin. `ref`
marks a median or a threshold. `xLabel`, `yLabel`, `countSuffix`, `max`.
```json
{"type":"histogram","step":5,"xLabel":"Minutes door to door","values":[12,18,22,24,27,29,31,33,38,44,52,67]}
```

**line** — change over time. `x` is the list of labels; each of `series` is `{name, values}` with
one value per label (`null` leaves a gap). Each line is named at its right end with its last value:
`"endValues":false` drops the value, `"endLabels":false` drops both. The y axis fits the data;
`"zero":true` starts it at zero, `min` and `max` fix it. `"area":true` fills under a single series
and forces a zero baseline. `yLabel`, `ref`. `annotations` mark single points:
`{"x":"2022","series":"Rye","text":"New oven","side":"above"}` (`series` and `side` are optional).
```json
{"type":"line","x":["2021","2022","2023"],"series":[{"name":"Rye","values":[96,131,183]}]}
```

**slope** — two moments, one line per item. `data` rows are `{label, from, to}`; `labels` names
the two columns. `names`: `"right"` (default), `"left"` or `"both"`. `min`, `max`.
```json
{"type":"slope","labels":["2019","2025"],"suffix":" min","highlight":"Bike","data":[{"label":"Bike","from":34,"to":26},{"label":"Bus","from":38,"to":41}]}
```

**dumbbell** — the gap between two values per row. `data` rows are `{label, from, to}`; `labels`
names the hollow dot and the solid dot. `"sort":"gap"` orders rows by the gap. Both values print by
default; `"values":false` swaps them for an axis. `min`, `max`, `zero`.
```json
{"type":"dumbbell","labels":["Weeknight","Weekend"],"suffix":" h","decimals":1,"data":[{"label":"Teenagers","from":6.9,"to":9.3},{"label":"Retired","from":7.6,"to":7.8}]}
```

**rank** — position over time (a bump chart). `x` is the list of labels; each of `series` is
`{name, ranks}`, where 1 is top. Almost always wants a `highlight`.
```json
{"type":"rank","highlight":"Oat","x":["2021","2023","2025"],"series":[{"name":"Whole","ranks":[1,1,2]},{"name":"Oat","ranks":[3,2,1]},{"name":"Soya","ranks":[2,3,3]}]}
```

**timeline** — dated events on one axis, spaced by real time. `data` rows are
`{date, label, note, when}`. `date` is a year, `"YYYY-MM"` or `"YYYY-MM-DD"`; `when` overrides the
printed date. `"spacing":"even"` spaces events evenly and accepts any text as the date.
`labelWidth` (default 190) sets where labels wrap. Its height fits itself, so leave `h` out.
```json
{"type":"timeline","highlight":"Second shop","data":[{"date":"2016-05","label":"Market stall"},{"date":"2018-09","label":"First shop"},{"date":"2025-03","label":"Second shop"}]}
```

**scatter** — two measures per point. `data` rows are `{x, y, label}`; `label` is optional.
`xAxis` and `yAxis` take `{label, prefix, suffix, decimals, min, max, zero, log}`. Only highlighted
points are named unless `"labels":"all"` (fine up to about 15 points) or `"labels":"none"`.
One helper per chart is plenty:
- `"trend":true` or `{"label":"…"}` draws a fitted straight line.
- `regions`: `[{"x":[45,80],"y":[5.5,7],"label":"Long commute, short night"}]` shades a box. Leave
  out `x` or `y` to span the whole axis.
- `quadrants`: `{"x":55,"y":1.8,"labels":["Top left","Top right","Bottom left","Bottom right"]}`.
- `frontier`: `"top-left"`, `"top-right"`, `"bottom-left"` or `"bottom-right"` (the corner where
  the best points sit), or `{"corner":"bottom-left","label":"Lightest for the money"}`.
```json
{"type":"scatter","trend":true,"xAxis":{"label":"Commute, minutes"},"yAxis":{"label":"Sleep, hours"},"data":[{"x":10,"y":7.6},{"x":35,"y":7.0},{"x":66,"y":6.0}]}
```

**heatmap** — two categories and one number, darker for more. `rows` and `cols` are label lists;
`values` holds one array per row. `"cells":true` prints every number (only when there are few
cells). `highlight` outlines a row, a column or a `"row|col"` cell and prints its value.
`scaleLabel` names the key. `min`, `max`.
```json
{"type":"heatmap","rows":["Fri","Sat"],"cols":["8am","11am","2pm"],"values":[[82,34,29],[31,88,52]],"highlight":"Sat|11am","scaleLabel":"Customers an hour"}
```

## 5. Sizing

The stage is 1280 × 720 and the content column is 1168 wide. `w` and `h` are slide pixels: text
inside the chart is the size it will be on screen, and a chart drawn at `w` 1168 fills the column.

| Where | `w` | `h` |
|---|---|---|
| Full width, under an `<h2>` and one lead line | 1168 (default) | 430 (default) |
| Full width, under an `<h2>` only | 1168 | up to 500 |
| Full width with a line of text below it | 1168 | 380 to 400 |
| One column of a `.split` | 566 | 380 to 420 |
| `segmented`, `timeline` | 1168 or 566 | leave out |

Always set `w` to the width of the box the chart sits in. A full-width chart squeezed into a
half-width column shrinks its text to half size. At 566 wide, keep to about seven bars, six rows or
two series, and short labels. `stat` ignores `w` and `h`.

## 6. Staging

`reveal` turns parts of the chart into click-to-reveal steps. They take their turn with any other
`.frag` on the slide, in page order. In print and PDF everything shows.

| `reveal` | What happens |
|---|---|
| `"items"` | One press per bar, row, line, part, tile or event, in the order of your data, so list the one that matters last. Axes and category labels are there from the start. `"rows"`, `"bars"`, `"points"` and `"series"` mean the same. In a `scatter` with a `highlight`, the grey points are there from the start and only the highlighted ones are staged. |
| `"highlight"` | Everything starts grey; one press turns the highlighted item green. Use it for "guess first". Needs `highlight`. |
| `"notes"` | The data shows; annotations, reference lines, trend lines, regions and frontiers arrive on a press. |

In the other two modes the notes still arrive on their own presses, after the data. `heatmap` is
not staged.
More than about five presses on one chart is slow; stage the highlight instead.

## 7. Numbers

- `prefix` and `suffix` wrap every value: `"prefix":"£"`, `"suffix":"%"`, `"suffix":" min"` (put
  the space in the suffix).
- `decimals` fixes the decimal places. Left out, whole numbers print whole and others to one place.
- Thousands separators are automatic: 1,460.
- `"compact":true` shortens big numbers: 12.5K, 3M.
- Round before you chart. £1,460 on a slide, not £1,459.63.
- `scatter` formats each axis separately, inside `xAxis` and `yAxis`.

## 8. What not to do

- **Pie or donut.** There is no such type. Use `segmented`, or `hbar` when the parts need ranking.
- **Two y axes.** Not supported. Draw two charts side by side in a `.split`, or index both
  measures to a common start.
- **More than four coloured series.** Highlight one and let the rest go grey, or split the chart.
- **A number on every point.** Lines carry end values only. Annotate the one point that matters.
- **Identity by legend alone.** Lines and bars are labelled directly. Do not add a colour key in
  the slide text and expect the room to match colours from the back row.
- **A chart with no finding.** If the headline would be "Sales by month", find the sentence or
  cut the slide.
- **A chart for one number.** That is a `stat`.
- **A second chart to fill space.** One chart per slide; two only when the comparison between
  them is the finding.
- **Long category labels.** Shorten them in the data. The chart will not shrink text to fit.
- **A truncated bar axis.** Bars start at zero. If the differences are too small to see from
  zero, show the difference itself, or use `dumbbell` or `line`.
- **Hover as the only way to read a value.** Hover works on screen for the presenter. The room
  and the PDF never see it.

## 9. Before you ship a chart slide

1. The `<h2>` states the finding, and the chart shows it without explanation.
2. The form matches the job in the table in section 1.
3. `highlight` names what the headline is about, or every mark is the same colour.
4. `w` matches the box: 1168 full width, 566 in a split column.
5. Values carry their unit, are rounded, and `alt` says the finding in a sentence.
6. Nothing overlaps, nothing is cut off, and no error box is showing.
7. The staged order matches the order you will say it in.
8. Render it and look at it: open the deck, go to the slide, press through every step, then check
   the same slide with `?print=1`.
