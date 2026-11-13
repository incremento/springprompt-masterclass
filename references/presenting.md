# Presenting: the remote, the set-up page, the day

## The four links

Starting the server prints:

```
Start here   http://localhost:8000/setup?k=<admin key>
Slides       http://localhost:8000/deck?k=<admin key>
Remote       https://<address>/remote?k=<admin key>     (open on your phone)
Audience     https://<address>/?k=<room key>            (the join QR points here)
```

- The **admin key** opens the slides, the remote and the set-up page. Treat it like a password.
- The **room key** is the one inside the join QR. It only lets a phone answer.
- Give the speaker the **Start here** link. It shows a button for the slides, a QR for the remote, a QR for testing as audience, a live status line (slides open, phones connected) and any problems found in the room block.

## The remote

Open it on the speaker's phone by scanning the QR on the set-up page. Add it to the home screen for a full-screen view.

**Always visible**

- **Next** (large) and **Back**. Next shows what the press will do: "click 2 of 3" during reveals, then the title of the next slide.
- A live **preview** of the slide on the big screen.
- **Pace**: a clock (tap to pause, hold to reset) and a badge that says how far ahead or behind the planned `minutes` the speaker is, counted on main slides.
- **Skip**: jumps over the next slide in two taps. It offers "Safe to skip" on slides marked `data-optional` and refuses to skip a slide that opens a live question.
- A dot, green when the slides are connected.

**Pointing at things**: the button on the preview cycles highlight → laser → off.

- Highlight: tap something in the preview (a card, a bar, a row, a paragraph) and it gets an outline on the big screen. **Dim** in More fades everything else.
- Laser: drag a finger over the preview and a dot follows on the big screen.

**Tabs**

| Tab | What is there |
|---|---|
| **Notes** | The opening line large, key points, then detail |
| **Live** | Phones connected and joined. A button per interaction to open it by hand, plus Waiting screen and Take-home. Counts per option. **±** buttons to add a show of hands. Hide a word from a word wall. Clear one interaction's answers |
| **Q&A** | Incoming questions, most upvoted first, with a count on the tab. **Show on screen** puts one up large over the slide; **Answered** ticks it off; **Hide** removes it from the room's list |
| **Find** | Search every slide's title, text and notes; tap to jump. This is how to reach the appendix when someone asks |
| **More** | Join QR over the current slide, blank the screen (black or white), restart the slide, dim, copy links, download all results (JSON), **New session** (clears every answer), test connection, reload the slides |

The phone screen stays awake while the remote is open. If the phone locks or loses signal the remote reconnects by itself; the laptop keyboard always works as a fallback.

## Rehearsing

1. Start the server and open **Start here** on the laptop. Open the slides, press `F`.
2. Scan the remote QR with the speaker's phone. Check the dot is green and Next moves the slides.
3. Fill the room with pretend phones while stepping through:

   ```bash
   python3 SKILL_DIR/scripts/simulate.py "<audience link>" --phones 60 --seconds 180
   ```

4. On each live slide check the result is readable from the back of the room and that the notes say what to do with it.
5. Run the whole talk once against the clock. If the pace badge says behind at the half-way point, mark one or two slides `data-optional` or cut them.
6. Remote → More → **New session** to clear the test answers.
7. Export a PDF as a backup: `python3 SKILL_DIR/scripts/shots.py deck.html --pdf deck.pdf`.

## On the day

Before people arrive:

- Laptop on mains power, sleep and notifications off, browser at 100% zoom, slides in full screen (`F`).
- Server running; **Start here** shows no problems and the address is one phones can reach (not `localhost`).
- Scan the join QR with a phone on mobile data, not the venue wifi. If it loads there, it loads for everyone.
- Remote open on the speaker's phone, on mobile data too if the venue wifi is flaky.
- New session done; the counter on the join slide reads 0.
- PDF backup on the desktop.

During:

- Stay on the join slide until the counter stops climbing. Say what people should see ("a page that says You're in").
- On a live slide, say the question out loud, then keep talking while answers come in. Read out the leader. Move on when the count stops moving, not when everyone has answered.
- Latecomers: press `Q` on the laptop or Join QR in the remote's More tab.
- Short of time: use Skip on optional slides. Do not rush live slides; cut content instead.

After:

- The take-home screen stays on phones as long as the server runs. Leave it up for a day if you can.
- Remote → More → **Download results** saves every answer and question.

## When something goes wrong in the room

| Problem | Do |
|---|---|
| Phones say the page cannot be reached | The address is local. Restart with `--tunnel`, or use the deployed address |
| Some phones work, some do not | Venue wifi blocks some devices. Ask them to switch to mobile data (needs a public address) |
| Remote dot is grey | The slides tab is closed or asleep. Click on the slides window; More → Test connection |
| Remote stopped responding | Use the laptop keys. Reopen the remote link when you can |
| Nobody is answering | Check the phone preview shows the question (Live tab). Press the interaction's button there to open it by hand |
| Results look wrong after rehearsal | Live tab → Clear these answers, or More → New session |
| The projector shows the wrong window | `B` blanks the slides while you sort it out |
| Everything is down | Open the PDF. Ask for a show of hands |
