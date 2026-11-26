// Firebase Messaging Service Worker for Background Cricket Notifications
// Handles background push events when the mobile app, PWA, or browser is closed or in background.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch handler (keeps the app installable as a phone app)
self.addEventListener('fetch', () => {});

// Background push notification event listener
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'Live Cricket HD Alert', body: event.data.text() };
    }
  }

  // Normalize FCM data and notification structures
  const notification = payload.notification || {};
  const customData = payload.data || {};

  const title = notification.title || customData.title || payload.title || '🏏 Live Cricket HD';
  const body = notification.body || customData.body || payload.body || 'Match event update available!';
  const eventType = customData.eventType || payload.eventType || 'match_event';
  const matchId = customData.matchId || payload.matchId || '';
  const targetScreen = customData.targetScreen || (
    eventType === 'wicket' || eventType === 'century' || eventType === 'fifty' || eventType === 'five_wickets'
      ? 'scorecard'
      : eventType === 'match_result'
      ? 'results'
      : 'live_score'
  );

  const notificationOptions = {
    body,
    icon: customData.playerImageUrl || notification.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: customData.notificationId || `cricket-event-${eventType}-${Date.now()}`,
    renotify: true,
    requireInteraction: eventType === 'wicket' || eventType === 'match_result' || eventType === 'century' || eventType === 'five_wickets',
    silent: true, // no sound, no vibration
    data: {
      matchId,
      eventType,
      targetScreen,
      timestamp: Date.now(),
      url: `/?view=app&screen=${targetScreen}&matchId=${matchId}`
    },
    actions: [
      { action: 'open_scorecard', title: '📊 Scorecard' },
      { action: 'open_live', title: '⚡ Live Score' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// Notification click event handler (opens and focuses the app to relevant screen)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const action = event.action;

  let targetScreen = notificationData.targetScreen || 'live_score';
  if (action === 'open_scorecard') {
    targetScreen = 'scorecard';
  } else if (action === 'open_live') {
    targetScreen = 'live_score';
  }

  const targetUrl = `/?view=app&screen=${targetScreen}&matchId=${notificationData.matchId || ''}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available and post message
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: {
              ...notificationData,
              targetScreen
            }
          });
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
