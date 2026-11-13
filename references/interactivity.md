# Live interactions

The room answers on their phones; the slide draws the result while they do. Everything is defined in one JSON block in the deck, and placed on slides with two attributes.

## Deciding what to make interactive

Go through the outline and look for these moments. You propose; the speaker edits.

| The talk has… | Make it | Type |
|---|---|---|
| The first two minutes | A warm-up with no wrong answer. Gets phones out, proves it works | `choice` |
| A number that will surprise people | Ask them to guess it first, then reveal the real figure | `scale` + `answer` |
| "Which of these do you think won?" | Vote, then mark the right one | `choice` + `correct` |
| A claim about the audience ("most of you…") | Ask instead of assuming, and react to the answer | `choice` |
| "What is your biggest problem with X?" where you can list the answers | Let them tick all that apply | `choice` + `multi` |
| …where you cannot list the answers | A word wall | `words` |
| A set of examples to react to (ideas, designs, headlines, outputs) | One card at a time, yes or no | `swipe` |
| A decision the room can make (which example to dig into, which topic next) | Vote and follow the winner. Write notes for each branch | `choice` |
| Questions | Open all the way through, shown on a slide near the end | `questions` + `always` |
| The end | Links and copy-and-paste text on every phone | `takehome` |

**How many.** One every five to eight minutes. A 10 minute talk: warm-up, one guess or vote, questions. A 45 minute session: five or six. Each takes 60 to 90 seconds of talk time: say the question, wait, read out what came in.

**What makes a good live question**

- Answerable in under ten seconds, with a thumb. Short options (under about 40 characters).
- The speaker does something with the result: names the leader, compares it to the real figure, picks the next example.
- No answer embarrasses the person giving it. Results are anonymous but people still hesitate.
- For a guess: pick a range where the real answer is not at an edge, and a step that gives 20 to 60 positions.

**When not to**

- The result would not change a word of what is said next, and is not surprising.
- Sensitive topics in a room of colleagues.
- Two in a row. Give people a few slides of listening between.
- A tiny room (under about eight): just ask out loud. The remote can type in a show of hands (Live tab, the ± buttons).

Write speaker notes for a live slide as stage directions: say the question, what to do while answers arrive, what to say for each likely result.

## The room block

One per deck, after `#stage`:

```html
<script type="application/json" id="room">
{
  "title": "Talk title",
  "minutes": 20,
  "theme": { "accent": "#3E7A4F", "soft": "#C4E8A4" },
  "interactions": [
    { "id": "warmup", "type": "choice", "prompt": "…", "options": ["…", "…"] }
  ],
  "takehome": { "title": "Thank you", "text": "…", "links": [{ "label": "…", "url": "https://…" }] }
}
</script>
```

Strict JSON: double quotes, no trailing commas, no comments. `python3 kit/server.py --check` validates it and checks every slide refers to ids that exist.

| Field | Meaning |
|---|---|
| `title` | Shown on phones and the remote |
| `minutes` | Planned length. The remote's pace badge compares slide progress with the clock |
| `theme` | Optional `accent`, `soft`, `onDark`, `aura` (three colours). Colours the slides and the phones together. See design.md |
| `joinTitle` | Heading next to the QR (default "Join in on your phone") |
| `joinUrl` | Only for a deck opened without the server that should still show a QR to a fixed address |
| `interactions` | The list below. `id`: lowercase letters, digits, `-`, `_`. Not `wait`, `takehome` or `keep` |
| `takehome` | The final screen on phones |

The server re-reads the block whenever the file is saved, so you can edit a question while the room is running.

### choice

```json
{ "id": "morning", "type": "choice", "prompt": "What did you have this morning?",
  "options": ["Cereal or porridge", "Toast or a pastry", "Eggs or something cooked", "Only coffee"],
  "none": "Nothing yet" }
```

| Field | |
|---|---|
| `options` | 2 to 8 strings |
| `multi` | `true`: tick all that apply |
| `none` | Label for a "none of these" answer |
| `correct` | Index (from 0) of the right option. Kept off the phones; marked on the slide when revealed |
| `reasons`, `reasonsPrompt` | Optional follow-up chips after voting ("Why?"). Show their tally with `data-reasons` on the result |
| `images` | List of image paths, one per option, shown on the phone |

### scale

```json
{ "id": "eggs", "type": "scale", "prompt": "How many eggs does one hen lay in a year?",
  "min": 0, "max": 600, "step": 10, "start": 100, "answer": 300, "answerLabel": "A modern laying hen: about" }
```

| Field | |
|---|---|
| `min`, `max`, `step` | The slider. Default 0 to 100 by 1 |
| `start` | Where the slider thumb begins. Put it away from the real answer |
| `unit`, `prefix` | `"unit": "%"`, `"prefix": "$"` |
| `answer`, `answerLabel` | The real figure and its label. Kept off the phones; drawn on the histogram when revealed |

The slide shows a histogram with the room's median. Use it for opinion scales too ("how confident are you, 1 to 10"); leave out `answer`.

### words

```json
{ "id": "weekend", "type": "words", "prompt": "One word for your ideal weekend breakfast", "max": 2 }
```

`max` words per person (default 3), `maxlen` characters each (default 24). Words several people send grow. The speaker can hide a word from the remote.

### swipe

```json
{ "id": "odd", "type": "swipe", "prompt": "Would you eat it for breakfast?", "yes": "Yes", "no": "No",
  "cards": [ { "title": "Cold pizza", "text": "From the night before." }, { "title": "Soup", "text": "…", "image": "assets/soup.jpg" } ] }
```

Phones show one card at a time; swipe right or left (or tap the buttons). The slide ranks the cards by share of yes. Four to eight cards.

### questions

```json
{ "id": "qa", "type": "questions", "prompt": "Ask a question", "always": true }
```

People type questions and upvote each other's. `"always": true` keeps a small "ask a question" box on the waiting screen for the whole talk, so questions collect before the Q&A slide. Identical questions merge into one with more votes. The speaker moderates from the remote: show one large on screen, mark answered, hide.

### takehome

```json
"takehome": {
  "title": "Thank you",
  "text": "Everything from the talk, to keep.",
  "links": [ { "label": "The slides", "url": "https://…" }, { "label": "Book a call", "url": "https://…" } ],
  "copy": [ { "label": "The prompt from slide 9", "text": "…" } ],
  "share": true
}
```

`links` open in the browser, `copy` blocks have a Copy button, `share: true` adds a button that shares the page. It stays on phones after the talk.

### Sample results for design

Opened from disk, or with `?demo=1`, live slides draw made-up results so you can lay them out. For `words` and `questions` give `"sample": ["…", "…"]` so the preview looks like your talk. `sample` is never sent to phones.

## Putting it on slides

```html
<!-- join slide, near the start -->
<section class="slide">
  <h2>Get your phone out</h2>
  <p class="lead">You will vote and ask questions from it. Nothing to install.</p>
  <div data-join style="--qr:360px;margin-top:8px"></div>
</section>

<!-- ask and show on the same slide -->
<section class="slide" data-phase="morning">
  <h2>What did you have this morning?</h2>
  <div class="corner-join" data-join></div>
  <div data-live="morning" style="margin-top:40px;max-width:1000px;--bar:48px"></div>
</section>

<!-- guess, then reveal -->
<section class="slide" data-phase="eggs">
  <h2>How many eggs does one hen lay in a year?</h2>
  <p class="lead">Guess on your phone. No looking it up.</p>
  <div data-live="eggs" style="--h:330px"></div>
  <i class="frag" data-go="reveal" data-for="eggs"></i>
</section>
```

- `data-join` shows the real code when the slides are opened through the server with the admin link. Opened from disk it draws a stand-in code so you can size it.
- `data-phase="<id>"` on the slide opens the question on phones.
- `data-live="<id>"` draws the results. The slide's `h2` is the question; the widget does not repeat it.
- The reveal line is a click-reveal: the next press of Next marks the right option or draws the real figure.

### What phones show as slides change

- A slide with `data-phase` sets it.
- A slide with no `data-phase` that shows `data-live` for the open question keeps it open (so a second slide can discuss the same result).
- Any other slide sends phones back to the waiting screen.
- `data-phase="keep"` leaves phones as they are; use it to keep voting open across a slide.
- `data-phase="takehome"` stays until the deck goes back to slide 1.

People can change their answer while a question is open. Each phone counts once.

### Options on a result

| On the `data-live` element | Effect |
|---|---|
| `style="--bar:48px"` | Bar thickness (choice, swipe). Default 36px. Use 42 to 56 on a slide with little else |
| `style="--h:330px"` | Height of a histogram or word wall |
| `style="--labw:300px"` | Width of the label column for long options |
| `data-sort="votes"` | Choice: order bars by votes (default: the order you wrote them) |
| `data-sort="given"` | Swipe: keep your card order (default: ranked by yes) |
| `data-top="5"` | Show only the top N (bars, words, questions) |
| `data-show="count"` | Counts instead of percentages |
| `data-reasons` | Also show the tally of `reasons` chips |
| `data-bins="12"` | Histogram bars for a scale (default up to 20) |
| `data-bare` | No "32 answers" line above |

Sizing: four options at `--bar:48px` fill a slide under a one-line headline; eight options need the default 36px and no lead paragraph. A histogram or word wall wants `--h` of 300 to 360 with a headline and one line above it.

### Patterns

**Guess, reveal, explain.** Slide 1: scale with reveal. Slide 2: the chart or story behind the real figure.

**Vote, then follow the room.** A `choice` across examples; the next slides are the examples as appendix-style slides. Notes on the vote slide say which slide number to jump to for each winner (digits + Enter on the laptop, or Find on the remote).

**Before and after.** Ask the same scale question near the start and near the end, as two interactions (`before`, `after`). Put both results side by side on the later slide: `<div class="split"><div data-live="before" data-bare></div><div data-live="after" data-bare></div></div>` with `data-phase="after"`.

**Same result, two slides.** First slide has `data-phase` and the bars. The next slide repeats `data-live` in a `.split` beside your commentary; phones stay open.

**Questions, then the links, on one slide.** The slide has `data-phase="qa"` and shows the questions. A last reveal, `<i class="frag" data-go="phase" data-to="takehome"></i>`, sends the take-home screen when the speaker presses Next after the final question.

**Join and answer at once.** Put `data-phase="<id>"` on the join slide: the first question is waiting on each phone as soon as it connects. The next slide shows the result.

**Count in the headline.** `<b data-answers="morning"></b> of you answered`, or `<b data-online></b> phones in the room`.
