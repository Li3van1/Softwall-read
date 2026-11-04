"use strict";
// pinwand · tables: cells with formulas, header row, column widths, covering columns to test yourself, paste from Excel / Word / markdown
const TBL = PW.table = {};
const cellId = (r, c) => `c${r}_${c}`;
const parseCell = f => { const m = /^c(\d+)_(\d+)$/.exec(f || ""); return m ? [+m[1], +m[2]] : null; };
const ncols = o => Math.max(1, ...o.rows.map(r => r.length));
function norm(o) {
  if (!Array.isArray(o.rows) || !o.rows.length) o.rows = [["", "", ""], ["", "", ""], ["", "", ""]];
  const n = ncols(o); o.rows.forEach(r => { while (r.length < n) r.push(""); });
  if (!Array.isArray(o.colW) || o.colW.length !== n) { const w = Math.max(60, Math.round(((o.w || 480) - 2) / n)); o.colW = Array.from({ length: n }, (_, i) => (o.colW && o.colW[i]) || w); }
  if (o.head == null) o.head = true; if (!Array.isArray(o.cover)) o.cover = [];
  const sum = o.colW.reduce((a, b) => a + b, 0);
  if (o.w && Math.abs(sum + 2 - o.w) > 1) { const k = (o.w - 2) / sum; o.colW = o.colW.map(w => Math.max(36, Math.round(w * k))); }
  o.w = o.colW.reduce((a, b) => a + b, 0) + 2;
  return o;
}
TBL.norm = norm;
const curCell = o => { if (B.editing && B.editing.o === o) { const p = parseCell(B.editing.field); if (p) return p; } const e = B.el(o.id); const c = e && e._cur; return c && c[0] < o.rows.length && c[1] < ncols(o) ? c : [0, 0]; };
TBL.cur = () => { const o = B.editing ? B.editing.o : B.cur(); return o && o.type === "table" ? o : null; };

B.types.table = {
  minW: 120, editField: "c0_0",
  create(o) {
    const e = h("div", { class: "card tbl" },
      h("div", { class: "hd" }, h("span", { class: "tt", text: "TABLE" }), h("span", { class: "sp" }),
        ...[["r+", "row below"], ["c+", "column right"], ["r-", "delete row"], ["c-", "delete column"], ["hd", "header row"], ["cv", "cover this column (test yourself)"]]
          .map(([a, t]) => h("button", { class: "tb nodrag", type: "button", "data-a": a, title: t, text: { "r+": "+row", "c+": "+col", "r-": "−row", "c-": "−col", hd: "head", cv: "cover" }[a] }))),
      h("div", { class: "tw" }, h("table")), h("div", { class: "ew" }));
    const L = () => obj(e.dataset.id);
    e.querySelector(".hd").addEventListener("click", ev => { const b = ev.target.closest("button[data-a]"); if (!b) return; ev.stopPropagation(); const o2 = L(); B.select([o2.id]); TBL.op(o2, b.dataset.a); });
    e.addEventListener("pointerdown", ev => { const td = ev.target.closest("td[data-r]"); if (td) e._cur = [+td.dataset.r, +td.dataset.c]; markCur(e); }, true);
    e.addEventListener("click", ev => { const td = ev.target.closest("td.cv"); if (td && !(B.editing && B.editing.e === e)) td.classList.toggle("peek"); });
    // drag a column border to change its width
    e.addEventListener("pointerdown", ev => {
      const cr = ev.target.closest(".cr"); if (!cr) return; ev.stopPropagation(); ev.preventDefault();
      const o2 = L(), c = +cr.dataset.c, x0 = ev.clientX, w0 = o2.colW[c]; cr.setPointerCapture(ev.pointerId);
      const mv = m => { o2.colW[c] = Math.max(36, Math.round(w0 + (m.clientX - x0) / B.view.z)); o2.w = o2.colW.reduce((a, b) => a + b, 0) + 2; B.render(o2); B.renderEdges(); };
      const up = () => { cr.removeEventListener("pointermove", mv); cr.removeEventListener("pointerup", up); B.commit(); };
      cr.addEventListener("pointermove", mv); cr.addEventListener("pointerup", up);
    });
    return e;
  },
  update(o, e) {
    norm(o); const tb = e.querySelector("table"), n = ncols(o), sig = [o.rows.length, n, o.head, o.cover.join(",")].join("|");
    e.style.width = o.w + "px";
    if (e._sig !== sig) {
      e._sig = sig; tb.innerHTML = "";
      const cg = h("colgroup"); o.colW.forEach(w => cg.append(h("col", { style: { width: w + "px" } }))); tb.append(cg);
      o.rows.forEach((row, r) => { const tr = h("tr", { class: r === 0 && o.head ? "th" : "" });
        for (let c = 0; c < n; c++) { const cov = o.cover.includes(c) && !(r === 0 && o.head);
          tr.append(h("td", { "data-r": r, "data-c": c, class: cov ? "cv" : "" }, h("div", { class: "txt", "data-f": cellId(r, c) }), r === 0 ? h("span", { class: "cr nodrag", "data-c": c }) : null)); }
        tb.append(tr); });
    }
    tb.querySelectorAll("col").forEach((c, i) => { c.style.width = o.colW[i] + "px"; });
    tb.querySelectorAll(".txt[data-f]").forEach(t => { if (B.editing && B.editing.t === t) return; const p = parseCell(t.dataset.f); setRich(t, (o.rows[p[0]] || [])[p[1]] || ""); });
    e.querySelector('[data-a="hd"]').setAttribute("aria-pressed", String(!!o.head));
    const cc = curCell(o); e.querySelector('[data-a="cv"]').setAttribute("aria-pressed", String(o.cover.includes(cc[1])));
    markCur(e); chipFor(o, e);
  },
  get(o, f) { const p = parseCell(f); return p && o.rows[p[0]] ? o.rows[p[0]][p[1]] || "" : ""; },
  set(o, f, v) { const p = parseCell(f); if (p && o.rows[p[0]]) o.rows[p[0]][p[1]] = v; },
  onEdit(o, e, f) { const p = parseCell(f); if (p) { e._cur = p; markCur(e); const td = e.querySelector(`td[data-r="${p[0]}"][data-c="${p[1]}"]`); td && td.classList.add("peek"); } },
  // pasting several cells while editing one: fill the table from there, growing it when needed
  paste(ev) {
    const ed = B.editing, text = ev.clipboardData.getData("text/plain"), p = parseCell(ed.field); if (!p || !/[\t\n]/.test(text.trim())) return false;
    const g = TBL.parse(text); if (!g) return false; const o = ed.o; B.endEdit(false);
    g.forEach((row, i) => { const r = p[0] + i; while (o.rows.length <= r) o.rows.push(Array(ncols(o)).fill("")); row.forEach((v, j) => { const c = p[1] + j; if (c >= ncols(o)) addCol(o, ncols(o) - 1); o.rows[r][c] = v; }); });
    B.render(o); B.renderEdges(); B.commit(); toast(g.length + " × " + g[0].length + " cells"); return true;
  },
  text: o => (o.rows || []).map(r => r.join("\t")).join("\n"),
};
function markCur(e) { e.querySelectorAll("td.cur").forEach(t => t.classList.remove("cur")); const c = e._cur; if (!c || !e.classList.contains("sel")) return; const td = e.querySelector(`td[data-r="${c[0]}"][data-c="${c[1]}"]`); td && td.classList.add("cur"); }
const prevSelT = B.onSel; B.onSel = () => { prevSelT && prevSelT(); document.querySelectorAll(".obj.tbl").forEach(markCur); };
function addCol(o, after) { o.rows.forEach(r => r.splice(after + 1, 0, "")); o.colW.splice(after + 1, 0, Math.round(o.colW[after] || 120)); o.cover = o.cover.map(c => c > after ? c + 1 : c); o.w = o.colW.reduce((a, b) => a + b, 0) + 2; }

TBL.op = function (o, a, arg) {
  if (!o) return; const ed = B.editing && B.editing.o === o ? B.editing.field : null; if (B.editing) B.endEdit(false);
  norm(o); let [r, c] = curCell(o); const n = ncols(o), e = B.el(o.id); let edit = null;
  if (a === "r+") { o.rows.splice(r + 1, 0, Array(n).fill("")); r++; edit = [r, c]; }
  if (a === "r^") { o.rows.splice(r, 0, Array(n).fill("")); edit = [r, c]; }
  if (a === "c+") { addCol(o, c); c++; edit = [r, c]; }
  if (a === "c<") { addCol(o, c - 1); edit = [r, c]; }
  if (a === "r-") { if (o.rows.length > 1) { o.rows.splice(r, 1); r = Math.min(r, o.rows.length - 1); } }
  if (a === "c-") { if (n > 1) { o.rows.forEach(x => x.splice(c, 1)); o.colW.splice(c, 1); o.cover = o.cover.filter(x => x !== c).map(x => x > c ? x - 1 : x); c = Math.min(c, n - 2); o.w = o.colW.reduce((p, q) => p + q, 0) + 2; } }
  if (a === "ru" && r > (o.head ? 1 : 0)) { [o.rows[r - 1], o.rows[r]] = [o.rows[r], o.rows[r - 1]]; r--; }
  if (a === "rd" && r < o.rows.length - 1 && !(o.head && r === 0)) { [o.rows[r + 1], o.rows[r]] = [o.rows[r], o.rows[r + 1]]; r++; }
  if (a === "cl" && c > 0) { o.rows.forEach(x => [x[c - 1], x[c]] = [x[c], x[c - 1]]); [o.colW[c - 1], o.colW[c]] = [o.colW[c], o.colW[c - 1]]; o.cover = o.cover.map(x => x === c ? c - 1 : x === c - 1 ? c : x); c--; }
  if (a === "cr" && c < n - 1) { o.rows.forEach(x => [x[c + 1], x[c]] = [x[c], x[c + 1]]); [o.colW[c + 1], o.colW[c]] = [o.colW[c], o.colW[c + 1]]; o.cover = o.cover.map(x => x === c ? c + 1 : x === c + 1 ? c : x); c++; }
  if (a === "hd") o.head = !o.head;
  if (a === "cv") { o.cover = o.cover.includes(c) ? o.cover.filter(x => x !== c) : [...o.cover, c]; }
  if (a === "uncover") { o.cover = []; }
  if (a === "sort") { const start = o.head ? 1 : 0, body = o.rows.slice(start), key = v => { const t = texPlain(v), x = parseFloat(t.replace(",", ".")); return isFinite(x) && /^[\s\d.,+\-e]+$/i.test(t) ? x : t.toLowerCase(); };
    const asc = !(o._sorted === c + "a"); body.sort((p, q) => { const A = key(p[c]), Bq = key(q[c]); return (A < Bq ? -1 : A > Bq ? 1 : 0) * (asc ? 1 : -1); }); o.rows = o.rows.slice(0, start).concat(body); o._sorted = c + (asc ? "a" : "d"); }
  if (a === "fit") { const m = document.createElement("canvas").getContext("2d"); m.font = "14px " + getComputedStyle(document.documentElement).getPropertyValue("--f-text");
    o.colW = o.colW.map((w, j) => Math.max(60, Math.min(420, 24 + Math.max(...o.rows.map(x => Math.max(...String(texPlain(x[j] || "")).split("\n").map(l => m.measureText(l).width))))))); o.w = o.colW.reduce((p, q) => p + q, 0) + 2; }
  if (e) e._cur = [r, c]; B.render(o); B.renderEdges(); B.commit(); PW.map && PW.map.relayoutSoon(o);
  if (edit) setTimeout(() => B.edit(o, cellId(edit[0], edit[1])), 0); else if (ed && a !== "r-" && a !== "c-") setTimeout(() => B.edit(o, cellId(r, c)), 0);
};
// moving between cells while typing
TBL.key = function (ev) {
  const ed = B.editing, o = ed.o, p = parseCell(ed.field); if (!p) return false; let [r, c] = p; const n = ncols(o), k = ev.key;
  const go = (r2, c2) => { B.endEdit(); if (r2 >= o.rows.length) { o.rows.push(Array(n).fill("")); B.render(o); B.commit(); PW.map && PW.map.relayoutSoon(o); } const e = B.el(o.id); if (e) e._cur = [r2, c2]; B.edit(o, cellId(r2, c2)); };
  if (k === "Tab") { ev.preventDefault(); if (ev.shiftKey) { if (c > 0) go(r, c - 1); else if (r > 0) go(r - 1, n - 1); } else { if (c < n - 1) go(r, c + 1); else go(r + 1, 0); } return true; }
  if (k === "Enter" && !ev.shiftKey && !ev.ctrlKey) { ev.preventDefault(); go(r + 1, c); return true; }
  const sel = getSelection(), atStart = sel.anchorOffset === 0 && sel.isCollapsed, txt = ed.t.innerText.replace(/\n$/, ""), atEnd = sel.isCollapsed && (sel.anchorNode === ed.t ? sel.anchorOffset >= ed.t.childNodes.length : sel.anchorOffset >= (sel.anchorNode.textContent || "").length) && !txt.includes("\n");
  if (k === "ArrowUp" && r > 0 && !txt.includes("\n")) { ev.preventDefault(); go(r - 1, c); return true; }
  if (k === "ArrowDown" && r < o.rows.length - 1 && !txt.includes("\n")) { ev.preventDefault(); go(r + 1, c); return true; }
  if (k === "ArrowLeft" && atStart && c > 0) { ev.preventDefault(); go(r, c - 1); return true; }
  if (k === "ArrowRight" && atEnd && c < n - 1) { ev.preventDefault(); go(r, c + 1); return true; }
  return false;
};
// ---------- tables from text: tab separated (Excel, Word, Sheets) or markdown ----------
TBL.parse = function (text) {
  const lines = text.replace(/\r/g, "").split("\n").filter((l, i, a) => l.trim() || (i > 0 && i < a.length - 1));
  if (!lines.length) return null;
  if (lines.filter(l => /^\s*\|.*\|\s*$/.test(l)).length >= Math.max(2, lines.length - 1)) {
    return lines.filter(l => !/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l)).map(l => l.trim().replace(/^\||\|$/g, "").split("|").map(x => x.trim()));
  }
  if (lines.some(l => l.includes("\t"))) return lines.map(l => l.split("\t").map(x => x.trim()));
  return null;
};
TBL.looksLike = text => { const t = text.trim(); if (!t.includes("\n")) return false; const g = TBL.parse(t); return !!(g && g.length >= 2 && Math.max(...g.map(r => r.length)) >= 2); };
TBL.fromText = function (text, at) { const g = TBL.parse(text.trim()); if (!g) return null; const n = Math.max(...g.map(r => r.length)); g.forEach(r => { while (r.length < n) r.push(""); });
  const o = B.add({ type: "table", x: Math.round(at.x), y: Math.round(at.y), rows: g, head: true, w: Math.min(1200, n * 160 + 2) }); TBL.op(o, "fit"); toast(g.length + " rows · " + n + " columns"); return o; };
TBL.toText = (o, md) => md ? o.rows.map((r, i) => "| " + r.join(" | ") + " |" + (i === 0 && o.head ? "\n|" + r.map(() => " --- |").join("") : "")).join("\n") : o.rows.map(r => r.join("\t")).join("\n");
TBL.create = function (at, cols = 3, rows = 3) { at = at || PW.mouseWorld(); const o = B.add({ type: "table", x: Math.round(at.x), y: Math.round(at.y), rows: Array.from({ length: rows }, () => Array(cols).fill("")), head: true, w: cols * 150 + 2 }, { edit: "c0_0" }); return o; };
