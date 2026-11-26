import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import webpush from 'web-push';

/**
 * Free Web Push (VAPID) delivery for the installed phone app (PWA).
 * No Firebase account / server key needed.
 * Notifications are always sent SILENT (no sound, no vibration).
 */

export interface WebPushPayload {
  title: string;
  body: string;
  eventType: string;
  matchId: string;
  targetScreen?: string;
  notificationId?: string;
}

interface StoredPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  vapidPublicKey?: string;
  addedAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SUBS_FILE = path.join(DATA_DIR, 'push-subscriptions.json');
const KEYS_FILE = path.join(DATA_DIR, 'vapid-keys.json');
const PERMANENT_FAILURE_STATUSES = new Set([400, 401, 403, 404, 410]);

class WebPushService {
  private subs: Map<string, StoredPushSubscription> = new Map();
  private publicKey = '';
  private ready: Promise<void>;

  constructor() {
    this.ready = this.init().catch((err) => {
      console.warn('[WebPush] init notice:', err?.message || err);
    });
  }

  private async init() {
    try {
      dotenv.config({ quiet: true });
    } catch {}

    await fs.mkdir(DATA_DIR, { recursive: true });

    let pub = (process.env.VAPID_PUBLIC_KEY || '').trim();
    let priv = (process.env.VAPID_PRIVATE_KEY || '').trim();

    if (!pub || !priv) {
      try {
        const saved = JSON.parse(await fs.readFile(KEYS_FILE, 'utf-8'));
        pub = saved.publicKey;
        priv = saved.privateKey;
      } catch {
        const keys = webpush.generateVAPIDKeys();
        pub = keys.publicKey;
        priv = keys.privateKey;
        await fs.writeFile(KEYS_FILE, JSON.stringify({ publicKey: pub, privateKey: priv }, null, 2), 'utf-8');
        console.log('[WebPush] New VAPID keys generated (saved in data/vapid-keys.json).');
        console.log('[WebPush] On Render set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars so keys survive restarts.');
      }
    }

    this.publicKey = pub;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);

    let prunedOnBoot = false;
    try {
      const list = JSON.parse(await fs.readFile(SUBS_FILE, 'utf-8'));
      if (Array.isArray(list)) {
        for (const s of list) {
          if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) {
            prunedOnBoot = true;
            continue;
          }
          // Discard subscriptions bound to a stale/different VAPID public key
          if (s.vapidPublicKey && s.vapidPublicKey !== this.publicKey) {
            prunedOnBoot = true;
            continue;
          }
          this.subs.set(s.endpoint, s);
        }
      }
    } catch {
      /* no subscriptions yet */
    }

    if (prunedOnBoot) {
      await this.save();
    }
  }

  private async save() {
    try {
      await fs.writeFile(SUBS_FILE, JSON.stringify(Array.from(this.subs.values()), null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[WebPush] save notice:', err?.message || err);
    }
  }

  public async getPublicKey(): Promise<string> {
    await this.ready;
    return this.publicKey;
  }

  public getCount(): number {
    return this.subs.size;
  }

  public async subscribe(sub: any) {
    await this.ready;
    if (
      !sub?.endpoint ||
      typeof sub.endpoint !== 'string' ||
      !/^https:\/\//i.test(sub.endpoint) ||
      !sub?.keys?.p256dh ||
      !sub?.keys?.auth
    ) {
      throw new Error('Invalid push subscription');
    }
    this.subs.set(sub.endpoint, {
      endpoint: sub.endpoint,
      keys: {
        p256dh: String(sub.keys.p256dh),
        auth: String(sub.keys.auth)
      },
      vapidPublicKey: this.publicKey,
      addedAt: Date.now()
    });
    await this.save();
  }

  public async unsubscribe(endpoint: string) {
    await this.ready;
    if (endpoint && this.subs.delete(endpoint)) await this.save();
  }

  public async broadcast(payload: WebPushPayload): Promise<{ sent: number; failed: number }> {
    await this.ready;
    if (this.subs.size === 0) return { sent: 0, failed: 0 };

    const targetScreen =
      payload.targetScreen ||
      (['wicket', 'fifty', 'century'].includes(payload.eventType)
        ? 'scorecard'
        : payload.eventType === 'match_result'
        ? 'results'
        : 'live_score');

    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      silent: true,
      data: {
        matchId: payload.matchId,
        eventType: payload.eventType,
        targetScreen,
        notificationId: payload.notificationId,
        timestamp: Date.now()
      }
    });

    let sent = 0;
    let transientFailed = 0;
    const dead: string[] = [];

    await Promise.all(
      Array.from(this.subs.values()).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: s.keys },
            message,
            { TTL: 120, urgency: 'high' }
          );
          sent++;
        } catch (err: any) {
          const status = Number(err?.statusCode);
          if (PERMANENT_FAILURE_STATUSES.has(status)) {
            dead.push(s.endpoint);
          } else {
            transientFailed++;
          }
        }
      })
    );

    if (dead.length) {
      dead.forEach((e) => this.subs.delete(e));
      await this.save();
    }

    if (sent > 0) {
      console.log(`[WebPush] Delivered=${sent}${dead.length ? ` Pruned=${dead.length}` : ''}`);
    } else if (dead.length > 0) {
      console.log(`[WebPush] Pruned ${dead.length} expired/mismatched subscription(s).`);
    } else if (transientFailed > 0) {
      console.warn(`[WebPush] Temporary push delivery retry needed (${transientFailed}).`);
    }

    return { sent, failed: transientFailed };
  }
}

export const webPushService = new WebPushService();
