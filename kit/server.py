#!/usr/bin/env python3
"""springprompt-masterclass · room server

Python 3.8+, standard library only. Run it from the talk folder (the one that
holds deck.html and kit/):

    python3 kit/server.py                     # http://localhost:8000
    python3 kit/server.py --port 9000 --deck talk.html

It serves three things:

    /setup    start here: links and QR codes for everything below (admin key)
    /deck     the slides, for the laptop on the projector        (admin key)
    /remote   the presenter's phone remote                       (admin key)
    /         the audience page, opened from the join QR         (room key)

Keys are generated on first run and kept in .room/keys.json, or set them with
the ROOM_KEY and ADMIN_KEY environment variables (do this on any host whose
disk does not survive a restart). PUBLIC_URL is the address phones can reach,
for example https://my-talk.up.railway.app; without it the server uses the
host the deck was opened on, or this machine's Wi-Fi address.

Interactions are defined in the deck itself, in
<script type="application/json" id="room">…</script>; the server re-reads the
deck whenever the file changes.
"""
import argparse
import hmac
import json
import mimetypes
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
from collections import Counter
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlencode, urlsplit

KIT = os.path.dirname(os.path.abspath(__file__))
ROOT = os.getcwd()
DECK = "deck.html"
DATA = os.environ.get("DATA_DIR", ".room")
VERBOSE = False

LOCK = threading.Condition()
STATE = {"phase": "wait", "round": 1, "answers": {}, "manual": {}, "questions": {}, "hidden": {}, "joined": []}
SEEN = {}          # voter id -> last poll time (who is connected right now)
DIRTY = False      # STATE needs writing to disk
VER = 0            # bumps on anything the remote should hear about
SEQ = 0            # remote -> deck command counter
CMDS = []          # [(seq, cmd)]
DECKTAB = {"tab": "", "title": "", "minutes": 0, "slides": [], "state": {}, "seen": 0.0, "sv": 0}
ROOMCFG = {"mtime": None, "checked": 0.0, "room": {}, "defs": {}}
KEYS = {}
ORIGIN = {"url": ""}  # where the deck was last opened from, as a fallback for the join link

VOTER = re.compile(r"^[a-z0-9]{6,32}$")
MAX_VOTERS = 5000
PRIVATE_FIELDS = ("correct", "answer", "answerLabel", "sample")


# ── room definition (read out of the deck) ────────────────────────────────
def room():
    """The parsed #room block, re-read when deck.html changes."""
    now = time.time()
    if now - ROOMCFG["checked"] < 1:
        return ROOMCFG["room"]
    ROOMCFG["checked"] = now
    try:
        mtime = os.stat(os.path.join(ROOT, DECK)).st_mtime
    except OSError:
        return ROOMCFG["room"]
    if mtime == ROOMCFG["mtime"]:
        return ROOMCFG["room"]
    ROOMCFG["mtime"] = mtime
    try:
        with open(os.path.join(ROOT, DECK), encoding="utf-8") as f:
            html = f.read()
        m = re.search(r"<script[^>]*\bid=[\"']room[\"'][^>]*>(.*?)</script>", html, re.S | re.I)
        cfg = json.loads(m.group(1)) if m else {}
        problems = check_room(cfg)
        for p in problems:
            print("  room: " + p, file=sys.stderr)
        ROOMCFG["room"] = cfg
        ROOMCFG["defs"] = {d["id"]: d for d in cfg.get("interactions", []) if isinstance(d, dict) and d.get("id")}
    except Exception as e:  # keep serving the last good definition
        print("  room: could not read #room from %s: %s" % (DECK, e), file=sys.stderr)
    return ROOMCFG["room"]


def defs():
    room()
    return ROOMCFG["defs"]


def check_room(cfg):
    """Return a list of human-readable problems with a #room block."""
    out, seen = [], set()
    for d in cfg.get("interactions", []):
        i, t = d.get("id"), d.get("type")
        if not i or not re.match(r"^[a-z0-9][a-z0-9_-]*$", str(i)):
            out.append("interaction id %r must be lowercase letters, digits, - or _" % (i,))
        if i in ("wait", "takehome", "keep"):
            out.append("interaction id %r is reserved" % (i,))
        if i in seen:
            out.append("interaction id %r is used twice" % (i,))
        seen.add(i)
        if t not in ("choice", "scale", "words", "questions", "swipe"):
            out.append("%s: unknown type %r" % (i, t))
        if t == "choice" and not (isinstance(d.get("options"), list) and 2 <= len(d["options"]) <= 8):
            out.append("%s: choice needs 2 to 8 options" % i)
        if t == "swipe" and not (isinstance(d.get("cards"), list) and d["cards"]):
            out.append("%s: swipe needs a list of cards" % i)
        if t == "scale" and not (float(d.get("max", 100)) > float(d.get("min", 0))):
            out.append("%s: scale max must be above min" % i)
    return out


def check_deck(html):
    """Lint a whole deck file: the #room block and how the slides refer to it.
    Returns (problems, warnings). Problems break the talk; warnings are worth a look."""
    probs, warns = [], []
    m = re.search(r"<script[^>]*\bid=[\"']room[\"'][^>]*>(.*?)</script>", html, re.S | re.I)
    cfg = {}
    if not m:
        warns.append("no #room block: the deck will run, but with no audience interactions")
    else:
        try:
            cfg = json.loads(m.group(1))
        except ValueError as e:
            probs.append("#room is not valid JSON: %s" % e)
    probs += check_room(cfg)
    ids = {d.get("id") for d in cfg.get("interactions", []) if isinstance(d, dict)}
    slides = re.findall(r"<section\b[^>]*\bclass=[\"'][^\"']*\bslide\b[^>]*>.*?</section>", html, re.S | re.I)
    if not slides:
        probs.append('no <section class="slide"> found')
    opened = set()
    for n, sl in enumerate(slides, 1):
        head = sl[: sl.index(">") + 1]
        ph = re.search(r"\bdata-phase=[\"']([^\"']*)[\"']", head)
        if ph:
            opened.add(ph.group(1))
            if ph.group(1) not in ids and ph.group(1) not in ("wait", "takehome", "keep"):
                probs.append('slide %d: data-phase="%s" is not an interaction id in #room' % (n, ph.group(1)))
        for to in re.findall(r"\bdata-to=[\"']([^\"']*)[\"']", sl):
            opened.add(to)
            if to not in ids and to not in ("wait", "takehome"):
                probs.append('slide %d: data-to="%s" is not an interaction id in #room' % (n, to))
        for attr in ("data-live", "data-for", "data-answers"):
            for ref in re.findall(r"\b%s=[\"']([^\"']*)[\"']" % attr, sl):
                if ref not in ids:
                    probs.append('slide %d: %s="%s" is not an interaction id in #room' % (n, attr, ref))
        for live in re.findall(r"\bdata-live=[\"']([^\"']*)[\"']", sl):
            if not ph and live in ids:
                warns.append('slide %d shows results for "%s" but has no data-phase: phones only get the question if an earlier slide opened it' % (n, live))
        for k, block in enumerate(re.findall(r"<figure[^>]*\bclass=[\"'][^\"']*\bchart\b[^>]*>\s*<script[^>]*>(.*?)</script>", sl, re.S | re.I), 1):
            try:
                json.loads(block)
            except ValueError as e:
                probs.append("slide %d: chart %d is not valid JSON: %s" % (n, k, e))
        if 'class="notes"' not in sl and "class='notes'" not in sl:
            warns.append("slide %d has no speaker notes" % n)
    for d in cfg.get("interactions", []):
        if isinstance(d, dict) and d.get("id") not in opened and not (d.get("type") == "questions" and d.get("always")):
            warns.append('interaction "%s" is never opened: no slide has data-phase="%s"' % (d.get("id"), d.get("id")))
    if ids and "data-join" not in html:
        warns.append("no slide has data-join, so the room never sees the QR code (Q on the keyboard still shows it)")
    if cfg.get("takehome") and "takehome" not in opened:
        warns.append('#room has a takehome but no slide sends it (data-phase="takehome")')
    return probs, warns


def public_def(d):
    return {k: v for k, v in d.items() if k not in PRIVATE_FIELDS}


# ── answers ───────────────────────────────────────────────────────────────
def clean_answer(d, v):
    """Validate one phone's answer against the interaction definition. None = reject."""
    t = d["type"]
    if t == "choice":
        if not isinstance(v, dict):
            return None
        n = len(d["options"])
        picks = sorted({int(p) for p in v.get("picks", []) if isinstance(p, int) and 0 <= p < n})
        none = bool(v.get("none")) and bool(d.get("none")) and not picks
        if not d.get("multi"):
            picks = picks[:1]
        if not picks and not none:
            return None
        reasons = sorted({int(r) for r in v.get("reasons", []) if isinstance(r, int) and 0 <= r < len(d.get("reasons", []))})
        return {"picks": picks, "none": none, "reasons": reasons}
    if t == "scale":
        try:
            x = float(v)
        except (TypeError, ValueError):
            return None
        lo, hi, step = float(d.get("min", 0)), float(d.get("max", 100)), float(d.get("step", 1)) or 1
        x = lo + round((min(hi, max(lo, x)) - lo) / step) * step
        return int(x) if float(x).is_integer() else round(x, 4)
    if t == "words":
        if isinstance(v, str):
            v = [v]
        if not isinstance(v, list):
            return None
        maxlen, cap = int(d.get("maxlen", 24)), int(d.get("max", 3))
        words = []
        for w in v:
            w = re.sub(r"\s+", " ", str(w)).strip()[:maxlen]
            if w and w.lower() not in [x.lower() for x in words]:
                words.append(w)
        return words[:cap] or None
    if t == "swipe":
        if not isinstance(v, dict):
            return None
        out = {}
        for k, yes in v.items():
            if str(k).isdigit() and int(k) < len(d["cards"]):
                out[str(int(k))] = bool(yes)
        return out or None
    return None


def summary(d):
    """Aggregate one interaction for the deck and the remote."""
    i, t = d["id"], d["type"]
    a = STATE["answers"].get(i, {})
    if t == "choice":
        counts, reasons, none = [0] * len(d["options"]), [0] * len(d.get("reasons", [])), 0
        for v in a.values():
            for p in v["picks"]:
                if p < len(counts):
                    counts[p] += 1
            none += 1 if v.get("none") else 0
            for r in v.get("reasons", []):
                if r < len(reasons):
                    reasons[r] += 1
        manual = (STATE["manual"].get(i) or [])[: len(counts)]
        for k, c in enumerate(manual):
            counts[k] += c
        return {"type": t, "n": len(a) + sum(manual), "phones": len(a), "counts": counts, "none": none, "reasons": reasons, "manual": manual}
    if t == "scale":
        vals = sorted(a.values())
        n = len(vals)
        med = (vals[(n - 1) // 2] + vals[n // 2]) / 2 if n else None
        return {"type": t, "n": n, "values": vals[:3000], "median": med, "mean": (sum(vals) / n) if n else None}
    if t == "words":
        hidden = {w.lower() for w in STATE["hidden"].get(i, [])}
        c, shown = Counter(), {}
        for words in a.values():
            for w in words:
                k = w.lower()
                if k not in hidden:
                    c[k] += 1
                    shown.setdefault(k, w if w.isupper() else k)
        return {"type": t, "n": len(a), "words": [[shown[k], n] for k, n in c.most_common(80)], "hidden": sorted(hidden)}
    if t == "questions":
        qs = STATE["questions"].get(i, [])
        items = [{"id": q["id"], "text": q["text"], "votes": len(q["votes"]), "done": q.get("done", False), "hidden": q.get("hidden", False)} for q in qs]
        items.sort(key=lambda q: (q["done"], -q["votes"]))
        return {"type": t, "n": len([q for q in items if not q["hidden"]]), "items": items}
    if t == "swipe":
        cards = [{"yes": 0, "no": 0} for _ in d["cards"]]
        for v in a.values():
            for k, yes in v.items():
                if int(k) < len(cards):
                    cards[int(k)]["yes" if yes else "no"] += 1
        return {"type": t, "n": len(a), "cards": cards}
    return {"type": t, "n": 0}


def online():
    cut = time.time() - 8
    return sum(1 for t in SEEN.values() if t > cut)


def touch():
    """Mark state changed: wake long-polls and schedule a save. Call with LOCK held."""
    global VER, DIRTY
    VER += 1
    DIRTY = True
    LOCK.notify_all()


def audience_view(voter):
    r = room()
    ds = ROOMCFG["defs"]
    ph = STATE["phase"]
    out = {"title": r.get("title", ""), "phase": ph, "round": STATE["round"], "theme": r.get("theme")}
    d = ds.get(ph)
    if ph not in ("wait", "takehome") and not d:
        out["phase"] = "wait"
    if d:
        out["it"] = public_def(d)
        if d["type"] == "questions":
            out["questions"] = questions_for(d["id"], voter)
        else:
            mine = STATE["answers"].get(d["id"], {}).get(voter)
            out["mine"] = mine
            if mine is not None and d.get("showResults"):
                out["results"] = summary(d)
    if out["phase"] == "wait":
        ask = next((x for x in ds.values() if x["type"] == "questions" and x.get("always")), None)
        if ask:
            out["ask"] = public_def(ask)
            out["questions"] = questions_for(ask["id"], voter)
    if ph == "takehome":
        out["takehome"] = r.get("takehome") or {"title": "Thank you", "text": ""}
    return out


def questions_for(i, voter):
    qs = [q for q in STATE["questions"].get(i, []) if not q.get("hidden")]
    items = [{"id": q["id"], "text": q["text"], "votes": len(q["votes"]), "mine": q["by"] == voter, "voted": voter in q["votes"], "done": q.get("done", False)} for q in qs]
    items.sort(key=lambda q: (q["done"], -q["votes"]))
    return items[:40]


# ── persistence ───────────────────────────────────────────────────────────
def load():
    os.makedirs(DATA, exist_ok=True)
    try:
        with open(os.path.join(DATA, "state.json"), encoding="utf-8") as f:
            saved = json.load(f)
        for k in STATE:
            if k in saved:
                STATE[k] = saved[k]
    except (OSError, ValueError):
        pass
    kp = os.path.join(DATA, "keys.json")
    try:
        with open(kp, encoding="utf-8") as f:
            KEYS.update(json.load(f))
    except (OSError, ValueError):
        pass
    fresh = False
    for name, env, size in (("room", "ROOM_KEY", 4), ("admin", "ADMIN_KEY", 12)):
        if os.environ.get(env):
            KEYS[name] = os.environ[env].strip()
        elif not KEYS.get(name):
            KEYS[name] = secrets.token_hex(size)
            fresh = True
    if fresh:
        with open(kp, "w", encoding="utf-8") as f:
            json.dump({"room": KEYS["room"], "admin": KEYS["admin"]}, f)
        try:
            os.chmod(kp, 0o600)
        except OSError:
            pass


def saver():
    global DIRTY
    path = os.path.join(DATA, "state.json")
    while True:
        time.sleep(1.5)
        with LOCK:
            cut = time.time() - 120
            for v in [v for v, t in SEEN.items() if t < cut]:
                del SEEN[v]
            if not DIRTY:
                continue
            DIRTY = False
            blob = json.dumps(STATE)
        try:
            with open(path + ".tmp", "w", encoding="utf-8") as f:
                f.write(blob)
            os.replace(path + ".tmp", path)
        except OSError as e:
            print("  could not save state: %s" % e, file=sys.stderr)


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


LOCAL = re.compile(r"//(localhost|127\.|0\.0\.0\.0|\[::1\])")


def public_base(port, asked=""):
    """The address phones should use. `asked` is the address the current request came in on:
    when that is not this machine (a host, a tunnel), it is the address that reaches us."""
    if os.environ.get("PUBLIC_URL"):
        return os.environ["PUBLIC_URL"].rstrip("/")
    if os.environ.get("RAILWAY_PUBLIC_DOMAIN"):
        return "https://" + os.environ["RAILWAY_PUBLIC_DOMAIN"]
    if asked and not LOCAL.search(asked):
        ORIGIN["url"] = asked
    if ORIGIN["url"] and not LOCAL.search(ORIGIN["url"]):
        return ORIGIN["url"]
    return "http://%s:%d" % (lan_ip(), port)


def start_tunnel(port):
    """Open a public https address for this server with a Cloudflare quick tunnel (no account)."""
    exe = shutil.which("cloudflared")
    if not exe:
        sys.exit("--tunnel needs cloudflared.\n  macOS:  brew install cloudflared\n  other:  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/")
    p = subprocess.Popen([exe, "tunnel", "--no-autoupdate", "--url", "http://localhost:%d" % port],
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    found = {}

    def pump():
        for line in p.stdout:
            m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", line)
            if m:
                found.setdefault("url", m.group(0))

    threading.Thread(target=pump, daemon=True).start()
    import atexit
    atexit.register(p.terminate)
    t0 = time.time()
    while "url" not in found and p.poll() is None and time.time() - t0 < 45:
        time.sleep(0.2)
    if "url" not in found:
        sys.exit("cloudflared did not return a public link. Check the internet connection, or use the same-wifi link instead.")
    return found["url"]


# ── HTTP ──────────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "masterclass"
    timeout = 75

    def log_message(self, fmt, *args):
        if VERBOSE:
            sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

    # -- helpers
    def send(self, code, body, ctype="application/json", headers=()):
        if isinstance(body, (dict, list)):
            body = json.dumps(body)
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith("text/") or ctype == "application/json" else ""))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store" if ctype == "application/json" else "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        for k, v in headers:
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def cookie(self, name):
        c = SimpleCookie(self.headers.get("Cookie", ""))
        return c[name].value if name in c else ""

    def is_admin(self):
        k = self.q.get("k") or self.cookie("mc_admin")
        return bool(k) and hmac.compare_digest(k.encode(), KEYS["admin"].encode())

    def in_room(self):
        k = self.q.get("k") or self.cookie("mc_room")
        return (bool(k) and hmac.compare_digest(k.encode(), KEYS["room"].encode())) or self.is_admin()

    def base(self):
        proto = self.headers.get("X-Forwarded-Proto", "http").split(",")[0].strip()
        host = self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or "localhost"
        return "%s://%s" % (proto, host.split(",")[0].strip())

    def body(self, limit):
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            raise ValueError("body too large")
        raw = self.rfile.read(n) if n else b"{}"
        data = json.loads(raw.decode("utf-8") or "{}")
        if not isinstance(data, dict):
            raise ValueError("expected a JSON object")
        return data

    def file(self, path, ctype=None):
        try:
            size = os.path.getsize(path)
            f = open(path, "rb")
        except OSError:
            return self.send(404, "Not found", "text/plain")
        ctype = ctype or mimetypes.guess_type(path)[0] or "application/octet-stream"
        start, end, code = 0, size - 1, 200
        m = re.match(r"bytes=(\d*)-(\d*)$", self.headers.get("Range", ""))
        if m and (m.group(1) or m.group(2)) and size:
            if m.group(1):
                start = int(m.group(1))
                end = min(int(m.group(2)), size - 1) if m.group(2) else size - 1
            else:
                start = max(0, size - int(m.group(2)))
            if start > end:
                f.close()
                return self.send(416, "Bad range", "text/plain", [("Content-Range", "bytes */%d" % size)])
            code = 206
        with f:
            f.seek(start)
            data = f.read(end - start + 1)
        headers = [("Accept-Ranges", "bytes")]
        if code == 206:
            headers.append(("Content-Range", "bytes %d-%d/%d" % (start, end, size)))
        self.send(code, data, ctype, headers)

    def page(self, name):
        with open(os.path.join(KIT, name), encoding="utf-8") as f:
            self.send(200, f.read(), "text/html")

    def denied(self, what):
        self.send(403, "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><body style='font:18px/1.5 system-ui;padding:40px;max-width:560px;margin:auto;color:#1C2420;background:#FAF7F0'><h2>%s</h2></body>" % what, "text/html")

    def gate(self, key_name, cookie_name):
        """First visit carries ?k=…: swap it for a cookie so the key leaves the address bar."""
        k = self.q.get("k", "")
        if k and hmac.compare_digest(k.encode(), KEYS[key_name].encode()):
            rest = {a: b for a, b in self.q.items() if a != "k"}
            loc = self.path_only + ("?" + urlencode(rest) if rest else "")
            secure = "; Secure" if self.base().startswith("https") else ""
            self.send(302, "", "text/plain", [("Location", loc), ("Set-Cookie", "%s=%s; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax%s" % (cookie_name, k, secure))])
            return False
        return True

    def judge(self, name, d, b, voter, now):
        """Apply one audience action. Returns (status, body); nothing is written while the lock is held."""
        with LOCK:
            SEEN[voter] = now
            if name == "answer":
                if d["type"] == "questions":
                    return (400, {"error": "use /api/ask"})
                if STATE["phase"] != d["id"]:
                    return (409, {"error": "closed"})
                v = clean_answer(d, b.get("value"))
                if v is None:
                    return (400, {"error": "bad answer"})
                a = STATE["answers"].setdefault(d["id"], {})
                if voter not in a and len(a) >= MAX_VOTERS:
                    return (429, {"error": "room full"})
                if d["type"] == "swipe" and voter in a:
                    v = dict(a[voter], **v)
                a[voter] = v
            elif name == "ask":
                if d["type"] != "questions":
                    return (400, {"error": "not a questions interaction"})
                text = re.sub(r"\s+", " ", str(b.get("text", ""))).strip()[: int(d.get("maxlen", 200))]
                qs = STATE["questions"].setdefault(d["id"], [])
                if not text or len([q for q in qs if q["by"] == voter]) >= 5 or len(qs) >= 500:
                    return (400, {"error": "empty, or too many questions"})
                same = next((q for q in qs if q["text"].lower().rstrip("?!. ") == text.lower().rstrip("?!. ") and not q.get("hidden")), None)
                if same:  # the same question again counts as an upvote
                    if voter not in same["votes"]:
                        same["votes"].append(voter)
                else:
                    qs.append({"id": secrets.token_hex(4), "text": text, "by": voter, "votes": [voter], "ts": now, "hidden": False, "done": False})
            else:
                q = next((q for q in STATE["questions"].get(d["id"], []) if q["id"] == b.get("qid")), None)
                if not q:
                    return (404, {"error": "no such question"})
                if voter in q["votes"]:
                    q["votes"].remove(voter)
                else:
                    q["votes"].append(voter)
            touch()
            return (200, audience_view(voter))

    # -- routing
    def route(self):
        u = urlsplit(self.path)
        self.path_only = u.path
        self.q = {k: v[-1] for k, v in parse_qs(u.query).items()}
        p = u.path
        try:
            if p.startswith("/api/"):
                return self.api(p[5:])
            if self.command not in ("GET", "HEAD"):
                return self.send(405, "Method not allowed", "text/plain")
            if p == "/healthz":
                return self.send(200, "ok", "text/plain")
            if p == "/favicon.ico":
                return self.send(204, b"", "image/x-icon")
            if p == "/":
                if not self.in_room():
                    return self.denied("Scan the QR code on the screen to join.")
                return self.page("audience.html")
            if p in ("/deck", "/remote", "/setup"):
                if not self.gate("admin", "mc_admin"):
                    return
                if not self.is_admin():
                    return self.denied("This page needs the presenter link printed when the server started.")
                if p == "/deck":
                    ORIGIN["url"] = self.base()
                    return self.file(os.path.join(ROOT, DECK), "text/html")
                return self.page(p[1:] + ".html")
            if p.startswith("/kit/"):
                name = os.path.basename(p)
                if re.search(r"\.(css|js|woff2|svg|png|webmanifest)$", name):
                    return self.file(os.path.join(KIT, name))
            if p.startswith("/assets/"):
                full = os.path.realpath(os.path.join(ROOT, p.lstrip("/")))
                if full.startswith(os.path.realpath(os.path.join(ROOT, "assets")) + os.sep):
                    return self.file(full)
            self.send(404, "Not found", "text/plain")
        except (BrokenPipeError, ConnectionResetError):
            pass
        except ValueError as e:
            self.send(400, {"error": str(e)})

    do_GET = do_POST = do_HEAD = route

    def api(self, name):
        global SEQ
        post = self.command == "POST"
        now = time.time()

        # ---- audience ---------------------------------------------------
        if name == "room" and not post:
            if not self.in_room():
                return self.send(403, {"error": "key"})
            voter = self.q.get("v", "")
            with LOCK:
                if VOTER.match(voter):
                    SEEN[voter] = now
                    if voter not in STATE["joined"] and len(STATE["joined"]) < MAX_VOTERS:
                        STATE["joined"].append(voter)
                out = audience_view(voter)
            return self.send(200, out)

        if name in ("answer", "ask", "upvote") and post:
            if not self.in_room():
                return self.send(403, {"error": "key"})
            b = self.body(8192)
            voter, d = str(b.get("voter", "")), defs().get(str(b.get("id", "")))
            if not VOTER.match(voter) or not d:
                return self.send(400, {"error": "bad request"})
            code, out = self.judge(name, d, b, voter, now)
            return self.send(code, out)

        # ---- presenter (deck, remote, setup) ------------------------------
        if not self.is_admin():
            return self.send(403, {"error": "admin key"})

        if name == "results":
            with LOCK:
                out = {"phase": STATE["phase"], "round": STATE["round"], "online": online(), "joined": len(STATE["joined"]), "results": {i: summary(d) for i, d in defs().items()}}
            return self.send(200, out)

        if name == "info":
            r = room()
            port = self.server.server_address[1]
            base = public_base(port, self.base())
            with LOCK:
                out = {
                    "title": r.get("title", ""), "join": "%s/?k=%s" % (base, KEYS["room"]),
                    "remote": "%s/remote?k=%s" % (base, KEYS["admin"]), "deck": "%s/deck" % self.base(),
                    "phase": STATE["phase"], "online": online(), "joined": len(STATE["joined"]),
                    "deckSeen": now - DECKTAB["seen"] < 40, "problems": check_room(r),
                    "interactions": [{"id": d["id"], "type": d["type"], "prompt": d.get("prompt", ""), "options": d.get("options", []),
                                      "cards": [c.get("title", "") for c in d.get("cards", []) if isinstance(c, dict)]} for d in ROOMCFG["defs"].values()],
                    "takehome": bool(r.get("takehome")),
                }
            return self.send(200, out)

        if name == "export":
            with LOCK:
                out = {"title": room().get("title", ""), "exported": time.strftime("%Y-%m-%d %H:%M:%S"), "joined": len(STATE["joined"]),
                       "interactions": [dict(public_def(d), results=summary(d)) for d in defs().values()]}
            return self.send(200, json.dumps(out, indent=2), "application/json", [("Content-Disposition", 'attachment; filename="room-results.json"')])

        if name == "phase" and post:
            ph = str(self.body(1024).get("phase", ""))
            if ph not in ("wait", "takehome") and ph not in defs():
                return self.send(400, {"error": "unknown phase %r" % ph})
            with LOCK:
                if STATE["phase"] != ph:
                    STATE["phase"] = ph
                    touch()
            return self.send(200, {"phase": ph})

        if name == "reset" and post:
            i = self.body(1024).get("id")
            with LOCK:
                for bucket in ("answers", "manual", "questions", "hidden"):
                    if i:
                        STATE[bucket].pop(i, None)
                    else:
                        STATE[bucket] = {}
                if not i:
                    STATE["phase"], STATE["joined"] = "wait", []
                STATE["round"] += 1
                touch()
            return self.send(200, {"ok": True})

        if name == "manual" and post:  # hand counts typed on the remote
            b = self.body(2048)
            d = defs().get(str(b.get("id", "")))
            if not d or d["type"] != "choice":
                return self.send(400, {"error": "manual counts are for choice interactions"})
            counts = [max(0, min(100000, int(c))) for c in b.get("counts", [])][: len(d["options"])]
            with LOCK:
                STATE["manual"][d["id"]] = counts
                touch()
            return self.send(200, {"ok": True})

        if name == "moderate" and post:
            b = self.body(2048)
            i = str(b.get("id", ""))
            with LOCK:
                if "word" in b:
                    h = STATE["hidden"].setdefault(i, [])
                    w = str(b["word"]).lower()
                    if b.get("hidden", True) and w not in h:
                        h.append(w)
                    elif not b.get("hidden", True) and w in h:
                        h.remove(w)
                for q in STATE["questions"].get(i, []):
                    if q["id"] == b.get("qid"):
                        for flag in ("hidden", "done"):
                            if flag in b:
                                q[flag] = bool(b[flag])
                touch()
            return self.send(200, {"ok": True})

        # ---- remote <-> deck relay ------------------------------------------
        if name == "deck/hello" and post:
            b = self.body(4 << 20)
            ORIGIN["url"] = ORIGIN["url"] or self.base()
            with LOCK:
                DECKTAB.update(tab=str(b.get("tab", "")), title=str(b.get("title", "")), minutes=b.get("minutes") or 0,
                               slides=b.get("slides") or [], state=b.get("state") or {}, seen=now, sv=DECKTAB["sv"] + 1)
                touch()
                port = self.server.server_address[1]
                out = {"seq": SEQ, "phase": STATE["phase"], "online": online(), "join": "%s/?k=%s" % (public_base(port, self.base()), KEYS["room"])}
            return self.send(200, out)

        if name == "deck/state" and post:
            b = self.body(65536)
            with LOCK:
                if b.get("tab") == DECKTAB["tab"]:
                    DECKTAB["seen"] = now
                    if b.get("state") != DECKTAB["state"]:
                        DECKTAB["state"] = b.get("state") or {}
                        touch()
            return self.send(200, {"ok": True})

        if name == "deck/cmd" and not post:
            since = int(self.q.get("since", 0))
            with LOCK:
                if self.q.get("tab") == DECKTAB["tab"]:
                    DECKTAB["seen"] = now
                if since > SEQ:
                    since = SEQ
                LOCK.wait_for(lambda: SEQ > since, timeout=20)
                if self.q.get("tab") == DECKTAB["tab"]:
                    DECKTAB["seen"] = time.time()
                out = {"seq": SEQ, "cmds": [c for s, c in CMDS if s > since]}
            return self.send(200, out)

        if name == "remote/cmd" and post:
            b = self.body(4096)
            with LOCK:
                SEQ += 1
                CMDS.append((SEQ, b))
                del CMDS[:-200]
                LOCK.notify_all()
                n = SEQ
            return self.send(200, {"seq": n})

        if name == "remote/view" and not post:
            since = int(self.q.get("since", -1))
            with LOCK:
                if since > VER:
                    since = -1
                LOCK.wait_for(lambda: VER > since, timeout=20)
                out = {"ver": VER, "sv": DECKTAB["sv"], "title": DECKTAB["title"], "minutes": DECKTAB["minutes"], "state": DECKTAB["state"],
                       "connected": time.time() - DECKTAB["seen"] < 40, "phase": STATE["phase"], "online": online(), "round": STATE["round"]}
            return self.send(200, out)

        if name == "remote/slides" and not post:
            with LOCK:
                out = {"sv": DECKTAB["sv"], "slides": DECKTAB["slides"]}
            return self.send(200, out)

        self.send(404, {"error": "no such endpoint"})


class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 256

    def handle_error(self, request, client_address):
        if not isinstance(sys.exc_info()[1], (BrokenPipeError, ConnectionResetError, TimeoutError, socket.timeout)):
            super().handle_error(request, client_address)


def port_busy(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.4):
            return True
    except OSError:
        return False


def main():
    global ROOT, DECK, DATA, VERBOSE
    ap = argparse.ArgumentParser(description="Serve a masterclass deck, its phone remote and the audience room.")
    ap.add_argument("--deck", default=os.environ.get("DECK", "deck.html"), help="deck file (default deck.html)")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))
    ap.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    ap.add_argument("--tunnel", action="store_true", help="also open a public https link (needs cloudflared, no account)")
    ap.add_argument("--check", action="store_true", help="check the deck and its #room block for mistakes, then exit")
    ap.add_argument("--verbose", action="store_true", help="log every request")
    a = ap.parse_args()
    VERBOSE = a.verbose
    deck = os.path.abspath(a.deck)
    ROOT, DECK = os.path.dirname(deck), os.path.basename(deck)
    if not os.path.isfile(deck):
        sys.exit("No deck at %s. Run this from the talk folder, or pass --deck." % deck)
    os.chdir(ROOT)
    DATA = os.path.abspath(DATA)

    r = room()
    if a.check:
        with open(deck, encoding="utf-8") as f:
            problems, warnings = check_deck(f.read())
        for p in problems:
            print("PROBLEM  " + p)
        for w in warnings:
            print("warning  " + w)
        print("%s: %d interaction(s), %d problem(s), %d warning(s)" % ("fix the problems above" if problems else "deck ok", len(ROOMCFG["defs"]), len(problems), len(warnings)))
        sys.exit(1 if problems else 0)

    load()
    threading.Thread(target=saver, daemon=True).start()
    # Another program on the same port can go unnoticed (the bind succeeds, the browser reaches the other one),
    # so look first and move up to a free port.
    wanted = a.port
    while port_busy(a.port) and a.port < wanted + 20 and "PORT" not in os.environ:
        a.port += 1
    if port_busy(a.port):
        sys.exit("Port %d is already in use by another program. Stop it, or pass --port with a free one." % a.port)
    try:
        srv = Server((a.host, a.port), Handler)
    except OSError as e:
        sys.exit("Could not listen on port %d (%s). Try --port %d." % (a.port, e.strerror or e, a.port + 1))
    if a.port != wanted:
        print("  port %d is in use by another program; using %d" % (wanted, a.port), flush=True)

    if a.tunnel:
        print("  opening a public link…", flush=True)
        os.environ["PUBLIC_URL"] = start_tunnel(a.port)
    local = "http://localhost:%d" % a.port
    pub = public_base(a.port)
    print("\n  %s\n" % (r.get("title") or "Masterclass room"))
    print("  Start here   %s/setup?k=%s" % (local, KEYS["admin"]))
    print("  Slides       %s/deck?k=%s" % (local, KEYS["admin"]))
    print("  Remote       %s/remote?k=%s     (open on your phone)" % (pub, KEYS["admin"]))
    print("  Audience     %s/?k=%s           (the join QR points here)" % (pub, KEYS["room"]))
    if a.tunnel:
        print("\n  The public link can take up to a minute to start answering. It changes every time the server restarts.")
    print("\n  %d interaction(s) · state in %s · Ctrl-C to stop\n" % (len(ROOMCFG["defs"]), DATA), flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  stopped")


if __name__ == "__main__":
    main()
