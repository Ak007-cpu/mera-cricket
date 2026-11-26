import fs from 'fs';
import path from 'path';
import { LiveViewerStats } from '../src/types/cricket';

interface TrackedViewer {
  sessionId: string;
  view: 'web' | 'mobile' | 'obs' | 'admin';
  lastSeen: number;
}

const VIEWER_TTL_MS = 50_000;
const PRUNE_INTERVAL_MS = 10_000;
const STATS_FILE_PATH = path.resolve(process.cwd(), 'data', 'viewer-stats.json');

class ViewerTracker {
  private sessions = new Map<string, TrackedViewer>();
  private subscribers = new Set<(stats: LiveViewerStats) => void>();
  private peakViewers = 0;
  private lastBroadcastKey = '';
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadPeakFromDisk();
    setInterval(() => {
      this.pruneStale();
    }, PRUNE_INTERVAL_MS);
  }

  private normalizeView(rawView: unknown): 'web' | 'mobile' | 'obs' | 'admin' {
    const v = String(rawView || '').trim().toLowerCase();
    if (v === 'android' || v === 'app' || v === 'mobile') return 'mobile';
    if (v === 'overlay' || v === 'obs') return 'obs';
    if (v === 'admin' || v === 'studio') return 'admin';
    return 'web';
  }

  private loadPeakFromDisk() {
    try {
      if (fs.existsSync(STATS_FILE_PATH)) {
        const raw = fs.readFileSync(STATS_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (typeof parsed?.peak === 'number' && parsed.peak >= 0) {
          this.peakViewers = parsed.peak;
        }
      }
    } catch {
      // ignore disk read errors
    }
  }

  private savePeakToDisk() {
    try {
      fs.mkdirSync(path.dirname(STATS_FILE_PATH), { recursive: true });
      fs.writeFileSync(
        STATS_FILE_PATH,
        JSON.stringify({ peak: this.peakViewers, updatedAt: Date.now() }, null, 2),
        'utf-8'
      );
    } catch {
      // ignore disk write errors
    }
  }

  public getStats(): LiveViewerStats {
    const now = Date.now();
    let web = 0;
    let mobile = 0;
    let obs = 0;
    let admin = 0;

    for (const [sid, entry] of this.sessions.entries()) {
      if (now - entry.lastSeen > VIEWER_TTL_MS) {
        this.sessions.delete(sid);
        continue;
      }
      if (entry.view === 'web') web += 1;
      else if (entry.view === 'mobile') mobile += 1;
      else if (entry.view === 'obs') obs += 1;
      else if (entry.view === 'admin') admin += 1;
    }

    const total = web + mobile + obs;
    if (total > this.peakViewers) {
      this.peakViewers = total;
      this.savePeakToDisk();
    }

    return {
      total,
      web,
      mobile,
      obs,
      admin,
      peak: this.peakViewers,
      updatedAt: now
    };
  }

  public registerPing(sessionId: string, rawView: unknown): LiveViewerStats {
    const cleanId = String(sessionId || '').trim().slice(0, 128);
    if (!cleanId) return this.getStats();

    const nextView = this.normalizeView(rawView);
    const prev = this.sessions.get(cleanId);
    const changed = !prev || prev.view !== nextView;

    this.sessions.set(cleanId, {
      sessionId: cleanId,
      view: nextView,
      lastSeen: Date.now()
    });

    const stats = this.getStats();
    if (changed) {
      this.scheduleBroadcast();
    } else {
      const signature = `${stats.total}:${stats.web}:${stats.mobile}:${stats.obs}:${stats.admin}:${stats.peak}`;
      if (signature !== this.lastBroadcastKey) {
        this.scheduleBroadcast();
      }
    }
    return stats;
  }

  public markOffline(sessionId: string): LiveViewerStats {
    const cleanId = String(sessionId || '').trim().slice(0, 128);
    if (cleanId && this.sessions.delete(cleanId)) {
      this.scheduleBroadcast();
    }
    return this.getStats();
  }

  private pruneStale() {
    const now = Date.now();
    let removed = false;
    for (const [sid, entry] of this.sessions.entries()) {
      if (now - entry.lastSeen > VIEWER_TTL_MS) {
        this.sessions.delete(sid);
        removed = true;
      }
    }
    if (removed) {
      this.scheduleBroadcast();
    }
  }

  private scheduleBroadcast() {
    if (this.broadcastTimer) return;
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null;
      const stats = this.getStats();
      const signature = `${stats.total}:${stats.web}:${stats.mobile}:${stats.obs}:${stats.admin}:${stats.peak}`;
      if (signature === this.lastBroadcastKey) return;
      this.lastBroadcastKey = signature;
      for (const cb of this.subscribers) {
        try {
          cb(stats);
        } catch {
          // ignore broken stream listeners
        }
      }
    }, 300);
  }

  public subscribe(cb: (stats: LiveViewerStats) => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }
}

export const viewerTracker = new ViewerTracker();
