"use strict";
// pinwand · tool layouts (top bar, bottom bar, left bar) and the small bar next to a selection
const I = {
  note: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/>',
  def: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M10 5v14M13 10h5M13 14h4"/>',
  q: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.7"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  node: '<rect x="8" y="9.5" width="8" height="5" rx="1"/><path d="M16 12h2M18 7v10M18 7h2M18 17h2M6 12H4"/>',
  frame: '<rect x="3" y="5" width="18" height="15" stroke-dasharray="3 2"/><path d="M3 5h7v-2H3z" fill="currentColor"/>',
  table: '<rect x="3" y="5" width="18" height="14"/><path d="M3 10h18M3 14.5h18M9 5v14M15 5v14"/>',
  matrix: '<path d="M12 3v18M3 12h18"/><path d="M12 3l-2 3M12 3l2 3M21 12l-3-2M21 12l-3 2"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 16h6"/>',
  fig: '<path d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/><path d="M3 20h18"/>',
  html: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12"/>',
  arrow: '<path d="M4 18L18 6"/><path d="M11 6h7v7"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="18" r="1" fill="currentColor"/>',
  review: '<rect x="4" y="7" width="14" height="12" rx="1"/><path d="M7 4h13v12"/><path d="M8 13l2 2 4-4"/>',
  walk: '<circle cx="6" cy="17" r="2"/><circle cx="18" cy="7" r="2"/><path d="M8 17c6 0 2-10 8-10" stroke-dasharray="2 2"/>',
  cover: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><path d="M4 20L20 4"/>',
  gaps: '<path d="M3 8h6M14 8h7M3 16h3M11 16h10"/><rect x="9.5" y="5.5" width="4" height="5" fill="currentColor" stroke="none"/><rect x="6.5" y="13.5" width="4" height="5" fill="currentColor" stroke="none"/>',
  present: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M10 7.5v5l4-2.5z" fill="currentColor"/><path d="M12 16v4M8 20h8"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10h-2"/>',
  redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12H9a5 5 0 0 0 0 10h2"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  zin: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M8 10.5h5M10.5 8v5"/>',
  zout: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M8 10.5h5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V4h12"/>',
  front: '<rect x="4" y="4" width="10" height="10"/><rect x="10" y="10" width="10" height="10" fill="currentColor" fill-opacity=".25"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
};
const svgI = n => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${I[n] || ""}</svg>`;
PW.icon = svgI;
const NOTE_COLS = ["yellow", "green", "blue", "pink", "grey", "white"];
const TOOLS = [
  ["new-note", "note", "Note (N)"], ["new-def", "def", "Definition (D)"], ["new-q", "q", "Question (Q)"], ["new-node", "node", "Map (M)"], ["new-table", "table", "Table (T)"],
  ["new-frame", "frame", "Frame (F)"], ["new-matrix", "matrix", "2×2 matrix"], ["add-list", "list", "From a list"], ["insert-file", "file", "PDF or picture (I)"], ["new-fig-flow", "fig", "Live figure"], ["new-html", "html", "HTML block"], ["link", "arrow", "Arrow (L)"],
  "|", "swatches", "|",
  ["review", "review", "Review (R)"], ["walk", "walk", "Walk (W)"], ["cover", "cover", "Cover definitions (H)"], ["gaps", "gaps", "Gaps (G)"], ["present", "present", "Present (P)"],
  "|", ["undo", "undo", "Undo (Ctrl+Z)"], ["redo", "redo", "Redo (Ctrl+Y)"], ["zoom-out", "zout", "Zoom out (-)"], ["fit", "fit", "Fit (0)"], ["zoom-in", "zin", "Zoom in (+)"], ["search", "search", "Search (/)"],
];
function swatches(vertical) {
  const box = h("div", { class: "sw" + (vertical ? " v" : "") });
  NOTE_COLS.forEach(c => { const b = h("button", { type: "button", class: "swb c-" + c, title: c, "data-c": c, "aria-pressed": String(ls.get("noteColor", "yellow") === c) });
    b.onclick = () => { const notes = B.selected().filter(o => o.type === "note"); if (notes.length) { notes.forEach(o => { o.color = c; if (o.style) delete o.style; B.render(o); }); B.commit(); } ls.set("noteColor", c); box.querySelectorAll(".swb").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.c === c))); if (!notes.length) toast("new notes: " + c); };
    box.append(b); });
  return box;
}
function buildDock() {
  const old = $("dock"); old && old.remove(); const mode = ls.get("tools", "top"); document.body.classList.remove("tools-bottom", "tools-left");
  if (mode === "top") return; document.body.classList.add("tools-" + mode);
  const d = h("div", { id: "dock", class: "bevel " + mode, role: "toolbar" });
  TOOLS.forEach(t => { if (t === "|") return d.append(h("span", { class: "dsep" })); if (t === "swatches") return d.append(swatches(mode === "left"));
    const [id, ic, tip] = t, b = h("button", { type: "button", class: "di", title: tip, "data-cmd": id, html: svgI(ic) }); b.onclick = () => run(id); d.append(b); });
  document.body.append(d); updDock();
}
function updDock() { const d = $("dock"); if (!d) return; d.querySelectorAll("[data-cmd]").forEach(b => { const c = PW.cmds.get(b.dataset.cmd); b.disabled = !!(c && c.enabled && !c.enabled()); if (c && c.check) b.setAttribute("aria-pressed", String(!!c.check())); }); }
PW.tools = { build: buildDock, upd: updDock };
// new notes take the chosen colour
const noteCmd = PW.cmds.get("new-note"); if (noteCmd) { const r0 = noteCmd.run; noteCmd.run = p => { const o = r0(p); const n = B.cur(); if (n && n.type === "note" && !n.text) { n.color = ls.get("noteColor", "yellow"); B.render(n); } return o; }; }
["top", "bottom", "left"].forEach(m => cmd({ id: "tools-" + m, menu: "View", sub: "Tools", label: { top: "bar at the top", bottom: "bar at the bottom", left: "bar on the left" }[m], check: () => ls.get("tools", "top") === m, run: () => { ls.set("tools", m); buildDock(); } }));
cmd({ id: "ctxbar", menu: "View", sub: "Tools", label: "bar next to the selection", check: () => ls.get("ctxbar", "1") === "1", run: () => { ls.set("ctxbar", ls.get("ctxbar", "1") === "1" ? "0" : "1"); ctxSoon(); } });

// ---------- the bar next to whatever is selected ----------
const ICONS = ["", "★", "!", "?", "✓", "✗", "⚠", "💡", "❤", "⏱", "📌", "①", "②", "③", "④", "⑤"];
const SHAPES = [["box", "▭"], ["round", "▢"], ["pill", "⬭"], ["plain", "＿"], ["fill", "■"]];
const LAYS = [["both", "⟷", "both sides"], ["right", "→", "one side"], ["down", "↓", "top-down"], ["indent", "☰", "list"]];
const ctx = h("div", { id: "ctxbar", class: "bevel", hidden: true }); document.body.append(ctx);
let pop = null; const closePop = () => { if (pop) { pop.remove(); pop = null; } };
function ctxBtn(html, tip, fn, pressed) { const b = h("button", { type: "button", class: "cb", title: tip, html }); if (pressed != null) b.setAttribute("aria-pressed", String(!!pressed)); b.onclick = e => { e.stopPropagation(); fn(b); }; return b; }
function popup(anchor, items, cols = 8) { closePop(); const r = anchor.getBoundingClientRect(); pop = h("div", { class: "bevel ctxpop", style: { left: r.left + "px", top: (r.bottom + 4) + "px", gridTemplateColumns: `repeat(${cols},auto)` } }); items.forEach(x => pop.append(x)); document.body.append(pop); }
function drawCtx() {
  ctx.innerHTML = ""; closePop();
  const sel = B.selected(), show = ls.get("ctxbar", "1") === "1" && sel.length && !PW.present.on && !PW.study.walking() && !document.body.classList.contains("dragging");
  if (!show) { ctx.hidden = true; return; }
  const notes = sel.filter(o => o.type === "note"), nodes = sel.filter(o => o.type === "node"), tree = sel.filter(o => PW.map.inTree(o) || o.type === "node");
  if (notes.length) {
    NOTE_COLS.concat("none").forEach(c => ctx.append(ctxBtn("", c, () => { notes.forEach(o => { o.color = c; if (c !== "none" && o.style) delete o.style; B.render(o); }); B.commit(); ctxSoon(); }, notes.every(o => (o.color || "yellow") === c))));
    [...ctx.children].forEach((b, i) => b.classList.add("swb", "c-" + NOTE_COLS.concat("none")[i]));
    ctx.append(h("span", { class: "dsep" }));
    [["", "Aa", "normal"], ["h2", "<b>H</b>", "heading"], ["h1", "<b style='font-size:15px'>H</b>", "big heading"]].forEach(([s, l, t]) => ctx.append(ctxBtn(l, t, () => { notes.forEach(o => { if (s) { o.style = s; o.color = "none"; } else delete o.style; B.render(o); }); B.commit(); PW.map.relayoutAll(false); ctxSoon(); }, notes.every(o => (o.style || "") === s))));
    ctx.append(h("span", { class: "dsep" }));
  }
  if (nodes.length) {
    const cur = nodes[0];
    ctx.append(ctxBtn(`<span style="font-size:14px">${cur.icon || "☆"}</span>`, "icon", b => popup(b, ICONS.map(ic => ctxBtn(ic || "∅", ic || "no icon", () => { PW.map.setIcon(nodes, ic); closePop(); ctxSoon(); })), 8)));
    ctx.append(ctxBtn('<span class="bdot" style="background:' + (cur.color ? `var(--${cur.color})` : "var(--bc,var(--b1))") + '"></span>', "branch colour", b => popup(b, ["", "b1", "b2", "b3", "b4", "b5", "b6", "b7"].map(c => ctxBtn(`<span class="bdot" style="background:${c ? `var(--${c})` : "transparent"};${c ? "" : "border:1px dashed var(--ink)"}"></span>`, c || "automatic", () => { PW.map.setColor(nodes, c); closePop(); ctxSoon(); })), 8)));
    ctx.append(ctxBtn("▭", "shape", b => popup(b, [...SHAPES.map(([s, l]) => ctxBtn(l, s, () => { PW.map.setShape(nodes, s, false); closePop(); ctxSoon(); })), h("span", { class: "dsep" }), ...SHAPES.map(([s, l]) => ctxBtn(l + "*", s + " for the whole map", () => { PW.map.setShape(nodes, s, true); closePop(); ctxSoon(); }))], 6)));
  }
  if (tree.length) {
    const r = PW.map.rootOf(tree[0]), lay = r.layout || "both";
    LAYS.forEach(([m, l, t]) => ctx.append(ctxBtn(l, "map: " + t, () => { PW.map.setLayout(tree[0], m); ctxSoon(); }, lay === m)));
    ctx.append(h("span", { class: "dsep" }));
  }
  if (sel.length === 1) ctx.append(ctxBtn(svgI("arrow"), "arrow from here (L)", () => run("link")));
  ctx.append(ctxBtn(svgI("dup"), "duplicate (Ctrl+D)", () => run("dup")), ctxBtn(svgI("front"), "to front", () => run("front")), ctxBtn(svgI("trash"), "delete (Del)", () => run("delete")));
  ctx.hidden = false; placeCtx();
}
function placeCtx() {
  if (ctx.hidden) return; const sel = B.selected(); if (!sel.length) { ctx.hidden = true; return; }
  const b = B.bounds(sel); if (!b) { ctx.hidden = true; return; } const r = vp.getBoundingClientRect(), z = B.view.z;
  const x0 = r.left + B.view.x + b.x0 * z, x1 = r.left + B.view.x + b.x1 * z, y0 = r.top + B.view.y + b.y0 * z, y1 = r.top + B.view.y + b.y1 * z, w = ctx.offsetWidth, hh = ctx.offsetHeight;
  let top = y0 - hh - 10; if (top < r.top + 4) top = y1 + 10; if (top + hh > r.bottom - 4) top = Math.max(r.top + 4, Math.min(r.bottom - hh - 4, y0 + 8));
  const left = clamp((x0 + x1) / 2 - w / 2, r.left + 4, r.right - w - 4);
  if (x1 < r.left || x0 > r.right || y1 < r.top || y0 > r.bottom) { ctx.style.visibility = "hidden"; return; } ctx.style.visibility = "";
  ctx.style.left = left + "px"; ctx.style.top = top + "px";
}
let ctxRaf = 0; function ctxSoon() { cancelAnimationFrame(ctxRaf); ctxRaf = requestAnimationFrame(() => { drawCtx(); updDock(); }); }
PW.ctxSoon = ctxSoon;
const ps = B.onSel; B.onSel = () => { ps && ps(); ctxSoon(); };
const pv = B.onView; B.onView = () => { pv && pv(); placeCtx(); };
vp.addEventListener("pointerdown", e => { if (e.button === 0 && e.target.closest(".obj")) document.body.classList.add("dragging"); ctx.hidden = true; closePop(); }, true);
addEventListener("pointerup", () => { if (document.body.classList.contains("dragging")) { document.body.classList.remove("dragging"); } ctxSoon(); });
document.addEventListener("pointerdown", e => { if (pop && !e.target.closest(".ctxpop,#ctxbar")) closePop(); });
buildDock();
