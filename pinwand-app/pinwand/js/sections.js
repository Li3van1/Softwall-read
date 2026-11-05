"use strict";
// pinwand · headings and sections: a heading owns what sits below / to the right of it (until the next heading),
// a frame owns what is inside it. The outline lists them; present and review follow them.
const SEC = PW.sections = {};
const isHead = o => o && o.type === "note" && (o.style === "h1" || o.style === "h2");
const reading = (a, b) => Math.abs(a.y - b.y) < 120 ? a.x - b.x : a.y - b.y;
const secTitle = o => texPlain(isArea(o) ? (o.title || "") : (o.text || "")).split("\n")[0].trim();
// which heading owns each item (same rule as the old course board)
SEC.owners = function () {
  const heads = all().filter(o => isHead(o) && o.style === "h1"), own = new Map();
  if (!heads.length) return own;
  const areas = all().filter(isArea), inArea = n => areas.some(a => { const b = B.box(n); return b.cx > a.x && b.cx < a.x + a.w && b.cy > a.y && b.cy < a.y + (a.h || 0); });
  for (const n of all()) { if (isHead(n) && n.style === "h1") continue; if (isArea(n) || inArea(n)) continue; let best = null, bs = 1e12;
    for (const hd of heads) { const dy = n.y - hd.y, dx = n.x - hd.x; if (dy < -20 || dx < -60) continue; const sc = dy + 2 * Math.max(0, dx); if (sc < bs) { bs = sc; best = hd; } }
    if (best) own.set(n.id, best.id); }
  return own;
};
SEC.owned = function (sec, owners) {
  if (isArea(sec)) return B.inside(sec);
  if (sec.type === "node") return [sec, ...PW.map.descendants(sec.id).map(obj)];
  if (sec.style === "h2") { // a sub-heading: what lies below it until the next heading of any level, same column
    const heads = all().filter(isHead).filter(x => x !== sec && x.y > sec.y && Math.abs(x.x - sec.x) < 400).sort((a, b) => a.y - b.y), stop = heads.length ? heads[0].y : 1e12;
    return all().filter(o => o !== sec && !isArea(o) && o.y >= sec.y - 10 && o.y < stop && o.x >= sec.x - 60 && o.x < sec.x + 1600);
  }
  owners = owners || SEC.owners(); return all().filter(o => owners.get(o.id) === sec.id);
};
// everything that counts as a section, in reading order; headings inside a frame sit under that frame
SEC.list = function () {
  const areas = all().filter(o => isArea(o) && !PW.map.isHidden(o)), heads = all().filter(isHead), owners = SEC.owners();
  const out = [], inArea = new Map(); for (const hd of heads) { const f = areas.find(a => hd.x >= a.x && hd.y >= a.y && hd.x < a.x + a.w && hd.y < a.y + (a.h || 0)); if (f) inArea.set(hd.id, f.id); }
  const subOf = new Map(); heads.forEach(hd => { if (hd.style === "h2" && !inArea.has(hd.id) && owners.has(hd.id)) subOf.set(hd.id, owners.get(hd.id)); });
  const top = areas.concat(heads.filter(hd => !inArea.has(hd.id) && !subOf.has(hd.id))).sort(reading);
  for (const t of top) { out.push({ o: t, depth: isHead(t) && t.style === "h2" ? 1 : 0 });
    if (isArea(t)) heads.filter(hd => inArea.get(hd.id) === t.id).sort(reading).forEach(hd => out.push({ o: hd, depth: hd.style === "h2" ? 2 : 1 }));
    else heads.filter(hd => subOf.get(hd.id) === t.id).sort(reading).forEach(hd => out.push({ o: hd, depth: 1 })); }
  return out;
};
SEC.bounds = function (sec, owners) { const items = [sec, ...SEC.owned(sec, owners)].filter(o => !PW.map.isHidden(o)); return items; };

// ---------- headings: H makes one, or turns selected notes into title → subtitle → normal ----------
cmd({ id: "heading", menu: "Insert", label: "Heading", key: "H", enabled: () => !!B.doc, run: p => {
  const notes = B.selected().filter(o => o.type === "note");
  if (notes.length) { const cur = notes[0].style || "", nx = cur === "" ? "h1" : cur === "h1" ? "h2" : "";
    notes.forEach(o => { if (nx) { o.style = nx; o.color = "none"; } else { delete o.style; o.color = ls.get("noteColor", "yellow"); } B.render(o); });
    B.commit(); PW.map.relayoutAll(false); toast(nx === "h1" ? "title" : nx === "h2" ? "subtitle" : "normal note"); return; }
  p = p && p.x != null ? p : PW.mouseWorld();
  B.add({ type: "note", x: Math.round(p.x), y: Math.round(p.y), w: 640, text: "", color: "none", style: "h1" }, { edit: "text" });
} });

// ---------- outline: all sections at a glance, click to go there ----------
let outlineEl = null;
SEC.toggleOutline = function (on) {
  on = on == null ? !outlineEl : on; ls.set("outline", on ? "1" : "0");
  if (!on) { if (outlineEl) { outlineEl.remove(); outlineEl = null; } document.body.classList.remove("outline-on"); return; }
  if (!outlineEl) { outlineEl = h("div", { id: "outline", class: "panel bevel" }, h("div", { class: "wt" }, h("span", { text: "outline" }), h("span", { class: "sp" }), h("button", { class: "b", title: "close", onclick: () => SEC.toggleOutline(false) }, "×")), h("div", { id: "olist", class: "sunk" }));
    document.body.append(outlineEl); outlineEl.querySelector("#olist").addEventListener("click", e => { const r = e.target.closest("[data-id]"); if (!r) return; const o = obj(r.dataset.id); if (!o) return; SEC.go(o); }); }
  document.body.classList.add("outline-on"); placeOutline(); SEC.drawOutline();
};
SEC.go = function (o) { const owners = SEC.owners(), items = SEC.bounds(o, owners); B.fit(items.length > 1 ? items : [o], 1.2); B.select([o.id]); B.flash(o.id); };
SEC.drawOutline = function () {
  if (!outlineEl) return; const box = outlineEl.querySelector("#olist"); box.innerHTML = ""; if (!B.doc) return;
  const list = SEC.list(), owners = SEC.owners();
  if (!list.length) { box.append(h("div", { class: "none", text: "no headings or frames yet — H makes a heading" })); return; }
  for (const { o, depth } of list) {
    const cards = SEC.owned(o, owners).filter(isStudy), due = cards.filter(isDue).length;
    box.append(h("div", { "data-id": o.id, class: "or d" + depth + (isArea(o) ? " fr" : "") }, h("span", { class: "t", text: secTitle(o) || (isArea(o) ? "frame" : "heading") }), h("span", { class: "n", text: due ? due + " due" : cards.length ? String(cards.length) : "" })));
  }
  markOutline();
};
function placeOutline() { const r = vp.getBoundingClientRect(); document.documentElement.style.setProperty("--vpTop", Math.round(r.top + 8) + "px"); }
addEventListener("resize", () => placeOutline()); setTimeout(placeOutline, 0);
SEC.place = placeOutline;
function markOutline() {
  if (!outlineEl || !B.doc) return; const c = B.center(); let best = null, bd = 1e18;
  outlineEl.querySelectorAll("[data-id]").forEach(r => { r.classList.remove("on"); const o = obj(r.dataset.id); if (!o) return; const b = B.box(o);
    const inside = isArea(o) && c.x >= o.x && c.x <= o.x + o.w && c.y >= o.y && c.y <= o.y + (o.h || 0); const d = inside ? -1 : Math.hypot(b.cx - c.x, (b.y - c.y) * 1.5); if (d < bd) { bd = d; best = r; } });
  best && best.classList.add("on");
}
const drawSoon = debounce(() => SEC.drawOutline(), 300), markSoon = debounce(markOutline, 120);
const pc = B.onChange; B.onChange = () => { pc && pc(); if (outlineEl) drawSoon(); };
const pvw = B.onView; B.onView = () => { pvw && pvw(); if (outlineEl) markSoon(); };
cmd({ id: "outline", menu: "View", label: "Outline (headings and frames)", key: "O", check: () => !!outlineEl, run: () => SEC.toggleOutline() });
cmd({ id: "sec-next", menu: "View", label: "Next section", key: "PgDn", enabled: () => !!B.doc, run: () => SEC.step(1), hide: true });
cmd({ id: "sec-prev", menu: "View", label: "Previous section", key: "PgUp", enabled: () => !!B.doc, run: () => SEC.step(-1), hide: true });
SEC.step = function (d) { const list = SEC.list().filter(x => x.depth === 0); if (!list.length) return; const c = B.center();
  let i = list.findIndex(x => { const b = B.box(x.o); return b.y > c.y + 40 || (Math.abs(b.y - c.y) < 40 && b.x > c.x + 40); }); if (i < 0) i = list.length;
  const j = d > 0 ? i : i - 2; const t = list[clamp(j, 0, list.length - 1)]; if (t) SEC.go(t.o); };
// the outline comes back where it was left
setTimeout(() => { if (ls.get("outline", "0") === "1") SEC.toggleOutline(true); }, 0);
