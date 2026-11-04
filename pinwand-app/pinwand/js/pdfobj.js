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
PDF.texts = async function (asset) { const D = await PDF.load(asset); if (D.texts) return D.texts; const T = []; for (let i = 0; i < D.pages.length; i++) { const c = await PDF.textContent(D, i); T.push(c.items.map(t => t.str).join(" ").replace(/\s+/g, " ")); } D.texts = T; return T; };

// ---------- the object ----------
B.types.pdf = {
  minW: 200,
  create(o) {
    const e = h("div", { class: "win pdf" },
      h("div", { class: "wt" }, h("span", { class: "nm" }), h("span", { class: "lbl pp" }),
        h("button", { class: "b", "data-a": "prev", title: "previous page" }, "‹"), h("button", { class: "b", "data-a": "next", title: "next page" }, "›"),
        h("button", { class: "b", "data-a": "mode", title: "one page / all pages" }, "1"),
        h("button", { class: "b", "data-a": "c-", title: "fewer columns" }, "|−"), h("button", { class: "b", "data-a": "c+", title: "more columns" }, "|+"),
        h("button", { class: "b", "data-a": "s-", title: "smaller pages" }, "−"), h("button", { class: "b", "data-a": "s+", title: "larger pages" }, "+")),
      h("div", { class: "pages" }));
    e.querySelector(".wt").addEventListener("click", ev => {
      const b = ev.target.closest("button[data-a]"); if (!b) return; ev.stopPropagation(); const o2 = obj(e.dataset.id), a = b.dataset.a;
      if (a === "mode") o2.mode = o2.mode === "one" ? "grid" : "one";
      if (a === "prev") { o2.mode = "one"; o2.page = Math.max(1, (o2.page || 1) - 1); }
      if (a === "next") { o2.mode = "one"; o2.page = Math.min(e._n || 1, (o2.page || 1) + 1); }
      if (a === "c-") o2.cols = Math.max(1, (o2.cols || 2) - 1); if (a === "c+") o2.cols = Math.min(12, (o2.cols || 2) + 1);
      if (a === "s-") o2.ps = Math.max(.15, (o2.ps || .5) / 1.2); if (a === "s+") o2.ps = Math.min(3, (o2.ps || .5) * 1.2);
      B.render(o2); B.renderEdges(); B.commit(); PDF.onView();
    });
    e.querySelector(".pages").addEventListener("dblclick", ev => ev.stopPropagation());
    return e;
  },
  update(o, e) {
    o.cols = o.cols || 2; o.ps = o.ps || .5; o.mode = o.mode || "grid"; o.page = o.page || 1;
    e.querySelector(".nm").textContent = o.name || "document.pdf"; e.querySelector('[data-a="mode"]').textContent = o.mode === "one" ? "▦" : "1";
    if (e._asset !== o.asset) { e._asset = o.asset; e._ready = false; PDF.load(o.asset).then(D => { e._D = D; e._n = D.pages.length; e._ready = true; buildPages(o, e); B.render(o); B.renderEdges(); PDF.onView(); }).catch(err => { e.querySelector(".pages").textContent = "cannot open this PDF: " + (err && err.message || err); }); }
    if (!e._ready) { e.style.width = Math.max(o.w, 300) + "px"; return; }
    const D = e._D, n = D.pages.length; e.querySelector(".pp").textContent = o.mode === "one" ? `${o.page}/${n}` : `${n} pp`;
    const maxW = Math.max(...D.sizes.map(s => s[0])) * o.ps, cols = o.mode === "one" ? 1 : Math.min(o.cols, n), gap = 12;
    o.w = Math.round(cols * maxW + (cols - 1) * gap + 20 + 4); e.style.width = o.w + "px";
    e.querySelectorAll(".pg").forEach((p, i) => { const [w, hh] = D.sizes[i]; p.style.width = w * o.ps + "px"; p.style.height = hh * o.ps + "px"; p.hidden = o.mode === "one" && i + 1 !== o.page;
      if (p._ps !== o.ps) { p._ps = o.ps; p._tl = false; p._rw = 0; } });
    PDF.marks(o, e);
  },
  text: o => o.name || "",
};
function buildPages(o, e) {
  const box = e.querySelector(".pages"); box.innerHTML = "";
  e._D.sizes.forEach((s, i) => box.append(h("div", { class: "pg", "data-p": i + 1 }, h("canvas"), h("div", { class: "textLayer" }), h("div", { class: "marks" }), h("span", { class: "pno", text: String(i + 1) }))));
}

// ---------- rendering pages at the right sharpness for the current zoom ----------
const queue = []; let busy = 0;
PDF.onView = debounce(() => {
  const r = vp.getBoundingClientRect(), list = [];
  for (const e of world.querySelectorAll(".obj.pdf")) {
    if (!e._ready) continue; const er = e.getBoundingClientRect(); if (er.right < r.left - 400 || er.left > r.right + 400 || er.bottom < r.top - 400 || er.top > r.bottom + 400) continue;
    for (const p of e.querySelectorAll(".pg")) { if (p.hidden) continue; const pr = p.getBoundingClientRect(); const vis = pr.right > r.left - 300 && pr.left < r.right + 300 && pr.bottom > r.top - 300 && pr.top < r.bottom + 300; if (vis) list.push([e, p, pr.width]); }
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
  const div = p.querySelector(".textLayer"), tc = await PDF.textContent(D, i), vpt = D.pages[i].getViewport({ scale: o.ps });
  div.replaceChildren(); div.style.setProperty("--scale-factor", o.ps);
  try { await pdfjsLib.renderTextLayer({ textContentSource: tc, container: div, viewport: vpt, textDivs: [] }).promise; } catch (err) { }
  const end = h("div", { class: "endOfContent" }); div.append(end); div.addEventListener("mousedown", () => end.classList.add("active"));
}
addEventListener("mouseup", () => document.querySelectorAll(".endOfContent.active").forEach(x => x.classList.remove("active")));
PDF.forget = set => { };

// ---------- markers on pages for cards made from them ----------
PDF.marks = function (o, e) {
  const by = new Map(); for (const c of all()) if (c.ref && c.ref.pdf === o.id) { if (!by.has(c.ref.page)) by.set(c.ref.page, []); by.get(c.ref.page).push(c); }
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
  const r = vp.getBoundingClientRect(), pw = parseFloat(p.style.width), ph = parseFloat(p.style.height);
  const px = o.x + p.offsetLeft, py = o.y + p.offsetTop;
  const z = clamp(Math.min(r.width * .8 / pw, r.height * .92 / ph), .2, 4);
  B.navTo(r.width / 2 - (px + pw / 2) * z, r.height / 2 - (py + ph / 2) * z, z); B.select([o.id]);
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
  selbar.hidden = false; const r = si.rect; selbar.style.left = clamp(r.left, 4, innerWidth - selbar.offsetWidth - 4) + "px"; selbar.style.top = (r.top > 40 ? r.top - selbar.offsetHeight - 6 : r.bottom + 6) + "px";
}
document.addEventListener("mouseup", e => { if (e.target.closest("#selbar")) return; setTimeout(showSelbar, 0); });
document.addEventListener("selectionchange", () => { if (!selbar.hidden && !selInfo()) selbar.hidden = true; });
selbar.addEventListener("mousedown", e => e.preventDefault());
selbar.addEventListener("click", e => { const b = e.target.closest("button[data-k]"); if (!b) return; PDF.fromSelection(b.dataset.k, selbar._si); selbar.hidden = true; getSelection().removeAllRanges(); });
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
        const o = B.add({ type: "pdf", x: Math.round(at.x), y: Math.round(y), w: 600, asset: a.file, name: f.name, cols: D.pages.length <= 4 ? D.pages.length : D.pages.length <= 16 ? 4 : 8, ps: .5, mode: "grid", page: 1 }, { commit: false });
        made.push(o); y += 60;
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
