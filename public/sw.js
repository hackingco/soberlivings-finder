// Service Worker for SoberLiving Finder PWA
const CACHE_NAME = 'soberliving-finder-v1'
const STATIC_CACHE = 'static-v1'
const DYNAMIC_CACHE = 'dynamic-v1'

const STATIC_ASSETS = [
  '/',
  '/favicon.svg',
  '/manifest.json',
  '/offline.html'
]

const API_CACHE_PATTERNS = [
  '/api/facilities/search',
  '/api/metrics'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE)
          .map(cacheName => caches.delete(cacheName))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - implement cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Handle API requests with network-first strategy
  if (API_CACHE_PATTERNS.some(pattern => url.pathname.includes(pattern))) {
    event.respondWith(
      networkFirstStrategy(request)
    )
    return
  }

  // Handle static assets with cache-first strategy
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      cacheFirstStrategy(request)
    )
    return
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirstStrategy(request)
        .catch(() => caches.match('/offline.html'))
    )
    return
  }

  // Default to network-first for other requests
  event.respondWith(
    networkFirstStrategy(request)
  )
})

// Cache-first strategy - good for static assets
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    throw error
  }
}

// Network-first strategy - good for dynamic content
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request)
    
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) {
      return cached
    }
    throw error
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-searches') {
    event.waitUntil(syncSearches())
  }
})

async function syncSearches() {
  // Handle offline search requests when back online
  const searches = await getStoredSearches()
  
  for (const search of searches) {
    try {
      await fetch('/api/facilities/search', {
        method: 'POST',
        body: JSON.stringify(search)
      })
      await removeStoredSearch(search.id)
    } catch (error) {
      console.log('Failed to sync search:', error)
    }
  }
}

async function getStoredSearches() {
  // Implementation would depend on IndexedDB storage
  return []
}

async function removeStoredSearch(id) {
  // Implementation would depend on IndexedDB storage
}

// Push notifications for new facilities or updates
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New treatment facilities available in your area',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Facilities',
        icon: '/images/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/images/xmark.png'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification('SoberLiving Finder', options)
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    )
  }
})

// Performance monitoring
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PERFORMANCE_METRIC') {
    // Send performance data to analytics
    console.log('Performance metric:', event.data.metric)
  }
})
