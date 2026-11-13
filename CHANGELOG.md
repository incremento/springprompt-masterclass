# Changelog

## 1.0.0 — 2026-11-13

First release.

- Deck kit: 1280 × 720 stage, slide layouts, click-reveals, count-up numbers, speaker notes, appendix, theme from the room block, PDF export.
- Charts kit: 13 chart types from a JSON block, staged reveals, light and dark, colour-blind-checked palette.
- Room server (Python standard library only): choice, scale, words, swipe and questions interactions, take-home screen, room key and admin key, `--check`, `--tunnel`.
- Audience page, phone remote (notes, pace, skip, highlight, laser, live counts, question moderation, find, new session) and set-up page.
- Scripts: `new_deck.py`, `shots.py`, `extract_pptx.py`, `simulate.py`.
- Examples: a ten-slide pitch, a demo of every live feature, a gallery of every chart.

Found and fixed while building the pitch example with the skill:

- `?all=1` is now a still mode (animations off, count-ups final), so screenshots no longer catch a slide mid-animation.
- The join slide draws a stand-in QR when the deck is opened from disk.
- A segmented bar puts its figures all on the segments or all in the key, never a mix.
- The server notices a port already used by another program and moves to the next free one.
- Long slide titles no longer push the remote's Next button off the screen.
- A histogram's answer label sits on the side away from the median line.
- On a host, the join and remote links use the address the pages were opened on instead of a local one.
