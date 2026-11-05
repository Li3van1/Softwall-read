"use strict";
// pinwand · 2×2 matrix, HTML blocks, gaps, present, connections, adding from lists, picture export, pasting board items as JSON
// ---------- 2×2 matrix: a frame with two axes ----------
B.types.matrix = {
  fixedH: true, editField: "title",
  create(o) {
    const L = (f, c, ph) => h("div", { class: "mx-l " + c }, h("span", { class: "txt", "data-f": f, "data-ph": ph }));
    return h("div", { class: "matrix" }, h("div", { class: "ft" }, h("span", { class: "txt", "data-f": "title", "data-ph": "matrix" })),
      h("div", { class: "mx-v" }), h("div", { class: "mx-h" }),
      L("q1", "q1", "…"), L("q2", "q2", "…"), L("q3", "q3", "…"), L("q4", "q4", "…"),
      L("yt", "yt", "high"), L("yb", "yb", "low"), L("xl", "xl", "low"), L("xr", "xr", "high"), h("div", { class: "rz" }));
  },
  update(o, e) { o.h = o.h || 700; e.style.height = o.h + "px"; fieldsSet(o, e); },
  text: o => ["title", "yt", "yb", "xl", "xr", "q1", "q2", "q3", "q4"].map(k => o[k]).filter(Boolean).join(" · "),
};
cmd({ id: "new-matrix", menu: "Insert", label: "2×2 matrix", enabled: () => !!B.doc, run: p => { p = p && p.x != null ? p : PW.mouseWorld(); const o = B.add({ type: "matrix", x: Math.round(p.x), y: Math.round(p.y), w: 900, h: 700, title: "" }, { edit: "title" }); B.zorder(); return o; } });

// ---------- HTML blocks: anything as a self-contained page, shown in a sealed frame on the board ----------
let katexInline = null;
async function katexBits() {
  if (katexInline) return katexInline;
  const base = new URL("vendor/", location.href).href;
  let [css, js] = await Promise.all([fetch("vendor/katex.min.css").then(r => r.text()), fetch("vendor/katex.min.js").then(r => r.text())]);
  // the block runs sealed off from the app, so the formula fonts travel inside it
  const urls = [...new Set([...css.matchAll(/url\((['"]?)(fonts\/[^'")]+\.woff2)\1\)/g)].map(m => m[2]))];
  for (const u of urls) { try { const du = await fetch(base + u).then(r => r.blob()).then(toDataURL); css = css.split(u).join(du); } catch (e) { } }
  css = css.replace(/,\s*url\((['"]?)fonts\/[^)]+\)\s*format\(['"][^'"]+['"]\)/g, "");
  return katexInline = { css, js };
}
const MATH_SCRIPT = `(function(){function go(){if(!window.katex)return;var re=/\\$\\$([\\s\\S]+?)\\$\\$|\\\\\\[([\\s\\S]+?)\\\\\\]|\\\\\\(([\\s\\S]+?)\\\\\\)|\\$((?:\\\\\\$|[^$\\n])+?)\\$/g;
var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:function(n){var p=n.parentNode&&n.parentNode.nodeName;return /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/.test(p)||n.parentNode.closest&&n.parentNode.closest(".katex")?2:1}}),L=[],n;while(n=w.nextNode())if(/\\$|\\\\\\(|\\\\\\[/.test(n.nodeValue))L.push(n);
L.forEach(function(t){var s=t.nodeValue,f=document.createDocumentFragment(),i=0,m;re.lastIndex=0;while(m=re.exec(s)){f.appendChild(document.createTextNode(s.slice(i,m.index)));var sp=document.createElement("span"),d=m[1]!=null||m[2]!=null;try{katex.render(m[1]||m[2]||m[3]||m[4],sp,{displayMode:d,throwOnError:false})}catch(e){sp.textContent=m[0]}f.appendChild(sp);i=re.lastIndex}f.appendChild(document.createTextNode(s.slice(i)));t.parentNode.replaceChild(f,t)})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go()})();`;
async function wrapHTML(html) {
  const cs = getComputedStyle(document.documentElement), tok = ["--ink", "--paper", "--paper-ink", "--paper-line", "--face", "--field", "--title", "--title-ink", "--sel", "--hit", "--due", "--good", "--link", "--b1", "--b2", "--b3", "--b4", "--b5", "--b6", "--b7", "--n-yellow", "--n-green", "--n-blue", "--n-pink", "--n-grey", "--f", "--f-text", "--f-head", "--f-note", "--r", "--rc"]
    .map(k => `${k}:${cs.getPropertyValue(k).trim()}`).join(";");
  let head = `<meta charset="utf-8"><style>:root{${tok};color-scheme:${cs.colorScheme || "light"}}html,body{margin:0}body{padding:10px 12px;background:var(--paper);color:var(--paper-ink);font:14px/1.5 var(--f-text)}</style>`;
  if (/\$|\\\(|\\\[|katex/.test(html)) { try { const k = await katexBits(); head += `<style>${k.css}</style><script>${k.js.replace(/<\/script/gi, "<\\/script")}<\/script><script>${MATH_SCRIPT}<\/script>`; } catch (e) { } }
  if (/<head[\s>]/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${head}`);
  if (/<html[\s>]/i.test(html)) return html.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`);
  return `<!doctype html><html><head>${head}</head><body>${html}</body></html>`;
}
const htmlText = html => { try { return new DOMParser().parseFromString(html, "text/html").body.textContent.replace(/\s+/g, " ").trim().slice(0, 6000); } catch (e) { return ""; } };
B.types.embed = {
  fixedH: true, minW: 160,
  create(o) {
    const e = h("div", { class: "win embed" }, h("div", { class: "wt" }, h("span", { class: "nm" }), h("button", { class: "b", "data-a": "reload", title: "reload" }, "⟳"), h("button", { class: "b", "data-a": "edit", title: "edit HTML" }, "</>")),
      h("iframe", { sandbox: "allow-scripts allow-forms allow-popups allow-modals allow-downloads", referrerpolicy: "no-referrer" }), h("div", { class: "rz" }));
    e.querySelector(".wt").addEventListener("click", async ev => { const b = ev.target.closest("button[data-a]"); if (!b) return; ev.stopPropagation(); const o2 = obj(e.dataset.id);
      if (b.dataset.a === "reload") { e._sig = null; B.render(o2); }
      if (b.dataset.a === "edit") { const cur = await PW.store.getAsset(o2.asset).then(x => x.text()).catch(() => ""); const v = await promptDlg("HTML", "", cur, true); if (v == null) return; const a = await PW.store.putAsset(new Blob([v], { type: "text/html" }), "block.html"); o2.asset = a.file; o2.text = htmlText(v); e._sig = null; B.render(o2); B.commit(); } });
    return e;
  },
  update(o, e) {
    o.h = o.h || 420; e.style.height = o.h + "px"; e.querySelector(".nm").textContent = o.title || "html";
    const sig = o.asset + "|" + document.documentElement.dataset.style + document.documentElement.dataset.theme; if (e._sig === sig) return; e._sig = sig;
    PW.store.getAsset(o.asset).then(b => b.text()).then(wrapHTML).then(doc => { e.querySelector("iframe").srcdoc = doc; }).catch(() => { e.querySelector("iframe").srcdoc = "<p style='font:13px monospace'>cannot read this block</p>"; });
  },
  text: o => [o.title, o.text].filter(Boolean).join(" "),
};
PW.addHTML = async function (html, at, title) {
  at = at || PW.mouseWorld(); const a = await PW.store.putAsset(new Blob([html], { type: "text/html" }), (title || "block") + ".html");
  const t = title || (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || (html.match(/<h[12][^>]*>([^<]+)</i) || [])[1] || "html";
  return B.add({ type: "embed", x: Math.round(at.x), y: Math.round(at.y), w: 640, h: 440, asset: a.file, title: t.trim().slice(0, 80), text: htmlText(html) });
};
cmd({ id: "new-html", menu: "Insert", label: "HTML block…", enabled: () => !!B.doc, run: async () => { const v = await promptDlg("HTML block", "", "", true); if (v && v.trim()) PW.addHTML(v, B.center()); } });
// re-theme blocks when the look changes
const prevApply = PW.look.apply; PW.look.apply = function (r) { prevApply.call(PW.look, r); document.querySelectorAll(".obj.embed").forEach(e => { const o = obj(e.dataset.id); if (o) B.render(o); }); };

// ---------- gaps: bold terms and longer formulas become blanks to recall ----------
const markGaps = el => { el.querySelectorAll("b,strong").forEach(x => x.classList.add("gap")); el.querySelectorAll(".katex").forEach(x => { if (x.closest(".katex-display") || (x.textContent || "").length > 6) x.classList.add("gap"); }); };
const origSetRich = window.setRich; window.setRich = function (el, src) { const before = el._src; origSetRich(el, src); if (el._src !== before || !el.dataset.g) { markGaps(el); el.dataset.g = "1"; } };
PW.gaps = { on: () => document.body.classList.contains("gaps"), toggle(v) { const on = v == null ? !this.on() : v; document.body.classList.toggle("gaps", on); document.querySelectorAll(".gap.shown").forEach(x => x.classList.remove("shown")); const b = document.querySelector('[data-cmd="gaps"]'); b && b.setAttribute("aria-pressed", String(on)); status(on ? "gaps: click a blank to check it" : ""); } };
world.addEventListener("pointerdown", e => { if (!PW.gaps.on() || B.editing) return; const g = e.target.closest(".gap"); if (!g) return; e.stopPropagation(); e.preventDefault(); g.classList.toggle("shown"); }, true);
cmd({ id: "gaps", menu: "Study", label: "Gaps (hide bold terms and formulas)", key: "G", check: () => PW.gaps.on(), run: () => PW.gaps.toggle() });

// ---------- present: frame by frame ----------
const PRES = PW.present = { on: false };
function sections() {
  const list = PW.sections.list().map(x => x.o).filter(o => isArea(o) || o.style === "h1");
  if (list.length) return list;
  return all().filter(o => o.type === "node" && !o.parent && MAP_has(o)).sort((a, b) => Math.abs(a.y - b.y) < 200 ? a.x - b.x : a.y - b.y);
}
const MAP_has = o => all().some(c => c.parent === o.id);
PRES.start = function () {
  const s = sections(); if (!s.length) { toast("make a heading (H) or a frame (F) first"); return; }
  B.endEdit(); PRES.on = true; PRES.list = s; PRES.i = 0; PRES.wasChrome = document.body.classList.contains("nochrome");
  document.body.classList.add("nochrome", "presenting");
  const bar = h("div", { id: "presbar", class: "bevel" }, h("button", { class: "b", onclick: () => PRES.go(PRES.i - 1) }, "‹"), h("span", { id: "presT" }), h("button", { class: "b", onclick: () => PRES.go(PRES.i + 1) }, "›"), h("button", { class: "b", onclick: () => PRES.stop() }, "×"));
  document.body.append(bar); PRES.go(0);
};
PRES.go = function (i) {
  if (!PRES.on) return; PRES.i = clamp(i, 0, PRES.list.length - 1); const o = PRES.list[PRES.i];
  const group = isArea(o) ? [o] : PW.sections.bounds(o);
  B.sel.clear(); B.updSel(); B.fit(group, 3);
  $("presT").textContent = `${PRES.i + 1} / ${PRES.list.length}  ${texPlain(o.title || o.text || "").slice(0, 60)}`;
};
PRES.stop = function () { if (!PRES.on) return; PRES.on = false; document.body.classList.remove("presenting"); if (!PRES.wasChrome) document.body.classList.remove("nochrome"); const b = $("presbar"); b && b.remove(); };
PRES.key = function (e) {
  const k = e.key; if (k === "Escape") { PRES.stop(); return true; }
  if (k === "ArrowRight" || k === "ArrowDown" || k === " " || k === "PageDown" || k === "Enter") { PRES.go(PRES.i + 1); return true; }
  if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace") { PRES.go(PRES.i - 1); return true; }
  if (k === "Home") { PRES.go(0); return true; } if (k === "End") { PRES.go(PRES.list.length - 1); return true; }
  if (k === "g" || k === "G") { PW.gaps.toggle(); return true; }
  return false;
};
cmd({ id: "present", menu: "Study", label: "Present section by section", key: "P", enabled: () => !!B.doc, run: () => PRES.start() });

// ---------- connections: which definition uses which term ----------
PW.connections = function () {
  const defs = all().filter(o => o.type === "def" && !o.copy && (o.term || "").trim());
  if (defs.length < 2) { toast("needs at least two definitions"); return; }
  const terms = defs.map(d => ({ d, t: texPlain(d.term).toLowerCase().replace(/[()]/g, "").trim() }));
  const N = defs.map(d => ({ d, label: texPlain(d.term).slice(0, 40), x: Math.random() * 600 - 300, y: Math.random() * 400 - 200, vx: 0, vy: 0, out: [], inn: [] }));
  const E = [];
  terms.forEach((a, i) => { const text = " " + texPlain(defs[i].def || "").toLowerCase() + " ";
    terms.forEach((b, j) => { if (i === j || b.t.length < 3) return; const esc_ = b.t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); if (new RegExp(`(^|[^a-zäöüß])${esc_}(s|es)?([^a-zäöüß]|$)`).test(text)) { E.push([i, j]); N[i].out.push(j); N[j].inn.push(i); } }); });
  for (let it = 0; it < 400; it++) {
    const t = 1 - it / 400;
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) { const a = N[i], b = N[j]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + .01, f = 9000 / d2; const d = Math.sqrt(d2); dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f; }
    for (const [i, j] of E) { const a = N[i], b = N[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) + .01, f = (d - 140) * .02; a.vx += dx / d * f * 10; a.vy += dy / d * f * 10; b.vx -= dx / d * f * 10; b.vy -= dy / d * f * 10; }
    for (const n of N) { n.vx -= n.x * .004; n.vy -= n.y * .004; const v = Math.hypot(n.vx, n.vy), m = 30 * t + 1; if (v > m) { n.vx *= m / v; n.vy *= m / v; } n.x += n.vx; n.y += n.vy; n.vx *= .5; n.vy *= .5; }
  }
  const cv = h("canvas", { style: { width: "100%", height: "100%", display: "block", cursor: "grab" } }), wrap = h("div", { class: "sunk", style: { width: "min(1100px,calc(100vw - 40px))", height: "min(720px,calc(100vh - 140px))" } }, cv);
  let view = { x: 0, y: 0, z: 1 }, hover = -1, closeFn = null;
  const css = getComputedStyle(document.documentElement), col = k => css.getPropertyValue(k).trim();
  const fit = () => { const r = cv.getBoundingClientRect(), xs = N.map(n => n.x), ys = N.map(n => n.y), w = Math.max(...xs) - Math.min(...xs) + 220, hh = Math.max(...ys) - Math.min(...ys) + 80; view.z = Math.min(r.width / w, r.height / hh, 1.6); view.x = r.width / 2 - (Math.min(...xs) + Math.max(...xs)) / 2 * view.z; view.y = r.height / 2 - (Math.min(...ys) + Math.max(...ys)) / 2 * view.z; };
  const draw = () => {
    const r = cv.getBoundingClientRect(), dp = devicePixelRatio || 1; cv.width = r.width * dp; cv.height = r.height * dp; const g = cv.getContext("2d"); g.setTransform(dp, 0, 0, dp, 0, 0); g.clearRect(0, 0, r.width, r.height);
    g.save(); g.translate(view.x, view.y); g.scale(view.z, view.z); g.font = "13px " + col("--f-text"); g.textAlign = "center"; g.textBaseline = "middle";
    const near = hover >= 0 ? new Set([hover, ...N[hover].out, ...N[hover].inn]) : null;
    for (const [i, j] of E) { const a = N[i], b = N[j], on = !near || (near.has(i) && near.has(j) && (i === hover || j === hover)); g.strokeStyle = on ? (near ? col("--hit") : col("--lo")) : "rgba(128,128,128,.12)"; g.lineWidth = (near && on ? 2 : 1) / view.z;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ex = b.x - dx / d * 26, ey = b.y - dy / d * 14; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(ex, ey); g.stroke();
      g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - dx / d * 8 - dy / d * 4, ey - dy / d * 8 + dx / d * 4); g.lineTo(ex - dx / d * 8 + dy / d * 4, ey - dy / d * 8 - dx / d * 4); g.closePath(); g.fillStyle = g.strokeStyle; g.fill(); }
    N.forEach((n, i) => { const w = g.measureText(n.label).width + 14, dim = near && !near.has(i); g.globalAlpha = dim ? .25 : 1; g.fillStyle = i === hover ? col("--sel") : col("--paper"); g.strokeStyle = col("--paper-line"); g.lineWidth = 1 / view.z;
      g.fillRect(n.x - w / 2, n.y - 11, w, 22); g.strokeRect(n.x - w / 2, n.y - 11, w, 22); g.fillStyle = i === hover ? col("--field") : col("--paper-ink"); g.fillText(n.label, n.x, n.y); n.w = w; }); g.globalAlpha = 1; g.restore();
  };
  const pick = ev => { const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left - view.x) / view.z, y = (ev.clientY - r.top - view.y) / view.z; return N.findIndex(n => Math.abs(n.x - x) < (n.w || 60) / 2 && Math.abs(n.y - y) < 11); };
  let pan = null;
  cv.addEventListener("pointerdown", ev => { const i = pick(ev); if (i >= 0) { closeFn(); const d = N[i].d; B.select([d.id]); B.reveal(d, .8); B.flash(d.id); return; } pan = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y }; cv.setPointerCapture(ev.pointerId); });
  cv.addEventListener("pointermove", ev => { if (pan) { view.x = pan.vx + ev.clientX - pan.x; view.y = pan.vy + ev.clientY - pan.y; draw(); return; } const i = pick(ev); if (i !== hover) { hover = i; cv.style.cursor = i >= 0 ? "pointer" : "grab"; draw(); } });
  cv.addEventListener("pointerup", () => { pan = null; });
  cv.addEventListener("wheel", ev => { ev.preventDefault(); const r = cv.getBoundingClientRect(), f = Math.exp(-ev.deltaY * .0015), px = ev.clientX - r.left, py = ev.clientY - r.top; view.x = px - (px - view.x) * f; view.y = py - (py - view.y) * f; view.z *= f; draw(); }, { passive: false });
  dialog({ title: `connections · ${N.length} terms · ${E.length} arrows`, body: wrap, width: "auto", buttons: [{ label: "close", value: null }], init: (d, close) => { closeFn = close; requestAnimationFrame(() => { fit(); draw(); }); } });
};
cmd({ id: "connections", menu: "Study", label: "Connections between definitions", enabled: () => !!B.doc, run: () => PW.connections() });

// ---------- adding many things at once from a list ----------
const splitPair = l => { const m = l.match(/^(.+?)\s*(?:\||\t|::| – | — | - |:\s)\s*(.+)$/); return m ? [m[1].trim(), m[2].trim()] : [l.trim(), ""]; };
PW.addList = function (text, kind, at) {
  at = at || B.center(); const lines = text.replace(/\r/g, "").split("\n").map(l => l.replace(/^\s*(?:[-*•·▪◦]|\d+[.)])\s+/, "").trimEnd()).filter(l => l.trim());
  if (!lines.length) return [];
  if (kind === "map") { PW.map.pasteOutline(text, null); return []; }
  if (kind === "table") { const o = PW.table.fromText(lines.map(l => l.includes("\t") || l.includes("|") ? l : l.replace(/\s*[:–—]\s+/, "\t")).join("\n"), at); return o ? [o] : []; }
  const made = [], cols = kind === "chain" ? 4 : kind === "note" ? 4 : 3, W = kind === "note" || kind === "chain" ? 240 : 380, GX = kind === "chain" ? 90 : 30, GY = kind === "chain" ? 80 : 30;
  lines.forEach((l, i) => {
    const r = Math.floor(i / cols), c0 = i % cols, c = kind === "chain" && r % 2 ? cols - 1 - c0 : c0, p = { x: Math.round(at.x + c * (W + GX)), y: Math.round(at.y + r * (kind === "chain" ? 140 : 170)) };
    let o;
    if (kind === "def") { const [t, d] = splitPair(l); o = { type: "def", term: t, def: d, w: W }; }
    else if (kind === "q") { const [q, a] = splitPair(l); o = { type: "q", qt: "concept", q, a, w: W }; }
    else o = { type: "note", text: l.trim(), color: ls.get("noteColor", "yellow"), w: W };
    made.push(B.add(Object.assign(o, p), { select: false, commit: false }));
  });
  if (kind === "chain") for (let i = 1; i < made.length; i++) B.doc.links.push({ id: "l" + (B.nextId++), a: made[i - 1].id, b: made[i].id });
  B.renderEdges(); B.select(made.map(o => o.id)); B.commit(); setTimeout(() => B.fit(made, 1), 50); toast(made.length + " added"); return made;
};
PW.listDlg = function (kind0) {
  let kind = kind0 || ls.get("listKind", "def"); const ta = h("textarea", { class: "f", rows: 14, style: { width: "min(640px,80vw)", fontFamily: "inherit" }, placeholder: "one per line\nterm | definition" });
  const kinds = [["def", "definitions"], ["q", "questions"], ["note", "notes"], ["chain", "arrow chain"], ["map", "map"], ["table", "table"]];
  const seg = h("div", { style: { display: "flex", gap: "3px", flexWrap: "wrap" } }); const draw = () => { seg.innerHTML = ""; kinds.forEach(([k, l]) => { const b = h("button", { class: "b", type: "button", "aria-pressed": String(kind === k) }, l); b.onclick = () => { kind = k; ls.set("listKind", k); ta.placeholder = { def: "one per line\nterm | definition", q: "one per line\nquestion | answer", note: "one note per line", chain: "one step per line", map: "centre\n  branch\n    sub-branch", table: "a | b | c" }[k]; draw(); }; seg.append(b); }); };
  draw();
  dialog({ title: "add from a list", body: h("div", { style: { display: "grid", gap: "8px" } }, seg, ta), buttons: [{ label: "Cancel", value: null }, { label: "Add", value: () => ta.value }],
    onKey: (e, close) => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); close(ta.value); return true; } return e.key === "Enter"; } })
    .then(v => { if (v && v.trim()) PW.addList(v, kind); });
};
cmd({ id: "add-list", menu: "Insert", label: "From a list…", key: "Ctrl+Shift+V", enabled: () => !!B.doc, run: () => PW.listDlg() });

// ---------- pasting board items as JSON (how content made elsewhere comes in) ----------
PW.pasteJSON = function (text, at) {
  let d; try { d = JSON.parse(text); } catch (e) { return false; }
  let objs = Array.isArray(d) ? d : d && (d.objects || d.items); const links = (d && d.links) || [];
  if (!Array.isArray(objs) || !objs.length || !objs.every(o => o && typeof o === "object" && B.types[o.type])) return false;
  objs = objs.map((o, i) => Object.assign({ x: 0, y: 0 }, o, { id: o.id != null ? String(o.id) : "j" + i }));
  const x0 = Math.min(...objs.map(o => +o.x || 0)), y0 = Math.min(...objs.map(o => +o.y || 0));
  const L = links.map(l => ({ a: String(l.a ?? l.from), b: String(l.b ?? l.to), label: l.label })).filter(l => objs.some(o => o.id === l.a) && objs.some(o => o.id === l.b));
  objs.forEach(o => { if (o.parent != null) o.parent = String(o.parent); });
  const made = B.pasteObjs({ objs, links: L }, Math.round(at.x - x0), Math.round(at.y - y0), false);
  PW.map.relayoutAll(false); setTimeout(() => B.fit(made, 1), 80); toast(made.length + " items"); return true;
};

// ---------- picture export: selection or whole board as PNG ----------
let cssCache = null;
const toDataURL = blob => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
async function inlineCSS() {
  if (cssCache) return cssCache; let out = "";
  for (const href of ["vendor/katex.min.css", "app.css", "styles.css"]) {
    let t = await fetch(href).then(r => r.text()); const base = new URL(href, location.href);
    const urls = [...new Set([...t.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map(m => m[2]).filter(u => /\.woff2$/.test(u)))];
    for (const u of urls) { try { const abs = new URL(u, base).href, du = await fetch(abs).then(r => r.blob()).then(toDataURL); t = t.split(u).join(du); } catch (e) { } }
    t = t.replace(/url\((['"]?)[^'")]+\.(woff|ttf)\1\)\s*format\(['"][^'"]+['"]\),?/g, "");
    out += t + "\n";
  }
  return cssCache = out;
}
PW.exportPNG = async function (asClipboard) {
  const list = (B.sel.size ? B.selected() : all()).filter(o => !PW.map.isHidden(o)); if (!list.length) return;
  status("making picture…"); const b = B.bounds(list), pad = 30, W = Math.ceil(b.x1 - b.x0 + 2 * pad), H = Math.ceil(b.y1 - b.y0 + 2 * pad);
  const css = await inlineCSS(), r = document.documentElement, root = h("div", { xmlns: "http://www.w3.org/1999/xhtml", style: { position: "relative", width: W + "px", height: H + "px", backgroundColor: "var(--desk)", backgroundImage: "var(--pat)", backgroundSize: "var(--pat-size)", font: "13px/1.35 var(--f-ui)", color: "var(--ink)", overflow: "hidden" } });
  const wrapW = h("div", { style: { position: "absolute", left: (pad - b.x0) + "px", top: (pad - b.y0) + "px" } }); root.append(wrapW);
  const ids = new Set(list.map(o => o.id)), ed = svg.cloneNode(true); ed.style.zIndex = 1; wrapW.append(ed);
  for (const o of list) {
    const src = B.el(o.id); if (!src) continue; const c = src.cloneNode(true); c.classList.remove("sel", "flash", "off", "snap");
    const sc = src.querySelectorAll("canvas"), cc = c.querySelectorAll("canvas"); cc.forEach((x, i) => { try { const im = h("img", { src: sc[i].toDataURL("image/png"), style: { width: sc[i].clientWidth + "px", height: sc[i].clientHeight + "px", display: "block", position: getComputedStyle(sc[i]).position, inset: "0" } }); x.replaceWith(im); } catch (e) { } });
    for (const im of c.querySelectorAll("img")) { if (/^blob:/.test(im.src)) { try { im.src = await fetch(im.src).then(x => x.blob()).then(toDataURL); } catch (e) { } } }
    c.querySelectorAll("iframe").forEach(f => f.replaceWith(h("div", { style: { flex: "1", display: "grid", placeItems: "center", background: "var(--paper)", color: "var(--paper-ink)" } }, o.title || "html")));
    c.querySelectorAll(".textLayer,.rz,.ew,.cr").forEach(x => x.remove()); wrapW.append(c);
  }
  void ids;
  const attrs = `data-style="${r.dataset.style}" data-theme="${r.dataset.theme}" style="${(r.getAttribute("style") || "").replace(/"/g, "&quot;")}"`;
  const xml = new XMLSerializer().serializeToString(root);
  const svgTxt = `<svg xmlns="http://www.w3.org/2000/svg" ${attrs} width="${W}" height="${H}"><foreignObject width="100%" height="100%"><style xmlns="http://www.w3.org/1999/xhtml"><![CDATA[${css.replace(/\]\]>/g, "")}]]></style>${xml}</foreignObject></svg>`;
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgTxt);
  const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; }).catch(() => null);
  const k = Math.min(2, 12000 / Math.max(W, H)), cv = document.createElement("canvas"); cv.width = Math.round(W * k); cv.height = Math.round(H * k);
  const g = cv.getContext("2d"); g.scale(k, k); try { g.drawImage(img, 0, 0); } catch (e) { status(""); toast("picture failed"); return; }
  cv.toBlob(async blob => { status(""); if (!blob) { toast("picture failed"); return; }
    if (asClipboard) { try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); toast("picture copied"); } catch (e) { toast("copy not allowed here"); } return; }
    const a = h("a", { href: URL.createObjectURL(blob), download: (B.doc.name || "board").replace(/[\\/:*?"<>|]+/g, "-") + (B.sel.size ? " (part)" : "") + ".png" }); document.body.append(a); a.click(); a.remove(); toast("picture saved"); }, "image/png");
};
cmd({ id: "export-png", menu: "File", label: "Save as picture (selection or board)", enabled: () => !!B.doc, run: () => PW.exportPNG(false) });
cmd({ id: "copy-png", menu: "File", label: "Copy as picture", enabled: () => !!B.doc, run: () => PW.exportPNG(true) });

// ---------- ticking a checkbox in a note ("- [ ] task") ----------
world.addEventListener("pointerdown", e => {
  const ck = e.target.closest(".ck"); if (!ck || B.editing || e.button !== 0) return; const t = ck.closest(".txt[data-f]"), oe = ck.closest(".obj"); if (!t || !oe) return;
  const o = obj(oe.dataset.id); if (!o) return; e.stopPropagation(); e.preventDefault();
  const T = B.types[o.type], f = t.dataset.f, src = String((T && T.get ? T.get(o, f) : o[f]) || ""), want = +ck.dataset.k; let k = 0;
  const v = src.replace(/^(\s*[-*•] \[)([ xX])(\])/gm, (m, a, x, c) => (k++ === want ? a + (/x/i.test(x) ? " " : "x") + c : m));
  if (T && T.set) T.set(o, f, v); else o[f] = v; B.render(o); B.commit();
}, true);
