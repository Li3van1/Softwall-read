"use strict";
// pinwand · shared helpers
const PW = window.PW = {};
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const escHTML = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const debounce = (fn, ms) => { let t = 0; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.flush = (...a) => { clearTimeout(t); fn(...a); }; d.cancel = () => clearTimeout(t); return d; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
function fmtNum(v) { if (!isFinite(v)) return String(v); const a = Math.abs(v); if (a < 1e-9) return "0"; if (a >= 1e4 || a < 1e-3) return v.toExponential(2); return (+v.toPrecision(4)).toString(); }
function fmtTime(d = new Date()) { return d.toTimeString().slice(0, 8); }
function stamp(d = new Date()) { const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }
const ls = { get(k, d) { try { const v = localStorage.getItem("pinwand:" + k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("pinwand:" + k, String(v)); } catch (e) { } } };

// ---- text with formulas: $…$, $$…$$, **bold**, *italic* ----
const mathCache = new Map();
const inlineMd = s => escHTML(s).replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])\*([^*\s][^*\n]*?)\*(?=[\s.,;:!?)]|$)/g, "$1<i>$2</i>");
function mathHTML(src) {
  src = String(src ?? ""); if (mathCache.has(src)) return mathCache.get(src);
  let txt = "", i = 0, m; const parts = [], re = /\$\$([\s\S]+?)\$\$|\$((?:\\\$|[^$\n])+?)\$/g;
  while ((m = re.exec(src))) {
    const disp = m[1] != null, tex = disp ? m[1] : m[2]; let out;
    try { out = window.katex ? katex.renderToString(tex, { displayMode: disp, throwOnError: false, output: "html", strict: false }) : escHTML(m[0]); } catch (e) { out = escHTML(m[0]); }
    txt += src.slice(i, m.index).replace(/[\u0001\u0002]/g, "") + "\u0001" + parts.length + "\u0002"; parts.push(out); i = re.lastIndex;
  }
  txt += src.slice(i).replace(/[\u0001\u0002]/g, "");
  const html = inlineMd(txt).replace(/\u0001(\d+)\u0002/g, (_, k) => parts[+k]);
  if (mathCache.size > 5000) mathCache.clear(); mathCache.set(src, html); return html;
}
function setRich(el, src) { src = String(src ?? ""); if (el._src === src) return; el._src = src; el.innerHTML = mathHTML(src); }
function texPlain(s) {
  return String(s ?? "").replace(/\$\$?([^$]*)\$\$?/g, (_, t) => t.replace(/\\(dot|ddot|mathbf|mathrm|text|operatorname)\{([^}]*)\}/g, "$2").replace(/\\([a-zA-Z]+)/g, (m, w) => ({ alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", epsilon: "ε", varepsilon: "ε", lambda: "λ", mu: "μ", omega: "ω", theta: "θ", tau: "τ", pi: "π", sigma: "σ", phi: "φ", to: "→", infty: "∞", le: "≤", ge: "≥", ne: "≠", pm: "±", cdot: "·", times: "×", approx: "≈", in: "∈", mathbb: "" }[w] ?? "")).replace(/[{}^_]/g, "")).replace(/\*\*|__/g, "").replace(/\s+/g, " ").trim();
}

// ---- toast, dialogs ----
let toastT = 0;
function toast(msg, ms = 2200) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms); }
function status(msg) { $("sMsg").textContent = msg || ""; }
// a retro modal dialog; resolves with the value given to close()
function dialog({ title, body, buttons = [], onKey, width, init }) {
  return new Promise(resolve => {
    const bd = h("div", { class: "bd" }), bt = h("div", { class: "bt" });
    const dlg = h("div", { class: "dlg bevel", role: "dialog", "aria-modal": "true", style: width ? { width } : null }, h("div", { class: "wt", text: title || "pinwand" }), bd, bt);
    const ov = h("div", { class: "modal" }, dlg);
    if (typeof body === "string") bd.append(h("pre", { text: body })); else if (body) bd.append(body);
    let done = false; const close = v => { if (done) return; done = true; ov.remove(); document.removeEventListener("keydown", kd, true); resolve(v); };
    buttons.forEach(b => bt.append(h("button", { class: "b", onclick: () => close(typeof b.value === "function" ? b.value() : b.value), html: b.html || escHTML(b.label) })));
    const kd = e => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); close(undefined); return; } if (onKey && onKey(e, close)) return;
      if (e.key === "Enter" && !(e.target && e.target.tagName === "TEXTAREA") && buttons.length) { const def = buttons.find(b => b.def) || buttons[buttons.length - 1]; e.preventDefault(); close(typeof def.value === "function" ? def.value() : def.value); } };
    document.addEventListener("keydown", kd, true);
    ov.addEventListener("pointerdown", e => { if (e.target === ov) close(undefined); });
    document.body.append(ov); if (init) init(dlg, close);
    setTimeout(() => { const f = dlg.querySelector("input,textarea,select") || bt.lastChild; f && f.focus(); }, 0);
  });
}
const alertDlg = (title, text) => dialog({ title, body: text, buttons: [{ label: "OK", value: true, def: true }] });
const confirmDlg = (title, text, ok = "OK") => dialog({ title, body: text, buttons: [{ label: "Cancel", value: false }, { label: ok, value: true, def: true }] });
function promptDlg(title, label, value = "", multiline = false) {
  const inp = multiline ? h("textarea", { class: "f", rows: 12, style: { width: "min(560px,80vw)", fontFamily: "inherit" } }) : h("input", { class: "f", type: "text", style: { width: "min(420px,80vw)" } });
  inp.value = value;
  return dialog({ title, body: h("div", { style: { display: "grid", gap: "6px" } }, label ? h("label", { text: label }) : null, inp), buttons: [{ label: "Cancel", value: undefined }, { label: "OK", value: () => inp.value, def: true }] });
}

// ---- command registry: menus, palette, keys all come from here ----
PW.cmds = new Map();
function cmd(def) { PW.cmds.set(def.id, def); return def; }
function run(id, ...a) { const c = PW.cmds.get(id); if (!c) return; if (c.enabled && !c.enabled()) return; return c.run(...a); }
