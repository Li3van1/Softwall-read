"use strict";
// pinwand · study: spaced review of definitions and questions, palace walks, map recall, covering definitions
const STUDY = PW.study = {};
STUDY.rate = function (o, good) {
  if (!good && (o.reps || 0) > 0) o.lap = (o.lap || 0) + 1; o.reps = (o.reps || 0) + 1; o.seen = Date.now();
  if (good) { o.box = Math.min(5, (o.box || 0) + 1); o.due = Date.now() + BOX_DAYS[o.box] * DAY - 3 * 36e5; } else { o.box = 0; o.due = Date.now(); }
  all().forEach(c => { if (c.copy && c.of === o.id) { const e = B.el(c.id); e && B.render(c); } });
};
STUDY.dueCount = () => all().filter(o => isStudy(o) && isDue(o)).length;

// ---------- review ----------
function scopeList() {
  const frames = all().filter(o => isArea(o) && (o.title || "").trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  return [["all", "whole board"], ...(B.sel.size > 1 ? [["sel", `selection (${B.selected().filter(isStudy).length})`]] : []), ...frames.map(f => ["f:" + f.id, texPlain(f.title).slice(0, 40)])];
}
function scopeCards(sc) {
  let L = all().filter(isStudy);
  if (sc === "sel") { const s = new Set(B.sel); L = L.filter(o => s.has(o.id)); }
  else if (sc.startsWith("f:")) { const f = obj(sc.slice(2)); if (f) { const ids = new Set(B.inside(f).map(o => o.id)); L = L.filter(o => ids.has(o.id)); } }
  return L;
}
STUDY.review = function () {
  B.endEdit(); const scopes = scopeList(); let sc = ls.get("rvscope", "all"); if (!scopes.some(s => s[0] === sc)) sc = B.sel.size > 1 ? "sel" : "all";
  let q = [], cur = null, shown = false, good = 0, again = 0, allCards = false;
  const sel = h("select", { class: "f" }, scopes.map(([v, l]) => h("option", { value: v, text: l }))); sel.value = sc;
  const chk = h("input", { type: "checkbox" }), cnt = h("span", { class: "mono" }), card = h("div", { id: "rvCard" });
  const bShow = h("button", { class: "b" }, "show  [space]"), bAgain = h("button", { class: "b" }, "again  [1]"), bGood = h("button", { class: "b" }, "knew it  [2]"), bLoc = h("button", { class: "b" }, "on board");
  const body = h("div", { style: { display: "grid", gap: "8px" } }, h("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } }, sel, h("label", { style: { display: "flex", gap: "4px", alignItems: "center" } }, chk, "all cards, not only due"), h("span", { style: { flex: 1 } }), cnt),
    card, h("div", { style: { display: "flex", gap: "6px", justifyContent: "center" } }, bShow, bAgain, bGood, bLoc));
  const start = () => { sc = sel.value; ls.set("rvscope", sc); allCards = chk.checked; q = scopeCards(sc).filter(o => allCards || isDue(o)).sort((a, b) => (a.box || 0) - (b.box || 0) || Math.random() - .5); good = again = 0; next(); };
  const next = () => {
    cur = q.shift() || null; shown = false; card.innerHTML = "";
    if (!cur) { const left = scopeCards(sc).filter(o => !isDue(o)).map(o => o.due).sort((a, b) => a - b)[0];
      card.append(h("div", { style: { fontWeight: "bold" }, text: good + again ? `done · ${good} knew it · ${again} again` : "nothing due" }), left ? h("div", { class: "meta", text: "next due in " + Math.max(1, Math.round((left - Date.now()) / DAY)) + " d" }) : null);
      bShow.hidden = bAgain.hidden = bGood.hidden = bLoc.hidden = true; cnt.textContent = ""; return; }
    cnt.textContent = (q.length + 1) + " left"; bShow.hidden = false; bAgain.hidden = bGood.hidden = true; bLoc.hidden = false;
    const meta = [cur.type === "q" ? (cur.qt || "concept").toUpperCase() : "DEFINITION", cur.src || (cur.ref && obj(cur.ref.pdf) ? obj(cur.ref.pdf).name + " p." + cur.ref.page : "")].filter(Boolean).join(" · ");
    const Q = h("div"); setRich(Q, cur.type === "q" ? cur.q : cur.term); Q.style.fontWeight = "bold"; card.append(h("div", { class: "meta", text: meta }), Q);
  };
  const reveal = () => { if (!cur || shown) return; shown = true; const A = h("div", { class: "ans" }); setRich(A, cur.type === "q" ? cur.a : cur.def); card.append(A); bShow.hidden = true; bAgain.hidden = bGood.hidden = false; };
  const rate = g => { if (!cur || !shown) return; STUDY.rate(cur, g); B.render(cur); if (g) good++; else { again++; q.splice(Math.min(3, q.length), 0, cur); } B.commit(); updDue(); next(); };
  bShow.onclick = reveal; bAgain.onclick = () => rate(false); bGood.onclick = () => rate(true); sel.onchange = start; chk.onchange = start;
  dialog({ title: "review", body, buttons: [{ label: "close", value: null }], width: "min(700px,calc(100vw - 20px))",
    onKey: (e, close) => { if (e.target === sel) return false; if (e.key === " " || (e.key === "Enter" && !shown)) { e.preventDefault(); reveal(); return true; } if (e.key === "1") { rate(false); return true; } if (e.key === "2") { rate(true); return true; } return false; },
    init: (dlg, close) => { bLoc.onclick = () => { const c = cur; close(); if (c) { B.select([c.id]); B.reveal(c); B.flash(c.id); } }; start(); setTimeout(() => bShow.focus(), 30); } });
};
function updDue() { const n = STUDY.dueCount(); $("dueN").textContent = n ? n : ""; $("sDue").textContent = n ? n + " due" : ""; }
STUDY.updDue = updDue;

// ---------- walk: palace route (arrows) or map recall (branches) ----------
let walk = null;
function routeFrom(o) {
  const seen = new Set(), out = []; const go = n => { if (!n || seen.has(n.id)) return; seen.add(n.id); out.push(n); const c = B.box(n);
    B.doc.links.filter(l => l.a === n.id).map(l => obj(l.b)).filter(Boolean).sort((p, q) => { const a = B.box(p), b = B.box(q); return Math.hypot(a.cx - c.cx, a.cy - c.cy) - Math.hypot(b.cx - c.cx, b.cy - c.cy); }).forEach(go); };
  go(o); return out;
}
function treeFrom(o) { const out = []; const go = n => { out.push(n); PW.map.children(n.id).sort((a, b) => (a.side === "l") - (b.side === "l") || a.y - b.y).forEach(go); }; go(o); return out; }
STUDY.walk = function () {
  const o = B.cur(); if (!o) return toast("select the first spot of a route, or a map branch");
  let seq, kind;
  if (B.doc.links.some(l => l.a === o.id)) { seq = routeFrom(o); kind = "route"; }
  else if (PW.map.children(o.id).length) { seq = treeFrom(o); kind = "map"; if (o.collapsed) PW.map.toggle(o); seq.forEach(n => { if (n.collapsed) { n.collapsed = false; } }); B.renderAll(); PW.map.layout(PW.map.rootOf(o)); }
  else return toast("no arrows or branches start here");
  if (seq.length < 2) return toast("nothing to walk");
  walk = { seq, i: 0, shown: new Set(kind === "map" ? [seq[0].id] : []), kind, good: 0, again: 0 };
  const bar = h("div", { id: "walkbar", class: "bevel" }, h("b", { id: "wkPos" }), h("span", { id: "wkMsg" }), h("button", { class: "b", onclick: STUDY.endWalk }, "end"));
  document.body.append(bar); go(kind === "map" ? 1 : 0);
};
function apply() {
  const ids = walk ? new Map(walk.seq.map((n, k) => [n.id, k])) : null;
  document.querySelectorAll(".obj.covered,.obj.walkcur").forEach(e => e.classList.remove("covered", "walkcur"));
  if (!walk) return; walk.seq.forEach((n, k) => { const e = B.el(n.id); if (!e) return; if (!walk.shown.has(n.id)) e.classList.add("covered"); if (k === walk.i) e.classList.add("walkcur"); });
}
function go(i) { if (!walk) return; walk.i = clamp(i, 0, walk.seq.length - 1); const n = walk.seq[walk.i]; B.select([n.id]); B.reveal(n, Math.max(B.view.z, .5)); apply(); bar(); }
function bar() { if (!walk) return; const n = walk.seq[walk.i], card = isStudy(n) || (n.copy && obj(n.of)); $("wkPos").textContent = `${walk.kind} ${walk.i + 1}/${walk.seq.length}`; $("wkMsg").textContent = !walk.shown.has(n.id) ? "space: show" : card ? "1 again · 2 knew it · → next" : "→ next"; }
STUDY.endWalk = function () { if (!walk) return; const w = walk; walk = null; apply(); const b = $("walkbar"); b && b.remove(); B.commit(); if (w.good + w.again) toast(`${w.good} knew it · ${w.again} again`); };
STUDY.walkKey = function (e) {
  if (!walk) return false; const k = e.key;
  if (k === "Escape") { STUDY.endWalk(); return true; }
  if (k === " " || k === "Enter") { walk.shown.add(walk.seq[walk.i].id); apply(); bar(); return true; }
  if (k === "1" || k === "2") { const n = walk.seq[walk.i]; walk.shown.add(n.id); const src = n.copy ? obj(n.of) : isStudy(n) ? n : null; if (src) { STUDY.rate(src, k === "2"); k === "2" ? walk.good++ : walk.again++; }
    if (walk.i < walk.seq.length - 1) setTimeout(() => go(walk.i + 1), 150); else STUDY.endWalk(); return true; }
  if (k === "ArrowRight" || k === "ArrowDown" || (k === "Tab" && !e.shiftKey)) { if (walk.i >= walk.seq.length - 1) STUDY.endWalk(); else go(walk.i + 1); return true; }
  if (k === "ArrowLeft" || k === "ArrowUp" || (k === "Tab" && e.shiftKey)) { go(walk.i - 1); return true; }
  return k.length === 1;
};
STUDY.walking = () => !!walk;
STUDY.cover = function () { const on = !document.body.classList.contains("cover"); document.body.classList.toggle("cover", on); document.querySelectorAll(".def.peek").forEach(e => e.classList.remove("peek")); $("tbCover").setAttribute("aria-pressed", String(on)); };
