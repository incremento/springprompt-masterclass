---
name: springprompt-masterclass
description: Build and run an interactive presentation as one HTML file - clean slides and charts, live audience voting from phones (polls, number guesses, word walls, swipe cards, Q&A) drawn on the slides as answers arrive, a phone remote with speaker notes, and one-command hosting (same wifi, a public tunnel, or Railway). Use when someone asks for a presentation, talk, deck, pitch, keynote, lecture, workshop or masterclass; wants live polls, audience participation or a clicker; wants to convert a PowerPoint, Google Slides or Keynote deck; or says "make my slides interactive".
license: MIT
compatibility: Needs Python 3.8+ (standard library only) to run the room. Chrome, Chromium or Edge for screenshots and PDF. Optional - python-pptx to import a .pptx, cloudflared for a public link without an account, the Railway CLI to deploy.
metadata:
  author: Spring Prompt
  version: "1.0.0"
  homepage: https://github.com/incremento/springprompt-masterclass
---

# Masterclass decks

You are building a talk the speaker will give to a room. The slides are one HTML file. A small server next to it lets the audience answer from their phones and lets the speaker drive everything from their own phone.

The finished thing has three screens:

| Screen | Who | What it does |
|---|---|---|
| **Slides** `/deck` | the laptop on the projector | The talk. Live results draw on the slide while people answer. |
| **Audience** `/` | everyone's phone, from a QR code | Shows the current question. Nothing to install, no sign-up. |
| **Remote** `/remote` | the speaker's phone | Next/back, notes, pace clock, live counts, question moderation, highlight and laser. |

`SKILL_DIR` below means the folder this file is in.

## The steps

Work through these in order. Do not skip 5: a deck that has not been looked at is not finished.

### 1. Find out what the talk is

Two starting points. Details for both are in `references/intake.md`.

- **They have a deck already** (PowerPoint, Google Slides, Keynote, PDF). Import it with `scripts/extract_pptx.py`, read the outline, then ask the short list of questions the file cannot answer.
- **They are starting from thoughts.** Interview them. Ask a few questions at a time, in plain language, and stop as soon as you can write the outline. If they say "just make something", make sensible assumptions, state them, and carry on.

Either way you need, before building: who is in the room, what they should do or believe afterwards, how many minutes, the three to five points, any numbers or stories, what to ask the room, what people take home, and where the talk will be given (which decides hosting).

### 2. Agree an outline

Write the outline as a table and show it to the speaker before you build:

| # | Slide says (a full sentence) | Layout | Live or chart | Min |
|---|---|---|---|---|

Rules of thumb:

- About one main slide per minute. A ten minute talk is 8 to 12 slides.
- The headline of every slide is a sentence that makes the point, not a label. "Churn doubled after the price change", not "Churn".
- Choose what to make interactive yourself, then let the speaker change it. See "Choosing what the room does" below.
- Every number worth showing gets the simplest chart that carries it, and often that is one large figure. See `references/charts.md`.
- Extra material goes in an appendix (after the last main slide) where the remote's Find tab can reach it.

### 3. Create the talk folder

```bash
python3 SKILL_DIR/scripts/new_deck.py <folder> --title "<Talk title>"
```

This creates `<folder>/deck.html` (a working five-slide starter), `kit/` (styles, scripts, server), `assets/` (images) and a `Dockerfile`. The folder is self-contained. Put it where the speaker keeps their work, not in a temp folder.

### 4. Write the deck

Edit `deck.html`. Leave `kit/` alone.

- Structure, attributes, speaker notes, click-reveals: `references/deck-format.md`
- Layouts, type, colour, theme, images: `references/design.md`
- Live questions and the `#room` block: `references/interactivity.md`
- Charts: `references/charts.md`
- Worked examples to copy from: `examples/pitch.html` (a complete ten-slide pitch: guess and reveal, charts, a vote, questions, take-home), `examples/demo.html` (every live feature) and `examples/charts.html` (every chart; one slide near the end is a deliberate mistake to show what a chart error looks like)

Every slide gets speaker notes: the first sentence to say (a line starting `▶`), then two or three key points (lines starting `•`). The remote shows them large.

### 5. Check it, look at it, fix it

```bash
cd <folder>
python3 kit/server.py --check                      # mistakes in the deck and the #room block
python3 SKILL_DIR/scripts/shots.py deck.html       # shots/01.png … one image per slide
```

Open every image. Fix anything that overflows the slide, collides, wraps badly, sits alone in a sea of empty space, or shows a red chart error. Then run it again. Expect two or three rounds: the first draft of a deck nearly always has a few half-empty slides. Typical fixes are in `references/design.md` under "When a slide looks wrong".

The screenshots show sample results on live slides and a stand-in join code. That is expected; the real ones appear when the deck runs through the server.

### 6. Run it and host it

Ask where the talk happens, then pick one. Full instructions: `references/hosting.md`.

| Situation | Command |
|---|---|
| Rehearsing alone, or everyone on one trusted wifi | `python3 kit/server.py` |
| Any room, right now, no account | `python3 kit/server.py --tunnel` |
| A fixed address that survives a laptop restart | deploy the folder to Railway (or any Docker host) |

The server prints four links. Give the speaker the **Start here** link: it is a set-up page with the slides, the remote QR and the audience QR.

### 7. Rehearse with a full room

```bash
python3 SKILL_DIR/scripts/simulate.py "<audience link>" --phones 60 --seconds 120
```

Pretend phones join and answer while the speaker steps through the talk with the remote. Then clear the test answers (remote: More, New session) and hand over the checklist in `references/presenting.md`.

## Choosing what the room does

The speaker asked for interactivity, or did not say. Either way, propose it; do not wait to be told which slides. Read `references/interactivity.md` before deciding. In short:

- **Open with a warm-up in the first two minutes**: an easy choice with no wrong answer. It gets phones out and proves the system works.
- **Ask before you tell.** Wherever the talk reveals a surprising number, let the room guess it first (`scale`), then reveal the real one. Wherever it reveals which option won, let them vote first (`choice` with `correct`).
- **Collect what you would otherwise assume**: "what is slowing you down?" (`choice`, `multi`), "one word for…" (`words`), quick reactions to a set of examples (`swipe`).
- **Keep questions open all the way through** (`questions` with `"always": true`) and end on a Q&A slide.
- **One interaction every five to eight minutes** is plenty. Each costs 60 to 90 seconds of talk time. Two in a row is tiring; none for fifteen minutes and phones go away.
- Do not poll for what you already know, or ask something whose result will not change what you say next.
- Finish with a take-home screen: links and copy-and-paste text that land on every phone.

If the speaker names interactions they want, build those and say which others you would add.

## Things that go wrong

- **Opening `deck.html` from disk** shows the slides with sample results (useful for design). Voting and the remote only work through the server.
- **Phones cannot open the link**: the address is `localhost` or a wifi-only address. Use `--tunnel` or deploy.
- **A slide shows "No interaction with id…"**: `data-live` or `data-phase` does not match an `id` in `#room`. `--check` reports it.
- **Links changed after a restart on a host**: set `ROOM_KEY` and `ADMIN_KEY` as environment variables.
- **Answers disappeared on a host**: the state file lives on the container's disk. See "Keeping answers" in `references/hosting.md`.
- **The admin link is a secret.** Whoever has it controls the slides. Never put it on a slide, in the room block or in a public repo.

## Files

```
SKILL.md
references/   intake · deck-format · design · interactivity · charts · presenting · hosting
kit/          deck.css deck.js charts.js qr.js inter.woff2   (the slides)
              audience.html remote.html setup.html server.py  (the room)
scripts/      new_deck.py · shots.py · extract_pptx.py · simulate.py · templates/
examples/     pitch.html · demo.html · charts.html
```
