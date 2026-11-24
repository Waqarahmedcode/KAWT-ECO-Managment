/* Public offline shell/assets only. Never cache API, auth or patient responses. */
const CACHE='kawt-public-shell-v1';
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);const response=await fetch('/offline',{cache:'reload'});if(!response.ok)throw new Error('Offline shell unavailable');const html=await response.clone().text();await cache.put('/offline',response);const assets=[...new Set(html.match(/\/_next\/static\/[^"\s<>]+/g)||[])].map(path=>path.replace(/&amp;/g,'&'));await Promise.all(assets.map(async path=>{const response=await fetch(path);if(response.ok)await cache.put(path,response)}));await self.skipWaiting()})())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('kawt-public-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})())});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=='GET')return;
 if(url.pathname.startsWith('/departments')||url.pathname.startsWith('/leads')||url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/')||url.pathname.startsWith('/referrals/')||url.pathname.startsWith('/lab')||url.pathname.startsWith('/medical-centre'))return;
 if(url.pathname.startsWith('/_next/static/')||url.pathname==='/icon.svg')event.respondWith((async()=>{const cache=await caches.open(CACHE);const hit=await cache.match(event.request);if(hit)return hit;const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response})());
 else if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(async()=>await caches.match('/offline')||new Response('Reconnect to open the offline intake shell',{status:503,headers:{'Content-Type':'text/plain'}})));
});
