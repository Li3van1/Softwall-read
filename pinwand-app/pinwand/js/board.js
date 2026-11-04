"use strict";
// pinwand · the board: model, history, rendering, view, pointer and editing
const B = PW.B = {
  doc: null, file: null, objs: new Map(), sel: new Set(), selLink: null, view: { x: 0, y: 0, z: 1 },
  dirty: false, nextId: 1, editing: null, onChange: null, hist: [], redo: [], types: {},
};
const world = $("world"), vp = $("viewport"), svg = $("edges");
const BOX_DAYS = [0, 1, 3, 7, 14, 30], DAY = 864e5;
const isStudy = o => (o.type === "def" && !o.copy && (o.term || "").trim()) || (o.type === "q" && !o.copy && (o.q || "").trim());
const isDue = o => !o.due || o.due <= Date.now();
const obj = id => B.objs.get(id);
const all = () => B.doc ? B.doc.objects : [];
const isArea = o => !!o && (o.type === "frame" || o.type === "matrix");

// ---------- documents ----------
function newDoc(name) { return { format: "pinwand", version: 1, name, created: Date.now(), view: { x: 80, y: 80, z: 1 }, objects: [], links: [], settings: {} }; }
function normObj(o) {
  o.x = +o.x || 0; o.y = +o.y || 0; o.w = Math.max(20, +o.w || 220);
  if (o.type === "def" || o.type === "q") { o.box = clamp(Math.round(+o.box || 0), 0, 5); o.due = +o.due || 0; o.reps = +o.reps || 0; }
  return o;
}
B.load = function (doc, file) {
  for (const el of [...world.querySelectorAll(".obj")]) el.remove();
  B.doc = doc; B.file = file; doc.objects = (doc.objects || []).map(normObj); doc.links = doc.links || []; doc.settings = doc.settings || {};
  B.objs = new Map(doc.objects.map(o => [o.id, o])); B.nextId = 1 + Math.max(0, ...doc.objects.map(o => +String(o.id).replace(/\D/g, "") || 0), ...doc.links.map(l => +String(l.id).replace(/\D/g, "") || 0));
  B.sel.clear(); B.selLink = null; B.view = Object.assign({ x: 80, y: 80, z: 1 }, doc.view || {});
  B.hist = [B.snap()]; B.redo = []; B.dirty = false;
  B.renderAll(); B.applyView(); PW.map && PW.map.relayoutAll(false);
};
B.snap = () => JSON.stringify({ o: B.doc.objects, l: B.doc.links });
B.serialize = () => Object.assign({}, B.doc, { view: B.view, objects: B.doc.objects, links: B.doc.links, saved: Date.now() });
B.commit = function (why) {
  if (!B.doc) return; const s = B.snap(); if (B.hist[B.hist.length - 1] === s) return;
  B.hist.push(s); if (B.hist.length > 80) B.hist.shift(); B.redo = []; B.touch(why);
};
B.touch = function () { B.dirty = true; B.onChange && B.onChange(); };
function restore(s) {
  const d = JSON.parse(s); B.doc.objects = d.o; B.doc.links = d.l; B.objs = new Map(d.o.map(o => [o.id, o]));
  for (const id of [...B.sel]) if (!B.objs.has(id)) B.sel.delete(id);
  B.renderAll(); B.touch();
}
B.undo = () => { if (B.hist.length < 2) return; B.redo.push(B.hist.pop()); restore(B.hist[B.hist.length - 1]); status("undo"); };
B.redoIt = () => { const s = B.redo.pop(); if (!s) return; B.hist.push(s); restore(s); status("redo"); };
B.id = () => "o" + (B.nextId++);

// ---------- objects ----------
B.add = function (o, { select = true, edit = null, commit = true } = {}) {
  o.id = o.id || B.id(); normObj(o); o.created = o.created || Date.now(); B.doc.objects.push(o); B.objs.set(o.id, o); B.render(o);
  if (select) B.select([o.id]); if (commit) B.commit(); if (edit) setTimeout(() => B.edit(o, edit), 0); return o;
};
B.remove = function (ids, { commit = true } = {}) {
  const set = new Set(ids); if (!set.size) return;
  // removing a map node also removes its branch
  if (PW.map) for (const id of [...set]) PW.map.descendants(id).forEach(d => set.add(d));
  B.doc.objects = B.doc.objects.filter(o => !set.has(o.id)); set.forEach(id => { B.objs.delete(id); const e = elOf(id); e && e.remove(); B.sel.delete(id); });
  B.doc.links = B.doc.links.filter(l => !set.has(l.a) && !set.has(l.b));
  for (const o of B.doc.objects) if (set.has(o.parent)) delete o.parent;
  PW.pdf && PW.pdf.forget(set);
  B.renderEdges(); B.updSel(); if (commit) B.commit();
};
B.toFront = function (ids) { const set = new Set(ids), keep = B.doc.objects.filter(o => !set.has(o.id)), mv = B.doc.objects.filter(o => set.has(o.id)); B.doc.objects = keep.concat(mv); B.zorder(); };
B.zorder = () => B.doc.objects.forEach((o, i) => { const e = elOf(o.id); if (e) e.style.zIndex = (isArea(o) || (o.type === "image" && o.bg)) ? 0 : 3 + i; });

// ---------- rendering ----------
const elCache = new Map();
function elOf(id) { let e = elCache.get(id); if (e && e.isConnected) return e; e = world.querySelector(`.obj[data-id="${id}"]`); if (e) elCache.set(id, e); return e; }
B.el = elOf;
B.render = function (o) {
  const T = B.types[o.type]; if (!T) return null;
  let e = elOf(o.id); if (e && e._type !== o.type) { e.remove(); e = null; }
  if (!e) { e = T.create(o); e.classList.add("obj"); e.dataset.id = o.id; e._type = o.type; world.append(e); elCache.set(o.id, e); }
  e._o = o; e.style.left = o.x + "px"; e.style.top = o.y + "px"; e.style.width = o.w + "px";
  if (o.h && T.fixedH) e.style.height = o.h + "px";
  T.update(o, e); e.classList.toggle("sel", B.sel.has(o.id));
  PW.map && PW.map.decorate(o, e);
  return e;
};
B.renderAll = function () {
  const live = new Set(B.doc.objects.map(o => o.id));
  for (const e of [...world.querySelectorAll(".obj")]) if (!live.has(e.dataset.id)) e.remove();
  B.doc.objects.forEach(o => B.render(o)); B.zorder(); B.renderEdges(); B.updSel();
};
B.size = o => { const e = elOf(o.id); return e ? { w: e.offsetWidth, h: e.offsetHeight } : { w: o.w, h: o.h || 60 }; };
B.box = o => { const s = B.size(o); return { x: o.x, y: o.y, w: s.w, h: s.h, cx: o.x + s.w / 2, cy: o.y + s.h / 2 }; };

// ---------- edges: links (arrows) and tree branches ----------
const NS = "http://www.w3.org/2000/svg";
function anchor(bx, tx, ty) { // point on the box border towards (tx,ty)
  const dx = tx - bx.cx, dy = ty - bx.cy; if (!dx && !dy) return [bx.cx, bx.cy];
  const sx = bx.w / 2 / Math.abs(dx || 1e-9), sy = bx.h / 2 / Math.abs(dy || 1e-9), s = Math.min(sx, sy);
  return [bx.cx + dx * s, bx.cy + dy * s];
}
B.renderEdges = function () {
  if (!B.doc) return; const parts = [];
  if (PW.map) parts.push(PW.map.edgesSVG());
  for (const l of B.doc.links) {
    const a = obj(l.a), b = obj(l.b); if (!a || !b) continue; if (PW.map && (PW.map.isHidden(a) || PW.map.isHidden(b))) continue;
    const A = B.box(a), Bx = B.box(b), [x1, y1] = anchor(A, Bx.cx, Bx.cy), [x2, y2] = anchor(Bx, A.cx, A.cy);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, ax = x2 - ux * 10, ay = y2 - uy * 10;
    const cls = "lnk" + (B.selLink === l.id ? " sel" : "");
    parts.push(`<path class="${cls}" d="M${x1},${y1} L${x2},${y2}"${l.dash ? ' stroke-dasharray="6 5"' : ""}/>`,
      `<path class="${cls}" style="fill:currentColor;stroke:none;color:var(${B.selLink === l.id ? "--hit" : "--link"})" d="M${x2},${y2} L${ax - uy * 5},${ay + ux * 5} L${ax + uy * 5},${ay - ux * 5}Z"/>`,
      `<path class="lnkhit" data-link="${l.id}" d="M${x1},${y1} L${x2},${y2}"/>`);
    if (l.label) parts.push(`<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 4}" text-anchor="middle" data-link="${l.id}" style="pointer-events:all;cursor:text">${escHTML(l.label)}</text>`);
  }
  svg.innerHTML = parts.join("");
};
B.addLink = function (a, b, extra = {}) { if (a === b || B.doc.links.some(l => l.a === a && l.b === b)) return; B.doc.links.push(Object.assign({ id: "l" + (B.nextId++), a, b }, extra)); B.renderEdges(); B.commit(); };

// ---------- view ----------
B.applyView = function () {
  const v = B.view; world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`;
  const p = Math.round(v.z * 100) + "%"; $("zv").textContent = p; $("sZoom").textContent = p;
  PW.pdf && PW.pdf.onView(); B.onView && B.onView();
};
B.toWorld = (cx, cy) => { const r = vp.getBoundingClientRect(); return { x: (cx - r.left - B.view.x) / B.view.z, y: (cy - r.top - B.view.y) / B.view.z }; };
B.zoomAt = function (f, cx, cy) {
  const r = vp.getBoundingClientRect(); if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
  const z = clamp(B.view.z * f, 0.03, 6), px = cx - r.left, py = cy - r.top;
  B.view.x = px - (px - B.view.x) * z / B.view.z; B.view.y = py - (py - B.view.y) * z / B.view.z; B.view.z = z; B.applyView(); viewDirty();
};
const viewDirty = debounce(() => { if (B.doc) { B.doc.view = B.view; B.onViewSave && B.onViewSave(); } }, 600);
B.bounds = function (list) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const o of list) { if (PW.map && PW.map.isHidden(o)) continue; const b = B.box(o); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  return x0 > x1 ? null : { x0, y0, x1, y1 };
};
let navAnim = 0;
B.fit = function (list, maxZ = 1.2, animate = true) {
  const b = B.bounds(list && list.length ? list : all()), r = vp.getBoundingClientRect(); if (!b) return;
  const pad = 40, z = clamp(Math.min((r.width - 2 * pad) / (b.x1 - b.x0 || 1), (r.height - 2 * pad) / (b.y1 - b.y0 || 1), maxZ), 0.03, 6);
  const tx = r.width / 2 - (b.x0 + b.x1) / 2 * z, ty = r.height / 2 - (b.y0 + b.y1) / 2 * z;
  B.navTo(tx, ty, z, animate ? 260 : 0);
};
B.navTo = function (tx, ty, tz, ms = 260) {
  cancelAnimationFrame(navAnim); if (!ms || matchMedia("(prefers-reduced-motion: reduce)").matches) { Object.assign(B.view, { x: tx, y: ty, z: tz }); B.applyView(); viewDirty(); return; }
  const s = { ...B.view }, t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); B.view.x = s.x + (tx - s.x) * e; B.view.y = s.y + (ty - s.y) * e; B.view.z = s.z + (tz - s.z) * e; B.applyView(); if (k < 1) navAnim = requestAnimationFrame(step); else viewDirty(); };
  navAnim = requestAnimationFrame(step);
};
B.reveal = function (o, minZ = 0.6) {
  const b = B.box(o), r = vp.getBoundingClientRect(), z = Math.max(B.view.z, minZ);
  const sx = b.cx * z + B.view.x, sy = b.cy * z + B.view.y, m = 80;
  if (z !== B.view.z || sx < m || sx > r.width - m || sy < m || sy > r.height - m) B.navTo(r.width / 2 - b.cx * z, r.height / 2 - b.cy * z, z);
};
B.flash = function (id) { const e = elOf(id); if (!e) return; e.classList.remove("flash"); void e.offsetWidth; e.classList.add("flash"); };
B.center = () => { const r = vp.getBoundingClientRect(); return B.toWorld(r.left + r.width / 2, r.top + r.height / 2); };

// ---------- selection ----------
B.select = function (ids, add = false) { if (!add) B.sel.clear(); ids.forEach(id => B.sel.add(id)); B.selLink = null; B.updSel(); };
B.updSel = function () {
  for (const e of world.querySelectorAll(".obj.sel")) if (!B.sel.has(e.dataset.id)) e.classList.remove("sel");
  B.sel.forEach(id => { const e = elOf(id); e && e.classList.add("sel"); });
  const n = B.sel.size; $("sSel").textContent = n ? n + " selected" : (B.selLink ? "arrow selected" : "");
  B.onSel && B.onSel();
};
B.selected = () => [...B.sel].map(obj).filter(Boolean);
B.cur = () => B.sel.size === 1 ? obj([...B.sel][0]) : null;

// ---------- editing text in place ----------
B.edit = function (o, field, pt) {
  const e = elOf(o.id); if (!e) return; const T = B.types[o.type];
  field = field || (T && T.editField) || "text";
  const t = e.querySelector(`.txt[data-f="${field}"]`); if (!t) return;
  if (B.editing && B.editing.t !== t) B.endEdit();
  e.classList.add("editing"); if (o.type === "q") e.classList.add("open");
  const get = (T && T.get) ? T.get(o, field) : o[field];
  T && T.onEdit && T.onEdit(o, e, field);
  t._src = null; t.textContent = get || ""; t.contentEditable = "true"; t.focus();
  let r = null; if (pt) { try { if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(pt.x, pt.y); else if (document.caretPositionFromPoint) { const cp = document.caretPositionFromPoint(pt.x, pt.y); if (cp) { r = document.createRange(); r.setStart(cp.offsetNode, cp.offset); } } } catch (e) { r = null; } if (r && !t.contains(r.startContainer)) r = null; }
  if (!r) { r = document.createRange(); r.selectNodeContents(t); r.collapse(false); } const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  B.editing = { o, field, t, e, before: get || "", at: performance.now() };
  PW.map && PW.map.relayoutSoon(o);
};
B.endEdit = function (commit = true) {
  const ed = B.editing; if (!ed) return; B.editing = null;
  ed.t.contentEditable = "false"; ed.e.classList.remove("editing");
  const v = ed.t.innerText.replace(/\n$/, ""); setField(ed.o, ed.field, v); ed.t._src = null; B.render(ed.o);
  if (commit && v !== ed.before) B.commit();
  PW.map && PW.map.relayoutSoon(ed.o); B.renderEdges();
};
function setField(o, f, v) { const T = B.types[o.type]; if (T && T.set) T.set(o, f, v); else o[f] = v; }
world.addEventListener("input", e => { const ed = B.editing; if (!ed || !ed.t.contains(e.target)) return; setField(ed.o, ed.field, ed.t.innerText); B.renderEdges(); PW.map && PW.map.relayoutSoon(ed.o); });
world.addEventListener("focusout", e => { const ed = B.editing; if (ed && e.target === ed.t) setTimeout(() => { if (B.editing === ed && document.activeElement !== ed.t) B.endEdit(); }, 0); });
world.addEventListener("paste", e => { if (!B.editing) return; const T = B.types[B.editing.o.type]; if (T && T.paste && T.paste(e)) { e.preventDefault(); e.stopPropagation(); return; } e.preventDefault(); e.stopPropagation(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); }, true);

// ---------- pointer: pan, select, drag, resize, link ----------
let drag = null;
const isUI = t => t.closest("button,input,select,textarea,label,a,.textLayer,canvas,.badge,.chip,.qt,.fctl,.pages,.nodrag");
vp.addEventListener("pointerdown", e => {
  if (e.button === 2) return; hideMenus();
  const t = e.target, oe = t.closest(".obj"), o = oe && obj(oe.dataset.id);
  if (B.editing && !(B.editing.t.contains(t))) B.endEdit();
  const linkHit = t.closest("[data-link]");
  if (linkHit && !oe) { B.sel.clear(); B.selLink = linkHit.dataset.link; B.updSel(); B.renderEdges(); return; }
  if (e.button === 1 || (!o && !e.shiftKey) || (o && e.button === 0 && PW.keys.space)) { // pan
    if (o && !PW.keys.space && e.button !== 1) return;
    drag = { mode: "pan", sx: e.clientX, sy: e.clientY, vx: B.view.x, vy: B.view.y, moved: false };
    vp.setPointerCapture(e.pointerId); vp.classList.add("panning");
    if (!o && !e.shiftKey && !e.ctrlKey) { B.sel.clear(); if (B.selLink) { B.selLink = null; B.renderEdges(); } B.updSel(); }
    return;
  }
  if (!o) { // shift + drag on background: marquee
    const p = B.toWorld(e.clientX, e.clientY), m = h("div", { id: "marquee" }); world.append(m);
    drag = { mode: "marquee", p, m, base: e.ctrlKey ? new Set(B.sel) : new Set() }; vp.setPointerCapture(e.pointerId); return;
  }
  if (B.editing && B.editing.t.contains(t)) return;
  // alt+click on another object: arrow from the selected object to this one
  if (e.altKey && B.sel.size === 1 && !B.sel.has(o.id)) { e.preventDefault(); B.addLink([...B.sel][0], o.id); B.select([o.id]); toast("arrow added"); return; }
  if (PW.linkMode) { e.preventDefault(); const from = PW.linkMode; PW.linkMode = null; vp.style.cursor = ""; document.body.classList.remove("linking"); if (from !== o.id) { B.addLink(from, o.id); toast("arrow added"); } B.select([o.id]); return; }
  const rz = t.classList.contains("rz") ? "rz" : t.classList.contains("ew") ? "ew" : null;
  if (!rz && isUI(t)) { if (!B.sel.has(o.id)) B.select([o.id], e.shiftKey || e.ctrlKey); return; }
  if (!rz && isArea(o) && !t.closest(".ft,.mx-l,.txt") && !e.shiftKey) { // empty inside of a frame acts like the board
    drag = { mode: "pan", sx: e.clientX, sy: e.clientY, vx: B.view.x, vy: B.view.y, moved: false }; vp.setPointerCapture(e.pointerId); vp.classList.add("panning"); B.sel.clear(); B.updSel(); return;
  }
  if (!rz && (o.type === "pdf" || o.type === "fig" || o.type === "embed") && !t.closest(".wt")) { if (!B.sel.has(o.id)) B.select([o.id]); return; }
  const wasOnly = B.sel.size === 1 && B.sel.has(o.id);
  if (e.shiftKey || e.ctrlKey) { if (B.sel.has(o.id)) { B.sel.delete(o.id); B.updSel(); return; } B.select([o.id], true); }
  else if (!B.sel.has(o.id)) B.select([o.id]);
  const p = B.toWorld(e.clientX, e.clientY);
  if (rz) { document.body.classList.add(rz === "rz" ? "sizing" : "wsizing"); drag = { mode: rz, o, p, w: o.w, h: o.h || B.size(o).h, ratio: (o.h || B.size(o).h) / o.w }; vp.setPointerCapture(e.pointerId); e.preventDefault(); return; }
  // moving: the selection, everything inside selected frames, and whole branches of map nodes
  const move = new Set(B.sel);
  for (const id of B.sel) { const s = obj(id); if (isArea(s)) inside(s).forEach(c => move.add(c.id)); if (PW.map) PW.map.descendants(id).forEach(d => move.add(d)); }
  drag = { mode: "move", p, start: [...move].map(id => { const m = obj(id); return [m, m.x, m.y]; }), moved: false, o, alt: e.altKey, again: wasOnly && !e.shiftKey && !e.ctrlKey ? t.closest(".txt[data-f]") : null, cx: e.clientX, cy: e.clientY };
  vp.setPointerCapture(e.pointerId);
});
function inside(f) { return all().filter(o => o !== f && !isArea(o) && (() => { const b = B.box(o); return b.cx > f.x && b.cx < f.x + f.w && b.cy > f.y && b.cy < f.y + f.h; })()); }
B.inside = inside;
vp.addEventListener("pointermove", e => {
  if (!drag) return;
  if (drag.mode === "pan") { const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true; B.view.x = drag.vx + dx; B.view.y = drag.vy + dy; B.applyView(); return; }
  const p = B.toWorld(e.clientX, e.clientY), dx = p.x - drag.p.x, dy = p.y - drag.p.y;
  if (drag.mode === "marquee") {
    const x = Math.min(p.x, drag.p.x), y = Math.min(p.y, drag.p.y), w = Math.abs(dx), hh = Math.abs(dy);
    Object.assign(drag.m.style, { left: x + "px", top: y + "px", width: w + "px", height: hh + "px" });
    const ids = new Set(drag.base); for (const o of all()) { if (PW.map && PW.map.isHidden(o)) continue; const b = B.box(o); if (b.x >= x && b.y >= y && b.x + b.w <= x + w && b.y + b.h <= y + hh) ids.add(o.id); }
    B.sel = ids; B.updSel(); return;
  }
  if (drag.mode === "rz") { const o = drag.o; o.w = Math.round(Math.max(40, drag.w + dx)); if (o.type === "image" && !e.shiftKey) o.h = Math.round(o.w * drag.ratio); else if (o.h != null || o.type === "frame") o.h = Math.round(Math.max(30, drag.h + dy)); B.render(o); B.renderEdges(); return; }
  if (drag.mode === "ew") { const o = drag.o, T = B.types[o.type]; o.w = Math.round(Math.max((T && T.minW) || 60, drag.w + dx)); B.render(o); B.renderEdges(); PW.map && PW.map.relayoutSoon(o); return; }
  if (drag.mode === "move") {
    if (!drag.moved && Math.hypot(dx, dy) * B.view.z < 3) return;
    if (!drag.moved) { drag.moved = true; try { getSelection().removeAllRanges(); } catch (x) { } drag.start.forEach(([m]) => { const el = elOf(m.id); el && el.classList.add("drag"); }); document.body.classList.add("moving"); B.toFront(drag.start.map(s => s[0].id).filter(id => !isArea(obj(id)))); }
    for (const [m, x, y] of drag.start) { m.x = Math.round(x + dx); m.y = Math.round(y + dy); const el = elOf(m.id); if (el) { el.style.left = m.x + "px"; el.style.top = m.y + "px"; } }
    B.renderEdges(); PW.map && PW.map.dragHover(drag, e);
  }
});
function endDrag(e) {
  if (!drag) return; const d = drag; drag = null; vp.classList.remove("panning"); document.body.classList.remove("sizing", "wsizing");
  if (d.mode === "marquee") { d.m.remove(); B.updSel(); return; }
  if (d.mode === "pan") { if (d.moved) viewDirty(); return; }
  if (d.mode === "move") { document.body.classList.remove("moving"); world.querySelectorAll(".obj.drag").forEach(x => x.classList.remove("drag")); if (!d.moved) { // a click on the text of an item that was already selected: write in it, like on paper
      if (d.again && d.again.isConnected && !document.body.classList.contains("gaps") && !(d.again.closest(".covered,.cv:not(.peek)")) && !(document.body.classList.contains("cover") && d.again.closest(".def .dd"))) B.edit(d.o, d.again.dataset.f, { x: d.cx, y: d.cy });
      return; } if (PW.map && PW.map.dropped(d, e)) return; B.commit(); PW.pdf && PW.pdf.onView(); return; }
  B.commit(); PW.map && PW.map.relayoutSoon(d.o); PW.pdf && PW.pdf.onView();
}
vp.addEventListener("pointerup", endDrag); vp.addEventListener("pointercancel", endDrag);
vp.addEventListener("dblclick", e => {
  // the pointer is captured while dragging, so look at what is really under it
  const t = document.elementFromPoint(e.clientX, e.clientY) || e.target, oe = t.closest(".obj"), o = oe && obj(oe.dataset.id);
  if (B.editing && B.editing.t.contains(t)) { if (performance.now() - (B.editing.at || 0) < 600) { e.preventDefault(); const sl = getSelection(); setTimeout(() => { let r = null; try { r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null; } catch (x) { } if (r && B.editing && B.editing.t.contains(r.startContainer)) { sl.removeAllRanges(); sl.addRange(r); } }, 0); } return; }
  const lt = t.closest("text[data-link]");
  if (lt) { const l = B.doc.links.find(x => x.id === lt.dataset.link); if (l) promptDlg("Arrow label", "", l.label || "").then(v => { if (v != null) { l.label = v.trim(); B.renderEdges(); B.commit(); } }); return; }
  if (!o) { const p = B.toWorld(e.clientX, e.clientY); run("new-note", p); return; }
  if (isUI(t) && !t.closest(".txt")) return;
  const f = t.closest(".txt[data-f]"); B.select([o.id]); B.edit(o, f ? f.dataset.f : null, { x: e.clientX, y: e.clientY });
});
// wheel: mouse wheel zooms, touchpad scroll pans, pinch (ctrl) zooms
vp.addEventListener("wheel", e => {
  if (e.target.closest(".panel,.fctl")) return; e.preventDefault();
  const mode = ls.get("wheel", "auto"), mouse = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
  if (e.ctrlKey || (mode === "zoom") || (mode === "auto" && mouse && !e.shiftKey)) B.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey && !mouse ? 0.01 : 0.0015)), e.clientX, e.clientY);
  else { B.view.x -= e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX; B.view.y -= e.shiftKey && !e.deltaX ? 0 : e.deltaY; B.applyView(); viewDirty(); }
}, { passive: false });

// ---------- clipboard and files ----------
let clip = null;
B.copy = function (cut) {
  const sel = B.selected(); if (!sel.length) return; const ids = new Set(sel.map(o => o.id));
  if (PW.map) sel.forEach(o => PW.map.descendants(o.id).forEach(d => ids.add(d)));
  const objs = all().filter(o => ids.has(o.id)); clip = { objs: JSON.parse(JSON.stringify(objs)), links: B.doc.links.filter(l => ids.has(l.a) && ids.has(l.b)).map(l => ({ ...l })), text: objs.map(B.textOf).filter(Boolean).join("\n\n"), t: Date.now() };
  try { navigator.clipboard.writeText(clip.text || " ").catch(() => { }); } catch (e) { }
  if (cut) B.remove([...ids]); else toast(objs.length + " copied");
};
B.pasteObjs = function (src, dx = 30, dy = 30, asCopy = true) {
  const map = {}, made = [];
  for (const o of src.objs) { const n = JSON.parse(JSON.stringify(o)); map[o.id] = n.id = B.id(); n.x += dx; n.y += dy;
    if (asCopy && (n.type === "def" || n.type === "q")) { n.copy = true; n.of = o.copy ? o.of : o.id; }
    made.push(n); }
  for (const n of made) { if (n.parent) n.parent = map[n.parent] || undefined; if (!n.parent) delete n.parent; B.doc.objects.push(n); B.objs.set(n.id, n); B.render(n); }
  for (const l of src.links) B.doc.links.push({ ...l, id: "l" + (B.nextId++), a: map[l.a], b: map[l.b] });
  B.zorder(); B.renderEdges(); B.select(made.filter(n => !n.parent || !map[Object.keys(map).find(k => map[k] === n.parent)]).map(n => n.id)); B.commit(); return made;
};
B.textOf = o => { const T = B.types[o.type]; return T && T.text ? T.text(o) : ""; };
document.addEventListener("paste", async e => {
  if (B.editing || (e.target && e.target.closest && e.target.closest("input,textarea,.dlg"))) return;
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) { e.preventDefault(); PW.files.insert(files, PW.mouseWorld()); return; }
  const text = e.clipboardData?.getData("text/plain") || "";
  if (clip && (text === clip.text || text === " " || !text)) { e.preventDefault(); const p = PW.mouseWorld(), b = B.bounds(clip.objs.map(o => ({ ...o, id: "__" }))) || { x0: clip.objs[0].x, y0: clip.objs[0].y };
    B.pasteObjs(clip, Math.round(p.x - (clip.objs[0] ? clip.objs[0].x : 0)), Math.round(p.y - (clip.objs[0] ? clip.objs[0].y : 0))); return; }
  if (/^\s*[\[{]/.test(text) && PW.pasteJSON && PW.pasteJSON(text.trim(), PW.mouseWorld())) { e.preventDefault(); return; }
  if (PW.table && PW.table.looksLike(text)) { e.preventDefault(); PW.table.fromText(text, PW.mouseWorld()); return; }
  if (text.trim()) { e.preventDefault(); const cur = B.cur();
    if (PW.map && cur && /\n/.test(text.trim())) { PW.map.pasteOutline(text, cur); return; }
    const p = PW.mouseWorld(); B.add({ type: "note", x: Math.round(p.x), y: Math.round(p.y), w: 280, text: text.trim(), color: "yellow" }); }
});
let dragN = 0;
const dz = h("div", { class: "dropzone", hidden: true }, h("div", { class: "bevel", style: { padding: "12px 24px", fontWeight: "bold" }, text: "drop here" })); document.body.append(dz);
addEventListener("dragenter", e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { dragN++; dz.hidden = false; e.preventDefault(); } });
addEventListener("dragover", e => { if (!dz.hidden) e.preventDefault(); });
addEventListener("dragleave", () => { if (--dragN <= 0) { dragN = 0; dz.hidden = true; } });
addEventListener("drop", e => { e.preventDefault(); dragN = 0; dz.hidden = true; const f = [...(e.dataTransfer?.files || [])]; if (f.length) PW.files.insert(f, B.toWorld(e.clientX, e.clientY)); });

// ---------- object types (notes, cards, nodes, frames, pictures) ----------
const COLORS = ["yellow", "green", "blue", "pink", "grey", "white", "none"];
function fieldsSet(o, e) { e.querySelectorAll(".txt[data-f]").forEach(t => { if (B.editing && B.editing.t === t) return; setRich(t, o[t.dataset.f] || ""); }); }
function chipFor(o, e) {
  let c = e.querySelector(":scope .refchip"); const host = e.querySelector(".srcline") || e;
  if (!o.ref) { if (c) c.remove(); return; }
  const pdf = obj(o.ref.pdf), label = (pdf ? (pdf.name || "pdf").replace(/\.pdf$/i, "") : "pdf") + " p." + o.ref.page;
  if (!c) { c = h("span", { class: "chip refchip nodrag", title: "show in the PDF" }); c.addEventListener("click", ev => { ev.stopPropagation(); PW.pdf.goto(o.ref, o.refText); }); host.append(c); }
  if (c.textContent !== label) c.textContent = label;
}
function boxesStr(o) { return "■".repeat(o.box || 0) + "□".repeat(5 - (o.box || 0)); }
B.types.note = {
  editField: "text", minW: 60,
  create: o => h("div", { class: "note" }, h("div", { class: "txt", "data-f": "text", "data-ph": "…" }), h("div", { class: "srcline" }), h("div", { class: "ew" })),
  update(o, e) { e.className = e.className.replace(/\bc-\S+|\bh[12]\b/g, "").trim(); e.classList.add("c-" + (o.color || "yellow")); if (o.style) e.classList.add(o.style); fieldsSet(o, e); chipFor(o, e);
    if (!e._rot) { let hsh = 0; for (const ch of String(o.id)) hsh = (hsh * 31 + ch.charCodeAt(0)) | 0; e._rot = 1; e.style.setProperty("--rot", (((hsh >>> 0) % 9) - 4) * .45 + "deg"); } },
  text: o => o.text || "",
};
B.types.def = {
  editField: "term", minW: 180,
  create: o => {
    const e = h("div", { class: "card def" },
      h("div", { class: "hd" }, h("span", { class: "lbl" }), h("span", { class: "sp" }), h("span", { class: "boxes" })),
      h("div", { class: "bd" }, h("div", { class: "term" }, h("div", { class: "txt", "data-f": "term", "data-ph": "term" })), h("div", { class: "dd" }, h("div", { class: "txt", "data-f": "def", "data-ph": "definition" }))),
      h("div", { class: "src srcline" }, h("span", { class: "txt", "data-f": "src", "data-ph": "" })), h("div", { class: "ew" }));
    e.querySelector(".dd").addEventListener("click", () => { if (document.body.classList.contains("cover")) e.classList.toggle("peek"); });
    return e;
  },
  update(o, e) { e.classList.toggle("copy", !!o.copy); e.querySelector(".lbl").textContent = o.copy ? "DEF · copy" : "DEF"; const src = o.copy && obj(o.of) || o;
    const b = e.querySelector(".boxes"); b.textContent = o.copy ? "" : boxesStr(src); b.classList.toggle("due", !o.copy && src.reps > 0 && isDue(src)); fieldsSet(o, e); chipFor(o, e);
    e.querySelector(".src").hidden = !(o.src || o.ref || (B.editing && B.editing.o === o)); if (o.sc && o.sc !== 1) e.style.fontSize = (13.5 * o.sc) + "px"; },
  text: o => [o.term, o.def].filter(Boolean).join(": "),
};
const QT = ["concept", "why", "method", "theorem", "example"];
B.types.q = {
  editField: "q", minW: 200,
  create: o => {
    const e = h("div", { class: "card q" },
      h("div", { class: "hd" }, h("span", { class: "qt nodrag" }), h("span", { class: "sp" }), h("span", { class: "boxes" })),
      h("div", { class: "qq" }, h("div", { class: "txt", "data-f": "q", "data-ph": "question" })),
      h("div", { class: "qa" }, h("div", { class: "txt", "data-f": "a", "data-ph": "answer" })),
      h("div", { class: "qbtns" }, h("button", { class: "b show" }, "show"), h("button", { class: "b again", hidden: true }, "again"), h("button", { class: "b knew", hidden: true }, "knew it")),
      h("div", { class: "src srcline" }, h("span", { class: "txt", "data-f": "src" })), h("div", { class: "ew" }));
    e.querySelector(".qt").addEventListener("click", ev => { ev.stopPropagation(); const o2 = obj(e.dataset.id); o2.qt = QT[(QT.indexOf(o2.qt) + 1) % QT.length]; B.render(o2); B.commit(); });
    e.querySelector(".show").addEventListener("click", () => { e.classList.add("open"); B.render(obj(e.dataset.id)); });
    const rate = good => { const o2 = obj(e.dataset.id), src = o2.copy && obj(o2.of) || o2; PW.study.rate(src, good); e.classList.remove("open"); B.render(o2); B.commit(); toast(good ? "next in " + BOX_DAYS[src.box] + " d" : "comes back soon"); };
    e.querySelector(".again").addEventListener("click", () => rate(false)); e.querySelector(".knew").addEventListener("click", () => rate(true));
    return e;
  },
  update(o, e) { const qt = o.qt || "concept", q = e.querySelector(".qt"); q.textContent = qt.toUpperCase(); q.style.color = `var(--b${QT.indexOf(qt) + 1})`;
    const src = o.copy && obj(o.of) || o, b = e.querySelector(".boxes"); b.textContent = o.copy ? "copy" : boxesStr(src); b.classList.toggle("due", !o.copy && src.reps > 0 && isDue(src));
    const open = e.classList.contains("open"); e.querySelector(".show").hidden = open; e.querySelector(".again").hidden = e.querySelector(".knew").hidden = !open || !!B.editing;
    fieldsSet(o, e); chipFor(o, e); e.querySelector(".src").hidden = !(o.src || o.ref || (B.editing && B.editing.o === o)); },
  text: o => [o.q, o.a].filter(Boolean).join(" — "),
};
B.types.node = {
  editField: "text", minW: 40,
  create: o => h("div", { class: "node" }, h("div", { class: "nrow" }, h("span", { class: "ico" }), h("div", { class: "txt", "data-f": "text", "data-ph": "…" })), h("div", { class: "srcline" })),
  update(o, e) { fieldsSet(o, e); chipFor(o, e); e.style.width = ""; e.style.maxWidth = (o.w || 320) + "px";
    const ic = e.querySelector(".ico"); ic.textContent = o.icon || ""; ic.hidden = !o.icon;
    e.className = e.className.replace(/\bsh-\S+/g, "").trim(); const sh = o.shape || (PW.map && PW.map.inheritShape(o)); if (sh && sh !== "box") e.classList.add("sh-" + sh); },
  text: o => o.text || "",
};
B.types.frame = {
  editField: "title", fixedH: true,
  create: o => h("div", { class: "frame" }, h("div", { class: "ft" }, h("span", { class: "txt", "data-f": "title", "data-ph": "frame" })), h("div", { class: "rz" })),
  update(o, e) { o.h = o.h || 400; e.style.height = o.h + "px"; fieldsSet(o, e); },
  text: o => o.title || "",
};
B.types.image = {
  fixedH: true,
  create: o => { const e = h("div", { class: "image" }, h("img", { alt: "" }), h("div", { class: "rz" })); return e; },
  update(o, e) { e.classList.toggle("bg", !!o.bg); const im = e.querySelector("img"); if (im._a !== o.asset) { im._a = o.asset; PW.store.assetURL(o.asset).then(u => im.src = u).catch(() => { im.alt = "missing picture"; }); } },
  text: () => "",
};
B.COLORS = COLORS;
