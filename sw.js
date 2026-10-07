const CACHE = "menu-app-v8";
const ASSETS = [
  "./index.html", "./app.js", "./manifest.json", "./data/menus.json",
  "./icon-192.png", "./icon-512.png",
  "./icons/primo.png", "./icons/secondo.png", "./icons/contorno.png",
  "./icons/frutta.png", "./icons/merenda.png",
  "./icons/antipasto.svg", "./icons/dolce.svg", "./icons/bevande.svg",
  "./icons/insalata.svg", "./icons/pesce.svg", "./icons/formaggio.svg",
  "./icons/pane.svg", "./icons/yogurt.svg", "./icons/acqua.svg",
  "./icons/succo.svg", "./icons/zuppa.svg",
  "./icons/tab-oggi.png", "./icons/tab-settimane.png",
  "./icons/tab-importa.png", "./icons/tab-menu.png"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok && e.request.url.startsWith(self.location.origin)) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match(e.request)));
});

