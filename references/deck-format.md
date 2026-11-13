# The deck file

A deck is one HTML file. The stage is fixed at 1280 × 720 and scaled to fit any screen, so design in those pixels and nothing reflows on the projector.

## Skeleton

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Talk title</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="kit/deck.css">
<style>/* theme overrides and one-off styles for this talk */</style>
</head>
<body>
<div id="stage">

  <section class="slide cover" data-title="Talk title"> … </section>
  <section class="slide" data-section="Part one"> … </section>
  …

</div>

<script type="application/json" id="room">{ "title": "Talk title", "minutes": 20, "interactions": [], "takehome": {} }</script>
<script src="kit/qr.js"></script>
<script src="kit/charts.js"></script>
<script src="kit/deck.js"></script>
</body>
</html>
```

`scripts/new_deck.py` writes this for you. Order matters: `#stage`, then `#room`, then the three scripts.

## A slide

```html
<section class="slide" data-section="Pricing" data-phase="guess">
  <h2>The headline is a sentence that makes the point</h2>
  <p class="lead">One supporting line, if it needs one.</p>
  … content …
  <aside class="notes">
    ▶ The first sentence you will say on this slide.
    • Key point
    • Key point
    Anything else is detail to glance at if you get stuck.
  </aside>
</section>
```

### Slide attributes

| Attribute | Effect |
|---|---|
| `class="slide"` | Required. Add `cover`, `section`, `statement`, `night`, `full` for the special layouts in design.md |
| `data-section="Name"` | Starts a section. Section names form the small navigation line at the top; the current one is highlighted. Applies to following slides until the next `data-section` |
| `data-title="…"` | Title for the remote and Find, when the slide has no `h1`/`h2` or you want a shorter one |
| `data-phase="<id>"` | Puts interaction `<id>` on every phone while this slide is up. Also `wait` (waiting screen), `takehome` (the final links), `keep` (leave phones as they are) |
| `data-optional` | The remote offers "Safe to skip" for this slide when the speaker is behind |
| `data-appendix` | This slide and all after it are appendix: outside the page count and pace clock, reachable from the remote's Find tab |
| `data-skip-print` | Leave this slide out of the PDF |

### Speaker notes

`<aside class="notes">` inside the slide, plain text, one item per line:

- `▶` the opening line. Shown largest on the remote. Write it as speech, the way the speaker would say it.
- `•` key points, two to four.
- any other line: detail, a figure to quote, a reminder ("wait for the laugh").

Notes are never shown to the room. On the laptop, `N` toggles them. Every main slide should have them; `--check` warns when one does not.

## Click-reveals

Add `class="frag"` to anything. It is hidden until the speaker presses Next, in document order. Going back hides the last one again.

```html
<div class="card">Always visible</div>
<div class="card frag">Appears on the first press</div>
<div class="card frag">Appears on the second</div>
<p class="q frag">Then the question</p>
```

Use reveals to pace a point, to hold back an answer, or to bring chart series in one at a time (charts.md). Three or four per slide is the limit; a slide that needs more is two slides.

The remote shows "click 1 of 3" on the Next button so the speaker knows what is left.

### Hooks: run code on a reveal

An empty reveal with `data-go` calls a function instead of showing something:

```html
<i class="frag" data-go="reveal" data-for="guess"></i>   <!-- built in: reveal the right answer of a live result -->
<i class="frag" data-go="phase" data-to="takehome"></i>  <!-- built in: change what phones show (an interaction id, wait or takehome) -->
<i class="frag" data-go="zoom"></i>                        <!-- your own -->
<script>
  // after deck.js
  Deck.on('zoom', el => el.closest('.slide').classList.add('zoomed'),
                  el => el.closest('.slide').classList.remove('zoomed'));   // second function undoes it on Back
</script>
```

## Count-up numbers

```html
<b data-count="1284"></b>
<b data-count="4.5" data-decimals="1" data-suffix=" min"></b>
<b data-count="49" data-prefix="$"></b>
```

Counts up from zero when the slide (or its reveal) appears. Use on one or two headline figures, not every number.

## Pieces that talk to the room

Details in interactivity.md. The elements are:

| Element | Shows |
|---|---|
| `<div data-join></div>` | The join QR, the address and how many phones are connected |
| `<div class="corner-join" data-join></div>` | A small QR in the corner of a live slide for latecomers |
| `<div data-live="<id>"></div>` | Live results for interaction `<id>` |
| `<b data-online></b>` | Number of phones connected now |
| `<b data-answers="<id>"></b>` | Number of answers to `<id>` so far |

## Images, video, embeds

Put files in `assets/` and refer to them as `assets/name.png`. Do not hotlink: venue wifi fails.

```html
<figure class="fig"><img src="assets/screenshot.png" alt="…"><figcaption>What this shows</figcaption></figure>

<section class="slide full">                       <!-- a full-bleed picture with a caption -->
  <div class="bleed"><img src="assets/photo.jpg" alt=""></div>
  <div class="caption">One line over the picture</div>
</section>

<iframe data-src="https://example.com/demo" …></iframe>   <!-- loads only when its slide appears -->
```

A logo: `<img id="logo" src="assets/logo.svg" alt="">` as a direct child of `#stage` puts it top right on every slide.

## Keyboard (laptop)

| Key | Does |
|---|---|
| → Space PageDown Enter | Next (reveal, then slide) |
| ← PageUp Backspace | Back |
| Home / End | First / last slide |
| digits then Enter | Jump to that slide |
| N | Speaker notes |
| Q | Join QR over the current slide |
| B | Blank the screen |
| R | Restart the current slide's reveals |
| F | Full screen |
| ? | Help |

Standard clickers send PageDown/PageUp, so they work too.

## URL switches

| URL | Use |
|---|---|
| `deck.html` opened from disk | Design preview. Live slides show sample results and the join slide draws a stand-in QR, so every slide can be laid out before the server runs |
| `/deck?demo=1` | Sample results while served |
| `deck.html#7` | Start at slide 7 |
| `?all=1` | Still mode for screenshots: every click-reveal shown, animations off, count-up numbers at their final value. `scripts/shots.py` uses it |
| `?print=1` | All slides laid out one per page for PDF (`scripts/shots.py --pdf out.pdf`) |

## Script API

`window.Deck`: `slides`, `room`, `index`, `phase`, `results`, `next()`, `prev()`, `go(n)`, `restart()`, `toast(text)`, `on(name, fn, undoFn)`, `setPhase(id)`. `index` and `go(n)` count from 0, so `Deck.go(6)` is the slide numbered 7 on screen. Most talks never need it.
