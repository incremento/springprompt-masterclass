# springprompt-masterclass

An agent skill that builds and runs an interactive presentation: slides in one HTML file, live voting from the audience's phones, and a phone remote for the speaker.

Give it a PowerPoint, a Google Slides export, or just what you want to say. It interviews you, proposes an outline, decides which moments the room should answer, builds the deck, checks every slide by looking at it, and hosts it so people can join from a QR code.

Made by [Spring Prompt](https://springprompt.com) after a talk where people asked how the slides worked.

## What you get

**Slides.** A fixed 1280 × 720 stage that scales to any projector. Cover, section, statement and dark slides; cards, columns, steps, stats, quotes, tables, before-and-after, code. Click-reveals, count-up numbers, speaker notes, an appendix, PDF export.

**Charts.** Thirteen types written as a small JSON block: big-number tiles, dot plot, bars, segmented bar, histogram, line, slope, dumbbell, rank, timeline, scatter, heatmap. Series can come in one press at a time. They follow the deck's theme and have a palette checked for colour-blind readers.

**The room.** People scan a code and answer on their phones with nothing to install. Results draw on the slide as they arrive.

| Type | What people do | What the slide shows |
|---|---|---|
| `choice` | Pick one, or tick several | Bars, with the right answer marked on reveal |
| `scale` | Drag a slider to guess a number | A histogram, the room's median, then the real figure |
| `words` | Send a word or two | A word wall |
| `swipe` | Yes or no on a set of cards | The cards ranked |
| `questions` | Ask and upvote, all the way through | The top questions |
| take-home | — | Links and copy-and-paste text on every phone at the end |

**The remote.** The speaker's phone: next and back with a preview of the slide, speaker notes, a pace clock against the planned length, skip, tap to highlight something on the big screen, laser dot, live counts, question moderation, search across every slide, blank the screen, start a new session.

**Hosting.** One Python file with no dependencies. Run it on the laptop for a room on the same wifi, add `--tunnel` for a public link with no account, or deploy the folder to Railway or any Docker host.

## Install

With the [skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add incremento/springprompt-masterclass -g -a claude-code
```

Or by hand, for Claude Code:

```bash
git clone https://github.com/incremento/springprompt-masterclass ~/.claude/skills/springprompt-masterclass
```

Then ask for a talk:

> Make me a 15 minute talk on why our onboarding emails are not working. Interview me first.

> Turn quarterly-review.pptx into an interactive deck and host it so the team can vote.

## Any other agent

Clone the repo anywhere, then paste this, with the path filled in:

```text
Read /path/to/springprompt-masterclass/SKILL.md and follow it to build my presentation.
Start by asking me what the talk is about, who it is for and how long it is.
If I give you an existing deck, import it instead of starting from nothing.
Choose which moments should be live audience questions and tell me which you chose.
Look at a screenshot of every slide and fix what looks wrong before you show me.
When the deck is ready, start the room and give me the links for the slides, my phone remote and the audience.
```

Any agent that can read files and run Python can use the skill. `agents/openai.yaml` carries the display name for Codex.

## Try it without an agent

```bash
git clone https://github.com/incremento/springprompt-masterclass
cd springprompt-masterclass
python3 kit/server.py --deck examples/pitch.html
```

Open the "Start here" link it prints. `examples/pitch.html` is a ten-slide pitch for an invented company; `examples/demo.html` shows every live feature; `examples/charts.html` shows every chart.

To fill the room with pretend phones:

```bash
python3 scripts/simulate.py "<the Audience link>" --phones 60 --seconds 120
```

## Requirements

- Python 3.8 or newer. The server uses only the standard library.
- Chrome, Chromium or Edge for screenshots and PDF export.
- Optional: `python-pptx` to import a `.pptx`, `cloudflared` for `--tunnel`, the Railway CLI to deploy.

Phones need a modern browser and nothing else.

## What is in the repo

```
SKILL.md        the instructions an agent follows
references/     intake · deck-format · design · interactivity · charts · presenting · hosting
kit/            the slides (deck.css, deck.js, charts.js) and the room (server.py, audience, remote, set-up)
scripts/        new_deck.py · shots.py · extract_pptx.py · simulate.py
examples/       pitch.html · demo.html · charts.html
evals/          test prompts for the skill
```

## Privacy and security

- The room has no accounts and stores no names. Each phone keeps a random id in its browser so it counts once.
- Answers stay on the machine that runs the server, in a `.room/` folder, until you start a new session or delete it.
- Two keys: the room key in the join QR only lets a phone answer; the admin key opens the slides and the remote. Anyone with the admin link controls the talk, so treat it as a password.
- Nothing loads from a CDN. Fonts, QR codes and charts are all in `kit/`, so a deck works on poor venue wifi.

## Limits

- One server instance per talk. It has been run with 200 simulated phones on a laptop and 40 on the smallest Railway instance; test bigger rooms with `scripts/simulate.py` first.
- Built and tested in Chrome, at laptop and phone sizes. Safari and Firefox are not yet tested by us; please report what you find. PDF export needs a Chromium browser.
- Imports read text, tables, chart data, notes and pictures from `.pptx`. Animations, embedded video and exact layouts are not carried over: the deck is rebuilt in this kit's layouts.

## Credits

- QR codes: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase, MIT licence (`kit/qr.js`).
- Typeface: [Inter](https://rsms.me/inter/) by Rasmus Andersson, SIL Open Font Licence 1.1 (`kit/inter.woff2`).

Everything else is MIT licensed. See [LICENSE](LICENSE).
