"use strict";
// pinwand · import an old course board (the single-file .html or its .json export) with all progress
PW.importOld = async function (file) {
  const text = await file.text(); let data;
  if (/^\s*[{[]/.test(text)) data = JSON.parse(text);
  else { const m = text.match(/<script type="application\/json" id="saved">([\s\S]*?)<\/script>/); if (!m) throw new Error("no board data found in this file"); data = JSON.parse(m[1]); }
  if (data.format === "pinwand") return { doc: data, name: data.name };
  const old = (data.notes || []).filter(n => n && typeof n.x === "number"), links = data.links || [];
  const isRead = n => n.rd || /:read:/.test(n.uid || "");
  // sections: every top heading owns the items below / to the right of it (same rule as the old board)
  const heads = old.filter(n => n.hs === 1 && n.kind !== "cross"), owner = new Map();
  for (const n of old) { if (n.hs === 1) continue; let best = null, bs = 1e12; for (const hd of heads) { const dy = n.y - hd.y, dx = n.x - hd.x; if (dy < -20 || dx < -60) continue; const sc = dy + 2 * Math.max(0, dx); if (sc < bs) { bs = sc; best = hd; } } if (best) owner.set(n.id, best.id); }
  const keep = old.filter(n => !isRead(n) && n.kind !== "cross" && !(n.hs === 2 && /^Read\b/.test(n.t || "")));
  // close the gap the reading columns leave behind
  for (const hd of heads) { const its = keep.filter(n => owner.get(n.id) === hd.id); if (!its.length) continue; const minX = Math.min(...its.map(n => n.x)); const dx = minX - hd.x; if (dx > 200) its.forEach(n => n.x -= dx - 40); }
  const objs = [], idm = {}; let k = 1; const nid = () => "o" + (k++);
  const colorOf = c => ({ yellow: "yellow", pink: "pink", green: "green", blue: "blue", orange: "yellow", purple: "pink", none: "none" }[c] || "yellow");
  const toBlob = async u => (await fetch(u)).blob();
  for (const n of keep) {
    if (n.hs === 1) continue; const id = nid(); idm[n.id] = id; let o = null;
    if (n.kind === "def") o = { type: "def", term: n.term || "", def: n.def || "", src: n.src || "", w: Math.round((n.w || 340) * (n.sc || 1)), box: n.box, due: n.due, reps: n.reps, lap: n.lap, seen: n.seen, copy: !!n.copy, _key: "d|" + (n.term || "").trim() + "|" + (n.def || "").trim(), added: n.added };
    else if (n.kind === "q") o = { type: "q", qt: n.qt || "concept", q: n.q || "", a: n.a || "", src: n.src || "", w: n.w || 380, box: n.box, due: n.due, reps: n.reps, lap: n.lap, seen: n.seen, copy: !!n.copy, _key: "q|" + (n.q || "").trim() + "|" + (n.a || "").trim(), added: n.added };
    else if (n.kind === "fig" && n.ft !== "circle") { o = { type: "fig", ft: n.ft || "flow", w: Math.max(480, n.w || 640), title: n.title || "" }; ["expr", "f", "g", "xmin", "xmax", "ymin", "ymax", "pmin", "pmax", "p", "x0", "y0", "steps", "tmax"].forEach(f => { if (n[f] != null) o[f] = n[f]; }); }
    else if (n.kind === "fig") o = { type: "note", color: "white", w: 300, text: "**" + (n.title || "unit circle") + "**" };
    else if (n.kind === "ex") o = { type: "note", color: "white", w: n.w || 400, text: `**${n.title || "Exercise"}**${n.done ? "  ✓" : ""}\n${n.task || ""}` };
    else if (n.kind === "table") { const rows = (n.rows || []).map(r => r.map(x => String(x ?? "").trim())), cw = Array.isArray(n.cw) ? n.cw.slice() : null; o = { type: "table", rows, head: true, colW: cw, w: cw ? cw.reduce((a, b) => a + b, 0) + 2 : (n.w || 480) }; }
    else if (n.img) { const a = await PW.store.putAsset(await toBlob(n.img), "picture.png"); o = { type: "image", asset: a.file, w: n.w || 400, h: n.h || 300, bg: !!n.bg }; }
    else o = { type: "note", color: colorOf(n.c), text: n.t || "", w: n.w || 200, style: n.hs === 2 ? "h2" : undefined };
    if (n.hs === 2) { o.color = "none"; o.style = "h2"; o.w = Math.max(o.w, 400); }
    Object.assign(o, { id, x: Math.round(n.x), y: Math.round(n.y) }); objs.push(o);
    if ((n.kind === "def" || n.kind === "q") && Array.isArray(n.imgs)) for (const [i, u] of n.imgs.entries()) { if (typeof u !== "string" || !u.startsWith("data:")) continue; const a = await PW.store.putAsset(await toBlob(u), "photo.png"); objs.push({ id: nid(), type: "image", asset: a.file, x: Math.round(n.x), y: Math.round(n.y + 160 + i * 210), w: 280, h: 200 }); }
  }
  // copies (memory palace) point at their original, which keeps the review progress
  const orig = new Map(); objs.forEach(o => { if (o._key && !o.copy && !orig.has(o._key)) orig.set(o._key, o.id); });
  objs.forEach(o => { if (o._key) { if (o.copy) { o.of = orig.get(o._key); if (!o.of) o.copy = false; } delete o._key; } if (!o.added) delete o.added; });
  // frames for the old sections
  const frames = [];
  for (const hd of heads) { const its = objs.filter(o => { const src = keep.find(n => idm[n.id] === o.id); return src && owner.get(src.id) === hd.id; }); if (!its.length) continue;
    const est = o => ({ w: o.w, h: o.type === "fig" ? 700 : o.type === "image" ? o.h : o.type === "def" ? 130 : o.type === "q" ? 110 : 120 });
    const x0 = Math.min(...its.map(o => o.x)) - 40, y0 = Math.min(...its.map(o => o.y)) - 50, x1 = Math.max(...its.map(o => o.x + est(o).w)) + 40, y1 = Math.max(...its.map(o => o.y + est(o).h)) + 60;
    frames.push({ id: nid(), type: "frame", title: (hd.t || "").split("\n")[0], x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0), _its: its.map(o => o.id) }); }
  const L = links.filter(l => idm[l.a] && idm[l.b]).map((l, i) => ({ id: "l" + (k + i + 1), a: idm[l.a], b: idm[l.b] }));
  const doc = Object.assign(newDoc(file.name.replace(/\.(html?|json)$/i, "")), { objects: frames.concat(objs), links: L, importedFrom: file.name, view: data.view || { x: 80, y: 80, z: .3 } });
  return { doc, name: doc.name, stats: { objects: objs.length, frames: frames.length, links: L.length, progress: objs.filter(o => o.reps).length, dropped: old.length - keep.length } };
};

// after the first render: frames hug their content exactly
PW.fitImportedFrames = function () {
  let n = 0; for (const f of all()) { if (!f._its) continue; const its = f._its.map(obj).filter(Boolean); delete f._its; const b = B.bounds(its); if (!b) continue;
    f.x = Math.round(b.x0 - 40); f.y = Math.round(b.y0 - 50); f.w = Math.round(b.x1 - b.x0 + 80); f.h = Math.round(b.y1 - b.y0 + 90); B.render(f); n++; }
  return n;
};
