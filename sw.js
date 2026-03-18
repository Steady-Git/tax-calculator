const CACHE_NAME = 'tax-calculator-v1';
const URLS_TO_CACHE = [
  '/tax-calculator/obligation.html',
  '/tax-calculator/manifest.json'
];

// 설치 시 캐시 저장
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 활성화 시 오래된 캐시 삭제
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

// 네트워크 요청 처리 (네트워크 우선, 실패 시 캐시 사용)
self.addEventListener('fetch', function(event) {
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // 정상 응답이면 캐시에도 저장
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(function() {
        // 네트워크 실패 시 캐시에서 반환 (오프라인 지원)
        return caches.match(event.request);
      })
  );
});
