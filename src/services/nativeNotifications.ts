import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications';
import { buildApiUrl } from './api';

export interface NotificationPayloadData {
  matchId?: string;
  eventType?: string;
  targetScreen?: string;
  title?: string;
  body?: string;
  timestamp?: string;
}

export type NotificationTapCallback = (data: NotificationPayloadData) => void;

class NativeNotificationService {
  private isInitialized = false;
  private tapListeners: Set<NotificationTapCallback> = new Set();
  private fcmToken: string | null = null;
  private lastScheduledIds: Set<string> = new Set();
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

  public async init(onTap?: NotificationTapCallback) {
    if (onTap) {
      this.tapListeners.add(onTap);
    }

    if (this.isInitialized) return;
    this.isInitialized = true;

    // Check if running on native Android/iOS
    if (Capacitor.isNativePlatform()) {
      try {
        await this.setupChannels();
        await this.requestPermissionsAndRegister();
        this.attachListeners();
      } catch (err) {
        console.warn('[NativeNotifications] Native initialization warning:', err);
      }
    } else {
      // In web browser / PWA mode, register the Firebase Messaging service worker
      await this.initWebServiceWorker();
    }
  }

  public addTapListener(cb: NotificationTapCallback): () => void {
    this.tapListeners.add(cb);
    return () => this.tapListeners.delete(cb);
  }

  public getFcmToken(): string | null {
    return this.fcmToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('cricket_fcm_token') : null);
  }

  /**
   * Initializes the Firebase Messaging service worker in public/firebase-messaging-sw.js
   * Handles background push messages and click-to-open events across mobile browsers and PWAs
   */
  private async initWebServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('[NativeNotifications] Service workers not supported in this environment');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      this.serviceWorkerRegistration = reg;
      console.log('[NativeNotifications] Firebase messaging service worker registered with scope:', reg.scope);

      // Listen for message from service worker when notification is clicked in background
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
          console.log('[NativeNotifications] Background notification tapped in SW:', event.data);
          this.notifyTapListeners(event.data.data || {});
        }
      });

      // Request browser notification permission if not yet decided
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          const perm = await Notification.requestPermission();
          console.log('[NativeNotifications] Notification permission result:', perm);
        } catch (e) {
          console.debug('[NativeNotifications] Notification permission request deferral:', e);
        }
      }

      // Subscribe this phone to free Web Push (works when the app is closed)
      await this.subscribeWebPush();

      // Check PushManager for subscription token or generate stable web device identifier
      let webToken = localStorage.getItem('cricket_fcm_token');
      if (!webToken) {
        webToken = 'web_client_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
        localStorage.setItem('cricket_fcm_token', webToken);
      }
      this.fcmToken = webToken;

      // Register token with backend
      await this.registerTokenWithBackend(webToken, 'web');
    } catch (err) {
      console.warn('[NativeNotifications] Service worker registration notice:', err);
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  /**
   * Subscribes the installed phone app to Web Push and sends the subscription to the server.
   * Needs notification permission = granted.
   */
  public async subscribeWebPush(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) return false;
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
      if (!('Notification' in window) || Notification.permission !== 'granted') return false;

      const keyRes = await fetch(buildApiUrl('/api/push/public-key'));
      const { publicKey } = await keyRes.json();
      if (!publicKey) return false;

      const reg = await navigator.serviceWorker.ready;
      const targetBytes = this.urlBase64ToUint8Array(publicKey);
      const applicationServerKey = targetBytes as unknown as BufferSource;

      let sub = await reg.pushManager.getSubscription();
      if (sub && sub.options?.applicationServerKey) {
        const existingBytes = new Uint8Array(sub.options.applicationServerKey);
        const keysMatch =
          existingBytes.length === targetBytes.length &&
          existingBytes.every((b, idx) => b === targetBytes[idx]);
        if (!keysMatch) {
          await sub.unsubscribe().catch(() => {});
          sub = null;
        }
      }
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      }

      let res = await fetch(buildApiUrl('/api/push/subscribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON())
      });

      if (!res.ok) {
        // Old subscription from different keys: reset and retry once
        await sub.unsubscribe();
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
        res = await fetch(buildApiUrl('/api/push/subscribe'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON())
        });
      }
      console.log('[NativeNotifications] Web Push subscribed:', res.ok);
      return res.ok;
    } catch (err) {
      console.warn('[NativeNotifications] Web Push subscribe notice:', err);
      return false;
    }
  }

  /**
   * Registers a device token (FCM or Web) with the backend
   */
  public async registerTokenWithBackend(token: string, platform: string = 'android', preferences?: Record<string, any>) {
    if (!token) return;
    try {
      const res = await fetch(buildApiUrl('/api/notifications/register-device'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          platform,
          preferences,
          registeredAt: Date.now()
        })
      });
      if (res.ok) {
        console.log(`[NativeNotifications] Device registered with backend (${platform})`);
      }
    } catch (err) {
      console.debug('[NativeNotifications] Token registration deferral:', err);
    }
  }

  /**
   * Syncs user-selected notification preferences to the cloud backend
   * Ensures the phone receives background push notifications matching user selections when the app is closed
   */
  public async updatePreferences(preferences: Record<string, any>) {
    const token = this.getFcmToken();
    if (!token) return;

    try {
      await fetch(buildApiUrl('/api/notifications/preferences'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          preferences
        })
      });
      console.log('[NativeNotifications] Synced notification preferences to cloud backend');
    } catch (e) {
      console.debug('[NativeNotifications] Preference sync notice:', e);
    }
  }

  /**
   * Creates Android Notification Channels (Android 8.0+)
   */
  private async setupChannels() {
    try {
      await LocalNotifications.createChannel({
        id: 'cricket_match_events',
        name: 'Live Match Events',
        description: 'Instant alerts for wickets, boundaries, match starts and results',
        importance: 2, // Silent (no sound), still shown in the notification shade
        visibility: 1, // Public on lockscreen
        vibration: false,
        lights: true,
        lightColor: '#2563EB'
      });

      await LocalNotifications.createChannel({
        id: 'cricket_milestones',
        name: 'Player Milestones (50s, 100s, 5W)',
        description: 'Celebratory fanfare alerts for centuries and bowling milestones',
        importance: 2, // Silent
        visibility: 1,
        vibration: false,
        lights: true,
        lightColor: '#F59E0B'
      });
    } catch (e) {
      console.debug('[NativeNotifications] Channel setup notice:', e);
    }
  }

  /**
   * Requests push notification permissions and registers with FCM
   */
  private async requestPermissionsAndRegister() {
    try {
      // 1. Local Notifications permissions
      const localPerm = await LocalNotifications.requestPermissions();
      console.log('[NativeNotifications] Local permission status:', localPerm.display);

      // 2. Push Notifications permissions & token
      const pushPerm = await PushNotifications.requestPermissions();
      if (pushPerm.receive === 'granted') {
        await PushNotifications.register();
      }
    } catch (e) {
      console.warn('[NativeNotifications] Permission request error:', e);
    }
  }

  /**
   * Attaches listeners for FCM registration, incoming push, and tap actions
   */
  private attachListeners() {
    // On FCM Registration Success
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[NativeNotifications] FCM Registration Token received:', token.value);
      this.fcmToken = token.value;
      localStorage.setItem('cricket_fcm_token', token.value);
      await this.registerTokenWithBackend(token.value, Capacitor.getPlatform());
    });

    // On FCM Registration Error
    PushNotifications.addListener('registrationError', (error: any) => {
      console.warn('[NativeNotifications] Push registration error:', error);
    });

    // Foreground push received
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('[NativeNotifications] Push received in foreground:', notification);
      // Display local heads-up notification if foreground
      this.scheduleLocalNotification({
        id: notification.id || `notif_${Date.now()}`,
        title: notification.title || 'Live Cricket HD',
        body: notification.body || '',
        data: (notification.data as any) || {}
      });
    });

    // When user taps a Push Notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('[NativeNotifications] Push notification tapped:', action);
      const data: NotificationPayloadData = (action.notification.data as any) || {};
      this.notifyTapListeners({
        matchId: data.matchId,
        eventType: data.eventType,
        targetScreen: data.targetScreen || this.resolveTargetScreen(data.eventType),
        title: action.notification.title,
        body: action.notification.body
      });
    });

    // When user taps a Local Notification
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      console.log('[NativeNotifications] Local notification tapped:', action);
      const extra: NotificationPayloadData = (action.notification.extra as any) || {};
      this.notifyTapListeners({
        matchId: extra.matchId,
        eventType: extra.eventType,
        targetScreen: extra.targetScreen || this.resolveTargetScreen(extra.eventType),
        title: action.notification.title,
        body: action.notification.body
      });
    });
  }

  private notifyTapListeners(data: NotificationPayloadData) {
    this.tapListeners.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error('[NativeNotifications] Error in tap listener:', e);
      }
    });
  }

  private resolveTargetScreen(eventType?: string): string {
    switch (eventType) {
      case 'wicket':
      case 'century':
      case 'fifty':
      case 'double_century':
      case 'one_fifty':
      case 'thirty':
      case 'five_wickets':
      case 'three_wickets':
        return 'scorecard';
      case 'match_result':
        return 'results';
      case 'match_starting':
      case 'innings_break':
      case 'four':
      case 'six':
      default:
        return 'live_score';
    }
  }

  public isSupported(): boolean {
    return Capacitor.isNativePlatform() || (typeof window !== 'undefined' && 'Notification' in window);
  }

  /**
   * Universal permission requester for Android Native & Web Browser Push Notifications
   */
  public async requestPermission(): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      try {
        const local = await LocalNotifications.requestPermissions();
        const push = await PushNotifications.requestPermissions();
        if (push.receive === 'granted') {
          await PushNotifications.register();
        }
        return push.receive === 'granted' || local.display === 'granted' ? 'granted' : 'denied';
      } catch (e) {
        console.warn('[NativeNotifications] Permission request error:', e);
        return 'denied';
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          await this.subscribeWebPush();
        }
        return perm;
      } catch (e) {
        console.debug('[NativeNotifications] Web permission error:', e);
        return 'denied';
      }
    }

    return 'unsupported';
  }

  /**
   * Schedules or displays a push notification for wickets and milestones.
   * Handles:
   * 1. Native Android heads-up notifications (Capacitor LocalNotifications & PushChannels)
   * 2. Android Chrome / PWA Service Worker notifications (via navigator.serviceWorker.ready.showNotification)
   * 3. Browser Window Notification API fallback
   * 4. Deduplication by event ID to prevent duplicate alerts.
   */
  public async scheduleLocalNotification(opts: {
    id: string;
    title: string;
    body: string;
    data?: NotificationPayloadData;
    channelId?: 'cricket_match_events' | 'cricket_milestones';
    iconUrl?: string;
  }) {
    if (this.lastScheduledIds.has(opts.id)) {
      return; // Deduplicated
    }
    this.lastScheduledIds.add(opts.id);
    if (this.lastScheduledIds.size > 200) {
      const first = Array.from(this.lastScheduledIds)[0];
      this.lastScheduledIds.delete(first);
    }

    const isHighPriority =
      opts.data?.eventType === 'wicket' ||
      opts.data?.eventType === 'century' ||
      opts.data?.eventType === 'fifty' ||
      opts.data?.eventType === 'five_wickets' ||
      opts.title.includes('WICKET') ||
      opts.title.includes('CENTURY') ||
      opts.title.includes('50');

    // Web & Android Chrome / PWA delivery
    if (!Capacitor.isNativePlatform()) {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const targetScreen = opts.data?.targetScreen || this.resolveTargetScreen(opts.data?.eventType);
        const iconUrl = opts.iconUrl || '/vite.svg';

        // Prefer ServiceWorker showNotification (vital for Android Chrome and background PWAs)
        if ('serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            if (reg && reg.showNotification) {
              await reg.showNotification(opts.title, {
                body: opts.body,
                icon: iconUrl,
                badge: '/vite.svg',
                tag: opts.id,
                renotify: true,
                requireInteraction: isHighPriority,
                silent: true, // no sound, no vibration
                data: {
                  ...opts.data,
                  targetScreen,
                  matchId: opts.data?.matchId,
                  eventType: opts.data?.eventType
                }
              } as any);
              return;
            }
          } catch (e) {
            console.debug('[NativeNotifications] SW showNotification error:', e);
          }
        }

        // Direct Window Notification API fallback
        try {
          const notif = new Notification(opts.title, {
            body: opts.body,
            icon: iconUrl,
            badge: '/vite.svg',
            tag: opts.id,
            requireInteraction: isHighPriority
          });
          notif.onclick = () => {
            window.focus();
            this.notifyTapListeners({
              ...opts.data,
              targetScreen
            });
          };
        } catch (e) {
          console.debug('[NativeNotifications] Window notification error:', e);
        }
      }
      return;
    }

    // Native Android device delivery via Capacitor
    try {
      let numericId = 1;
      for (let i = 0; i < opts.id.length; i++) {
        numericId = (numericId * 31 + opts.id.charCodeAt(i)) & 0x7fffffff;
      }
      if (numericId === 0) numericId = 1;

      const notif: LocalNotificationSchema = {
        id: numericId,
        title: opts.title,
        body: opts.body,
        channelId:
          opts.channelId ||
          (opts.title.includes('CENTURY') || opts.title.includes('50') || opts.title.includes('5-WICKET')
            ? 'cricket_milestones'
            : 'cricket_match_events'),
        extra: {
          ...opts.data,
          originalId: opts.id,
          targetScreen: opts.data?.targetScreen || this.resolveTargetScreen(opts.data?.eventType)
        },
        schedule: { at: new Date(Date.now() + 100) },
        smallIcon: 'res://drawable/ic_launcher',
        iconColor: '#2563EB'
      };

      await LocalNotifications.schedule({ notifications: [notif] });
    } catch (e) {
      console.debug('[NativeNotifications] Local schedule note:', e);
    }
  }
}

export const nativeNotifications = new NativeNotificationService();
