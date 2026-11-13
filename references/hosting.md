# Hosting: getting the room onto people's phones

The room is one Python file with no dependencies. It serves the slides, the audience page and the remote, and keeps the answers. Pick the smallest option that reaches every phone in the room.

| Where the talk happens | Use | Phones need |
|---|---|---|
| Rehearsing alone | `python3 kit/server.py` | nothing: use `?demo=1` or `simulate.py` |
| A meeting room where everyone is on the same trusted wifi | `python3 kit/server.py` | that wifi |
| Any room, today, no account | `python3 kit/server.py --tunnel` | any internet |
| A conference, a webinar, or a talk you will give more than once | Railway (or any Docker host) | any internet |

Ask the speaker which one applies. If they do not know, use the tunnel for rehearsal and deploy for the day.

## 1. On the laptop

```bash
cd <talk folder>
python3 kit/server.py
```

It prints four links (presenting.md explains them). The Remote and Audience links use the laptop's wifi address, for example `http://192.168.1.20:8000`, so phones on the same network can open them.

- If port 8000 is taken the server moves to the next free one and says so. Choose one with `--port 8080`.
- Guest and venue wifi often stops devices talking to each other. If a phone on the wifi cannot open the link, use the tunnel.
- The laptop must stay awake.

## 2. A public link from the laptop (`--tunnel`)

```bash
python3 kit/server.py --tunnel
```

Needs `cloudflared` on the laptop (`brew install cloudflared` on a Mac; no Cloudflare account). The server starts a quick tunnel and prints `https://<random words>.trycloudflare.com` links that work from any phone, on wifi or mobile data.

- The link can take up to a minute to start answering.
- **The link changes every time the server restarts.** Start it once before the talk and leave it running. Do not print the QR on handouts.
- The talk depends on the laptop's connection. If the venue wifi is poor, tether the laptop to a phone or deploy instead.

## 3. Railway

A fixed `https://…up.railway.app` address that does not depend on the laptop. The talk folder already has the `Dockerfile`. Needs a Railway account and the CLI (`brew install railway`, then `railway login`, which the speaker does themselves in a browser).

Run from the talk folder. Choose two keys first so the links stay the same across restarts and redeploys:

```bash
ROOM_KEY=$(python3 -c "import secrets;print(secrets.token_hex(4))")
ADMIN_KEY=$(python3 -c "import secrets;print(secrets.token_hex(8))")

railway init -n "<talk name>"                    # add -w "<workspace>" when the account has more than one
railway add -s room -v "ROOM_KEY=$ROOM_KEY" -v "ADMIN_KEY=$ADMIN_KEY"
railway up -c -y -s room                         # builds the Dockerfile and waits for the build
railway domain -s room                           # prints the public address
```

Then the links are:

```
Start here   https://<address>/setup?k=<ADMIN_KEY>
Slides       https://<address>/deck?k=<ADMIN_KEY>
Remote       https://<address>/remote?k=<ADMIN_KEY>
Audience     https://<address>/?k=<ROOM_KEY>
```

Open **Start here** and check it reports no problems. The QR codes use whatever address the pages were opened on, so there is nothing else to set. A custom domain works the same way: add it in Railway and open the links on it.

Give the speaker the four links and tell them the admin key is a password. Keep the keys out of the deck, out of git and out of screenshots; a small untracked file in the talk folder is fine.

**After editing the deck**, run `railway up -c -y -s room` again. Phones reconnect on their own.

**Keeping answers.** Answers live in a small state folder on the container's disk. A redeploy or a restart of the service starts it empty, which is usually what you want between rehearsal and the day. To keep answers across deploys (a course over several days, results you want to download later), attach a volume and point the server at it:

```bash
railway volume add -m /data
railway variable set DATA_DIR=/data -s room
```

Otherwise download the results from the remote (More → Download results) before redeploying.

**Do not redeploy while the room is in use**: every phone loses the page for the half-minute the new container takes to start.

**Afterwards.** The service costs a little while it runs. `railway down -y -s room` stops it; `railway delete` removes the project.

## Any other host

Anything that runs a Dockerfile, or Python 3.8+, works: Fly.io, Render, a VPS, a Raspberry Pi behind a reverse proxy. The server needs:

| Variable | Meaning | Default |
|---|---|---|
| `PORT` | Port to listen on | 8000 |
| `HOST` | Interface | 0.0.0.0 |
| `DECK` | Deck file, relative to the folder | `deck.html` |
| `ROOM_KEY`, `ADMIN_KEY` | The two keys in the links. Set them on a host, or they are generated at first start and kept with the state | generated |
| `DATA_DIR` | Where answers and generated keys are kept | `.room/` in the talk folder |
| `PUBLIC_URL` | The address to put in QR codes, if the server cannot work it out (it normally can, from the address the pages are opened on) | worked out |

- One instance only. The state is in memory and on one disk; do not scale to several replicas.
- Serve it over https. Behind a reverse proxy, pass `Host` and `X-Forwarded-Proto` through.
- The same commands work with command-line flags: `python3 kit/server.py --deck talk.html --port 8080 --host 127.0.0.1`.

## How many phones

Each phone asks the server for the current question about every two seconds. A laptop has run 200 simulated phones answering at once with no failed requests, and the smallest Railway instance 40. For a bigger room, test first:

```bash
python3 SKILL_DIR/scripts/simulate.py "<audience link>" --phones 300 --seconds 120
```

It prints how many requests failed and how long they took. If the median climbs above about half a second, use a larger instance.

## Checks before handing over

1. `python3 kit/server.py --check` reports no problems.
2. **Start here** opens, lists no problems, and its "slides" tile changes once the deck tab is open.
3. The join QR, scanned by a phone **on mobile data**, shows the audience page. (Skip the mobile-data part only for same-wifi hosting.)
4. The remote on a phone moves the slides, and the dot is green.
5. `simulate.py` against the audience link: results draw on a live slide.
6. Remote → More → **New session**, so the room starts at zero.

## When hosting goes wrong

| Problem | Cause and fix |
|---|---|
| The QR shows `localhost` or `127.0.0.1` | The slides were opened on a local address and the server has no public one. Use `--tunnel`, or open the slides on the deployed address |
| Links stopped working after a redeploy | The keys were generated, not set. Set `ROOM_KEY` and `ADMIN_KEY` |
| A phone says "This link has expired" | The room key changed (a restart with generated keys). Scan the code on the screen again, and set `ROOM_KEY` so it stops changing |
| "This page needs the presenter link printed when the server started" | The slides, remote or set-up page was opened without `?k=<ADMIN_KEY>` |
| The join slide says the code appears with the admin link | The slides were opened without `?k=<ADMIN_KEY>`. Use the Slides link |
| The tunnel link never answers | Wait a minute, then restart. If it still fails, the network blocks it: tether or deploy |
| Results reset | The host restarted without a volume. See "Keeping answers" |
| The server will not start: port in use | Another program has it. The server tries the next twenty ports; otherwise pass `--port` |
