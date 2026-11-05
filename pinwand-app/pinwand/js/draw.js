"use strict";
(() => {
// pinwand · drawing: pen, highlighter, eraser, shapes and text on the board;
// ink and highlights on PDF pages (on the board and in the reader); arrow styles.
// Marks on PDF pages belong to the PDF, not to a board: marks/<asset>.json in the workspace.
const NS = "http://www.w3.org/2000/svg";
const PEN = { k: "var(--ink)", r: "#d83b3b", b: "#2c6bd6", g: "#2f9a48", o: "#e8860f", p: "#9b4dca" };
const HLC = { y: "#ffd23f", g: "#7fe08a", p: "#ff8fcf", b: "#86ccff", o: "#ffae55" };
const NAMES = { k: "black", r: "red", b: "blue", g: "green", o: "orange", p: "purple", y: "yellow" };
const WID = { pen: [1.5, 3, 6], hl: [12, 18, 26], shape: [1.5, 2.5, 4] };
const IC = {
  select: '<path d="M6 3l12 9-5.5 1.2L15 19l-2.5 1.2-2.6-5.8L6 18z"/>',
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  hl: '<path d="M8 14l8-9 4 4-9 8z"/><path d="M8 14l-2 4h4l1-1"/><path d="M3 21h9" stroke-width="3" stroke-opacity=".5"/>',
  eraser: '<path d="M4 15l9-9 7 7-7 7H9z"/><path d="M8.5 10.5l7 7"/><path d="M14 20h7"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6.5"/>',
  line: '<path d="M5 19L19 5"/>',
  arrow: '<path d="M5 19L19 5"/><path d="M11 5h8v8"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  fill: '<rect x="4" y="6" width="16" height="12" rx="1.5" fill="currentColor" fill-opacity=".35"/>',
  dash: '<path d="M3 12h4M10 12h4M17 12h4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  curve: '<path d="M4 18C7 6 17 6 20 18"/>',
  straight: '<path d="M4 18L20 6"/>',
  both: '<path d="M5 12h14"/><path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>',
  end: '<path d="M5 12h14"/><path d="M15 8l4 4-4 4"/>',
  none: '<path d="M5 12h14"/>',
  label: '<rect x="3" y="7" width="18" height="10" rx="1"/><path d="M7 12h10"/>',
  flip: '<path d="M7 8h12l-3-3M17 16H5l3 3"/>',
};
const icon = (n, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ""}</svg>`;
const DR = PW.draw = { tool: "select", icon, PEN, HLC };
let S = {}; try { S = JSON.parse(ls.get("draw", "{}")) || {}; } catch (e) { }
S = Object.assign({ pc: "k", pw: 1, hc: "y", hw: 1, sc: "k", sw: 1, shape: "rect", fill: 0, dash: 0, stylus: 1, ink: "pen" }, S);
const saveS = () => ls.set("draw", JSON.stringify(S));
const r1 = v => Math.round(v * 10) / 10;
const inReader = () => !!(PW.reader && PW.reader.on) && !(document.body.classList.contains("split") && PW.pane === "board");
const PAGE_TOOLS = ["select", "pen", "hl", "eraser"];

// ---------- smooth lines ----------
function pathD(p) {
  const n = (p || []).length >> 1; if (!n) return "";
  if (n === 1) return `M${p[0]},${p[1]}l.01,0`;
  if (n === 2) return `M${p[0]},${p[1]}L${p[2]},${p[3]}`;
  let d = `M${p[0]},${p[1]}`;
  for (let i = 1; i < n - 1; i++) d += `Q${p[2 * i]},${p[2 * i + 1]} ${r1((p[2 * i] + p[2 * i + 2]) / 2)},${r1((p[2 * i + 1] + p[2 * i + 3]) / 2)}`;
  return d + `L${p[2 * n - 2]},${p[2 * n - 1]}`;
}
// a line of varying width (pen pressure): the outline as one filled shape with round ends
function outlineD(p, pr, w) {
  const n = p.length >> 1; if (!n) return ""; const W = i => w * (.3 + .95 * clamp(pr[i] == null ? .5 : pr[i], .05, 1)), f = (x, y) => r1(x) + "," + r1(y);
  if (n === 1) { const r = W(0) / 2; return `M${f(p[0] - r, p[1])}a${r1(r)},${r1(r)} 0 1 0 ${r1(2 * r)},0a${r1(r)},${r1(r)} 0 1 0 ${r1(-2 * r)},0Z`; }
  const L = [], R = [];
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); let tx = p[2 * b] - p[2 * a], ty = p[2 * b + 1] - p[2 * a + 1]; const len = Math.hypot(tx, ty) || 1, r = W(i) / 2; tx /= len; ty /= len;
    L.push([p[2 * i] - ty * r, p[2 * i + 1] + tx * r]); R.push([p[2 * i] + ty * r, p[2 * i + 1] - tx * r]); }
  const side = q => { let d = ""; for (let i = 1; i < q.length - 1; i++) d += `Q${f(q[i][0], q[i][1])} ${f((q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2)}`; return d + `L${f(q[q.length - 1][0], q[q.length - 1][1])}`; };
  const re = W(n - 1) / 2, rs = W(0) / 2, Rr = R.slice().reverse();
  return `M${f(L[0][0], L[0][1])}${side(L)}A${r1(re)},${r1(re)} 0 0 0 ${f(Rr[0][0], Rr[0][1])}${side(Rr)}A${r1(rs)},${r1(rs)} 0 0 0 ${f(L[0][0], L[0][1])}Z`;
}
function simplify(pts, eps) { // Ramer–Douglas–Peucker
  if (pts.length < 3) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const stack = [[0, pts.length - 1]];
  while (stack.length) { const [a, b] = stack.pop(), [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy); let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) { const d = L < 1e-6 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); } }
  return pts.filter((_, i) => keep[i]);
}
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; const t = L ? clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
function nearStroke(p, u, v, R) { const n = p.length >> 1; if (n === 1) return Math.hypot(p[0] - u, p[1] - v) <= R; for (let i = 0; i < n - 1; i++) if (segDist(u, v, p[2 * i], p[2 * i + 1], p[2 * i + 2], p[2 * i + 3]) <= R) return true; return false; }

// ---------- marks on PDF pages ----------
const MK = PW.marks = { cache: new Map(), ver: new Map() };
MK.get = asset => { let p = MK.cache.get(asset); if (!p) { p = (async () => { try { const f = await PW.store.readFile(await PW.store.dir("marks"), asset + ".json"); const j = JSON.parse(await f.text()); if (j && j.pages) return j; } catch (e) { } return { v: 1, pages: {} }; })(); MK.cache.set(asset, p); } return p; };
const saving = new Map();
const day = () => stamp().slice(0, 8);
async function marksDir() { return PW.store.dir("marks"); }
MK.all = async () => { const out = {}, d = await marksDir(); for await (const [n, hd] of d.entries()) if (hd.kind === "file" && n.endsWith(".json")) { try { out[n.slice(0, -5)] = JSON.parse(await (await hd.getFile()).text()); } catch (e) { } } return out; };
let snapDay = "";
MK.snapshot = async (name) => { // backups/marks-<day>.json: every mark of every PDF; the last 14 are kept
  const bd = await PW.store.dir("backups"), file = name || "marks-" + day() + ".json";
  if (!name) { if (snapDay === day()) return; snapDay = day(); try { await bd.getFileHandle(file); return; } catch (e) { } }
  const all_ = await MK.all(); if (!Object.keys(all_).length && !name) return; await PW.store.writeFile(bd, file, JSON.stringify({ format: "pinwand-marks", saved: Date.now(), marks: all_ }));
  const list = []; for await (const [n] of bd.entries()) if (/^marks-\d{8}\.json$/.test(n)) list.push(n); list.sort(); while (list.length > 14) await bd.removeEntry(list.shift()).catch(() => { });
};
MK.save = asset => { clearTimeout(saving.get(asset)); saving.set(asset, setTimeout(async () => { saving.delete(asset); try { await MK.snapshot().catch(() => { }); const m = await MK.get(asset); await PW.store.writeFile(await PW.store.dir("marks"), asset + ".json", JSON.stringify(m)); } catch (e) { status("could not save the marks"); } }, 400)); };
MK.reset = () => { MK.cache.clear(); MK.ver.clear(); };
MK.flush = () => { for (const [asset, t] of [...saving]) { clearTimeout(t); saving.delete(asset); MK.get(asset).then(async m => PW.store.writeFile(await PW.store.dir("marks"), asset + ".json", JSON.stringify(m))).catch(() => { }); } };
addEventListener("visibilitychange", () => { if (document.hidden) MK.flush(); }); addEventListener("pagehide", () => MK.flush());
MK.count = async asset => { const m = await MK.get(asset); let n = 0; for (const pd of Object.values(m.pages)) n += (pd.ink || []).length + (pd.hl || []).length; return n; };
MK.list = async asset => { const m = await MK.get(asset), out = []; for (const [pg, pd] of Object.entries(m.pages)) { (pd.hl || []).forEach(x => out.push({ page: +pg, c: x.c, t: x.t || "", kind: "hl" }));
  const by = new Map(); (pd.ink || []).forEach(x => { const k = (x.hl ? "h" : "p") + x.c; if (!by.has(k)) by.set(k, { page: +pg, c: x.c, hl: !!x.hl, kind: "ink", n: 0 }); by.get(k).n++; }); out.push(...by.values()); } return out.sort((a, b) => a.page - b.page); };
MK.put = async (asset, data) => { if (!data || !data.pages) return; MK.cache.set(asset, Promise.resolve(data)); MK.save(asset); };
function hostInfo(host) {
  if (host.classList.contains("rsheet")) return { asset: PW.reader.asset, page: +host.parentElement.dataset.p };
  const oe = host.closest(".obj.pdf"); return { asset: oe && oe._asset, page: +host.dataset.p };
}
function pageSVG(pd) {
  if (!pd) return ""; let s = "";
  (pd.hl || []).forEach((x, i) => { s += `<g class="mh" data-i="${i}" fill="${HLC[x.c] || HLC.y}">` + x.r.map(q => `<rect x="${q[0]}" y="${q[1]}" width="${q[2]}" height="${q[3]}" rx="2"/>`).join("") + "</g>"; });
  (pd.ink || []).forEach(x => { const col = x.hl ? HLC[x.c] || HLC.y : x.c === "k" ? "var(--pk)" : PEN[x.c] || PEN.r;
    s += x.pr ? `<path class="mi pf" d="${outlineD(x.p, x.pr, x.w)}" style="fill:${col}"/>` : `<path class="mi${x.hl ? " hl" : ""}" d="${pathD(x.p)}" style="stroke:${col};stroke-width:${x.w}"/>`; });
  return s;
}
function paintHost(host, pd) {
  let s = host.querySelector(":scope > svg.pmk"); if (!s && !pd) return;
  if (!s) { s = document.createElementNS(NS, "svg"); s.setAttribute("class", "pmk"); s.setAttribute("viewBox", "0 0 1000 1"); s.setAttribute("preserveAspectRatio", "xMinYMin meet"); host.append(s); }
  s.innerHTML = pageSVG(pd);
}
function hostsOf(asset, page) {
  const out = [], q = page ? `[data-p="${page}"]` : "";
  for (const e of document.querySelectorAll("#world .obj.pdf")) if (e._asset === asset) e.querySelectorAll(".pg" + q).forEach(p => out.push(p));
  if (PW.reader && PW.reader.asset === asset) document.querySelectorAll(`#reader .rt${q} > .rsheet`).forEach(p => out.push(p));
  return out;
}
async function paintAsset(asset, page) { const m = await MK.get(asset), v = MK.ver.get(asset) || 0; for (const host of hostsOf(asset, page)) { paintHost(host, m.pages[hostInfo(host).page]); host._mkv = v; } }
MK.paintObj = async (asset, e) => { if (!asset) return; const m = await MK.get(asset), v = MK.ver.get(asset) || 0; e.querySelectorAll(".pg").forEach(p => { if (p._mkv === v) return; p._mkv = v; paintHost(p, m.pages[p.dataset.p]); }); };
MK.paintReader = () => { const a = PW.reader && PW.reader.asset; if (a) paintAsset(a); };
function changed(asset, page) { MK.ver.set(asset, (MK.ver.get(asset) || 0) + 1); paintAsset(asset, page); MK.save(asset); if (PW.reader.asset === asset && PW.reader.drawMarks) PW.reader.drawMarks(); }

// one history for the board and the marks: Ctrl+Z takes back whatever came last
const LOG = [], REDO = [];
const newSess = () => ({ items: new Map(), q: Promise.resolve(), board: false });
async function mutate(asset, page, fn, sess) {
  const m = await MK.get(asset), had = m.pages[page], before = had ? JSON.stringify(had) : null, pd = had ? JSON.parse(before) : { ink: [], hl: [] };
  pd.ink = pd.ink || []; pd.hl = pd.hl || []; fn(pd);
  const empty = !pd.ink.length && !pd.hl.length, after = empty ? null : JSON.stringify(pd); if (before === after) return;
  if (empty) delete m.pages[page]; else m.pages[page] = pd; changed(asset, page);
  const key = asset + "#" + page, old = sess.items.get(key); if (old) old.after = after; else sess.items.set(key, { asset, page, before, after });
}
function endSess(sess) { return sess.q.then(() => { if (sess.items.size) { LOG.push({ k: "m", items: [...sess.items.values()] }); if (LOG.length > 400) LOG.shift(); REDO.length = 0; } if (sess.board) B.commit(); }); }
function edit1(asset, page, fn) { const s = newSess(); s.q = s.q.then(() => mutate(asset, page, fn, s)); return endSess(s); }
async function applyM(entry, which) { for (const it of entry.items) { const m = await MK.get(it.asset), v = it[which]; if (v == null) delete m.pages[it.page]; else m.pages[it.page] = JSON.parse(v); changed(it.asset, it.page); } }
const c0 = B.commit; B.commit = function (why) { const last = B.hist[B.hist.length - 1]; c0.call(B, why); if (B.doc && B.hist[B.hist.length - 1] !== last) { LOG.push({ k: "b" }); if (LOG.length > 400) LOG.shift(); REDO.length = 0; } };
const u0 = B.undo, rd0 = B.redoIt, l0 = B.load;
B.undo = function () { const top = LOG[LOG.length - 1]; if (top && top.k === "m") { LOG.pop(); REDO.push(top); applyM(top, "before"); status("undo"); return; } if (top) LOG.pop(); const n = B.redo.length; u0(); if (B.redo.length > n) REDO.push({ k: "b" }); };
B.redoIt = function () { const top = REDO[REDO.length - 1]; if (top && top.k === "m") { REDO.pop(); LOG.push(top); applyM(top, "after"); status("redo"); return; } if (top) REDO.pop(); const n = B.redo.length; rd0(); if (B.redo.length < n) LOG.push({ k: "b" }); };
B.load = function () { l0.apply(B, arguments); for (const L of [LOG, REDO]) for (let i = L.length - 1; i >= 0; i--) if (L[i].k === "b") L.splice(i, 1); };
const uc = PW.cmds.get("undo"), rc = PW.cmds.get("redo");
if (uc) uc.enabled = () => B.hist.length > 1 || (LOG.length > 0 && LOG[LOG.length - 1].k === "m");
if (rc) rc.enabled = () => B.redo.length > 0 || (REDO.length > 0 && REDO[REDO.length - 1].k === "m");

// highlight the selected text of a PDF page
function mergeRects(rs) {
  rs.sort((a, b) => a[1] - b[1] || a[0] - b[0]); const out = [];
  for (const r of rs) { const l = out[out.length - 1]; if (l && Math.abs(l[1] - r[1]) < Math.min(l[3], r[3]) * .5 && r[0] <= l[0] + l[2] + r[3] * .8) { const x0 = Math.min(l[0], r[0]), x1 = Math.max(l[0] + l[2], r[0] + r[2]), y0 = Math.min(l[1], r[1]), y1 = Math.max(l[1] + l[3], r[1] + r[3]); l[0] = x0; l[1] = y0; l[2] = x1 - x0; l[3] = y1 - y0; } else out.push(r.slice()); }
  return out;
}
MK.fromSelection = async function (c) {
  const s = getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return false;
  const rects = [...s.getRangeAt(0).getClientRects()].filter(r => r.width > 1 && r.height > 3), text = s.toString().replace(/\s+/g, " ").trim();
  const hosts = [...document.querySelectorAll("#reader .rt > .rsheet, #world .obj.pdf .pg")].filter(x => s.containsNode(x, true)), by = new Map();
  for (const r of rects) { const cx = r.left + r.width / 2, cy = r.top + r.height / 2, host = hosts.find(x => { const b = x.getBoundingClientRect(); return cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom; }); if (!host) continue; if (!by.has(host)) by.set(host, []); by.get(host).push(r); }
  if (!by.size) return false; const sess = newSess();
  for (const [host, rs] of by) { const hr = host.getBoundingClientRect(), k = 1000 / hr.width, info = hostInfo(host); if (!info.asset) continue;
    const R = mergeRects(rs.map(r => [(r.left - hr.left) * k, (r.top - hr.top) * k - r.height * k * .08, r.width * k, r.height * k * 1.16])).map(q => q.map(r1));
    sess.q = sess.q.then(() => mutate(info.asset, info.page, pd => pd.hl.push({ c: c || "y", r: R, t: text.slice(0, 400) }), sess)); }
  await endSess(sess); return true;
};
MK.clearPage = (asset, page) => edit1(asset, page, pd => { pd.ink = []; pd.hl = []; });

// ---------- tools ----------
DR.set = function (tool, kind, toggle = true) {
  if (kind) { if (toggle && DR.tool === "shape" && S.shape === kind) tool = "select"; S.shape = kind; saveS(); }
  else if (toggle && tool !== "select" && DR.tool === tool) tool = "select";
  if (inReader() && !PAGE_TOOLS.includes(tool)) { toast("shapes and text go on the board"); tool = "select"; }
  if (tool !== "select" && !inReader() && !B.doc) { toast("open a board first"); tool = "select"; }
  DR.tool = tool; const b = document.body; if (tool === "pen" || tool === "hl") { S.ink = tool; saveS(); }
  b.classList.remove("t-pen", "t-hl", "t-eraser", "t-shape", "t-text"); b.classList.toggle("drawing", tool !== "select"); if (tool !== "select") b.classList.add("t-" + tool);
  if (tool !== "select") { if (B.editing) B.endEdit(); if (PW.linkMode) { PW.linkMode = null; b.classList.remove("linking"); } }
  drawBar(); PW.tools && PW.tools.upd(); document.querySelectorAll('#toolbar [data-cmd="draw-pen"]').forEach(x => x.setAttribute("aria-pressed", String(tool !== "select")));
  document.querySelectorAll("#reader [data-t]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.t === tool)));
};
DR.cycleShape = () => { const K = ["rect", "ellipse", "line", "arrow"]; DR.set("shape", DR.tool === "shape" ? K[(K.indexOf(S.shape) + 1) % 4] : S.shape, false); };
DR.key = function (e) { // letters that work on the board and in the reader
  const k = e.key; if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (k === "b" && !e.shiftKey) { DR.set("pen"); return true; } if (k === "B") { DR.set("hl"); return true; } if (k === "e" && !e.shiftKey) { DR.set("eraser"); return true; }
  if (k === "Escape" && DR.tool !== "select") { DR.set("select"); return true; }
  return false;
};
const bar = h("div", { id: "penbar", class: "bevel", hidden: true, role: "toolbar", "aria-label": "drawing" }); document.body.append(bar);
const tbtn = (ic, tip, on, fn) => { const b = h("button", { type: "button", class: "cb", title: tip, html: icon(ic), "aria-pressed": String(!!on) }); b.onclick = e => { e.stopPropagation(); fn(); }; return b; };
const sep = () => h("span", { class: "dsep" });
function drawBar() {
  bar.innerHTML = ""; if (DR.tool === "select") { bar.hidden = true; return; }
  const T = DR.tool, R = inReader();
  bar.append(tbtn("select", "select and move (Esc)", false, () => DR.set("select")), tbtn("pen", "pen (B)", T === "pen", () => DR.set("pen", null, false)), tbtn("hl", "highlighter (Shift+B)", T === "hl", () => DR.set("hl", null, false)), tbtn("eraser", "eraser (E): wipe over lines, shapes and marks", T === "eraser", () => DR.set("eraser", null, false)));
  if (!R) { bar.append(sep()); ["rect", "ellipse", "line", "arrow"].forEach(k => bar.append(tbtn(k, { rect: "rectangle", ellipse: "ellipse", line: "line", arrow: "arrow" }[k] + " (S)", T === "shape" && S.shape === k, () => DR.set("shape", k, false)))); bar.append(tbtn("text", "text (X)", T === "text", () => DR.set("text", null, false))); }
  const pal = T === "hl" ? HLC : (T === "pen" || T === "shape") ? PEN : null;
  if (pal) {
    const key = T === "hl" ? "hc" : T === "pen" ? "pc" : "sc", wk = T === "hl" ? "hw" : T === "pen" ? "pw" : "sw", ws = WID[T === "hl" ? "hl" : T === "pen" ? "pen" : "shape"];
    bar.append(sep()); Object.keys(pal).forEach(c => { const b = h("button", { type: "button", class: "cb pcol", title: NAMES[c], "aria-pressed": String(S[key] === c) }, h("i", { style: { background: pal[c] } })); b.onclick = e => { e.stopPropagation(); S[key] = c; saveS(); drawBar(); }; bar.append(b); });
    bar.append(sep()); ws.forEach((w, i) => { const b = h("button", { type: "button", class: "cb pwd", title: ["thin", "medium", "thick"][i], "aria-pressed": String(S[wk] === i) }, h("i", { style: { width: 4 + i * 4 + "px", height: 4 + i * 4 + "px" } })); b.onclick = e => { e.stopPropagation(); S[wk] = i; saveS(); drawBar(); }; bar.append(b); });
    if (T === "shape") bar.append(sep(), tbtn("fill", "filled", S.fill, () => { S.fill = S.fill ? 0 : 1; saveS(); drawBar(); }), tbtn("dash", "dashed", S.dash, () => { S.dash = S.dash ? 0 : 1; saveS(); drawBar(); }));
  }
  bar.append(sep(), tbtn("close", "done (Esc)", false, () => DR.set("select")));
  bar.hidden = false; placeBar();
}
function placeBar() {
  if (bar.hidden) return; const R = inReader(), ref = R ? document.querySelector("#reader .rtb") : $("viewport"); if (!ref) return;
  const r = ref.getBoundingClientRect(), area = R ? document.querySelector("#reader .rpages").getBoundingClientRect() : r;
  bar.style.top = (R ? r.bottom + 6 : r.top + 8) + "px"; bar.style.left = Math.max(4, Math.min(innerWidth - bar.offsetWidth - 4, area.left + area.width / 2 - bar.offsetWidth / 2)) + "px";
}
addEventListener("resize", placeBar);
DR.place = placeBar;
DR.paneChanged = () => { if (DR.tool === "select") return; if (inReader() && !PAGE_TOOLS.includes(DR.tool)) DR.set("select"); else drawBar(); };
// switching between board and reader keeps only tools that make sense there
const rs0 = PW.reader.show, rh0 = PW.reader.hide;
PW.reader.show = function () { rs0.apply(this, arguments); if (!PAGE_TOOLS.includes(DR.tool)) DR.set("select"); else drawBar(); };
PW.reader.hide = function () { rh0.apply(this, arguments); drawBar(); };
const rr0 = PW.reader.reset; PW.reader.reset = function () { rr0.apply(this, arguments); MK.reset(); };

// ---------- pointer: drawing on the board and on pages ----------
const vp = $("viewport"), fx = document.createElementNS(NS, "svg"); fx.setAttribute("id", "inkfx"); document.body.append(fx);
let cur = null;
const nightPage = host => document.body.classList.contains(host.classList.contains("rsheet") ? "rnight" : "invertpdf");
const pageHost = t => t && t.closest ? t.closest("#world .obj.pdf .pg, #reader .rt > .rsheet") : null;
function capture(e) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { } }
function down(e, readerArea) {
  const t = e.target, pen = e.pointerType === "pen";
  if (t.id === "lbled") { e.stopPropagation(); return; }
  if (e.pointerType === "touch" && cur && cur.pen) { e.preventDefault(); e.stopPropagation(); return; } // the hand resting on the screen while writing
  if (e.button !== 0 && !(pen && e.button === 5)) return;
  const handle = t.classList && (t.classList.contains("ep") || t.classList.contains("rz") || t.classList.contains("ew"));
  if (handle && t.classList.contains("ep") && DR.tool === "select") { startEp(e, t); return; }
  let T = DR.tool;
  if (pen && e.button === 5) T = "eraser"; // the eraser end of the pen
  else if (pen && T === "select" && S.stylus && !handle && !(B.editing && B.editing.t.contains(t))) T = S.ink === "hl" ? "hl" : "pen"; // a stylus writes, finger and mouse select
  if (T === "select" || PW.keys.space) return;
  if (t.closest("button,input,select,textarea,a,.rsel,#selbar,.ctxpop,.wt")) return;
  e.preventDefault(); e.stopPropagation(); if (typeof hideMenus === "function") hideMenus(); if (T === "pen" || T === "hl" || T === "eraser") DR.lastDraw = performance.now();
  if (B.editing) B.endEdit();
  const host = pageHost(t);
  if (T === "pen" || T === "hl") { if (!host && (readerArea || !B.doc)) return; beginInk(e, T === "hl", host); return; }
  if (T === "eraser") { cur = { mode: "erase", sess: newSess(), lx: e.clientX, ly: e.clientY, id: e.pointerId }; eraseAt(e.clientX, e.clientY, cur.sess); capture(e); return; }
  if (readerArea || !B.doc) return;
  if (T === "text") { const p = B.toWorld(e.clientX, e.clientY); B.add({ type: "note", x: Math.round(p.x), y: Math.round(p.y - 14), w: 240, text: "", color: "none" }, { edit: "text" }); DR.set("select"); return; }
  if (T === "shape") beginShape(e);
}
vp.addEventListener("pointerdown", e => down(e, false), true);
document.querySelector("#reader .rpages").addEventListener("pointerdown", e => down(e, true), true);
addEventListener("pointermove", e => {
  if (!cur || e.pointerId !== cur.id) return;
  if (cur.mode === "ink") { const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || []; for (const q of evs.length ? evs : [e]) { const l = cur.pts[cur.pts.length - 1]; if (Math.hypot(q.clientX - l[0], q.clientY - l[1]) < .8) continue; cur.pts.push([q.clientX, q.clientY, q.pressure]); cur.d += `L${q.clientX},${q.clientY}`; } cur.path.setAttribute("d", cur.d); return; }
  if (cur.mode === "erase") { const dx = e.clientX - cur.lx, dy = e.clientY - cur.ly, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 5)); for (let i = 1; i <= n; i++) eraseAt(cur.lx + dx * i / n, cur.ly + dy * i / n, cur.sess); cur.lx = e.clientX; cur.ly = e.clientY; return; }
  if (cur.mode === "shape") moveShape(e); else if (cur.mode === "ep") moveEp(e);
});
addEventListener("pointerup", e => { if (cur && e.pointerId === cur.id) finish(false); });
addEventListener("pointercancel", e => { if (cur && e.pointerId === cur.id) finish(true); });
function finish(cancel) {
  const c = cur; cur = null;
  if (c.mode === "ink") { c.path.remove(); if (!cancel) endInk(c); }
  else if (c.mode === "erase") { if (!c.sess.items.size && !c.sess.board && !c.sess.q) return; endSess(c.sess); }
  else if (c.mode === "shape") endShape(c, cancel);
  else if (c.mode === "ep") { document.body.classList.remove("sizing"); if (!cancel && connect(c.o)) return; snapMark([]); B.renderEdges(); B.commit(); PW.ctxSoon && PW.ctxSoon(); }
}

// pen and highlighter
function beginInk(e, hl, host) {
  const w = WID[hl ? "hl" : "pen"][hl ? S.hw : S.pw], c = hl ? S.hc : S.pc, path = document.createElementNS(NS, "path");
  path.setAttribute("class", "fx" + (hl ? " hl" : "")); path.style.stroke = hl ? HLC[c] : c === "k" ? (host ? (nightPage(host) ? "#eee" : "#1b1b1b") : "var(--ink)") : PEN[c];
  path.style.strokeWidth = Math.max(.8, host ? w : w * B.view.z); fx.append(path);
  const im = !host && e.target.closest(".obj.image");
  cur = { mode: "ink", hl, w, c, host, on: im ? im.dataset.id : null, pts: [[e.clientX, e.clientY, e.pressure]], d: `M${e.clientX},${e.clientY}`, path, id: e.pointerId, pen: e.pointerType === "pen" };
  path.setAttribute("d", cur.d + "l.01,0"); capture(e);
}
function endInk(c) {
  const pts = simplify(c.pts, .6), pr = c.pen && !c.hl && pts.some(q => q[2] > 0 && Math.abs(q[2] - .5) > .01) ? pts.map(q => Math.round(clamp(q[2] || .5, .05, 1) * 100) / 100) : null;
  if (c.host) { // on a PDF page: page units are a thousandth of the page width, the line keeps its width on screen
    const host = c.host; if (!host.isConnected) return; const r = host.getBoundingClientRect(), k = 1000 / r.width, flat = [], info = hostInfo(host); if (!info.asset) return;
    pts.forEach(([x, y]) => flat.push(r1((x - r.left) * k), r1((y - r.top) * k)));
    const st = { p: flat, c: c.c, w: r1(c.w * k) }; if (c.hl) st.hl = 1; if (pr) st.pr = pr; edit1(info.asset, info.page, pd => pd.ink.push(st)); return;
  }
  if (!B.doc) return;
  const wp = pts.map(([x, y]) => { const p = B.toWorld(x, y); return [p.x, p.y]; });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; wp.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  const pad = c.w / 2 + 3; let X = x0 - pad, Y = y0 - pad, W = x1 - x0 + 2 * pad, H = y1 - y0 + 2 * pad;
  if (W < 24) { X -= (24 - W) / 2; W = 24; } if (H < 24) { Y -= (24 - H) / 2; H = 24; }
  X = Math.floor(X); Y = Math.floor(Y); W = Math.ceil(W) + 1; H = Math.ceil(H) + 1;
  const flat = []; wp.forEach(([x, y]) => flat.push(r1(x - X), r1(y - Y)));
  const o = { type: "ink", x: X, y: Y, w: W, h: H, vw: W, vh: H, pts: flat, c: c.c, sw: c.w }; if (c.hl) o.hl = 1; if (pr) o.pr = pr; if (c.on && obj(c.on)) o.on = c.on;
  B.add(o, { select: false });
}
// eraser: whole lines, shapes and marks under the pointer
function eraseAt(x, y, sess) {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.classList && (el.classList.contains("ihit") || el.classList.contains("shhit") || (el.classList.contains("sh") && el.closest(".filled")))) { const oe = el.closest(".obj"); if (oe && obj(oe.dataset.id)) { B.remove([oe.dataset.id], { commit: false }); sess.board = true; } continue; }
    if (el.matches && el.matches("#world .obj.pdf .pg, #reader .rt > .rsheet")) { erasePage(el, x, y, sess); break; }
  }
}
function erasePage(host, x, y, sess) {
  const r = host.getBoundingClientRect(), k = 1000 / r.width, u = (x - r.left) * k, v = (y - r.top) * k, R = 8 * k, info = hostInfo(host); if (!info.asset) return;
  sess.q = sess.q.then(() => mutate(info.asset, info.page, pd => { pd.ink = pd.ink.filter(s => !nearStroke(s.p, u, v, R + s.w / 2)); pd.hl = pd.hl.filter(m => !m.r.some(q => u >= q[0] - R * .3 && u <= q[0] + q[2] + R * .3 && v >= q[1] - R * .3 && v <= q[1] + q[3] + R * .3)); }, sess));
}

// ---------- shapes ----------
function setLine(o, ax, ay, bx, by) { const P = 12, x = Math.floor(Math.min(ax, bx) - P), y = Math.floor(Math.min(ay, by) - P); o.x = x; o.y = y; o.w = Math.ceil(Math.abs(bx - ax) + 2 * P); o.h = Math.ceil(Math.abs(by - ay) + 2 * P); o.p = [r1(ax - x), r1(ay - y), r1(bx - x), r1(by - y)]; }
const isLine = o => o.kind === "line" || o.kind === "arrow";
function beginShape(e) {
  const p = B.toWorld(e.clientX, e.clientY), o = { type: "shape", kind: S.shape, x: Math.round(p.x), y: Math.round(p.y), w: 24, h: 24, c: S.sc, sw: WID.shape[S.sw], text: "" };
  if (S.fill && !isLine(o)) o.fill = 1; if (S.dash) o.dash = 1; if (isLine(o)) setLine(o, p.x, p.y, p.x, p.y);
  B.add(o, { select: false, commit: false }); cur = { mode: "shape", o, a: p, moved: false, id: e.pointerId }; capture(e);
}
function snap(dx, dy) { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12), L = Math.hypot(dx, dy); return [L * Math.cos(a), L * Math.sin(a)]; }
// a line or arrow drawn from one item to another becomes a connection that follows both
function itemAt(x, y, skip) { const L = all(); for (let i = L.length - 1; i >= 0; i--) { const o = L[i]; if (o === skip || o.type === "ink" || o.type === "shape" || isArea(o) || (PW.map && PW.map.isHidden(o))) continue; const b = B.box(o); if (x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4) return o; } return null; }
function snapMark(ids) { document.querySelectorAll("#world .obj.snap").forEach(x => { if (!ids.includes(x.dataset.id)) x.classList.remove("snap"); }); ids.forEach(id => { const e = B.el(id); e && e.classList.add("snap"); }); }
function ends(o) { return [o.x + o.p[0], o.y + o.p[1], o.x + o.p[2], o.y + o.p[3]]; }
function connect(o) { // both ends on items: replace the drawn line by an arrow between them
  const [x1, y1, x2, y2] = ends(o), a = itemAt(x1, y1, o), b = itemAt(x2, y2, o); snapMark([]); if (!a || !b || a === b) return false;
  const n = B.doc.links.length; B.remove([o.id], { commit: false });
  const ex = {}; if (o.c && o.c !== "k") ex.c = o.c; if (o.dash) ex.dash = 1; if (o.sw >= 4) ex.w = 2; if (o.kind === "line") ex.head = "none";
  B.addLink(a.id, b.id, ex); if (B.doc.links.length === n) { B.commit(); toast("these two are already connected"); return true; }
  B.sel.clear(); B.selLink = B.doc.links[B.doc.links.length - 1].id; B.renderEdges(); B.updSel(); toast("connected: the arrow now follows both"); return true;
}
function moveShape(e) {
  const c = cur, o = c.o, p = B.toWorld(e.clientX, e.clientY); let dx = p.x - c.a.x, dy = p.y - c.a.y;
  if (!c.moved && Math.hypot(dx, dy) * B.view.z < 4) return; c.moved = true;
  if (isLine(o)) { if (e.shiftKey) [dx, dy] = snap(dx, dy); setLine(o, c.a.x, c.a.y, c.a.x + dx, c.a.y + dy); const a = itemAt(c.a.x, c.a.y, o), b = itemAt(c.a.x + dx, c.a.y + dy, o); snapMark(a && b && a !== b ? [a.id, b.id] : []); }
  else { if (e.shiftKey) { const m = Math.max(Math.abs(dx), Math.abs(dy)); dx = (dx < 0 ? -1 : 1) * m; dy = (dy < 0 ? -1 : 1) * m; } o.x = Math.round(Math.min(c.a.x, c.a.x + dx)); o.y = Math.round(Math.min(c.a.y, c.a.y + dy)); o.w = Math.max(4, Math.round(Math.abs(dx))); o.h = Math.max(4, Math.round(Math.abs(dy))); }
  B.render(o);
}
function endShape(c, cancel) {
  const o = c.o; if (cancel) { B.remove([o.id], { commit: false }); return; }
  if (!c.moved) { if (isLine(o)) setLine(o, c.a.x - 80, c.a.y, c.a.x + 80, c.a.y); else { o.w = o.kind === "ellipse" ? 150 : 160; o.h = 100; o.x = Math.round(c.a.x - o.w / 2); o.y = Math.round(c.a.y - o.h / 2); } }
  else if (!isLine(o)) { o.w = Math.max(24, o.w); o.h = Math.max(24, o.h); }
  if (isLine(o) && c.moved && connect(o)) { DR.set("select"); return; }
  snapMark([]); B.render(o); B.select([o.id]); B.commit(); DR.set("select");
}
// dragging an end of a line
function startEp(e, t) {
  const oe = t.closest(".obj"), o = oe && obj(oe.dataset.id); if (!o || !o.p) return;
  e.preventDefault(); e.stopPropagation(); const i = +t.dataset.e;
  cur = { mode: "ep", o, i, f: i ? [o.x + o.p[0], o.y + o.p[1]] : [o.x + o.p[2], o.y + o.p[3]], id: e.pointerId }; document.body.classList.add("sizing"); capture(e);
}
function moveEp(e) {
  const c = cur, o = c.o, p = B.toWorld(e.clientX, e.clientY); let dx = p.x - c.f[0], dy = p.y - c.f[1]; if (e.shiftKey) [dx, dy] = snap(dx, dy);
  const q = [c.f[0] + dx, c.f[1] + dy]; if (c.i) setLine(o, c.f[0], c.f[1], q[0], q[1]); else setLine(o, q[0], q[1], c.f[0], c.f[1]); B.render(o);
  const [x1, y1, x2, y2] = ends(o), a = itemAt(x1, y1, o), b = itemAt(x2, y2, o); snapMark(a && b && a !== b ? [a.id, b.id] : []);
}
B.types.shape = {
  fixedH: true, editField: "text", minW: 24,
  create() { const e = h("div", { class: "shape" }); e.innerHTML = `<svg class="shs" xmlns="${NS}"></svg>`; e.append(h("div", { class: "txt", "data-f": "text", "data-ph": "" }), h("div", { class: "rz" }), h("div", { class: "ep", "data-e": "0" }), h("div", { class: "ep", "data-e": "1" })); return e; },
  update(o, e) {
    const k = o.kind || "rect", line = isLine(o), w = o.w, hh = o.h || 100, sw = +o.sw || 2, sv = e.querySelector(".shs");
    e.classList.toggle("ln", line); e.classList.toggle("filled", !!o.fill && !line); e.style.color = PEN[o.c] || PEN.k; e.style.setProperty("--sw", sw + "px");
    const dash = o.dash ? ` stroke-dasharray="${r1(sw * 3.2)} ${r1(sw * 2.6)}"` : ""; let g = "";
    if (k === "ellipse") { const a = `cx="${w / 2}" cy="${hh / 2}" rx="${Math.max(1, w / 2 - sw / 2)}" ry="${Math.max(1, hh / 2 - sw / 2)}"`; g = `<ellipse class="sh" ${a}${dash}/><ellipse class="shhit" ${a}/>`; }
    else if (!line) { const a = `x="${sw / 2}" y="${sw / 2}" width="${Math.max(1, w - sw)}" height="${Math.max(1, hh - sw)}" rx="${r1(Math.min(8, w / 6, hh / 6))}"`; g = `<rect class="sh" ${a}${dash}/><rect class="shhit" ${a}/>`; }
    else { const [x1, y1, x2, y2] = o.p || [0, 0, w, hh]; let ex = x2, ey = y2, head = "";
      if (k === "arrow") { const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, s = 6 + sw * 2.6, bx = x2 - ux * s, by = y2 - uy * s; ex = x2 - ux * s * .6; ey = y2 - uy * s * .6;
        head = `<path class="hd" d="M${x2},${y2}L${r1(bx - uy * s * .55)},${r1(by + ux * s * .55)}L${r1(bx + uy * s * .55)},${r1(by - ux * s * .55)}Z"/>`; }
      g = `<path class="sh" d="M${x1},${y1}L${r1(ex)},${r1(ey)}"${dash}/>${head}<path class="shhit" d="M${x1},${y1}L${x2},${y2}"/>`;
      const [a, b] = e.querySelectorAll(".ep"); a.style.left = x1 + "px"; a.style.top = y1 + "px"; b.style.left = x2 + "px"; b.style.top = y2 + "px"; }
    if (sv._g !== g) { sv._g = g; sv.innerHTML = g; }
    const t = e.querySelector(".txt"); t.hidden = line; if (!line && !(B.editing && B.editing.t === t)) setRich(t, o.text || "");
  },
  text: o => o.text || "",
};
B.types.ink = {
  fixedH: true, minW: 24,
  create() { const e = h("div", { class: "ink" }); e.innerHTML = `<svg xmlns="${NS}" preserveAspectRatio="none"><path class="ihit"/><path class="iln"/></svg>`; e.append(h("div", { class: "rz" })); return e; },
  update(o, e) {
    const sv = e.firstChild, d = pathD(o.pts), vb = `0 0 ${o.vw || o.w} ${o.vh || o.h}`, sw = +o.sw || 3, ln = sv.lastChild, col = o.hl ? HLC[o.c] || HLC.y : PEN[o.c] || PEN.k;
    if (e._d !== d) { e._d = d; sv.firstChild.setAttribute("d", d); ln.setAttribute("d", o.pr ? outlineD(o.pts, o.pr, sw) : d); } if (e._vb !== vb) { e._vb = vb; sv.setAttribute("viewBox", vb); }
    if (o.pr) { ln.style.fill = col; ln.style.stroke = "none"; } else { ln.style.fill = "none"; ln.style.stroke = col; ln.style.strokeWidth = sw; } sv.firstChild.style.strokeWidth = sw + 10; e.classList.toggle("hl", !!o.hl);
  },
  text: () => "",
};
// PDF pages on the board show their marks
const P0 = B.types.pdf.update; B.types.pdf.update = function (o, e) { P0.call(this, o, e); if (e._ready) MK.paintObj(o.asset, e); };

// ---------- the bar next to a selected drawing or arrow ----------
DR.ctxItems = function (sel, ctx, btn, soon) {
  const ds = sel.filter(o => o.type === "ink" || o.type === "shape"); if (!ds.length) return;
  const hlOnly = ds.every(o => o.type === "ink" && o.hl), pal = hlOnly ? HLC : PEN, cc = ds[0].c || (hlOnly ? "y" : "k");
  Object.keys(pal).forEach(c => ctx.append(btn(`<i class="pdot" style="background:${pal[c]}"></i>`, NAMES[c], () => { ds.forEach(o => { if (!(o.type === "ink" && o.hl) || hlOnly) o.c = c; B.render(o); }); B.commit(); soon(); }, cc === c)));
  const shapes = ds.filter(o => o.type === "shape");
  if (shapes.length) {
    ctx.append(h("span", { class: "dsep" }));
    WID.shape.forEach((w, i) => ctx.append(btn(`<i class="pdot" style="width:${4 + i * 4}px;height:${4 + i * 4}px;background:currentColor"></i>`, ["thin", "medium", "thick"][i], () => { shapes.forEach(o => { o.sw = w; B.render(o); }); B.commit(); soon(); }, shapes[0].sw === w)));
    const boxes = shapes.filter(o => !isLine(o)); if (boxes.length) ctx.append(btn(icon("fill"), "filled", () => { const v = !boxes[0].fill; boxes.forEach(o => { if (v) o.fill = 1; else delete o.fill; B.render(o); }); B.commit(); soon(); }, !!boxes[0].fill));
    ctx.append(btn(icon("dash"), "dashed", () => { const v = !shapes[0].dash; shapes.forEach(o => { if (v) o.dash = 1; else delete o.dash; B.render(o); }); B.commit(); soon(); }, !!shapes[0].dash));
    const lines = shapes.filter(isLine); if (lines.length) ctx.append(btn(icon("arrow"), "arrow head", () => { const v = lines[0].kind === "arrow" ? "line" : "arrow"; lines.forEach(o => { o.kind = v; B.render(o); }); B.commit(); soon(); }, lines[0].kind === "arrow"),
      btn(icon("flip"), "turn around", () => { lines.forEach(o => { const p = o.p; o.p = [p[2], p[3], p[0], p[1]]; B.render(o); }); B.commit(); }));
  }
  ctx.append(h("span", { class: "dsep" }));
};
DR.linkCtx = function (ctx, l, btn, soon) {
  const set = (k, v) => { if (!v) delete l[k]; else l[k] = v; B.renderEdges(); B.commit(); soon(); };
  ctx.append(btn(icon("straight"), "straight", () => set("curve", 0), !l.curve), btn(icon("curve"), "curved (again: bend the other way)", () => set("curve", l.curve === 1 ? -1 : 1), !!l.curve), h("span", { class: "dsep" }),
    btn(icon("end"), "arrow head at the end", () => set("head", ""), !l.head), btn(icon("both"), "heads at both ends", () => set("head", "both"), l.head === "both"), btn(icon("none"), "no head", () => set("head", "none"), l.head === "none"),
    btn(icon("flip"), "turn around", () => { const a = l.a; l.a = l.b; l.b = a; B.renderEdges(); B.commit(); }), h("span", { class: "dsep" }),
    btn(icon("dash"), "dashed", () => set("dash", l.dash ? 0 : 1), !!l.dash));
  [1, 2, 3].forEach(w => ctx.append(btn(`<i class="pdot" style="width:${2 + w * 3}px;height:${2 + w * 3}px;background:currentColor"></i>`, ["thin", "medium", "thick"][w - 1], () => set("w", w === 1 ? 0 : w), (l.w || 1) === w)));
  ctx.append(h("span", { class: "dsep" }), btn(`<i class="pdot" style="background:var(--link)"></i>`, "usual colour", () => set("c", ""), !l.c));
  ["r", "b", "g", "o", "p", "k"].forEach(c => ctx.append(btn(`<i class="pdot" style="background:${PEN[c]}"></i>`, NAMES[c], () => set("c", c), l.c === c)));
  ctx.append(h("span", { class: "dsep" }), btn(icon("label"), "label (double-click the arrow)", () => DR.editLabel(l)), btn(PW.icon("trash"), "delete the arrow (Del)", () => { B.doc.links = B.doc.links.filter(x => x !== l); B.selLink = null; B.renderEdges(); B.commit(); B.updSel(); }));
};
DR.shapeAt = (x, y) => { const L = all(); for (let i = L.length - 1; i >= 0; i--) { const o = L[i]; if (o.type !== "shape" || isLine(o)) continue; const rx = o.w / 2, ry = (o.h || 100) / 2, dx = x - o.x - rx, dy = y - o.y - ry; if (o.kind === "ellipse" ? (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1 : Math.abs(dx) <= rx && Math.abs(dy) <= ry) return o; } return null; };
DR.linkMid = id => (B.linkMids && B.linkMids.get(id)) || null;
// a label written straight onto the arrow
DR.editLabel = function (l) {
  const m = DR.linkMid(l.id); if (!m) return; const old = $("lbled"); old && old.remove();
  const inp = h("input", { id: "lbled", class: "f", value: l.label || "", placeholder: "label", spellcheck: "false", style: { left: m.x + "px", top: m.y + "px" } });
  $("world").append(inp); setTimeout(() => { inp.focus(); inp.select(); }, 0);
  let fin = false; const done = ok => { if (fin) return; fin = true; const v = inp.value.trim(); inp.remove(); if (ok && v !== (l.label || "")) { if (v) l.label = v; else delete l.label; B.renderEdges(); B.commit(); } };
  inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); });
  inp.addEventListener("blur", () => done(true));
};

// ---------- commands ----------
cmd({ id: "draw-select", menu: "Draw", label: "Select and move", key: "Esc", check: () => DR.tool === "select", run: () => DR.set("select") });
cmd({ id: "draw-pen", menu: "Draw", label: "Pen", key: "B", check: () => DR.tool === "pen", run: () => DR.set("pen") });
cmd({ id: "draw-hl", menu: "Draw", label: "Highlighter", key: "Shift+B", check: () => DR.tool === "hl", run: () => DR.set("hl") });
cmd({ id: "draw-eraser", menu: "Draw", label: "Eraser", key: "E", check: () => DR.tool === "eraser", run: () => DR.set("eraser"), sep: true });
[["rect", "Rectangle", "S"], ["ellipse", "Ellipse"], ["line", "Line"], ["arrow", "Arrow"]].forEach(([k, l, key]) => cmd({ id: "draw-" + k, menu: "Draw", label: l, key, enabled: () => !inReader(), check: () => DR.tool === "shape" && S.shape === k, run: () => DR.set("shape", k) }));
cmd({ id: "draw-text", menu: "Draw", label: "Text", key: "X", enabled: () => !inReader(), check: () => DR.tool === "text", run: () => DR.set("text"), sep: true });
cmd({ id: "marks-restore", menu: "File", label: "Restore the marks on PDFs…", run: async () => {
  const bd = await PW.store.dir("backups"), list = []; for await (const [n] of bd.entries()) if (/^marks-\d{8}\.json$/.test(n)) list.push(n); list.sort().reverse();
  if (!list.length) return alertDlg("marks", "no copies of the marks yet (one is made each day you mark something)");
  const box = h("div", { class: "list" }); list.forEach(n => box.append(h("button", { class: "b", "data-n": n, style: { height: "auto", padding: "3px 8px" } }, "as they were on " + n.slice(12, 14) + "." + n.slice(10, 12) + "." + n.slice(6, 10) + " (start of the day)")));
  const v = await dialog({ title: "restore the marks on PDFs", body: box, buttons: [{ label: "close", value: null }], init: (d, close) => box.addEventListener("click", e => { const b = e.target.closest("[data-n]"); if (b) close(b.dataset.n); }) });
  if (!v || !(await confirmDlg("restore", "Put back all highlights and lines on PDFs as they were then?\n(the current marks are kept as a copy first)", "restore"))) return;
  for (const [a, t] of [...saving]) { clearTimeout(t); saving.delete(a); }
  await MK.snapshot("marks-before-restore-" + stamp() + ".json"); const snap = JSON.parse(await (await PW.store.readFile(bd, v)).text()), d = await marksDir();
  for await (const [n, hd] of d.entries()) if (hd.kind === "file" && !(n.slice(0, -5) in snap.marks)) await d.removeEntry(n).catch(() => { });
  for (const [a, m] of Object.entries(snap.marks || {})) await PW.store.writeFile(d, a + ".json", JSON.stringify(m));
  MK.reset(); LOG.length = 0; REDO.length = 0; document.querySelectorAll("svg.pmk").forEach(s => s.remove()); document.querySelectorAll("#world .obj.pdf .pg, #reader .rsheet").forEach(p => { p._mkv = -1; });
  for (const e of document.querySelectorAll("#world .obj.pdf")) if (e._asset) MK.paintObj(e._asset, e); MK.paintReader(); PW.reader.drawMarks && PW.reader.drawMarks(); toast("marks restored");
} });
cmd({ id: "draw-stylus", menu: "Draw", label: "A stylus always writes (finger and mouse select)", check: () => !!S.stylus, run: () => { S.stylus = S.stylus ? 0 : 1; saveS(); toast(S.stylus ? "a stylus writes, its eraser end erases" : "a stylus works like the mouse"); } });
cmd({ id: "draw-shape", hide: true, label: "Shapes", run: () => DR.cycleShape() });
cmd({ id: "marks-hl", menu: "Draw", label: "Highlight the selected PDF text", run: async () => { if (!(await MK.fromSelection(S.hc))) toast("select text on a PDF page first"); } });
cmd({ id: "marks-clear", menu: "Draw", label: "Clear the marks on this PDF page", enabled: () => PW.reader.on, run: async () => { const a = PW.reader.asset, p = PW.reader.page && PW.reader.page(); if (a && p) { await MK.clearPage(a, p); toast("marks on p. " + p + " cleared (Ctrl+Z brings them back)"); } } });
// reader tool buttons
document.querySelectorAll("#reader [data-t]").forEach(b => { b.innerHTML = icon(b.dataset.t, 16); b.addEventListener("click", e => { e.stopPropagation(); DR.set(b.dataset.t); }); });
})();
