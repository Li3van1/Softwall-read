"use strict";
// pinwand · looks: style, light/dark, text size, note font, background, map lines, motion
const STYLES = [
  ["retro", "Retro", { bg: "#6c8794", bar: "#00007b", card: "#ffffff", note: "#fff6a8", line: "#000", acc: "#8b0000" }, { bg: "#1b2124", bar: "#26445e", card: "#2a2e31", note: "#4a4521", line: "#0c0e0f", acc: "#ff8f8f" }],
  ["studio", "Studio", { bg: "#eef0ec", bar: "#ffffff", card: "#ffffff", note: "#fde68a", line: "#d8dcd3", acc: "#2f6f5e", r: 4 }, { bg: "#1b1e1a", bar: "#262a24", card: "#262a24", note: "#e9d27a", line: "#3a4036", acc: "#7cc4ad", r: 4 }],
  ["paper", "Paper", { bg: "#f4efe3", bar: "#1f3a68", card: "#fffdf7", note: "#fbf0b5", line: "#cdbf9f", acc: "#a3352b", ruled: "#dbe4ee", r: 2 }, { bg: "#1d2330", bar: "#2a3140", card: "#262d3b", note: "#4b4530", line: "#3f4960", acc: "#c9a25a", r: 2 }],
  ["chalk", "Chalk", { bg: "#2f4a3a", bar: "#233a2d", card: "#34503f", note: "#56603f", line: "#e8e8e0", acc: "#f5e663", r: 3 }],
  ["blueprint", "Blueprint", { bg: "#1d4f91", bar: "#0f2c55", card: "#1f5398", note: "#2f5f8c", line: "#cfe0ff", acc: "#ffd66b", grid: "rgba(255,255,255,.18)" }],
  ["terminal", "Terminal", { bg: "#0b0d0a", bar: "#133d1d", card: "#0f140e", note: "#24230f", line: "#2f8f45", acc: "#ffb347" }],
  ["contrast", "Contrast", { bg: "#ffffff", bar: "#000000", card: "#ffffff", note: "#ffef5c", line: "#000", acc: "#0000c8" }, { bg: "#000", bar: "#fff", card: "#000", note: "#4d4300", line: "#fff", acc: "#ffe600" }],
];
const FIXED_DARK = new Set(["chalk", "blueprint", "terminal"]);
const NOTE_FONTS = { auto: ["style", null, 1], hand: ["handwriting", '"Kalam","Comic Sans MS",cursive', 1.3], marker: ["marker", '"Caveat","Segoe Print",cursive', 1.45], sans: ["sans", '"Figtree","Segoe UI",system-ui,sans-serif', 1], serif: ["serif", '"Georgia","Cambria",serif', 1.05], mono: ["mono", '"Consolas","Cascadia Mono","DejaVu Sans Mono",monospace', .95] };
const PATS = { auto: ["style"], dots: ["dots", "radial-gradient(var(--dot) 1.2px,transparent 1.3px)", "20px 20px"], fine: ["fine dots", "radial-gradient(var(--dot) 1px,transparent 1px)", "6px 6px"], grid: ["grid", "linear-gradient(var(--dot) 1px,transparent 1px),linear-gradient(90deg,var(--dot) 1px,transparent 1px)", "24px 24px"], ruled: ["ruled", "repeating-linear-gradient(transparent 0 31px,var(--dot) 31px 32px)", "auto"], plain: ["plain", "none", "auto"] };
const LOOK_DEF = { style: "retro", theme: "auto", ts: 1, noteFont: "auto", pat: "auto", edges: "elbow", edgeW: 1, motion: true };
const BOARD_KEYS = ["style", "noteFont", "pat", "edges", "edgeW"];
const LOOK = PW.look = Object.assign({}, LOOK_DEF);
function globalLook() { let g = {}; try { g = JSON.parse(ls.get("look", "{}")); } catch (e) { } if (!g.theme) g.theme = ls.get("theme", "auto"); return Object.assign({}, LOOK_DEF, g); }
function boardLook() { return B.doc && B.doc.settings && B.doc.settings.look || null; }
LOOK.resolve = () => { const g = globalLook(), b = boardLook(); if (b) BOARD_KEYS.forEach(k => { if (b[k] != null) g[k] = b[k]; }); return g; };
LOOK.apply = function (rerender = true) {
  const L = LOOK.resolve(), r = document.documentElement, before = [r.dataset.style, r.style.cssText, LOOK.edges, LOOK.edgeW].join("|");
  Object.assign(LOOK, L);
  r.dataset.style = L.style; r.dataset.theme = L.theme === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : L.theme;
  r.dataset.motion = L.motion ? "on" : "off";
  r.style.setProperty("--ts", String(L.ts * (L.style === "contrast" ? 1.12 : 1)));
  const nf = NOTE_FONTS[L.noteFont] || NOTE_FONTS.auto; if (nf[1]) { r.style.setProperty("--f-note", nf[1]); r.style.setProperty("--note-k", nf[2]); } else { r.style.removeProperty("--f-note"); r.style.removeProperty("--note-k"); }
  const pt = PATS[L.pat] || PATS.auto; if (pt[1]) { r.style.setProperty("--pat", pt[1]); r.style.setProperty("--pat-size", pt[2]); } else { r.style.removeProperty("--pat"); r.style.removeProperty("--pat-size"); }
  r.style.setProperty("--edge-w", String(L.edgeW));
  const after = [r.dataset.style, r.style.cssText, LOOK.edges, LOOK.edgeW].join("|");
  if (rerender) { if (B.doc && after !== before) { B.renderAll(); PW.map.relayoutAll(false); setTimeout(() => B.renderEdges(), 120); } PW.figRedraw(); B.renderEdges(); PW.drawMini && PW.drawMini(); }
  // fonts load lazily; once a new one arrives the cards change size
  if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(() => { if (B.doc) { B.renderEdges(); PW.map.relayoutAll(false); } });
};
LOOK.set = function (patch, scopeBoard) {
  const g = globalLook();
  for (const [k, v] of Object.entries(patch)) {
    if (scopeBoard && B.doc && BOARD_KEYS.includes(k)) { B.doc.settings = B.doc.settings || {}; B.doc.settings.look = Object.assign({}, B.doc.settings.look, { [k]: v }); B.touch(); }
    else g[k] = v;
  }
  ls.set("look", JSON.stringify(g)); LOOK.apply();
};
LOOK.clearBoard = () => { if (B.doc && B.doc.settings && B.doc.settings.look) { delete B.doc.settings.look; B.touch(); LOOK.apply(); } };
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (LOOK.theme === "auto") LOOK.apply(); });

// ---------- the appearance dialog ----------
function preview(st, dark) {
  const c = (dark && st[3]) || st[2], pv = h("div", { class: "pv", style: { background: c.ruled ? `repeating-linear-gradient(${c.bg} 0 9px,${c.ruled} 9px 10px)` : c.grid ? `linear-gradient(${c.grid} 1px,transparent 1px) 0 0/10px 10px,linear-gradient(90deg,${c.grid} 1px,transparent 1px) 0 0/10px 10px,${c.bg}` : c.bg } });
  const R = (x, y, w, hh, bg, extra = {}) => pv.append(h("i", { style: Object.assign({ left: x + "px", top: y + "px", width: w + "px", height: hh + "px", background: bg, borderRadius: (c.r || 0) + "px" }, extra) }));
  R(0, 0, 200, 9, c.bar); R(8, 17, 40, 26, c.card, { border: `1px solid ${c.line}` }); R(8, 17, 40, 6, c.bar, { borderRadius: `${c.r || 0}px ${c.r || 0}px 0 0`, opacity: .85 });
  R(56, 22, 30, 22, c.note, { border: `1px solid ${c.line}` }); R(86, 30, 8, 2, c.acc); R(93, 22, 2, 18, c.acc); R(95, 22, 8, 2, c.acc); R(95, 38, 8, 2, c.acc);
  return pv;
}
LOOK.dialog = function () {
  const scopeChk = h("input", { type: "checkbox" }); scopeChk.checked = !!boardLook();
  const body = h("div", { style: { display: "grid", gap: "12px", width: "min(640px,calc(100vw - 50px))" } });
  const draw = () => {
    const L = LOOK.resolve(), dark = document.documentElement.dataset.theme === "dark", sc = scopeChk.checked; body.innerHTML = "";
    const grid = h("div", { class: "looks" });
    STYLES.forEach(st => { const b = h("button", { type: "button", class: "lk" + (L.style === st[0] ? " on" : "") }, preview(st, dark && !!st[3]), h("span", { text: st[1] }));
      b.onclick = () => { LOOK.set({ style: st[0] }, sc); draw(); }; grid.append(b); });
    const seg = (key, opts, scoped) => h("div", { class: "seg" }, opts.map(([v, l]) => { const b = h("button", { type: "button", class: "b", "aria-pressed": String(L[key] === v) }, l); b.onclick = () => { LOOK.set({ [key]: v }, scoped && sc); draw(); }; return b; }));
    const sel = (key, table, scoped) => { const s = h("select", { class: "f" }, Object.entries(table).map(([v, d]) => h("option", { value: v, text: d[0] }))); s.value = L[key]; s.onchange = () => { LOOK.set({ [key]: s.value }, scoped && sc); draw(); }; return s; };
    const ts = h("input", { type: "range", min: "0.85", max: "1.5", step: "0.05", value: String(L.ts), style: { width: "180px" } }), tsv = h("span", { class: "mono", text: Math.round(L.ts * 100) + "%" });
    ts.oninput = () => { tsv.textContent = Math.round(ts.value * 100) + "%"; }; ts.onchange = () => LOOK.set({ ts: +ts.value });
    const mo = h("input", { type: "checkbox" }); mo.checked = L.motion; mo.onchange = () => LOOK.set({ motion: mo.checked });
    body.append(grid, h("div", { class: "opts" },
      h("span", { text: "light / dark" }), FIXED_DARK.has(L.style) ? h("span", { text: "always dark", style: { opacity: .7 } }) : seg("theme", [["auto", "auto"], ["light", "light"], ["dark", "dark"]], false),
      h("span", { text: "text size" }), h("div", { class: "seg", style: { alignItems: "center", gap: "8px" } }, ts, tsv),
      h("span", { text: "note font" }), sel("noteFont", NOTE_FONTS, true),
      h("span", { text: "background" }), sel("pat", PATS, true),
      h("span", { text: "map branches" }), h("div", { class: "seg" }, seg("edges", [["elbow", "elbow"], ["curved", "curved"], ["straight", "straight"]], true), h("span", { style: { width: "10px" } }), seg("edgeW", [[.7, "thin"], [1, "normal"], [1.6, "thick"]], true)),
      h("span", { text: "animation" }), h("label", { style: { display: "flex", gap: "6px", alignItems: "center" } }, mo, "on"),
      h("span", { text: "" }), h("label", { style: { display: "flex", gap: "6px", alignItems: "center" } }, scopeChk, "only this board" + (B.doc ? " (" + (B.doc.name || "") + ")" : ""))));
  };
  scopeChk.onchange = () => { if (!scopeChk.checked) LOOK.clearBoard(); else { const g = globalLook(), cur = {}; BOARD_KEYS.forEach(k => cur[k] = g[k]); LOOK.set(cur, true); } draw(); };
  draw();
  dialog({ title: "appearance", body, width: "auto", buttons: [{ label: "reset", value: "reset" }, { label: "OK", value: true, def: true }] })
    .then(v => { if (v === "reset") { ls.set("look", JSON.stringify({ theme: globalLook().theme })); LOOK.clearBoard(); LOOK.apply(); } });
};
LOOK.STYLES = STYLES; LOOK.FIXED_DARK = FIXED_DARK;
