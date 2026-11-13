#!/usr/bin/env python3
"""Fill the room with pretend phones.

    python3 scripts/simulate.py "http://localhost:8000/?k=ROOMKEY" --phones 60 --seconds 90

Paste the audience link (the one behind the join QR). Each pretend phone
behaves like the real page: it polls about every two seconds and, when a
question is open, answers it once after a short human-looking delay. Use it
to rehearse with moving results and to check a host copes with a full room.

Python 3.8+, standard library only. Answers are random: clear them before the
real talk (remote: More, New session).
"""
import argparse
import json
import random
import string
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

QUESTIONS = ["Can we have the slides afterwards?", "How long did this take to put together?", "What would you do differently next time?",
             "Does this work with a bigger room?", "Where did the numbers come from?", "What is the one thing to remember?"]
WORDS = ["time", "coffee", "slow", "eggs", "quiet", "pancakes", "money", "trust", "habit", "focus", "people", "late", "toast", "fruit"]

lock = threading.Lock()
stats = {"requests": 0, "errors": 0, "answers": 0, "ms": []}


class Phone(threading.Thread):
    def __init__(self, base, key, stop_at, rng):
        super().__init__(daemon=True)
        self.base, self.key, self.stop_at, self.rng = base, key, stop_at, rng
        self.voter = "".join(rng.choice(string.ascii_lowercase + string.digits) for _ in range(10))
        self.done = {}      # (round, interaction id) -> answered
        self.due = {}       # (round, interaction id) -> time to answer at
        self.lean = rng.random()  # this phone's general taste, so results are not flat

    def call(self, path, body=None):
        url = "%s/api/%s%sk=%s" % (self.base, path, "&" if "?" in path else "?", urllib.parse.quote(self.key))
        data = json.dumps(dict(body, voter=self.voter)).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"} if data else {})
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                out = json.loads(r.read().decode() or "{}")
            ok = True
        except urllib.error.HTTPError as e:
            out, ok = {}, e.code == 409  # 409 = the question closed while we were answering
        except Exception:
            out, ok = {}, False
        with lock:
            stats["requests"] += 1
            stats["errors"] += 0 if ok else 1
            stats["ms"].append((time.time() - t0) * 1000)
        return out

    def answer(self, it):
        r, t = self.rng, it["type"]
        if t == "choice":
            n = len(it["options"])
            if it.get("none") and r.random() < 0.12:
                return {"picks": [], "none": True, "reasons": []}
            first = min(n - 1, int(abs(r.gauss(self.lean * n, n / 3.0))) % n)
            picks = [first]
            if it.get("multi"):
                picks = sorted(set(picks + [k for k in range(n) if r.random() < 0.25]))
            reasons = [k for k in range(len(it.get("reasons", []))) if r.random() < 0.3]
            return {"picks": picks, "none": False, "reasons": reasons}
        if t == "scale":
            lo, hi, step = it.get("min", 0), it.get("max", 100), it.get("step", 1) or 1
            v = r.gauss(lo + (hi - lo) * (0.25 + 0.4 * self.lean), (hi - lo) * 0.14)
            return max(lo, min(hi, round(v / step) * step))
        if t == "words":
            return r.sample(WORDS[: 6 + int(self.lean * 8)], r.randint(1, max(1, min(it.get("max", 3), 2))))
        return None

    def run(self):
        r = self.rng
        time.sleep(r.random() * 3)
        asked = False
        while time.time() < self.stop_at:
            v = self.call("room?v=" + self.voter)
            it, rnd = v.get("it"), v.get("round")
            if it:
                k = (rnd, it["id"])
                now = time.time()
                if k not in self.done:
                    self.due.setdefault(k, now + 1.5 + r.expovariate(1 / 6.0))
                    if now >= self.due[k]:
                        if it["type"] == "swipe":
                            for c in range(len(it["cards"])):
                                self.call("answer", {"id": it["id"], "value": {str(c): r.random() < (0.2 + 0.6 * ((c * 37 % 10) / 10.0))}})
                                time.sleep(0.4 + r.random())
                        elif it["type"] == "questions":
                            if r.random() < 0.15:
                                self.call("ask", {"id": it["id"], "text": r.choice(QUESTIONS)})
                            for q in (v.get("questions") or [])[:3]:
                                if r.random() < 0.4:
                                    self.call("upvote", {"id": it["id"], "qid": q["id"]})
                        else:
                            a = self.answer(it)
                            if a is not None:
                                self.call("answer", {"id": it["id"], "value": a})
                        self.done[k] = True
                        with lock:
                            stats["answers"] += 1
            elif v.get("ask") and not asked and r.random() < 0.01:
                asked = True
                self.call("ask", {"id": v["ask"]["id"], "text": r.choice(QUESTIONS)})
            time.sleep(1.9 + r.random() * 0.4)


def main():
    ap = argparse.ArgumentParser(description="Simulate an audience on their phones.")
    ap.add_argument("link", help="the audience join link, e.g. http://localhost:8000/?k=ab12cd34")
    ap.add_argument("--phones", type=int, default=40)
    ap.add_argument("--seconds", type=int, default=60)
    ap.add_argument("--seed", type=int, default=None)
    a = ap.parse_args()
    u = urllib.parse.urlsplit(a.link)
    key = urllib.parse.parse_qs(u.query).get("k", [""])[0]
    if not (u.scheme and u.netloc and key):
        raise SystemExit("Pass the full audience link, including ?k=…")
    base = "%s://%s" % (u.scheme, u.netloc)
    seed = a.seed if a.seed is not None else random.randrange(1 << 30)
    stop_at = time.time() + a.seconds
    phones = [Phone(base, key, stop_at, random.Random(seed + n)) for n in range(a.phones)]
    print("%d phones on %s for %ds. Step through the live slides now." % (a.phones, base, a.seconds), flush=True)
    for p in phones:
        p.start()
    while time.time() < stop_at:
        time.sleep(5)
        with lock:
            ms = sorted(stats["ms"][-2000:])
            print("  %5d requests · %d failed · %d answers · median %.0f ms · slowest 5%% over %.0f ms" % (
                stats["requests"], stats["errors"], stats["answers"], ms[len(ms) // 2] if ms else 0, ms[int(len(ms) * 0.95)] if ms else 0), flush=True)
    for p in phones:
        p.join(timeout=20)
    with lock:
        bad = stats["errors"]
    print("done: %d requests, %d failed" % (stats["requests"], bad))
    raise SystemExit(1 if stats["requests"] == 0 or bad > stats["requests"] * 0.02 else 0)


if __name__ == "__main__":
    main()
