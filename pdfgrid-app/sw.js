// pdfgrid: keeps the app available offline
const CACHE="pdfgrid-v4";
const FILES=["./","index.html","pdf.min.js","pdf.worker.min.js","manifest.webmanifest","icon-192.png","icon-512.png","favicon.png","figtree-latin-400-normal.woff2","figtree-latin-700-normal.woff2","caveat-latin-700-normal.woff2"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{if(res.ok&&new URL(e.request.url).origin===location.origin){const c=res.clone();caches.open(CACHE).then(k=>k.put(e.request,c))}return res})))});
