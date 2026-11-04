"use strict";
// pinwand · search across cards, notes, map branches and the text of every PDF; command palette
const SEARCH = PW.search = {};
const qbox = $("qbox");
let panel = null, hits = [], hi = 0, seq = 0;
const KIND = { note: "note", def: "def", q: "q", node: "map", frame: "frame", pdf: "pdf", fig: "fig", image: "img" };
function ensurePanel() {
  if (panel) return panel;
  panel = h("div", { id: "searchPanel", class: "panel bevel", hidden: true }, h("div", { class: "wt" }, h("span", { text: "search" }), h("span", { class: "sp" }), h("button", { class: "b", onclick: () => SEARCH.close() }, "×")), h("div", { id: "sres", class: "sunk" }));
  document.body.append(panel); panel.querySelector("#sres").addEventListener("click", e => { const d = e.target.closest("div[data-i]"); if (d) { hi = +d.dataset.i; open(hits[hi]); paint(); } });
  return panel;
}
function snippet(t, q) { const i = t.toLowerCase().indexOf(q); if (i < 0) return t.slice(0, 80); const a = Math.max(0, i - 30); return (a ? "…" : "") + t.slice(a, i) + "\u0001" + t.slice(i, i + q.length) + "\u0002" + t.slice(i + q.length, i + q.length + 50); }
SEARCH.run = async function (q) {
  const my = ++seq; q = q.trim().toLowerCase(); ensurePanel(); if (!q) { SEARCH.close(); return; }
  const out = [];
  for (const o of all()) { const t = texPlain(B.textOf(o)); if (t.toLowerCase().includes(q)) out.push({ o, kind: KIND[o.type] || o.type, text: snippet(t, q) }); }
  hits = out; hi = 0; paint(q, true);
  const pdfs = all().filter(o => o.type === "pdf"); let pdfHits = [];
  for (const p of pdfs) { const T = await PW.pdf.texts(p.asset).catch(() => []); if (my !== seq) return; T.forEach((t, i) => { const L = t.toLowerCase(); let n = 0, k = L.indexOf(q); const first = k; while (k >= 0) { n++; k = L.indexOf(q, k + q.length); } if (n) pdfHits.push({ pdf: p, page: i + 1, n, kind: "pdf", text: snippet(t, q).replace(/^/, `${(p.name || "pdf").replace(/\.pdf$/i, "")} p.${i + 1}${n > 1 ? " (" + n + ")" : ""}: `) }); }); }
  hits = out.concat(pdfHits); paint(q, false);
};
function paint(q, loading) {
  const box = panel.querySelector("#sres"); panel.hidden = false; box.innerHTML = "";
  if (!hits.length) { box.append(h("div", { class: "grp", text: loading ? "…" : "no hits" })); return; }
  let last = ""; hits.forEach((x, i) => { const g = x.kind === "pdf" ? "pdf pages" : "board"; if (g !== last) { box.append(h("div", { class: "grp", text: g })); last = g; }
    const d = h("div", { "data-i": i, class: i === hi ? "on" : "" }); d.innerHTML = `[${x.kind}] ` + escHTML(x.text).replace(/\u0001/g, "<b>").replace(/\u0002/g, "</b>"); box.append(d); });
  const on = box.querySelector(".on"); on && on.scrollIntoView({ block: "nearest" });
}
function open(x) { if (!x) return; if (x.kind === "pdf") PW.pdf.goto({ pdf: x.pdf.id, page: x.page }, qbox.value); else { if (PW.map.isHidden(x.o)) { let p = obj(x.o.parent); while (p) { p.collapsed = false; p = p.parent && obj(p.parent); } B.renderAll(); PW.map.relayoutAll(); } B.select([x.o.id]); B.reveal(x.o, .6); B.flash(x.o.id); } }
SEARCH.close = () => { if (panel) panel.hidden = true; hits = []; };
const runSoon = debounce(v => SEARCH.run(v), 200);
qbox.addEventListener("input", () => runSoon(qbox.value));
qbox.addEventListener("keydown", e => {
  e.stopPropagation();
  if (e.key === "Escape") { qbox.value = ""; SEARCH.close(); qbox.blur(); vp.focus(); return; }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!hits.length) return; hi = (hi + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length; paint(); open(hits[hi]); return; }
  if (e.key === "Enter") { e.preventDefault(); if (!hits.length) { runSoon.flush(qbox.value); return; } open(hits[hi]); hi = (hi + 1) % hits.length; paint(); }
});
SEARCH.focus = () => { if (document.body.classList.contains("nochrome")) run("chrome"); qbox.focus(); qbox.select(); };

// ---------- command palette ----------
SEARCH.palette = function () {
  const inp = h("input", { class: "f", type: "text", style: { width: "100%" }, placeholder: "command" }), list = h("div", { class: "list sunk" });
  let items = [], k = 0;
  const all_ = [...PW.cmds.values()].filter(c => c.label && !c.hide);
  const draw = () => { const q = inp.value.trim().toLowerCase(); items = all_.filter(c => !q || (c.menu + " " + c.label).toLowerCase().includes(q) || q.split(/\s+/).every(w => (c.menu + " " + c.label).toLowerCase().includes(w))).filter(c => !c.enabled || c.enabled());
    k = Math.min(k, Math.max(0, items.length - 1)); list.innerHTML = ""; items.slice(0, 60).forEach((c, i) => { const d = h("div", { class: i === k ? "on" : "" }, h("span", { text: (c.menu ? c.menu.toLowerCase() + ": " : "") + c.label }), h("span", { text: c.key || "" })); d.onclick = () => { k = i; go(); }; list.append(d); }); };
  let closeFn = null; const go = () => { const c = items[k]; if (!c) return; closeFn(null); setTimeout(() => run(c.id), 0); };
  inp.addEventListener("input", () => { k = 0; draw(); });
  dialog({ title: "commands", body: h("div", { id: "cmdk", style: { display: "grid", gap: "6px" } }, inp, list), buttons: [],
    onKey: (e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); k = clamp(k + (e.key === "ArrowDown" ? 1 : -1), 0, items.length - 1); draw(); return true; } if (e.key === "Enter") { e.preventDefault(); go(); return true; } return false; },
    init: (dlg, close) => { closeFn = close; draw(); } });
};
