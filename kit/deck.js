/* springprompt-masterclass · deck runtime
 *
 * One file drives the slides (navigation, click-reveals, notes, PDF layout),
 * the live room (phases, result widgets, join QR) and the phone remote hook.
 * It works from file:// with no server; the live parts switch on when the
 * deck is served by kit/server.py at /deck.
 *
 * Authoring contract (see references/deck-format.md):
 *   <div id="stage"><section class="slide" data-section="Intro">…</section>…</div>
 *   <script type="application/json" id="room">{ "title": …, "interactions": [...] }</script>
 *   class="frag"            shown one press of Next at a time, in DOM order
 *   data-go="name"          runs Deck.on('name', fn) when that frag appears
 *   data-phase="<id>"       entering the slide puts that interaction on every phone
 *   data-live="<id>"        live results for that interaction
 *   data-join               join QR + address, data-online = phones connected
 *   <aside class="notes">   speaker notes (N on the keyboard, Notes tab on the remote)
 */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const Q = new URLSearchParams(location.search);
  const PRINT = Q.has('print'), MIRROR = Q.has('mirror'), DEMO = Q.has('demo'), ALL = Q.has('all');
  // ?all=1 is for screenshots: every reveal shown, nothing moving, so a capture at any moment is the finished slide
  if (ALL) document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '*,*::before,*::after{animation:none!important;transition:none!important}' }));
  const SERVED = /^https?:$/.test(location.protocol) && !Q.has('offline');
  const LIVE = SERVED && !MIRROR;

  const stage = $('#stage');
  if (!stage) return console.error('deck.js: no #stage element');
  const S = $$('.slide', stage);
  const ROOM = (() => { try { return JSON.parse(($('#room') || {}).textContent || '{}'); } catch (e) { console.error('deck.js: #room is not valid JSON', e); return {}; } })();
  const DEFS = Object.fromEntries((ROOM.interactions || []).map(d => [d.id, d]));
  // room.theme colours the slides and the phones from one place: { accent, soft, onDark, aura: [a, b, c] }
  (th => {
    const rs = document.documentElement.style, set = (k, v) => { if (v) rs.setProperty(k, v); };
    set('--accent', th.accent); set('--accent-soft', th.soft); set('--accent-on-dark', th.onDark);
    (th.aura || []).forEach((c, k) => set('--aura' + (k + 1), c));
  })(ROOM.theme || {});
  const hooks = {}, undo = {};
  let i = 0, phase = null, info = null, results = {}, online = 0, revealed = {};

  // ── chrome ──────────────────────────────────────────────────────────
  const mk = (id, parent = stage) => $('#' + id) || parent.appendChild(Object.assign(document.createElement('div'), { id }));
  const nav = mk('nav'), bar = mk('bar'), pg = mk('pg');
  const notesEl = mk('notes', document.body), help = mk('help', document.body);
  help.textContent = '→ / Space   next\n←           back\nN           speaker notes\nQ           join QR\nB           blank screen\nR           restart slide\nF           full screen\n12 Enter    go to slide 12\n?           this help';
  let sec = '', apx = false;
  S.forEach((s, k) => {
    if (s.dataset.section) sec = s.dataset.section;
    if (s.hasAttribute('data-appendix')) apx = true;
    s._sec = sec; s._apx = apx; s._n = k;
  });
  const SECS = [...new Set(S.filter(s => !s._apx).map(s => s._sec).filter(Boolean))];
  nav.innerHTML = SECS.map(x => `<span>${esc(x)}</span>`).join('');
  const MAIN = S.filter(s => !s._apx).length || S.length;

  function fit() {
    if (PRINT) return;
    const k = Math.min(innerWidth / 1280, innerHeight / 720);
    stage.style.transform = `translate(-50%,-50%) scale(${k})`;
  }
  addEventListener('resize', fit);

  // ── slides and click-reveals ────────────────────────────────────────
  const frags = s => $$('.frag', s);
  const titleOf = s => (s.dataset.title || ($('h1,h2', s) || {}).textContent || 'Slide ' + (s._n + 1)).replace(/\s+/g, ' ').trim();
  const notesOf = s => { const a = $(':scope > .notes', s); return a ? a.innerText || a.textContent : (s.dataset.notes || ''); };
  const cleanNotes = s => notesOf(s).split('\n').map(l => l.trim()).join('\n').trim();

  function reveal(f, instant) {
    f.classList.add('show');
    if (f.dataset.go && hooks[f.dataset.go]) hooks[f.dataset.go](f, !!instant);
    if (!instant) $$('[data-count]', f).concat(f.matches('[data-count]') ? [f] : []).forEach(count);
  }
  function conceal(f) {
    f.classList.remove('show');
    if (f.dataset.go && undo[f.dataset.go]) undo[f.dataset.go](f);
  }
  function next() {
    const f = $('.frag:not(.show)', S[i]);
    if (f) { reveal(f); changed(); return; }
    if (i < S.length - 1) { i++; show('fwd'); }
  }
  function prev() {
    const f = frags(S[i]).filter(x => x.classList.contains('show')).pop();
    if (f) { conceal(f); changed(); return; }
    if (i > 0) { i--; show('back'); }
  }
  function go(n, k) {
    i = Math.max(0, Math.min(S.length - 1, n | 0));
    show('fwd');
    if (k) frags(S[i]).slice(0, k).forEach(f => reveal(f, true));
    changed();
  }
  function restart() { show('fwd'); }

  function show(dir) {
    const s = S[i];
    S.forEach(x => x.classList.toggle('on', x === s));
    if (dir === 'back' || ALL) frags(s).forEach(f => reveal(f, true));   // ?all=1 shows every click-reveal, for screenshots
    else if (dir !== 'keep') frags(s).forEach(conceal);
    document.body.classList.toggle('chromeless', s.matches('.cover,.section,.full,[data-chromeless]'));
    $$('span', nav).forEach(x => x.classList.toggle('on', x.textContent === s._sec && !s._apx));
    if (!MIRROR) history.replaceState(null, '', '#' + (i + 1));
    bar.style.width = (s._apx ? 100 : (100 * (i + 1)) / MAIN) + '%';
    pg.textContent = s._apx ? 'Appendix · ' + (i + 1) : i + 1 + ' / ' + MAIN;
    notesEl.textContent = cleanNotes(s);
    // heavy media only loads when its slide is on screen
    $$('iframe[data-src]', s).forEach(f => { if (!f.src) f.src = f.dataset.src; });
    $$('video', stage).forEach(v => { if (!s.contains(v)) v.pause(); else if (v.hasAttribute('data-autoplay')) { v.currentTime = 0; v.play().catch(() => {}); } });
    $$('[data-count]', s).filter(e => !e.closest('.frag:not(.show)')).forEach(count);
    clearMarks();
    entered(s);
    paintLive();
    document.dispatchEvent(new CustomEvent('slide', { detail: { index: i, slide: s } }));
    changed();
  }

  function count(el) {
    const to = +el.dataset.count, dec = +(el.dataset.decimals || 0);
    const fmt = v => (el.dataset.prefix || '') + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (el.dataset.suffix || '');
    if (PRINT || MIRROR || ALL || matchMedia('(prefers-reduced-motion:reduce)').matches) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), ms = +(el.dataset.ms || 1100);
    const run = (el._run = Symbol());
    (function step(t) {
      if (el._run !== run) return;
      const p = Math.min(1, (t - t0) / ms);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  // ── keyboard, clicker, touch ────────────────────────────────────────
  let typed = '';
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName)) return;
    const k = e.key;
    if (/^\d$/.test(k)) { typed += k; return; }
    if (k === 'Enter' && typed) { go(+typed - 1); typed = ''; return; }
    typed = '';
    if (k === 'ArrowRight' || k === ' ' || k === 'PageDown' || k === 'Enter') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); prev(); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(S.length - 1);
    else if (k === 'n' || k === 'N') notesEl.classList.toggle('on');
    else if (k === 'f' || k === 'F') (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
    else if (k === 'r' || k === 'R') restart();
    else if (k === 'q' || k === 'Q') toggleQR();
    else if (k === 'b' || k === 'B') blank(blankMode ? '' : 'black');
    else if (k === '?') help.classList.toggle('on');
    else if (k === 'Escape') { toggleQR(false); help.classList.remove('on'); blank(''); }
  });
  let tx = null;
  stage.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (tx == null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
  });

  // ── live room ───────────────────────────────────────────────────────
  async function api(path, body) {
    const r = await fetch('/api/' + path, body === undefined
      ? { cache: 'no-store' }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw Object.assign(new Error(path + ' ' + r.status), { status: r.status });
    return r.json();
  }

  /* Which phase should the phones be in for this slide?
     data-phase wins. A slide that only shows results for the running interaction
     leaves it running. Anything else sends phones back to the waiting screen.
     Once the take-home is out it stays out (slide 1 starts a fresh run-through). */
  function phaseFor(s) {
    const p = s.dataset.phase;
    if (p === 'keep') return null;
    if (p) return p;
    if ($$('[data-live]', s).some(e => e.dataset.live === phase)) return null;
    return 'wait';
  }
  function entered(s) {
    if (!LIVE || PRINT) return;
    const want = phaseFor(s);
    if (!want || want === phase) return;
    if (phase === 'takehome' && i !== 0 && !s.dataset.phase) return;
    phase = want;
    api('phase', { phase: want }).catch(() => {});
  }

  let pollT = 0;
  async function poll() {
    clearTimeout(pollT);
    const s = S[i];
    const wants = $('[data-live],[data-online],[data-answers]', s) || qrov.classList.contains('on');
    if (LIVE && (wants || PRINT)) {
      try {
        const r = await api('results');
        results = r.results || {}; online = r.online || 0; phase = phase || r.phase;
        paintLive();
      } catch (e) { /* server away: keep the last picture */ }
    }
    if (!PRINT) pollT = setTimeout(poll, document.hidden ? 4000 : 1300);
  }

  function demoResult(def) {
    // deterministic fake results so a results slide can be designed with no audience (?demo=1)
    let seed = [...def.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const n = 48;
    if (def.type === 'choice') {
      const counts = def.options.map(() => 0); let none = 0;
      for (let v = 0; v < n; v++) { const k = Math.floor(Math.pow(rnd(), 1.6) * (def.options.length + (def.none ? 0.4 : 0))); if (k >= def.options.length) none++; else counts[(k + def.id.length) % def.options.length]++; }
      return { n, counts, none, reasons: (def.reasons || []).map(() => Math.floor(rnd() * 20)) };
    }
    if (def.type === 'scale') {
      const lo = def.min || 0, hi = def.max == null ? 100 : def.max, mid = lo + (hi - lo) * (0.3 + rnd() * 0.3);
      const values = Array.from({ length: n }, () => Math.max(lo, Math.min(hi, Math.round(mid + (rnd() + rnd() + rnd() - 1.5) * (hi - lo) * 0.3))));
      const sorted = [...values].sort((a, b) => a - b);
      return { n, values, median: sorted[n >> 1], mean: values.reduce((a, b) => a + b, 0) / n };
    }
    if (def.type === 'words') return { n, words: (def.sample || ['time', 'budget', 'trust', 'habit', 'fear', 'tools', 'meetings', 'data', 'focus', 'buy-in']).map((w, k) => [w, Math.max(1, Math.round(14 / (k + 1) + rnd() * 2))]) };
    if (def.type === 'questions') return { n: 3, items: (def.sample || ['How long did this take to set up?', 'What would you do differently next time?', 'Does this work for a small team?']).map((text, k) => ({ id: 'q' + k, text, votes: 9 - k * 3 })) };
    if (def.type === 'swipe') return { n, cards: def.cards.map(() => { const yes = Math.floor(rnd() * n); return { yes, no: n - yes }; }) };
    return { n: 0 };
  }

  function paintLive() {
    const s = S[i];
    $$('[data-live]', PRINT ? stage : s).forEach(el => {
      const def = DEFS[el.dataset.live];
      el.classList.add('live');
      if (!def) { el.innerHTML = `<div class="empty">No interaction with id “${esc(el.dataset.live)}” in #room.</div>`; return; }
      const r = results[def.id] || (DEMO || !SERVED ? demoResult(def) : { n: 0 });
      (WIDGETS[def.type] || WIDGETS.none)(el, def, r);
      el.classList.toggle('revealed', !!revealed[def.id]);
    });
    $$('[data-online]').forEach(el => { el.textContent = online; });
    $$('[data-answers]', PRINT ? stage : s).forEach(el => { const r = results[el.dataset.answers]; el.textContent = r ? r.n : 0; });
  }

  const pct = (c, n) => (n ? Math.round((100 * c) / n) : 0) + '%';
  const MANY = { person: 'people' };
  const cnt = (n, noun) => `${n} ${n === 1 ? noun : MANY[noun] || noun + 's'}`;
  const head = (el, r, noun) => el.hasAttribute('data-bare') ? '' : `<div class="lv-head"><span></span><span>${cnt(r.n, noun)}</span></div>`;
  /* Keyed rows: built once, then only widths and numbers change, so bars glide instead of jumping. */
  function rows(el, key, list, cls) {
    if (el._key !== key) { el._key = key; el.innerHTML = head(el, { n: 0 }, 'answer') + `<div class="${cls}"></div>`; el._rows = {}; }
    const box = el.lastElementChild;
    list.forEach(row => {
      let d = el._rows[row.k];
      if (!d) {
        d = el._rows[row.k] = document.createElement('div');
        d.className = 'lv-row';
        d.innerHTML = '<span class="lab"></span><span class="track"><i class="fill"></i></span><span class="val"></span>';
        box.appendChild(d);
      }
      d.children[0].textContent = row.label;
      d.querySelector('.fill').style.width = row.w + '%';
      d.children[2].innerHTML = row.val;
      d.style.order = row.order;
      d.classList.toggle('top', !!row.top);
      d.classList.toggle('right', !!row.right);
    });
    return box;
  }
  const setHead = (el, r, noun) => { const h = $('.lv-head', el); if (h) h.lastElementChild.textContent = cnt(r.n, noun); };

  const WIDGETS = {
    none(el) { el.innerHTML = '<div class="empty">Unknown interaction type.</div>'; },

    choice(el, def, r) {
      const counts = r.counts || [];
      let list = def.options.map((label, k) => ({ k, label, c: counts[k] || 0 }));
      if (def.none) list.push({ k: 'none', label: def.none, c: r.none || 0 });
      const max = Math.max(1, ...list.map(x => x.c));
      const right = [].concat(def.correct == null ? [] : def.correct);
      const sorted = el.dataset.sort === 'votes' ? [...list].sort((a, b) => b.c - a.c) : list;
      const top = +el.dataset.top || 99;
      list.forEach(x => {
        x.order = sorted.indexOf(x);
        x.w = (100 * x.c) / max;
        x.top = x.c === max && x.c > 0;
        x.right = right.includes(x.k) || right.includes(x.label);
        x.val = el.dataset.show === 'count' ? x.c : `${pct(x.c, r.n)}<small>${x.c}</small>`;
      });
      const box = rows(el, 'choice:' + def.id, list, 'lv-bars');
      [...box.children].forEach(d => { d.style.display = +d.style.order < top ? '' : 'none'; });
      setHead(el, r, def.multi ? 'person' : 'vote');
      if (def.reasons && el.hasAttribute('data-reasons')) {
        let t = $('.lv-tags', el) || el.appendChild(Object.assign(document.createElement('div'), { className: 'lv-tags' }));
        t.innerHTML = def.reasons.map((x, k) => [x, (r.reasons || [])[k] || 0]).sort((a, b) => b[1] - a[1]).map(([x, c]) => `<span>${esc(x)}<b>${c}</b></span>`).join('');
      }
    },

    scale(el, def, r) {
      const lo = def.min || 0, hi = def.max == null ? 100 : def.max, step = def.step || 1;
      const bins = Math.max(2, Math.min(+el.dataset.bins || 20, Math.round((hi - lo) / step) + 1));
      const b = Array(bins).fill(0);
      (r.values || []).forEach(v => { b[Math.max(0, Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo || 1)) * bins)))]++; });
      const max = Math.max(1, ...b), u = def.unit || '', pre = def.prefix || '';
      if (el._key !== 'scale:' + def.id) {
        el._key = 'scale:' + def.id;
        el.innerHTML = head(el, r, 'answer') + `<div class="lv-hist">${b.map(() => '<i></i>').join('')}<div class="mk med"><span></span></div><div class="mk truth" hidden><span></span></div></div><div class="lv-axis"><span>${pre}${lo.toLocaleString('en-US')}${u}</span><span>${pre}${hi.toLocaleString('en-US')}${u}</span></div>`;
      }
      const bars = $$('.lv-hist i', el);
      b.forEach((c, k) => { bars[k].style.height = (100 * c) / max + '%'; });
      const at = v => Math.max(0, Math.min(100, (100 * (v - lo)) / (hi - lo || 1)));
      const med = $('.mk.med', el), tr = $('.mk.truth', el);
      const mAt = r.n ? at(r.median) : null, tAt = def.answer != null ? at(def.answer) : null;
      const both = mAt != null && tAt != null && !!revealed[def.id];
      // Each label sits beside its line, on the side away from the other line when there is room for it there.
      const mText = r.n ? `Room median ${pre}${(+r.median).toLocaleString('en-US')}${u}` : '';
      const tText = tAt != null ? `${def.answerLabel || 'Actual'} ${pre}${(+def.answer).toLocaleString('en-US')}${u}` : '';
      const need = t => ((t.length * 10 + 24) / (el.clientWidth || 1100)) * 100;      // rough label width, in % of the plot
      const side = (me, other, text) => { const n = need(text); return both && me <= other ? me > n || me + n > 100 : me + n > 100; };
      med.hidden = !r.n;
      if (r.n) { med.style.left = mAt + '%'; med.classList.toggle('flip', side(mAt, both && mAt !== tAt ? tAt : -1, mText)); med.firstChild.textContent = mText; }
      tr.hidden = !(revealed[def.id] && tAt != null);
      if (tAt != null) { tr.style.left = tAt + '%'; tr.classList.toggle('flip', side(tAt, both ? mAt : -1, tText)); tr.firstChild.textContent = tText; }
      setHead(el, r, 'answer');
    },

    words(el, def, r) {
      const words = (r.words || []).slice(0, +el.dataset.top || 36);
      const max = Math.max(1, ...words.map(w => w[1]));
      if (el._key !== 'words:' + def.id) {
        el._key = 'words:' + def.id; el._w = {};
        el.innerHTML = head(el, r, 'answer') + '<div class="lv-words"></div><div class="empty">Answers appear here as they come in.</div>';
      }
      const box = $('.lv-words', el), seen = new Set();
      $('.empty', el).hidden = words.length > 0;
      words.forEach(([w, c], k) => {
        seen.add(w);
        let s = el._w[w];
        if (!s) { s = el._w[w] = document.createElement('span'); s.textContent = w; s.appendChild(document.createElement('sup')); box.appendChild(s); }
        s.style.fontSize = Math.round(24 + 44 * Math.sqrt(c / max)) + 'px';
        s.style.order = k;
        s.classList.toggle('top', c === max);
        s.lastChild.textContent = c > 1 ? c : '';
      });
      Object.keys(el._w).forEach(w => { if (!seen.has(w)) { el._w[w].remove(); delete el._w[w]; } });
      setHead(el, r, 'answer');
    },

    questions(el, def, r) {
      const items = (r.items || []).filter(q => !q.hidden).slice(0, +el.dataset.top || 5);
      const sig = JSON.stringify(items);
      if (el._sig === sig) return; el._sig = sig;
      el.innerHTML = items.length
        ? `<div class="lv-qs">${items.map(q => `<div class="${q.done ? 'done' : ''}"><b>${q.votes}</b><span>${esc(q.text)}</span></div>`).join('')}</div>`
        : '<div class="empty">Questions appear here. The most upvoted rise to the top.</div>';
    },

    swipe(el, def, r) {
      const list = def.cards.map((c, k) => { const x = (r.cards || [])[k] || { yes: 0, no: 0 }; const n = x.yes + x.no; return { k, label: c.title || c.text || 'Card ' + (k + 1), rate: n ? x.yes / n : 0, n }; });
      const sorted = el.dataset.sort === 'given' ? list : [...list].sort((a, b) => b.rate - a.rate);
      const best = Math.max(...list.map(x => x.rate));
      list.forEach(x => { x.order = sorted.indexOf(x); x.w = 100 * x.rate; x.top = x.n > 0 && x.rate === best; x.val = `${Math.round(100 * x.rate)}%<small>${def.yes || 'yes'}</small>`; });
      rows(el, 'swipe:' + def.id, list, 'lv-bars lv-swipe');
      setHead(el, r, 'person');
    },
  };

  // reveal the right answer: <i class="frag" data-go="reveal" data-for="quiz1"></i>
  hooks.reveal = f => { revealed[f.dataset.for] = true; paintLive(); };
  undo.reveal = f => { delete revealed[f.dataset.for]; paintLive(); };
  // change what phones show on a press: <i class="frag" data-go="phase" data-to="takehome"></i>
  const sendPhase = p => { if (!LIVE || PRINT || !p || p === phase) return; phase = p; api('phase', { phase: p }).catch(() => {}); };
  hooks.phase = f => sendPhase(f.dataset.to);
  undo.phase = f => { if (phase !== f.dataset.to) return; const p = (f.closest('.slide') || {}).dataset; sendPhase(p && p.phase && p.phase !== 'keep' ? p.phase : 'wait'); };

  // ── join QR ─────────────────────────────────────────────────────────
  const qrov = mk('qrov', document.body);
  function qrSvg(url) {
    if (!window.qrcode) return '';
    const q = window.qrcode(0, 'M'); q.addData(url); q.make();
    return q.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
  }
  function paintJoin() {
    // Opened from disk there is no room yet: draw a stand-in code so the slide can be laid out. The server replaces it.
    const real = (info && info.join) || ROOM.joinUrl || '', url = real || (SERVED ? '' : 'https://example.com/join-preview');
    const shown = real ? real.replace(/^https?:\/\//, '') : 'your address appears here';
    $$('[data-join]').forEach(el => {
      if (!url) { el.innerHTML = '<div class="empty">The join code appears when the slides are opened with the admin link (/deck?k=…).</div>'; return; }
      const small = el.classList.contains('corner-join');
      el.innerHTML = small
        ? `<span>Join on your phone<br><b data-online>${online}</b> connected</span><div class="qr">${qrSvg(url)}</div>`
        : `<div class="qr">${qrSvg(url)}</div><div class="url"><small>Point your camera at the code, or open</small>${esc(shown)}<div class="livecount" style="margin-top:22px"><span><b data-online>${online}</b> phones connected</span></div></div>`;
      if (!small) el.classList.add('join');
    });
    qrov.innerHTML = real ? `<div class="qr">${qrSvg(url)}</div><div><h3>${esc(ROOM.joinTitle || 'Join in on your phone')}</h3><p>${esc(shown)}</p><div class="livecount"><span><b data-online>${online}</b> phones connected</span></div></div>` : '';
  }
  function toggleQR(on) {
    if (!qrov.innerHTML) return;
    qrov.classList.toggle('on', on === undefined ? undefined : !!on);
    changed(); poll();
  }

  // ── remote: highlight, dim, laser, blank ────────────────────────────
  const BLOCK = 'h1,h2,h3,p,li,tr,figure,pre,blockquote,img,video,.card,.stat,.callout,.quote,.lv-row,.chart,.compare>div,[data-block]';
  const laser = mk('rlaser'), blankEl = mk('rblank', document.body), toastEl = mk('rtoast', document.body), askov = mk('askov', document.body);
  let hlEl = null, dim = false, laserT = 0, toastT = 0, blankMode = '';
  const pathOf = el => { const p = []; while (el && el !== S[i]) { p.unshift([...el.parentElement.children].indexOf(el)); el = el.parentElement; } return p; };
  const atPath = p => (p || []).reduce((e, k) => e && e.children[k], S[i]);
  function pick(fx, fy) {
    const r = stage.getBoundingClientRect(), s = S[i];
    const el = document.elementFromPoint(r.left + fx * r.width, r.top + fy * r.height);
    if (!el || !s.contains(el) || el === s) return null;
    let b = el.closest(BLOCK);
    if (!b || !s.contains(b) || b === s) { b = el; while (b.parentElement !== s) b = b.parentElement; }
    return b;
  }
  function clearMarks() {
    $$('.rhl', stage).forEach(e => e.classList.remove('rhl'));
    $$('.rfade', stage).forEach(e => e.classList.remove('rfade'));
    hlEl = null;
  }
  function mark(el) {
    clearMarks();
    hlEl = el && S[i].contains(el) && el !== S[i] ? el : null;
    if (!hlEl) return;
    hlEl.classList.add('rhl');
    for (let e = hlEl; e !== S[i]; e = e.parentElement) [...e.parentElement.children].forEach(sib => { if (sib !== e && !sib.matches('.notes,.aura,.bleed')) sib.classList.add('rfade'); });
  }
  function tapHighlight(fx, fy) {
    let b = pick(fx, fy);
    if (b && b === hlEl) { const up = b.parentElement.closest(BLOCK); b = up && S[i].contains(up) && up !== S[i] ? up : null; }
    mark(b);
  }
  function setDim(on) { dim = !!on; stage.classList.toggle('rdim', dim); }
  function blank(mode) { blankMode = mode || ''; blankEl.style.display = mode ? 'block' : 'none'; blankEl.style.background = mode === 'white' ? '#fff' : '#000'; changed(); }
  function toast(t) { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 1600); }
  function showAsk(text) { askov.innerHTML = text ? `<small>From the room</small>${esc(text)}` : ''; askov.classList.toggle('on', !!text); }

  const TAB = Math.random().toString(36).slice(2, 10);
  let seq = 0, lastState = '';
  const state = () => ({
    i, k: frags(S[i]).filter(f => f.classList.contains('show')).length, n: frags(S[i]).length,
    hl: hlEl ? pathOf(hlEl) : null, dim, blank: blankMode,
    qr: qrov.classList.contains('on'), ask: askov.classList.contains('on'),
  });
  function changed() {
    if (!LIVE || PRINT) return;
    const st = JSON.stringify(state());
    if (st === lastState) return;
    lastState = st;
    fetch('/api/deck/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tab: TAB, state: JSON.parse(st) }), keepalive: true }).catch(() => { lastState = ''; });
  }
  function textOf(s) {   // hidden slides have no innerText, so walk the text nodes
    const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('.notes,script,style,svg,[data-live],[data-join]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const out = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (t) out.push(t); }
    return out.join(' ');
  }
  const slideIndex = () => S.map(s => ({
    t: titleOf(s), sec: s._sec, apx: s._apx, n: frags(s).length, notes: cleanNotes(s),
    ph: s.dataset.phase || '', live: !!$('[data-live]', s), opt: s.hasAttribute('data-optional'),
    x: textOf(s).slice(0, 600),
  }));

  function run(c) {
    switch (c.c) {
      case 'next': next(); break;
      case 'prev': prev(); break;
      case 'go': go(c.i, c.k); break;
      case 'restart': restart(); break;
      case 'hl': tapHighlight(c.x, c.y); break;
      case 'hlclear': clearMarks(); break;
      case 'dim': setDim(c.on); break;
      case 'laser':
        if (c.x == null) { laser.style.display = 'none'; break; }
        laser.style.display = 'block'; laser.style.left = c.x * 1280 + 'px'; laser.style.top = c.y * 720 + 'px';
        clearTimeout(laserT); laserT = setTimeout(() => { laser.style.display = 'none'; }, 4000);
        break;
      case 'blank': blank(c.mode || ''); break;
      case 'qr': toggleQR(c.on); break;
      case 'ask': showAsk(c.text || ''); break;
      case 'reload': location.reload(); break;
      case 'ping': toast('Remote connected'); break;
      default: document.dispatchEvent(new CustomEvent('remote-ctl', { detail: c }));
    }
    changed();
  }
  async function listen() {
    let wait = 500;
    for (;;) {
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 30000);
        const r = await fetch(`/api/deck/cmd?tab=${TAB}&since=${seq}`, { signal: ctl.signal, cache: 'no-store' });
        clearTimeout(t);
        if (r.status === 403) { toast('Remote is off: open the deck with its key again'); return; }
        const j = await r.json();
        seq = j.seq;
        (j.cmds || []).forEach(run);
        wait = 500;
      } catch (e) { await new Promise(r => setTimeout(r, wait)); wait = Math.min(wait * 2, 5000); }
    }
  }
  async function hello() {
    try {
      const r = await api('deck/hello', { tab: TAB, title: ROOM.title || document.title, minutes: ROOM.minutes || 0, slides: slideIndex(), state: state() });
      seq = r.seq; info = r; phase = r.phase; online = r.online || 0;
      paintJoin(); entered(S[i]); poll(); listen();
      addEventListener('focus', () => api('deck/hello', { tab: TAB, title: ROOM.title || document.title, minutes: ROOM.minutes || 0, slides: slideIndex(), state: state() }).catch(() => {}));
      setInterval(() => { lastState = ''; changed(); }, 5000);
      try { if (navigator.wakeLock) { const lock = () => navigator.wakeLock.request('screen').catch(() => {}); lock(); document.addEventListener('visibilitychange', () => { if (!document.hidden) lock(); }); } } catch (e) {}
    } catch (e) {
      // served without admin rights (or by a plain static server): run as an ordinary deck
      paintJoin();
      if (e.status === 403) toast('Viewing only: open /deck?k=<admin key> to present');
    }
  }

  // The remote loads the deck in an iframe (?mirror=1) and drives it through these.
  if (MIRROR) {
    document.documentElement.classList.add('mirror');
    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '*{animation-duration:.01s!important;animation-delay:0s!important;transition-duration:.05s!important}' }));
    if (SERVED) {
      api('info').then(r => { info = r; paintJoin(); }).catch(() => {});
      (function look() {
        if ($('[data-live],[data-online],[data-answers]', S[i])) api('results').then(r => { results = r.results || {}; online = r.online || 0; paintLive(); }).catch(() => {});
        setTimeout(look, 2500);
      })();
    }
    window.__mirror = st => {
      if (st.i !== i) { i = Math.max(0, Math.min(S.length - 1, st.i)); show('fwd'); }
      frags(S[i]).forEach((f, k) => { const want = k < st.k; if (want !== f.classList.contains('show')) (want ? reveal(f, true) : conceal(f)); });
      mark(st.hl ? atPath(st.hl) : null); setDim(st.dim);
      blankEl.style.display = st.blank ? 'block' : 'none'; blankEl.style.background = st.blank === 'white' ? '#fff' : '#000';
    };
  }

  // ── PDF layout: deck.html?print=1, then print to PDF at 1280×720 ────
  async function printMode() {
    document.documentElement.classList.add('print'); document.body.classList.add('print');
    S.forEach((s, k) => {
      frags(s).forEach(f => reveal(f, true));
      $$('[data-count]', s).forEach(count);
      $$('iframe[data-src]', s).forEach(f => { f.src = f.dataset.src; });
      s.appendChild(Object.assign(document.createElement('div'), { className: 'pgn', textContent: k + 1 }));
    });
    if (SERVED) { try { const r = await api('results'); results = r.results || {}; online = r.online || 0; info = await api('info'); } catch (e) {} }
    paintJoin(); paintLive();
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    window.__ready = true; document.body.dataset.ready = '1';
  }

  // ── boot ────────────────────────────────────────────────────────────
  window.Deck = {
    slides: S, room: ROOM, next, prev, go, restart, toast,
    on(name, fn, undoFn) { hooks[name] = fn; if (undoFn) undo[name] = undoFn; },
    get index() { return i; }, get phase() { return phase; }, get results() { return results; },
    setPhase(p) { phase = p; return api('phase', { phase: p }); },
  };
  if (PRINT) { printMode(); return; }
  i = Math.max(0, Math.min(S.length - 1, +(location.hash.slice(1) || 1) - 1 || 0));
  fit(); show('fwd'); paintJoin();
  if (LIVE) hello(); else if (!MIRROR) paintLive();
})();
