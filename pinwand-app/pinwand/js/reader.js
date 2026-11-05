"use strict";
(() => {
// pinwand · reader: a full PDF reader in its own tab (the pdfgrid part of pinwand).
// PDFs live in the workspace's assets; the list of recently read PDFs is pdfs.json in the workspace.
const RD = PW.reader = { on: false, asset: null };
let recent = [], recentLoaded = false, D = null, st = null, io = null, renderQ = [], busyR = 0, hits = null, scrollT = 0, lockT = 0;
const rq = id => document.getElementById(id);
async function loadRecent() { if (recentLoaded) return recent; try { const f = await PW.store.readFile(PW.store.root, "pdfs.json"); recent = JSON.parse(await f.text()) || []; } catch (e) { recent = []; } recentLoaded = true; return recent; }
const saveRecent = debounce(() => { PW.store.writeFile(PW.store.root, "pdfs.json", JSON.stringify(recent.slice(0, 60))).catch(() => { }); }, 600);
RD.recent = async () => (await loadRecent()).slice().sort((a, b) => b.opened - a.opened);
RD.reset = () => { recent = []; recentLoaded = false; };
const entry = asset => recent.find(r => r.asset === asset);
RD.page = () => st && st.page;
RD.nameOf = asset => { const r = entry(asset); return r ? r.name.replace(/\.pdf$/i, "") : "PDF"; };

// ---------- the view ----------
const el = h("div", { id: "reader", hidden: true },
  h("div", { class: "rtb bevel" },
    h("button", { class: "b", "data-r": "toc", title: "chapters, pages, marked (I)" }, "☰"),
    h("span", { class: "rname" }),
    h("span", { class: "rsep" }),
    h("button", { class: "b", "data-r": "prev", title: "previous page (←)" }, "‹"),
    h("input", { class: "f rpg", type: "text", inputmode: "numeric", "aria-label": "page" }), h("span", { class: "rof" }),
    h("button", { class: "b", "data-r": "next", title: "next page (→)" }, "›"),
    h("span", { class: "rsep" }),
    h("span", { class: "rlbl", text: "columns" }), ...[1, 2, 3, 4, 6].map(n => h("button", { class: "b rc", "data-c": n, title: n + " side by side (" + n + ")" }, String(n))),
    h("button", { class: "b", "data-r": "zout", title: "smaller (-)" }, "−"), h("span", { class: "rzv mono" }), h("button", { class: "b", "data-r": "zin", title: "larger (+)" }, "+"),
    h("span", { class: "rsep" }),
    h("input", { class: "f rq", type: "text", placeholder: "search in PDF", spellcheck: "false", "aria-label": "search in PDF" }), h("span", { class: "rhits mono" }),
    h("button", { class: "b", "data-r": "hprev", title: "previous hit (Shift+Enter)" }, "↑"), h("button", { class: "b", "data-r": "hnext", title: "next hit (Enter)" }, "↓"),
    h("span", { class: "rsep" }), h("button", { class: "b", "data-t": "pen", title: "pen (B)" }, "✎"), h("button", { class: "b", "data-t": "hl", title: "highlighter (Shift+B)" }, "▍"), h("button", { class: "b", "data-t": "eraser", title: "eraser (E)" }, "⌫"),
    h("span", { class: "sp" }),
    h("button", { class: "b", "data-r": "night", title: "invert pages (N)" }, "◐"),
    h("button", { class: "b", "data-r": "split", title: "the board beside the PDF" }, "⇆"),
    h("button", { class: "b", "data-r": "place", title: "put this PDF on the board" }, "→ board")),
  h("div", { class: "rmain" }, h("div", { class: "rtoc sunk", hidden: true }), h("div", { class: "rpages", tabindex: "0" }, h("div", { class: "rgrid" }))),
  h("div", { class: "rsel bevel", hidden: true }));
document.getElementById("app").append(el);
const grid = el.querySelector(".rgrid"), pages = el.querySelector(".rpages"), toc = el.querySelector(".rtoc"), selb = el.querySelector(".rsel");

RD.open = async function (asset, page, text, name) {
  await loadRecent(); let r = entry(asset);
  if (!r) { r = { asset, name: name || "document.pdf", pages: 0, page: 1, cols: 2, gz: 0, opened: Date.now() }; recent.push(r); }
  r.opened = Date.now(); saveRecent();
  PW.tabs.addPdf(asset); RD.show();
  if (RD.asset !== asset || !D) { RD.asset = asset; st = r; await build(); }
  if (page) setTimeout(() => goPage(page, text), 60);
  PW.tabs.draw(); return true;
};
RD.show = function () {
  if (B.editing) B.endEdit(); PW.hideHome && PW.hideHome(true); RD.on = true; PW.pane = "reader"; el.hidden = false; document.body.classList.add("reading"); PW.ctxSoon && PW.ctxSoon();
  $("ttl").textContent = "pinwand — " + (st ? st.name : "reader"); document.title = (st ? st.name : "reader") + " — pinwand";
  setTimeout(() => pages.focus({ preventScroll: true }), 0);
};
RD.hide = function () { if (!RD.on) return; RD.on = false; el.hidden = true; selb.hidden = true; document.body.classList.remove("reading"); };
RD.addFile = async function (file, page) { // a PDF from disk: keep it in the workspace and open it
  const a = await PW.store.putAsset(file, file.name); await loadRecent(); let r = entry(a.file);
  if (!r) { r = { asset: a.file, name: file.name, pages: 0, page: 1, cols: 2, gz: 0, opened: Date.now() }; recent.push(r); } else r.name = file.name;
  saveRecent(); return RD.open(a.file, page);
};
RD.close = function (asset) { recent.forEach(r => { if (r.asset === asset && RD.asset === asset && st) r.page = st.page; }); saveRecent(); if (RD.asset === asset) { RD.asset = null; D = null; grid.innerHTML = ""; } };
async function build() {
  grid.innerHTML = ""; hits = null; el.querySelector(".rq").value = ""; el.querySelector(".rhits").textContent = ""; if (io) io.disconnect(); renderQ = [];
  el.querySelector(".rname").textContent = st.name.replace(/\.pdf$/i, "");
  try { D = await PW.pdf.load(RD.asset); } catch (e) { grid.append(h("div", { class: "rerr", text: "cannot open this PDF" })); return; }
  st.pages = D.pages.length; el.querySelector(".rof").textContent = "/ " + st.pages; saveRecent();
  io = new IntersectionObserver(es => es.forEach(x => { x.target._vis = x.isIntersecting; if (x.isIntersecting) queueT(x.target); }), { root: pages, rootMargin: "800px 0px" });
  D.sizes.forEach((s, i) => { const t = h("div", { class: "rt", "data-p": i + 1 }, h("div", { class: "rsheet" }, h("canvas"), h("div", { class: "textLayer" })), h("span", { class: "rno", text: String(i + 1) }));
    grid.append(t); io.observe(t); });
  if (!st.gz) fitCols(st.cols || (pages.clientWidth > 1100 ? 2 : 1), true); else sizeTiles();
  requestAnimationFrame(() => { goPage(st.page || 1, null, true); });
  drawSide(); PW.marks && PW.marks.paintReader();
  const myD = D; setTimeout(() => { if (D === myD && RD.on) PW.pdf.texts(RD.asset).catch(() => { }); }, 5000);
}
function maxW() { return Math.max(...D.sizes.map(s => s[0])); }
function sizeTiles() {
  if (!D) return; grid.querySelectorAll(".rt").forEach(t => { const [w, hh] = D.sizes[+t.dataset.p - 1]; const W = Math.round(w * st.gz); t.style.width = W + "px"; t.querySelector(".rsheet").style.height = Math.round(hh * st.gz) + "px"; });
  el.querySelector(".rzv").textContent = Math.round(st.gz * 100) + "%";
  el.querySelectorAll(".rc").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.c === st.cols)));
  clearTimeout(sizeTiles.t); sizeTiles.t = setTimeout(() => grid.querySelectorAll(".rt").forEach(t => { if (t._vis) queueT(t); }), 120);
}
function fitCols(n, quiet) { grid.classList.remove("one"); st.cols = n; const W = pages.clientWidth - 48 - 20, gap = 22; st.gz = clamp(Math.floor((W - (n - 1) * gap) / n) / maxW() - .0005, .1, 5); sizeTiles(); saveRecent(); if (!quiet) goPage(st.page, null, true); }
function zoom(f) { grid.classList.remove("one"); const p = st.page; st.gz = clamp(st.gz * f, .1, 5); st.cols = 0; sizeTiles(); saveRecent(); goPage(p, null, true); }
const dprR = () => Math.min(2.5, devicePixelRatio || 1);
function queueT(t) { if (!renderQ.includes(t)) renderQ.push(t); pumpR(); }
function pumpR() { // the waiting page nearest to the middle of the view first
  while (busyR < 2 && renderQ.length) {
    const pr = pages.getBoundingClientRect(), mid = pr.top + pr.height / 2; let bi = 0, bd = Infinity;
    renderQ.forEach((x, i) => { if (!x.isConnected || !x._vis) return; const r = x.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid); if (d < bd) { bd = d; bi = i; } });
    const t = renderQ.splice(bi, 1)[0]; if (!t.isConnected || !t._vis) continue; const n = +t.dataset.p, W = t.clientWidth; if (!W) continue;
    const want = Math.min(3000, Math.round(W * dprR())); if (t._rw && t._rw >= want * .9 && t._rw <= want * 1.6 && t._tw === W) continue; busyR++; renderT(t, n, W, want).finally(() => { busyR--; pumpR(); }); }
}
async function renderT(t, n, W, want) {
  const myD = D, pg = myD.pages[n - 1], [w0] = myD.sizes[n - 1];
  if (!(t._rw && t._rw >= want * .9 && t._rw <= want * 1.6)) { const vpt = pg.getViewport({ scale: want / w0 }), off = document.createElement("canvas"); off.width = Math.round(vpt.width); off.height = Math.round(vpt.height);
    try { await pg.render({ canvasContext: off.getContext("2d"), viewport: vpt }).promise; } catch (e) { return; } if (myD !== D) return;
    const cv = t.querySelector("canvas"); cv.width = off.width; cv.height = off.height; cv.getContext("2d").drawImage(off, 0, 0); t._rw = want; }
  if (t._tw !== W && W > 180) { const div = t.querySelector(".textLayer"), scale = W / w0, tc = await PW.pdf.textContent(myD, n - 1); if (myD !== D) return;
    div.replaceChildren(); div.style.setProperty("--scale-factor", scale);
    try { await pdfjsLib.renderTextLayer({ textContentSource: tc, container: div, viewport: pg.getViewport({ scale }), textDivs: [] }).promise; } catch (e) { }
    const end = h("div", { class: "endOfContent" }); div.append(end); div.addEventListener("mousedown", () => end.classList.add("active")); t._tw = W;
    if (hits && hits[n - 1]) markWords(t); }
}
function tileOf(n) { return grid.querySelector(`.rt[data-p="${n}"]`); }
function goPage(n, text, instant) {
  if (!D) return; n = clamp(n | 0 || 1, 1, D.pages.length); const far = Math.abs(n - (st.page || 1)) > 4; st.page = n; lockT = performance.now() + 700;
  const t = tileOf(n); if (t) pages.scrollTo({ top: t.offsetTop - 12, behavior: instant || far ? "auto" : "smooth" }); // far jumps go straight there, without drawing every page on the way
  markCur(); saveRecent(); if (text) setTimeout(() => flashText(tileOf(n), text), 500);
}
function markCur() { if (!D) return; const inp = el.querySelector(".rpg"); if (document.activeElement !== inp) inp.value = st.page; grid.querySelectorAll(".rt.cur").forEach(x => x.classList.remove("cur")); const t = tileOf(st.page); t && t.classList.add("cur"); markTocCur(); }
pages.addEventListener("scroll", () => { clearTimeout(scrollT); scrollT = setTimeout(() => { if (!D || performance.now() < lockT) return; const top = pages.getBoundingClientRect().top + 30;
  const pr = pages.getBoundingClientRect(), cur = tileOf(st.page); if (cur) { const r = cur.getBoundingClientRect(); if (r.bottom > pr.top + 40 && r.top < pr.bottom - 40) return; } // the current page is still in view: keep it
  for (const t of grid.children) { const r = t.getBoundingClientRect(); if (r.bottom > top) { const n = +t.dataset.p; if (n !== st.page) { st.page = n; markCur(); saveRecent(); } break; } } }, 150); }, { passive: true });
addEventListener("resize", () => { if (RD.on && D && st.cols) fitCols(st.cols, true); });
function flashText(t, text) {
  if (!t) return; const norm = s => s.toLowerCase().replace(/\s+/g, " ").trim(), T = norm(text), spans = [...t.querySelectorAll(".textLayer span")];
  let hit = spans.filter(s => { const x = norm(s.textContent); return x.length > 3 && (T.includes(x) || x.includes(T)); }); if (!hit.length) return;
  hit.forEach(s => s.classList.add("rflash")); setTimeout(() => hit.forEach(s => s.classList.remove("rflash")), 3200);
}

// ---------- the side panel: chapters, pages, marked ----------
let side = ls.get("rside", "toc"), mkF = "", sideSeq = 0, tio = null, thQ = [], thBusy = 0;
const sideTabs = h("div", { class: "rtabs" }, ...[["toc", "chapters"], ["pages", "pages"], ["marks", "marked"]].map(([k, l]) => h("button", { class: "b", "data-s": k }, l))), sideBox = h("div", { class: "rtc" });
toc.append(sideTabs, sideBox);
sideTabs.addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (!b) return; side = b.dataset.s; ls.set("rside", side); drawSide(); });
function drawSide() { sideTabs.querySelectorAll("[data-s]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.s === side))); if (toc.hidden || !D) return; if (side === "pages") drawThumbs(); else if (side === "marks") RD.drawMarks(); else drawToc(); }
async function drawToc() {
  const my = ++sideSeq; if (tio) tio.disconnect(); sideBox.innerHTML = ""; if (!D) return; const myD = D; let raw = null; try { raw = await D.doc.getOutline(); } catch (e) { }
  const out = []; const walk = async (list, d) => { for (const it of list || []) { let p = null; try { let dest = it.dest; if (typeof dest === "string") dest = await myD.doc.getDestination(dest); if (dest && dest[0] != null) p = typeof dest[0] === "number" ? dest[0] + 1 : (await myD.doc.getPageIndex(dest[0])) + 1; } catch (e) { } out.push({ t: it.title, d, p }); if (it.items && it.items.length) await walk(it.items, d + 1); } };
  await walk(raw, 0); if (my !== sideSeq || myD !== D) return;
  if (!out.length) sideBox.append(h("div", { class: "none", text: "this PDF has no chapter list (see “pages”)" }));
  out.forEach(it => sideBox.append(h("div", { class: "ti", "data-p": it.p || 0, style: { paddingLeft: (8 + it.d * 14) + "px" }, onclick: () => it.p && goPage(it.p) }, h("span", { text: it.t }), h("span", { class: "n", text: it.p || "" }))));
  markTocCur();
}
// small pages, drawn when they come into view, two at a time
function drawThumbs() {
  ++sideSeq; if (tio) tio.disconnect(); thQ = []; sideBox.innerHTML = ""; if (!D) return; const box = h("div", { class: "rthumbs" }); sideBox.append(box);
  tio = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { tio.unobserve(x.target); thQ.push(x.target); pumpTh(); } }), { root: toc, rootMargin: "300px 0px" });
  D.sizes.forEach((sz, i) => { const t = h("div", { class: "rth", "data-p": i + 1, title: "page " + (i + 1) }, h("canvas", { style: { aspectRatio: sz[0] + " / " + sz[1] } }), h("span", { class: "n", text: String(i + 1) })); t.onclick = () => goPage(i + 1); box.append(t); tio.observe(t); });
  markThumbs(); thumbCur(true);
}
function pumpTh() { while (thBusy < 2 && thQ.length) { const t = thQ.shift(); if (!t.isConnected) continue; thBusy++; renderThumb(t).finally(() => { thBusy--; pumpTh(); }); } }
async function renderThumb(t) {
  const n = +t.dataset.p, myD = D; if (!myD) return; const pg = myD.pages[n - 1], [w0] = myD.sizes[n - 1], cv = t.querySelector("canvas"), W = Math.round((cv.clientWidth || 110) * dprR()), vpt = pg.getViewport({ scale: W / w0 }), off = document.createElement("canvas");
  off.width = Math.round(vpt.width); off.height = Math.round(vpt.height); try { await pg.render({ canvasContext: off.getContext("2d"), viewport: vpt }).promise; } catch (e) { return; } if (myD !== D) return;
  cv.width = off.width; cv.height = off.height; cv.getContext("2d").drawImage(off, 0, 0);
}
async function markThumbs() { if (!PW.marks || !RD.asset) return; const m = await PW.marks.get(RD.asset); sideBox.querySelectorAll(".rth").forEach(t => { const pd = m.pages[t.dataset.p]; t.classList.toggle("mk", !!(pd && ((pd.ink || []).length || (pd.hl || []).length))); }); }
function thumbCur(scroll) { if (side !== "pages" || toc.hidden) return; sideBox.querySelectorAll(".rth.on").forEach(x => x.classList.remove("on")); const t = sideBox.querySelector(`.rth[data-p="${st.page}"]`); if (t) { t.classList.add("on"); if (scroll) { const r = t.getBoundingClientRect(), b = toc.getBoundingClientRect(); if (r.top < b.top + 34) toc.scrollTop -= b.top + 34 - r.top; else if (r.bottom > b.bottom) toc.scrollTop += r.bottom - b.bottom + 8; } } }
// everything marked in this PDF; the colours filter the list
RD.drawMarks = async function () {
  if (toc.hidden || !RD.asset || !PW.marks) return; if (side === "pages") { markThumbs(); return; } if (side !== "marks") return;
  const my = ++sideSeq, list = await PW.marks.list(RD.asset); if (my !== sideSeq) return; if (tio) tio.disconnect(); sideBox.innerHTML = "";
  if (!list.length) { sideBox.append(h("div", { class: "none", text: "nothing marked yet: select text and click a colour, or write with the pen (B)" })); return; }
  const key = m => (m.kind === "ink" ? "i:" : "h:") + m.c, col = m => (m.kind === "ink" && !m.hl ? PW.draw.PEN[m.c] : PW.draw.HLC[m.c]) || "#ffd23f", seen = new Map(); list.forEach(m => { if (!seen.has(key(m))) seen.set(key(m), m); });
  if (mkF && !seen.has(mkF)) mkF = "";
  const chips = h("div", { class: "rmf" }, h("button", { class: "b", "data-f": "", "aria-pressed": String(!mkF) }, "all"), ...[...seen].map(([k, m]) => h("button", { class: "b", "data-f": k, "aria-pressed": String(mkF === k), title: m.kind === "ink" ? "drawn lines" : "highlighted text" }, m.kind === "ink" ? h("b", { style: { color: col(m) }, text: "✎" }) : h("i", { style: { background: col(m) } }))));
  chips.addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (b) { mkF = b.dataset.f; RD.drawMarks(); } }); sideBox.append(chips);
  list.filter(m => !mkF || key(m) === mkF).forEach(m => sideBox.append(h("div", { class: "ti mkt", onclick: () => goPage(m.page, m.t) }, h("span", { class: "sw" + (m.kind === "ink" ? " ink" : ""), style: { background: col(m) } }), h("span", { text: m.kind === "ink" ? "✎ " + m.n + (m.n === 1 ? " line" : " lines") : m.t ? m.t.slice(0, 90) : "(mark)" }), h("span", { class: "n", text: m.page }))));
};
function markTocCur() { if (side !== "toc") return thumbCur(true); let best = null; sideBox.querySelectorAll(".ti").forEach(d => { d.classList.remove("on"); if (+d.dataset.p && +d.dataset.p <= st.page) best = d; }); best && best.classList.add("on"); }
function toggleToc(v) { const on = v == null ? toc.hidden : v; toc.hidden = !on; ls.set("rtoc", on ? "1" : "0"); el.querySelector('[data-r="toc"]').setAttribute("aria-pressed", String(on)); if (on) drawSide(); if (st && st.cols) setTimeout(() => fitCols(st.cols, true), 0); }
toggleToc(ls.get("rtoc", "0") === "1");

// ---------- search ----------
async function search() {
  const q = el.querySelector(".rq").value.trim().toLowerCase(), out = el.querySelector(".rhits");
  grid.querySelectorAll(".rt.hit,.rt.miss").forEach(t => t.classList.remove("hit", "miss")); grid.querySelectorAll(".rbadge").forEach(b => b.remove()); grid.querySelectorAll(".rmark").forEach(s => s.classList.remove("rmark"));
  if (!q || !D) { hits = null; out.textContent = ""; return; }
  out.textContent = "…"; const T = await PW.pdf.texts(RD.asset, (i, n) => { if (el.querySelector(".rq").value.trim().toLowerCase() === q) out.textContent = "reading " + Math.round(100 * i / n) + "%"; }); if (el.querySelector(".rq").value.trim().toLowerCase() !== q) return;
  hits = T.map(t => { const L = t.toLowerCase(); let n = 0, i = L.indexOf(q); while (i >= 0) { n++; i = L.indexOf(q, i + q.length); } return n; });
  const tot = hits.reduce((a, b) => a + b, 0), pp = hits.filter(Boolean).length; out.textContent = tot ? `${tot} on ${pp} p.` : "none";
  grid.querySelectorAll(".rt").forEach(t => { const n = hits[+t.dataset.p - 1]; t.classList.add(n ? "hit" : "miss"); if (n) { t.querySelector(".rsheet").append(h("span", { class: "rbadge", text: n })); markWords(t); } });
}
function markWords(t) { const q = el.querySelector(".rq").value.trim().toLowerCase(); if (!q) return; t.querySelectorAll(".textLayer span").forEach(s => { if (s.textContent.toLowerCase().includes(q)) s.classList.add("rmark"); }); }
function nextHit(d) { if (!hits || !hits.some(Boolean)) return; let k = st.page; for (let i = 0; i < hits.length; i++) { k = ((k - 1 + d + hits.length) % hits.length) + 1; if (hits[k - 1]) break; } goPage(k); }
const searchSoon = debounce(search, 250);
el.querySelector(".rq").addEventListener("input", searchSoon);
el.querySelector(".rq").addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); if (!hits) search().then(() => nextHit(1)); else nextHit(e.shiftKey ? -1 : 1); } if (e.key === "Escape") { e.target.value = ""; search(); pages.focus(); } });
el.querySelector(".rpg").addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") { goPage(+e.target.value); pages.focus(); } if (e.key === "Escape") pages.focus(); });

// ---------- buttons ----------
el.querySelector(".rtb").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || !D) return; const a = b.dataset.r;
  if (b.dataset.c) fitCols(+b.dataset.c);
  if (a === "prev") goPage(st.page - 1); if (a === "next") goPage(st.page + 1);
  if (a === "zin") zoom(1.15); if (a === "zout") zoom(1 / 1.15);
  if (a === "hnext") nextHit(1); if (a === "hprev") nextHit(-1);
  if (a === "toc") toggleToc(); if (a === "night") RD.night(); if (a === "place") RD.place(); if (a === "split") RD.split();
});
RD.night = v => { const on = v == null ? !document.body.classList.contains("rnight") : v; document.body.classList.toggle("rnight", on); ls.set("rnight", on ? "1" : "0"); el.querySelector('[data-r="night"]').setAttribute("aria-pressed", String(on)); };
RD.night(ls.get("rnight", "0") === "1");
// the board beside the PDF: read on the right, collect on the left
RD.split = v => { ls.set("split", (v == null ? ls.get("split", "0") !== "1" : v) ? "1" : "0"); applySplit(); };
function applySplit() { const on = ls.get("split", "0") === "1" && innerWidth >= 900; document.body.classList.toggle("split", on); el.querySelector('[data-r="split"]').setAttribute("aria-pressed", String(on));
  if (!on && PW.pane === "board" && RD.on) PW.pane = "reader"; requestAnimationFrame(() => { B.doc && B.applyView(); if (RD.on && D && st && st.cols) fitCols(st.cols, true); PW.draw && PW.draw.place(); PW.sections && PW.sections.place(); }); }
addEventListener("resize", () => { if ((ls.get("split", "0") === "1") !== document.body.classList.contains("split") || innerWidth < 900) applySplit(); });
applySplit();
// double-click a page: just that page, as large as fits; double-click again: back
grid.addEventListener("dblclick", e => { const t = e.target.closest(".rt"); if (!t || e.target.closest(".textLayer span")) return; const n = +t.dataset.p; if (st.cols === 1) fitCols(st.prevCols || 2); else { st.prevCols = st.cols; fitCols(1); } goPage(n, null, true); });
grid.addEventListener("click", e => { const t = e.target.closest(".rt"); if (t && !getSelection().toString()) { st.page = +t.dataset.p; markCur(); } });

// ---------- to the board ----------
RD.place = async function () {
  if (!RD.asset) return; if (!B.doc) { toast("open a board first (+)"); return; }
  const there = all().find(o => o.type === "pdf" && o.asset === RD.asset);
  if (!document.body.classList.contains("split")) PW.tabs.showBoard(); if (there) { B.select([there.id]); B.reveal(there, .4); B.flash(there.id); toast("already on this board"); return; }
  // next to the cards already made from this PDF (they get linked to its pages), or in the middle
  const col = all().filter(o => o.ref && o.ref.asset === RD.asset && !obj(o.ref.pdf)), bb = col.length ? B.bounds(col) : null, c = B.center(), id = B.id();
  col.forEach(o => { o.ref.pdf = id; });
  const o = B.add({ id, type: "pdf", x: Math.round(bb ? bb.x0 - 820 : c.x - 390), y: Math.round(bb ? bb.y0 : c.y - 450), w: 780, h: 900, asset: RD.asset, name: st.name, cols: 2, ps: .45, mode: "grid", page: st.page });
  col.forEach(x => B.render(x)); setTimeout(() => B.fit([o, ...col], 1), 300); toast("“" + st.name.replace(/\.pdf$/i, "") + "” is on the board");
};
// select text: make a card on the board you worked on last
function selInfoR() { const s = getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return null; const r = s.getRangeAt(0), n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement, t = n && n.closest(".rt");
  const text = s.toString().replace(/\s+/g, " ").trim(); if (!t || !text || !el.contains(t)) return null; return { text, page: +t.dataset.p, rect: r.getBoundingClientRect() }; }
function showSel() {
  const si = selInfoR(); if (!si) { selb.hidden = true; return; } selb._si = si; selb.innerHTML = "";
  const target = B.doc ? (B.doc.name || "board") : null, ln = PW.map.lastNode && obj(PW.map.lastNode);
  [["y", "#ffd23f"], ["g", "#7fe08a"], ["p", "#ff8fcf"]].forEach(([c, col]) => selb.append(h("button", { class: "b mk", "data-m": c, title: "highlight" }, h("i", { style: { background: col } })))); selb.append(h("span", { class: "rsep" }));
  if (!target) selb.append(h("span", { class: "rlbl", text: "open a board to collect" }));
  else { [["note", "note"], ["def", "definition"], ["q", "question"], ["node", ln ? "→ " + texPlain(ln.text || "branch").slice(0, 16) : "branch"]].forEach(([k, l]) => selb.append(h("button", { class: "b", "data-k": k }, l))); selb.append(h("span", { class: "rlbl", text: "→ " + target.slice(0, 24) })); }
  selb.hidden = false; const r = si.rect, mr = el.getBoundingClientRect(); selb.style.left = clamp(r.left - mr.left, 4, mr.width - selb.offsetWidth - 4) + "px"; selb.style.top = (r.top - mr.top > 50 ? r.top - mr.top - selb.offsetHeight - 6 : r.bottom - mr.top + 6) + "px";
}
el.addEventListener("mouseup", e => { if (e.target.closest(".rsel,.rtb")) return; setTimeout(showSel, 0); });
document.addEventListener("selectionchange", () => { if (!selb.hidden && !selInfoR()) selb.hidden = true; });
selb.addEventListener("mousedown", e => e.preventDefault());
selb.addEventListener("click", e => { const m = e.target.closest("button[data-m]"); if (m) { PW.marks.fromSelection(m.dataset.m).then(() => { selb.hidden = true; getSelection().removeAllRanges(); }); return; } const b = e.target.closest("button[data-k]"); if (!b) return; RD.toBoard(b.dataset.k, selb._si); selb.hidden = true; getSelection().removeAllRanges(); });
RD.toBoard = function (kind, si) {
  if (!B.doc || !si) return; const { text, page } = si, src = st.name.replace(/\.pdf$/i, "") + " p." + page;
  const onBoard = all().find(o => o.type === "pdf" && o.asset === RD.asset), ref = { asset: RD.asset, page, name: st.name }; if (onBoard) ref.pdf = onBoard.id;
  // cards made while reading line up in a column next to the PDF (or in the middle of the board)
  const base = onBoard ? { x: onBoard.x + onBoard.w + 36, y: onBoard.y } : freeNear(B.center(), 400);
  const col = all().filter(o => o.ref && o.ref.asset === RD.asset && o.type !== "node"), y = col.length ? Math.max(...col.map(o => o.y + B.size(o).h)) + 24 : base.y, x = col.length ? col[0].x : base.x;
  let c;
  if (kind === "node") { c = PW.map.addFromText(text, ref, { x: Math.round(x), y: Math.round(y) }); }
  else if (kind === "note") c = B.add({ type: "note", x: Math.round(x), y: Math.round(y), w: 300, text, color: "white", ref, refText: text }, { select: false });
  else if (kind === "def") { const short = text.length < 60; c = B.add({ type: "def", x: Math.round(x), y: Math.round(y), w: 380, term: short ? text : "", def: short ? "" : text, src, ref, refText: text }, { select: false }); }
  else c = B.add({ type: "q", x: Math.round(x), y: Math.round(y), w: 380, qt: "concept", q: "", a: text, src, ref, refText: text }, { select: false });
  toast((kind === "def" ? "definition" : kind === "q" ? "question" : kind === "node" ? "branch" : "note") + " added to “" + (B.doc.name || "board") + "” · p." + page, 3000);
  if (c && document.body.classList.contains("split")) { // the board is beside: write the rest of the card right away
    B.select([c.id]); B.reveal(c, Math.max(B.view.z, .7)); const f = kind === "q" ? "q" : kind === "def" ? (c.term ? "def" : "term") : null; if (f) { PW.pane = "board"; setTimeout(() => B.edit(c, f), 280); } }
};
// one page as large as fits (S); back to the columns (G or R) — as in pdfgrid
function onePage() { if (!D) return; const [w, hh] = D.sizes[st.page - 1]; if (st.cols) st.prevCols = st.cols; st.cols = 0; st.gz = clamp(Math.min((pages.clientWidth - 70) / w, (pages.clientHeight - 30) / hh), .1, 5); grid.classList.add("one"); sizeTiles(); saveRecent(); goPage(st.page, null, true); }
// a free place near p for a card of width w (frames do not count, cards may go inside them)
function freeNear(p, w) {
  const boxes = all().filter(o => !isArea(o) && !(o.type === "image" && o.bg)).map(o => B.box(o)), free = (x, y) => !boxes.some(b => b.x < x + w && b.x + b.w > x && b.y < y + 160 && b.y + b.h > y);
  for (let r = 0; r < 12; r++) for (const [dx, dy] of [[0, 0], [w + 40, 0], [-(w + 40), 0], [0, 200], [w + 40, 200], [-(w + 40), 200]]) { const x = Math.round(p.x - w / 2 + dx * (1 + r)), y = Math.round(p.y - 80 + dy * (1 + r * .5)); if (free(x, y)) return { x, y }; }
  return { x: Math.round(p.x), y: Math.round(p.y) };
}
RD.key = function (e) {
  const altGr = !!(e.getModifierState && e.getModifierState("AltGraph")), k = e.key, ctrl = (e.ctrlKey || e.metaKey) && !altGr, kl = k.toLowerCase(); if (!D) return false;
  if (ctrl && kl === "f") { e.preventDefault(); el.querySelector(".rq").focus(); el.querySelector(".rq").select(); return true; }
  if (ctrl && kl === "g") { e.preventDefault(); const i = el.querySelector(".rpg"); i.focus(); i.select(); return true; }
  if (ctrl && e.shiftKey && kl === "c") { e.preventDefault(); PW.pdf.texts(RD.asset).then(T => navigator.clipboard.writeText(T[st.page - 1] || "")).then(() => toast("text of p. " + st.page + " copied")).catch(() => toast("copy not allowed here")); return true; }
  if (e.shiftKey && !ctrl && !e.altKey && /^Digit[1-6]$/.test(e.code)) { e.preventDefault(); fitCols(+e.code.slice(5)); return true; }
  if (PW.draw && PW.draw.key(e)) return true;
  if (ctrl || (e.altKey && !altGr)) return false;
  if (k === "/") { e.preventDefault(); el.querySelector(".rq").focus(); return true; }
  if (k === "ArrowRight" || k === "PageDown") { e.preventDefault(); goPage(st.page + 1); return true; }
  if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); goPage(st.page - 1); return true; }
  if (k === "Home") { e.preventDefault(); goPage(1); return true; } if (k === "End") { e.preventDefault(); goPage(D.pages.length); return true; }
  if (k === "+" || k === "=") { zoom(1.15); return true; } if (k === "-") { zoom(1 / 1.15); return true; } if (k === "0") { fitCols(st.cols || 1); return true; }
  if (/^[1-6]$/.test(k)) { fitCols(+k); return true; }
  if (k === "i" || k === "I") { toggleToc(); return true; } if (k === "n" || k === "N") { RD.night(); return true; }
  if (kl === "s") { onePage(); return true; } if (kl === "g" || kl === "r") { fitCols(st.prevCols || st.cols || 2); return true; }
  if (kl === "o") { RD.pick(); return true; } if (kl === "w") { PW.tabs.close("pdf:" + RD.asset); return true; } if (kl === "t") { run("boards"); return true; }
  if (kl === "m") { run("chrome"); return true; } if (kl === "a") { run("appearance"); return true; } if (k === "?") { run("keys"); return true; }
  if (k === "F3") { e.preventDefault(); nextHit(e.shiftKey ? -1 : 1); return true; }
  if (k === "Escape") { if (!selb.hidden) { selb.hidden = true; getSelection().removeAllRanges(); } return true; }
  if (k === "ArrowDown" || k === "ArrowUp" || k === " ") { if (document.activeElement !== pages) pages.focus(); return false; }
  return k.length === 1;
};
// drop PDFs on the reader: read them
el.addEventListener("drop", e => { const fs = [...(e.dataTransfer?.files || [])].filter(f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)); if (!fs.length) return; e.preventDefault(); e.stopPropagation(); fs.forEach(f => RD.addFile(f)); }, true);
// a page chip on a card made while reading opens the reader there
const goto0 = PW.pdf.goto; PW.pdf.goto = function (ref, text) { if (ref && ref.asset && (!ref.pdf || !obj(ref.pdf))) return RD.open(ref.asset, ref.page, text); return goto0(ref, text); };

// ---------- commands ----------
cmd({ id: "open-pdf", menu: "PDF", label: "Open a PDF to read…", key: "Ctrl+Shift+O", run: () => RD.pick() });
cmd({ id: "recent-pdfs", menu: "PDF", label: "Recently read…", run: () => RD.recentDlg(false) });
cmd({ id: "pdf-to-board", menu: "PDF", label: "Put a recently read PDF on the board…", enabled: () => !!B.doc, run: () => RD.recentDlg(true), sep: true });
cmd({ id: "pdf-split", menu: "PDF", label: "Board beside the PDF", check: () => ls.get("split", "0") === "1", run: () => RD.split() });
cmd({ id: "pdf-place", menu: "PDF", label: "Put this PDF on the board", enabled: () => RD.on && !!B.doc, run: () => RD.place() });
cmd({ id: "pdf-toc", menu: "PDF", label: "Chapters", key: "I", enabled: () => RD.on, check: () => !toc.hidden, run: () => toggleToc() });
cmd({ id: "pdf-night", menu: "PDF", label: "Night (invert pages)", key: "N", enabled: () => RD.on, check: () => document.body.classList.contains("rnight"), run: () => RD.night() });
[1, 2, 3, 4, 6].forEach(n => cmd({ id: "pdf-cols-" + n, menu: "PDF", sub: "Columns", label: n + (n === 1 ? " column" : " columns"), key: String(n), enabled: () => RD.on, run: () => fitCols(n) }));
RD.pick = async function () {
  try { if (window.showOpenFilePicker) { const hs = await showOpenFilePicker({ multiple: true, types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }] }); for (const hd of hs) await RD.addFile(await hd.getFile()); return; } } catch (e) { if (e.name === "AbortError") return; }
  const inp = h("input", { type: "file", accept: "application/pdf,.pdf", multiple: true, hidden: true }); inp.onchange = async () => { for (const f of inp.files) await RD.addFile(f); inp.remove(); }; document.body.append(inp); inp.click();
};
RD.recentDlg = async function (toBoard) {
  const list = await RD.recent(); if (!list.length) { toast("no PDFs read yet"); return; }
  const box = h("div", { class: "list" }); list.slice(0, 30).forEach(r => box.append(h("button", { class: "b", "data-a": r.asset, style: { height: "auto", padding: "4px 8px", display: "flex", justifyContent: "space-between", gap: "14px" } }, h("span", { text: r.name.replace(/\.pdf$/i, "") }), h("span", { text: (r.page > 1 ? "p. " + r.page + " / " : "") + (r.pages || "?") + " pages" }))));
  const v = await dialog({ title: toBoard ? "put on the board" : "recently read", body: box, width: "min(560px,calc(100vw - 20px))", buttons: [{ label: "close", value: null }], init: (d, close) => box.addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (b) close(b.dataset.a); }) });
  if (!v) return; if (!toBoard) return RD.open(v);
  const r = entry(v), c = B.center(); const o = B.add({ type: "pdf", x: Math.round(c.x - 300), y: Math.round(c.y - 200), w: 600, asset: v, name: r ? r.name : "document.pdf", cols: 2, ps: .45, mode: "grid", page: r ? r.page : 1 }); setTimeout(() => B.fit([o], 1), 300);
};
// home page: recently read PDFs under the boards
RD.drawHome = async function (box) {
  box.innerHTML = ""; const list = await RD.recent();
  if (!list.length) { box.append(h("div", { class: "none", text: "open a PDF to read it here (Ctrl+Shift+O, or drop it on the window)" })); return; }
  list.slice(0, 20).forEach(r => { const row = h("div", { class: "r" }, h("span", { class: "nm", text: (PW.tabs.has("pdf:" + r.asset) ? "▸ " : "") + r.name.replace(/\.pdf$/i, "") }), h("span", { class: "m", text: r.page > 1 ? "p. " + r.page + " / " + (r.pages || "?") : (r.pages || "?") + " pages" }), h("span", { class: "m", text: PW.ago ? PW.ago(r.opened) : "" }));
    row.onclick = () => RD.open(r.asset); box.append(row); });
};

})();
