"use strict";
// pinwand · commands, menus, keys, boards, saving, start-up
PW.keys = { space: false };
let mouse = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener("pointermove", e => { mouse = { x: e.clientX, y: e.clientY }; }, { passive: true });
PW.mouseWorld = () => { const r = vp.getBoundingClientRect(), over = document.elementFromPoint(mouse.x, mouse.y); const inside = mouse.x > r.left && mouse.x < r.right && mouse.y > r.top && mouse.y < r.bottom && !(over && over.closest && over.closest("#dock,#ctxbar,.ctxpop,#presbar,#walkbar,#minimap,.panel")); return inside ? B.toWorld(mouse.x, mouse.y) : B.center(); };
const at = p => p && p.x != null ? p : PW.mouseWorld();
const sel1 = () => B.cur();
const has = () => !!B.doc;

// ============ commands ============
// file
cmd({ id: "boards", menu: "File", label: "Boards…", key: "Ctrl+O", run: () => showHome() });
cmd({ id: "close-tab", menu: "File", label: "Close tab", enabled: has, run: () => closeTab(B.file) });
cmd({ id: "next-tab", menu: "File", label: "Next tab", key: "Ctrl+PgDn", hide: false, enabled: () => tabs.length > 1, run: () => stepTab(1) });
cmd({ id: "prev-tab", menu: "File", label: "Previous tab", key: "Ctrl+PgUp", enabled: () => tabs.length > 1, run: () => stepTab(-1) });
cmd({ id: "new-board", menu: "File", label: "New board…", run: () => newBoardDlg() });
cmd({ id: "rename-board", menu: "File", label: "Rename board…", enabled: has, run: () => renameBoard() });
cmd({ id: "import-old", menu: "File", label: "Import old course board…", run: () => $("importIn").click() });
cmd({ id: "save", menu: "File", label: "Save", key: "Ctrl+S", enabled: has, run: () => save(true), sep: true });
cmd({ id: "autosave", menu: "File", label: "Autosave", check: () => ls.get("autosave", "1") === "1", run: () => { ls.set("autosave", ls.get("autosave", "1") === "1" ? "0" : "1"); updSave(); } });
cmd({ id: "backups", menu: "File", label: "Restore a backup…", enabled: has, run: () => backupsDlg() });
cmd({ id: "export", menu: "File", label: "Export a copy…", enabled: has, run: () => exportCopy() });
cmd({ id: "workspace", menu: "File", label: "Workspace folder…", run: () => workspaceDlg(true), sep: true });
// edit
cmd({ id: "undo", menu: "Edit", label: "Undo", key: "Ctrl+Z", enabled: () => B.hist.length > 1, run: () => B.undo() });
cmd({ id: "redo", menu: "Edit", label: "Redo", key: "Ctrl+Y", enabled: () => B.redo.length > 0, run: () => B.redoIt() });
cmd({ id: "cut", menu: "Edit", label: "Cut", key: "Ctrl+X", enabled: () => B.sel.size > 0, run: () => B.copy(true), sep: true });
cmd({ id: "copy", menu: "Edit", label: "Copy", key: "Ctrl+C", enabled: () => B.sel.size > 0, run: () => B.copy(false) });
cmd({ id: "dup", menu: "Edit", label: "Duplicate (palace copy)", key: "Ctrl+D", enabled: () => B.sel.size > 0, run: () => { B.copy(false); const c = B.selected(); B.pasteObjs({ objs: JSON.parse(JSON.stringify(c)), links: [] }, 30, 30, true); } });
cmd({ id: "delete", menu: "Edit", label: "Delete", key: "Del", enabled: () => B.sel.size > 0 || !!B.selLink, run: () => { if (B.selLink) { B.doc.links = B.doc.links.filter(l => l.id !== B.selLink); B.selLink = null; B.renderEdges(); B.commit(); B.updSel(); return; } B.remove([...B.sel]); } });
cmd({ id: "selall", menu: "Edit", label: "Select all", key: "Ctrl+A", run: () => B.select(all().filter(o => !PW.map.isHidden(o)).map(o => o.id)) });
cmd({ id: "edit", menu: "Edit", label: "Edit text", key: "F2", enabled: () => !!sel1(), run: () => B.edit(sel1()), sep: true });
B.COLORS.forEach((c, i) => cmd({ id: "color-" + c, menu: "Edit", sub: "Color", label: c, key: i < 6 ? "Alt+" + (i + 1) : "", enabled: () => B.selected().some(o => o.type === "note"), run: () => { B.selected().forEach(o => { if (o.type === "note") { o.color = c; B.render(o); } }); B.commit(); } }));
cmd({ id: "style-h1", menu: "Edit", sub: "Text style", label: "big heading", run: () => setStyle("h1") });
cmd({ id: "style-h2", menu: "Edit", sub: "Text style", label: "heading", run: () => setStyle("h2") });
cmd({ id: "style-none", menu: "Edit", sub: "Text style", label: "normal", run: () => setStyle(undefined) });
cmd({ id: "bg", menu: "Edit", label: "Picture as background", enabled: () => B.selected().some(o => o.type === "image"), check: () => !!(sel1() && sel1().bg), run: () => { B.selected().forEach(o => { if (o.type === "image") { o.bg = !o.bg; B.render(o); } }); B.zorder(); B.commit(); } });
cmd({ id: "front", menu: "Edit", label: "Bring to front", enabled: () => B.sel.size > 0, run: () => { B.toFront([...B.sel]); B.commit(); } });
function setStyle(s) { B.selected().forEach(o => { if (o.type === "note") { o.style = s; if (s) o.color = "none"; B.render(o); } }); B.commit(); }
// insert
cmd({ id: "new-note", menu: "Insert", label: "Note", key: "N", enabled: has, run: p => { p = at(p); B.add({ type: "note", x: Math.round(p.x), y: Math.round(p.y), w: 240, text: "", color: "yellow" }, { edit: "text" }); } });
cmd({ id: "new-def", menu: "Insert", label: "Definition", key: "D", enabled: has, run: p => { p = at(p); B.add({ type: "def", x: Math.round(p.x), y: Math.round(p.y), w: 380, term: "", def: "" }, { edit: "term" }); } });
cmd({ id: "new-q", menu: "Insert", label: "Question", key: "Q", enabled: has, run: p => { p = at(p); B.add({ type: "q", x: Math.round(p.x), y: Math.round(p.y), w: 380, qt: "concept", q: "", a: "" }, { edit: "q" }); } });
cmd({ id: "new-node", menu: "Insert", label: "Map: new centre", key: "M", enabled: has, run: p => PW.map.newRoot(at(p)) });
cmd({ id: "new-frame", menu: "Insert", label: "Frame (around selection)", key: "F", enabled: has, run: () => newFrame() });
cmd({ id: "link", menu: "Insert", label: "Arrow from selection…", key: "L", enabled: () => !!sel1(), run: () => { PW.linkMode = sel1().id; vp.style.cursor = "crosshair"; status("click the target"); }, sep: true });
cmd({ id: "insert-file", menu: "Insert", label: "PDF or picture…", key: "I", enabled: has, run: () => $("fileIn").click(), sep: true });
cmd({ id: "new-fig-flow", menu: "Insert", sub: "Live figure", label: "1D flow", enabled: has, run: () => PW.newFig("flow") });
cmd({ id: "new-fig-map", menu: "Insert", sub: "Live figure", label: "1D map", enabled: has, run: () => PW.newFig("map") });
cmd({ id: "new-fig-plane", menu: "Insert", sub: "Live figure", label: "2D phase plane", enabled: has, run: () => PW.newFig("plane") });
// table
const tblOn = () => !!PW.table.cur();
cmd({ id: "new-table", menu: "Table", label: "New table", key: "T", enabled: has, run: p => PW.table.create(at(p)) });
cmd({ id: "tbl-row", menu: "Table", label: "Row below", key: "Ctrl+Enter", enabled: tblOn, run: () => PW.table.op(PW.table.cur(), "r+"), sep: true });
cmd({ id: "tbl-row-above", menu: "Table", label: "Row above", enabled: tblOn, run: () => PW.table.op(PW.table.cur(), "r^") });
cmd({ id: "tbl-col", menu: "Table", label: "Column right", key: "Ctrl+Shift+Enter", enabled: tblOn, run: () => PW.table.op(PW.table.cur(), "c+") });
cmd({ id: "tbl-col-left", menu: "Table", label: "Column left", enabled: tblOn, run: () => PW.table.op(PW.table.cur(), "c<") });
cmd({ id: "tbl-del-row", menu: "Table", label: "Delete row", enabled: tblOn, run: () => PW.table.op(PW.table.cur(), "r-"), sep: true });
cmd({ id: "tbl-del-col", menu: "Table", label: "Delete column", enabled: tblOn, run: () => PW.table.op(PW.table.cur(), "c-") });
cmd({ id: "tbl-up", menu: "Table", label: "Move row up", key: "Alt+Up", enabled: tblOn, run: () => PW.table.op(PW.table.cur(), "ru"), sep: true });
cmd({ id: "tbl-down", menu: "Table", label: "Move row down", key: "Alt+Down", enabled: tblOn, run: () => PW.table.op(PW.table.cur(), "rd") });
cmd({ id: "tbl-left", menu: "Table", label: "Move column left", key: "Alt+Left", enabled: tblOn, run: () => PW.table.op(PW.table.cur(), "cl") });
cmd({ id: "tbl-right", menu: "Table", label: "Move column right", key: "Alt+Right", enabled: tblOn, run: () => PW.table.op(PW.table.cur(), "cr") });
cmd({ id: "tbl-head", menu: "Table", label: "Header row", check: () => !!(PW.table.cur() && PW.table.cur().head), enabled: tblOn, run: () => PW.table.op(PW.table.cur(), "hd"), sep: true });
cmd({ id: "tbl-sort", menu: "Table", label: "Sort by this column", enabled: tblOn, run: () => PW.table.op(PW.table.cur(), "sort") });
cmd({ id: "tbl-fit", menu: "Table", label: "Fit column widths", enabled: tblOn, run: () => PW.table.op(PW.table.cur(), "fit") });
cmd({ id: "tbl-cover", menu: "Table", label: "Cover this column (test yourself)", enabled: tblOn, run: () => PW.table.op(PW.table.cur(), "cv"), sep: true });
cmd({ id: "tbl-uncover", menu: "Table", label: "Uncover all columns", enabled: () => !!(PW.table.cur() && PW.table.cur().cover && PW.table.cur().cover.length), run: () => PW.table.op(PW.table.cur(), "uncover") });
cmd({ id: "tbl-copy", menu: "Table", label: "Copy as text (Excel / Word)", enabled: tblOn, run: () => { const t = PW.table.toText(PW.table.cur()); try { navigator.clipboard.writeText(t).then(() => toast("copied"), () => { }); } catch (e) { } }, sep: true });
cmd({ id: "tbl-copy-md", menu: "Table", label: "Copy as markdown", enabled: tblOn, run: () => { const t = PW.table.toText(PW.table.cur(), true); try { navigator.clipboard.writeText(t).then(() => toast("copied"), () => { }); } catch (e) { } } });
cmd({ id: "tbl-from", menu: "Table", label: "Table from text…", enabled: has, run: () => promptDlg("table from text", "", "", true).then(v => { if (v && v.trim()) { if (!PW.table.fromText(v, B.center())) toast("needs tabs or | between cells"); } }) });
// map
const inTree = () => { const o = sel1(); return !!o; };
cmd({ id: "map-child", menu: "Map", label: "Add branch", key: "Tab", enabled: inTree, run: () => { const n = PW.map.addChild(sel1()); B.select([n.id]); B.edit(n); } });
cmd({ id: "map-sib", menu: "Map", label: "Add sibling", key: "Enter", enabled: () => !!sel1() && !!sel1().parent, run: () => { const n = PW.map.addSibling(sel1()); B.select([n.id]); B.edit(n); } });
cmd({ id: "map-toggle", menu: "Map", label: "Collapse / expand", key: "Space", enabled: () => !!sel1() && PW.map.children(sel1().id).length > 0, run: () => PW.map.toggle(sel1()) });
cmd({ id: "map-tidy", menu: "Map", label: "Tidy layout", key: "Ctrl+L", enabled: () => !!sel1() && PW.map.inTree(sel1()), run: () => { const r = PW.map.rootOf(sel1()); r.auto = true; PW.map.layout(r); B.commit(); }, sep: true });
cmd({ id: "map-auto", menu: "Map", label: "Keep tidy automatically", enabled: () => !!sel1() && PW.map.inTree(sel1()), check: () => !!sel1() && PW.map.inTree(sel1()) && PW.map.rootOf(sel1()).auto !== false, run: () => { const r = PW.map.rootOf(sel1()); r.auto = r.auto === false; if (r.auto) PW.map.layout(r); B.commit(); } });
cmd({ id: "map-detach", menu: "Map", label: "Detach from parent", key: "Shift+Tab", enabled: () => !!sel1() && !!sel1().parent, run: () => PW.map.detach(sel1()) });
cmd({ id: "map-focus", menu: "Map", label: "Focus this branch", key: ".", enabled: () => !!sel1() || !!PW.map.focusId, run: () => PW.map.focus(sel1()), sep: true });
cmd({ id: "map-outline-in", menu: "Map", label: "Paste outline…", enabled: has, run: () => promptDlg("outline → map", "", "", true).then(v => { if (v && v.trim()) PW.map.pasteOutline(v, sel1()); }) });
cmd({ id: "map-outline-out", menu: "Map", label: "Copy as outline", key: "Ctrl+Shift+C", enabled: () => !!sel1() && PW.map.inTree(sel1()), run: () => { const t = PW.map.outline(sel1()); try { navigator.clipboard.writeText(t).catch(() => { }); } catch (e) { } dialog({ title: "outline", body: t, buttons: [{ label: "OK", value: 1 }] }); } });
// study
cmd({ id: "review", menu: "Study", label: "Review", key: "R", enabled: has, run: () => PW.study.review() });
cmd({ id: "walk", menu: "Study", label: "Walk route / recall map", key: "W", enabled: () => !!sel1(), run: () => PW.study.walk() });
cmd({ id: "cover", menu: "Study", label: "Cover definitions", key: "H", check: () => document.body.classList.contains("cover"), run: () => PW.study.cover() });
// view
cmd({ id: "fit", menu: "View", label: "Fit all", key: "0", enabled: has, run: () => B.fit(all(), 1.2) });
cmd({ id: "fit-sel", menu: "View", label: "Fit selection", key: "Shift+0", enabled: () => B.sel.size > 0, run: () => B.fit(B.selected(), 2) });
cmd({ id: "zoom-in", menu: "View", label: "Zoom in", key: "+", run: () => B.zoomAt(1.25) });
cmd({ id: "zoom-out", menu: "View", label: "Zoom out", key: "-", run: () => B.zoomAt(1 / 1.25) });
cmd({ id: "zoom-100", menu: "View", label: "100 %", key: "1", run: () => B.zoomAt(1 / B.view.z), sep: true });
cmd({ id: "overview", menu: "View", label: "Overview", key: "V", check: () => !$("minimap").hidden, run: () => { $("minimap").hidden = !$("minimap").hidden; ls.set("minimap", $("minimap").hidden ? "0" : "1"); drawMini(); } });
cmd({ id: "chrome", menu: "View", label: "Hide menus", key: "Ctrl+.", check: () => document.body.classList.contains("nochrome"), run: () => { document.body.classList.toggle("nochrome"); $("chromeToggle").textContent = document.body.classList.contains("nochrome") ? "▼" : "▲"; } });
cmd({ id: "invert", menu: "View", label: "Invert PDF pages", check: () => document.body.classList.contains("invertpdf"), run: () => { document.body.classList.toggle("invertpdf"); ls.set("invert", document.body.classList.contains("invertpdf") ? "1" : "0"); }, sep: true });
PW.look.STYLES.forEach(([id, name]) => cmd({ id: "style-" + id, menu: "View", sub: "Style", label: name, check: () => PW.look.style === id, run: () => PW.look.set({ style: id }, !!(B.doc && B.doc.settings && B.doc.settings.look)) }));
["auto", "light", "dark"].forEach(t => cmd({ id: "theme-" + t, menu: "View", sub: "Light / dark", label: t, check: () => PW.look.theme === t, run: () => PW.look.set({ theme: t }) }));
cmd({ id: "appearance", menu: "View", label: "Appearance…", key: "Ctrl+Shift+A", run: () => PW.look.dialog() });
cmd({ id: "pin-tabs", menu: "View", label: "Tabs stay when menus hide", check: () => document.body.classList.contains("pintabs"), run: () => setPin(!document.body.classList.contains("pintabs")) });
["auto", "zoom", "scroll"].forEach(t => cmd({ id: "wheel-" + t, menu: "View", sub: "Mouse wheel", label: t, check: () => ls.get("wheel", "auto") === t, run: () => ls.set("wheel", t) }));
// help
cmd({ id: "palette", menu: "Help", label: "Commands…", key: "Ctrl+K", run: () => PW.search.palette() });
cmd({ id: "search", menu: "Help", label: "Search", key: "/", run: () => PW.search.focus() });
cmd({ id: "keys", menu: "Help", label: "Keys", key: "F1", run: () => keysDlg() });
cmd({ id: "about", menu: "Help", label: "About", run: () => alertDlg("pinwand", `pinwand 1.0\nworkspace: ${PW.store.name || "-"}\nboard: ${B.file || "-"}`) });

function newFrame() {
  const s = B.selected().filter(o => !isArea(o)); let f;
  if (s.length) { const b = B.bounds(s); f = { type: "frame", x: Math.round(b.x0 - 40), y: Math.round(b.y0 - 50), w: Math.round(b.x1 - b.x0 + 80), h: Math.round(b.y1 - b.y0 + 90), title: "" }; }
  else { const p = PW.mouseWorld(); f = { type: "frame", x: Math.round(p.x), y: Math.round(p.y), w: 900, h: 600, title: "" }; }
  B.add(f, { edit: "title" }); B.zorder();
}

// ============ menus ============
const menubar = $("menubar"); let openMenu = null;
function hideMenus() { if (openMenu) { openMenu.classList.remove("open"); openMenu.querySelector(".drop").remove(); openMenu = null; } }
PW.hideMenus = hideMenus; window.hideMenus = hideMenus;
function buildMenus() {
  const order = ["File", "Edit", "Insert", "Table", "Map", "Study", "View", "Help"]; menubar.innerHTML = "";
  order.forEach(m => { const mi = h("div", { class: "mi" }), b = h("button", { type: "button" }, h("u", { text: m[0] }), m.slice(1)); mi.append(b);
    b.addEventListener("click", e => { e.stopPropagation(); if (openMenu === mi) { hideMenus(); return; } hideMenus(); openDrop(mi, m); });
    b.addEventListener("mouseenter", () => { if (openMenu && openMenu !== mi) { hideMenus(); openDrop(mi, m); } }); menubar.append(mi); });
}
function openDrop(mi, m) {
  const d = h("div", { class: "drop bevel" }); const items = [...PW.cmds.values()].filter(c => c.menu === m); const subs = new Map();
  items.forEach(c => { if (c.sub) { if (!subs.has(c.sub)) { subs.set(c.sub, []); d.append(subBtn(c.sub, subs)); } subs.get(c.sub).push(c); return; } if (c.sep && d.childElementCount) d.append(h("hr")); d.append(itemBtn(c)); });
  if (m === "File" && B.recent) { const rec = B.recent.filter(r => r !== B.file).slice(0, 5); if (rec.length) { d.append(h("hr")); rec.forEach(r => d.append(h("button", { type: "button", onclick: () => { hideMenus(); openBoard(r); } }, h("span"), h("span", { text: r.replace(/\.pinwand\.json$/, "") }), h("kbd")))); } }
  mi.append(d); mi.classList.add("open"); openMenu = mi;
}
function itemBtn(c) { const en = !c.enabled || c.enabled(); const b = h("button", { type: "button", disabled: !en }, h("span", { text: c.check ? (c.check() ? "✓" : "") : "" }), h("span", { text: c.label }), h("kbd", { text: c.key || "" })); b.addEventListener("click", e => { e.stopPropagation(); hideMenus(); run(c.id); }); return b; }
function subBtn(name, subs) { const b = h("button", { type: "button" }, h("span"), h("span", { text: name }), h("kbd", { text: "▸" })); b.addEventListener("click", e => { e.stopPropagation(); const d = b.closest(".drop"); const list = subs.get(name); const box = h("div", { class: "drop bevel", style: { position: "absolute", left: "100%", top: b.offsetTop + "px" } }); list.forEach(c => box.append(itemBtn(c))); d.querySelectorAll(":scope > .drop").forEach(x => x.remove()); d.append(box); }); return b; }
document.addEventListener("pointerdown", e => { if (!e.target.closest(".mi")) hideMenus(); });
document.querySelectorAll("[data-cmd]").forEach(b => b.addEventListener("click", () => run(b.dataset.cmd)));
$("chromeToggle").addEventListener("click", () => run("chrome"));
$("fileIn").addEventListener("change", e => { const f = [...e.target.files]; e.target.value = ""; if (f.length) PW.files.insert(f, B.center()); });
$("importIn").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) importOldFile(f); });

// ============ keys ============
document.addEventListener("keydown", e => {
  if (document.querySelector(".modal")) return;
  if (e.ctrlKey && (e.key === "PageDown" || e.key === "PageUp")) { e.preventDefault(); stepTab(e.key === "PageDown" ? 1 : -1); return; }
  if (homeOn) { const c = e.ctrlKey || e.metaKey, kk = e.key.toLowerCase();
    if (e.key === "Escape" && B.doc) { e.preventDefault(); hideHome(); return; }
    if (c && kk === "k") { e.preventDefault(); run("palette"); return; } if (c && kk === "o") { e.preventDefault(); return; }
    if (!c && (e.key === "]" || e.key === "[")) { stepTab(e.key === "]" ? 1 : -1); return; }
    return; }
  if (PW.present && PW.present.on && !B.editing && !e.ctrlKey) { if (PW.present.key(e)) { e.preventDefault(); return; } }
  if (PW.study.walking() && !B.editing) { if (PW.study.walkKey(e)) { e.preventDefault(); e.stopPropagation(); } return; }
  const k = e.key, ctrl = e.ctrlKey || e.metaKey, a = document.activeElement;
  if (ctrl && k.toLowerCase() === "s") { e.preventDefault(); if (B.editing) B.endEdit(); save(true); return; }
  if (B.editing) {
    const o = B.editing.o;
    if (o.type === "table") { if (ctrl && k === "Enter") { e.preventDefault(); PW.table.op(o, e.shiftKey ? "c+" : "r+"); return; } if (e.altKey && k.startsWith("Arrow")) { e.preventDefault(); PW.table.op(o, { ArrowUp: "ru", ArrowDown: "rd", ArrowLeft: "cl", ArrowRight: "cr" }[k]); return; } if (k !== "Escape" && PW.table.key(e)) return; }
    if (k === "Escape" || (k === "Enter" && ctrl)) { e.preventDefault(); B.endEdit(); vp.focus(); return; }
    if (o.type === "node" || (o.type === "frame")) { if (k === "Enter" && !e.shiftKey) { e.preventDefault(); B.endEdit(); vp.focus(); return; } }
    if (k === "Tab" && (o.type === "node" || PW.map.inTree(o))) { e.preventDefault(); B.endEdit(); const n = e.shiftKey ? PW.map.addSibling(o) : PW.map.addChild(o); B.select([n.id]); B.edit(n); return; }
    if (k === "Tab" && o.type === "def") { e.preventDefault(); const nx = B.editing.field === "term" ? "def" : B.editing.field === "def" ? "src" : "term"; B.endEdit(); B.edit(o, nx); return; }
    if (k === "Tab" && o.type === "q") { e.preventDefault(); const nx = B.editing.field === "q" ? "a" : B.editing.field === "a" ? "src" : "q"; B.endEdit(); B.edit(o, nx); return; }
    return;
  }
  if (a && a.matches && a.matches("input,textarea,select")) return;
  if (ctrl && k === "Enter" && PW.table.cur()) { e.preventDefault(); run(e.shiftKey ? "tbl-col" : "tbl-row"); return; }
  if (ctrl) {
    const m = { z: e.shiftKey ? "redo" : "undo", y: "redo", c: e.shiftKey ? "map-outline-out" : "copy", x: "cut", d: "dup", a: e.shiftKey ? "appearance" : "selall", f: "search", k: "palette", l: "map-tidy", o: "boards", ".": "chrome", g: "new-frame" }[k.toLowerCase()];
    if (m) { e.preventDefault(); run(m); } return;
  }
  if (e.altKey && /^[1-7]$/.test(k)) { e.preventDefault(); run("color-" + B.COLORS[+k - 1]); return; }
  if (e.altKey && k.startsWith("Arrow") && PW.table.cur()) { e.preventDefault(); PW.table.op(PW.table.cur(), { ArrowUp: "ru", ArrowDown: "rd", ArrowLeft: "cl", ArrowRight: "cr" }[k]); return; }
  if (e.altKey) return;
  const o = sel1();
  if (k === " ") { e.preventDefault(); if (o && PW.map.children(o.id).length) { PW.map.toggle(o); return; } PW.keys.space = true; vp.style.cursor = "grab"; return; }
  if (k === "Escape") { if (openMenu) { hideMenus(); return; } if (PW.linkMode) { PW.linkMode = null; vp.style.cursor = ""; status(""); return; } if (PW.map.focusId) { PW.map.focus(null); return; } B.sel.clear(); B.selLink = null; B.updSel(); B.renderEdges(); PW.search.close(); return; }
  if (k === "Delete" || k === "Backspace") { e.preventDefault(); run("delete"); return; }
  if (k === "F2") { e.preventDefault(); run("edit"); return; }
  if (k === "F1") { e.preventDefault(); run("keys"); return; }
  if (k === "Tab") { e.preventDefault(); if (o) { if (e.shiftKey) run("map-detach"); else run("map-child"); } return; }
  if (k === "Enter" && o && o.type === "table") { e.preventDefault(); const el = B.el(o.id), c = (el && el._cur) || [0, 0]; B.edit(o, `c${c[0]}_${c[1]}`); return; }
  if (k === "Enter") { e.preventDefault(); if (o && o.parent) run("map-sib"); else if (o) B.edit(o); return; }
  if (k.startsWith("Arrow") && o && o.type === "table" && !e.shiftKey) { e.preventDefault(); const el = B.el(o.id), c = (el && el._cur) || [0, 0], nr = o.rows.length, nc = o.rows[0].length;
    el._cur = [clamp(c[0] + (k === "ArrowDown") - (k === "ArrowUp"), 0, nr - 1), clamp(c[1] + (k === "ArrowRight") - (k === "ArrowLeft"), 0, nc - 1)]; B.render(o); return; }
  if (k.startsWith("Arrow")) { e.preventDefault(); if (o && PW.map.inTree(o) && !e.shiftKey && PW.map.nav(o, k)) return;
    if (B.sel.size) { const d = e.shiftKey ? 50 : 10, dx = k === "ArrowLeft" ? -d : k === "ArrowRight" ? d : 0, dy = k === "ArrowUp" ? -d : k === "ArrowDown" ? d : 0; B.selected().forEach(s => { s.x += dx; s.y += dy; B.render(s); }); B.renderEdges(); nudgeCommit(); return; }
    const s = 120; B.view.x -= k === "ArrowRight" ? s : k === "ArrowLeft" ? -s : 0; B.view.y -= k === "ArrowDown" ? s : k === "ArrowUp" ? -s : 0; B.applyView(); return; }
  if (k === "/") { e.preventDefault(); run("search"); return; }
  if (k === "]" || k === "[") { stepTab(k === "]" ? 1 : -1); return; }
  if (k === "+" || k === "=") { run("zoom-in"); return; } if (k === "-") { run("zoom-out"); return; }
  if (k === ")" || (k === "0" && e.shiftKey)) { run("fit-sel"); return; }
  if (k === "0") { run("fit"); return; } if (k === "1") { run("zoom-100"); return; }
  if (k === ".") { run("map-focus"); return; }
  const map = { g: "gaps", p: "present", t: "new-table", n: "new-note", d: "new-def", q: "new-q", m: "new-node", f: "new-frame", i: "insert-file", l: "link", r: "review", w: "walk", h: "cover", v: "overview" }[k.toLowerCase()];
  if (map && !e.shiftKey) { e.preventDefault(); run(map); }
});
const nudgeCommit = debounce(() => B.commit(), 500);
document.addEventListener("keyup", e => { if (e.key === " ") { PW.keys.space = false; vp.style.cursor = ""; } });

// ============ boards & saving ============
B.recent = JSON.parse(ls.get("recent", "[]"));
const slug = s => (String(s).trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").slice(0, 80) || "board");
// ---- tabs: several boards open; the ones in the background stay in memory with their undo history ----
let tabs = JSON.parse(ls.get("tabs", "[]")); const cache = new Map(); let homeOn = false;
async function leaveCurrent() {
  if (!B.doc) return; B.endEdit(); if (PW.study.walking()) PW.study.endWalk(); PW.search.close(); hideMenus();
  if (B.dirty) await save(false); cache.set(B.file, { doc: B.doc, hist: B.hist, redo: B.redo, lastSaved: B.lastSaved });
}
async function openBoard(file) {
  if (B.doc && B.file === file) { hideHome(); return; }
  await leaveCurrent();
  try { const c = cache.get(file);
    if (c) { B.load(c.doc, file); B.hist = c.hist; B.redo = c.redo; B.lastSaved = c.lastSaved; }
    else { const doc = await PW.store.readBoard(file); B.load(doc, file); B.lastSaved = null; }
    afterOpen(); }
  catch (e) { cache.delete(file); tabs = tabs.filter(t => t !== file); saveTabs(); drawTabs(); await alertDlg("open board", "cannot open " + file + "\n" + (e.message || e)); }
}
function unloadBoard() { for (const el of [...world.querySelectorAll(".obj")]) el.remove(); svg.innerHTML = ""; B.doc = null; B.file = null; B.sel.clear(); B.dirty = false; PW.look.apply(false); updSave(); PW.study.updDue(); $("sBoard").textContent = "-"; }
async function closeTab(file) {
  if (!file) return; const i = tabs.indexOf(file);
  if (file === B.file) { await leaveCurrent(); }
  cache.delete(file); tabs = tabs.filter(t => t !== file); saveTabs();
  if (file === B.file) { const nx = tabs[Math.min(Math.max(0, i), tabs.length - 1)]; if (nx) await openBoard(nx); else { unloadBoard(); showHome(); } }
  drawTabs();
}
function stepTab(d) { if (!tabs.length) return; const i = tabs.indexOf(B.file); openBoard(tabs[((homeOn || i < 0 ? (d > 0 ? -1 : 0) : i) + d + tabs.length) % tabs.length]); }
const saveTabs = () => ls.set("tabs", JSON.stringify(tabs));
const nameOf = f => (f === B.file && B.doc ? B.doc.name : cache.get(f) ? cache.get(f).doc.name : null) || f.replace(/\.pinwand\.json$/, "");
function drawTabs() {
  const L = $("tabList"); L.innerHTML = "";
  tabs.forEach(f => { const on = f === B.file && !homeOn, t = h("div", { class: "tab" + (on ? " on" : ""), role: "tab", "aria-selected": String(on), title: nameOf(f) }, h("span", { text: nameOf(f) }), h("button", { class: "x", type: "button", "aria-label": "close", text: "×" }));
    t.addEventListener("click", e => { if (e.target.closest(".x")) { e.stopPropagation(); closeTab(f); return; } openBoard(f); });
    t.addEventListener("auxclick", e => { if (e.button === 1) { e.preventDefault(); closeTab(f); } }); L.append(t); });
  $("tabHome").setAttribute("aria-pressed", String(homeOn)); const on = L.querySelector(".on"); on && on.scrollIntoView({ block: "nearest", inline: "nearest" });
}
function setPin(on) { document.body.classList.toggle("pintabs", on); $("tabPin").setAttribute("aria-pressed", String(on)); ls.set("pintabs", on ? "1" : "0"); }
$("tabPin").onclick = () => setPin(!document.body.classList.contains("pintabs"));
$("tabHome").onclick = () => homeOn && B.doc ? hideHome() : showHome();
// ---- home: every board in the workspace, last opened first ----
let homeK = 0, homeRows = [];
async function showHome() {
  B.endEdit(); hideMenus(); homeOn = true; $("home").hidden = false; drawTabs(); $("homeTtl").textContent = "boards — " + (PW.store.name || "");
  $("ttl").textContent = "pinwand"; document.title = "pinwand";
  const list = await PW.store.listBoards().catch(() => []), rank = f => { const i = B.recent.indexOf(f); return i < 0 ? 1e9 : i; };
  homeRows = list.sort((a, b) => rank(a.file) - rank(b.file) || b.mod - a.mod); homeK = 0; drawHome(); $("hlist").focus({ preventScroll: true });
  for (const r of homeRows) { if (r.due != null) continue; try { const d = r.file === B.file && B.doc ? B.doc : cache.get(r.file) ? cache.get(r.file).doc : await PW.store.readBoard(r.file); const os = (d.objects || []);
      r.n = os.length; r.due = os.filter(o => isStudy(o) && isDue(o)).length; r.cards = os.filter(isStudy).length; drawHome(); } catch (e) { } }
}
function hideHome() { if (!homeOn) return; homeOn = false; $("home").hidden = true; drawTabs(); if (B.doc) { $("ttl").textContent = "pinwand — " + (B.doc.name || B.file); document.title = (B.doc.name || "pinwand") + " — pinwand"; } vp.focus(); }
function ago(t) { const d = (Date.now() - t) / 864e5; if (d < 1) return fmtTime(new Date(t)).slice(0, 5); if (d < 2) return "yesterday"; if (d < 7) return Math.floor(d) + " days"; return new Date(t).toLocaleDateString(); }
function drawHome() {
  const box = $("hlist"); box.innerHTML = ""; if (!homeRows.length) { box.append(h("div", { class: "none", text: "-" })); return; }
  homeRows.forEach((r, k) => { const open = tabs.includes(r.file), row = h("div", { class: "r" + (k === homeK ? " k" : ""), role: "option" },
      h("span", { class: "nm", text: (open ? "▸ " : "") + r.name }), h("span", { class: "m" + (r.due ? " due" : ""), text: r.due == null ? "" : r.due ? r.due + " due" : "" }),
      h("span", { class: "m", text: r.n == null ? "" : r.n + (r.n === 1 ? " item" : " items") }), h("span", { class: "m", text: ago(r.mod) }));
    row.onclick = () => openBoard(r.file); box.append(row); });
}
$("hlist").addEventListener("keydown", e => { if (!homeRows.length) return; if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); homeK = (homeK + (e.key === "ArrowDown" ? 1 : -1) + homeRows.length) % homeRows.length; drawHome(); $("hlist").children[homeK].scrollIntoView({ block: "nearest" }); } else if (e.key === "Enter") { e.preventDefault(); openBoard(homeRows[homeK].file); } });
$("hNew").onclick = () => newBoardDlg(); $("hImport").onclick = () => $("importIn").click(); $("hWs").onclick = () => workspaceDlg(true);
function afterOpen() {
  if (!tabs.includes(B.file)) { tabs.push(B.file); saveTabs(); } homeOn = false; $("home").hidden = true; PW.look.apply(false); B.renderAll(); PW.map.relayoutAll(false); drawTabs();
  B.recent = [B.file, ...B.recent.filter(r => r !== B.file)].slice(0, 30); ls.set("recent", JSON.stringify(B.recent)); ls.set("board", B.file);
  $("ttl").textContent = "pinwand — " + (B.doc.name || B.file); document.title = (B.doc.name || "pinwand") + " — pinwand"; $("sBoard").textContent = B.doc.name || B.file;
  if (PW.fitImportedFrames && PW.fitImportedFrames()) B.commit();
  updSave(); PW.study.updDue(); drawMini(); lastBackup = 0;
  if (!all().length) status("empty board"); else if (!B.doc.view || B.doc.view.z == null) B.fit(all(), 1, false);
  (launchQ.splice(0)).forEach(f => PW.files.insert(f, B.center()));
}
async function createBoard(name, doc) {
  let file = slug(name) + ".pinwand.json", i = 2; while (await PW.store.exists(file)) file = slug(name) + " " + (i++) + ".pinwand.json";
  doc = doc || newDoc(name); doc.name = name; await PW.store.writeBoard(file, doc); await leaveCurrent(); B.load(doc, file); B.lastSaved = null; afterOpen(); return file;
}
async function newBoardDlg() { const n = await promptDlg("new board", "name", ""); if (n && n.trim()) await createBoard(n.trim()); }
async function renameBoard() { const n = await promptDlg("rename board", "name", B.doc.name || ""); if (!n || !n.trim()) return; B.doc.name = n.trim(); B.touch(); await save(true); afterOpen(); drawTabs(); }
async function boardsDlg(first = false) {
  const list = await PW.store.listBoards(), box = h("div", { class: "list" });
  return dialog({ title: "boards — " + PW.store.name, width: "min(520px,calc(100vw - 20px))",
    body: h("div", { style: { display: "grid", gap: "8px" } }, box),
    buttons: [{ label: "import old board…", value: "import" }, { label: "new board…", value: "new" }, { label: "close", value: null }],
    init: (dlg, close) => { if (!list.length) box.append(h("div", { text: "no boards yet" }));
      list.forEach(b => box.append(h("button", { class: "b", style: { height: "auto", padding: "4px 8px", display: "flex", justifyContent: "space-between", gap: "12px" }, onclick: () => close("open:" + b.file) }, h("span", { text: b.name }), h("span", { text: new Date(b.mod).toLocaleString() })))); } })
    .then(v => { if (!v) return; if (v === "new") return newBoardDlg(); if (v === "import") return $("importIn").click(); if (v.startsWith("open:")) return openBoard(v.slice(5)); });
}
async function importOldFile(f) {
  try {
    status("importing…"); const r = await PW.importOld(f);
    const name = await promptDlg("import", "name of the new board", r.name || "imported"); if (!name) { status(""); return; }
    await createBoard(name.trim(), r.doc); await save(true);
    status(""); if (r.stats) toast(`${r.stats.objects} items · ${r.stats.frames} frames` + (r.stats.progress ? ` · ${r.stats.progress} with review progress` : ""), 5000);
    B.fit(all(), 1);
  } catch (e) { alertDlg("import", "this file could not be imported\n" + (e.message || e)); }
}
let saving = null, lastBackup = 0;
async function save(manual) {
  if (!B.doc || !B.file) return; if (saving) await saving;
  saving = (async () => {
    try {
      const data = B.serialize(); await PW.store.writeBoard(B.file, data); B.dirty = false;
      if (manual || Date.now() - lastBackup > 20 * 60e3) { await PW.store.backup(B.file, data); lastBackup = Date.now(); }
      B.lastSaved = new Date(); updSave(manual);
    } catch (e) { $("sSave").innerHTML = '<span class="warn">not saved</span>'; status("saving failed: " + (e.message || e)); if (manual) alertDlg("save", "saving failed\n" + (e.message || e)); }
  })();
  await saving; saving = null;
}
PW.save = save;
function updSave(flash) {
  const auto = ls.get("autosave", "1") === "1", t = B.lastSaved ? fmtTime(B.lastSaved) : "";
  $("sSave").innerHTML = B.dirty ? `<span class="warn">unsaved</span>` : t ? "saved " + t : "saved";
  $("ttlSave").textContent = (B.dirty ? "* " : "") + (auto ? "autosave" : "manual save") + " · " + (PW.store.name || "");
  if (flash) toast("saved " + t);
}
const autoSave = debounce(() => { if (ls.get("autosave", "1") === "1") save(false); }, 1200);
B.onChange = () => { PW.ctxSoon && PW.ctxSoon(); if ($("sMsg").textContent === "empty board") status(""); updSave(); autoSave(); PW.study.updDue(); drawMiniSoon(); };
B.onViewSave = () => { if (B.doc) { B.doc.view = { ...B.view }; if (ls.get("autosave", "1") === "1") autoSave(); } };
addEventListener("beforeunload", e => { if (B.dirty) { save(false); e.preventDefault(); e.returnValue = ""; } });
document.addEventListener("visibilitychange", () => { if (document.hidden && B.dirty) save(false); });
async function backupsDlg() {
  const list = await PW.store.listBackups(B.file), box = h("div", { class: "list" });
  if (!list.length) return alertDlg("backups", "no backups yet");
  list.slice(0, 40).forEach(n => { const m = n.match(/-(\d{8})-(\d{6})\.json$/), lbl = m ? `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6)}  ${m[2].slice(0, 2)}:${m[2].slice(2, 4)}:${m[2].slice(4)}` : n;
    box.append(h("button", { class: "b", style: { height: "auto", padding: "3px 8px" }, "data-n": n }, lbl)); });
  const v = await dialog({ title: "restore a backup", body: box, buttons: [{ label: "close", value: null }], init: (d, close) => box.addEventListener("click", e => { const b = e.target.closest("[data-n]"); if (b) close(b.dataset.n); }) });
  if (!v) return; if (!(await confirmDlg("restore", "replace the board with this backup?\n(the current state is kept as a backup first)", "restore"))) return;
  await save(true); const doc = await PW.store.readBackup(v); B.load(doc, B.file); B.touch(); await save(true); afterOpen(); toast("backup restored");
}
async function exportCopy() {
  const data = JSON.stringify(B.serialize());
  try { if (window.showSaveFilePicker) { const fh = await showSaveFilePicker({ suggestedName: slug(B.doc.name) + ".pinwand.json", types: [{ description: "pinwand board", accept: { "application/json": [".json"] } }] }); const w = await fh.createWritable(); await w.write(data); await w.close(); toast("exported"); return; } } catch (e) { if (e.name === "AbortError") return; }
  const a = h("a", { href: URL.createObjectURL(new Blob([data], { type: "application/json" })), download: slug(B.doc.name) + ".pinwand.json" }); document.body.append(a); a.click(); a.remove();
}
async function workspaceDlg(change) {
  const btns = []; if (PW.store.canPick) btns.push({ label: "choose folder…", value: "pick", def: true }); btns.push({ label: "app storage", value: "opfs" }); if (change) btns.unshift({ label: "cancel", value: null });
  const v = await dialog({ title: "workspace", body: h("pre", { text: change ? `current: ${PW.store.name || "-"}` : "where pinwand keeps your boards" }), buttons: btns });
  if (!v) return false;
  try { if (v === "pick") await PW.store.pickFolder(); else await PW.store.useOPFS(); } catch (e) { if (e.name === "AbortError") return false; await alertDlg("workspace", String(e.message || e)); return false; }
  updSave(); if (change) { cache.clear(); tabs = []; saveTabs(); unloadBoard(); await startBoards(); } return true;
}

// ============ overview (minimap) ============
const mini = $("minimap"), mcv = mini.querySelector("canvas");
function drawMini() {
  if (mini.hidden || !B.doc) return; const b = B.bounds(all()); const r = mini.getBoundingClientRect(), dp = devicePixelRatio || 1;
  mcv.width = r.width * dp; mcv.height = r.height * dp; const g = mcv.getContext("2d"); g.setTransform(dp, 0, 0, dp, 0, 0); g.clearRect(0, 0, r.width, r.height); if (!b) return;
  const vr = vp.getBoundingClientRect(), v0 = B.toWorld(vr.left, vr.top), v1 = B.toWorld(vr.right, vr.bottom);
  const x0 = Math.min(b.x0, v0.x), y0 = Math.min(b.y0, v0.y), x1 = Math.max(b.x1, v1.x), y1 = Math.max(b.y1, v1.y), s = Math.min((r.width - 8) / (x1 - x0), (r.height - 8) / (y1 - y0));
  mini._m = { x0, y0, s }; const cs = getComputedStyle(document.documentElement), col = k => cs.getPropertyValue(k).trim();
  for (const o of all()) { if (PW.map.isHidden(o)) continue; const bx = B.box(o); g.fillStyle = isArea(o) ? "transparent" : o.type === "pdf" ? col("--b1") : o.type === "node" ? col("--b3") : o.type === "image" ? col("--lo") : col("--paper");
    g.strokeStyle = col("--ink"); g.lineWidth = .5; const X = 4 + (bx.x - x0) * s, Y = 4 + (bx.y - y0) * s; if (!isArea(o)) g.fillRect(X, Y, Math.max(1, bx.w * s), Math.max(1, bx.h * s)); else g.strokeRect(X, Y, bx.w * s, bx.h * s); }
  g.strokeStyle = col("--hit"); g.lineWidth = 1.5; g.strokeRect(4 + (v0.x - x0) * s, 4 + (v0.y - y0) * s, (v1.x - v0.x) * s, (v1.y - v0.y) * s);
}
const drawMiniSoon = debounce(drawMini, 200);
let miniDrag = false; const miniGo = e => { const m = mini._m; if (!m) return; const r = mini.getBoundingClientRect(), wx = m.x0 + (e.clientX - r.left - 4) / m.s, wy = m.y0 + (e.clientY - r.top - 4) / m.s, vr = vp.getBoundingClientRect(); B.view.x = vr.width / 2 - wx * B.view.z; B.view.y = vr.height / 2 - wy * B.view.z; B.applyView(); };
mini.addEventListener("pointerdown", e => { miniDrag = true; mini.setPointerCapture(e.pointerId); miniGo(e); }); mini.addEventListener("pointermove", e => { if (miniDrag) miniGo(e); }); mini.addEventListener("pointerup", () => { miniDrag = false; B.onViewSave(); });
const prevOnView = B.onView; B.onView = () => { prevOnView && prevOnView(); drawMiniSoon(); };

// ============ theme, help ============
PW.drawMini = () => drawMini();
function keysDlg() {
  dialog({ title: "keys", width: "min(640px,calc(100vw - 20px))", buttons: [{ label: "OK", value: 1 }], body: `BOARD
  drag background      pan              shift+drag   select area
  wheel                zoom / scroll    space+drag   pan
  double-click         new note / edit text
  n d q m f t          note, definition, question, map centre, frame, table
  ctrl+shift+v         add many at once from a list (definitions, questions, notes, arrow chain)
  paste JSON / .html   board items made elsewhere / an HTML block
  i                    insert PDF or picture (or drop / paste it)
  l  alt+click         arrow from the selected item
  0  shift+0  1        fit all, fit selection, 100 %
  + -                  zoom             v            overview
  arrows               move selection (shift: further)
  del                  delete           f2 / enter   edit text
  alt+1..7             note colour      ctrl+g       frame around selection
  ctrl+z / ctrl+y      undo / redo      ctrl+d       copy for the palace
  ctrl+s               save             ctrl+o       boards
  ctrl+k               commands         /  ctrl+f    search
  ctrl+.               hide menus
  ctrl+shift+a         appearance: style, text size, fonts, background

TABS
  ctrl+o  +            boards, last opened first
  [ ]  ctrl+pgup/pgdn  previous / next board
  middle-click / ×     close a tab        fix   tabs stay when menus hide

MAP
  tab                  add branch       enter        add sibling
  shift+tab            detach           space        collapse / expand
  arrows               move between branches
  ctrl+l               tidy             .            focus branch
  drag onto a branch   attach (alt for cards)
  paste lines          become branches of the selected item

TABLE
  double-click / enter edit a cell     tab, shift+tab   next / previous cell
  enter (editing)      cell below, new row at the end
  arrows               move between cells (also while editing)
  ctrl+enter           row below        ctrl+shift+enter  column right
  alt+arrows           move row / column
  paste cells          from Excel, Word or markdown: a new table, or fills cells
  drag a column edge   column width     cover   hide a column to test yourself

PDF
  select text          note / def / question / branch from it
  chip on a card       jump to its page; marks on pages jump back

STUDY
  r                    review           h            cover definitions
  g                    gaps: bold terms and formulas become blanks, click to check
  p                    present frame by frame (arrows, space, esc)
  w                    walk the arrows from here, or recall a map branch
  space / 1 / 2        show / again / knew it` });
}

// ============ start ============
const launchQ = [];
if ("launchQueue" in window) launchQueue.setConsumer(async p => { if (!p.files || !p.files.length) return; const fs = []; for (const fh of p.files) fs.push(await fh.getFile()); if (B.doc) PW.files.insert(fs, B.center()); else launchQ.push(...fs); });
async function startBoards() {
  const last = ls.get("board", ""), list = await PW.store.listBoards(), have = new Set(list.map(b => b.file));
  tabs = tabs.filter(t => have.has(t)); saveTabs(); drawTabs();
  if (tabs.length) return openBoard(tabs.includes(last) ? last : tabs[0]);
  if (last && have.has(last)) return openBoard(last);
  showHome();
}
async function start() {
  PW.look.apply(false); setPin(ls.get("pintabs", "0") === "1"); drawTabs();
  buildMenus(); if (ls.get("invert", "0") === "1") document.body.classList.add("invertpdf");
  if (ls.get("minimap", "0") === "1") mini.hidden = false;
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => { });
  const st = await PW.store.init();
  if (st === "reconnect") { const v = await dialog({ title: "workspace", body: h("pre", { text: PW.store._pending.name }), buttons: [{ label: "other folder…", value: "other" }, { label: "open", value: "ok", def: true }] });
    if (v === "ok" && await PW.store.reconnect()) { } else if (!(await workspaceDlg(false))) await PW.store.useOPFS(); }
  else if (st === "choose") { if (!(await workspaceDlg(false))) await PW.store.useOPFS(); }
  updSave(); await startBoards();
}
start();
