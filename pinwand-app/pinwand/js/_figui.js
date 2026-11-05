
// ---------- pinwand: live figure cards (engine above, from the course board) ----------
function figColors() {
  const cs = getComputedStyle(document.documentElement), v = k => cs.getPropertyValue(k).trim();
  return { fg: v("--paper-ink"), muted: v("--lo"), line: v("--lo"), accent: v("--b5"), panel: v("--paper"), bg: v("--field"), good: v("--good"), again: v("--due"), half: "#c08a10", blue: v("--b1"), purple: v("--b5"), pink: v("--hit") };
}
const FIG_TAG = { flow: "1D flow  ẋ = f(x)", map: "1D map  xₙ₊₁ = f(xₙ)", plane: "2D flow  ẋ = f, ẏ = g" };
const figH = o => o.ft === "map" ? 540 : o.ft === "plane" ? 460 : (o.w < 580 ? 470 : 280) + flowBifH(o);
const figPresets = o => o.ft === "map" ? MAP_PRESETS : o.ft === "plane" ? PLANE_PRESETS : FLOW_PRESETS;
function figDefaults(ft) {
  const P = (ft === "map" ? MAP_PRESETS : ft === "plane" ? PLANE_PRESETS : FLOW_PRESETS)[0];
  const o = { type: "fig", ft, w: ft === "flow" ? 640 : 760, pmin: 0, pmax: 1, p: .5, x0: ft === "map" ? .2 : null, y0: null, steps: 100, tmax: 6 };
  if (ft === "plane") Object.assign(o, { f: P.f, g: P.g, xmin: P.xmin, xmax: P.xmax, ymin: P.ymin, ymax: P.ymax, tmax: P.tmax });
  else Object.assign(o, { expr: P.expr, xmin: P.xmin, xmax: P.xmax, tmax: P.tmax ?? 6, steps: P.steps ?? 100 }, P.pmin != null ? { pmin: P.pmin, pmax: P.pmax, p: P.p } : {}, P.x0 != null ? { x0: P.x0 } : {});
  return o;
}
B.types.fig = {
  minW: 420,
  create(o) {
    const plane = o.ft === "plane";
    const e = h("div", { class: "win fig" }, h("div", { class: "wt" }, h("span", { class: "nm" })),
      h("div", { class: "fctl" },
        plane ? [h("span", {}, "ẋ ="), h("input", { class: "f ex", "data-k": "f", spellcheck: "false" }), h("span", {}, "ẏ ="), h("input", { class: "f ex", "data-k": "g", spellcheck: "false" })]
          : [h("span", {}, o.ft === "map" ? "f(x) =" : "ẋ ="), h("input", { class: "f ex", "data-k": "expr", spellcheck: "false" })],
        h("select", { class: "f pre", "aria-label": "examples" })),
      h("div", { class: "fctl prow" }, h("span", { class: "pn" }), h("input", { type: "range", class: "pr", step: "any" }), h("span", { class: "pv" }),
        h("input", { class: "f num", "data-k": "pmin" }), h("span", {}, "–"), h("input", { class: "f num", "data-k": "pmax" })),
      h("div", { class: "fctl" }, h("span", {}, "x"), h("input", { class: "f num", "data-k": "xmin" }), h("span", {}, "–"), h("input", { class: "f num", "data-k": "xmax" }),
        plane ? [h("span", {}, "y"), h("input", { class: "f num", "data-k": "ymin" }), h("span", {}, "–"), h("input", { class: "f num", "data-k": "ymax" })] : null,
        o.ft === "map" ? [h("span", {}, "n ≤"), h("input", { class: "f num", "data-k": "steps" })] : [h("span", {}, "t ≤"), h("input", { class: "f num", "data-k": "tmax" })]),
      h("canvas"), h("div", { class: "finfo" }), h("div", { class: "ew" }));
    const L = () => obj(e.dataset.id);
    let tm = 0; e.querySelectorAll("input.ex").forEach(i => i.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => { const x = L(); x[i.dataset.k] = i.value; if (plane) { x.x0 = x.y0 = null; } figDirty(e); B.commit(); }, 300); }));
    e.querySelectorAll("input.num").forEach(i => i.addEventListener("change", () => { const x = L(), v = parseFloat(String(i.value).replace(",", ".")); if (isFinite(v)) { x[i.dataset.k] = i.dataset.k === "steps" ? Math.round(clamp(v, 5, 500)) : v; }
      if (x.xmax <= x.xmin) x.xmax = x.xmin + 1; if (x.pmax <= x.pmin) x.pmax = x.pmin + 1; if (plane && x.ymax <= x.ymin) x.ymax = x.ymin + 1; x.p = clamp(x.p, x.pmin, x.pmax); B.render(x); figDirty(e); B.commit(); }));
    e.querySelector(".pr").addEventListener("input", ev => { const x = L(); x.p = +ev.target.value; e.querySelector(".pv").textContent = fmt(x.p); figDirty(e); });
    e.querySelector(".pr").addEventListener("change", () => B.commit());
    e.querySelector(".pre").addEventListener("change", ev => { const P = figPresets(L())[+ev.target.value]; if (!P) return; const x = L();
      if (plane) Object.assign(x, { f: P.f, g: P.g, xmin: P.xmin, xmax: P.xmax, ymin: P.ymin, ymax: P.ymax, tmax: P.tmax, x0: null, y0: null });
      else Object.assign(x, { expr: P.expr, xmin: P.xmin, xmax: P.xmax, tmax: P.tmax ?? x.tmax, steps: P.steps ?? x.steps }, P.x0 != null ? { x0: P.x0 } : {});
      if (P.pmin != null) Object.assign(x, { pmin: P.pmin, pmax: P.pmax, p: P.p }); B.render(x); figDirty(e); B.commit(); ev.target.blur(); });
    const cv = e.querySelector("canvas"); let dragging = false;
    const pick = ev => { const x = L(), P = cv._panels; if (!P) return; const r = cv.getBoundingClientRect(), k = cv.clientWidth / r.width, mx = (ev.clientX - r.left) * k, my = (ev.clientY - r.top) * k;
      for (const p of P) { if (mx < p.x || mx > p.x + p.w || my < p.y || my > p.y + p.h) continue; const v = p.xr[0] + (mx - p.x) / p.w * (p.xr[1] - p.xr[0]);
        if (p.role === "param" && p.hasParam) { x.p = +clamp(v, x.pmin, x.pmax).toPrecision(5); e.querySelector(".pr").value = x.p; e.querySelector(".pv").textContent = fmt(x.p); figDirty(e); }
        if (p.role === "x0") { x.x0 = +clamp(v, x.xmin, x.xmax).toPrecision(5); figDirty(e); }
        if (p.role === "start") { x.x0 = +v.toPrecision(4); x.y0 = +(p.yr[1] - (my - p.y) / p.h * (p.yr[1] - p.yr[0])).toPrecision(4); figDirty(e); } } };
    cv.addEventListener("pointerdown", ev => { ev.stopPropagation(); dragging = true; cv.setPointerCapture(ev.pointerId); pick(ev); });
    cv.addEventListener("pointermove", ev => { if (dragging) pick(ev); });
    cv.addEventListener("pointerup", () => { if (dragging) { dragging = false; B.commit(); } });
    e.querySelector(".fctl").addEventListener("keydown", ev => ev.stopPropagation());
    e.addEventListener("keydown", ev => { if (ev.target.matches("input,select")) ev.stopPropagation(); });
    return e;
  },
  update(o, e) {
    e.querySelector(".nm").textContent = o.title || FIG_TAG[o.ft] || "live figure";
    const set = (k, v) => { const i = e.querySelector(`[data-k="${k}"]`); if (i && document.activeElement !== i) i.value = v; };
    ["expr", "f", "g"].forEach(k => o[k] != null && set(k, o[k])); ["pmin", "pmax", "xmin", "xmax", "ymin", "ymax", "tmax", "steps"].forEach(k => o[k] != null && set(k, fmt(o[k])));
    const pre = e.querySelector(".pre"), list = figPresets(o); if (!pre._f) { pre._f = 1; pre.innerHTML = `<option value="-1">examples…</option>` + list.map((p, i) => `<option value="${i}">${escHTML(p.name)}</option>`).join(""); }
    const key = o.ft === "plane" ? normExpr(o.f) + "|" + normExpr(o.g) : normExpr(o.expr); pre.value = String(list.findIndex(p => (p.f != null ? normExpr(p.f) + "|" + normExpr(p.g) : normExpr(p.expr)) === key && p.xmin === o.xmin));
    const r = e.querySelector(".pr"); r.min = o.pmin; r.max = o.pmax; r.step = (o.pmax - o.pmin) / 1000; if (document.activeElement !== r) r.value = o.p;
    e.querySelector(".pv").textContent = fmt(o.p);
    const cv = e.querySelector("canvas"); cv.style.height = figH(o) + "px";
    const sig = [o.expr, o.f, o.g, o.p, o.pmin, o.pmax, o.xmin, o.xmax, o.ymin, o.ymax, o.x0, o.y0, o.tmax, o.steps, o.w].join("|");
    if (e._sig !== sig) { e._sig = sig; figDirty(e); }
  },
  text: o => [o.title, o.expr, o.f, o.g].filter(Boolean).join(" "),
};
function figDirty(e) { if (e._raf) return; e._raf = requestAnimationFrame(() => { e._raf = 0; figDraw(e); }); }
PW.figRedraw = () => document.querySelectorAll(".obj.fig").forEach(figDirty);
function figDraw(e) {
  const o = obj(e.dataset.id); if (!o) return; const cv = e.querySelector("canvas"), W = Math.max(300, cv.clientWidth || o.w - 8), H = figH(o), res = Math.min(3, (devicePixelRatio || 1) * clamp(B.view.z, .6, 2));
  if (cv.width !== Math.round(W * res) || cv.height !== Math.round(H * res)) { cv.width = Math.round(W * res); cv.height = Math.round(H * res); }
  const g = cv.getContext("2d"); g.setTransform(res, 0, 0, res, 0, 0); const C = figColors(); g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  const info = e.querySelector(".finfo"), prow = e.querySelector(".prow");
  try {
    if (o.ft === "plane") { const PF = parseExpr(o.f, true), PG = parseExpr(o.g, true); if (PF.param && PG.param && PF.param !== PG.param) throw new Error("only one parameter is possible");
      const pn = PF.param || PG.param; prow.hidden = !pn; if (pn) e.querySelector(".pn").textContent = (pn === "mu" ? "μ" : pn) + " ="; drawPlane(g, W, H, o, PF, PG, C, info, cv); }
    else { const F = parseExpr(o.expr); prow.hidden = !F.param; if (F.param) e.querySelector(".pn").textContent = (F.param === "mu" ? "μ" : F.param) + " =";
      (o.ft === "map" ? drawMap : drawFlow)(g, W, H, o, F, C, info, cv); }
  } catch (err) { info.innerHTML = `<span class="ferr">${escHTML(err.message)}</span>`; cv._panels = null; }
}
let figZ = 0; const prevView = B.onView; B.onView = () => { prevView && prevView(); clearTimeout(figZ); figZ = setTimeout(PW.figRedraw, 250); };
PW.newFig = (ft, at) => { at = at || B.center(); const o = figDefaults(ft); o.x = Math.round(at.x - o.w / 2); o.y = Math.round(at.y - 200); return B.add(o); };
