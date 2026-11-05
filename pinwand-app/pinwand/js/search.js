"use strict";
// pinwand · search across cards, notes, map branches and the text of every PDF; command palette
const SEARCH = PW.search = {};
const qbox = $("qbox");
let panel = null, hits = [], hi = 0, seq = 0, kind = "";
const KINDS = [["", "all"], ["def", "definitions"], ["q", "questions"], ["note", "notes"], ["map", "map"], ["table", "tables"], ["pdf", "PDF pages"]];
const KIND = { note: "note", def: "def", q: "q", node: "map", frame: "frame", pdf: "pdf", fig: "fig", image: "img" };
function ensurePanel() {
  if (panel) return panel;
  panel = h("div", { id: "searchPanel", class: "panel bevel", hidden: true }, h("div", { class: "wt" }, h("span", { text: "search" }), h("span", { class: "sp" }), h("button", { class: "b", onclick: () => SEARCH.close() }, "×")),
    h("div", { class: "skinds" }, KINDS.map(([k, l]) => h("button", { class: "b", "data-k": k, "aria-pressed": String(k === kind) }, l))),
    h("div", { class: "srep" }, h("input", { class: "f", id: "srepl", type: "text", placeholder: "replace with…", spellcheck: "false" }), h("button", { class: "b", id: "srepb", title: "replace in every card, note, branch, table and frame of this board (not in PDFs)" }, "replace all")),
    h("div", { id: "sres", class: "sunk" }));
  document.body.append(panel);
  panel.querySelector(".skinds").addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (!b) return; kind = b.dataset.k; panel.querySelectorAll(".skinds [data-k]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.k === kind))); SEARCH.run(qbox.value); });
  const rin = panel.querySelector("#srepl"); rin.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); SEARCH.replace(qbox.value, rin.value); } if (e.key === "Escape") { qbox.focus(); } });
  panel.querySelector("#srepb").addEventListener("click", () => SEARCH.replace(qbox.value, rin.value)); panel.querySelector("#sres").addEventListener("click", e => { const d = e.target.closest("div[data-i]"); if (d) { hi = +d.dataset.i; open(hits[hi]); paint(); } });
  return panel;
}
function snippet(t, q) { const i = t.toLowerCase().indexOf(q); if (i < 0) return t.slice(0, 80); const a = Math.max(0, i - 30); return (a ? "…" : "") + t.slice(a, i) + "\u0001" + t.slice(i, i + q.length) + "\u0002" + t.slice(i + q.length, i + q.length + 50); }
SEARCH.run = async function (q) {
  const my = ++seq; q = q.trim().toLowerCase(); ensurePanel(); if (!q) { SEARCH.close(); return; }
  const out = [];
  for (const o of all()) { const t = texPlain(B.textOf(o)), k = KIND[o.type] || o.type; if ((!kind || kind === k) && t.toLowerCase().includes(q)) out.push({ o, kind: k, text: snippet(t, q) }); }
  hits = out; hi = 0; paint(q, true);
  const pdfs = kind && kind !== "pdf" ? [] : all().filter(o => o.type === "pdf"); let pdfHits = [];
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
// replace: literal text, any case, in the written fields of every item (formulas included)
const FIELDS = { note: ["text"], def: ["term", "def", "src"], q: ["q", "a", "src"], node: ["text"], frame: ["title"], shape: ["text"], matrix: ["title", "xl", "xr", "yb", "yt", "q1", "q2", "q3", "q4"] };
SEARCH.replace = async function (q, r) {
  q = (q || "").trim(); if (!q || !B.doc) { toast("type what to find in the search box first"); return; }
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"); let n = 0, items = 0;
  const swap = s => { if (typeof s !== "string") return s; const m = s.match(re); if (!m) return s; n += m.length; return s.replace(re, () => r); };
  for (const o of all()) { if (kind && kind !== (KIND[o.type] || o.type)) continue; const before = n;
    for (const f of FIELDS[o.type] || []) if (o[f]) o[f] = swap(o[f]);
    if (o.type === "table" && o.rows) o.rows = o.rows.map(row => row.map(swap));
    if (n > before) { items++; B.render(o); } }
  if (!n) { toast("nothing to replace"); return; }
  B.renderEdges(); PW.map && PW.map.relayoutAll(false); B.commit(); toast(n + " replaced in " + items + (items === 1 ? " item" : " items") + " (Ctrl+Z undoes)"); qbox.value = r; SEARCH.run(r);
};
cmd({ id: "replace", menu: "Edit", label: "Find and replace…", key: "Ctrl+H", run: () => { SEARCH.focus(); ensurePanel(); panel.hidden = false; if (qbox.value.trim()) setTimeout(() => panel.querySelector("#srepl").focus(), 0); } });
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
