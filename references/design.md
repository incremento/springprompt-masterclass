# Design: layouts, type, colour

The kit has one visual language: warm paper background, near-black ink, one accent colour, large tight headlines, white cards with a soft shadow. Use the classes below instead of inventing styles; a talk looks designed when every slide comes from the same small set.

## Rules that make slides work in a room

- **The headline is the point, as a sentence.** If people read only the headlines in order, they get the talk.
- **One idea per slide.** Two ideas are two slides; slides are free.
- **About 40 words on a slide, at most.** What the speaker will say goes in the notes, not on the slide.
- **Nothing smaller than 17px.** The back row is far away. Body text is 19 to 25px.
- **Left-aligned, top-anchored.** Content starts under the headline and uses the width. Do not centre paragraphs.
- **One accent.** The accent colour marks the thing to look at. If everything is highlighted, nothing is.
- **Plain words.** Write the way the speaker talks. No slogans, no "unlock", no three-word fragments with full stops.
- **Real things.** A screenshot, a quote from a named person, a number with its source beat an icon and an abstraction.
- **Every figure has a source line** (`<p class="source">`), or says it is an example.

## Slide types

```html
<!-- cover: the first slide -->
<section class="slide cover" data-title="Talk title">
  <div class="aura"><i></i><i></i><i></i></div>          <!-- slow drifting colour -->
  <h1>Talk title</h1>
  <p><b>Speaker name</b>Event, date</p>
</section>

<!-- section divider -->
<section class="slide section" data-section="Pricing">
  <div class="num">Part two</div>
  <h2>Pricing</h2>
  <p>One line on what this part answers.</p>
</section>

<!-- statement: one sentence, nothing else -->
<section class="slide statement">
  <h2>Most churn is decided in the <mark>first week</mark>.</h2>
  <p>Optional second line.</p>
</section>

<!-- ordinary slide -->
<section class="slide">
  <h2>Headline sentence</h2>
  <p class="lead">Supporting line.</p>
  …
</section>
```

Modifiers on any slide: `night` (dark background; cards, lists, charts and live results follow), `full` (no padding, for full-bleed media).

Use a statement slide for the one or two sentences people should remember; a night slide for a change of pace (a story, a quote, a demo); section slides only in talks over about 20 minutes.

## Type

| Markup | Looks like | Use for |
|---|---|---|
| `<h1>` (cover only) | 104px | The title |
| `<h2>` | 38px semi-bold | The headline of a slide. One or two lines |
| `<h3>` | 24px | Card and column titles |
| `<p class="lead">` | 21px grey | One line under the headline |
| `<p class="sm">` | 17px grey | Secondary text |
| `<p class="q">` | 27px accent | A question to the room, or the takeaway line. Add `pin` to fix it to the bottom |
| `<p class="source">` | 13px, bottom right | Where a figure came from |
| `<mark>` | accent underline | The two or three words that matter. `<mark class="bad">` in red |
| `<span class="pill">` | small capsule label | A tag above a headline or on a card. `warm`, `grey` variants |

## Building blocks

```html
<!-- columns of cards -->
<div class="cols c3">
  <div class="card"><span class="n">01</span><h3>Title</h3><p>Two lines at most.</p></div>
  <div class="card frag">…</div>
  <div class="card pick">…</div>                         <!-- pick: outlined in the accent -->
</div>
<!-- c2, c3, c4 · card variants: tall (title at the top, text at the bottom, at least 330px high;
     set style="min-height:380px" to fill a slide, 250px to share one with a chart), flat (no shadow), pick -->

<!-- two columns: text beside a chart, picture or live result -->
<div class="split">
  <div>…</div>
  <div>…</div>
</div>
<!-- split variants: narrow (400px + rest), wide (rest + 400px), mid (vertically centred) -->

<!-- big numbers -->
<div class="stats" style="--n:3">
  <div class="stat"><b class="accent" data-count="42" data-suffix="%"></b><span>of trials convert in week one</span></div>
  <div class="stat"><b>3.1×</b><span>more likely after a second login</span></div>
  <div class="stat"><b>$49</b><span>median first invoice</span></div>
</div>

<!-- bullet list: three or four items, each with an optional small second line -->
<ul class="list">
  <li>First point<small>The detail under it</small></li>
  <li class="frag">Second point</li>
</ul>

<!-- numbered steps -->
<ol class="steps">
  <li><div>Do this first<small>Why, or how long it takes</small></div></li>
  <li><div>Then this</div></li>
</ol>

<!-- a quote -->
<p class="quote">“We stopped guessing which version was better.”</p>
<p class="cite"><b>Name Surname</b>, role, company</p>

<!-- callout: the so-what under a chart or comparison -->
<div class="callout">The food changes less than the time given to it.</div>
<div class="callout warm">A caution.</div>

<!-- before and after -->
<div class="compare">
  <div><b>Before</b>The old way, in two or three lines.</div>
  <div class="after"><b>After</b>The new way. This side is outlined.</div>
</div>

<!-- a small table: at most five or six rows -->
<table class="t">
  <tr><th>Plan</th><th class="num">Price</th><th>For</th></tr>
  <tr><td>Starter</td><td class="num">$19</td><td>One person</td></tr>
  <tr class="pick"><td>Team</td><td class="num">$49</td><td>Up to ten</td></tr>
</table>

<!-- code or a prompt -->
<pre class="code"><span class="c"># a comment</span>
plain text, <em>a highlighted part</em>, <b>a keyword</b></pre>

<!-- picture with caption -->
<figure class="fig"><img src="assets/shot.png" alt="…"><figcaption>What it shows</figcaption></figure>
```

Charts (`<figure class="chart">`) are in charts.md. Live results (`data-live`) are in interactivity.md.

### Spacing

Blocks sit directly under the headline. Add `style="margin-top:24px"` (or up to 40px) on the first block when there is no `.lead`. Content should end above y = 690; the last 30px hold the progress bar and page number.

What fits on one slide, under a one-line headline and a lead:

| Block | Fits |
|---|---|
| `.cols.c3` of `.card.tall` | one row |
| `.cols.c4` cards | one row, short text |
| `.list` | 4 items with small lines, 6 without |
| `.steps` | 4 or 5 |
| `table.t` | 6 rows |
| `.stats` + a callout | yes |
| `.compare` + a callout | yes |
| a chart at the default size (1168 × 430) | yes, with a one-line lead; use `"h": 380` if there is also a callout |

## Theme

Change colours in one place, the room block, so slides and phones match:

```json
"theme": { "accent": "#2456A6", "soft": "#CFE0FA", "onDark": "#8DB4F0", "aura": ["#BFD6F8", "#5C87CC", "#F0C98A"] }
```

| Key | Is | Choosing it |
|---|---|---|
| `accent` | Headline marks, bars, buttons | The brand colour, if it is dark enough to read as text on the pale background (contrast 4.5:1 or more). Otherwise darken it |
| `soft` | Highlight behind `<mark>`, callouts | A pale tint of the accent |
| `onDark` | The accent on `night` slides | A lighter version of the accent |
| `aura` | The three drifting colours on the cover | Pale accent, mid accent, one warm contrast |

Anything else (background, ink, fonts) can be overridden in the deck's `<style>`:

```css
:root{ --bg:#FAF7F0; --paper:#F1ECE0; --panel:#fff; --line:#E2DCCD; --ink:#1C2420; --mute:#4A544F; --faint:#7A827D;
       --warm:#C9822B; --bad:#B4472F; --night:#1C2420; --radius:18px; --sans:Inter,system-ui,sans-serif; }
```

Keep the background pale and warm or pure white, and the ink near black.

Charts take the accent for the highlighted item and grey for the rest, so they follow the theme. The four colours used when a chart shows several named series (`--ch-s1` to `--ch-s4` in `kit/charts.js`) are fixed: they were checked as a set for colour-blind readers. Leave them unless the brand demands it, and re-check any replacement set with a colour-blindness simulator.

The font is Inter, shipped in `kit/`. To use a brand font, add the file to `assets/`, declare an `@font-face` in the deck's `<style>` and set `--sans`.

One-off styles for a single talk go in the deck's `<style>` block. Do not edit `kit/deck.css`: `new_deck.py --update-kit` replaces it.

## When a slide looks wrong

Look at the screenshot, then:

| You see | Do |
|---|---|
| Content runs off the bottom | Cut words first. Then split into two slides. Shrinking type is the last resort |
| Headline wraps to three lines | Rewrite it shorter. Two lines is the limit |
| The cover subtitle wraps | Shorten it to under about 60 characters, or move half to the second line (`<p><b>…</b>…</p>`) |
| A lot of empty space under the content | Make the content larger first: `--bar:72px` or more on a poll with four options, `--h:400px` on a histogram, chart `h` up to 500 with no lead line, a taller `min-height` on `card tall`. Then add the so-what: a `.callout` under a chart or stats row, or a `<p class="q pin">` at the foot of the slide (as a click-reveal if it is the punchline). If there is still nothing to add, make it a `statement` slide |
| A questions slide looks empty in the preview | It fills as questions arrive. Give the interaction four or five `sample` questions to judge the layout |
| Cards of different heights | `card tall`, or even out the text |
| A poll's bars look thin | `--bar:48px` on the `data-live` element |
| QR code is small | `--qr:360px` on the `data-join` element |
| A red box in a chart | Read it: it names the field that is wrong |
| Text over a picture is hard to read | Use `.caption` (it has a dark gradient) or put the text beside the picture in a `.split` |
| The slide is a wall of bullets | It is speaker notes. Move it there and put the one point on the slide |
