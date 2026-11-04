"use strict";
// pinwand · storage: a workspace folder on disk (File System Access) or the app's own storage (OPFS)
// Layout inside the workspace:
//   <board>.pinwand.json   one file per board (subject)
//   assets/<hash>.<ext>    PDFs and pictures, shared by all boards
//   backups/<board>-<stamp>.json
const idb = {
  db: null,
  open() { return this.db || (this.db = new Promise((res, rej) => { const r = indexedDB.open("pinwand", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
};
const store = PW.store = {
  root: null, kind: "none", name: "",
  canPick: "showDirectoryPicker" in window,
  // returns "ok" | "reconnect" | "choose"
  async init() {
    let saved = null; try { saved = await idb.get("root"); } catch (e) { }
    if (saved && saved.kind === "folder" && saved.handle) {
      const p = await saved.handle.queryPermission({ mode: "readwrite" }).catch(() => "denied");
      this._pending = saved.handle;
      if (p === "granted") { this.set(saved.handle, "folder"); return "ok"; }
      return "reconnect";
    }
    if (saved && saved.kind === "opfs") { await this.useOPFS(); return "ok"; }
    return "choose";
  },
  set(handle, kind) { this.root = handle; this.kind = kind; this.name = kind === "opfs" ? "app storage" : handle.name; },
  async reconnect() { const hd = this._pending; if (!hd) return false; const p = await hd.requestPermission({ mode: "readwrite" }).catch(() => "denied"); if (p !== "granted") return false; this.set(hd, "folder"); return true; },
  async pickFolder() {
    const hd = await window.showDirectoryPicker({ id: "pinwand", mode: "readwrite", startIn: "documents" });
    this.set(hd, "folder"); await idb.set("root", { kind: "folder", handle: hd }).catch(() => { }); return true;
  },
  async useOPFS() { const r = await navigator.storage.getDirectory(); const d = await r.getDirectoryHandle("pinwand", { create: true }); this.set(d, "opfs"); await idb.set("root", { kind: "opfs" }).catch(() => { }); try { await navigator.storage.persist(); } catch (e) { } return true; },
  async dir(name) { return this.root.getDirectoryHandle(name, { create: true }); },
  async writeFile(dirHandle, name, data) { const fh = await dirHandle.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(data); await w.close(); },
  async readFile(dirHandle, name) { const fh = await dirHandle.getFileHandle(name); return fh.getFile(); },
  async listBoards() {
    const out = []; for await (const [n, hd] of this.root.entries()) if (hd.kind === "file" && n.endsWith(".pinwand.json")) { try { const f = await hd.getFile(); out.push({ file: n, name: n.replace(/\.pinwand\.json$/, ""), mod: f.lastModified, size: f.size }); } catch (e) { } }
    return out.sort((a, b) => b.mod - a.mod);
  },
  async readBoard(file) { const f = await this.readFile(this.root, file); return JSON.parse(await f.text()); },
  async writeBoard(file, data) { await this.writeFile(this.root, file, JSON.stringify(data)); },
  async exists(file) { try { await this.root.getFileHandle(file); return true; } catch (e) { return false; } },
  async remove(file) { await this.root.removeEntry(file); },
  // assets are content-addressed, so the same PDF is stored once
  async putAsset(blob, name = "") {
    const buf = await blob.arrayBuffer(), dig = await crypto.subtle.digest("SHA-256", buf);
    const id = [...new Uint8Array(dig)].slice(0, 10).map(b => b.toString(16).padStart(2, "0")).join("");
    const ext = (/\.([a-z0-9]{2,5})$/i.exec(name) || [, blob.type === "application/pdf" ? "pdf" : (blob.type.split("/")[1] || "bin")])[1].toLowerCase().replace("jpeg", "jpg");
    const file = id + "." + ext, d = await this.dir("assets");
    try { await d.getFileHandle(file); } catch (e) { await this.writeFile(d, file, new Blob([buf], { type: blob.type })); }
    this._cache.set(file, new Blob([buf], { type: blob.type || (ext === "pdf" ? "application/pdf" : "image/" + ext) }));
    return { file, name, type: blob.type || (ext === "pdf" ? "application/pdf" : "image/" + ext) };
  },
  _cache: new Map(), _urls: new Map(),
  async getAsset(file) { if (this._cache.has(file)) return this._cache.get(file); const f = await this.readFile(await this.dir("assets"), file); this._cache.set(file, f); return f; },
  async assetURL(file) { if (this._urls.has(file)) return this._urls.get(file); const u = URL.createObjectURL(await this.getAsset(file)); this._urls.set(file, u); return u; },
  async backup(file, data) {
    const d = await this.dir("backups"), base = file.replace(/\.pinwand\.json$/, "");
    await this.writeFile(d, `${base}-${stamp()}.json`, JSON.stringify(data));
    const mine = []; for await (const [n] of d.entries()) if (n.startsWith(base + "-") && n.endsWith(".json")) mine.push(n);
    mine.sort(); while (mine.length > 40) await d.removeEntry(mine.shift()).catch(() => { });
  },
  async listBackups(file) { const d = await this.dir("backups"), base = file.replace(/\.pinwand\.json$/, ""), out = []; for await (const [n] of d.entries()) if (n.startsWith(base + "-") && n.endsWith(".json")) out.push(n); return out.sort().reverse(); },
  async readBackup(n) { const f = await this.readFile(await this.dir("backups"), n); return JSON.parse(await f.text()); },
};
