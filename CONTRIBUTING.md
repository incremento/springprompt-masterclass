# Contributing

Issues and pull requests are welcome. The aim is a skill that produces a talk someone can give tomorrow, so changes that make the result more reliable beat changes that add options.

## Ground rules

- **No dependencies.** `kit/server.py` runs on the Python standard library. The slides load nothing from the network. Keep it that way.
- **No build step.** The kit is plain HTML, CSS and JavaScript that a person can read.
- **One visual language.** New layouts and charts use the existing type scale, spacing and colour variables in `kit/deck.css`.
- **Docs are part of the change.** An agent only knows what `SKILL.md` and `references/` tell it. If you add an attribute, an option or a chart field, document it in the matching reference and show it in an example.
- **Plain words** in docs and in example slides.

## Checking a change

```bash
python3 kit/server.py --deck examples/pitch.html --check
python3 kit/server.py --deck examples/demo.html --check
python3 kit/server.py --deck examples/charts.html --check    # reports 1 problem on purpose: the error slide
python3 scripts/shots.py examples/demo.html --out /tmp/demo-shots
```

Look at the screenshots. Then run a room and drive it:

```bash
python3 kit/server.py --deck examples/demo.html
python3 scripts/simulate.py "<the Audience link>" --phones 60 --seconds 120
```

Open the slides and the remote, step through every slide, and check each live result draws.

For a change to charts, add or adjust a slide in `examples/charts.html` and check it in both a normal and a `night` slide.

## Evals

`evals/evals.json` holds test prompts with what a good result looks like. If you change how the skill behaves, run the affected prompts with your agent and compare.

## Reporting a problem

Include the deck (or the smallest slide that shows it), the browser, how the room was hosted, and a screenshot.
