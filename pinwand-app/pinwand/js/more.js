"use strict";
(() => {
// pinwand · lecture pages and other helpers built from the existing pieces

// ---------- a lecture page in one click: frame, headings, definitions, map, questions, notes ----------
function nextLecture() { let n = 0; for (const o of all()) { const m = o.type === "frame" && /^\s*L\s?(\d+)/i.exec(o.title || ""); if (m) n = Math.max(n, +m[1]); } return n + 1; }
async function lecture() {
  if (!B.doc) { toast("open a board first"); return; }
  const n = nextLecture(), name = await promptDlg("Lecture page", "name of the lecture", "L" + String(n).padStart(2, "0") + " · ");
  if (!name || !name.trim() || /^L\d+\s*·\s*$/.test(name.trim())) return;
  const title = name.trim(), m = /^(L\s?\d+)\s*[·:\-–]?\s*(.*)$/i.exec(title), short = m ? m[1].replace(/\s/g, "") : title.slice(0, 20), topic = (m && m[2]) || title;
  const b = B.bounds(all()), x = b ? Math.round(b.x0) : 0, y = b ? Math.round(b.y1 + 140) : 0;
  const add = o => B.add(o, { select: false, commit: false });
  const f = add({ type: "frame", x, y, w: 1560, h: 1080, title });
  add({ type: "note", x: x + 40, y: y + 56, w: 400, text: "Definitions", style: "h2", color: "none" });
  const d1 = add({ type: "def", x: x + 40, y: y + 112, w: 420, term: "", def: "", src: short });
  add({ type: "def", x: x + 40, y: y + 320, w: 420, term: "", def: "", src: short });
  add({ type: "note", x: x + 520, y: y + 56, w: 400, text: "Map", style: "h2", color: "none" });
  add({ type: "node", x: x + 600, y: y + 330, w: 320, text: topic });
  add({ type: "note", x: x + 40, y: y + 600, w: 400, text: "Questions", style: "h2", color: "none" });
  add({ type: "q", x: x + 40, y: y + 656, w: 420, qt: "why", q: "", a: "", src: short });
  add({ type: "q", x: x + 40, y: y + 860, w: 420, qt: "method", q: "", a: "", src: short });
  add({ type: "note", x: x + 1120, y: y + 56, w: 400, text: "Notes", style: "h2", color: "none" });
  add({ type: "note", x: x + 1120, y: y + 112, w: 240, text: "", color: "yellow" });
  add({ type: "note", x: x + 1120, y: y + 360, w: 240, text: "ask in the tutorial:\n- [ ] ", color: "pink" });
  B.zorder(); PW.map && PW.map.relayoutAll(false); B.renderEdges(); B.commit();
  B.fit([f], 1); setTimeout(() => { B.select([d1.id]); B.edit(d1, "term"); }, 320);
  toast("“" + title + "”: start with the first definition (Tab moves on)");
}
cmd({ id: "lecture", menu: "Insert", label: "Lecture page…", run: lecture, sep: true });

const MORE = PW.more = {};
const titleOf = o => texPlain(isArea(o) ? o.title || "" : o.text || "").split("\n")[0].trim().slice(0, 60) || "(untitled)";
async function saveText(name, text, type, desc, ext) {
  try { if (window.showSaveFilePicker) { const fh = await showSaveFilePicker({ suggestedName: name, types: [{ description: desc, accept: { [type]: [ext] } }] }); const w = await fh.createWritable(); await w.write(text); await w.close(); toast("saved " + fh.name); return; } }
  catch (e) { if (e.name === "AbortError") return; }
  const a = h("a", { href: URL.createObjectURL(new Blob([text], { type })), download: name }); document.body.append(a); a.click(); a.remove(); toast("saved to Downloads");
}
const fileSafe = s => String(s || "board").replace(/[\\/:*?"<>|]+/g, "-").trim();

// ---------- start page: what is due today, section by section ----------
// boards kept only inside the browser can be lost with the browser data: say so on the start page
async function homeNote() {
  const n = $("hnote"); if (!n) return; n.innerHTML = ""; const risky = PW.store.kind === "opfs" && !window.PW_DEMO && PW.store.name === "app storage";
  if (risky) n.append(h("div", {}, h("span", { text: "Your boards live only inside the browser (app storage). Clearing the browser data or removing the app would delete them. " }),
    h("button", { class: "b", onclick: () => $("hWs").click() }, "keep them in a folder…"), h("span", { text: " (everything is copied; a OneDrive folder also backs them up)" })));
  // another, older pinwand on the same address shares the boards and could save them the old way
  let others = []; try { const mine = new URL(".", location.href).href; others = (await navigator.serviceWorker.getRegistrations()).map(r => r.scope).filter(sc => /pinwand/i.test(sc) && sc !== mine && !mine.startsWith(sc)); } catch (e) { }
  if (others.length) n.append(h("div", { text: "Another pinwand is installed at " + others.join(", ") + ". It shares your boards and may save them the old way: delete that copy on GitHub and uninstall that app (Edge: … › Apps)." }));
  n.hidden = !n.childNodes.length;
}
MORE.drawDue = function (box) {
  homeNote();
  const hh = box.previousElementSibling; box.innerHTML = "";
  const cards = B.doc ? all().filter(isStudy) : []; if (!cards.length) { box.hidden = true; if (hh) hh.hidden = true; return; }
  box.hidden = false; if (hh) { hh.hidden = false; hh.textContent = "due today in “" + (B.doc.name || "board") + "”"; }
  const row = (label, c, sc) => { const n = c.filter(isDue).length, r = h("div", { class: "r" + (n ? "" : " zero") }, h("span", { class: "nm", text: label }), h("span", { class: "m", text: n ? n + " due" : "nothing due" }), h("span", { class: "m", text: c.length + (c.length === 1 ? " card" : " cards") }));
    r.onclick = () => { PW.hideHome(); ls.set("rvscope", sc); run("review"); }; return r; };
  box.append(row("whole board", cards, "all"));
  const owners = PW.sections.owners();
  for (const s of PW.sections.list()) { const ids = new Set(PW.sections.owned(s.o, owners).map(o => o.id)), c = cards.filter(o => ids.has(o.id)); if (c.length) box.append(row("   ".repeat(s.depth) + titleOf(s.o), c, "f:" + s.o.id)); }
};

// ---------- cards for Anki: a tab separated text file with formulas for MathJax ----------
function ankiField(s) {
  const math = []; s = String(s || "").replace(/\$\$([\s\S]+?)\$\$/g, (m, x) => { math.push("\\[" + x + "\\]"); return "\u0000" + (math.length - 1) + "\u0000"; }).replace(/\$((?:\\\$|[^$\n])+?)\$/g, (m, x) => { math.push("\\(" + x + "\\)"); return "\u0000" + (math.length - 1) + "\u0000"; });
  return inlineMd(s).replace(/\n/g, "<br>").replace(/\u0000(\d+)\u0000/g, (m, i) => escHTML(math[+i])).replace(/\t/g, " ");
}
const tag = s => texPlain(s || "").trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_:.-]/gu, "").slice(0, 40);
MORE.anki = async function () {
  if (!B.doc) return; const cards = all().filter(isStudy); if (!cards.length) { toast("no definitions or questions on this board"); return; }
  const owners = PW.sections.owners(), secOf = new Map(); for (const s of PW.sections.list()) for (const o of PW.sections.owned(s.o, owners)) { if (!secOf.has(o.id)) secOf.set(o.id, []); secOf.get(o.id).push(tag(titleOf(s.o))); }
  const lines = ["#separator:tab", "#html:true", "#notetype:Basic", "#deck:pinwand::" + tag(B.doc.name || "board").replace(/_/g, " "), "#tags column:3"];
  for (const o of cards) { const front = o.type === "def" ? ankiField(o.term) : ankiField(o.q), back = (o.type === "def" ? ankiField(o.def) : ankiField(o.a)) + (o.src ? "<br><small>" + escHTML(o.src) + "</small>" : "");
    const tags = ["pinwand", o.type === "def" ? "definition" : "question_" + (o.qt || "concept"), ...(secOf.get(o.id) || [])].filter(Boolean).join(" ");
    lines.push([front, back, tags].join("\t")); }
  await saveText(fileSafe(B.doc.name) + " - anki.txt", lines.join("\n") + "\n", "text/plain", "Anki import", ".txt");
};

// ---------- backups with a look before restoring ----------
const bare = o => { const c = Object.assign({}, o); delete c.x; delete c.y; delete c.due; delete c.reps; delete c.box; return JSON.stringify(c); };
MORE.backups = async function () {
  if (!B.file) return; const list = await PW.store.listBackups(B.file); if (!list.length) return alertDlg("backups", "no backups yet");
  const left = h("div", { class: "list bklist" }), view = h("div", { class: "bkview sunk" }, "choose a backup on the left"); let curN = null;
  const label = n => { const m = n.match(/-(\d{8})-(\d{6})\.json$/); return m ? `${m[1].slice(6)}.${m[1].slice(4, 6)}.${m[1].slice(0, 4)}  ${m[2].slice(0, 2)}:${m[2].slice(2, 4)}` : n; };
  list.slice(0, 40).forEach(n => left.append(h("button", { class: "b", "data-n": n }, label(n))));
  const show = async n => {
    curN = n; left.querySelectorAll("[data-n]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.n === n))); view.textContent = "…";
    let d; try { d = await PW.store.readBackup(n); } catch (e) { view.textContent = "cannot read this backup"; return; } if (curN !== n) return;
    const os = d.objects || [], A = new Map(os.map(o => [o.id, o])), now = new Map(all().map(o => [o.id, o]));
    const back = os.filter(o => !now.has(o.id)), lost = all().filter(o => !A.has(o.id)), changed = os.filter(o => now.has(o.id) && bare(o) !== bare(now.get(o.id)));
    const txt = o => (texPlain(B.textOf(o)) || o.type).replace(/\s+/g, " ").slice(0, 70), heads = os.filter(o => o.type === "frame" || (o.type === "note" && /h[12]/.test(o.style || ""))).map(o => texPlain(o.title || o.text || "").split("\n")[0]).filter(Boolean);
    const sec = (t, arr) => arr.length ? [h("div", { class: "bkh", text: t + " (" + arr.length + ")" }), ...arr.slice(0, 8).map(o => h("div", { class: "bki", text: "· " + txt(o) })), ...(arr.length > 8 ? [h("div", { class: "bki", text: "…" })] : [])] : [];
    view.innerHTML = ""; view.append(h("div", { class: "bkh", text: label(n) + " · " + os.length + " items · " + os.filter(isStudy).length + " cards" }), heads.length ? h("div", { class: "bki", text: heads.slice(0, 12).join(" · ") }) : null,
      ...(back.length + lost.length + changed.length ? [...sec("comes back", back), ...sec("made since — would go", lost), ...sec("changed since", changed)] : [h("div", { class: "bkh", text: "same as now" })]));
  };
  left.addEventListener("click", e => { const b = e.target.closest("[data-n]"); if (b) show(b.dataset.n); });
  const v = await dialog({ title: "backups of “" + (B.doc.name || "board") + "”", body: h("div", { class: "bkwrap" }, left, view), width: "min(860px,calc(100vw - 20px))", buttons: [{ label: "close", value: null }, { label: "restore this backup", value: () => curN, def: true }], init: () => show(list[0]) });
  if (!v) return; if (!(await confirmDlg("restore", "replace the board with the backup of " + label(v) + "?\n(the current state is kept as a backup first)", "restore"))) return;
  await save(true); const doc = await PW.store.readBackup(v); B.load(doc, B.file); B.touch(); await save(true); afterOpen(); toast("backup restored (the state before is a backup too)");
};

// ---------- print a section: a clean page with headings, cards, notes, tables and the map ----------
const reading = (a, b) => (Math.abs(a.y - b.y) < 40 ? a.x - b.x : a.y - b.y);
function printItems(items, title, secs) {
  const wrap = h("div", { id: "printview" }), set = new Set(items.map(o => o.id)); wrap.append(h("h1", { text: title }));
  const rich = (tg, src, cls) => { const e = h(tg, { class: cls || "" }); setRich(e, src || ""); return e; };
  const tree = n => { const li = h("li"); li.append(rich("span", n.text)); const kids = PW.map.children(n.id); if (kids.length) { const ul = h("ul"); kids.sort((a, b) => a.y - b.y).forEach(k => ul.append(tree(k))); li.append(ul); } return li; };
  const blank = v => !texPlain(v || "").trim();
  const emit = o => {
    if (o.type === "note") { if (o.style === "h1") wrap.append(rich("h2", o.text)); else if (o.style === "h2") wrap.append(rich("h3", o.text)); else if (!blank(o.text)) wrap.append(rich("div", o.text, "pnote" + (o.color === "none" ? " plain" : ""))); }
    else if (o.type === "frame") wrap.append(rich("h2", o.title));
    else if (o.type === "def" && !o.copy && !(blank(o.term) && blank(o.def))) { const d = h("div", { class: "pdef" }); d.append(rich("b", o.term), h("span", { text: " — " }), rich("span", o.def)); if (o.src) d.append(h("small", { text: "  " + o.src })); wrap.append(d); }
    else if (o.type === "q" && !o.copy && !(blank(o.q) && blank(o.a))) { const d = h("div", { class: "pq" }); d.append(rich("div", o.q, "qq"), rich("div", o.a, "qa")); wrap.append(d); }
    else if (o.type === "node" && !(o.parent && set.has(o.parent))) wrap.append(h("ul", { class: "pmap" }, tree(o)));
    else if (o.type === "table") { const t = h("table"); (o.rows || []).forEach((r, i) => { const tr = h("tr"); r.forEach(c => tr.append(rich(i === 0 && o.head ? "th" : "td", c))); t.append(tr); }); wrap.append(t); }
    else if (o.type === "matrix") { const t = h("table", { class: "pmx" }); t.append(h("tr", {}, rich("td", o.q2), rich("td", o.q1)), h("tr", {}, rich("td", o.q3), rich("td", o.q4))); if (o.title) wrap.append(rich("h3", o.title)); wrap.append(t); }
    else if (o.type === "image") { const im = h("img", { alt: "" }); PW.store.assetURL(o.asset).then(u => im.src = u).catch(() => { }); wrap.append(im); }
    else if (o.type === "shape" && !blank(o.text)) wrap.append(rich("div", o.text, "pnote plain"));
    else if (o.type === "pdf") wrap.append(h("div", { class: "pnote plain", text: "PDF: " + (o.name || "") }));
  };
  // every item goes under the most specific heading that owns it, headings in reading order
  const heads = (secs || []).filter(s => set.has(s.id) || isArea(s)), owner = new Map(), owners = PW.sections.owners();
  for (const s of heads) for (const o of PW.sections.owned(s, owners)) if (set.has(o.id)) owner.set(o.id, s.id);
  const isHd = o => isArea(o) || (o.type === "note" && /^h[12]$/.test(o.style || "")), mine = id => items.filter(o => owner.get(o.id) === id && !isHd(o) && !(o.parent && owner.get(o.parent) === id)).sort(reading);
  items.filter(o => !owner.has(o.id) && !isHd(o) && !(o.parent && set.has(o.parent))).sort(reading).forEach(emit);
  for (const s of heads) { emit(s); mine(s.id).forEach(emit); }
  document.querySelector("#printview")?.remove(); document.body.append(wrap); document.body.classList.add("printing");
  const done = () => { wrap.remove(); document.body.classList.remove("printing"); }; addEventListener("afterprint", done, { once: true });
  setTimeout(() => { try { window.print(); } catch (e) { done(); } }, 400);
}
MORE.print = async function () {
  if (!B.doc) return; const secs = PW.sections.list(), box = h("div", { class: "list" });
  const opts = [["all", "whole board"], ...(B.sel.size ? [["sel", "the selection (" + B.sel.size + ")"]] : []), ...secs.map(s => ["f:" + s.o.id, "   ".repeat(s.depth) + titleOf(s.o)])];
  opts.forEach(([v, l]) => box.append(h("button", { class: "b", "data-v": v, style: { height: "auto", padding: "3px 8px", textAlign: "left" } }, l)));
  const v = await dialog({ title: "print or save as PDF", body: box, width: "min(520px,calc(100vw - 20px))", buttons: [{ label: "close", value: null }], init: (d, close) => box.addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b) close(b.dataset.v); }) });
  if (!v) return;
  const order = secs.map(x => x.o);
  if (v === "all") return printItems(all(), B.doc.name || "board", order);
  if (v === "sel") { const L = B.selected().flatMap(o => [o, ...(isArea(o) ? B.inside(o) : [])]); return printItems(L, B.doc.name || "board", order.filter(o => L.includes(o))); }
  const s = obj(v.slice(2)); if (!s) return; const L = PW.sections.owned(s).filter(o => o !== s); printItems(L, titleOf(s), order.filter(o => L.includes(o)));
};

cmd({ id: "export-anki", menu: "File", label: "Export cards for Anki…", run: () => MORE.anki() });
cmd({ id: "print", menu: "File", label: "Print or save a section as PDF…", key: "Ctrl+P", run: () => MORE.print() });

// ---------- big boards: items far off screen are not painted; the board layer stays on the graphics card while it moves ----------
const vpEl = $("viewport"), worldEl = $("world"); let cullT = 0, wheelT = 0;
function cull() {
  if (!B.doc) return; const r = vpEl.getBoundingClientRect(); if (!r.width) return;
  const z = B.view.z, m = 500 / z, x0 = -B.view.x / z - m, y0 = -B.view.y / z - m, x1 = (r.width - B.view.x) / z + m, y1 = (r.height - B.view.y) / z + m, list = all(), out = [];
  for (const o of list) { const e = B.el(o.id); if (!e) continue; out.push([e, B.sel.has(o.id) || (B.editing && B.editing.o === o) ? false : (o.x > x1 || o.y > y1 || o.x + (e.offsetWidth || o.w || 200) < x0 || o.y + (e.offsetHeight || o.h || 200) < y0)]); }
  let shown = false; for (const [e, off] of out) if (off !== e.classList.contains("off")) { e.classList.toggle("off", off); if (!off && e.classList.contains("pdf")) shown = true; } // all sizes read first, then classes set: one layout
  if (shown) PW.pdf.onView();
}
let lastCull = 0; const cullSoon = () => { clearTimeout(cullT); const now = performance.now(); if (now - lastCull > 120) { lastCull = now; cull(); } else cullT = setTimeout(() => { lastCull = performance.now(); cull(); }, 120); };
MORE.cull = cull; MORE.uncull = () => document.querySelectorAll("#world .obj.off").forEach(e => e.classList.remove("off"));
const ov = B.onView; B.onView = () => { ov && ov(); cullSoon(); };
const cm0 = B.commit; B.commit = function () { const r = cm0.apply(this, arguments); cullSoon(); return r; };
const ra0 = B.renderAll; B.renderAll = function () { const r = ra0.apply(this, arguments); cullSoon(); return r; };
vpEl.addEventListener("wheel", () => { vpEl.classList.add("wheeling"); clearTimeout(wheelT); wheelT = setTimeout(() => vpEl.classList.remove("wheeling"), 220); }, { passive: true, capture: true });
// a text box left empty disappears again
const ee0 = B.endEdit; B.endEdit = function () { const ed = B.editing; const r = ee0.apply(this, arguments); if (ed && ed.o.type === "note" && ed.o.color === "none" && !ed.o.style && !String(ed.o.text || "").trim() && B.objs.get(ed.o.id) === ed.o) B.remove([ed.o.id]); return r; };
const bk = PW.cmds.get("backups"); if (bk) { bk.label = "Backups (look and restore)…"; bk.run = () => MORE.backups(); }

})();
