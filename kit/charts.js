/* springprompt-masterclass · charts.js
   Small SVG charts for slides. No dependencies, no network.

   Authoring, inside a slide:
     <figure class="chart"><script type="application/json">{"type":"hbar","data":[…]}</script></figure>

   Every chart draws into a fixed viewBox (cfg.w × cfg.h, default 1168 × 430) because slides that
   are off screen are display:none and cannot be measured. Marks that should arrive one press at a
   time carry class "frag"; the deck shows them in DOM order. Guide: references/charts.md */
(function () {
  "use strict";

  const VERSION = "1.0.0";
  const NS = "http://www.w3.org/2000/svg";
  const FONT = 'Inter,-apple-system,"Segoe UI",system-ui,sans-serif';
  const DEFAULT_W = 1168, DEFAULT_H = 430;
  const HEIGHTS = { segmented: 170, timeline: 340 };          // starting heights; both then fit their content
  const ACCENT = "var(--ch-accent)", GREY = "var(--ch-grey)";
  const SERIES = i => "var(--ch-s" + (i + 1) + ")";            // categorical slots 1-4, validated as a set
  const TYPES = {};

  /* ── styles: tokens come from deck.css, with fallbacks so the file also works alone ───────── */
  const CSS = `
.chart{--ch-surface:var(--bg,#FAF7F0);--ch-ink:var(--ink,#1C2420);--ch-mute:var(--mute,#4A544F);--ch-faint:var(--faint,#7A827D);
  --ch-grid:var(--line,#E2DCCD);--ch-accent:var(--accent,#3E7A4F);--ch-bad:var(--bad,#B4472F);
  --ch-grey:color-mix(in srgb,var(--ch-faint) 50%,var(--ch-surface));--ch-axis:color-mix(in srgb,var(--ch-faint) 75%,var(--ch-surface));
  --ch-s1:#2B7444;--ch-s2:#C97409;--ch-s3:#4A80D0;--ch-s4:#822B6A;--ch-on-fill:#fff;
  --ch-seq-lo:#E7ECD9;--ch-seq-hi:#1F5C36;--ch-on-hi:#fff}
.night .chart{--ch-surface:var(--night,#1C2420);--ch-bad:#E0795F;
  --ch-s1:#5DA572;--ch-s2:#AA6412;--ch-s3:#598FE0;--ch-s4:#AC5291;--ch-on-fill:#10160F;
  --ch-seq-lo:#27342C;--ch-seq-hi:#9AD3A8;--ch-on-hi:#10160F}
.card .chart{--ch-surface:var(--panel,#fff)}
.ch-svg{font-family:var(--sans,${FONT});-webkit-font-smoothing:antialiased}
.ch-svg text{fill:var(--ch-mute)}
.ch-svg .ch-ink{fill:var(--ch-ink)}.ch-svg .ch-faint{fill:var(--ch-faint)}
.ch-svg .ch-on-fill{fill:var(--ch-on-fill)}.ch-svg .ch-on-hi{fill:var(--ch-on-hi)}
.ch-num{font-variant-numeric:tabular-nums}
.ch-halo{paint-order:stroke;stroke:var(--ch-surface);stroke-width:5px;stroke-linejoin:round}
.ch-grid{stroke:var(--ch-grid);stroke-width:1}.ch-axis{stroke:var(--ch-axis);stroke-width:1.5}
.ch-ring{stroke:var(--ch-surface);stroke-width:2}
.ch-line{fill:none;stroke-linecap:round;stroke-linejoin:round}
.ch-hit{fill:transparent;stroke:none}
.ch-cross{stroke:var(--ch-axis);stroke-width:1.5;opacity:0;pointer-events:none}
.ch-col:hover .ch-cross{opacity:1}
.ch-hot:hover .ch-mk{filter:brightness(1.12)}
/* reveal:"highlight": the grey stand-in fades out as its accent twin (the .frag before it) fades in */
@keyframes ch-out{to{opacity:0;visibility:hidden}}
.ch-hl.show+.ch-pre{animation:ch-out .45s both}
body.print .ch-pre{display:none}
body.print .ch-tip,body.print .ch-cross{display:none}
.ch-tip{position:absolute;left:0;top:0;z-index:8;pointer-events:none;background:var(--ch-ink);color:var(--ch-surface);border-radius:10px;
  padding:9px 13px;font:500 16px/1.4 var(--sans,${FONT});white-space:nowrap;opacity:0;transition:opacity .12s;box-shadow:0 10px 30px -12px #0008}
.ch-tip.on{opacity:1}
.ch-tip div{display:flex;align-items:center;gap:8px}
.ch-tip small{font-size:14px;opacity:.72;display:block;margin-bottom:2px}
.ch-tip b{font-weight:650;font-variant-numeric:tabular-nums}.ch-tip span{opacity:.8}
.ch-tip i{width:14px;height:3px;border-radius:2px;flex:none}
.ch-err{border:2px solid var(--ch-bad);background:color-mix(in srgb,var(--ch-bad) 8%,var(--ch-surface));color:var(--ch-ink);border-radius:12px;
  padding:18px 22px;font:500 18px/1.45 var(--mono,ui-monospace,Menlo,monospace);white-space:pre-wrap;overflow-wrap:anywhere}
.ch-err b{display:block;color:var(--ch-bad);font:650 14px/1 var(--sans,${FONT});letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px}
.ch-stats .stat{display:flex;flex-direction:column}
.ch-stats .stat b{font-variant-numeric:normal}
.ch-hero{display:block}.ch-hero .stat{background:none;border:0;box-shadow:none;padding:0}
.ch-hero .stat b{font-size:168px;letter-spacing:-.05em}.ch-hero .stat span{font-size:25px;margin-top:18px;max-width:760px}
.ch-delta{margin:12px 0 0;font-size:18px;line-height:1.3;color:var(--ch-ink);font-weight:600}
.ch-delta i{font-style:normal;margin-right:6px;color:var(--ch-faint)}
.ch-delta i.good{color:var(--ch-accent)}.ch-delta i.bad{color:var(--ch-bad)}
.ch-delta small{font-size:16px;font-weight:400;color:var(--ch-mute);margin-left:6px}
.ch-spark{display:block;width:100%;height:44px;margin-top:14px;overflow:visible}`;

  function injectCss() {
    if (document.getElementById("ch-css")) return;
    const s = document.createElement("style");
    s.id = "ch-css"; s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ── small helpers ─────────────────────────────────────────────────────────────────────── */
  function fail(msg) { throw new Error(msg); }
  const r1 = v => Math.round(v * 10) / 10;
  const isNum = v => typeof v === "number" && isFinite(v);

  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function html(name, cls, parent, text) {
    const n = document.createElement(name);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  // Text is measured on a canvas: hidden slides cannot be measured in the DOM.
  let pen;
  function textWidth(str, size, weight) {
    try {
      pen = pen || document.createElement("canvas").getContext("2d");
      pen.font = (weight || 400) + " " + size + "px " + FONT;
      return pen.measureText(String(str)).width * 1.03;
    } catch (e) { return String(str).length * size * 0.58; }
  }
  // label(parent, x, y, "text", {size, weight, anchor, cls, mid}) · mid centres it vertically on y
  function label(parent, x, y, str, o) {
    o = o || {};
    const t = el("text", { x: r1(x), y: r1(y), "font-size": o.size || 16, "font-weight": o.weight, "text-anchor": o.anchor,
      class: o.cls, dy: o.mid ? ".35em" : null }, parent);
    t.textContent = str == null ? "" : String(str);
    return t;
  }
  function tspan(parent, str, cls, weight, dx) {
    const t = el("tspan", { class: cls, "font-weight": weight, dx: dx }, parent);
    t.textContent = str;
    return t;
  }
  function wrap(str, size, weight, maxW, maxLines) {
    const words = String(str).split(/\s+/), out = [];
    let line = "";
    words.forEach(w => {
      const next = line ? line + " " + w : w;
      if (line && textWidth(next, size, weight) > maxW) { out.push(line); line = w; } else line = next;
    });
    out.push(line);
    if (maxLines && out.length > maxLines) { out.length = maxLines; out[maxLines - 1] += "…"; }
    return out;
  }
  // Several lines of text; y is the first baseline.
  function block(parent, x, y, lines, o, lineH) {
    lines.forEach((s, i) => label(parent, x, y + i * (lineH || (o.size || 16) * 1.25), s, o));
  }

  /* ── numbers, scales, ticks ────────────────────────────────────────────────────────────── */
  function decimalsOf(v) {
    const s = String(+Number(v).toPrecision(8)), i = s.indexOf(".");
    return i < 0 || s.indexOf("e") >= 0 ? 0 : s.length - i - 1;
  }
  // formatter({prefix, suffix, decimals, compact}, values) → f(value, decimalsOverride)
  function formatter(o, values) {
    o = o || {};
    const auto = values.every(v => v == null || Number.isInteger(v)) ? 0 : 1;
    const dec = o.decimals != null ? o.decimals : auto, pre = o.prefix || "", suf = o.suffix || "";
    return function (v, d) {
      if (!isNum(v)) return "–";
      let a = Math.abs(v), unit = "", dd = d != null ? d : dec;
      if (o.compact && a >= 1e4) {
        if (a >= 1e9) { a /= 1e9; unit = "B"; } else if (a >= 1e6) { a /= 1e6; unit = "M"; } else { a /= 1e3; unit = "K"; }
        dd = a < 100 && Math.round(a * 10) % 10 ? 1 : 0;
      }
      return (v < 0 ? "−" : "") + pre + a.toLocaleString("en-US", { minimumFractionDigits: dd, maximumFractionDigits: dd }) + unit + suf;
    };
  }
  function linear(d0, d1, a, b) { const k = (b - a) / ((d1 - d0) || 1); return v => a + (v - d0) * k; }
  function niceTicks(lo, hi, n) {
    if (lo === hi) hi = lo + 1;
    const raw = (hi - lo) / (n || 5), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag, out = [];
    for (let v = Math.floor(lo / step + 1e-9) * step; v <= hi + step * (1 - 1e-9); v += step) out.push(+v.toFixed(10));
    out.step = step;
    return out;
  }
  // One value axis: nice ticks, a formatter, and scale(a, b) mapping the domain onto pixels a → b.
  function axis(o, vals, name, n) {
    o = o || {};
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), tk;
    const fmt = formatter(o, vals);
    if (o.log) {
      if (lo <= 0) fail(name + ': a log axis needs every value above zero (lowest is ' + lo + ')');
      const L = Math.log10, pad = (L(hi) - L(lo)) * 0.07 || 0.2;
      lo = o.min != null ? o.min : Math.pow(10, L(lo) - pad); hi = o.max != null ? o.max : Math.pow(10, L(hi) + pad);
      tk = [];
      for (let k = Math.floor(L(lo)); k <= Math.ceil(L(hi)); k++) [1, 2, 5].forEach(m => { const v = m * Math.pow(10, k); if (v >= lo && v <= hi) tk.push(+v.toPrecision(6)); });
      if (tk.length > 7) tk = tk.filter(v => String(v).replace(/[0.]/g, "") === "1");
      return { ticks: tk, fmt: fmt, tick: v => fmt(v, decimalsOf(v)), label: o.label, lo: lo, hi: hi,
        scale: (a, b) => { const s = linear(L(lo), L(hi), a, b); return v => s(L(v)); } };
    }
    if (o.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const from = o.min != null ? o.min : lo, to = o.max != null ? o.max : hi;
    tk = niceTicks(from, to, n || 5);
    if (tk.step < 1 && o.decimals == null && vals.every(Number.isInteger)) tk = niceTicks(from, to, Math.max(1, to - from));   // whole things, whole ticks
    lo = o.min != null ? o.min : tk[0]; hi = o.max != null ? o.max : tk[tk.length - 1];
    const td = decimalsOf(tk.step) ? Math.max(decimalsOf(tk.step), o.decimals || 0) : 0;   // £1.20, not £1.2; but 5 h, not 5.0 h
    return { ticks: tk.filter(t => t >= lo - 1e-9 && t <= hi + 1e-9), fmt: fmt, tick: v => fmt(v, td), label: o.label, lo: lo, hi: hi,
      scale: (a, b) => linear(lo, hi, a, b) };
  }
  // Push label positions apart so none sit closer than `gap`, keeping them inside lo..hi.
  function spread(ys, gap, lo, hi) {
    const order = ys.map((y, i) => i).sort((a, b) => ys[a] - ys[b]), out = ys.slice();
    for (let k = 1; k < order.length; k++) out[order[k]] = Math.max(out[order[k]], out[order[k - 1]] + gap);
    const over = out[order[order.length - 1]] - hi;
    if (over > 0) {
      out[order[order.length - 1]] -= over;
      for (let k = order.length - 2; k >= 0; k--) out[order[k]] = Math.min(out[order[k]], out[order[k + 1]] - gap);
    }
    return out.map(y => Math.max(lo, y));
  }
  // A bar with a rounded data end and a square end on the baseline.
  function barPath(x, y, w, h, dir, r) {
    r = Math.max(0, Math.min(r == null ? 5 : r, dir === "up" || dir === "down" ? w / 2 : h / 2, dir === "up" || dir === "down" ? h : w));
    const X = x + w, Y = y + h;
    if (dir === "up") return `M${x},${Y}V${y + r}Q${x},${y} ${x + r},${y}H${X - r}Q${X},${y} ${X},${y + r}V${Y}Z`;
    if (dir === "down") return `M${x},${y}V${Y - r}Q${x},${Y} ${x + r},${Y}H${X - r}Q${X},${Y} ${X},${Y - r}V${y}Z`;
    if (dir === "left") return `M${X},${y}H${x + r}Q${x},${y} ${x},${y + r}V${Y - r}Q${x},${Y} ${x + r},${Y}H${X}Z`;
    return `M${x},${y}H${X - r}Q${X},${y} ${X},${y + r}V${Y - r}Q${X},${Y} ${X - r},${Y}H${x}Z`;
  }

  /* ── config checks: every message should tell an agent exactly what to fix ───────────────── */
  function rowsOf(cfg, fields, labelOptional) {
    const t = cfg.type, d = cfg.data;
    if (!Array.isArray(d) || !d.length) fail(t + ': "data" must be a non-empty array of rows like {"label":"…",' + fields.map(f => '"' + f + '":1').join(",") + "}");
    d.forEach((row, i) => {
      if (!row || typeof row !== "object") fail(t + ": data[" + i + "] must be an object");
      if (!labelOptional && (row.label == null || row.label === "")) fail(t + ": data[" + i + '] is missing "label"');
      fields.forEach(f => { if (!isNum(row[f])) fail(t + ": data[" + i + "]." + f + " must be a number, got " + JSON.stringify(row[f])); });
    });
    return d;
  }
  function seriesOf(cfg, key) {
    const t = cfg.type, xs = cfg.x, ss = cfg.series;
    if (!Array.isArray(xs) || xs.length < 2) fail(t + ': "x" must be an array of at least 2 labels, e.g. "x":["Mon","Tue","Wed"]');
    if (!Array.isArray(ss) || !ss.length) fail(t + ': "series" must be a non-empty array like [{"name":"Rye","' + key + '":[3,4,6]}]');
    ss.forEach((s, i) => {
      if (!s || s.name == null) fail(t + ": series[" + i + '] is missing "name"');
      if (!Array.isArray(s[key]) || s[key].length !== xs.length) fail(t + ': series "' + s.name + '" needs ' + xs.length + ' "' + key + '", one per x label (got ' + (Array.isArray(s[key]) ? s[key].length : typeof s[key]) + ")");
      s[key].forEach((v, j) => { if (v != null && !isNum(v)) fail(t + ': series "' + s.name + '" ' + key + "[" + j + "] must be a number or null, got " + JSON.stringify(v)); });
    });
    return ss;
  }
  function emphasis(list) {
    list = list == null ? [] : [].concat(list).map(String);
    return {
      any: list.length > 0, list: list,
      has: label => list.indexOf(String(label)) >= 0,
      check: (labels, type) => list.forEach(h => {
        if (labels.map(String).indexOf(h) < 0) fail(type + ': highlight "' + h + '" matches nothing. Available: ' + labels.slice(0, 14).join(", "));
      })
    };
  }
  // More identities than the four validated colours can carry: ask for emphasis instead.
  function paletteLimit(c, n, what) {
    if (n > 4 && !c.em.any) fail(c.cfg.type + ": " + n + " " + what + " but only 4 series colours. Set \"highlight\" to the one that matters (the rest turn grey), or cut to 4.");
  }
  const tone = (c, i, n, on) => c.em.any ? (on ? ACCENT : GREY) : n > 1 ? SERIES(i) : ACCENT;

  /* ── staging ───────────────────────────────────────────────────────────────────────────────
     stage() draws one item (a bar, a row, a series, a point) and applies cfg.reveal:
       "none"       everything is there from the start
       "items"      each item's mark is a .frag: one press each, in data order
       "highlight"  highlighted items are drawn grey, with an accent twin that arrives as a .frag
       "notes"      only annotations, reference and trend lines are staged
     mark(g, on) paints the mark and its value; frame(g, on) paints what is always there (its
     category label). `on` is true when the item wears its colour rather than grey. */
  function stage(c, parent, key, mark, frame) {
    const hl = c.em.has(key), on = !c.em.any || hl, item = el("g", { class: "ch-item" }, parent);
    if (c.reveal === "highlight" && hl) {
      const over = el("g", { class: "frag ch-hl" }, item), pre = el("g", { class: "ch-pre" }, item);
      if (frame) { frame(over, true); frame(pre, false); }
      mark(over, true); mark(pre, false);
    } else {
      if (frame) frame(item, on);
      mark(c.reveal === "items" ? el("g", { class: "frag" }, item) : item, on);
    }
    return item;
  }
  // A layer for an annotation, reference line or trend line: it arrives last when the chart is staged.
  const noteLayer = c => el("g", { class: c.reveal === "none" ? "ch-note" : "ch-note frag" }, c.svg);
  function revealMode(cfg, em) {
    const r = cfg.reveal == null || cfg.reveal === false ? "none" : String(cfg.reveal);
    const mode = { none: "none", items: "items", rows: "items", points: "items", series: "items", bars: "items", highlight: "highlight", notes: "notes", annotations: "notes" }[r];
    if (!mode) fail('reveal must be "none", "items" (alias "rows", "points", "series"), "highlight" or "notes", got ' + JSON.stringify(cfg.reveal));
    if (mode === "highlight" && !em.any) fail('reveal:"highlight" needs "highlight" to name what turns accent');
    return mode;
  }

  /* ── hover layer ───────────────────────────────────────────────────────────────────────── */
  // tip(node, "heading", [{name, value, color, item}]) · rows whose item is not yet revealed stay hidden
  function tip(node, head, rows) { node.__tip = { head: head, rows: rows }; node.classList.add("ch-hot"); return node; }
  function wireHover(fig, root) {
    let box, shown;
    const hide = () => { if (box) box.classList.remove("on"); shown = null; };
    root.addEventListener("pointerleave", hide);
    root.addEventListener("pointermove", e => {
      if (document.body.classList.contains("print")) return;
      let n = e.target;
      while (n && n !== root && !n.__tip) n = n.parentNode;
      if (!n || !n.__tip) return hide();
      if (!box) box = html("div", "ch-tip", fig);
      box.setAttribute("data-ch", "");
      if (shown !== n) {
        shown = n; box.textContent = "";
        if (n.__tip.head != null) html("small", null, box, n.__tip.head);
        n.__tip.rows.forEach(r => {
          if (r.item && r.item.querySelector(":scope > .frag:not(.show)") && !r.item.querySelector(":scope > .ch-pre")) return;
          const row = html("div", null, box);
          if (r.color) html("i", null, row).style.background = r.color;
          html("b", null, row, r.value);
          if (r.name != null) html("span", null, row, r.name);
        });
      }
      // The stage is scaled by a CSS transform: convert the pointer into the figure's own pixels.
      const rect = fig.getBoundingClientRect(), k = rect.width / fig.offsetWidth || 1;
      let x = (e.clientX - rect.left) / k + 16, y = (e.clientY - rect.top) / k - box.offsetHeight - 14;
      if (x + box.offsetWidth > fig.offsetWidth) x -= box.offsetWidth + 32;
      box.style.transform = "translate(" + r1(Math.max(0, x)) + "px," + r1(y) + "px)";
      box.classList.add("on");
    });
  }

  /* ── shared drawing ────────────────────────────────────────────────────────────────────── */
  function yGrid(g, ax, y, x0, x1) {
    ax.ticks.forEach(t => {
      el("line", { x1: x0, x2: x1, y1: r1(y(t)), y2: r1(y(t)), class: t === 0 ? "ch-axis" : "ch-grid" }, g);
      label(g, x0 - 10, y(t), ax.tick(t), { size: 16, anchor: "end", mid: true, cls: "ch-faint ch-num" });
    });
  }
  const gutterOf = ax => Math.max.apply(null, ax.ticks.map(t => textWidth(ax.tick(t), 16))) + 14;
  // A reference line with a label: horizontal at a y value, or vertical at an x value.
  function refLine(c, ref, pos, horizontal, a, b, fmt, atStart) {
    if (!ref || !isNum(ref.value)) return;
    const g = noteLayer(c), p = r1(pos(ref.value)), text = ref.label != null ? ref.label : fmt(ref.value);
    if (horizontal) {
      el("line", { x1: a, x2: b, y1: p, y2: p, stroke: "var(--ch-ink)", "stroke-width": 1.5 }, g);
      label(g, atStart ? a : b, p - 9, text, { size: 16, weight: 600, anchor: atStart ? "start" : "end", cls: "ch-ink ch-halo" });
    } else {
      el("line", { x1: p, x2: p, y1: a, y2: b, stroke: "var(--ch-ink)", "stroke-width": 1.5 }, g);
      const tw = textWidth(text, 16, 600), end = p + 8 + tw > c.w;
      label(g, end ? p - 8 : p + 8, a + 13, text, { size: 16, weight: 600, anchor: end ? "end" : "start", cls: "ch-ink ch-halo" });
    }
  }
  function dot(g, x, y, r, fill, cls) { return el("circle", { cx: r1(x), cy: r1(y), r: r, fill: fill, class: "ch-ring " + (cls || "ch-mk") }, g); }
  function hollow(g, x, y, r, color) { return el("circle", { cx: r1(x), cy: r1(y), r: r, fill: "var(--ch-surface)", stroke: color, "stroke-width": 2.5, class: "ch-mk" }, g); }

  /* ── bar: vertical bars, a few categories ──────────────────────────────────────────────── */
  TYPES.bar = function (c) {
    const cfg = c.cfg, data = rowsOf(cfg, ["value"]), vals = data.map(d => d.value), n = data.length;
    c.em.check(data.map(d => d.label), "bar");
    const showVals = cfg.values !== false, refV = cfg.ref && isNum(cfg.ref.value) ? [cfg.ref.value] : [];
    const ax = axis({ prefix: cfg.prefix, suffix: cfg.suffix, decimals: cfg.decimals, compact: cfg.compact, max: cfg.max, zero: true }, vals.concat(refV), "bar", 4);
    const lo = Math.min(0, Math.min.apply(null, vals)), hi = cfg.max != null ? cfg.max : showVals ? Math.max.apply(null, vals.concat(refV, 0)) : ax.hi;
    const x0 = showVals ? 0 : gutterOf(ax), band = (c.w - x0) / n, bw = Math.min(band * 0.6, 72);
    const cats = data.map(d => wrap(d.label, 17, 600, band - 14, 2)), catH = Math.max.apply(null, cats.map(l => l.length)) * 21 + 14;
    const top = c.top + (cfg.yLabel ? 30 : 0) + (showVals ? 32 : 8), bottom = c.bottom - catH - (lo < 0 && showVals ? 26 : 0);
    const y = linear(showVals ? lo : Math.min(lo, ax.lo), hi, bottom, top);
    if (cfg.yLabel) label(c.svg, 0, c.top + 14, cfg.yLabel, { size: 16, cls: "ch-faint" });
    const frame = el("g", null, c.svg), marks = el("g", null, c.svg);
    if (!showVals) yGrid(frame, ax, y, x0, c.w);
    el("line", { x1: x0, x2: c.w, y1: r1(y(0)), y2: r1(y(0)), class: "ch-axis" }, frame);
    data.forEach((d, i) => {
      const cx = x0 + band * (i + 0.5), neg = d.value < 0, yv = y(d.value), y0 = y(0);
      const item = stage(c, marks, d.label, (g, on) => {
        el("path", { d: barPath(r1(cx - bw / 2), r1(Math.min(yv, y0)), r1(bw), r1(Math.abs(yv - y0)), neg ? "down" : "up", 6), fill: on ? ACCENT : GREY, class: "ch-mk" }, g);
        if (showVals) label(g, cx, neg ? yv + 24 : yv - 10, ax.fmt(d.value), { size: 21, weight: on ? 650 : 500, anchor: "middle", cls: on ? "ch-ink" : null });
      }, (g, on) => block(g, cx, c.bottom - catH + 32, cats[i], { size: 17, weight: on && c.em.any ? 650 : 500, anchor: "middle", cls: on ? "ch-ink" : null }, 21));
      el("rect", { x: r1(cx - band / 2), y: top - 30, width: r1(band), height: c.bottom - top + 30, class: "ch-hit" }, item);
      tip(item, d.label, [{ value: ax.fmt(d.value) }]);
    });
    // The reference label sits at whichever end has bars that stay clear of it.
    const clear = d => !cfg.ref || d.value < 0 || y(d.value) - (showVals ? 34 : 4) > y(cfg.ref.value);
    const span = cfg.ref ? Math.ceil((textWidth(cfg.ref.label != null ? cfg.ref.label : ax.fmt(cfg.ref.value), 16, 600) + 4) / band) : 1;
    refLine(c, cfg.ref, y, true, x0, c.w, ax.fmt, !data.slice(-span).every(clear) && data.slice(0, span).every(clear));
  };

  /* ── hbar: ranked horizontal bars with the value at the tip ────────────────────────────── */
  TYPES.hbar = function (c) {
    const cfg = c.cfg;
    let data = rowsOf(cfg, ["value"]);
    data.forEach((d, i) => { if (d.value < 0) fail("hbar: data[" + i + "].value is negative; hbar grows from zero. Use bar for values below zero"); });
    c.em.check(data.map(d => d.label), "hbar");
    if (cfg.sort !== false) data = data.slice().sort((a, b) => cfg.sort === "asc" ? a.value - b.value : b.value - a.value);
    const vals = data.map(d => d.value), fmt = formatter(cfg, vals), n = data.length;
    const labW = Math.min(c.w * 0.38, Math.max.apply(null, data.map(d => textWidth(d.label, 19, 650)))) + 18;
    const valW = Math.max.apply(null, vals.map(v => textWidth(fmt(v), 21, 650))) + 12;
    const top = c.top + (cfg.ref ? 26 : 0), band = (c.bottom - top) / n, bh = Math.min(band * 0.52, 30);
    const x = linear(0, cfg.max != null ? cfg.max : Math.max.apply(null, vals.concat(cfg.ref && isNum(cfg.ref.value) ? cfg.ref.value : 0)), labW, c.w - valW);
    const marks = el("g", null, c.svg);
    data.forEach((d, i) => {
      const cy = top + band * (i + 0.5), lines = wrap(d.label, 19, 600, labW - 18, 2);
      const item = stage(c, marks, d.label, (g, on) => {
        el("path", { d: barPath(r1(labW), r1(cy - bh / 2), r1(Math.max(2, x(d.value) - labW)), r1(bh), "right", 6), fill: on ? ACCENT : GREY, class: "ch-mk" }, g);
        label(g, x(d.value) + 10, cy, fmt(d.value), { size: 21, weight: on ? 650 : 500, mid: true, cls: on ? "ch-ink ch-num" : "ch-num" });
      }, (g, on) => block(g, 0, cy + 6.5 - (lines.length - 1) * 11.5, lines, { size: 19, weight: on && c.em.any ? 650 : 500, cls: on ? "ch-ink" : null }, 23));
      el("rect", { x: 0, y: r1(cy - band / 2), width: c.w, height: r1(band), class: "ch-hit" }, item);
      tip(item, d.label, [{ value: fmt(d.value) }]);
    });
    el("line", { x1: labW, x2: labW, y1: top, y2: c.bottom, class: "ch-axis" }, c.svg);
    refLine(c, cfg.ref, x, false, top - 26, c.bottom, fmt);
  };

  /* ── line: 1-4 series with direct end labels ───────────────────────────────────────────── */
  TYPES.line = function (c) {
    const cfg = c.cfg, series = seriesOf(cfg, "values"), xs = cfg.x, n = xs.length;
    c.em.check(series.map(s => s.name), "line");
    paletteLimit(c, series.length, "series");
    const all = [].concat.apply([], series.map(s => s.values)).filter(isNum);
    if (!all.length) fail("line: every value is null");
    const lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    const ax = axis({ prefix: cfg.prefix, suffix: cfg.suffix, decimals: cfg.decimals, compact: cfg.compact, min: cfg.min, max: cfg.max,
      zero: cfg.zero != null ? cfg.zero : lo >= 0 && (lo <= hi * 0.3 || (!!cfg.area && cfg.min == null)) }, all.concat(cfg.ref && isNum(cfg.ref.value) ? cfg.ref.value : []), "line", 4);
    const labelled = series.map(s => cfg.endLabels !== false && (!c.em.any || series.length <= 6 || c.em.has(s.name)));
    const endText = s => cfg.endValues === false ? "" : ax.fmt(s.values[lastOf(s)]);
    const lastOf = s => { let i = n - 1; while (i > 0 && !isNum(s.values[i])) i--; return i; };
    const endW = Math.max.apply(null, series.map((s, i) => labelled[i] ? textWidth(s.name, 18, 650) + textWidth(endText(s), 18) + 34 : 20));
    const x0 = gutterOf(ax), x1 = c.w - Math.min(endW, c.w * 0.4), top = c.top + (cfg.yLabel ? 34 : 10), bottom = c.bottom - 34;
    const x = i => x0 + (x1 - x0) * i / (n - 1), y = ax.scale(bottom, top);
    if (cfg.yLabel) label(c.svg, 0, c.top + 14, cfg.yLabel, { size: 16, cls: "ch-faint" });
    const frame = el("g", null, c.svg), marks = el("g", null, c.svg);
    yGrid(frame, ax, y, x0, x1);
    const every = Math.max(1, Math.ceil((Math.max.apply(null, xs.map(s => textWidth(s, 16))) + 18) / ((x1 - x0) / (n - 1))));
    xs.forEach((s, i) => { if ((n - 1 - i) % every === 0) label(frame, x(i), bottom + 26, s, { size: 16, anchor: "middle", cls: "ch-faint" }); });
    const ends = series.map(s => y(s.values[lastOf(s)])), endY = spread(ends, 24, top, bottom), items = [];
    // Context lines go underneath, unless the series arrive one press at a time (then data order).
    const order = series.map((s, i) => i).sort((a, b) => c.reveal === "items" ? 0 : c.em.has(series[a].name) - c.em.has(series[b].name));
    order.forEach(i => {
      const s = series[i], last = lastOf(s);
      let d = "", pen = false;
      s.values.forEach((v, j) => { if (isNum(v)) { d += (pen ? "L" : "M") + r1(x(j)) + "," + r1(y(v)); pen = true; } else pen = false; });
      items[i] = stage(c, marks, s.name, (g, on) => {
        const col = tone(c, i, series.length, on), strong = on && (c.em.any || series.length === 1);
        if (cfg.area && series.length === 1 && ax.lo === 0) el("path", { d: d + "L" + r1(x(last)) + "," + bottom + "L" + r1(x(0)) + "," + bottom + "Z", fill: col, opacity: 0.1 }, g);
        el("path", { d: d, stroke: col, "stroke-width": on ? (strong ? 4 : 3) : 2.5, class: "ch-line" }, g);
        dot(g, x(last), ends[i], on ? 6 : 5, col);
        if (!labelled[i]) return;
        if (Math.abs(endY[i] - ends[i]) > 3) el("line", { x1: x(last) + 8, y1: ends[i], x2: x(last) + 15, y2: endY[i], stroke: "var(--ch-axis)", "stroke-width": 1 }, g);
        const t = label(g, x(last) + 18, endY[i], "", { size: 18, mid: true });
        tspan(t, s.name, on ? "ch-ink" : null, on ? 650 : 500);
        if (endText(s)) tspan(t, endText(s), "ch-num", 400, 8);
      });
    });
    refLine(c, cfg.ref, y, true, x0, x1, ax.fmt);
    const samples = [];
    series.forEach(s => s.values.forEach((v, j) => {
      if (!j || !isNum(v) || !isNum(s.values[j - 1])) return;
      for (let t = 0; t <= 1; t += 0.05) samples.push([x(j - 1) + (x(j) - x(j - 1)) * t, y(s.values[j - 1]) + (y(v) - y(s.values[j - 1])) * t]);
    }));
    (cfg.annotations || []).forEach((a, k) => {
      const j = typeof a.x === "number" ? a.x : xs.map(String).indexOf(String(a.x));
      const si = a.series != null ? series.findIndex(s => s.name === a.series) : Math.max(0, series.findIndex(s => c.em.has(s.name)));
      if (j < 0 || j >= n) fail("line: annotations[" + k + '].x "' + a.x + '" is not one of the x labels');
      if (si < 0 || !isNum(series[si].values[j])) fail("line: annotations[" + k + "] points at a series or value that does not exist");
      const g = noteLayer(c), px = x(j), py = y(series[si].values[j]), lines = wrap(a.text || "", 17, 600, 260), L = lines.length;
      const tw = Math.max.apply(null, lines.map(l => textWidth(l, 17, 600)));
      // Try above and below, centred or to either side, and keep the spot that crosses the fewest lines.
      let best = null;
      (a.side === "below" || a.side === "above" ? [a.side] : ["above", "below"]).forEach(side => ["middle", "end", "start"].forEach(anchor => {
        const bx = anchor === "middle" ? px - tw / 2 : anchor === "end" ? px + 6 - tw : px - 6;
        const by = side === "above" ? py - 43 - (L - 1) * 22 : py + 22, bh = L * 22 + 6;
        const out = bx < x0 - 30 || bx + tw > c.w || by < top - 14 || by + bh > bottom;
        const score = (out ? 1000 : 0) + samples.filter(p => p[0] > bx - 5 && p[0] < bx + tw + 5 && p[1] > by - 3 && p[1] < by + bh + 3).length;
        if (!best || score < best.score) best = { score: score, side: side, anchor: anchor };
      }));
      const below = best.side === "below", anchor = best.anchor;
      hollow(g, px, py, 7, tone(c, si, series.length, !c.em.any || c.em.has(series[si].name)));
      el("line", { x1: px, x2: px, y1: below ? py + 10 : py - 10, y2: below ? py + 20 : py - 20, stroke: "var(--ch-axis)", "stroke-width": 1.5 }, g);
      block(g, px + (anchor === "start" ? -6 : anchor === "end" ? 6 : 0), below ? py + 39 : py - 27 - (L - 1) * 22, lines, { size: 17, weight: 600, anchor: anchor, cls: "ch-ink ch-halo" }, 22);
    });
    const hover = el("g", null, c.svg), step = (x1 - x0) / (n - 1);
    xs.forEach((s, i) => {
      const col = el("g", { class: "ch-col" }, hover);
      el("rect", { x: r1(x(i) - step / 2), y: top, width: r1(step), height: bottom - top, class: "ch-hit" }, col);
      el("line", { x1: r1(x(i)), x2: r1(x(i)), y1: top, y2: bottom, class: "ch-cross" }, col);
      tip(col, s, series.map((se, k) => ({ value: ax.fmt(se.values[i]), name: se.name, color: tone(c, k, series.length, !c.em.any || c.em.has(se.name)), item: items[k] })).filter(r => r.value !== "–"));
    });
  };

  /* ── slope: before → after, one line per item ──────────────────────────────────────────── */
  TYPES.slope = function (c) {
    const cfg = c.cfg, data = rowsOf(cfg, ["from", "to"]), cols = cfg.labels || ["Before", "After"], n = data.length;
    c.em.check(data.map(d => d.label), "slope");
    const all = [].concat.apply([], data.map(d => [d.from, d.to])), fmt = formatter(cfg, all), names = cfg.names || "right";
    const nameW = Math.max.apply(null, data.map(d => textWidth(d.label, 18, 650))) + 10;
    const valW = Math.max.apply(null, all.map(v => textWidth(fmt(v), 19, 650))) + 16;
    const x0 = valW + (names !== "right" ? nameW : 0), x1 = c.w - valW - (names !== "left" ? nameW : 0), top = c.top + 48, bottom = c.bottom - 14;
    const lo = cfg.min != null ? cfg.min : Math.min.apply(null, all), hi = cfg.max != null ? cfg.max : Math.max.apply(null, all), y = linear(lo, hi, bottom, top);
    label(c.svg, x0, c.top + 16, cols[0], { size: 16, weight: 600, anchor: "middle" });
    label(c.svg, x1, c.top + 16, cols[1], { size: 16, weight: 600, anchor: "middle" });
    el("line", { x1: x0, x2: x0, y1: top - 14, y2: bottom + 10, class: "ch-grid" }, c.svg);
    el("line", { x1: x1, x2: x1, y1: top - 14, y2: bottom + 10, class: "ch-grid" }, c.svg);
    const yl = spread(data.map(d => y(d.from)), 24, top, bottom), yr = spread(data.map(d => y(d.to)), 24, top, bottom), marks = el("g", null, c.svg);
    const order = data.map((d, i) => i).sort((a, b) => c.reveal === "items" ? 0 : c.em.has(data[a].label) - c.em.has(data[b].label));
    order.forEach(i => {
      const d = data[i];
      const item = stage(c, marks, d.label, (g, on) => {
        const col = on ? ACCENT : GREY;
        el("line", { x1: x0, y1: r1(y(d.from)), x2: x1, y2: r1(y(d.to)), stroke: col, "stroke-width": on ? 3.5 : 2.5, class: "ch-line ch-mk" }, g);
        dot(g, x0, y(d.from), on ? 6 : 5, col); dot(g, x1, y(d.to), on ? 6 : 5, col);
        const side = (px, py, v, end, named) => {
          const t = label(g, px, py, "", { size: 18, mid: true, anchor: end ? "end" : "start" });
          const val = () => tspan(t, fmt(v), on ? "ch-ink ch-num" : "ch-num", on ? 650 : 500, end && named ? 8 : null);
          const name = () => tspan(t, d.label, on ? "ch-ink" : null, on ? 600 : 400, !end ? 8 : null);
          if (end) { if (named) name(); val(); } else { val(); if (named) name(); }
        };
        side(x0 - 14, yl[i], d.from, true, names !== "right");
        side(x1 + 14, yr[i], d.to, false, names !== "left");
      });
      tip(item, d.label, [{ value: fmt(d.from), name: cols[0] }, { value: fmt(d.to), name: cols[1] }]);
    });
  };

  /* ── dumbbell: the gap between two values, row by row ──────────────────────────────────── */
  TYPES.dumbbell = function (c) {
    const cfg = c.cfg, cols = cfg.labels || ["Before", "After"];
    let data = rowsOf(cfg, ["from", "to"]);
    c.em.check(data.map(d => d.label), "dumbbell");
    if (cfg.sort === "gap") data = data.slice().sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));
    const all = [].concat.apply([], data.map(d => [d.from, d.to])), n = data.length, showVals = cfg.values !== false;
    const ax = axis({ prefix: cfg.prefix, suffix: cfg.suffix, decimals: cfg.decimals, compact: cfg.compact, min: cfg.min, max: cfg.max, zero: cfg.zero }, all, "dumbbell", 5);
    const labW = Math.min(c.w * 0.36, Math.max.apply(null, data.map(d => textWidth(d.label, 19, 650)))) + 22;
    const valW = showVals ? Math.max.apply(null, all.map(v => textWidth(ax.fmt(v), 19, 650))) + 16 : 16;
    const top = c.top + 40, bottom = c.bottom - (showVals ? 4 : 34), band = (bottom - top) / n, x = ax.scale(labW + valW, c.w - valW);
    // key: which dot is which
    const key = el("g", null, c.svg), k2 = labW + valW + textWidth(cols[0], 16) + 46;
    hollow(key, labW + valW + 8, c.top + 12, 6.5, "var(--ch-axis)"); label(key, labW + valW + 22, c.top + 12, cols[0], { size: 16, mid: true });
    dot(key, k2, c.top + 12, 7.5, "var(--ch-axis)"); label(key, k2 + 14, c.top + 12, cols[1], { size: 16, mid: true });
    const frame = el("g", null, c.svg), marks = el("g", null, c.svg);
    if (!showVals) ax.ticks.forEach(t => {
      el("line", { x1: r1(x(t)), x2: r1(x(t)), y1: top, y2: bottom, class: "ch-grid" }, frame);
      label(frame, x(t), bottom + 24, ax.tick(t), { size: 16, anchor: "middle", cls: "ch-faint ch-num" });
    });
    data.forEach((d, i) => {
      const cy = top + band * (i + 0.5), xa = x(d.from), xb = x(d.to), up = d.to >= d.from, lines = wrap(d.label, 19, 600, labW - 22, 2);
      const item = stage(c, marks, d.label, (g, on) => {
        const col = on ? ACCENT : GREY;
        el("line", { x1: r1(xa), x2: r1(xb), y1: r1(cy), y2: r1(cy), stroke: col, "stroke-width": 5, opacity: on ? 0.38 : 0.6, "stroke-linecap": "round" }, g);
        hollow(g, xa, cy, 7, col); dot(g, xb, cy, 8.5, col);
        if (!showVals) return;
        label(g, xa + (up ? -15 : 15), cy, ax.fmt(d.from), { size: 18, mid: true, anchor: up ? "end" : "start", cls: "ch-num" });
        label(g, xb + (up ? 16 : -16), cy, ax.fmt(d.to), { size: 19, weight: on ? 650 : 500, mid: true, anchor: up ? "start" : "end", cls: on ? "ch-ink ch-num" : "ch-num" });
      }, (g, on) => block(g, 0, cy + 6.5 - (lines.length - 1) * 11.5, lines, { size: 19, weight: on && c.em.any ? 650 : 500, cls: on ? "ch-ink" : null }, 23));
      if (i) el("line", { x1: 0, x2: c.w, y1: r1(cy - band / 2), y2: r1(cy - band / 2), class: "ch-grid" }, frame);
      el("rect", { x: 0, y: r1(cy - band / 2), width: c.w, height: r1(band), class: "ch-hit" }, item);
      tip(item, d.label, [{ value: ax.fmt(d.from), name: cols[0] }, { value: ax.fmt(d.to), name: cols[1] }]);
    });
  };

  /* ── scatter: two measures, a few named points, optional trend, frontier, quadrants ───── */
  let clipId = 0;
  TYPES.scatter = function (c) {
    const cfg = c.cfg, data = rowsOf(cfg, ["x", "y"], true);
    c.em.check(data.map(d => d.label).filter(l => l != null), "scatter");
    const ax = axis(cfg.xAxis, data.map(d => d.x), "scatter xAxis", 6), ay = axis(cfg.yAxis, data.map(d => d.y), "scatter yAxis", 5);
    const x0 = gutterOf(ay), x1 = c.w - 18, top = c.top + (ay.label ? 34 : 10), bottom = c.bottom - 32 - (ax.label ? 26 : 0);
    const x = ax.scale(x0, x1), y = ay.scale(bottom, top), frame = el("g", null, c.svg);
    yGrid(frame, ay, y, x0, x1);
    ax.ticks.forEach(t => {
      el("line", { x1: r1(x(t)), x2: r1(x(t)), y1: top, y2: bottom, class: "ch-grid" }, frame);
      label(frame, x(t), bottom + 25, ax.tick(t), { size: 16, anchor: "middle", cls: "ch-faint ch-num" });
    });
    if (ay.label) label(frame, 0, c.top + 14, ay.label, { size: 16, cls: "ch-faint" });
    if (ax.label) label(frame, x1, bottom + 52, ax.label, { size: 16, anchor: "end", cls: "ch-faint" });
    // Everything that takes up room is logged in `taken`, so labels can be put where nothing else is.
    const pts = data.map(d => [x(d.x), y(d.y)]), taken = pts.map(p => [p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8]);
    const pick = opts => {      // opts: boxes [left, top, right, bottom]; returns the one that hits least, and claims it
      let best = null, low = Infinity;
      opts.forEach(o => {
        const out = o[0] < x0 - 4 || o[2] > c.w || o[1] < top - 12 || o[3] > bottom + 4;
        const score = (out ? 100 : 0) + taken.filter(t => o[0] < t[2] && o[2] > t[0] && o[1] < t[3] && o[3] > t[1]).length;
        if (score < low) { low = score; best = o; }
      });
      taken.push(best);
      return best;
    };
    const wall = (xa, ya, xb, yb) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(xb - xa, yb - ya) / 12));
      for (let i = 0; i <= steps; i++) { const px = xa + (xb - xa) * i / steps, py = ya + (yb - ya) * i / steps; taken.push([px - 3, py - 3, px + 3, py + 3]); }
    };
    const q = cfg.quadrants;
    if (q) {
      const g = el("g", null, c.svg), qx = isNum(q.x) ? x(q.x) : (x0 + x1) / 2, qy = isNum(q.y) ? y(q.y) : (top + bottom) / 2, L = q.labels || [];
      el("line", { x1: r1(qx), x2: r1(qx), y1: top, y2: bottom, class: "ch-axis" }, g);
      el("line", { x1: x0, x2: x1, y1: r1(qy), y2: r1(qy), class: "ch-axis" }, g);
      wall(qx, top, qx, bottom); wall(x0, qy, x1, qy);
      [[x0 + 10, top + 22, "start"], [x1 - 10, top + 22, "end"], [x0 + 10, bottom - 12, "start"], [x1 - 10, bottom - 12, "end"]].forEach((p, i) => {
        if (!L[i]) return;
        const tw = textWidth(L[i], 16, 650), bx = p[2] === "end" ? p[0] - tw : p[0];
        label(g, p[0], p[1], L[i], { size: 16, weight: 650, anchor: p[2], cls: "ch-faint ch-halo" });
        taken.push([bx, p[1] - 16, bx + tw, p[1] + 5]);
      });
    }
    // Trend: least squares, fitted in screen space so it is also right on a log axis.
    const m = pts.length, sx = pts.reduce((s, p) => s + p[0], 0) / m, sy = pts.reduce((s, p) => s + p[1], 0) / m;
    const k = pts.reduce((s, p) => s + (p[0] - sx) * (p[1] - sy), 0) / (pts.reduce((s, p) => s + (p[0] - sx) * (p[0] - sx), 0) || 1), fit = px => sy + k * (px - sx);
    if (cfg.trend) wall(x0, fit(x0), x1, fit(x1));
    // Frontier: "top-left" means the best points are high and to the left.
    const f = cfg.frontier ? String(cfg.frontier.corner || cfg.frontier) : "", up = f.indexOf("bottom") < 0, left = f.indexOf("right") < 0;
    let edge = [], reach = up ? Infinity : -Infinity;
    if (cfg.frontier) {
      if (!/^(top|bottom)-(left|right)$/.test(f)) fail('scatter: frontier must be "top-left", "top-right", "bottom-left" or "bottom-right" (the corner where the best points are), got ' + JSON.stringify(cfg.frontier));
      edge = pts.slice().sort((a, b) => left ? a[0] - b[0] : b[0] - a[0]).filter(p => (up ? p[1] < reach : p[1] > reach) && ((reach = p[1]), true));
      edge.forEach((p, i) => { if (i) wall(edge[i - 1][0], edge[i - 1][1], p[0], p[1]); });
    }
    // Point labels try four positions around their point; highlighted points choose first.
    const named = d => d.label != null && (cfg.labels === "all" || (cfg.labels !== "none" && c.em.has(d.label)));
    const order = data.map((d, i) => i).sort((a, b) => c.em.has(data[a].label) - c.em.has(data[b].label)), spots = [];
    order.slice().reverse().forEach(i => {
      if (!named(data[i])) return;
      const px = pts[i][0], py = pts[i][1], tw = textWidth(data[i].label, 18, 650);
      spots[i] = pick([[px + 12, py - 10, px + 12 + tw, py + 10], [px - 12 - tw, py - 10, px - 12, py + 10], [px - tw / 2, py - 33, px + tw / 2, py - 13], [px - tw / 2, py + 13, px + tw / 2, py + 33]]);
    });
    const marks = el("g", null, c.svg);
    order.forEach(i => {
      const d = data[i], px = pts[i][0], py = pts[i][1];
      const draw = (g, on) => {
        dot(g, px, py, on && c.em.any ? 8 : 6.5, on ? ACCENT : GREY).setAttribute("opacity", on && !c.em.any ? 0.85 : 1);
        if (spots[i] && (on || !c.em.has(d.label))) label(g, spots[i][0], spots[i][1] + 16, d.label, { size: 18, weight: on && c.em.any ? 650 : 500, cls: (on ? "ch-ink" : "") + " ch-halo" });
      };
      // Context points are part of the frame; only highlighted points are staged.
      let item;
      if (c.reveal === "items" && !c.em.has(d.label) && c.em.any) { item = el("g", { class: "ch-item" }, marks); draw(item, false); }
      else item = stage(c, marks, d.label, draw);
      el("circle", { cx: r1(px), cy: r1(py), r: 15, class: "ch-hit" }, item);
      tip(item, d.label != null ? d.label : null, [{ value: ax.fmt(d.x), name: ax.label || "x" }, { value: ay.fmt(d.y), name: ay.label || "y" }]);
    });
    // Regions, trend and frontier come after the points in the DOM, so they arrive last when staged.
    (cfg.regions || []).forEach(r => {
      const g = noteLayer(c), rx = r.x || [ax.lo, ax.hi], ry = r.y || [ay.lo, ay.hi];
      const ax0 = Math.max(x0, Math.min(x(rx[0]), x(rx[1]))), ax1 = Math.min(x1, Math.max(x(rx[0]), x(rx[1])));
      const ay0 = Math.max(top, Math.min(y(ry[0]), y(ry[1]))), ay1 = Math.min(bottom, Math.max(y(ry[0]), y(ry[1])));
      el("rect", { x: r1(ax0), y: r1(ay0), width: r1(ax1 - ax0), height: r1(ay1 - ay0), rx: 8, fill: ACCENT, opacity: 0.1, "pointer-events": "none" }, g);
      if (!r.label) return;
      const tw = textWidth(r.label, 16, 650), at = pick([[ax0 + 12, ay0 + 8], [ax0 + 12, ay1 - 30], [ax1 - 12 - tw, ay0 + 8], [ax1 - 12 - tw, ay1 - 30]].map(o => [o[0], o[1], o[0] + tw, o[1] + 22]));
      label(g, at[0], at[1] + 17, r.label, { size: 16, weight: 650, cls: "ch-ink ch-halo" });
    });
    if (cfg.trend) {
      const g = noteLayer(c), id = "ch-clip" + (++clipId);
      el("rect", { x: x0, y: top, width: x1 - x0, height: bottom - top }, el("clipPath", { id: id }, g));
      el("line", { x1: x0, y1: r1(fit(x0)), x2: x1, y2: r1(fit(x1)), stroke: "var(--ch-ink)", "stroke-width": 2, opacity: 0.6, "clip-path": "url(#" + id + ")", "pointer-events": "none" }, g);
      if (cfg.trend.label) {      // above or below the line, at either end
        const tw = textWidth(cfg.trend.label, 16, 600), ends = [[x1 - 8 - tw, x1 - 8], [x0 + 8, x0 + 8 + tw]], opts = [];
        ends.forEach(e => { opts.push([e[0], Math.min(fit(e[0]), fit(e[1])) - 32, e[1], Math.min(fit(e[0]), fit(e[1])) - 10]); });
        ends.forEach(e => { opts.push([e[0], Math.max(fit(e[0]), fit(e[1])) + 10, e[1], Math.max(fit(e[0]), fit(e[1])) + 32]); });
        const at = pick(opts);
        label(g, at[0], at[1] + 17, cfg.trend.label, { size: 16, weight: 600, cls: "ch-ink ch-halo" });
      }
    }
    if (cfg.frontier) {
      const g = noteLayer(c);
      el("path", { d: "M" + edge.map(p => r1(p[0]) + "," + r1(p[1])).join("L"), stroke: "var(--ch-ink)", "stroke-width": 2, opacity: 0.6, class: "ch-line", "pointer-events": "none" }, g);
      if (cfg.frontier.label) {   // on the empty side of the line, beside whichever corner of it is clearest
        const tw = textWidth(cfg.frontier.label, 16, 600);
        const at = pick([0.5, 0.3, 0.7, 0.15, 0.85, 1, 0].map(t => edge[Math.round(t * (edge.length - 1))]).map(p => {
          const bx = left ? p[0] - 14 - tw : p[0] + 14, by = up ? p[1] - 34 : p[1] + 12;
          return [bx, by, bx + tw, by + 22];
        }));
        label(g, at[0], at[1] + 17, cfg.frontier.label, { size: 16, weight: 600, cls: "ch-ink ch-halo" });
      }
    }
  };

  /* ── heatmap: one hue, light → dark ────────────────────────────────────────────────────── */
  TYPES.heatmap = function (c) {
    const cfg = c.cfg, rows = cfg.rows, cols = cfg.cols, v = cfg.values;
    if (!Array.isArray(rows) || !Array.isArray(cols) || !rows.length || !cols.length) fail('heatmap: needs "rows" and "cols" (arrays of labels) and "values" (one array per row)');
    if (!Array.isArray(v) || v.length !== rows.length) fail('heatmap: "values" needs ' + rows.length + " arrays, one per row (got " + (Array.isArray(v) ? v.length : typeof v) + ")");
    v.forEach((r, i) => { if (!Array.isArray(r) || r.length !== cols.length) fail('heatmap: values[' + i + '] ("' + rows[i] + '") needs ' + cols.length + " numbers, one per column"); });
    const flat = [].concat.apply([], v).filter(isNum), lo = cfg.min != null ? cfg.min : Math.min.apply(null, flat), hi = cfg.max != null ? cfg.max : Math.max.apply(null, flat);
    const fmt = formatter(cfg, flat), pairs = rows.map(r => cols.map(k => r + "|" + k));
    c.em.check(rows.concat(cols, [].concat.apply([], pairs)), "heatmap");
    const labW = Math.max.apply(null, rows.map(r => textWidth(r, 17, 600))) + 14, top = c.top + 30, cw = (c.w - labW) / cols.length;
    const chh = Math.min(64, (c.bottom - top - 40) / rows.length), every = Math.max(1, Math.ceil((Math.max.apply(null, cols.map(k => textWidth(k, 16))) + 10) / cw));
    const fill = t => "color-mix(in oklab,var(--ch-seq-hi) " + Math.round(t * 100) + "%,var(--ch-seq-lo))";
    cols.forEach((k, j) => { if (j % every === 0) label(c.svg, labW + cw * (j + 0.5), c.top + 17, k, { size: 16, anchor: "middle", cls: c.em.has(k) ? "ch-ink" : "ch-faint", weight: c.em.has(k) ? 650 : null }); });
    const marks = el("g", null, c.svg), rings = [];
    rows.forEach((r, i) => {
      const y = top + chh * i, g = el("g", { class: c.reveal === "items" ? "frag" : null }, marks);
      label(marks, labW - 14, y + chh / 2, r, { size: 17, anchor: "end", mid: true, weight: c.em.has(r) ? 650 : 500, cls: c.em.has(r) ? "ch-ink" : null });
      cols.forEach((k, j) => {
        const val = v[i][j], t = isNum(val) ? Math.max(0, Math.min(1, (val - lo) / ((hi - lo) || 1))) : null, cx = labW + cw * j;
        const cell = el("g", null, g), on = c.em.has(r + "|" + k);
        el("rect", { x: r1(cx + 1), y: r1(y + 1), width: r1(cw - 2), height: r1(chh - 2), rx: 4, fill: t == null ? "var(--ch-grid)" : fill(t), opacity: t == null ? 0.5 : null, class: "ch-mk" }, cell);
        if (t != null && (cfg.cells || on) && cw >= textWidth(fmt(val), 16, 600) + 8) label(cell, cx + cw / 2, y + chh / 2, fmt(val), { size: 16, weight: 600, anchor: "middle", mid: true, cls: (t > 0.5 ? "ch-on-hi" : "ch-ink") + " ch-num" });
        tip(cell, r + " · " + k, [{ value: fmt(val) }]);
        if (on) rings.push([cx, y, cw, chh]);
      });
      if (c.em.has(r)) rings.push([labW, y, c.w - labW, chh]);
    });
    cols.forEach((k, j) => { if (c.em.has(k)) rings.push([labW + cw * j, top, cw, chh * rows.length]); });
    // Emphasis on a heatmap is an ink outline: the fill already carries the value.
    rings.forEach(b => el("rect", { x: r1(b[0]), y: r1(b[1]), width: r1(b[2]), height: r1(b[3]), rx: 6, fill: "none", stroke: "var(--ch-ink)", "stroke-width": 3,
      class: c.reveal === "highlight" || c.reveal === "items" ? "frag" : null }, c.svg));
    // key: low value, five steps of the ramp, high value
    const ky = top + chh * rows.length + 16, kx = c.w - 5 * 34 - textWidth(fmt(hi), 15) - 10;
    for (let s = 0; s < 5; s++) el("rect", { x: r1(kx + s * 34 + 1), y: ky, width: 32, height: 12, rx: 3, fill: fill(s / 4) }, c.svg);
    label(c.svg, kx - 10, ky + 6, fmt(lo), { size: 15, anchor: "end", mid: true, cls: "ch-faint ch-num" });
    label(c.svg, c.w, ky + 6, fmt(hi), { size: 15, anchor: "end", mid: true, cls: "ch-faint ch-num" });
    if (cfg.scaleLabel) label(c.svg, kx - 26 - textWidth(fmt(lo), 15), ky + 6, cfg.scaleLabel, { size: 15, anchor: "end", mid: true, cls: "ch-faint" });
  };

  /* ── stat: a hero number or a row of tiles (HTML, built on deck.css .stats / .stat) ────── */
  TYPES.stat = function (c) {
    const cfg = c.cfg, data = cfg.data;
    if (!Array.isArray(data) || !data.length) fail('stat: "data" must be a non-empty array like [{"value":37,"suffix":"%","label":"cycle to work"}]');
    if (data.length > 4) fail("stat: " + data.length + " tiles is a table, not a headline. Keep it to 4 or fewer");
    data.forEach((d, i) => { if (!d || d.value == null) fail("stat: data[" + i + '] is missing "value"'); });
    c.em.check(data.map(d => d.label), "stat");
    const hero = cfg.hero != null ? cfg.hero : data.length === 1, root = html("div", "stats ch-stats" + (hero ? " ch-hero" : ""));
    root.style.setProperty("--n", data.length);
    root.setAttribute("role", "group"); root.setAttribute("aria-label", cfg.alt || "Key figures");
    data.forEach(d => {
      const tile = html("div", "stat" + (c.reveal === "items" ? " frag" : ""), root), o = Object.assign({}, cfg, d);
      const num = html("b", c.em.has(d.label) || (hero && !c.em.any && cfg.accent !== false) ? "accent" : null, tile);
      if (isNum(d.value) && (o.compact || d.value < 0)) num.textContent = formatter(o, [d.value])(d.value);
      else if (isNum(d.value)) {
        num.textContent = formatter(o, [d.value])(d.value);
        // deck.js counts these up; the final text above is already correct without it
        num.setAttribute("data-count", d.value);
        if (o.prefix) num.setAttribute("data-prefix", o.prefix);
        if (o.suffix) num.setAttribute("data-suffix", o.suffix);
        num.setAttribute("data-decimals", o.decimals != null ? o.decimals : Number.isInteger(d.value) ? 0 : 1);
      } else num.textContent = String(d.value);
      if (d.label) html("span", null, tile, d.label);
      if (isNum(d.delta)) {
        const p = html("p", "ch-delta", tile), up = d.delta > 0, good = d.delta === 0 || d.good == null ? null : (d.good === "down") !== up;
        html("i", good == null ? null : good ? "good" : "bad", p, d.delta === 0 ? "●" : up ? "▲" : "▼");
        p.appendChild(document.createTextNode((up ? "+" : "") + formatter({ suffix: d.deltaSuffix != null ? d.deltaSuffix : "", decimals: d.deltaDecimals }, [d.delta])(d.delta)));
        if (d.deltaLabel) html("small", null, p, d.deltaLabel);
      }
      if (Array.isArray(d.trend) && d.trend.length > 1) {   // sparkline: grey line, accent last point
        const s = el("svg", { viewBox: "0 0 200 44", preserveAspectRatio: "none", class: "ch-spark", "aria-hidden": "true" }, tile);
        const sx = linear(0, d.trend.length - 1, 4, 196), sy = linear(Math.min.apply(null, d.trend), Math.max.apply(null, d.trend), 38, 6);
        el("path", { d: "M" + d.trend.map((v, i) => r1(sx(i)) + "," + r1(sy(v))).join("L"), stroke: GREY, "stroke-width": 2.5, class: "ch-line", "vector-effect": "non-scaling-stroke" }, s);
        el("path", { d: "M196," + r1(sy(d.trend[d.trend.length - 1])) + "h0.01", stroke: ACCENT, "stroke-width": 10, "stroke-linecap": "round", "vector-effect": "non-scaling-stroke" }, s);
      }
    });
    const foot = footText(cfg);
    if (foot) html("p", "sm", root, foot).style.cssText = "grid-column:1/-1;font-size:14px;color:var(--ch-faint)";
    return root;
  };

  /* ── dots: a unit grid, "37 in 100" ────────────────────────────────────────────────────── */
  TYPES.dots = function (c) {
    const cfg = c.cfg, groups = Array.isArray(cfg.data) ? rowsOf(cfg, ["value"]) : [{ label: cfg.label, value: cfg.value }];
    groups.forEach((g, i) => { if (!isNum(g.value) || g.value < 0 || !Number.isInteger(g.value)) fail("dots: " + (cfg.data ? "data[" + i + "].value" : '"value"') + " must be a whole number of units, got " + JSON.stringify(g.value)); });
    const sum = groups.reduce((s, g) => s + g.value, 0), total = cfg.total != null ? cfg.total : cfg.data ? sum : 100, n = groups.length;
    if (!Number.isInteger(total) || total < 1 || total > 1000) fail('dots: "total" must be a whole number from 1 to 1000, got ' + JSON.stringify(cfg.total));
    if (sum > total) fail("dots: the values add up to " + sum + ", more than total " + total);
    c.em.check(groups.map(g => g.label), "dots");
    paletteLimit(c, n, "groups");
    const legend = groups.some(g => g.label) || cfg.rest, top = c.top + (legend ? 44 : 0), ph = c.bottom - top;
    // Pick the column count that gives the biggest dots, preferring full rows.
    let cols = cfg.cols, cell = 0;
    if (!cols) for (let k = 1; k <= total; k++) {
      if (total % k && total > 12 && [5, 10, 20, 25, 50].some(m => total % m === 0)) continue;
      const s = Math.min(c.w / k, ph / Math.ceil(total / k));
      if (s > cell) { cell = s; cols = k; }
    }
    cell = Math.min(c.w / cols, ph / Math.ceil(total / cols), 60);
    const fmt = formatter(cfg, [total]), at = k => [cell * (k % cols + 0.5), top + cell * (Math.floor(k / cols) + 0.5)], r = r1(cell * 0.36);
    const base = el("g", null, c.svg), marks = el("g", null, c.svg);
    for (let k = sum; k < total; k++) el("circle", { cx: r1(at(k)[0]), cy: r1(at(k)[1]), r: r, fill: GREY, opacity: 0.55 }, base);
    let k0 = 0, lx = 0;
    const key = (g, text, value, col, on, opacity) => {
      el("circle", { cx: lx + 8, cy: c.top + 14, r: 8, fill: col, opacity: opacity }, g);
      const t = label(g, lx + 24, c.top + 14, "", { size: 19, mid: true });
      tspan(t, value, on ? "ch-ink ch-num" : "ch-num", 650); tspan(t, text, on ? "ch-ink" : null, on ? 600 : 400, 8);
      lx += 24 + textWidth(value, 19, 650) + 8 + textWidth(text, 19, 600) + 34;
    };
    groups.forEach((gr, i) => {
      const from = k0, x = lx; k0 += gr.value;
      for (let k = from; k < k0; k++) el("circle", { cx: r1(at(k)[0]), cy: r1(at(k)[1]), r: r, fill: GREY, opacity: 0.55 }, base);   // the seat under each dot
      if (gr.label) lx += 24 + textWidth(fmt(gr.value), 19, 650) + 8 + textWidth(gr.label, 19, 600) + 34;
      const item = stage(c, marks, gr.label, (g, on) => {
        const col = tone(c, i, n, on), keep = lx;
        el("path", { d: "M0,0", fill: "none" }, g);
        for (let k = from; k < k0; k++) el("circle", { cx: r1(at(k)[0]), cy: r1(at(k)[1]), r: r, fill: col, class: "ch-mk" }, g);
        if (gr.label) { lx = x; key(g, gr.label, fmt(gr.value), col, on); lx = keep; }
      });
      tip(item, gr.label || null, [{ value: fmt(gr.value), name: "of " + fmt(total) }]);
    });
    if (cfg.rest && sum < total) key(base, cfg.rest, fmt(total - sum), GREY, false, 0.55);
  };

  /* ── segmented: one whole, split into parts ────────────────────────────────────────────── */
  TYPES.segmented = function (c) {
    const cfg = c.cfg, data = rowsOf(cfg, ["value"]), n = data.length, total = data.reduce((s, d) => s + d.value, 0);
    data.forEach((d, i) => { if (d.value < 0) fail("segmented: data[" + i + "].value is negative; parts of a whole cannot be"); });
    if (!total) fail("segmented: the values add up to zero");
    if (n > 8) fail("segmented: " + n + " parts is too many to read. Fold the tail into \"Other\" (8 at most), or use hbar");
    c.em.check(data.map(d => d.label), "segmented");
    paletteLimit(c, n, "parts");
    const fmt = formatter(cfg, data.map(d => d.value)), show = d => cfg.show === "value" ? fmt(d.value) : Math.round(d.value / total * 100) + "%";
    let x = 0, lx = 0, ly = 0;
    // Figures go on the segments only when every one fits; otherwise they all move to the key, so the eye reads them in one place.
    const allFit = data.every(d => !d.value || d.value / total * c.w >= textWidth(show(d), 21, 650) + 26);
    const parts = data.map(d => {             // lay the key out first: it decides how tall the figure is
      const w = d.value / total * c.w, text = show(d), fits = allFit;
      const keyW = 24 + textWidth(d.label, 18, 600) + (fits ? 0 : 8 + textWidth(text, 18, 650)) + 32;
      if (lx && lx + keyW - 32 > c.w) { lx = 0; ly += 30; }
      const part = { w: w, x0: x, text: text, fits: fits, kx: lx, ky: ly };
      lx += keyW; x += w;
      return part;
    });
    c.fit(c.top + 56 + 34 + ly + 12);
    const bh = Math.max(28, Math.min(56, c.bottom - c.top - 46 - ly)), marks = el("g", null, c.svg);
    data.forEach((d, i) => {
      const w = parts[i].w, x0 = parts[i].x0, text = parts[i].text, fits = parts[i].fits, kx = parts[i].kx, ky = c.top + bh + 34 + parts[i].ky;
      if (!d.value) return;
      const item = stage(c, marks, d.label, (g, on) => {
        const col = tone(c, i, n, on), grey = col === GREY;
        el("rect", { x: r1(x0 + (i ? 1 : 0)), y: c.top, width: r1(Math.max(1, w - (i ? 1 : 0) - (i < n - 1 ? 1 : 0))), height: bh, rx: 6, fill: col, class: "ch-mk" }, g);
        if (fits) label(g, x0 + 13, c.top + bh / 2, text, { size: 21, weight: 650, mid: true, cls: (grey ? "ch-ink" : "ch-on-fill") + " ch-num" });
        el("rect", { x: kx, y: ky - 8, width: 16, height: 16, rx: 4, fill: col }, g);
        const t = label(g, kx + 24, ky, "", { size: 18, mid: true });
        tspan(t, d.label, on ? "ch-ink" : null, on && c.em.any ? 650 : 500);
        if (!fits) tspan(t, text, "ch-num", 650, 8);     // a segment was too narrow to print on: the figures are in the key
      });
      tip(item, d.label, [{ value: fmt(d.value), name: Math.round(d.value / total * 100) + "% of " + fmt(total) }]);
    });
  };

  /* ── timeline: dated events along one axis ─────────────────────────────────────────────── */
  const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  function parseDate(v, where) {
    if (isNum(v)) return { t: v, text: String(v) };
    const m = /^(-?\d{1,4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(String(v).trim());
    if (!m) fail(where + ' must be a year, "YYYY-MM" or "YYYY-MM-DD", got ' + JSON.stringify(v) + '. For free-text dates set "spacing":"even"');
    const mo = m[2] ? +m[2] : 0, day = m[3] ? +m[3] : 0;
    return { t: +m[1] + (mo ? (mo - 1) / 12 : 0) + (day ? (day - 1) / 372 : 0), text: (day ? day + " " : "") + (mo ? MONTHS[mo - 1] + " " : "") + m[1] };
  }
  TYPES.timeline = function (c) {
    const cfg = c.cfg, data = cfg.data, even = cfg.spacing === "even";
    if (!Array.isArray(data) || data.length < 2) fail('timeline: "data" must be an array of at least 2 events like {"date":"2021-03","label":"Second oven"}');
    const ev = data.map((d, i) => {
      if (!d || d.date == null || !d.label) fail("timeline: data[" + i + '] needs "date" and "label"');
      const p = even ? { t: i, text: String(d.date) } : parseDate(d.date, "timeline: data[" + i + "].date");
      return { d: d, t: p.t, when: d.when || p.text, lines: wrap(d.label, 18, 650, cfg.labelWidth || 190, 3), note: d.note ? wrap(d.note, 16, 400, cfg.labelWidth || 190, 2) : [] };
    }).sort((a, b) => a.t - b.t);
    c.em.check(ev.map(e => e.d.label), "timeline");
    const pad = 70, x = linear(ev[0].t, ev[ev.length - 1].t, pad, c.w - pad), lastRight = {}, reach = { a: 0, b: 0 };
    ev.forEach(e => {
      e.x = x(e.t);
      e.w = Math.max(textWidth(e.when, 15, 650), Math.max.apply(null, e.lines.map(l => textWidth(l, 18, 650)).concat(e.note.map(l => textWidth(l, 16)))));
      e.h = 20 + e.lines.length * 23 + e.note.length * 21;
      e.left = Math.max(0, Math.min(c.w - e.w, e.x - e.w / 2));
    });
    const tall = Math.max.apply(null, ev.map(e => e.h)) + 16;
    ev.forEach((e, i) => {      // alternate sides; step out a level when a neighbour is in the way
      const first = i % 2 ? "b" : "a", second = first === "a" ? "b" : "a", slots = [first + 0, second + 0, first + 1, second + 1, first + 2, second + 2];
      const slot = slots.filter(s => (lastRight[s] == null || e.left >= lastRight[s] + 18))[0] || slots[0];
      lastRight[slot] = e.left + e.w; e.side = slot[0]; e.stem = 34 + (+slot[1]) * tall;
      reach[e.side] = Math.max(reach[e.side], e.stem + e.h);
    });
    c.fit(c.top + reach.a + reach.b + 20);
    const free = c.bottom - c.top - reach.a - reach.b, ay = c.top + reach.a + Math.max(0, free) / 2;
    el("line", { x1: 0, x2: c.w, y1: r1(ay), y2: r1(ay), stroke: "var(--ch-axis)", "stroke-width": 2, "stroke-linecap": "round" }, c.svg);
    const marks = el("g", null, c.svg);
    ev.forEach(e => {
      const up = e.side === "a", y0 = up ? ay - e.stem - e.h : ay + e.stem, anchor = e.left === 0 ? "start" : e.left === c.w - e.w ? "end" : "middle";
      const tx = anchor === "start" ? 0 : anchor === "end" ? c.w : e.x;
      const item = stage(c, marks, e.d.label, (g, on) => {
        el("line", { x1: r1(e.x), x2: r1(e.x), y1: r1(up ? ay - 9 : ay + 9), y2: r1(up ? ay - e.stem + 4 : ay + e.stem - 4), stroke: "var(--ch-axis)", "stroke-width": 1.5 }, g);
        dot(g, e.x, ay, on && c.em.any ? 9 : 7.5, on ? ACCENT : GREY);
        label(g, tx, y0 + 14, e.when, { size: 15, weight: 650, anchor: anchor, cls: "ch-faint ch-num" });
        block(g, tx, y0 + 38, e.lines, { size: 18, weight: on ? 650 : 500, anchor: anchor, cls: on ? "ch-ink" : null }, 23);
        block(g, tx, y0 + 38 + e.lines.length * 23, e.note, { size: 16, anchor: anchor }, 21);
      });
      el("rect", { x: r1(e.left), y: r1(Math.min(y0, ay - 12)), width: r1(e.w), height: r1(e.h + e.stem + 12), class: "ch-hit" }, item);
      tip(item, e.when, [{ value: e.d.label }]);
    });
  };

  /* ── rank: bump chart of rank changes ──────────────────────────────────────────────────── */
  TYPES.rank = function (c) {
    const cfg = c.cfg, series = seriesOf(cfg, "ranks"), xs = cfg.x, n = xs.length;
    c.em.check(series.map(s => s.name), "rank");
    paletteLimit(c, series.length, "series");
    const maxRank = Math.max.apply(null, [].concat.apply([], series.map(s => s.ranks)).filter(isNum));
    const nameW = Math.max.apply(null, series.map(s => textWidth(s.name, 18, 650))) + 22;
    const x0 = 34 + nameW, x1 = c.w - nameW, top = c.top + 52, bottom = c.bottom - 14;
    const x = i => x0 + (x1 - x0) * i / (n - 1), y = r => maxRank === 1 ? (top + bottom) / 2 : top + (bottom - top) * (r - 1) / (maxRank - 1);
    xs.forEach((s, i) => label(c.svg, x(i), c.top + 16, s, { size: 16, weight: 600, anchor: "middle" }));
    for (let r = 1; r <= maxRank; r++) label(c.svg, 0, y(r), r, { size: 16, mid: true, cls: "ch-faint ch-num" });
    const marks = el("g", null, c.svg);
    const order = series.map((s, i) => i).sort((a, b) => c.reveal === "items" ? 0 : c.em.has(series[a].name) - c.em.has(series[b].name));
    order.forEach(i => {
      const s = series[i], first = s.ranks.findIndex(isNum), last = n - 1 - s.ranks.slice().reverse().findIndex(isNum);
      let d = "";
      s.ranks.forEach((r, j) => {
        if (!isNum(r)) return;
        const prev = j && isNum(s.ranks[j - 1]), mid = (x(j - 1) + x(j)) / 2;
        d += prev ? "C" + r1(mid) + "," + r1(y(s.ranks[j - 1])) + " " + r1(mid) + "," + r1(y(r)) + " " + r1(x(j)) + "," + r1(y(r)) : "M" + r1(x(j)) + "," + r1(y(r));
      });
      const item = stage(c, marks, s.name, (g, on) => {
        const col = tone(c, i, series.length, on), strong = on && c.em.any;
        el("path", { d: d, stroke: col, "stroke-width": strong ? 5 : on ? 3.5 : 2.5, class: "ch-line ch-mk" }, g);
        s.ranks.forEach((r, j) => { if (isNum(r)) dot(g, x(j), y(r), strong ? 8 : on ? 6.5 : 5.5, col); });
        label(g, x(first) - 16, y(s.ranks[first]), s.name, { size: 18, weight: on ? 650 : 500, anchor: "end", mid: true, cls: on ? "ch-ink" : null });
        label(g, x(last) + 16, y(s.ranks[last]), s.name, { size: 18, weight: on ? 650 : 500, mid: true, cls: on ? "ch-ink" : null });
      });
      tip(item, s.name, [{ value: "#" + s.ranks[first], name: xs[first] }, { value: "#" + s.ranks[last], name: xs[last] }]);
    });
  };

  /* ── histogram: how the values are spread ──────────────────────────────────────────────── */
  TYPES.histogram = function (c) {
    const cfg = c.cfg;
    let bins;
    if (Array.isArray(cfg.values)) {
      const v = cfg.values.filter(isNum);
      if (v.length < 2) fail('histogram: "values" needs at least 2 numbers');
      const lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
      const step = cfg.step || niceTicks(lo, hi, cfg.bins || Math.min(16, Math.max(5, Math.ceil(Math.sqrt(v.length))))).step, start = Math.floor(lo / step + 1e-9) * step;
      bins = [];
      for (let a = start; a < hi || !bins.length; a = +(a + step).toFixed(10)) bins.push({ from: a, to: +(a + step).toFixed(10), count: 0 });
      v.forEach(val => { bins[Math.min(bins.length - 1, Math.floor((val - start) / step + 1e-9))].count++; });
    } else if (Array.isArray(cfg.data) && cfg.data.length) {
      bins = cfg.data;
      bins.forEach((b, i) => { if (!b || !isNum(b.from) || !isNum(b.to) || !isNum(b.count)) fail("histogram: data[" + i + '] must look like {"from":0,"to":5,"count":12}'); });
    } else fail('histogram: give raw numbers in "values" (binned for you; set "bins" or "step"), or bins in "data" like [{"from":0,"to":5,"count":12}]');
    const lo = bins[0].from, hi = bins[bins.length - 1].to, fx = formatter(cfg, bins.map(b => b.from).concat(hi)), xd = decimalsOf(bins[0].to - bins[0].from);
    const marked = c.em.list.map(Number);
    marked.forEach(h => { if (!(h >= lo && h <= hi)) fail("histogram: highlight " + h + " is outside the data (" + lo + " to " + hi + "). Highlight takes a value; the bin holding it turns accent"); });
    const inBin = (b, i) => marked.some(h => h >= b.from && (h < b.to || (i === bins.length - 1 && h <= b.to)));
    const ay = axis({ zero: true, max: cfg.max, compact: cfg.compact, suffix: cfg.countSuffix }, bins.map(b => b.count), "histogram", 4);
    const x0 = gutterOf(ay), top = c.top + (cfg.yLabel ? 34 : cfg.ref ? 26 : 10), bottom = c.bottom - 34 - (cfg.xLabel ? 26 : 0);
    const x = linear(lo, hi, x0, c.w), y = ay.scale(bottom, top), frame = el("g", null, c.svg), marks = el("g", null, c.svg);
    if (cfg.yLabel) label(frame, 0, c.top + 14, cfg.yLabel, { size: 16, cls: "ch-faint" });
    if (cfg.xLabel) label(frame, c.w, bottom + 52, cfg.xLabel, { size: 16, anchor: "end", cls: "ch-faint" });
    yGrid(frame, ay, y, x0, c.w);
    const edges = bins.map(b => b.from).concat(hi), every = Math.max(1, Math.ceil((Math.max.apply(null, edges.map(e => textWidth(fx(e, xd), 16))) + 16) / ((c.w - x0) / bins.length)));
    edges.forEach((e, i) => { if (i % every === 0) label(frame, x(e), bottom + 25, fx(e, xd), { size: 16, anchor: i === edges.length - 1 ? "end" : "middle", cls: "ch-faint ch-num" }); });
    bins.forEach((b, i) => {
      const on = !c.em.any || inBin(b, i), name = fx(b.from, xd) + " to " + fx(b.to, xd), hl = c.em.any && on;
      const item = el("g", { class: "ch-item" }, marks), shape = col => ({ d: barPath(r1(x(b.from) + 1), r1(y(b.count)), r1(x(b.to) - x(b.from) - 2), r1(bottom - y(b.count)), "up", 3), fill: col, class: "ch-mk" });
      if (c.reveal === "highlight" && hl) { el("path", shape(ACCENT), el("g", { class: "frag ch-hl" }, item)); el("path", shape(GREY), el("g", { class: "ch-pre" }, item)); }
      else el("path", shape(on ? ACCENT : GREY), c.reveal === "items" ? el("g", { class: "frag" }, item) : item);
      el("rect", { x: r1(x(b.from)), y: top, width: r1(x(b.to) - x(b.from)), height: bottom - top, class: "ch-hit" }, item);
      tip(item, name, [{ value: ay.fmt(b.count) }]);
    });
    refLine(c, cfg.ref, x, false, top - (cfg.ref && !cfg.yLabel ? 26 : 0), bottom, fx);
  };

  /* ── render ────────────────────────────────────────────────────────────────────────────── */
  const footText = cfg => [cfg.note, cfg.source && "Source: " + cfg.source].filter(Boolean).join(" · ");
  function readConfig(fig) {
    const s = fig.querySelector(':scope > script[type="application/json"]');
    if (!s) fail('no config found. Put <script type="application/json">{"type":"hbar","data":[…]}</script> inside the figure');
    try { return JSON.parse(s.textContent); } catch (e) {
      const at = /position (\d+)/.exec(e.message), near = at ? "\nnear: " + s.textContent.slice(Math.max(0, +at[1] - 40), +at[1] + 20).replace(/\s+/g, " ") : "";
      fail("the config is not valid JSON (" + e.message + ")" + near + "\nJSON needs double quotes, no trailing commas, no comments");
    }
  }
  function size(v, fallback, name) {
    if (v == null) return fallback;
    if (!isNum(v) || v < 120 || v > 4000) fail('"' + name + '" must be a number of pixels between 120 and 4000, got ' + JSON.stringify(v));
    return v;
  }
  function build(fig, cfg) {
    if (cfg == null) cfg = readConfig(fig);
    if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) fail('the config must be a JSON object like {"type":"hbar","data":[…]}');
    const draw = TYPES[cfg.type];
    if (!draw) fail((cfg.type == null ? 'the config has no "type"' : 'unknown type "' + cfg.type + '"') + ". Types: " + Object.keys(TYPES).join(", "));
    const w = size(cfg.w, DEFAULT_W, "w"), h = size(cfg.h, HEIGHTS[cfg.type] || DEFAULT_H, "h"), em = emphasis(cfg.highlight);
    const svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": cfg.alt || cfg.type + " chart", class: "ch-svg ch-" + cfg.type });
    const c = { cfg: cfg, svg: svg, w: w, h: h, top: 2, bottom: h - 2, em: em, reveal: revealMode(cfg, em) };
    const foot = cfg.type !== "stat" && footText(cfg), footNode = foot && label(svg, 0, h - 6, foot, { size: 14, cls: "ch-faint" });
    if (foot) c.bottom = h - 32;
    c.fit = need => {           // a type with a natural height takes exactly that, unless "h" was given
      if (cfg.h != null) return;
      c.h = Math.ceil(need) + (foot ? 34 : 4); c.bottom = c.h - (foot ? 32 : 2);
      svg.setAttribute("viewBox", "0 0 " + w + " " + c.h);
      if (footNode) footNode.setAttribute("y", c.h - 6);
    };
    return draw(c) || svg;
  }
  function render(fig, cfg) {
    if (!fig || !fig.appendChild) return null;
    injectCss();
    const shown = Array.from(fig.querySelectorAll(".frag")).map(f => f.classList.contains("show"));   // keep the reveal state across a re-render
    Array.from(fig.querySelectorAll(":scope > [data-ch]")).forEach(n => n.remove());
    let root;
    try { root = build(fig, cfg); } catch (e) {
      root = html("div", "ch-err");
      html("b", null, root, "Chart error");
      root.appendChild(document.createTextNode(e && e.message ? e.message : String(e)));
    }
    root.setAttribute("data-ch", "");
    fig.appendChild(root);
    Array.from(fig.querySelectorAll(".frag")).forEach((f, i) => { if (shown[i]) f.classList.add("show"); });
    if (!root.classList.contains("ch-err")) wireHover(fig, root);
    return root;
  }
  function renderAll(root) {
    const figs = Array.from((root || document).querySelectorAll(".chart")).filter(f => f.querySelector(':scope > script[type="application/json"]'));
    figs.forEach(f => render(f));
    return figs.length;
  }

  window.Charts = { render: render, renderAll: renderAll, types: Object.keys(TYPES), version: VERSION };

  // Draw whatever is already in the page now (so the charts exist before deck.js walks the slides),
  // then pick up any figure that was parsed after this script.
  const pending = () => Array.from(document.querySelectorAll(".chart")).filter(f => !f.querySelector(":scope > [data-ch]") && f.querySelector(':scope > script[type="application/json"]'));
  function boot() {
    pending().forEach(f => render(f));
    // Labels are measured with whatever font is ready; measure again once Inter has loaded.
    if (document.fonts && document.fonts.ready && !document.fonts.check("16px Inter")) {
      document.fonts.ready.then(() => { if (document.fonts.check("16px Inter")) renderAll(document); });
    }
  }
  if (document.body) pending().forEach(f => render(f));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
