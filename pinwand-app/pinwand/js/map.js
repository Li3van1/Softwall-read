"use strict";
// pinwand · mind maps: any object can be a branch of another; tidy layout, collapsing, focus, outlines
const MAP = PW.map = { lastNode: null, focusId: null };
const kids = new Map(); // parent id → [children], rebuilt on demand
function index() { kids.clear(); for (const o of all()) if (o.parent && B.objs.has(o.parent)) { if (!kids.has(o.parent)) kids.set(o.parent, []); kids.get(o.parent).push(o); } kids.forEach(l => l.sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0) || a.y - b.y)); }
MAP.children = id => { index(); return kids.get(id) || []; };
MAP.descendants = function (id) { index(); const out = [], st = [id]; while (st.length) { const c = kids.get(st.pop()) || []; for (const k of c) { out.push(k.id); st.push(k.id); } } return out; };
MAP.rootOf = o => { let r = o, n = 0; while (r && r.parent && B.objs.has(r.parent) && n++ < 500) r = obj(r.parent); return r; };
MAP.inTree = o => !!(o && (o.parent && B.objs.has(o.parent) || all().some(c => c.parent === o.id)));
MAP.isHidden = o => { let p = o.parent && obj(o.parent), n = 0; while (p && n++ < 500) { if (p.collapsed) return true; p = p.parent && obj(p.parent); } return false; };
function depth(o) { let d = 0, p = o; while (p.parent && B.objs.has(p.parent) && d < 500) { p = obj(p.parent); d++; } return d; }
function branchIndex(o, fresh) { let p = o, prev = o, n = 0; while (p.parent && B.objs.has(p.parent) && n++ < 500) { prev = p; p = obj(p.parent); } if (p === o) return -1; const top = fresh ? (kids.get(p.id) || []) : MAP.children(p.id); return top.indexOf(prev); }

function branchCol(o, fresh) { let p = o, n = 0; while (p && n++ < 500) { if (p.color && p.color[0] === "b") return `var(--${p.color})`; if (!(p.parent && B.objs.has(p.parent))) break; p = obj(p.parent); } const bi = branchIndex(o, fresh); return bi >= 0 ? `var(--b${1 + bi % 7})` : ""; }
MAP.inheritShape = o => { const r = MAP.rootOf(o); return r && r !== o ? r.mapShape : (o.parent ? null : null); };
MAP.decorate = function (o, e) {
  const hasKids = all().some(c => c.parent === o.id), inT = !!(o.parent && B.objs.has(o.parent));
  e.classList.toggle("root", o.type === "node" && !inT);
  e.classList.toggle("mapkid", inT);
  e.style.setProperty("--bc", inT || (o.color && o.color[0] === "b") ? branchCol(o) : "");
  e.classList.toggle("hiddenkid", MAP.isHidden(o));
  let b = e.querySelector(":scope > .badge");
  if (hasKids && o.collapsed) { const n = MAP.descendants(o.id).length; if (!b) { b = h("span", { class: "badge", title: "expand (Space)" }); b.addEventListener("click", ev => { ev.stopPropagation(); MAP.toggle(obj(e.dataset.id)); }); e.append(b); } b.textContent = "+" + n; }
  else if (b) b.remove();
};
const LAYOUTS = ["both", "right", "down", "indent"];
MAP.LAYOUTS = LAYOUTS;
MAP.edgesSVG = function () {
  index(); const out = [];
  for (const [pid, list] of [...kids]) {
    const p = obj(pid); if (!p || p.collapsed || MAP.isHidden(p)) continue; const P = B.box(p), mode = (MAP.rootOf(p) || p).layout || "both";
    for (const c of list) {
      if (MAP.isHidden(c)) continue; const Cb = B.box(c), col = branchCol(c, true), es = (PW.look && PW.look.edges) || "elbow", w = Math.max(1.2, 3.2 - depth(c) * .5) * ((PW.look && PW.look.edgeW) || 1);
      let d;
      if (mode === "down") { const x1 = P.cx, y1 = P.y + P.h, x2 = Cb.cx, y2 = Cb.y, my = y1 + (y2 - y1) * .5, r = Math.min(8, Math.abs(x2 - x1) / 2, Math.abs(my - y1)), sx = Math.sign(x2 - x1) || 0;
        d = es === "straight" ? `M${x1},${y1} L${x2},${y2}` : es === "curved" ? `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}` : Math.abs(x2 - x1) < 1 ? `M${x1},${y1} V${y2}` : `M${x1},${y1} V${my - r} Q${x1},${my} ${x1 + sx * r},${my} H${x2 - sx * r} Q${x2},${my} ${x2},${my + r} V${y2}`; }
      else if (mode === "indent") { const x1 = P.x + 14, y1 = P.y + P.h, x2 = Cb.x, y2 = Cb.cy, r = Math.min(8, Math.abs(y2 - y1) / 2, Math.abs(x2 - x1));
        d = es === "straight" ? `M${x1},${y1} L${x2},${y2}` : es === "curved" ? `M${x1},${y1} C${x1},${y2} ${x1},${y2} ${x2},${y2}` : `M${x1},${y1} V${y2 - r} Q${x1},${y2} ${x1 + r},${y2} H${x2}`; }
      else { const right = Cb.cx >= P.cx, x1 = right ? P.x + P.w : P.x, y1 = P.cy, x2 = right ? Cb.x : Cb.x + Cb.w, y2 = Cb.cy, mx = x1 + (x2 - x1) * .5, r = Math.min(8, Math.abs(y2 - y1) / 2, Math.abs(mx - x1)), sy = Math.sign(y2 - y1) || 0, sx = right ? 1 : -1;
        d = es === "straight" ? `M${x1},${y1} L${x2},${y2}` : es === "curved" ? `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}` : Math.abs(y2 - y1) < 1 ? `M${x1},${y1} H${x2}` : `M${x1},${y1} H${mx - sx * r} Q${mx},${y1} ${mx},${y1 + sy * r} V${y2 - sy * r} Q${mx},${y2} ${mx + sx * r},${y2} H${x2}`; }
      out.push(`<path class="tree" d="${d}" style="stroke:${col};stroke-width:${w}"/>`);
    }
  }
  return out.join("");
};

// ---------- tidy layout: both sides, one side, top-down (org chart), indented list ----------
const GAPX = 44, GAPY = 12, GAPD = 40, GAPS = 18;
MAP.layout = function (root, animate = true) {
  if (!root) return; index(); if (!(kids.get(root.id) || []).length) return;
  const mode = root.layout || "both", sz = new Map(), S = o => { if (!sz.has(o.id)) sz.set(o.id, B.size(o)); return sz.get(o.id); };
  const vis = o => o.collapsed ? [] : (kids.get(o.id) || []);
  const top = kids.get(root.id) || [];
  if (mode === "down") {
    const W = new Map(); const sub = o => { if (W.has(o.id)) return W.get(o.id); const ks = vis(o); let s = ks.reduce((a, c) => a + sub(c), 0) + GAPS * Math.max(0, ks.length - 1); s = Math.max(S(o).w, s); W.set(o.id, s); return s; };
    const place = o => { const ks = vis(o); if (!ks.length) return; const so = S(o), tot = ks.reduce((a, c) => a + sub(c), 0) + GAPS * (ks.length - 1); let x = o.x + so.w / 2 - tot / 2; const rowH = Math.max(...ks.map(c => S(c).h)) ;
      for (const c of ks) { const wc = sub(c); c.x = Math.round(x + wc / 2 - S(c).w / 2); c.y = Math.round(o.y + so.h + GAPD); place(c); x += wc + GAPS; } void rowH; };
    place(root);
  } else if (mode === "indent") {
    let y = root.y + S(root).h + GAPY; const place = (o, d) => { for (const c of vis(o)) { c.x = Math.round(root.x + 34 * d); c.y = Math.round(y); y += S(c).h + GAPY; place(c, d + 1); } };
    place(root, 1);
  } else {
    if (mode === "right") top.forEach(c => c.side = "r"); else top.forEach(c => { if (c.side !== "l" && c.side !== "r") c.side = "r"; });
    const H = new Map(); const sub = o => { if (H.has(o.id)) return H.get(o.id); const ks = vis(o); let s = ks.reduce((a, c) => a + sub(c), 0) + GAPY * Math.max(0, ks.length - 1); s = Math.max(S(o).h, s); H.set(o.id, s); return s; };
    const place = (o, dir) => { const ks = vis(o); if (!ks.length) return; const so = S(o), tot = ks.reduce((a, c) => a + sub(c), 0) + GAPY * (ks.length - 1); let y = o.y + so.h / 2 - tot / 2;
      for (const c of ks) { const sc = S(c), hc = sub(c); c.x = Math.round(dir > 0 ? o.x + so.w + GAPX : o.x - GAPX - sc.w); c.y = Math.round(y + hc / 2 - sc.h / 2); place(c, dir); y += hc + GAPY; } };
    for (const side of ["r", "l"]) { const ks = top.filter(c => c.side === side); if (!ks.length || root.collapsed) continue; const so = S(root);
      const tot = ks.reduce((a, c) => a + sub(c), 0) + GAPY * (ks.length - 1); let y = root.y + so.h / 2 - tot / 2;
      for (const c of ks) { const sc = S(c), hc = sub(c); c.x = Math.round(side === "r" ? root.x + so.w + GAPX * 1.3 : root.x - GAPX * 1.3 - sc.w); c.y = Math.round(y + hc / 2 - sc.h / 2); place(c, side === "r" ? 1 : -1); y += hc + GAPY; } }
  }
  if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) { world.classList.add("anim"); clearTimeout(MAP._a); MAP._a = setTimeout(() => { world.classList.remove("anim"); B.renderEdges(); }, 260); }
  for (const id of MAP.descendants(root.id)) { const o = obj(id), e = B.el(id); if (e) { e.style.left = o.x + "px"; e.style.top = o.y + "px"; } }
  B.renderEdges(); if (animate) { let n = 0; const tick = () => { B.renderEdges(); if (++n < 16) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
};
MAP.setLayout = function (o, mode) { const r = MAP.rootOf(o); if (!r) return; r.layout = mode; r.auto = true; MAP.layout(r); B.commit(); };
MAP.setShape = function (list, shape, whole) { list.forEach(o => { if (whole) { const r = MAP.rootOf(o); r.mapShape = shape; [r, ...MAP.descendants(r.id).map(obj)].forEach(x => { if (x.type === "node") { delete x.shape; B.render(x); } }); } else if (o.type === "node") { o.shape = shape; B.render(o); } });
  const roots = new Set(list.map(MAP.rootOf)); roots.forEach(r => r && r.auto !== false && MAP.inTree(r) && MAP.layout(r)); B.renderEdges(); B.commit(); };
MAP.setIcon = function (list, icon) { list.forEach(o => { if (o.type !== "node") return; if (icon) o.icon = icon; else delete o.icon; B.render(o); }); const roots = new Set(list.map(MAP.rootOf)); roots.forEach(r => r && MAP.inTree(r) && r.auto !== false && MAP.layout(r)); B.commit(); };
MAP.setColor = function (list, c) { list.forEach(o => { if (c) o.color = c; else delete o.color; }); const roots = new Set(list.map(MAP.rootOf)); roots.forEach(r => r && [r, ...MAP.descendants(r.id).map(obj)].forEach(x => B.render(x))); B.renderEdges(); B.commit(); };
const pending = new Set();
const flush = debounce(() => { const roots = new Set([...pending].map(id => obj(id)).filter(Boolean).map(MAP.rootOf)); pending.clear(); roots.forEach(r => { if (r.auto !== false && MAP.inTree(r)) MAP.layout(r); }); }, 60);
MAP.relayoutSoon = o => { if (!o || !MAP.inTree(o)) return; pending.add(o.id); flush(); };
MAP.relayoutAll = (animate = false) => { index(); const roots = all().filter(o => !(o.parent && B.objs.has(o.parent)) && kids.has(o.id)); requestAnimationFrame(() => roots.forEach(r => { if (r.auto !== false) MAP.layout(r, animate); })); };
function redecorate(root) { [root.id, ...MAP.descendants(root.id)].forEach(id => { const o = obj(id), e = B.el(id); if (o && e) MAP.decorate(o, e); }); }

// ---------- editing the tree ----------
MAP.addChild = function (p, text = "") {
  if (!p) return; const ks = MAP.children(p.id), isRoot = !(p.parent && B.objs.has(p.parent));
  const side = isRoot ? (ks.filter(c => c.side === "l").length < ks.filter(c => c.side !== "l").length - 1 ? "l" : "r") : undefined;
  if (p.collapsed) { p.collapsed = false; redecorate(MAP.rootOf(p)); }
  const n = B.add({ type: "node", x: p.x + B.size(p).w + GAPX, y: p.y, w: 320, text, parent: p.id, ord: (ks.length ? Math.max(...ks.map(c => c.ord ?? 0)) : 0) + 1, side }, { commit: false });
  B.render(p); MAP.layout(MAP.rootOf(n)); B.commit(); return n;
};
MAP.addSibling = function (o) {
  if (!o.parent || !B.objs.has(o.parent)) return MAP.addChild(o);
  const p = obj(o.parent), ks = MAP.children(p.id); ks.forEach(c => { if ((c.ord ?? 0) > (o.ord ?? 0)) c.ord = (c.ord ?? 0) + 1; });
  const n = B.add({ type: "node", x: o.x, y: o.y + 40, w: 320, text: "", parent: p.id, ord: (o.ord ?? 0) + 1, side: o.side }, { commit: false });
  MAP.layout(MAP.rootOf(n)); B.commit(); return n;
};
MAP.newRoot = function (at, text = "") { at = at || B.center(); return B.add({ type: "node", x: Math.round(at.x), y: Math.round(at.y), w: 360, text, auto: true }, { edit: "text" }); };
MAP.toggle = function (o) { if (!o || !MAP.children(o.id).length) return; o.collapsed = !o.collapsed; const r = MAP.rootOf(o); redecorate(r); MAP.layout(r); B.commit(); };
MAP.detach = function (o) { if (!o || !o.parent) return; const r = MAP.rootOf(o); delete o.parent; delete o.ord; delete o.side; o.x += 60; B.render(o); redecorate(o); MAP.layout(r); B.renderEdges(); B.commit(); };
MAP.attach = function (o, p) {
  if (!o || !p || o === p || MAP.descendants(o.id).includes(p.id)) return false;
  const oldRoot = MAP.rootOf(o), ks = MAP.children(p.id); o.parent = p.id; o.ord = (ks.length ? Math.max(...ks.map(c => c.ord ?? 0)) : 0) + 1;
  const isRoot = !(p.parent && B.objs.has(p.parent)); o.side = isRoot ? (o.x + B.size(o).w / 2 < p.x + B.size(p).w / 2 ? "l" : "r") : undefined;
  if (p.collapsed) p.collapsed = false;
  const r = MAP.rootOf(p); redecorate(r); MAP.layout(r); if (oldRoot !== r && oldRoot !== o) MAP.layout(oldRoot); B.render(p); return true;
};
MAP.addFromText = function (text, ref, spot) {
  const p = MAP.lastNode && obj(MAP.lastNode);
  if (p) { const n = MAP.addChild(p, text); n.ref = ref; n.refText = text; B.render(n); B.commit(); return n; }
  const n = B.add({ type: "node", x: spot.x, y: spot.y, w: 360, text, ref, refText: text, auto: true }); MAP.lastNode = n.id; return n;
};

// ---------- dragging onto a branch ----------
let hoverT = null;
function nodeAt(e, moving) { const els = document.elementsFromPoint(e.clientX, e.clientY); for (const x of els) { const oe = x.closest && x.closest(".obj"); if (!oe) continue; const o = obj(oe.dataset.id); if (o && !moving.has(o.id) && !isArea(o) && o.type !== "pdf" && !(o.type === "image")) return o; } return null; }
MAP.dragHover = function (d, e) {
  const prim = d.o, moving = new Set(d.start.map(s => s[0].id)), can = prim.type === "node" || e.altKey || d.alt;
  const t = can ? nodeAt(e, moving) : null, te = t && B.el(t.id);
  if (hoverT && hoverT !== te) hoverT.style.outline = ""; hoverT = te; if (te) te.style.outline = "3px dashed var(--hit)";
};
MAP.dropped = function (d, e) {
  if (hoverT) { hoverT.style.outline = ""; hoverT = null; }
  const prim = d.o, moving = new Set(d.start.map(s => s[0].id)), can = prim.type === "node" || e.altKey || d.alt;
  const t = can ? nodeAt(e, moving) : null;
  if (t && MAP.attach(prim, t)) { B.commit(); return true; }
  if (prim.parent && B.objs.has(prim.parent)) { // reorder among siblings by height, then tidy
    const p = obj(prim.parent), r = MAP.rootOf(prim), isRoot = p === r;
    if (isRoot) prim.side = B.box(prim).cx < B.box(p).cx ? "l" : "r";
    const sib = MAP.children(p.id).filter(c => !isRoot || c.side === prim.side).sort((a, b) => a.y - b.y); sib.forEach((c, i) => c.ord = i + 1);
    if (r.auto !== false) MAP.layout(r); B.commit(); return true;
  }
  return false;
};

// ---------- keyboard navigation in a tree ----------
MAP.nav = function (o, key) {
  const mode = (MAP.rootOf(o) || o).layout || "both";
  if (mode === "down" || mode === "indent") { const p = o.parent && obj(o.parent), ks = o.collapsed ? [] : MAP.children(o.id); let t = null;
    const sibs = p ? MAP.children(p.id).slice().sort((a, b) => mode === "down" ? a.x - b.x : a.y - b.y) : [], i = sibs.indexOf(o);
    const inward = mode === "down" ? "ArrowDown" : "ArrowRight", outward = mode === "down" ? "ArrowUp" : "ArrowLeft", prev = mode === "down" ? "ArrowLeft" : "ArrowUp", next = mode === "down" ? "ArrowRight" : "ArrowDown";
    if (key === inward) t = ks[0] || null; if (key === outward) t = p || null; if (key === prev) t = sibs[i - 1] || null; if (key === next) t = sibs[i + 1] || null;
    if (t) { B.select([t.id]); B.reveal(t, B.view.z); } return !!t; }
  const p = o.parent && obj(o.parent), right = !p || B.box(o).cx >= B.box(p).cx, ks = o.collapsed ? [] : MAP.children(o.id);
  let t = null;
  if (key === "ArrowRight") t = right ? (ks.filter(c => !(!o.parent && c.side === "l"))[0] || null) : p;
  if (key === "ArrowLeft") t = right ? (p || ks.filter(c => c.side === "l")[0]) : (ks[0] || null);
  if ((key === "ArrowUp" || key === "ArrowDown") && p) { const sib = MAP.children(p.id).filter(c => !p.parent && o.side ? c.side === o.side : true).sort((a, b) => a.y - b.y), i = sib.indexOf(o); t = sib[i + (key === "ArrowUp" ? -1 : 1)] || null; }
  if (t) { B.select([t.id]); B.reveal(t, B.view.z); }
  return !!t;
};

// ---------- focus: only one branch at full strength ----------
MAP.focus = function (o) {
  const cur = MAP.focusId; document.querySelectorAll(".obj.dim").forEach(e => e.classList.remove("dim"));
  if (!o || cur === o.id) { MAP.focusId = null; return; }
  const keep = new Set([o.id, ...MAP.descendants(o.id)]); let p = o; while (p.parent && B.objs.has(p.parent)) { p = obj(p.parent); keep.add(p.id); }
  all().forEach(x => { if (!keep.has(x.id)) { const e = B.el(x.id); e && e.classList.add("dim"); } }); MAP.focusId = o.id;
};

// ---------- outlines ↔ maps ----------
MAP.pasteOutline = function (text, under) {
  const lines = text.replace(/\t/g, "    ").split(/\r?\n/).filter(l => l.trim());
  const items = lines.map(l => { const ind = l.match(/^\s*/)[0].length; return { ind, t: l.trim().replace(/^([-*•·▪◦]|\d+[.)])\s+/, "") }; });
  if (!items.length) return; const base = Math.min(...items.map(i => i.ind)); const stack = [];
  let root = under; const made = [];
  if (!root) { root = B.add({ type: "node", x: Math.round(B.center().x), y: Math.round(B.center().y), w: 360, text: items.shift().t, auto: true }, { commit: false }); made.push(root); }
  for (const it of items) {
    while (stack.length && stack[stack.length - 1].ind >= it.ind) stack.pop();
    const p = stack.length ? stack[stack.length - 1].o : root, ks = MAP.children(p.id);
    const n = B.add({ type: "node", x: p.x + 200, y: p.y, w: 320, text: it.t, parent: p.id, ord: (ks.length ? Math.max(...ks.map(c => c.ord ?? 0)) : 0) + 1, side: p === root && !(root.parent) ? (ks.length % 2 ? "l" : "r") : undefined }, { select: false, commit: false });
    made.push(n); stack.push({ ind: it.ind, o: n });
  }
  index(); B.renderAll(); MAP.layout(MAP.rootOf(root)); B.select([root.id]); B.commit(); toast(made.length + " branches");
};
MAP.outline = function (o) {
  const lines = []; const walk = (x, d) => { lines.push("  ".repeat(d) + (d ? "- " : "") + texPlain(B.textOf(x)).replace(/\n/g, " ")); MAP.children(x.id).sort((a, b) => a.y - b.y).forEach(c => walk(c, d + 1)); };
  walk(MAP.rootOf(o), 0); return lines.join("\n");
};
// remember the last branch you worked on, so PDF selections can go there
const prevSel = B.onSel; B.onSel = () => { prevSel && prevSel(); const c = B.cur(); if (c && (c.type === "node" || MAP.inTree(c))) MAP.lastNode = c.id; };
