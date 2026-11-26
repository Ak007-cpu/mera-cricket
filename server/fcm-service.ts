import fs from 'fs/promises';
import path from 'path';
import { webPushService } from './webpush-service';

export interface DeviceTokenRecord {
  token: string;
  platform?: string;
  preferences?: Record<string, boolean>;
  registeredAt: number;
  lastActiveAt?: number;
}

export interface FcmPayload {
  title: string;
  body: string;
  eventType: 'wicket' | 'four' | 'six' | 'fifty' | 'century' | 'match_starting' | 'match_result' | string;
  matchId: string;
  matchTitle?: string;
  targetScreen?: string;
  notificationId?: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const FCM_TOKENS_FILE = path.join(DATA_DIR, 'fcm-tokens.json');

class FcmService {
  private tokens: Map<string, DeviceTokenRecord> = new Map();
  private sentNotificationIds: Set<string> = new Set();
  private isLoaded = false;

  constructor() {
    this.loadTokens();
  }

  private async loadTokens() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const exists = await fs.stat(FCM_TOKENS_FILE).then(() => true).catch(() => false);
      if (exists) {
        const raw = await fs.readFile(FCM_TOKENS_FILE, 'utf-8');
        const list: DeviceTokenRecord[] = JSON.parse(raw);
        // Only keep real device tokens (exclude dummy or test strings)
        list
          .filter((t) => t && t.token && t.token.length > 20 && !t.token.startsWith('test_'))
          .forEach((t) => this.tokens.set(t.token, t));
        if (list.length !== this.tokens.size) {
          await this.saveTokens();
        }
      }
      this.isLoaded = true;
    } catch (err) {
      console.warn('[FCM] Error loading saved tokens:', err);
    }
  }

  private async saveTokens() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const array = Array.from(this.tokens.values());
      await fs.writeFile(FCM_TOKENS_FILE, JSON.stringify(array, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[FCM] Error persisting tokens:', err);
    }
  }

  public async registerToken(token: string, platform: string = 'android', preferences?: Record<string, boolean>) {
    if (!token || typeof token !== 'string') return;
    const cleanToken = token.trim();
    // Do not register short dummy or test strings
    if (cleanToken.length < 20 || cleanToken.startsWith('test_')) {
      console.log(`[FCM] Ignored test/invalid device token registration: "${cleanToken}"`);
      return;
    }

    const existing = this.tokens.get(cleanToken);
    this.tokens.set(cleanToken, {
      token: cleanToken,
      platform,
      preferences: preferences || existing?.preferences,
      registeredAt: existing?.registeredAt || Date.now(),
      lastActiveAt: Date.now()
    });
    await this.saveTokens();
    console.log(`[FCM] Registered device token (${platform}). Total active devices: ${this.tokens.size}`);
  }

  public async updateTokenPreferences(token: string, preferences: Record<string, boolean>) {
    if (!token || typeof token !== 'string') return;
    const cleanToken = token.trim();
    const existing = this.tokens.get(cleanToken);
    if (existing) {
      existing.preferences = preferences;
      existing.lastActiveAt = Date.now();
      await this.saveTokens();
    } else {
      this.tokens.set(cleanToken, {
        token: cleanToken,
        platform: 'android',
        preferences,
        registeredAt: Date.now(),
        lastActiveAt: Date.now()
      });
      await this.saveTokens();
    }
  }

  public getDeviceCount(): number {
    return this.tokens.size;
  }

  public isFcmConfigured(): boolean {
    const key = (process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY || '').trim();
    return Boolean(key && key.length > 20 && !key.startsWith('YOUR_'));
  }

  /**
   * Broadcasts a match event notification via FCM to all registered mobile devices
   * Only sends notifications matching each user's specific notification settings
   */
  public async sendMatchPushNotification(payload: FcmPayload): Promise<{ sent: number; failed: number; status: string }> {
    const dedupeKey = payload.notificationId || `${payload.matchId}_${payload.eventType}_${payload.title}`;
    if (this.sentNotificationIds.has(dedupeKey)) {
      return { sent: 0, failed: 0, status: 'duplicate_skipped' };
    }
    this.sentNotificationIds.add(dedupeKey);

    // Keep deduplication set bounded
    if (this.sentNotificationIds.size > 500) {
      const first = Array.from(this.sentNotificationIds)[0];
      this.sentNotificationIds.delete(first);
    }

    // Free Web Push to installed phone apps (PWA) - always silent
    webPushService.broadcast({
      title: payload.title,
      body: payload.body,
      eventType: payload.eventType,
      matchId: payload.matchId,
      targetScreen: payload.targetScreen,
      notificationId: payload.notificationId
    }).catch((err) => console.debug('[WebPush] dispatch notice:', err?.message || err));

    // Filter target devices by user preference
    const targetTokens = Array.from(this.tokens.values())
      .filter((device) => {
        const t = device.token;
        if (!t || t.length < 20 || t.startsWith('test_')) return false;

        const prefs = device.preferences;
        if (!prefs) return true; // Default enabled

        if (prefs.enabled === false) return false;

        const evt = payload.eventType;
        if (evt === 'wicket' && prefs.wickets === false) return false;
        if (evt === 'century' && prefs.centuries === false) return false;
        if (evt === 'fifty' && prefs.fifties === false) return false;
        if (evt === 'thirty' && prefs.thirties === false) return false;
        if (evt === 'four' && prefs.boundariesFour === false && prefs.boundaries === false) return false;
        if (evt === 'six' && prefs.boundariesSix === false && prefs.boundaries === false) return false;
        if (evt === 'five_wickets' && prefs.fiveWickets === false) return false;
        if (evt === 'three_wickets' && prefs.threeWickets === false) return false;
        if (evt === 'maiden' && prefs.maidenOvers === false && prefs.maidens === false) return false;
        if (evt === 'innings_break' && prefs.inningsBreak === false) return false;
        if (evt === 'match_result' && prefs.matchResult === false) return false;
        if (evt === 'tight_finish' && prefs.tightFinish === false) return false;

        return true;
      })
      .map((d) => d.token);

    if (targetTokens.length === 0) {
      return { sent: 0, failed: 0, status: 'no_matching_devices_for_event' };
    }

    const fcmServerKey = (process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY || '').trim();
    if (!fcmServerKey || fcmServerKey.length < 20 || fcmServerKey.startsWith('YOUR_')) {
      console.log(`[FCM] Notice: Valid FCM_SERVER_KEY not configured. Dispatched to ${targetTokens.length} registered device(s) via real-time SSE.`);
      return { sent: 0, failed: 0, status: 'fcm_key_missing_sse_fallback' };
    }

    const targetScreen =
      payload.targetScreen ||
      (payload.eventType === 'wicket' || payload.eventType === 'fifty' || payload.eventType === 'century'
        ? 'scorecard'
        : payload.eventType === 'match_result'
        ? 'results'
        : 'live_score');

    // Send in batches of 500
    const batch = targetTokens.slice(0, 500);
    const body = {
      registration_ids: batch,
      notification: {
        title: payload.title,
        body: payload.body,
        android_channel_id: payload.eventType === 'century' ? 'cricket_milestones' : 'cricket_match_events'
      },
      data: {
        matchId: payload.matchId,
        eventType: payload.eventType,
        targetScreen,
        title: payload.title,
        body: payload.body,
        timestamp: String(Date.now()),
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      priority: 'high'
    };

    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${fcmServerKey}`
        },
        body: JSON.stringify(body)
      });

      const contentType = response.headers.get('content-type') || '';
      let json: any = null;

      // Safely parse JSON only if the response is JSON (Google error pages may return HTML)
      if (contentType.includes('application/json')) {
        try {
          json = await response.json();
        } catch {
          json = null;
        }
      } else {
        const text = await response.text();
        console.warn(`[FCM] Google returned HTTP ${response.status} (${contentType || 'non-JSON'}): ${text.slice(0, 100)}`);
      }

      if (!response.ok) {
        return { sent: 0, failed: batch.length, status: `http_error_${response.status}` };
      }

      const successCount = json?.success || 0;
      const failureCount = json?.failure || 0;
      console.log(`[FCM] Notification dispatched: Success=${successCount}, Failure=${failureCount}`);
      return {
        sent: successCount,
        failed: failureCount,
        status: 'delivered'
      };
    } catch (err: any) {
      console.warn('[FCM] Push network dispatch notice:', err.message || err);
      return { sent: 0, failed: batch.length, status: 'error: ' + (err.message || 'unknown') };
    }
  }
}

export const fcmService = new FcmService();
