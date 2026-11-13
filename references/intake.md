# Intake: finding out what the talk is

Two routes. Both end in the same place: an outline the speaker has agreed to.

## Route A: starting from thoughts (the interview)

Ask in small batches, two or three questions at a time. Use the speaker's own words back to them. Stop when you can write the outline; you rarely need every question below.

**Round 1: the room and the point**

1. Who is in the room, and how many? What do they already know about this?
2. When it is over, what should they do, decide or believe that they did not before?
3. How long do you have, including questions?

**Round 2: the material**

4. If they remember three things, what are they?
5. What is the best story or example you have for each? A real customer, a mistake, a before and after.
6. Which numbers matter? Paste them, or point at a spreadsheet or file. (Ask for the source of each. A slide with a number needs one.)
7. What will people push back on?

**Round 3: the room taking part**

8. What would you like to learn from this audience? Anything you would normally ask for a show of hands on?
9. Is there a number or result in the talk that would surprise people? (That is a guess-then-reveal.)
10. What should land on their phones at the end: links, a template, a prompt, your contact details?

**Round 4: look and logistics**

11. Brand colour, logo, any pictures or screenshots to include? (A hex code and a file path are enough. No brand: use the default.)
12. Where are you giving it: a room with wifi you control, a venue with guest wifi, or online? Do you need a web address that works from anywhere?
13. When is it? Is there time for a rehearsal with the remote?

### If they do not want an interview

Some people say "you decide" or paste a paragraph. Then:

- Infer what you can from what they gave you and from files they point to.
- Write down the assumptions you made (audience, length, goal) in three lines at the top of the outline.
- Use placeholder data only where you must, and mark it on the slide (`<p class="source">Example figures</p>`) and in the notes. Never present invented numbers as real.

### Turning answers into an outline

A shape that works for most talks:

| Part | Slides | What happens |
|---|---|---|
| Cover | 1 | Title, speaker, event |
| Join + warm-up | 2 | QR code, then an easy question |
| The problem | 1 to 3 | A story or a number the room recognises |
| Point 1, 2, 3 | 2 to 4 each | Claim as the headline, one piece of evidence, one example |
| A moment for the room in each point | | A guess, a vote, a word wall or swipe cards |
| What to do on Monday | 1 | Steps, not principles |
| Questions | 1 | Open the whole way through, shown here |
| Take-home | 1 | Links land on phones |
| Appendix | any | Detail for the questions you expect |

A pitch follows the same logic with different parts: problem, who has it, what you do, proof it works, market, how you make money, team, the ask.

Show the outline table (see SKILL.md step 2) and ask: "Anything missing, anything to cut, and are these the right moments to involve the room?" Build after they answer.

## Route B: they already have a deck

### Get the content out

| They have | Do this |
|---|---|
| PowerPoint `.pptx` | `uv run --with python-pptx python3 SKILL_DIR/scripts/extract_pptx.py talk.pptx --out <folder>/import` (or `pip install python-pptx` first) |
| Google Slides | File → Download → Microsoft PowerPoint (.pptx), then the line above. A share link alone is not enough unless you have a tool that can download it. |
| Keynote | File → Export To → PowerPoint, then the line above |
| PDF only | Read the PDF directly. There are no speaker notes or chart data in it: ask for the numbers behind any chart. |
| Pictures or a document | Read them and treat the content as interview answers |

The script writes `import/outline.md` (titles, text with bullet levels, tables, chart data, notes), `import/outline.json` and `import/media/` (every picture). Read `outline.md` first. Open the pictures you plan to reuse; copy those into `<folder>/assets/`.

### Rebuild, do not transliterate

A converted deck that keeps every bullet is worse than the original. For each slide decide:

- **What is the one point?** That becomes the headline sentence. The old title is usually a label ("Q3 results"); the point is in the bullets or the notes ("Q3 was the first profitable quarter").
- **Bullets** become one of: a short `.list` (three or four items), `.cols` of cards, `.steps`, a `.compare` pair, or separate slides. Sub-bullets usually move to the speaker notes.
- **Charts**: rebuild from the extracted data with `references/charts.md`. Pick the form for the point, not the form the old chart had. A pie becomes ranked bars or one figure.
- **Tables** with more than about five rows: show the two or three rows that matter (`table.t` with a `tr.pick`), put the full table in the appendix.
- **Pictures**: keep photos, screenshots and diagrams that carry information. Drop clip art and decoration.
- **Speaker notes** carry over, reshaped as `▶` first line and `•` key points.
- **Hidden slides** and backup slides go in the appendix.

### Questions the file cannot answer

Ask these after reading the import, in one message:

1. Who is this for now, and how long do you have? (Old decks are often for a different audience.)
2. Which slides matter most, and which could go?
3. I would make these moments interactive: (list them). Agree?
4. What should people take away on their phones?
5. Keep your colours and logo, or use the kit's look? (Pull the accent colour from the old deck if they want to keep it.)
6. Where will you give it? (Decides hosting.)

Then write the outline table mapping old slides to new ones, so they can see what moved and what was cut, and build once they agree.
