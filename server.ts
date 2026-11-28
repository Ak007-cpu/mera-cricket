import dotenv from 'dotenv';
import fsSync from 'fs';
import http from 'http';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { crexService, PRESET_MATCHES } from './server/crex-service';
import { resolvePlayerProfile, VERIFIED_PLAYERS } from './src/data/playersRegistry';
import { fcmService } from './server/fcm-service';
import { webPushService } from './server/webpush-service';
import { handleTeamFlag } from './server/team-flag-resolver';
import { handlePlayerPhoto } from './server/player-photo-resolver';
import { handlePlayerStats } from './server/player-stats-resolver';
import { monetizationService } from './server/monetization-service';
import { viewerTracker } from './server/viewer-tracker';
import { cricketNewsService } from './server/cricket-news-service';
import { aiNewsStudioService } from './server/ai-news-studio-service';
import { buildAdsTxtContent } from './src/utils/adsense';

// Global unhandled error guards so network blips never crash the Node process
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

// Initialize environment variables from .env if present
try {
  dotenv.config({ quiet: true });
} catch {}
if (!process.env.ADMIN_PIN) {
  try {
    dotenv.config({ path: path.resolve(process.cwd(), '.env.production'), quiet: true });
  } catch {}
}
if (!process.env.ADMIN_PIN) {
  try {
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });
  } catch {}
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePort(): number {
  // 1. Check CLI arguments (--port 3000 or -p 3000)
  const portArgIndex = process.argv.indexOf('--port') !== -1 
    ? process.argv.indexOf('--port') 
    : process.argv.indexOf('-p');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // 2. In production, Cloud Run / hosting sets process.env.PORT
  if (process.env.NODE_ENV === 'production') {
    if (process.env.PORT) {
      const parsed = parseInt(process.env.PORT, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 10000;
  }

  // 3. In development (AI Studio), dev server must run on port 3000.
  // Note: Ignore process.env.PORT=8080 in dev mode which is set by the container environment.
  return 3000;
}

const app = express();
const PORT = resolvePort();

app.use(express.json({ limit: '6mb' }));

// Explicit handler for Firebase Messaging Service Worker
app.get('/firebase-messaging-sw.js', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache');
  const pubPath = path.resolve(__dirname, 'public', 'firebase-messaging-sw.js');
  const distSwPath = path.resolve(__dirname, 'dist', 'firebase-messaging-sw.js');
  try {
    const content = await fs.readFile(pubPath, 'utf-8');
    return res.send(content);
  } catch {
    return res.sendFile(distSwPath);
  }
});

app.use(express.static(path.resolve(__dirname, 'public')));

// CORS & cache control for live data across any mobile data network or origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-pin, x-file-name'
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

/**
 * Resolves the effective Admin PIN securely:
 * 1. Priority 1: process.env.ADMIN_PIN (from environment or .env/.env.production)
 * 2. Priority 2: data/admin-pin.key (secure fallback file on disk when dashboard environment variables are unavailable)
 */
export function getEffectiveAdminPin(): { pin: string | null; source: 'env' | 'file' | 'none' } {
  const envPin = process.env.ADMIN_PIN?.trim();
  if (envPin && envPin.length > 0) {
    return { pin: envPin, source: 'env' };
  }

  try {
    const pinFile = path.resolve(process.cwd(), 'data', 'admin-pin.key');
    if (fsSync.existsSync(pinFile)) {
      const filePin = fsSync.readFileSync(pinFile, 'utf-8').trim();
      if (filePin.length > 0) {
        return { pin: filePin, source: 'file' };
      }
    }
  } catch {}

  return { pin: null, source: 'none' };
}

/**
 * Verifies Admin PIN securely:
 * Strictly compares against the configured ADMIN_PIN (retrieved via process.env.ADMIN_PIN
 * or the secure fallback file data/admin-pin.key). No hardcoded credentials.
 */
function verifyPin(pin: unknown): boolean {
  if (!pin) return false;
  const pinStr = (Array.isArray(pin) ? pin[0] : String(pin)).trim();
  if (!pinStr) return false;

  const { pin: configuredPin } = getEffectiveAdminPin();
  if (configuredPin && configuredPin.length > 0 && pinStr === configuredPin) {
    return true;
  }

  return false;
}

// Admin pin authorization middleware
function requireAdmin(req: Request, res: Response, next: () => void) {
  const pin = req.headers['x-admin-pin'] || req.body?.adminPin;
  if (verifyPin(pin)) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized: Invalid Admin PIN' });
}

// -------------------------------------------------------------
// PUBLIC API (Consumed by Android App, OBS Overlay, Broadcast)
// -------------------------------------------------------------

// Active match state
app.get('/api/match/active', (_req: Request, res: Response) => {
  const active = crexService.getActiveMatch();
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.json({
    success: true,
    data: active.matchState,
    config: active.config,
    serverTime: Date.now()
  });
});

// Server-Sent Events stream for real-time synchronization
app.get('/api/match/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Prevents proxy buffering in cloud environments like Render
  res.flushHeaders();

  const sid = typeof req.query.sid === 'string' ? req.query.sid.trim() : '';
  const initialView = typeof req.query.view === 'string' ? req.query.view.trim() : 'broadcast';

  // Send initial connection packet
  res.write(`data: ${JSON.stringify({ type: 'connected', serverTime: Date.now() })}\n\n`);

  if (sid) {
    viewerTracker.registerPing(sid, initialView);
  }
  res.write(`event: viewers\ndata: ${JSON.stringify(viewerTracker.getStats())}\n\n`);

  // Heartbeat comment ping every 25s to keep cloud reverse-proxies from timing out
  const heartbeatTimer = setInterval(() => {
    res.write(': heartbeat\n\n');
    if (sid) {
      viewerTracker.registerPing(sid, initialView);
    }
  }, 25000);

  const unsubscribe = crexService.subscribeSSE((data) => {
    res.write(`data: ${data}\n\n`);
  });

  const unsubscribeMonetization = monetizationService.subscribe((monetization) => {
    res.write(`event: monetization\ndata: ${JSON.stringify(monetization)}\n\n`);
  });

  const unsubscribeViewers = viewerTracker.subscribe((stats) => {
    res.write(`event: viewers\ndata: ${JSON.stringify(stats)}\n\n`);
  });

  const unsubscribeAiNews = aiNewsStudioService.subscribe((studioState) => {
    res.write(`event: ai_news_studio\ndata: ${JSON.stringify(studioState)}\n\n`);
  });

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    unsubscribe();
    unsubscribeMonetization();
    unsubscribeViewers();
    unsubscribeAiNews();
    if (sid) {
      viewerTracker.markOffline(sid);
    }
  });
});

// Public lightweight viewer heartbeat / view-switch ping
app.post('/api/viewers/ping', (req: Request, res: Response) => {
  const { sessionId, view, leaving } = req.body || {};
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required' });
  }
  const stats = leaving
    ? viewerTracker.markOffline(sessionId)
    : viewerTracker.registerPing(sessionId, view);
  return res.json({ success: true, total: stats.total });
});

// Admin-only detailed live viewer breakdown
app.get('/api/admin/viewers', requireAdmin, (_req: Request, res: Response) => {
  return res.json({
    success: true,
    stats: viewerTracker.getStats(),
    serverTime: Date.now()
  });
});

// Public monetization config (AdSense publisher/slots & sponsor banner)
app.get('/api/monetization', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.json({
    success: true,
    config: monetizationService.getConfig(),
    serverTime: Date.now()
  });
});

// Dynamic Google AdSense ads.txt endpoint
app.get('/ads.txt', (_req: Request, res: Response) => {
  const cfg = monetizationService.getConfig();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.send(buildAdsTxtContent(cfg.adsensePublisherId, cfg.adsTxtCustomLines));
});

// Public Admin-saved News & Cricket Feed Settings
app.get('/api/news', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.json({
    success: true,
    news: cricketNewsService.getAdminNews(),
    settings: cricketNewsService.getSettings(),
    serverTime: Date.now()
  });
});

// Public Auto-Synced Cricket News Feed with Player Images (only active when Admin enables Auto-Sync)
app.get('/api/news/cricket-feed', async (_req: Request, res: Response) => {
  try {
    const settings = cricketNewsService.getSettings();
    if (!settings.autoSyncEnabled) {
      return res.json({
        success: true,
        enabled: false,
        settings,
        items: [],
        serverTime: Date.now()
      });
    }
    const items = await cricketNewsService.fetchCricketNewsFeed({
      source: settings.source,
      query: settings.query,
      limit: settings.maxItems,
      preferPlayerImage: settings.preferPlayerImage
    });
    res.setHeader('Cache-Control', 'public, max-age=120');
    return res.json({
      success: true,
      enabled: true,
      settings,
      items,
      serverTime: Date.now()
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch cricket news feed', items: [] });
  }
});

// Public AI Sports News Studio state (DATA VAULT SPORTS HD)
app.get('/api/news-studio/state', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.json({
    success: true,
    state: aiNewsStudioService.getState(),
    serverTime: Date.now()
  });
});

// Public AI Sports News Urdu TTS WAV stream (generated via Gemini TTS & cached)
app.get('/api/news-studio/audio/:bulletinId', async (req: Request, res: Response) => {
  try {
    const bulletinId = String(req.params.bulletinId || '').trim();
    const voice = typeof req.query.voice === 'string' ? req.query.voice.trim() : undefined;
    const wavBuffer = await aiNewsStudioService.synthesizeBulletinWav(bulletinId, voice);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(wavBuffer);
  } catch (err: any) {
    return res.status(503).json({
      success: false,
      error: err?.message || 'Failed to synthesize Urdu anchor audio'
    });
  }
});

// Runtime configuration endpoint
app.get('/api/config', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store');
  const pinStatus = getEffectiveAdminPin();
  const host = req.get('host');
  const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const autoUrl = host ? `${protocol}://${host}` : '';
  const resolvedBaseUrl = process.env.VITE_API_BASE_URL || process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || autoUrl;

  res.json({
    success: true,
    apiBaseUrl: resolvedBaseUrl,
    environment: process.env.NODE_ENV || 'development',
    hasAdminPin: Boolean(pinStatus.pin),
    adminPinConfigured: Boolean(pinStatus.pin),
    pinConfiguredSource: pinStatus.source,
    serverTime: Date.now()
  });
});
// Dynamic Team Flag & Crest Endpoint
app.get('/api/team/flag/:teamCode', handleTeamFlag);

// Dynamic Player Portrait & Avatar Endpoint
app.get('/api/player/photo', handlePlayerPhoto);

// Serve Admin-uploaded player photos cleanly
const PLAYER_UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'player-uploads');
try {
  fsSync.mkdirSync(PLAYER_UPLOADS_DIR, { recursive: true });
} catch {}

app.get('/api/player/uploaded/:filename', async (req: Request, res: Response) => {
  const safeName = path.basename(req.params.filename || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeName) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = path.join(PLAYER_UPLOADS_DIR, safeName);
  if (!fsSync.existsSync(filePath)) {
    return res.status(404).json({ error: 'Photo not found' });
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.sendFile(filePath);
});

// Dynamic Player Statistics, Performance, Strike Rates & Averages Endpoint
app.get('/api/player/stats', handlePlayerStats);

// Player Image / Fallback Avatar Proxy (delegates to dynamic photo resolver)
app.get('/api/player/image/:playerId', (req: Request, res: Response) => {
  const playerId = req.params.playerId;
  const profile = resolvePlayerProfile(playerId);
  if (profile) {
    req.query.name = profile.name;
    req.query.team = profile.teamCode;
    req.query.playerId = profile.id;
  }
  return handlePlayerPhoto(req, res);
});

// Verified Players catalog lookup
app.get('/api/players/verified', (_req: Request, res: Response) => {
  res.json({
    success: true,
    players: Object.values(VERIFIED_PLAYERS)
  });
});

// Discoverable matches list (all public CREX matches)
app.get('/api/matches/discover', async (_req: Request, res: Response) => {
  try {
    const matches = await crexService.getAllDiscoverableMatches();
    res.json({
      success: true,
      matches
    });
  } catch (err: any) {
    res.json({
      success: true,
      matches: PRESET_MATCHES
    });
  }
});

// Match History: Last 5 completed matches from cached CREX data
app.get('/api/matches/history', (_req: Request, res: Response) => {
  try {
    const matches = crexService.getMatchHistory();
    return res.json({
      success: true,
      count: matches.length,
      matches,
      cachedAt: Date.now()
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch match history' });
  }
});

// Live Commentary Feed: Polled text-based match event log for scrolling ticker
app.get('/api/match/commentary', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 40;
    const feed = crexService.getCommentaryFeed(limit);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.json({
      success: true,
      ...feed,
      serverTime: Date.now()
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch commentary feed' });
  }
});

// Match Highlights Feed: Key match events (Wickets, Fours, Sixes) for instant animation replay
app.get('/api/match/highlights', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 30;
    const highlights = crexService.getMatchHighlights(limit);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.json({
      success: true,
      ...highlights,
      serverTime: Date.now()
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch match highlights' });
  }
});

// System health and sync status
app.get('/api/system/status', (_req: Request, res: Response) => {
  const active = crexService.getActiveMatch();
  res.json({
    status: 'online',
    activeMatchId: active.config?.activeMatchId || null,
    isMatchConnected: !!active.matchState,
    lastSyncedAt: active.config?.lastSyncedAt || null,
    serverUrl: process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || null,
    serverTime: Date.now()
  });
});

// Digital Asset Links - lets the installed APK (PWABuilder / Trusted Web Activity) open full-screen without a browser bar.
// Set on Render:  ANDROID_SHA256_FINGERPRINT = AA:BB:...  (comma separated if more than one)
//                 ANDROID_PACKAGE_ID         = com.datavault.livecricket   (the Package ID you chose in PWABuilder)
app.get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINT || '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  if (fingerprints.length === 0) {
    return res.status(404).json({ error: 'ANDROID_SHA256_FINGERPRINT is not set' });
  }
  const packageName = (process.env.ANDROID_PACKAGE_ID || 'com.datavault.livecricket').trim();
  res.setHeader('Content-Type', 'application/json');
  return res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints
      }
    }
  ]);
});

// Render / Cloud Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// Mobile Android FCM Push Device Registration
app.post('/api/notifications/register-device', async (req: Request, res: Response) => {
  try {
    const { token, platform, preferences } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Device token is required' });
    }
    await fcmService.registerToken(token, platform || 'android', preferences);
    return res.json({
      success: true,
      registeredCount: fcmService.getDeviceCount(),
      fcmConfigured: fcmService.isFcmConfigured()
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// Update device notification preferences
app.post('/api/notifications/preferences', async (req: Request, res: Response) => {
  try {
    const { token, preferences } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Device token is required' });
    }
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Preferences object is required' });
    }
    await fcmService.updateTokenPreferences(token, preferences);
    return res.json({ success: true, updated: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update preferences' });
  }
});

// Web Push (installed phone app / PWA) - public key, subscribe, unsubscribe
app.get('/api/push/public-key', async (_req: Request, res: Response) => {
  res.json({ publicKey: await webPushService.getPublicKey() });
});

app.post('/api/push/subscribe', async (req: Request, res: Response) => {
  try {
    await webPushService.subscribe(req.body);
    return res.json({ success: true, subscribers: webPushService.getCount() });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Subscribe failed' });
  }
});

app.post('/api/push/unsubscribe', async (req: Request, res: Response) => {
  try {
    await webPushService.unsubscribe(req.body?.endpoint);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Unsubscribe failed' });
  }
});

// Notifications service status
app.get('/api/notifications/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    fcmConfigured: fcmService.isFcmConfigured(),
    activeDevicesCount: fcmService.getDeviceCount(),
    serverTime: Date.now()
  });
});

// -------------------------------------------------------------
// ADMIN API (Requires Admin PIN)
// -------------------------------------------------------------

app.post('/api/admin/verify-pin', (req: Request, res: Response) => {
  const { pin } = req.body;
  const pinStatus = getEffectiveAdminPin();
  const isAuthorized = verifyPin(pin);
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  if (isAuthorized) {
    console.log(`[ADMIN AUTH] Verification SUCCESS from IP: ${clientIp} (Source: ${pinStatus.source})`);
    return res.json({
      success: true,
      authorized: true
    });
  }

  const isConfigured = Boolean(pinStatus.pin);
  console.warn(`[ADMIN AUTH] Verification FAILED from IP: ${clientIp}. Server hasAdminPin: ${isConfigured}, env: ${process.env.NODE_ENV || 'development'}`);

  return res.status(401).json({
    success: false,
    authorized: false,
    error: !isConfigured
      ? 'Admin PIN not configured on server. Please set ADMIN_PIN in environment or data/admin-pin.key'
      : 'Invalid Admin PIN',
    hasAdminPin: isConfigured
  });
});

// Diagnostic debug endpoint to troubleshoot host environment variables safely
app.get('/api/admin/debug', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store');
  const pinStatus = getEffectiveAdminPin();
  const host = req.get('host') || 'unknown';
  const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';

  res.json({
    status: 'ok',
    timestamp: Date.now(),
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'undefined',
      PORT: process.env.PORT || 'undefined',
      platform: process.platform,
      nodeVersion: process.version
    },
    adminPin: {
      isSetInProcessEnv: Boolean(process.env.ADMIN_PIN && process.env.ADMIN_PIN.trim().length > 0),
      envLength: process.env.ADMIN_PIN ? process.env.ADMIN_PIN.trim().length : 0,
      isSetInFileFallback: pinStatus.source === 'file',
      effectivePinConfigured: Boolean(pinStatus.pin),
      activeSource: pinStatus.source
    },
    network: {
      inferredBaseUrl: `${protocol}://${host}`,
      configuredViteApiBaseUrl: process.env.VITE_API_BASE_URL ? 'configured' : 'empty',
      configuredRenderExternalUrl: process.env.RENDER_EXTERNAL_URL ? 'configured' : 'empty',
      configuredAppUrl: process.env.APP_URL ? 'configured' : 'empty'
    },
    fcm: {
      isFcmServerKeyConfigured: fcmService.isFcmConfigured(),
      deviceCount: fcmService.getDeviceCount()
    }
  });
});

// Connect new match via CREX URL or ID
app.post('/api/admin/match/connect', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { crexUrlOrId } = req.body;
    if (!crexUrlOrId) {
      return res.status(400).json({ error: 'crexUrlOrId is required' });
    }
    const state = await crexService.connectMatch(crexUrlOrId);
    return res.json({ success: true, matchState: state });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to connect match' });
  }
});

// Edit live match state directly (teams, scores, players, overs, status)
app.post('/api/admin/match/edit', requireAdmin, async (req: Request, res: Response) => {
  try {
    const updated = await crexService.updateLiveScoreDetails(req.body);
    return res.json({ success: true, matchState: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update match' });
  }
});

// Disconnect current match
app.post('/api/admin/match/disconnect', requireAdmin, async (_req: Request, res: Response) => {
  try {
    await crexService.disconnectMatch();
    return res.json({ success: true, message: 'Match disconnected successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to disconnect match' });
  }
});

// Trigger test notification / score event (Wicket, 4, 6, 30, 50, 100, 150, 200, 3W, 4W, 5W, Maiden, Match Result)
app.post('/api/admin/match/trigger-event', requireAdmin, (req: Request, res: Response) => {
  const { type } = req.body;
  const allowed = [
    'four',
    'six',
    'wicket',
    'thirty',
    'fifty',
    'century',
    'one_fifty',
    'double_century',
    'three_wickets',
    'four_wickets',
    'five_wickets',
    'maiden',
    'innings_break',
    'match_result',
    'tight_finish',
    'single',
    'dot'
  ];
  if (!allowed.includes(type)) {
    return res.status(400).json({ error: 'Invalid event type' });
  }
  crexService.triggerCustomEvent(type as any);
  return res.json({ success: true, message: `Event ${type} triggered` });
});

// Toggle auto sync
app.post('/api/admin/match/auto-sync', requireAdmin, (req: Request, res: Response) => {
  const { enabled } = req.body;
  crexService.setAutoSync(Boolean(enabled));
  return res.json({ success: true, isAutoSyncEnabled: Boolean(enabled) });
});

// Switch Data Source mode: 'auto' | 'manual'
app.post('/api/admin/match/data-source', requireAdmin, async (req: Request, res: Response) => {
  try {
    const mode = req.body?.mode === 'manual' ? 'manual' : 'auto';
    const config = await crexService.setDataSourceMode(mode);
    const active = crexService.getActiveMatch();
    return res.json({ success: true, config, matchState: active.matchState });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to change data source mode' });
  }
});

// Retry Auto Sync immediately
app.post('/api/admin/match/sync-now', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await crexService.tryAutoSyncOnce();
    const active = crexService.getActiveMatch();
    return res.json({
      success: result.success,
      error: result.error,
      config: active.config,
      matchState: active.matchState
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Sync attempt failed' });
  }
});

// Record single ball outcome in Manual mode (0,1,2,3,4,6,W,wd,nb)
app.post('/api/admin/match/record-ball', requireAdmin, async (req: Request, res: Response) => {
  try {
    const outcome = String(req.body?.outcome || '').trim();
    const allowed = ['0', '1', '2', '3', '4', '6', 'W', 'wd', 'nb'];
    if (!allowed.includes(outcome)) {
      return res.status(400).json({ error: 'Invalid ball outcome. Allowed: 0,1,2,3,4,6,W,wd,nb' });
    }
    const matchState = await crexService.recordManualBall(outcome as any);
    return res.json({ success: true, matchState });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to record delivery' });
  }
});

// Get active match event triggers (public)
app.get('/api/triggers', (_req: Request, res: Response) => {
  const triggers = crexService.getTriggers();
  res.json({ success: true, triggers });
});

// Update trigger definitions (admin only)
app.post('/api/admin/triggers', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { triggers } = req.body;
    if (!Array.isArray(triggers)) {
      return res.status(400).json({ error: 'triggers must be an array' });
    }
    const updated = await crexService.updateTriggers(triggers);
    return res.json({ success: true, triggers: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update triggers' });
  }
});

// Send instant push broadcast announcement to all connected apps (admin only)
app.post('/api/admin/triggers/broadcast', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, message, priority, sound } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }
    await crexService.broadcastCustomTrigger(title, message, priority, sound);
    return res.json({ success: true, message: 'Broadcast sent to all connected apps' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to broadcast' });
  }
});

// Update monetization & sponsor banner settings (admin only)
app.post('/api/admin/monetization', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'config object is required' });
    }
    const updated = await monetizationService.updateConfig(config);
    return res.json({ success: true, config: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update monetization config' });
  }
});

// Admin: Fetch live Cricket News from RSS sources with matched Player Images
app.get('/api/admin/cricket-news/feed', requireAdmin, async (req: Request, res: Response) => {
  try {
    const sourceRaw = typeof req.query.source === 'string' ? req.query.source : undefined;
    const source =
      sourceRaw === 'all' || sourceRaw === 'espncricinfo' || sourceRaw === 'bbc' || sourceRaw === 'googlenews'
        ? sourceRaw
        : undefined;
    const query = typeof req.query.query === 'string' ? req.query.query : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 10;
    const preferPlayerImage =
      typeof req.query.preferPlayerImage === 'string' ? req.query.preferPlayerImage !== 'false' : undefined;
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

    const items = await cricketNewsService.fetchCricketNewsFeed({
      source,
      query,
      limit: Number.isFinite(limit) ? limit : 10,
      preferPlayerImage,
      forceRefresh
    });
    return res.json({
      success: true,
      items,
      settings: cricketNewsService.getSettings(),
      serverTime: Date.now()
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to fetch cricket news' });
  }
});

// Admin: Save Cricket News Source & Auto-Display settings
app.post('/api/admin/cricket-news/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const updated = await cricketNewsService.updateSettings(req.body || {});
    return res.json({ success: true, settings: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to save cricket news settings' });
  }
});

// Admin: Save/Update News Item on server disk (mirrors Firestore for cross-browser persistence)
app.post('/api/admin/news', requireAdmin, async (req: Request, res: Response) => {
  try {
    const item = req.body?.item;
    if (!item || typeof item !== 'object' || !item.title || !item.description) {
      return res.status(400).json({ error: 'Valid news item with title and description is required' });
    }
    const list = await cricketNewsService.upsertAdminNews(item);
    return res.json({ success: true, news: list });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to save news item' });
  }
});

// Admin: Delete News Item on server disk
app.delete('/api/admin/news/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ error: 'News id is required' });
    }
    const list = await cricketNewsService.deleteAdminNews(id);
    return res.json({ success: true, news: list });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to delete news item' });
  }
});

// Admin: Update DATA VAULT SPORTS HD AI News Studio settings
app.post('/api/admin/news-studio/config', requireAdmin, async (req: Request, res: Response) => {
  try {
    const patch = req.body?.config && typeof req.body.config === 'object' ? req.body.config : req.body;
    const state = await aiNewsStudioService.updateConfig(patch || {});
    return res.json({ success: true, state });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update AI News Studio configuration' });
  }
});

// Admin: Force immediate Google Search grounded news gathering & Urdu broadcast script build
app.post('/api/admin/news-studio/refresh', requireAdmin, async (req: Request, res: Response) => {
  try {
    const force = req.body?.force !== false;
    const state = await aiNewsStudioService.refreshNewsNow({ force, triggerSource: 'admin_manual' });
    return res.json({ success: true, state });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to refresh AI News Studio bulletins' });
  }
});

// Admin: Preview Gemini TTS Urdu voice sample
app.post('/api/admin/news-studio/preview-voice', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { voiceName, anchorName } = req.body || {};
    const wavBuffer = await aiNewsStudioService.synthesizeSampleVoiceWav(voiceName, anchorName);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(wavBuffer);
  } catch (err: any) {
    return res.status(503).json({ error: err?.message || 'Failed to synthesize voice preview' });
  }
});

// Admin: Re-categorize or update breaking status for an AI News Studio bulletin
app.patch('/api/admin/news-studio/bulletins/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ error: 'Bulletin id is required' });
    }
    const { editorialCategory, isBreaking } = req.body || {};
    const state = await aiNewsStudioService.updateBulletin(id, {
      editorialCategory,
      isBreaking
    });
    return res.json({ success: true, state });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Failed to update bulletin' });
  }
});

// Admin: Remove a bulletin from the AI News Studio queue
app.delete('/api/admin/news-studio/bulletins/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ error: 'Bulletin id is required' });
    }
    const state = await aiNewsStudioService.deleteBulletin(id);
    return res.json({ success: true, state });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Failed to delete bulletin' });
  }
});

async function saveUploadedImageDataUrl(imageDataUrl: string, prefix: string): Promise<string> {
  const match = imageDataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) {
    throw new Error('Unsupported image format. Use PNG, JPG, WEBP, GIF, or SVG.');
  }
  const rawExt = match[1].toLowerCase();
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt === 'svg+xml' ? 'svg' : rawExt;
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('Image size must be under 5MB');
  }
  await fs.mkdir(PLAYER_UPLOADS_DIR, { recursive: true });
  const cleanSlug = (prefix || 'asset').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 28) || 'asset';
  const filename = `${cleanSlug}_${Date.now()}.${ext}`;
  await fs.writeFile(path.join(PLAYER_UPLOADS_DIR, filename), buffer);
  return `/api/player/uploaded/${filename}`;
}

// Public custom media map (players & team flags)
app.get('/api/media/custom', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.json({
    success: true,
    ...crexService.getAllCustomMedia()
  });
});

// Upload or set a player photo URL for striker, nonStriker, bowler, or any player (admin only)
app.post('/api/admin/player/photo', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { role, imageUrl, imageDataUrl, playerName, teamCode } = req.body || {};
    if (role !== 'striker' && role !== 'nonStriker' && role !== 'bowler' && role !== 'player') {
      return res.status(400).json({ error: 'role must be striker, nonStriker, bowler, or player' });
    }

    let finalUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';

    if (typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/')) {
      finalUrl = await saveUploadedImageDataUrl(imageDataUrl, playerName || role);
    }

    const matchState = await crexService.setCustomPlayerPhoto(role, finalUrl, playerName, teamCode);
    return res.json({ success: true, imageUrl: finalUrl, matchState });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save player photo' });
  }
});

// Upload or set a custom Team Flag / Logo URL (admin only)
app.post('/api/admin/team/flag', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { teamCode, teamName, role, imageUrl, imageDataUrl } = req.body || {};
    let finalUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';

    if (typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/')) {
      finalUrl = await saveUploadedImageDataUrl(imageDataUrl, `flag_${teamCode || teamName || role || 'team'}`);
    }

    const matchState = await crexService.setCustomTeamFlag(teamCode || '', finalUrl, teamName, role);
    return res.json({ success: true, imageUrl: finalUrl, matchState });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save team flag/logo' });
  }
});

// Generic admin media upload (e.g. Sponsor Logo or Sponsor Banner)
app.post('/api/admin/media/upload', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { imageDataUrl, prefix } = req.body || {};
    if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Valid base64 imageDataUrl is required' });
    }
    const finalUrl = await saveUploadedImageDataUrl(imageDataUrl, prefix || 'sponsor');
    return res.json({ success: true, imageUrl: finalUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to upload image' });
  }
});

// TV Screen Media Storage & Upload (supports video/mp4, webm, mov, ogg & images up to 60MB)
const TV_MEDIA_DIR = path.resolve(process.cwd(), 'data', 'tv-media');
try {
  fsSync.mkdirSync(TV_MEDIA_DIR, { recursive: true });
} catch {}

const TV_MEDIA_MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.mkv': 'video/x-matroska',
  '.3gp': 'video/3gpp',
  '.avi': 'video/x-msvideo',
  '.ts': 'video/mp2t',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

app.get('/api/media/tv/:filename', (req: Request, res: Response) => {
  const safeName = path.basename(req.params.filename || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeName) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = path.join(TV_MEDIA_DIR, safeName);
  if (!fsSync.existsSync(filePath)) {
    return res.status(404).json({ error: 'Media not found' });
  }
  const ext = path.extname(safeName).toLowerCase();
  if (TV_MEDIA_MIME_BY_EXT[ext]) {
    res.setHeader('Content-Type', TV_MEDIA_MIME_BY_EXT[ext]);
  }
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.sendFile(filePath);
});

const TV_MEDIA_TMP_DIR = path.join(TV_MEDIA_DIR, '.tmp');
const TV_MEDIA_MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'application/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogg',
  'application/ogg': 'ogg',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
  'video/x-matroska': 'mkv',
  'video/3gpp': '3gp',
  'video/3gpp2': '3gp',
  'video/x-msvideo': 'avi',
  'video/avi': 'avi',
  'video/msvideo': 'avi',
  'video/mp2t': 'ts',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg'
};
const TV_MEDIA_ALLOWED_EXTS = new Set([
  'mp4',
  'webm',
  'ogg',
  'ogv',
  'mov',
  'm4v',
  'mkv',
  '3gp',
  'avi',
  'ts',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'svg'
]);

function resolveTvMediaExt(rawFileName: string, contentType: string): { ext: string; origExt: string } {
  const origExt = path.extname(rawFileName).toLowerCase().replace('.', '');
  const normalizedOrigExt = origExt === 'jpeg' ? 'jpg' : origExt === 'ogv' ? 'ogg' : origExt;
  let ext = TV_MEDIA_ALLOWED_EXTS.has(normalizedOrigExt) ? normalizedOrigExt : '';
  if (!ext) {
    ext = TV_MEDIA_MIME_TO_EXT[contentType.split(';')[0].trim().toLowerCase()] || '';
  }
  return { ext, origExt };
}

async function cleanupStaleTvMediaChunks(): Promise<void> {
  try {
    const entries = await fs.readdir(TV_MEDIA_TMP_DIR, { withFileTypes: true });
    const cutoff = Date.now() - 30 * 60 * 1000;
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isFile()) return;
        const p = path.join(TV_MEDIA_TMP_DIR, entry.name);
        try {
          const st = await fs.stat(p);
          if (st.mtimeMs < cutoff) {
            await fs.unlink(p);
          }
        } catch {}
      })
    );
  } catch {}
}

app.post(
  '/api/admin/tv-media/upload',
  (req: Request, res: Response, next: () => void) => {
    const rawHeaderName = String(req.headers['x-file-name'] || '');
    let decodedName = rawHeaderName;
    try {
      decodedName = decodeURIComponent(rawHeaderName);
    } catch {}
    console.info('[TV-MEDIA-UPLOAD] Incoming upload request', {
      fileName: decodedName || '(none)',
      contentType: String(req.headers['content-type'] || '(none)'),
      contentLength: String(req.headers['content-length'] || '(chunked)'),
      hasAdminPinHeader: Boolean(req.headers['x-admin-pin'])
    });
    res.on('finish', () => {
      if (res.statusCode === 401) {
        console.warn('[TV-MEDIA-UPLOAD] Rejected 401: Invalid or missing Admin PIN', {
          fileName: decodedName || '(none)',
          hasAdminPinHeader: Boolean(req.headers['x-admin-pin'])
        });
      }
    });
    next();
  },
  requireAdmin,
  express.raw({
    type: () => true,
    limit: '65mb'
  }),
  async (req: Request, res: Response) => {
    const encodedFileName = String(req.headers['x-file-name'] || '');
    let rawFileName = encodedFileName;
    try {
      rawFileName = decodeURIComponent(encodedFileName);
    } catch {}
    const contentType = String(req.headers['content-type'] || '').toLowerCase();

    try {
      const buf = req.body;
      if (!Buffer.isBuffer(buf) || buf.length === 0) {
        console.warn('[TV-MEDIA-UPLOAD] Rejected 400 EMPTY_PAYLOAD', {
          fileName: rawFileName || '(none)',
          contentType,
          isBuffer: Buffer.isBuffer(buf)
        });
        return res.status(400).json({
          error: 'Empty media payload (0 bytes received by server).',
          code: 'EMPTY_PAYLOAD'
        });
      }
      if (buf.length > 60 * 1024 * 1024) {
        const sizeMb = (buf.length / (1024 * 1024)).toFixed(2);
        console.warn('[TV-MEDIA-UPLOAD] Rejected 413 FILE_TOO_LARGE', {
          fileName: rawFileName || '(none)',
          sizeMb,
          byteLength: buf.length
        });
        return res.status(413).json({
          error: `File size (${sizeMb} MB) exceeds the 60 MB limit.`,
          code: 'FILE_TOO_LARGE'
        });
      }

      const { ext, origExt } = resolveTvMediaExt(rawFileName, contentType);
      if (!ext) {
        console.warn('[TV-MEDIA-UPLOAD] Rejected 400 UNSUPPORTED_FORMAT', {
          fileName: rawFileName || '(none)',
          origExt: origExt || '(none)',
          contentType: contentType || '(none)',
          byteLength: buf.length
        });
        return res.status(400).json({
          error: `Unsupported media format (ext="${origExt || 'none'}", type="${
            contentType.split(';')[0].trim() || 'none'
          }"). Use MP4, WebM, MOV, M4V, MKV, OGG, 3GP, AVI, TS, PNG, JPG, or WEBP.`,
          code: 'UNSUPPORTED_FORMAT'
        });
      }

      await fs.mkdir(TV_MEDIA_DIR, { recursive: true });
      const baseSlug =
        path
          .basename(rawFileName, path.extname(rawFileName))
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .slice(0, 28) || 'tv_ad';
      const filename = `${baseSlug}_${Date.now()}.${ext}`;
      await fs.writeFile(path.join(TV_MEDIA_DIR, filename), buf);

      console.info('[TV-MEDIA-UPLOAD] Saved media file successfully', {
        filename,
        ext,
        byteLength: buf.length,
        sizeMb: (buf.length / (1024 * 1024)).toFixed(2)
      });

      return res.json({
        success: true,
        url: `/api/media/tv/${filename}`
      });
    } catch (err: any) {
      console.error('[TV-MEDIA-UPLOAD] Server write error', {
        fileName: rawFileName || '(none)',
        message: err?.message || String(err)
      });
      return res.status(500).json({
        error: err.message || 'Failed to upload TV media',
        code: 'SERVER_WRITE_ERROR'
      });
    }
  },
  (err: any, _req: Request, res: Response, _next: any) => {
    const status = err?.status || err?.statusCode || (err?.type === 'entity.too.large' ? 413 : 400);
    const code =
      err?.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : err?.type || 'RAW_BODY_ERROR';
    console.error('[TV-MEDIA-UPLOAD] Raw body parser error', {
      status,
      code,
      message: err?.message
    });
    return res.status(status).json({
      error:
        err?.type === 'entity.too.large'
          ? 'Video file exceeds the 65 MB server payload limit.'
          : err?.message || 'Failed to parse uploaded video payload',
      code
    });
  }
);

app.post(
  '/api/admin/tv-media/upload-chunk',
  requireAdmin,
  express.raw({
    type: () => true,
    limit: '8mb'
  }),
  async (req: Request, res: Response) => {
    const encodedFileName = String(req.headers['x-file-name'] || '');
    let rawFileName = encodedFileName;
    try {
      rawFileName = decodeURIComponent(encodedFileName);
    } catch {}
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    const rawUploadId = String(req.headers['x-upload-id'] || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const chunkIndex = Number.parseInt(String(req.headers['x-chunk-index'] || ''), 10);
    const totalChunks = Number.parseInt(String(req.headers['x-total-chunks'] || ''), 10);

    if (
      !rawUploadId ||
      rawUploadId.length < 4 ||
      !Number.isInteger(chunkIndex) ||
      !Number.isInteger(totalChunks) ||
      totalChunks < 1 ||
      totalChunks > 64 ||
      chunkIndex < 0 ||
      chunkIndex >= totalChunks
    ) {
      return res.status(400).json({
        error: 'Invalid chunked upload headers (x-upload-id, x-chunk-index, x-total-chunks).',
        code: 'INVALID_CHUNK_HEADERS'
      });
    }

    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      return res.status(400).json({
        error: 'Empty media chunk payload (0 bytes received).',
        code: 'EMPTY_PAYLOAD'
      });
    }

    const { ext, origExt } = resolveTvMediaExt(rawFileName, contentType);
    if (!ext) {
      return res.status(400).json({
        error: `Unsupported media format (ext="${origExt || 'none'}", type="${
          contentType.split(';')[0].trim() || 'none'
        }"). Use MP4, WebM, MOV, M4V, MKV, OGG, 3GP, AVI, TS, PNG, JPG, or WEBP.`,
        code: 'UNSUPPORTED_FORMAT'
      });
    }

    const tmpPath = path.join(TV_MEDIA_TMP_DIR, `${rawUploadId}.part`);
    try {
      await fs.mkdir(TV_MEDIA_TMP_DIR, { recursive: true });
      if (chunkIndex === 0) {
        void cleanupStaleTvMediaChunks();
        await fs.writeFile(tmpPath, buf);
      } else {
        let currentSize = 0;
        try {
          const stat = await fs.stat(tmpPath);
          currentSize = stat.size;
        } catch {
          return res.status(409).json({
            error: 'Upload session expired or missing initial chunk. Please retry upload.',
            code: 'CHUNK_SESSION_MISSING'
          });
        }
        if (currentSize + buf.length > 60 * 1024 * 1024) {
          await fs.unlink(tmpPath).catch(() => {});
          return res.status(413).json({
            error: 'Combined file size exceeds the 60 MB upload limit.',
            code: 'FILE_TOO_LARGE'
          });
        }
        await fs.appendFile(tmpPath, buf);
      }

      if (chunkIndex < totalChunks - 1) {
        return res.json({
          success: true,
          partial: true,
          chunkIndex,
          totalChunks
        });
      }

      const finalStat = await fs.stat(tmpPath);
      if (finalStat.size > 60 * 1024 * 1024) {
        await fs.unlink(tmpPath).catch(() => {});
        return res.status(413).json({
          error: 'Combined file size exceeds the 60 MB upload limit.',
          code: 'FILE_TOO_LARGE'
        });
      }

      await fs.mkdir(TV_MEDIA_DIR, { recursive: true });
      const baseSlug =
        path
          .basename(rawFileName, path.extname(rawFileName))
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .slice(0, 28) || 'tv_ad';
      const filename = `${baseSlug}_${Date.now()}.${ext}`;
      await fs.rename(tmpPath, path.join(TV_MEDIA_DIR, filename));

      console.info('[TV-MEDIA-UPLOAD] Saved chunked media file successfully', {
        filename,
        ext,
        chunks: totalChunks,
        byteLength: finalStat.size,
        sizeMb: (finalStat.size / (1024 * 1024)).toFixed(2)
      });

      return res.json({
        success: true,
        url: `/api/media/tv/${filename}`
      });
    } catch (err: any) {
      await fs.unlink(tmpPath).catch(() => {});
      console.error('[TV-MEDIA-UPLOAD] Chunked upload write error', {
        fileName: rawFileName || '(none)',
        chunkIndex,
        totalChunks,
        message: err?.message || String(err)
      });
      return res.status(500).json({
        error: err?.message || 'Failed to save uploaded media chunk',
        code: 'SERVER_WRITE_ERROR'
      });
    }
  },
  (err: any, _req: Request, res: Response, _next: any) => {
    const status = err?.status || err?.statusCode || (err?.type === 'entity.too.large' ? 413 : 400);
    const code =
      err?.type === 'entity.too.large' ? 'CHUNK_TOO_LARGE' : err?.type || 'RAW_BODY_ERROR';
    return res.status(status).json({
      error: err?.message || 'Failed to parse media chunk payload',
      code
    });
  }
);

// Default Match Event & Crowd Audio Assets Folder (/Assets)
const ASSETS_DIR = path.resolve(process.cwd(), 'Assets');
try {
  fsSync.mkdirSync(ASSETS_DIR, { recursive: true });
} catch {}

app.use(
  '/Assets',
  express.static(ASSETS_DIR, {
    maxAge: '1h',
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  })
);

app.get('/api/audio/assets', async (_req: Request, res: Response) => {
  const slots: Array<{ key: 'four' | 'six' | 'wicket' | 'crowd'; filename: string; label: string }> = [
    { key: 'four', filename: 'four.mp3', label: 'Four (4) Boundary' },
    { key: 'six', filename: 'six.mp3', label: 'Six (6) Maximum' },
    { key: 'wicket', filename: 'wicket.mp3', label: 'Wicket Timber' },
    { key: 'crowd', filename: 'crowd.mp3', label: 'Crowd Ambience Loop' }
  ];

  const assets = await Promise.all(
    slots.map(async (slot) => {
      const filePath = path.join(ASSETS_DIR, slot.filename);
      try {
        const stat = await fs.stat(filePath);
        return {
          key: slot.key,
          label: slot.label,
          filename: slot.filename,
          url: `/Assets/${slot.filename}`,
          exists: stat.isFile(),
          sizeBytes: stat.size
        };
      } catch {
        return {
          key: slot.key,
          label: slot.label,
          filename: slot.filename,
          url: `/Assets/${slot.filename}`,
          exists: false,
          sizeBytes: 0
        };
      }
    })
  );

  return res.json({ success: true, assets });
});

// Lightweight Cricket Sound Effects & Crowd Audio Storage (strict 3MB max)
const AUDIO_MEDIA_DIR = path.resolve(process.cwd(), 'data', 'audio-media');
try {
  fsSync.mkdirSync(AUDIO_MEDIA_DIR, { recursive: true });
} catch {}

app.get('/api/media/audio/:filename', (req: Request, res: Response) => {
  const safeName = path.basename(req.params.filename || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeName) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = path.join(AUDIO_MEDIA_DIR, safeName);
  if (!fsSync.existsSync(filePath)) {
    return res.status(404).json({ error: 'Audio file not found' });
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.sendFile(filePath);
});

app.post(
  '/api/admin/audio/upload',
  requireAdmin,
  express.raw({
    type: ['audio/*', 'application/octet-stream'],
    limit: '3mb'
  }),
  async (req: Request, res: Response) => {
    try {
      const buf = req.body;
      if (!Buffer.isBuffer(buf) || buf.length === 0) {
        return res.status(400).json({ error: 'Empty audio payload' });
      }
      if (buf.length > 3 * 1024 * 1024) {
        return res.status(413).json({ error: 'Audio file 3MB se chhoti honi chahiye taake app fast rahe.' });
      }

      const rawFileName = String(req.headers['x-file-name'] || '');
      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      const origExt = path.extname(rawFileName).toLowerCase().replace('.', '');

      const mimeToExt: Record<string, string> = {
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/wave': 'wav',
        'audio/x-wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/webm': 'webm',
        'audio/mp4': 'm4a',
        'audio/x-m4a': 'm4a',
        'audio/aac': 'aac'
      };
      const allowedExts = new Set(['mp3', 'wav', 'ogg', 'webm', 'm4a', 'aac']);

      let ext = mimeToExt[contentType.split(';')[0].trim()] || '';
      if (!ext && allowedExts.has(origExt)) {
        ext = origExt;
      }
      if (!ext) {
        return res.status(400).json({ error: 'Unsupported audio format. Use MP3, WAV, OGG, WEBM, or M4A.' });
      }

      await fs.mkdir(AUDIO_MEDIA_DIR, { recursive: true });
      const baseSlug =
        path
          .basename(rawFileName, path.extname(rawFileName))
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .slice(0, 28) || 'cricket_sfx';
      const filename = `${baseSlug}_${Date.now()}.${ext}`;
      await fs.writeFile(path.join(AUDIO_MEDIA_DIR, filename), buf);

      return res.json({
        success: true,
        url: `/api/media/audio/${filename}`
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to upload audio file' });
    }
  }
);

// Direct Android APK Storage & Upload (supports .apk files up to 100MB)
const APK_DIR = path.resolve(process.cwd(), 'data', 'apk');
try {
  fsSync.mkdirSync(APK_DIR, { recursive: true });
} catch {}

app.get('/api/app/download/:filename', (req: Request, res: Response) => {
  const safeName = path.basename(req.params.filename || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeName || !safeName.toLowerCase().endsWith('.apk')) {
    return res.status(400).json({ error: 'Invalid APK filename' });
  }
  const filePath = path.join(APK_DIR, safeName);
  if (!fsSync.existsSync(filePath)) {
    return res.status(404).json({ error: 'APK file not found' });
  }
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.sendFile(filePath);
});

app.post(
  '/api/admin/apk/upload',
  requireAdmin,
  express.raw({
    type: () => true,
    limit: '100mb'
  }),
  async (req: Request, res: Response) => {
    try {
      const buf = req.body;
      if (!Buffer.isBuffer(buf) || buf.length === 0) {
        return res.status(400).json({ error: 'Empty APK payload' });
      }
      if (buf.length > 100 * 1024 * 1024) {
        return res.status(413).json({ error: 'APK file must be under 100MB' });
      }

      const encodedFileName = String(req.headers['x-file-name'] || '');
      let rawFileName = encodedFileName;
      try {
        rawFileName = decodeURIComponent(encodedFileName);
      } catch {}

      await fs.mkdir(APK_DIR, { recursive: true });
      const baseSlug =
        path
          .basename(rawFileName, path.extname(rawFileName))
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .slice(0, 28) || 'live_cricket_app';
      const filename = `${baseSlug}_${Date.now()}.apk`;
      await fs.writeFile(path.join(APK_DIR, filename), buf);

      return res.json({
        success: true,
        url: `/api/app/download/${filename}`
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to upload APK file' });
    }
  }
);

app.post('/api/admin/apk/verify', requireAdmin, async (req: Request, res: Response) => {
  const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  const startedAt = Date.now();
  const checkedAt = Date.now();

  if (!rawUrl) {
    return res.status(400).json({
      valid: false,
      is200Ok: false,
      status: 0,
      statusText: 'Bad Request',
      methodUsed: 'HEAD',
      latencyMs: 0,
      checkedAt,
      error: 'URL is required'
    });
  }

  // Local server-hosted APK file verification
  if (rawUrl.startsWith('/api/app/download/')) {
    const safeName = path.basename(rawUrl).replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = path.join(APK_DIR, safeName);
    if (safeName.toLowerCase().endsWith('.apk') && fsSync.existsSync(filePath)) {
      const stat = fsSync.statSync(filePath);
      return res.json({
        valid: true,
        is200Ok: true,
        status: 200,
        statusText: 'OK',
        methodUsed: 'LOCAL',
        latencyMs: Date.now() - startedAt,
        contentType: 'application/vnd.android.package-archive',
        finalUrl: rawUrl,
        contentLength: stat.size,
        checkedAt
      });
    }
    return res.json({
      valid: false,
      is200Ok: false,
      status: 404,
      statusText: 'Not Found',
      methodUsed: 'LOCAL',
      latencyMs: Date.now() - startedAt,
      checkedAt,
      error: 'Uploaded APK file not found on server'
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return res.status(400).json({
      valid: false,
      is200Ok: false,
      status: 0,
      statusText: 'Invalid URL',
      methodUsed: 'HEAD',
      latencyMs: 0,
      checkedAt,
      error: 'Invalid URL format'
    });
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return res.status(400).json({
      valid: false,
      is200Ok: false,
      status: 0,
      statusText: 'Unsupported Protocol',
      methodUsed: 'HEAD',
      latencyMs: 0,
      checkedAt,
      error: 'Only http/https URLs are supported'
    });
  }

  const host = parsed.hostname.toLowerCase();
  const isPrivateHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  if (isPrivateHost) {
    return res.status(400).json({
      valid: false,
      is200Ok: false,
      status: 0,
      statusText: 'Blocked Host',
      methodUsed: 'HEAD',
      latencyMs: 0,
      checkedAt,
      error: 'Private or loopback addresses cannot be probed'
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    let methodUsed: 'HEAD' | 'GET_RANGE' = 'HEAD';
    let response = await fetch(parsed.toString(), {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal
    });

    if (response.status === 405 || response.status === 403) {
      methodUsed = 'GET_RANGE';
      response = await fetch(parsed.toString(), {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        redirect: 'follow',
        signal: controller.signal
      });
    }

    const lenHeader = response.headers.get('content-length');
    const rangeHeader = response.headers.get('content-range');
    let contentLength = lenHeader ? Number(lenHeader) : undefined;
    if (methodUsed === 'GET_RANGE' && rangeHeader) {
      const totalMatch = rangeHeader.match(/\/(\d+)\s*$/);
      if (totalMatch) {
        contentLength = Number(totalMatch[1]);
      }
    }
    const contentType = response.headers.get('content-type') || undefined;
    const is200Ok =
      methodUsed === 'HEAD'
        ? response.status === 200
        : response.status === 200 || response.status === 206;

    return res.json({
      valid: response.ok,
      is200Ok,
      status: response.status,
      statusText: response.statusText || (response.ok ? 'OK' : 'Error'),
      methodUsed,
      latencyMs: Date.now() - startedAt,
      contentType,
      finalUrl: response.url || parsed.toString(),
      contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
      checkedAt,
      error: response.ok
        ? undefined
        : `Server returned HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
    });
  } catch (err: any) {
    return res.json({
      valid: false,
      is200Ok: false,
      status: 0,
      statusText: err?.name === 'AbortError' ? 'Timeout' : 'Network Error',
      methodUsed: 'HEAD',
      latencyMs: Date.now() - startedAt,
      checkedAt,
      error: err?.name === 'AbortError' ? 'Verification timed out' : err?.message || 'Unable to reach URL'
    });
  } finally {
    clearTimeout(timeout);
  }
});

// Internal Analytics: App Download Intent Logging
const DOWNLOAD_ANALYTICS_FILE = path.resolve(process.cwd(), 'data', 'download-analytics.json');
interface DownloadIntentRecord {
  id: string;
  elementId: string;
  variant: string;
  action: 'apk_download' | 'pwa_install' | 'install_modal';
  fileUrl: string;
  version: string;
  siteName: string;
  pagePath: string;
  userAgent: string;
  timestamp: number;
}

interface DownloadAnalyticsStore {
  totalClicks: number;
  recentEvents: DownloadIntentRecord[];
}

async function readDownloadAnalyticsStore(): Promise<DownloadAnalyticsStore> {
  try {
    const raw = await fs.readFile(DOWNLOAD_ANALYTICS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      totalClicks: typeof parsed?.totalClicks === 'number' ? parsed.totalClicks : 0,
      recentEvents: Array.isArray(parsed?.recentEvents) ? parsed.recentEvents : []
    };
  } catch {
    return { totalClicks: 0, recentEvents: [] };
  }
}

app.post('/api/analytics/download-intent', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const sanitizeStr = (val: unknown, maxLen: number): string =>
      typeof val === 'string' ? val.trim().slice(0, maxLen) : '';

    const rawAction = sanitizeStr(body.action, 32);
    const action: DownloadIntentRecord['action'] =
      rawAction === 'pwa_install' || rawAction === 'install_modal' ? rawAction : 'apk_download';

    const record: DownloadIntentRecord = {
      id: `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      elementId: sanitizeStr(body.elementId, 64) || 'app-download-button',
      variant: sanitizeStr(body.variant, 32) || 'banner',
      action,
      fileUrl: sanitizeStr(body.fileUrl, 512),
      version: sanitizeStr(body.version, 32),
      siteName: sanitizeStr(body.siteName, 120),
      pagePath: sanitizeStr(body.pagePath, 256),
      userAgent: sanitizeStr(req.headers['user-agent'], 256),
      timestamp: Date.now()
    };

    const store = await readDownloadAnalyticsStore();
    store.totalClicks += 1;
    store.recentEvents = [record, ...store.recentEvents].slice(0, 200);

    await fs.mkdir(path.dirname(DOWNLOAD_ANALYTICS_FILE), { recursive: true });
    await fs.writeFile(DOWNLOAD_ANALYTICS_FILE, JSON.stringify(store, null, 2), 'utf-8');

    return res.status(200).json({
      success: true,
      totalClicks: store.totalClicks,
      eventId: record.id
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to log download intent' });
  }
});

app.get('/api/admin/analytics/downloads', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const store = await readDownloadAnalyticsStore();
    return res.json({
      success: true,
      totalClicks: store.totalClicks,
      recentEvents: store.recentEvents
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to read download analytics' });
  }
});

// -------------------------------------------------------------
// VITE DEV SERVER OR PRODUCTION STATIC SERVING
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);
  httpServer.requestTimeout = 10 * 60 * 1000;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const indexHtmlPath = path.resolve(distPath, 'index.html');
    app.use(express.static(distPath));

    app.get('*', async (_req: Request, res: Response) => {
      try {
        const rawHtml = await fs.readFile(indexHtmlPath, 'utf-8');
        const runtimeConfig = {
          apiBaseUrl: process.env.VITE_API_BASE_URL || process.env.RENDER_EXTERNAL_URL || '',
          deployedAt: Date.now()
        };
        const scriptTag = `<script>window.__RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};</script>`;
        const finalHtml = rawHtml.includes('</head>')
          ? rawHtml.replace('</head>', `${scriptTag}</head>`)
          : rawHtml + scriptTag;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(finalHtml);
      } catch {
        res.status(200).send('Live Cricket HD & Studio Cloud API Server Online. Use /api/match/active or build web assets with npm run build.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    const pinStatus = getEffectiveAdminPin();
    console.log(`Live Cricket HD & Studio server listening on http://0.0.0.0:${PORT}`);
    if (pinStatus.pin) {
      console.log(`[SECURITY] Admin PIN initialized securely from source: ${pinStatus.source} (length: ${pinStatus.pin.length} chars)`);
    } else {
      console.warn(`[SECURITY WARNING] No ADMIN_PIN configured on server! Admin Studio will reject authentication until ADMIN_PIN is set in environment or data/admin-pin.key`);
    }
  });

  httpServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[SERVER] Port ${PORT} is temporarily busy. Waiting for port release...`);
    } else {
      console.error('[SERVER ERROR]', err);
    }
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
