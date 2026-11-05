"use strict";
// pinwand · PDFs living on the board: pages as a grid, selectable text, selection → card, cards ↔ pages
pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
const PDF = PW.pdf = { docs: new Map() };
const dpr = () => Math.min(2.5, window.devicePixelRatio || 1);
PDF.load = function (asset) {
  let d = PDF.docs.get(asset); if (d) return d;
  d = (async () => {
    const blob = await PW.store.getAsset(asset), data = new Uint8Array(await blob.arrayBuffer());
    const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise, sizes = [], pages = [];
    for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); pages.push(p); const v = p.getViewport({ scale: 1 }); sizes.push([v.width, v.height]); }
    return { doc, pages, sizes, texts: null, tcs: [] };
  })();
  PDF.docs.set(asset, d); return d;
};
PDF.textContent = async (D, i) => D.tcs[i] || (D.tcs[i] = await D.pages[i].getTextContent());
PDF.texts = async function (asset, onProgress) {
  const D = await PDF.load(asset); if (D.texts) return D.texts;
  if (!D._tp) D._tp = (async () => {
    try { const f = await PW.store.readFile(await PW.store.dir("texts"), asset + ".json"), T = JSON.parse(await f.text()); if (Array.isArray(T) && T.length === D.pages.length) return T; } catch (e) { }
    const T = []; for (let i = 0; i < D.pages.length; i++) { const c = await PDF.textContent(D, i); T.push(c.items.map(t => t.str).join(" ").replace(/\s+/g, " ")); if (i % 25 === 0) (D._prog || []).forEach(fn => fn(i, D.pages.length)); }
    PW.store.dir("texts").then(d => PW.store.writeFile(d, asset + ".json", JSON.stringify(T))).catch(() => { }); return T; })();
  if (onProgress) (D._prog = D._prog || []).push(onProgress);
  D.texts = await D._tp; D._prog = []; return D.texts;
};

// ---------- the object: a window like pdfgrid — resizable, pages scroll inside, 1–6 columns or free zoom, one page ----------
const GAP = 12, PADX = 26, PADY = 26;
B.types.pdf = {
  minW: 220, fixedH: true,
  create(o) {
    const e = h("div", { class: "win pdf" },
      h("div", { class: "wt" }, h("span", { class: "nm" }), h("span", { class: "lbl pp" }),
        h("button", { class: "b", "data-a": "prev", title: "previous page (← or PgUp)" }, "‹"), h("button", { class: "b", "data-a": "next", title: "next page (→ or PgDn)" }, "›"),
        h("button", { class: "b", "data-a": "read", title: "open in the reader (Enter)" }, "read"), h("button", { class: "b", "data-a": "mode", title: "one page / all pages (S / G)" }, "1"),
        h("button", { class: "b", "data-a": "c-", title: "fewer columns (Shift+1…6)" }, "|−"), h("button", { class: "b", "data-a": "c+", title: "more columns (Shift+1…6)" }, "|+"),
        h("button", { class: "b", "data-a": "s-", title: "smaller pages (−)" }, "−"), h("button", { class: "b", "data-a": "s+", title: "larger pages (+)" }, "+")),
      h("div", { class: "pages", title: "click once: then the wheel scrolls the pages, Shift+1…6 sets the columns (Ctrl+wheel zooms the board)" }), h("div", { class: "rz", title: "drag to resize the window" }));
    e.querySelector(".wt").addEventListener("click", ev => {
      const b = ev.target.closest("button[data-a]"); if (!b) return; ev.stopPropagation(); const o2 = obj(e.dataset.id), a = b.dataset.a;
      if (a === "read") { PW.reader.open(o2.asset, o2.page || 1, null, o2.name); return; }
      if (a === "prev") return PDF.step(o2, -1); if (a === "next") return PDF.step(o2, 1);
      if (a === "mode") return PDF.view(o2, o2.mode === "one" ? "grid" : "one");
      if (a === "c-" || a === "c+") return PDF.cols(o2, clamp((o2.cols || e._cols || 2) + (a === "c+" ? 1 : -1), 1, 8));
      if (a === "s-" || a === "s+") return PDF.zoom(o2, a === "s+" ? 1.2 : 1 / 1.2);
    });
    const box = e.querySelector(".pages");
    box.addEventListener("dblclick", ev => { ev.stopPropagation(); if (ev.target.closest(".textLayer span")) return; const pg = ev.target.closest(".pg"), o2 = obj(e.dataset.id); if (pg && o2) PW.reader.open(o2.asset, +pg.dataset.p, null, o2.name); });
    box.addEventListener("scroll", () => { PDF.onView(); trackPage(e); }, { passive: true });
    return e;
  },
  update(o, e) {
    o.cols = o.cols == null ? 2 : o.cols; o.ps = o.ps || .5; o.mode = o.mode || "grid"; o.page = o.page || 1;
    e.querySelector(".nm").textContent = (o.name || "document.pdf").replace(/\.pdf$/i, ""); e.querySelector('[data-a="mode"]').textContent = o.mode === "one" ? "▦" : "1";
    if (e._asset !== o.asset) { e._asset = o.asset; e._ready = false; PDF.load(o.asset).then(D => { e._D = D; e._n = D.pages.length; e._ready = true; buildPages(o, e); B.render(o); B.renderEdges(); requestAnimationFrame(() => { scrollToPage(e, o.page, true); PDF.onView(); }); }).catch(err => { e.querySelector(".pages").textContent = "cannot open this PDF: " + (err && err.message || err); }); }
    if (!e._ready) { if (!o.h) e.style.height = "300px"; return; }
    const D = e._D, n = D.pages.length, maxW = Math.max(...D.sizes.map(s => s[0]));
    if (!o.h) { // boards from before: the window keeps its width and shows the first rows
      const cols = Math.max(1, Math.min(o.mode === "one" ? 1 : o.cols || 2, n)); o.w = Math.min(o.w || 600, 1600); o.h = clamp(Math.round(Math.max(...D.sizes.map(s => s[1])) * ((o.w - 60) / cols / maxW) * Math.min(2, Math.ceil(n / cols)) + 90), 260, 1000); e.style.height = o.h + "px"; }
    o.w = Math.max(220, o.w); o.h = Math.max(160, o.h); e.style.width = o.w + "px"; e.style.height = o.h + "px";
    const box = e.querySelector(".pages"), iw = Math.max(60, box.clientWidth - PADX), ih = Math.max(60, box.clientHeight - PADY); let ps;
    if (o.mode === "one") { const [pw, ph] = D.sizes[clamp(o.page, 1, n) - 1]; ps = Math.min(iw / pw, ih / ph); }
    else if (o.cols > 0) { const c = Math.min(o.cols, n); ps = (iw - (c - 1) * GAP - 1) / c / maxW; }
    else ps = o.ps;
    ps = clamp(ps, .05, 6); if (e._ps && Math.abs(e._ps - ps) > .001 && o.mode !== "one") requestAnimationFrame(() => scrollToPage(e, o.page, true)); e._ps = ps; // keep the current page in view when the pages change size e._cols = o.mode === "one" ? 1 : o.cols > 0 ? Math.min(o.cols, n) : Math.max(1, Math.floor((iw + GAP) / (maxW * ps + GAP)));
    e.querySelector(".pp").textContent = `${o.page}/${n}`;
    e.querySelectorAll(".pg").forEach((p, i) => { const [w, hh] = D.sizes[i]; p.style.width = w * ps + "px"; p.style.height = hh * ps + "px"; p.hidden = o.mode === "one" && i + 1 !== o.page;
      if (p._ps !== ps) { p._ps = ps; p._tl = false; p._rw = 0; } });
    box.classList.toggle("one", o.mode === "one"); PDF.marks(o, e); PDF.onView();
  },
  text: o => o.name || "",
};
function buildPages(o, e) {
  const box = e.querySelector(".pages"); box.innerHTML = "";
  e._D.sizes.forEach((s, i) => box.append(h("div", { class: "pg", "data-p": i + 1 }, h("canvas"), h("div", { class: "textLayer" }), h("div", { class: "marks" }), h("span", { class: "pno", text: String(i + 1) }))));
}
function scrollToPage(e, n, instant) { const box = e && e.querySelector(".pages"), p = box && box.querySelector(`.pg[data-p="${n}"]`); if (!p || p.hidden) return; e._lock = performance.now() + 500; box.scrollTo({ top: Math.max(0, p.offsetTop - 10), left: Math.max(0, p.offsetLeft - 10), behavior: instant ? "auto" : "smooth" }); }
const touchSoon = debounce(() => B.doc && B.touch(), 800);
function trackPage(e) { // the first page in view is the current one
  const o = obj(e.dataset.id); if (!o || o.mode === "one" || performance.now() < (e._lock || 0)) return; const box = e.querySelector(".pages"), top = box.scrollTop + 20;
  let n = 1; for (const p of box.children) { if (p.offsetTop + p.offsetHeight > top) { n = +p.dataset.p; break; } }
  if (n !== o.page) { o.page = n; e.querySelector(".pp").textContent = `${n}/${e._n}`; touchSoon(); }
}
// what the window can do: also by keys while it is selected (as in pdfgrid)
PDF.view = (o, mode) => { o.mode = mode; B.render(o); B.commit(); const e = B.el(o.id); requestAnimationFrame(() => scrollToPage(e, o.page, true)); };
PDF.cols = (o, n) => { o.cols = n; if (o.mode === "one") o.mode = "grid"; B.render(o); B.commit(); const e = B.el(o.id); requestAnimationFrame(() => scrollToPage(e, o.page, true)); toast(n + (n === 1 ? " column" : " columns"), 900); };
PDF.zoom = (o, f) => { const e = B.el(o.id); o.ps = clamp((e && e._ps || o.ps) * f, .1, 4); if (o.mode !== "one") o.cols = 0; B.render(o); B.commit(); requestAnimationFrame(() => scrollToPage(e, o.page, true)); };
PDF.fitCols = o => PDF.cols(o, o.cols > 0 ? o.cols : 2);
PDF.step = (o, d) => { const e = B.el(o.id), n = (e && e._n) || 1; o.page = clamp((o.page || 1) + d, 1, n); if (o.mode === "one") { B.render(o); } else { e.querySelector(".pp").textContent = `${o.page}/${n}`; scrollToPage(e, o.page); } touchSoon(); };
PDF.key = function (e, o) {
  const k = e.key, el = B.el(o.id); if (!el || !el._ready || e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.shiftKey && /^Digit[1-6]$/.test(e.code)) { PDF.cols(o, +e.code.slice(5)); return true; } // as in pdfgrid; Shift+7 stays "/" (search) on a German keyboard
  if (k === "+" || k === "=") { PDF.zoom(o, 1.15); return true; } if (k === "-") { PDF.zoom(o, 1 / 1.15); return true; } if (k === "0") { PDF.fitCols(o); return true; }
  if (k === "ArrowRight" || k === "PageDown") { PDF.step(o, 1); return true; } if (k === "ArrowLeft" || k === "PageUp") { PDF.step(o, -1); return true; }
  if (k === "ArrowDown" || k === "ArrowUp") { el.querySelector(".pages").scrollBy({ top: k === "ArrowDown" ? 90 : -90 }); return true; }
  if (k === "Home") { PDF.step(o, -1e6); return true; } if (k === "End") { PDF.step(o, 1e6); return true; }
  if (k === "s" || k === "S") { PDF.view(o, "one"); return true; } if (k === "g" || k === "G" || k === "r" || k === "R") { PDF.view(o, "grid"); return true; }
  if (k === "Enter") { PW.reader.open(o.asset, o.page || 1, null, o.name); return true; }
  return false;
};

// ---------- rendering pages at the right sharpness for the current zoom ----------
const queue = []; let busy = 0;
PDF.onView = debounce(() => {
  const r = vp.getBoundingClientRect(), list = [];
  for (const e of world.querySelectorAll(".obj.pdf")) {
    if (!e._ready || e.classList.contains("off")) continue; const br = e.querySelector(".pages").getBoundingClientRect();
    const R = { left: Math.max(r.left, br.left) - 200, right: Math.min(r.right, br.right) + 200, top: Math.max(r.top, br.top) - 400, bottom: Math.min(r.bottom, br.bottom) + 400 }; if (R.right <= R.left || R.bottom <= R.top) continue;
    for (const p of e.querySelectorAll(".pg")) { if (p.hidden) continue; const pr = p.getBoundingClientRect(); if (pr.right > R.left && pr.left < R.right && pr.bottom > R.top && pr.top < R.bottom) list.push([e, p, pr.width]); }
  }
  queue.length = 0; const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
  list.sort((a, b) => { const A = a[1].getBoundingClientRect(), Bq = b[1].getBoundingClientRect(); return Math.hypot(A.left + A.width / 2 - cx, A.top + A.height / 2 - cy) - Math.hypot(Bq.left + Bq.width / 2 - cx, Bq.top + Bq.height / 2 - cy); });
  for (const [e, p, w] of list) { const want = Math.min(2600, Math.round(w * dpr())); if (!p._rw || p._rw < want * 0.7 || p._rw > want * 1.8) if (!queue.some(q => q[1] === p)) queue.push([e, p, want]); if (!p._tl && w > 160) textLayer(e, p); }
  pump();
}, 120);
function pump() {
  while (busy < 2 && queue.length) {
    const [e, p, want] = queue.shift(); if (!p.isConnected) continue; busy++;
    const i = +p.dataset.p - 1, D = e._D, pg = D.pages[i], vpt = pg.getViewport({ scale: want / D.sizes[i][0] });
    const off = document.createElement("canvas"); off.width = Math.round(vpt.width); off.height = Math.round(vpt.height);
    pg.render({ canvasContext: off.getContext("2d"), viewport: vpt }).promise.then(() => { const cv = p.querySelector("canvas"); cv.width = off.width; cv.height = off.height; cv.getContext("2d").drawImage(off, 0, 0); p._rw = want; })
      .catch(() => { }).finally(() => { busy--; pump(); });
  }
}
async function textLayer(e, p) {
  p._tl = true; const i = +p.dataset.p - 1, D = e._D, o = obj(e.dataset.id); if (!o) return;
  const ps = e._ps || o.ps, div = p.querySelector(".textLayer"), tc = await PDF.textContent(D, i), vpt = D.pages[i].getViewport({ scale: ps });
  div.replaceChildren(); div.style.setProperty("--scale-factor", ps);
  try { await pdfjsLib.renderTextLayer({ textContentSource: tc, container: div, viewport: vpt, textDivs: [] }).promise; } catch (err) { }
  const end = h("div", { class: "endOfContent" }); div.append(end); div.addEventListener("mousedown", () => end.classList.add("active"));
}
addEventListener("mouseup", () => document.querySelectorAll(".endOfContent.active").forEach(x => x.classList.remove("active")));
PDF.forget = set => { };

// ---------- markers on pages for cards made from them ----------
PDF.marks = function (o, e) {
  const by = new Map(); for (const c of all()) if (c.ref && (c.ref.pdf === o.id || (c.ref.asset && c.ref.asset === o.asset && !obj(c.ref.pdf)))) { if (!by.has(c.ref.page)) by.set(c.ref.page, []); by.get(c.ref.page).push(c); }
  e.querySelectorAll(".pg").forEach(p => { const m = p.querySelector(".marks"), list = by.get(+p.dataset.p) || [], sig = list.map(c => c.id).join(",");
    if (m._sig === sig) return; m._sig = sig; m.innerHTML = "";
    list.slice(0, 12).forEach(c => { const i = h("i", { title: texPlain(B.textOf(c)).slice(0, 80) }); i.addEventListener("click", ev => { ev.stopPropagation(); B.select([c.id]); B.reveal(c); B.flash(c.id); }); m.append(i); }); });
};
PDF.refresh = pdfId => { const o = obj(pdfId), e = o && B.el(o.id); if (o && e) PDF.marks(o, e); };

// ---------- jump from a card to its page ----------
PDF.goto = async function (ref, text) {
  const o = obj(ref.pdf); if (!o) return toast("the PDF is no longer on this board");
  if (o.mode === "one" && o.page !== ref.page) { o.page = ref.page; B.render(o); B.renderEdges(); }
  const e = B.el(o.id); await sleep(30); const p = e && e.querySelector(`.pg[data-p="${ref.page}"]`); if (!p) return;
  o.page = ref.page; scrollToPage(e, ref.page, true); e.querySelector(".pp").textContent = `${o.page}/${e._n}`;
  const r = vp.getBoundingClientRect(), z = clamp(Math.min(r.width * .9 / o.w, r.height * .9 / o.h, 1.2), .2, 4);
  B.navTo(r.width / 2 - (o.x + o.w / 2) * z, r.height / 2 - (o.y + o.h / 2) * z, z); B.select([o.id]);
  setTimeout(() => { PDF.onView(); if (text) setTimeout(() => highlight(p, text), 450); }, 300);
};
function highlight(p, text) {
  const norm = s => s.toLowerCase().replace(/\s+/g, " ").trim(), T = norm(text), all_ = [...p.querySelectorAll(".textLayer span")];
  let spans = all_.filter(s => { const t = norm(s.textContent); return t.length > 3 && (T.includes(t) || t.includes(T)); });
  if (spans.length) { spans.forEach(s => s.style.background = "rgba(255,0,255,.3)"); setTimeout(() => spans.forEach(s => s.style.background = ""), 3500); return; }
  const words = new Set(texPlain(text).toLowerCase().split(/\W+/).filter(w => w.length > 3)); if (!words.size) return;
  spans = all_.filter(s => { const ws = s.textContent.toLowerCase().split(/\W+/).filter(w => w.length > 3); return ws.length && ws.filter(w => words.has(w)).length / ws.length > .5; });
  spans.forEach(s => s.style.background = "rgba(255,0,255,.3)"); setTimeout(() => spans.forEach(s => s.style.background = ""), 3500);
}
PDF.gotoPage = (pdfId, page) => PDF.goto({ pdf: pdfId, page });

// ---------- selecting text in a PDF: make a card from it ----------
const selbar = $("selbar");
function selInfo() {
  const s = getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return null;
  const r = s.getRangeAt(0), anc = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement;
  const pg = anc && (anc.closest(".pg") || (r.startContainer.parentElement && r.startContainer.parentElement.closest(".pg"))), oe = pg && pg.closest(".obj.pdf");
  const text = s.toString().replace(/\s+/g, " ").trim(); if (!oe || !text) return null;
  return { text, page: +pg.dataset.p, o: obj(oe.dataset.id), rect: r.getBoundingClientRect() };
}
function showSelbar() {
  const si = selInfo(); if (!si) { selbar.hidden = true; return; }
  selbar._si = si; const ln = PW.map && PW.map.lastNode && obj(PW.map.lastNode);
  selbar.innerHTML = ""; [["note", "note"], ["def", "def"], ["q", "question"], ["node", ln ? "→ " + texPlain(ln.text || "node").slice(0, 18) : "node"]].forEach(([k, l]) =>
    selbar.append(h("button", { class: "b", "data-k": k, title: k === "node" && ln ? "add to the map as a branch" : "" }, l)));
  [["y", "#ffd23f"], ["g", "#7fe08a"], ["p", "#ff8fcf"]].forEach(([c, col]) => selbar.append(h("button", { class: "b mk", "data-m": c, title: "highlight" }, h("i", { style: { background: col } }))));
  selbar.hidden = false; const r = si.rect; selbar.style.left = clamp(r.left, 4, innerWidth - selbar.offsetWidth - 4) + "px"; selbar.style.top = (r.top > 40 ? r.top - selbar.offsetHeight - 6 : r.bottom + 6) + "px";
}
document.addEventListener("mouseup", e => { if (e.target.closest("#selbar")) return; setTimeout(showSelbar, 0); });
document.addEventListener("selectionchange", () => { if (!selbar.hidden && !selInfo()) selbar.hidden = true; });
selbar.addEventListener("mousedown", e => e.preventDefault());
selbar.addEventListener("click", e => { const m = e.target.closest("button[data-m]"); if (m) { PW.marks.fromSelection(m.dataset.m).then(() => { selbar.hidden = true; getSelection().removeAllRanges(); }); return; } const b = e.target.closest("button[data-k]"); if (!b) return; PDF.fromSelection(b.dataset.k, selbar._si); selbar.hidden = true; getSelection().removeAllRanges(); });
// where to put a new card: right of the PDF, at the height of the selection, below anything already there
function freeSpot(o, wy, w) {
  const x = o.x + o.w + 36; let y = wy;
  for (let k = 0; k < 200; k++) { const hit = all().some(c => c !== o && !isArea(c) && !(c.type === "image" && c.bg) && (() => { const b = B.box(c); return b.x < x + w && b.x + b.w > x && b.y < y + 70 && b.y + b.h > y; })()); if (!hit) break; y += 24; }
  return { x, y };
}
PDF.fromSelection = function (kind, si) {
  if (!si) return; const { text, page, o, rect } = si, wy = Math.round(B.toWorld(rect.left, rect.top).y), ref = { pdf: o.id, page };
  const src = (o.name || "").replace(/\.pdf$/i, "") + " p." + page;
  let c;
  if (kind === "node" && PW.map) { c = PW.map.addFromText(text, ref, freeSpot(o, wy, 260)); }
  else {
    const sp = freeSpot(o, wy, kind === "note" ? 280 : 380);
    if (kind === "note") c = B.add({ type: "note", x: sp.x, y: sp.y, w: 280, text, color: "white", ref, refText: text });
    if (kind === "def") { const short = text.length < 60; c = B.add({ type: "def", x: sp.x, y: sp.y, w: 380, term: short ? text : "", def: short ? "" : text, ref, refText: text }, { edit: short ? "def" : "term" }); }
    if (kind === "q") c = B.add({ type: "q", x: sp.x, y: sp.y, w: 380, qt: "concept", q: "", a: text, ref, refText: text }, { edit: "q" });
  }
  PDF.refresh(o.id); if (c) { B.flash(c.id); status("from " + src); }
};

// ---------- inserting files ----------
PW.files = {
  async insert(files, at) {
    at = at || B.center(); let y = at.y, made = [];
    for (const f of files) {
      if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) {
        const a = await PW.store.putAsset(f, f.name); const D = await PDF.load(a.file).catch(() => null);
        if (!D) { toast("cannot open " + f.name); continue; }
        const one = D.pages.length === 1, w = one ? 620 : 780, hh = one ? Math.round(560 * D.sizes[0][1] / D.sizes[0][0]) + 70 : 900;
        const o = B.add({ type: "pdf", x: Math.round(at.x), y: Math.round(y), w, h: hh, asset: a.file, name: f.name, cols: one ? 1 : 2, ps: .5, mode: "grid", page: 1 }, { commit: false });
        made.push(o); y += hh + 40;
      } else if (/^image\//.test(f.type)) {
        const a = await PW.store.putAsset(f, f.name || "image.png"), url = await PW.store.assetURL(a.file);
        const im = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
        const w = im ? Math.min(900, im.naturalWidth) : 400, hh = im ? Math.round(w * im.naturalHeight / im.naturalWidth) : 300;
        made.push(B.add({ type: "image", x: Math.round(at.x), y: Math.round(y), w, h: hh, asset: a.file, name: f.name }, { commit: false })); y += hh + 30;
      } else if (/\.html?$/i.test(f.name) || /text\/html/.test(f.type)) { made.push(await PW.addHTML(await f.text(), { x: at.x, y }, f.name.replace(/\.html?$/i, ""))); y += 470; }
      else toast("not a PDF, picture or HTML: " + f.name);
    }
    if (made.length) { B.commit(); B.select(made.map(o => o.id)); setTimeout(() => B.fit(made, 1), 200); }
    return made;
  },
};
