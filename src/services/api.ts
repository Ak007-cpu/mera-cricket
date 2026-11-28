import { MatchState, ActiveMatchConfig, DiscoverableMatch, MatchTriggerDefinition, PlayerDetailedStats, CompletedMatchItem, CommentaryItem, CommentaryFeedResponse, MatchHighlightsResponse, MonetizationConfig, LiveViewerStats, CricketNewsSettings, CricketNewsSource, FetchedCricketNewsItem, NewsItem, AiNewsStudioConfig, AiNewsStudioState, AiNewsVoiceName, AiNewsEditorialCategory } from '../types/cricket';

export interface SyncResponse {
  success: boolean;
  data: MatchState | null;
  config: ActiveMatchConfig | null;
  serverTime: number;
}

/**
 * Resolves the backend base URL:
 * - Priority 1: Stored custom server URL in localStorage (configured in Android app settings)
 * - Priority 2: VITE_API_BASE_URL environment variable
 * - Priority 3: Current window.location.origin if in web browser
 * - Priority 4: Empty string (relative path)
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // 1. Explicit custom URL configured in Settings
    const custom = localStorage.getItem('custom_backend_url');
    if (custom && custom.trim().startsWith('http')) {
      return custom.trim().replace(/\/+$/, '');
    }
    // 2. Runtime configuration injected by Express server on Render / Cloud
    const runtimeConfig = (window as any).__RUNTIME_CONFIG__;
    if (runtimeConfig?.apiBaseUrl && typeof runtimeConfig.apiBaseUrl === 'string' && runtimeConfig.apiBaseUrl.trim().startsWith('http')) {
      return runtimeConfig.apiBaseUrl.trim().replace(/\/+$/, '');
    }
  }
  // 3. Build-time Vite environment variable
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().startsWith('http')) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  // 4. Current browser window origin (Exclude native Capacitor & localhost APK origins)
  if (
    typeof window !== 'undefined' &&
    window.location &&
    window.location.origin
  ) {
    const origin = window.location.origin.toLowerCase();
    const isCapacitorOrLocal =
      origin.includes('capacitor://') ||
      origin.startsWith('https://localhost') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:';

    if (!isCapacitorOrLocal) {
      return window.location.origin;
    }
  }
  return '';
}

export function setCustomApiBaseUrl(url: string) {
  if (typeof window !== 'undefined') {
    if (!url || !url.trim()) {
      localStorage.removeItem('custom_backend_url');
    } else {
      localStorage.setItem('custom_backend_url', url.trim().replace(/\/+$/, ''));
    }
  }
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${cleanPath}` : cleanPath;
}

export async function fetchActiveMatch(): Promise<SyncResponse> {
  const res = await fetch(buildApiUrl('/api/match/active'), {
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch active match: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchMatchTriggers(): Promise<MatchTriggerDefinition[]> {
  try {
    const res = await fetch(buildApiUrl('/api/triggers'));
    if (!res.ok) return [];
    const json = await res.json();
    return json.triggers || [];
  } catch {
    return [];
  }
}

export async function updateMatchTriggers(triggers: MatchTriggerDefinition[], adminPin: string): Promise<MatchTriggerDefinition[]> {
  const res = await fetch(buildApiUrl('/api/admin/triggers'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ triggers, adminPin })
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Failed to update triggers');
  }
  return json.triggers;
}

export async function sendPushBroadcast(
  title: string,
  message: string,
  priority: 'high' | 'medium' | 'low',
  sound: string,
  adminPin: string
): Promise<void> {
  const res = await fetch(buildApiUrl('/api/admin/triggers/broadcast'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ title, message, priority, sound, adminPin })
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Failed to send broadcast');
  }
}

export async function fetchDiscoverableMatches(): Promise<DiscoverableMatch[]> {
  const res = await fetch(buildApiUrl('/api/matches/discover'));
  if (!res.ok) throw new Error('Failed to fetch matches');
  const json = await res.json();
  return json.matches || [];
}

export async function fetchMatchHistory(): Promise<CompletedMatchItem[]> {
  try {
    const res = await fetch(buildApiUrl('/api/matches/history'), {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to fetch history');
    const json = await res.json();
    if (json.success && Array.isArray(json.matches)) {
      try {
        localStorage.setItem('cricket_cached_match_history', JSON.stringify(json.matches));
      } catch {}
      return json.matches;
    }
  } catch (err) {
    console.debug('Error fetching match history from server, checking local cache:', err);
  }

  // Graceful local cache fallback
  try {
    const local = localStorage.getItem('cricket_cached_match_history');
    if (local) {
      return JSON.parse(local);
    }
  } catch {}

  return [];
}

export async function connectCrexMatch(crexUrlOrId: string, adminPin: string): Promise<MatchState> {
  const res = await fetch(buildApiUrl('/api/admin/match/connect'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ crexUrlOrId, adminPin })
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Failed to connect match');
  }
  return json.matchState;
}

export async function disconnectMatch(adminPin: string): Promise<void> {
  const res = await fetch(buildApiUrl('/api/admin/match/disconnect'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ adminPin })
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error || 'Failed to disconnect match');
  }
}

export async function editMatchDetails(details: any, adminPin: string): Promise<MatchState> {
  const res = await fetch(buildApiUrl('/api/admin/match/edit'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ ...details, adminPin })
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Failed to update match details');
  }
  return json.matchState;
}

export async function triggerLiveEvent(
  type:
    | 'four'
    | 'six'
    | 'wicket'
    | 'thirty'
    | 'fifty'
    | 'century'
    | 'one_fifty'
    | 'double_century'
    | 'three_wickets'
    | 'four_wickets'
    | 'five_wickets'
    | 'maiden'
    | 'innings_break'
    | 'match_result'
    | 'tight_finish'
    | 'single'
    | 'dot',
  adminPin: string
) {
  const res = await fetch(buildApiUrl('/api/admin/match/trigger-event'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ type, adminPin })
  });
  return res.json();
}

export async function toggleAutoSync(enabled: boolean, adminPin: string) {
  const res = await fetch(buildApiUrl('/api/admin/match/auto-sync'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ enabled, adminPin })
  });
  return res.json();
}

export async function setDataSourceMode(
  mode: 'auto' | 'manual',
  adminPin: string
): Promise<{ success: boolean; config: ActiveMatchConfig; matchState: MatchState | null }> {
  const res = await fetch(buildApiUrl('/api/admin/match/data-source'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ mode, adminPin })
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Failed to change data source mode');
  }
  return json;
}

export async function syncMatchNow(
  adminPin: string
): Promise<{ success: boolean; error?: string; config: ActiveMatchConfig | null; matchState: MatchState | null }> {
  const res = await fetch(buildApiUrl('/api/admin/match/sync-now'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ adminPin })
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Failed to retry sync');
  }
  return json;
}

export type ManualBallOutcome = '0' | '1' | '2' | '3' | '4' | '6' | 'W' | 'wd' | 'nb';

export async function recordManualBall(outcome: ManualBallOutcome, adminPin: string): Promise<MatchState> {
  const res = await fetch(buildApiUrl('/api/admin/match/record-ball'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ outcome, adminPin })
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Failed to record delivery');
  }
  return json.matchState;
}

export interface VerifyPinResult {
  authorized: boolean;
  error?: string;
  hasAdminPin?: boolean;
}

export async function verifyAdminPin(pin: string): Promise<VerifyPinResult> {
  try {
    const res = await fetch(buildApiUrl('/api/admin/verify-pin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const json = await res.json();
    return {
      authorized: json.authorized === true,
      error: json.error,
      hasAdminPin: json.hasAdminPin
    };
  } catch (err: any) {
    return {
      authorized: false,
      error: `Connection error: ${err.message || 'Cannot reach backend server'}`
    };
  }
}

/**
 * Triggers native haptic vibration if supported
 */
export function vibrateDevice(pattern: number | number[] = [150, 50, 150]) {
  try {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Vibration not allowed or supported
  }
}

/**
 * Synthesizes subtle stadium alerts using Web Audio API (Zero external mp3 asset failures)
 */
export function playCricketSound(
  type:
    | 'four'
    | 'six'
    | 'boundary'
    | 'wicket'
    | 'century'
    | 'fifty'
    | 'thirty'
    | 'five_wickets'
    | 'three_wickets'
    | 'maiden'
    | 'innings_break'
    | 'match_result'
    | 'ball'
) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (type === 'five_wickets') {
      // Powerful stadium trumpet brass fanfare (D4, F#4, A4, D5 sustained)
      const notes = [293.66, 369.99, 440.00, 587.33, 739.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.6);
      });
    } else if (type === 'century' || type === 'fifty') {
      // Fanfare celebratory chime (C5, E5, G5, C6 arpeggio)
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.45);
      });
    } else if (type === 'innings_break') {
      // Two-tone stadium horn
      [440, 554.37].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.35);
      });
    } else if (type === 'wicket') {
      // Dramatic descending alert buzzer
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } else if (type === 'six') {
      // Triumphant double chime
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.3);
      });
    } else if (type === 'four') {
      // Fast high beep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'boundary') {
      // Energetic boundary 4/6 celebratory chime
      [587.33, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.07);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.07);
        osc.stop(ctx.currentTime + i * 0.07 + 0.3);
      });
    }
  } catch (err) {
    console.debug('Audio sound blocked or unsupported', err);
  }
}

/**
 * Fetches dynamic player career statistics, strike rates, averages, and recent performance logs
 */
export async function fetchPlayerStats(
  name: string,
  team?: string,
  playerId?: string
): Promise<PlayerDetailedStats | null> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams();
  if (name) params.append('name', name);
  if (team) params.append('team', team);
  if (playerId) params.append('playerId', playerId);

  try {
    const res = await fetch(`${baseUrl}/api/player/stats?${params.toString()}`, {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch (err) {
    console.warn('Error fetching player stats:', err);
    return null;
  }
}

/**
 * Fetches the polled text-based live commentary feed and event log from the backend
 */
export async function fetchCommentaryFeed(limit = 40): Promise<CommentaryFeedResponse | null> {
  try {
    const res = await fetch(buildApiUrl(`/api/match/commentary?limit=${limit}`), {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Error fetching commentary feed:', err);
    return null;
  }
}

export async function fetchMatchHighlights(limit = 30): Promise<MatchHighlightsResponse | null> {
  try {
    const res = await fetch(buildApiUrl(`/api/match/highlights?limit=${limit}`), {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Error fetching match highlights:', err);
    return null;
  }
}

export async function fetchMonetizationConfig(): Promise<MonetizationConfig | null> {
  try {
    const res = await fetch(buildApiUrl('/api/monetization'), {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.config : null;
  } catch (err) {
    console.warn('Error fetching monetization config:', err);
    return null;
  }
}

export async function updateMonetizationConfig(
  config: Partial<MonetizationConfig>,
  adminPin: string
): Promise<MonetizationConfig> {
  const res = await fetch(buildApiUrl('/api/admin/monetization'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ config, adminPin })
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Failed to update monetization settings');
  }
  return json.config;
}

export async function uploadPlayerPhoto(
  payload: {
    role: 'striker' | 'nonStriker' | 'bowler' | 'player';
    imageUrl?: string;
    imageDataUrl?: string;
    playerName?: string;
    teamCode?: string;
  },
  adminPin: string
): Promise<{ success: boolean; imageUrl: string; matchState: MatchState | null }> {
  const res = await fetch(buildApiUrl('/api/admin/player/photo'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ ...payload, adminPin })
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Failed to update player photo');
  }
  return json;
}

export async function uploadTeamFlag(
  payload: {
    teamCode?: string;
    teamName?: string;
    role?: 'batting' | 'bowling';
    imageUrl?: string;
    imageDataUrl?: string;
  },
  adminPin: string
): Promise<{ success: boolean; imageUrl: string; matchState: MatchState | null }> {
  const res = await fetch(buildApiUrl('/api/admin/team/flag'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ ...payload, adminPin })
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Failed to update team flag/logo');
  }
  return json;
}

export async function uploadAdminMedia(
  imageDataUrl: string,
  prefix: string,
  adminPin: string
): Promise<{ success: boolean; imageUrl: string }> {
  const endpoint = buildApiUrl('/api/admin/media/upload');
  const trimmedPin = (adminPin || '').trim();
  const requestHeaders = {
    'Content-Type': 'application/json',
    'x-admin-pin': trimmedPin
  };
  const approxBytes = imageDataUrl.length;
  const logId = createMediaNetworkLogId();
  const startedAt = Date.now();

  upsertMediaNetworkLog({
    id: logId,
    startedAt,
    transport: 'fetch',
    method: 'POST',
    url: endpoint,
    mediaKind: 'image',
    fileName: `${prefix || 'image'}.img`,
    fileSizeBytes: approxBytes,
    fileSizeMb: (approxBytes / (1024 * 1024)).toFixed(2),
    phase: 'request_init',
    progressPct: 10,
    requestHeaders: maskSensitiveHeaders(requestHeaders),
    ok: false
  });

  let res: Response;
  try {
    upsertMediaNetworkLog({
      id: logId,
      startedAt,
      transport: 'fetch',
      method: 'POST',
      url: endpoint,
      mediaKind: 'image',
      fileName: `${prefix || 'image'}.img`,
      fileSizeBytes: approxBytes,
      fileSizeMb: (approxBytes / (1024 * 1024)).toFixed(2),
      phase: 'awaiting_response',
      progressPct: 100,
      requestHeaders: maskSensitiveHeaders(requestHeaders),
      ok: false
    });
    res = await fetch(endpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({ imageDataUrl, prefix, adminPin })
    });
  } catch (networkErr: any) {
    const endedAt = Date.now();
    const errMsg = networkErr?.message || 'Fetch network failure';
    upsertMediaNetworkLog({
      id: logId,
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
      transport: 'fetch',
      method: 'POST',
      url: endpoint,
      mediaKind: 'image',
      fileName: `${prefix || 'image'}.img`,
      fileSizeBytes: approxBytes,
      fileSizeMb: (approxBytes / (1024 * 1024)).toFixed(2),
      phase: 'failed',
      progressPct: 100,
      requestHeaders: maskSensitiveHeaders(requestHeaders),
      httpStatus: 0,
      httpStatusText: 'Network Error',
      networkError: errMsg,
      serverErrorMessage: errMsg,
      serverErrorCode: 'FETCH_NETWORK_ERROR',
      ok: false
    });
    throw new Error(errMsg);
  }

  const endedAt = Date.now();
  const rawText = await res.text();
  let json: any = {};
  try {
    json = rawText ? JSON.parse(rawText) : {};
  } catch {
    json = { error: rawText?.slice(0, 300) || `HTTP ${res.status}` };
  }
  const ok = res.ok && Boolean(json?.imageUrl);
  const resolvedErrorCode = !ok
    ? res.status === 401
      ? 'INVALID_ADMIN_PIN'
      : json?.code || `HTTP_${res.status}`
    : undefined;
  upsertMediaNetworkLog({
    id: logId,
    startedAt,
    endedAt,
    durationMs: endedAt - startedAt,
    transport: 'fetch',
    method: 'POST',
    url: endpoint,
    mediaKind: 'image',
    fileName: `${prefix || 'image'}.img`,
    fileSizeBytes: approxBytes,
    fileSizeMb: (approxBytes / (1024 * 1024)).toFixed(2),
    phase: ok ? 'completed' : 'failed',
    progressPct: 100,
    requestHeaders: maskSensitiveHeaders(requestHeaders),
    httpStatus: res.status,
    httpStatusText: res.statusText || (ok ? 'OK' : 'Error'),
    responseHeaders: headersToRecord(res.headers),
    responseBody: rawText.slice(0, 8000),
    serverErrorMessage: !ok ? json?.error || `HTTP ${res.status}` : undefined,
    serverErrorCode: resolvedErrorCode,
    ok
  });

  if (!ok) {
    throw new Error(json?.error || 'Failed to upload image');
  }
  return json;
}

export async function fetchCustomMedia(): Promise<{
  players: Record<string, string>;
  teams: Record<string, string>;
}> {
  try {
    const res = await fetch(buildApiUrl('/api/media/custom'));
    if (!res.ok) return { players: {}, teams: {} };
    const json = await res.json();
    return {
      players: json.players || {},
      teams: json.teams || {}
    };
  } catch {
    return { players: {}, teams: {} };
  }
}

export type MediaUploadStage =
  | 'validation'
  | 'firebase_storage'
  | 'server_upload'
  | 'complete';

export interface MediaUploadDiagnosticEvent {
  id: string;
  timestamp: number;
  stage: MediaUploadStage;
  status: 'info' | 'warning' | 'error' | 'success';
  code: string;
  message: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeMb: string;
  mimeType: string;
  detectedExt: string;
  httpStatus?: number;
  firebaseCode?: string;
  hasAdminPin?: boolean;
  firebaseAdminActive?: boolean;
  targetUrl?: string;
}

export interface VideoMediaValidationResult {
  valid: boolean;
  code: string;
  error?: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeMb: string;
  mimeType: string;
  detectedExt: string;
  safeMimeType: string;
}

const MAX_VIDEO_UPLOAD_BYTES = 60 * 1024 * 1024;
const SUPPORTED_VIDEO_EXTS = new Set([
  'mp4',
  'webm',
  'ogg',
  'ogv',
  'mov',
  'm4v',
  'mkv',
  '3gp',
  'avi',
  'ts'
]);
const VIDEO_MIME_TO_EXT: Record<string, string> = {
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
  'video/mp2t': 'ts'
};

type MediaDiagnosticListener = (
  latest: MediaUploadDiagnosticEvent,
  history: MediaUploadDiagnosticEvent[]
) => void;

const mediaDiagnosticHistory: MediaUploadDiagnosticEvent[] = [];
const mediaDiagnosticListeners = new Set<MediaDiagnosticListener>();

export function getRecentMediaUploadDiagnostics(): MediaUploadDiagnosticEvent[] {
  return [...mediaDiagnosticHistory];
}

export function clearMediaUploadDiagnostics(): void {
  mediaDiagnosticHistory.length = 0;
}

export function subscribeMediaUploadDiagnostics(listener: MediaDiagnosticListener): () => void {
  mediaDiagnosticListeners.add(listener);
  return () => {
    mediaDiagnosticListeners.delete(listener);
  };
}

export function emitMediaUploadDiagnostic(
  input: Omit<MediaUploadDiagnosticEvent, 'id' | 'timestamp'>,
  options?: { skipUploadHistory?: boolean }
): MediaUploadDiagnosticEvent {
  const event: MediaUploadDiagnosticEvent = {
    ...input,
    id: `mu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now()
  };

  mediaDiagnosticHistory.unshift(event);
  if (mediaDiagnosticHistory.length > 25) {
    mediaDiagnosticHistory.length = 25;
  }

  const logPayload = {
    stage: event.stage,
    code: event.code,
    fileName: event.fileName,
    sizeMb: event.fileSizeMb,
    sizeBytes: event.fileSizeBytes,
    mimeType: event.mimeType || 'none',
    ext: event.detectedExt || 'unknown',
    httpStatus: event.httpStatus,
    firebaseCode: event.firebaseCode,
    hasAdminPin: event.hasAdminPin,
    firebaseAdminActive: event.firebaseAdminActive
  };

  if (event.status === 'error') {
    console.error(`[MediaUpload] ${event.message}`, logPayload);
    if (!options?.skipUploadHistory) {
      const source: FailedUploadSource = event.firebaseCode
        ? 'firebase'
        : event.stage === 'validation'
        ? 'client'
        : event.httpStatus && event.httpStatus >= 400
        ? 'server'
        : 'network';
      recordFailedUploadHistory({
        timestamp: event.timestamp,
        fileName: event.fileName || 'unknown',
        fileSizeBytes: event.fileSizeBytes || 0,
        fileSizeMb: event.fileSizeMb || '0.00',
        mediaKind: 'tv_video',
        errorCode: event.firebaseCode || event.code || 'UPLOAD_ERROR',
        httpStatus: event.httpStatus,
        firebaseCode: event.firebaseCode,
        source,
        message: event.message
      });
    }
  } else if (event.status === 'warning') {
    console.warn(`[MediaUpload] ${event.message}`, logPayload);
  } else {
    console.info(`[MediaUpload] ${event.message}`, logPayload);
  }

  const snapshot = [...mediaDiagnosticHistory];
  mediaDiagnosticListeners.forEach((listener) => {
    try {
      listener(event, snapshot);
    } catch {}
  });

  return event;
}

export function validateVideoMediaFile(
  file: Blob | null | undefined,
  fileName?: string
): VideoMediaValidationResult {
  const resolvedName =
    (fileName && fileName.trim()) ||
    (file instanceof File && file.name ? file.name.trim() : '') ||
    'video_clip';
  const sizeBytes = file && typeof file.size === 'number' ? file.size : 0;
  const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
  const rawType = (file?.type || '').split(';')[0].trim().toLowerCase();
  const extMatch = resolvedName.toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  const rawExt = extMatch ? extMatch[1] : '';
  const normalizedExt = rawExt === 'ogv' ? 'ogg' : rawExt;

  if (!file || sizeBytes <= 0) {
    return {
      valid: false,
      code: 'EMPTY_FILE',
      error: `Selected video file "${resolvedName}" is empty (0 bytes).`,
      fileName: resolvedName,
      fileSizeBytes: sizeBytes,
      fileSizeMb: sizeMb,
      mimeType: rawType,
      detectedExt: normalizedExt,
      safeMimeType: rawType || 'application/octet-stream'
    };
  }

  if (sizeBytes > MAX_VIDEO_UPLOAD_BYTES) {
    return {
      valid: false,
      code: 'FILE_TOO_LARGE',
      error: `Video file "${resolvedName}" (${sizeMb} MB) exceeds the 60.00 MB upload limit.`,
      fileName: resolvedName,
      fileSizeBytes: sizeBytes,
      fileSizeMb: sizeMb,
      mimeType: rawType,
      detectedExt: normalizedExt,
      safeMimeType: rawType || 'application/octet-stream'
    };
  }

  const mimeExt = VIDEO_MIME_TO_EXT[rawType] || '';
  const hasSupportedExt = SUPPORTED_VIDEO_EXTS.has(normalizedExt);
  const isVideoMime = rawType.startsWith('video/');
  const isGenericBinaryMime =
    rawType === '' ||
    rawType === 'application/octet-stream' ||
    rawType === 'application/mp4' ||
    rawType === 'application/ogg';

  if (rawType && !isVideoMime && !isGenericBinaryMime) {
    return {
      valid: false,
      code: 'UNSUPPORTED_MIME_TYPE',
      error: `Unsupported file MIME type "${rawType}" for "${resolvedName}". Please select a video file (MP4, WebM, MOV, MKV, OGG, M4V, 3GP, AVI, or TS).`,
      fileName: resolvedName,
      fileSizeBytes: sizeBytes,
      fileSizeMb: sizeMb,
      mimeType: rawType,
      detectedExt: normalizedExt || mimeExt,
      safeMimeType: rawType
    };
  }

  if (normalizedExt && !hasSupportedExt && !isVideoMime) {
    return {
      valid: false,
      code: 'UNSUPPORTED_FORMAT',
      error: `Unsupported video extension ".${normalizedExt}" on "${resolvedName}". Supported formats: MP4, WebM, MOV, MKV, OGG, M4V, 3GP, AVI, TS.`,
      fileName: resolvedName,
      fileSizeBytes: sizeBytes,
      fileSizeMb: sizeMb,
      mimeType: rawType,
      detectedExt: normalizedExt,
      safeMimeType: rawType || 'application/octet-stream'
    };
  }

  if (!hasSupportedExt && !isVideoMime && !mimeExt) {
    return {
      valid: false,
      code: 'UNSUPPORTED_FORMAT',
      error: `Could not verify video format for "${resolvedName}" (MIME: "${rawType || 'none'}"). Please use MP4, WebM, MOV, or MKV.`,
      fileName: resolvedName,
      fileSizeBytes: sizeBytes,
      fileSizeMb: sizeMb,
      mimeType: rawType,
      detectedExt: normalizedExt,
      safeMimeType: rawType || 'application/octet-stream'
    };
  }

  const detectedExt = mimeExt || (hasSupportedExt ? normalizedExt : 'mp4');
  const safeMimeType = isVideoMime
    ? rawType
    : detectedExt === 'mov'
    ? 'video/quicktime'
    : detectedExt === 'mkv'
    ? 'video/x-matroska'
    : detectedExt === 'avi'
    ? 'video/x-msvideo'
    : detectedExt === 'ts'
    ? 'video/mp2t'
    : `video/${detectedExt}`;

  return {
    valid: true,
    code: 'VALID_VIDEO',
    fileName: resolvedName,
    fileSizeBytes: sizeBytes,
    fileSizeMb: sizeMb,
    mimeType: rawType,
    detectedExt,
    safeMimeType
  };
}

export type MediaNetworkLifecyclePhase =
  | 'queued'
  | 'request_init'
  | 'uploading'
  | 'awaiting_response'
  | 'completed'
  | 'failed';

export interface MediaNetworkRequestLog {
  id: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  transport: 'xhr' | 'fetch';
  method: string;
  url: string;
  mediaKind: 'tv_video' | 'audio' | 'image' | 'apk';
  fileName: string;
  fileSizeBytes: number;
  fileSizeMb: string;
  phase: MediaNetworkLifecyclePhase;
  progressPct: number;
  requestHeaders: Record<string, string>;
  httpStatus?: number;
  httpStatusText?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  serverErrorMessage?: string;
  serverErrorCode?: string;
  networkError?: string;
  preFlightBlocked?: boolean;
  ok: boolean;
}

type MediaNetworkLogListener = (
  logs: MediaNetworkRequestLog[],
  latest: MediaNetworkRequestLog | null
) => void;

const mediaNetworkLogs: MediaNetworkRequestLog[] = [];
const mediaNetworkListeners = new Set<MediaNetworkLogListener>();

function createMediaNetworkLogId(): string {
  return `net_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function maskSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, val] of Object.entries(headers)) {
    if (key.toLowerCase() === 'x-admin-pin') {
      const trimmed = (val || '').trim();
      masked[key] = trimmed ? `•••• (present, ${trimmed.length} chars)` : '(missing)';
    } else {
      masked[key] = val;
    }
  }
  return masked;
}

function parseRawResponseHeaders(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw) return result;
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const k = line.slice(0, colonIdx).trim().toLowerCase();
      const v = line.slice(colonIdx + 1).trim();
      result[k] = v;
    }
  }
  return result;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((v, k) => {
    result[k.toLowerCase()] = v;
  });
  return result;
}

function notifyMediaNetworkListeners(latest: MediaNetworkRequestLog | null) {
  const snapshot = [...mediaNetworkLogs];
  mediaNetworkListeners.forEach((listener) => {
    try {
      listener(snapshot, latest);
    } catch {}
  });
}

export type FailedUploadSource = 'server' | 'network' | 'client' | 'firebase';

export interface FailedUploadHistoryEntry {
  id: string;
  sourceLogId?: string;
  timestamp: number;
  fileName: string;
  fileSizeBytes: number;
  fileSizeMb: string;
  mediaKind: MediaNetworkRequestLog['mediaKind'];
  errorCode: string;
  httpStatus?: number;
  httpStatusText?: string;
  firebaseCode?: string;
  source: FailedUploadSource;
  endpoint?: string;
  message: string;
  responseSnippet?: string;
}

const FAILED_UPLOAD_HISTORY_STORAGE_KEY = 'studio_failed_upload_history_v1';
const MAX_FAILED_UPLOAD_HISTORY = 10;

type FailedUploadHistoryListener = (entries: FailedUploadHistoryEntry[]) => void;
const failedUploadHistoryListeners = new Set<FailedUploadHistoryListener>();

function loadInitialFailedUploadHistory(): FailedUploadHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FAILED_UPLOAD_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is FailedUploadHistoryEntry =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.timestamp === 'number' &&
          typeof item.errorCode === 'string' &&
          typeof item.message === 'string'
      )
      .slice(0, MAX_FAILED_UPLOAD_HISTORY);
  } catch {
    return [];
  }
}

const failedUploadHistory: FailedUploadHistoryEntry[] = loadInitialFailedUploadHistory();

function persistFailedUploadHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      FAILED_UPLOAD_HISTORY_STORAGE_KEY,
      JSON.stringify(failedUploadHistory.slice(0, MAX_FAILED_UPLOAD_HISTORY))
    );
  } catch {}
}

function notifyFailedUploadHistoryListeners(): void {
  const snapshot = [...failedUploadHistory];
  failedUploadHistoryListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {}
  });
}

export function recordFailedUploadHistory(
  input: Omit<FailedUploadHistoryEntry, 'id'>
): FailedUploadHistoryEntry {
  const normalizedCode = (input.errorCode || 'UPLOAD_ERROR').trim() || 'UPLOAD_ERROR';
  const nextEntry: FailedUploadHistoryEntry = {
    ...input,
    id: `fuh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    errorCode: normalizedCode,
    message: (input.message || 'Upload failed').slice(0, 500),
    responseSnippet: input.responseSnippet ? input.responseSnippet.slice(0, 1200) : undefined
  };

  if (input.sourceLogId) {
    const existingIdx = failedUploadHistory.findIndex(
      (item) => item.sourceLogId === input.sourceLogId
    );
    if (existingIdx >= 0) {
      failedUploadHistory[existingIdx] = {
        ...nextEntry,
        id: failedUploadHistory[existingIdx].id
      };
      persistFailedUploadHistory();
      notifyFailedUploadHistoryListeners();
      return failedUploadHistory[existingIdx];
    }
  }

  failedUploadHistory.unshift(nextEntry);
  if (failedUploadHistory.length > MAX_FAILED_UPLOAD_HISTORY) {
    failedUploadHistory.length = MAX_FAILED_UPLOAD_HISTORY;
  }
  persistFailedUploadHistory();
  notifyFailedUploadHistoryListeners();
  return nextEntry;
}

export function getFailedUploadHistory(): FailedUploadHistoryEntry[] {
  return [...failedUploadHistory];
}

export function clearFailedUploadHistory(): void {
  failedUploadHistory.length = 0;
  persistFailedUploadHistory();
  notifyFailedUploadHistoryListeners();
}

export function subscribeFailedUploadHistory(
  listener: FailedUploadHistoryListener
): () => void {
  failedUploadHistoryListeners.add(listener);
  return () => {
    failedUploadHistoryListeners.delete(listener);
  };
}

function classifyNetworkFailureSource(entry: MediaNetworkRequestLog): FailedUploadSource {
  if (entry.preFlightBlocked) return 'client';
  const code = (entry.serverErrorCode || '').toUpperCase();
  if (
    code === 'XHR_NETWORK_ERROR' ||
    code === 'XHR_ABORTED' ||
    code === 'XHR_TIMEOUT' ||
    code === 'FETCH_NETWORK_ERROR' ||
    !entry.httpStatus ||
    entry.httpStatus <= 0
  ) {
    return 'network';
  }
  return 'server';
}

function upsertMediaNetworkLog(entry: MediaNetworkRequestLog): void {
  const idx = mediaNetworkLogs.findIndex((item) => item.id === entry.id);
  if (idx >= 0) {
    mediaNetworkLogs[idx] = entry;
  } else {
    mediaNetworkLogs.unshift(entry);
    if (mediaNetworkLogs.length > 40) {
      mediaNetworkLogs.length = 40;
    }
  }

  if (entry.phase === 'failed') {
    const fallbackCode =
      entry.httpStatus && entry.httpStatus > 0 ? `HTTP_${entry.httpStatus}` : 'NETWORK_ERROR';
    recordFailedUploadHistory({
      sourceLogId: entry.id,
      timestamp: entry.endedAt || entry.startedAt || Date.now(),
      fileName: entry.fileName || 'unknown',
      fileSizeBytes: entry.fileSizeBytes || 0,
      fileSizeMb: entry.fileSizeMb || '0.00',
      mediaKind: entry.mediaKind,
      errorCode: entry.serverErrorCode || fallbackCode,
      httpStatus: entry.httpStatus,
      httpStatusText: entry.httpStatusText,
      source: classifyNetworkFailureSource(entry),
      endpoint: entry.url,
      message:
        entry.serverErrorMessage ||
        entry.networkError ||
        entry.httpStatusText ||
        'Media upload failed',
      responseSnippet: entry.responseBody
    });
  }

  notifyMediaNetworkListeners(entry);
}

export function getMediaNetworkLogs(): MediaNetworkRequestLog[] {
  return [...mediaNetworkLogs];
}

export function clearMediaNetworkLogs(): void {
  mediaNetworkLogs.length = 0;
  notifyMediaNetworkListeners(null);
}

export function subscribeMediaNetworkLogs(listener: MediaNetworkLogListener): () => void {
  mediaNetworkListeners.add(listener);
  return () => {
    mediaNetworkListeners.delete(listener);
  };
}

function recordMediaNetworkPreFlightError(opts: {
  url: string;
  mediaKind: MediaNetworkRequestLog['mediaKind'];
  fileName: string;
  fileSizeBytes: number;
  fileSizeMb: string;
  headers: Record<string, string>;
  code: string;
  error: string;
}) {
  const now = Date.now();
  upsertMediaNetworkLog({
    id: createMediaNetworkLogId(),
    startedAt: now,
    endedAt: now,
    durationMs: 0,
    transport: 'xhr',
    method: 'POST',
    url: opts.url,
    mediaKind: opts.mediaKind,
    fileName: opts.fileName,
    fileSizeBytes: opts.fileSizeBytes,
    fileSizeMb: opts.fileSizeMb,
    phase: 'failed',
    progressPct: 0,
    requestHeaders: maskSensitiveHeaders(opts.headers),
    httpStatusText: 'Blocked Pre-Flight (Client Validation)',
    responseBody: JSON.stringify(
      {
        clientValidationRejected: true,
        code: opts.code,
        error: opts.error
      },
      null,
      2
    ),
    serverErrorCode: opts.code,
    serverErrorMessage: opts.error,
    networkError: opts.error,
    preFlightBlocked: true,
    ok: false
  });
}

const TV_MEDIA_CHUNK_BYTES = 4 * 1024 * 1024;

function monitoredXhrUpload(opts: {
  url: string;
  mediaKind: MediaNetworkRequestLog['mediaKind'];
  file: Blob;
  fileName: string;
  headers: Record<string, string>;
  timeoutMs?: number;
  stallTimeoutMs?: number;
  onProgress?: (pct: number, phase: MediaNetworkLifecyclePhase) => void;
}): Promise<{
  status: number;
  statusText: string;
  responseText: string;
  json: any;
  responseHeaders: Record<string, string>;
}> {
  return new Promise((resolve, reject) => {
    const logId = createMediaNetworkLogId();
    const startedAt = Date.now();
    const sizeBytes = opts.file?.size || 0;
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
    const maskedReqHeaders = maskSensitiveHeaders(opts.headers);
    const effectiveTimeoutMs =
      opts.timeoutMs ??
      Math.max(600_000, Math.min(1_800_000, Math.ceil((sizeBytes / (40 * 1024)) * 1000)));
    const stallTimeoutMs = opts.stallTimeoutMs ?? 90_000;

    const emitUpdate = (patch: Partial<MediaNetworkRequestLog>) => {
      const existing = mediaNetworkLogs.find((item) => item.id === logId);
      const base: MediaNetworkRequestLog = existing || {
        id: logId,
        startedAt,
        transport: 'xhr',
        method: 'POST',
        url: opts.url,
        mediaKind: opts.mediaKind,
        fileName: opts.fileName,
        fileSizeBytes: sizeBytes,
        fileSizeMb: sizeMb,
        phase: 'queued',
        progressPct: 0,
        requestHeaders: maskedReqHeaders,
        ok: false
      };
      upsertMediaNetworkLog({ ...base, ...patch });
    };

    emitUpdate({ phase: 'queued', progressPct: 0 });
    opts.onProgress?.(0, 'queued');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', opts.url, true);
    xhr.timeout = effectiveTimeoutMs;
    for (const [k, v] of Object.entries(opts.headers)) {
      xhr.setRequestHeader(k, v);
    }

    let settled = false;
    let stalledOut = false;
    let lastLoadedBytes = -1;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;

    const clearStallTimer = () => {
      if (stallTimer) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    };

    const resetStallTimer = (durationMs = stallTimeoutMs) => {
      clearStallTimer();
      stallTimer = setTimeout(() => {
        if (settled) return;
        stalledOut = true;
        try {
          xhr.abort();
        } catch {}
      }, durationMs);
    };

    emitUpdate({ phase: 'request_init', progressPct: 0 });
    opts.onProgress?.(2, 'request_init');

    let lastReportedPct = -1;
    xhr.upload.onloadstart = () => {
      lastReportedPct = 0;
      lastLoadedBytes = 0;
      resetStallTimer(stallTimeoutMs);
      emitUpdate({ phase: 'uploading', progressPct: 0 });
      opts.onProgress?.(3, 'uploading');
    };

    xhr.upload.onprogress = (ev: ProgressEvent<EventTarget>) => {
      if (ev.loaded > lastLoadedBytes) {
        lastLoadedBytes = ev.loaded;
        resetStallTimer(stallTimeoutMs);
      }
      if (ev.lengthComputable && ev.total > 0) {
        const pct = Math.min(99, Math.round((ev.loaded / ev.total) * 100));
        opts.onProgress?.(pct, 'uploading');
        if (pct !== lastReportedPct && (pct - lastReportedPct >= 5 || pct >= 99)) {
          lastReportedPct = pct;
          emitUpdate({ phase: 'uploading', progressPct: pct });
        }
      }
    };

    xhr.upload.onload = () => {
      resetStallTimer(Math.max(stallTimeoutMs, 120_000));
      emitUpdate({ phase: 'awaiting_response', progressPct: 100 });
      opts.onProgress?.(99, 'awaiting_response');
    };

    xhr.onload = () => {
      settled = true;
      clearStallTimer();
      const endedAt = Date.now();
      const responseText = xhr.responseText || '';
      const responseHeaders = parseRawResponseHeaders(xhr.getAllResponseHeaders());
      let json: any = {};
      try {
        json = responseText ? JSON.parse(responseText) : {};
      } catch {
        json = { error: responseText.slice(0, 300) || `HTTP ${xhr.status}` };
      }

      const ok = xhr.status >= 200 && xhr.status < 300 && Boolean(json?.url || json?.success);
      const serverErrorMessage = !ok
        ? json?.error || json?.message || `HTTP ${xhr.status} ${xhr.statusText || ''}`.trim()
        : undefined;
      const serverErrorCode = !ok
        ? xhr.status === 401
          ? 'INVALID_ADMIN_PIN'
          : json?.code || `HTTP_${xhr.status}`
        : undefined;

      emitUpdate({
        phase: ok ? 'completed' : 'failed',
        endedAt,
        durationMs: endedAt - startedAt,
        progressPct: 100,
        httpStatus: xhr.status,
        httpStatusText: xhr.statusText || (ok ? 'OK' : 'Error'),
        responseHeaders,
        responseBody: responseText.slice(0, 8000),
        serverErrorMessage,
        serverErrorCode,
        ok
      });

      resolve({
        status: xhr.status,
        statusText: xhr.statusText,
        responseText,
        json,
        responseHeaders
      });
    };

    xhr.onerror = () => {
      settled = true;
      clearStallTimer();
      const endedAt = Date.now();
      const errMsg = `Network connection error while uploading "${opts.fileName}" (${sizeMb} MB).`;
      emitUpdate({
        phase: 'failed',
        endedAt,
        durationMs: endedAt - startedAt,
        httpStatus: xhr.status || 0,
        httpStatusText: xhr.statusText || 'Network Error',
        responseBody: (xhr.responseText || '').slice(0, 8000),
        networkError: errMsg,
        serverErrorMessage: errMsg,
        serverErrorCode: 'XHR_NETWORK_ERROR',
        ok: false
      });
      reject(new Error(errMsg));
    };

    xhr.onabort = () => {
      settled = true;
      clearStallTimer();
      const endedAt = Date.now();
      const errMsg = stalledOut
        ? `Upload stalled with no progress for ${Math.round(stallTimeoutMs / 1000)}s while sending "${opts.fileName}" (${sizeMb} MB).`
        : `Upload aborted for "${opts.fileName}".`;
      emitUpdate({
        phase: 'failed',
        endedAt,
        durationMs: endedAt - startedAt,
        httpStatus: stalledOut ? 408 : xhr.status || 0,
        httpStatusText: stalledOut ? 'Upload Stalled' : 'Aborted',
        networkError: errMsg,
        serverErrorMessage: errMsg,
        serverErrorCode: stalledOut ? 'XHR_STALL_TIMEOUT' : 'XHR_ABORTED',
        ok: false
      });
      reject(new Error(errMsg));
    };

    xhr.ontimeout = () => {
      settled = true;
      clearStallTimer();
      const endedAt = Date.now();
      const errMsg = `Upload timed out after ${Math.round(effectiveTimeoutMs / 1000)}s for "${opts.fileName}".`;
      emitUpdate({
        phase: 'failed',
        endedAt,
        durationMs: endedAt - startedAt,
        httpStatus: 408,
        httpStatusText: 'Request Timeout',
        networkError: errMsg,
        serverErrorMessage: errMsg,
        serverErrorCode: 'XHR_TIMEOUT',
        ok: false
      });
      reject(new Error(errMsg));
    };

    resetStallTimer(stallTimeoutMs);
    xhr.send(opts.file);
  });
}

function sendRawChunkXhr(opts: {
  url: string;
  chunk: Blob;
  headers: Record<string, string>;
  timeoutMs?: number;
  stallTimeoutMs?: number;
  onChunkProgress?: (loadedBytes: number) => void;
}): Promise<{
  status: number;
  statusText: string;
  responseText: string;
  json: any;
  responseHeaders: Record<string, string>;
}> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timeoutMs = opts.timeoutMs ?? 180_000;
    const stallMs = opts.stallTimeoutMs ?? 90_000;
    xhr.open('POST', opts.url, true);
    xhr.timeout = timeoutMs;
    for (const [k, v] of Object.entries(opts.headers)) {
      xhr.setRequestHeader(k, v);
    }

    let settled = false;
    let stalledOut = false;
    let lastLoaded = -1;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;

    const clearStall = () => {
      if (stallTimer) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    };

    const resetStall = (ms = stallMs) => {
      clearStall();
      stallTimer = setTimeout(() => {
        if (settled) return;
        stalledOut = true;
        try {
          xhr.abort();
        } catch {}
      }, ms);
    };

    xhr.upload.onprogress = (ev: ProgressEvent<EventTarget>) => {
      if (ev.loaded > lastLoaded) {
        lastLoaded = ev.loaded;
        resetStall(stallMs);
        opts.onChunkProgress?.(ev.loaded);
      }
    };

    xhr.upload.onload = () => {
      resetStall(Math.max(stallMs, 120_000));
      opts.onChunkProgress?.(opts.chunk.size);
    };

    xhr.onload = () => {
      settled = true;
      clearStall();
      const responseText = xhr.responseText || '';
      const responseHeaders = parseRawResponseHeaders(xhr.getAllResponseHeaders());
      let json: any = {};
      try {
        json = responseText ? JSON.parse(responseText) : {};
      } catch {
        json = { error: responseText.slice(0, 300) || `HTTP ${xhr.status}` };
      }
      resolve({
        status: xhr.status,
        statusText: xhr.statusText,
        responseText,
        json,
        responseHeaders
      });
    };

    xhr.onerror = () => {
      settled = true;
      clearStall();
      reject(new Error('Network connection error while uploading media chunk.'));
    };

    xhr.onabort = () => {
      settled = true;
      clearStall();
      reject(
        new Error(
          stalledOut
            ? `Chunk upload stalled with no progress for ${Math.round(stallMs / 1000)}s.`
            : 'Chunk upload aborted.'
        )
      );
    };

    xhr.ontimeout = () => {
      settled = true;
      clearStall();
      reject(new Error(`Chunk upload timed out after ${Math.round(timeoutMs / 1000)}s.`));
    };

    resetStall(stallMs);
    xhr.send(opts.chunk);
  });
}

async function monitoredChunkedXhrUpload(opts: {
  url: string;
  mediaKind: MediaNetworkRequestLog['mediaKind'];
  file: Blob;
  fileName: string;
  headers: Record<string, string>;
  onProgress?: (pct: number, phase: MediaNetworkLifecyclePhase) => void;
}): Promise<{
  status: number;
  statusText: string;
  responseText: string;
  json: any;
  responseHeaders: Record<string, string>;
}> {
  const logId = createMediaNetworkLogId();
  const startedAt = Date.now();
  const sizeBytes = opts.file?.size || 0;
  const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
  const totalChunks = Math.max(1, Math.ceil(sizeBytes / TV_MEDIA_CHUNK_BYTES));
  const uploadId = `tv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const maskedReqHeaders = maskSensitiveHeaders({
    ...opts.headers,
    'x-upload-id': uploadId,
    'x-total-chunks': String(totalChunks)
  });

  const emitUpdate = (patch: Partial<MediaNetworkRequestLog>) => {
    const existing = mediaNetworkLogs.find((item) => item.id === logId);
    const base: MediaNetworkRequestLog = existing || {
      id: logId,
      startedAt,
      transport: 'xhr',
      method: 'POST',
      url: opts.url,
      mediaKind: opts.mediaKind,
      fileName: opts.fileName,
      fileSizeBytes: sizeBytes,
      fileSizeMb: sizeMb,
      phase: 'queued',
      progressPct: 0,
      requestHeaders: maskedReqHeaders,
      ok: false
    };
    upsertMediaNetworkLog({ ...base, ...patch });
  };

  emitUpdate({ phase: 'queued', progressPct: 0 });
  opts.onProgress?.(0, 'queued');
  emitUpdate({ phase: 'request_init', progressPct: 2 });
  opts.onProgress?.(2, 'request_init');

  let lastLoggedPct = 0;
  let lastRes: {
    status: number;
    statusText: string;
    responseText: string;
    json: any;
    responseHeaders: Record<string, string>;
  } | null = null;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const startByte = chunkIndex * TV_MEDIA_CHUNK_BYTES;
    const endByte = Math.min(sizeBytes, startByte + TV_MEDIA_CHUNK_BYTES);
    const chunkBlob = opts.file.slice(startByte, endByte);

    let chunkRes: {
      status: number;
      statusText: string;
      responseText: string;
      json: any;
      responseHeaders: Record<string, string>;
    };

    try {
      chunkRes = await sendRawChunkXhr({
        url: opts.url,
        chunk: chunkBlob,
        headers: {
          ...opts.headers,
          'x-upload-id': uploadId,
          'x-chunk-index': String(chunkIndex),
          'x-total-chunks': String(totalChunks)
        },
        onChunkProgress: (loadedInChunk) => {
          const uploadedTotal = Math.min(sizeBytes, startByte + loadedInChunk);
          const pct = Math.min(99, Math.max(3, Math.round((uploadedTotal / sizeBytes) * 100)));
          const phase: MediaNetworkLifecyclePhase =
            chunkIndex === totalChunks - 1 && loadedInChunk >= chunkBlob.size
              ? 'awaiting_response'
              : 'uploading';
          opts.onProgress?.(pct, phase);
          if (pct - lastLoggedPct >= 4 || phase === 'awaiting_response') {
            lastLoggedPct = pct;
            emitUpdate({ phase, progressPct: pct });
          }
        }
      });
    } catch (err: any) {
      const endedAt = Date.now();
      const errMsg = `${err?.message || 'Chunk upload failed'} (chunk ${chunkIndex + 1}/${totalChunks}, "${opts.fileName}" ${sizeMb} MB).`;
      const isTimeout = errMsg.toLowerCase().includes('timed out') || errMsg.toLowerCase().includes('stalled');
      emitUpdate({
        phase: 'failed',
        endedAt,
        durationMs: endedAt - startedAt,
        httpStatus: isTimeout ? 408 : 0,
        httpStatusText: isTimeout ? 'Request Timeout' : 'Network Error',
        networkError: errMsg,
        serverErrorMessage: errMsg,
        serverErrorCode: isTimeout ? 'XHR_TIMEOUT' : 'XHR_NETWORK_ERROR',
        ok: false
      });
      throw new Error(errMsg);
    }

    lastRes = chunkRes;
    const isFinalChunk = chunkIndex === totalChunks - 1;
    const chunkOk =
      chunkRes.status >= 200 &&
      chunkRes.status < 300 &&
      (isFinalChunk ? Boolean(chunkRes.json?.url) : Boolean(chunkRes.json?.success));

    if (!chunkOk) {
      const endedAt = Date.now();
      const serverErrorMessage =
        chunkRes.json?.error ||
        chunkRes.json?.message ||
        `HTTP ${chunkRes.status} ${chunkRes.statusText || ''}`.trim();
      const serverErrorCode =
        chunkRes.status === 401
          ? 'INVALID_ADMIN_PIN'
          : chunkRes.json?.code || `HTTP_${chunkRes.status}`;

      emitUpdate({
        phase: 'failed',
        endedAt,
        durationMs: endedAt - startedAt,
        progressPct: Math.round(((chunkIndex + 1) / totalChunks) * 100),
        httpStatus: chunkRes.status,
        httpStatusText: chunkRes.statusText || 'Error',
        responseHeaders: chunkRes.responseHeaders,
        responseBody: chunkRes.responseText.slice(0, 8000),
        serverErrorMessage,
        serverErrorCode,
        ok: false
      });
      return chunkRes;
    }
  }

  const endedAt = Date.now();
  const finalRes = lastRes || {
    status: 500,
    statusText: 'Error',
    responseText: '',
    json: { error: 'No response from final upload chunk' },
    responseHeaders: {}
  };
  emitUpdate({
    phase: 'completed',
    endedAt,
    durationMs: endedAt - startedAt,
    progressPct: 100,
    httpStatus: finalRes.status,
    httpStatusText: finalRes.statusText || 'OK',
    responseHeaders: finalRes.responseHeaders,
    responseBody: finalRes.responseText.slice(0, 8000),
    ok: true
  });
  return finalRes;
}

export async function uploadTvMediaFile(
  file: Blob,
  adminPin: string,
  fileName?: string,
  onProgress?: (pct: number, phase: MediaNetworkLifecyclePhase) => void
): Promise<{ success: boolean; url: string }> {
  const validation = validateVideoMediaFile(file, fileName);
  const trimmedPin = (adminPin || '').trim();
  const useChunkedUpload = validation.fileSizeBytes > TV_MEDIA_CHUNK_BYTES;
  const endpoint = buildApiUrl(
    useChunkedUpload ? '/api/admin/tv-media/upload-chunk' : '/api/admin/tv-media/upload'
  );
  const plannedHeaders: Record<string, string> = {
    'Content-Type': validation.safeMimeType || 'application/octet-stream',
    'x-admin-pin': trimmedPin,
    'x-file-name': encodeURIComponent(validation.fileName)
  };

  if (!validation.valid) {
    const errMsg = validation.error || 'Video file failed validation.';
    recordMediaNetworkPreFlightError({
      url: endpoint,
      mediaKind: 'tv_video',
      fileName: validation.fileName,
      fileSizeBytes: validation.fileSizeBytes,
      fileSizeMb: validation.fileSizeMb,
      headers: plannedHeaders,
      code: validation.code,
      error: errMsg
    });
    emitMediaUploadDiagnostic(
      {
        stage: 'validation',
        status: 'error',
        code: validation.code,
        message: errMsg,
        fileName: validation.fileName,
        fileSizeBytes: validation.fileSizeBytes,
        fileSizeMb: validation.fileSizeMb,
        mimeType: validation.mimeType,
        detectedExt: validation.detectedExt,
        hasAdminPin: Boolean(trimmedPin)
      },
      { skipUploadHistory: true }
    );
    throw new Error(errMsg);
  }

  if (!trimmedPin) {
    const msg = 'Admin PIN missing or session locked. Please unlock Admin Panel with your PIN before uploading video.';
    recordMediaNetworkPreFlightError({
      url: endpoint,
      mediaKind: 'tv_video',
      fileName: validation.fileName,
      fileSizeBytes: validation.fileSizeBytes,
      fileSizeMb: validation.fileSizeMb,
      headers: plannedHeaders,
      code: 'MISSING_ADMIN_PIN',
      error: msg
    });
    emitMediaUploadDiagnostic(
      {
        stage: 'validation',
        status: 'error',
        code: 'MISSING_ADMIN_PIN',
        message: msg,
        fileName: validation.fileName,
        fileSizeBytes: validation.fileSizeBytes,
        fileSizeMb: validation.fileSizeMb,
        mimeType: validation.safeMimeType,
        detectedExt: validation.detectedExt,
        hasAdminPin: false
      },
      { skipUploadHistory: true }
    );
    throw new Error(msg);
  }

  emitMediaUploadDiagnostic({
    stage: 'server_upload',
    status: 'info',
    code: 'SERVER_UPLOAD_START',
    message: useChunkedUpload
      ? `Uploading "${validation.fileName}" (${validation.fileSizeMb} MB) via 4 MB chunked XHR to Express media endpoint...`
      : `Uploading "${validation.fileName}" (${validation.fileSizeMb} MB) via monitored XHR to Express media endpoint...`,
    fileName: validation.fileName,
    fileSizeBytes: validation.fileSizeBytes,
    fileSizeMb: validation.fileSizeMb,
    mimeType: validation.safeMimeType,
    detectedExt: validation.detectedExt,
    hasAdminPin: true
  });

  let xhrRes: {
    status: number;
    statusText: string;
    responseText: string;
    json: any;
    responseHeaders: Record<string, string>;
  };
  try {
    xhrRes = useChunkedUpload
      ? await monitoredChunkedXhrUpload({
          url: endpoint,
          mediaKind: 'tv_video',
          file,
          fileName: validation.fileName,
          headers: plannedHeaders,
          onProgress
        })
      : await monitoredXhrUpload({
          url: endpoint,
          mediaKind: 'tv_video',
          file,
          fileName: validation.fileName,
          headers: plannedHeaders,
          onProgress
        });
  } catch (networkErr: any) {
    const msg = networkErr?.message || `Network error while uploading "${validation.fileName}".`;
    emitMediaUploadDiagnostic(
      {
        stage: 'server_upload',
        status: 'error',
        code: 'NETWORK_ERROR',
        message: msg,
        fileName: validation.fileName,
        fileSizeBytes: validation.fileSizeBytes,
        fileSizeMb: validation.fileSizeMb,
        mimeType: validation.safeMimeType,
        detectedExt: validation.detectedExt,
        hasAdminPin: true
      },
      { skipUploadHistory: true }
    );
    throw new Error(msg);
  }

  const { status, json } = xhrRes;
  if (status < 200 || status >= 300 || !json.url) {
    const serverCode =
      status === 401
        ? 'INVALID_ADMIN_PIN'
        : status === 413
        ? json?.code || 'FILE_TOO_LARGE'
        : json?.code || (status === 400 ? 'BAD_MEDIA_PAYLOAD' : 'SERVER_HTTP_ERROR');

    const detailedError =
      status === 401
        ? `Server rejected upload (HTTP 401): Invalid or missing Admin PIN. Re-enter Admin PIN and retry.`
        : json.error || `Server rejected TV media upload (HTTP ${status})`;

    emitMediaUploadDiagnostic(
      {
        stage: 'server_upload',
        status: 'error',
        code: serverCode,
        message: detailedError,
        fileName: validation.fileName,
        fileSizeBytes: validation.fileSizeBytes,
        fileSizeMb: validation.fileSizeMb,
        mimeType: validation.safeMimeType,
        detectedExt: validation.detectedExt,
        httpStatus: status,
        hasAdminPin: true
      },
      { skipUploadHistory: true }
    );
    throw new Error(detailedError);
  }

  emitMediaUploadDiagnostic({
    stage: 'complete',
    status: 'success',
    code: 'SERVER_UPLOAD_SUCCESS',
    message: `Uploaded "${validation.fileName}" (${validation.fileSizeMb} MB) to Express server.`,
    fileName: validation.fileName,
    fileSizeBytes: validation.fileSizeBytes,
    fileSizeMb: validation.fileSizeMb,
    mimeType: validation.safeMimeType,
    detectedExt: validation.detectedExt,
    httpStatus: status,
    hasAdminPin: true,
    targetUrl: json.url
  });

  return json;
}

export async function uploadAudioFile(
  file: File,
  adminPin: string
): Promise<{ success: boolean; url: string }> {
  const endpoint = buildApiUrl('/api/admin/audio/upload');
  const xhrRes = await monitoredXhrUpload({
    url: endpoint,
    mediaKind: 'audio',
    file,
    fileName: file.name || 'cricket_sfx',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-admin-pin': adminPin,
      'x-file-name': encodeURIComponent(file.name || 'cricket_sfx')
    }
  });
  if (xhrRes.status < 200 || xhrRes.status >= 300 || !xhrRes.json?.url) {
    throw new Error(xhrRes.json?.error || `Failed to upload audio file (HTTP ${xhrRes.status})`);
  }
  return xhrRes.json;
}

export interface DefaultAudioAssetInfo {
  key: 'four' | 'six' | 'wicket' | 'crowd';
  label: string;
  filename: string;
  url: string;
  exists: boolean;
  sizeBytes: number;
}

export async function fetchDefaultAudioAssets(): Promise<DefaultAudioAssetInfo[]> {
  try {
    const res = await fetch(buildApiUrl('/api/audio/assets'));
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.assets) ? json.assets : [];
  } catch {
    return [];
  }
}

export function getViewerSessionId(): string {
  if (typeof window === 'undefined') return 'ssr_session';
  try {
    const existing = window.sessionStorage.getItem('crex_viewer_sid');
    if (existing) return existing;
    const created = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    window.sessionStorage.setItem('crex_viewer_sid', created);
    return created;
  } catch {
    return `v_${Date.now().toString(36)}`;
  }
}

export async function pingViewerPresence(
  sessionId: string,
  view: 'broadcast' | 'android' | 'overlay' | 'admin',
  leaving: boolean = false
): Promise<void> {
  const url = buildApiUrl('/api/viewers/ping');
  const body = JSON.stringify({ sessionId, view, leaving });
  if (leaving && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return;
    } catch {
      // fallback to fetch keepalive below
    }
  }
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: leaving
    });
  } catch {
    // ignore transient presence ping network errors
  }
}

export async function fetchAdminViewerStats(adminPin: string): Promise<LiveViewerStats | null> {
  try {
    const res = await fetch(buildApiUrl('/api/admin/viewers'), {
      headers: {
        Accept: 'application/json',
        'x-admin-pin': adminPin
      }
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.stats || null;
  } catch {
    return null;
  }
}

export async function uploadApkFile(
  file: File,
  adminPin: string
): Promise<{ success: boolean; url: string }> {
  const endpoint = buildApiUrl('/api/admin/apk/upload');
  const xhrRes = await monitoredXhrUpload({
    url: endpoint,
    mediaKind: 'apk',
    file,
    fileName: file.name || 'live_cricket_app.apk',
    headers: {
      'Content-Type': file.type || 'application/vnd.android.package-archive',
      'x-admin-pin': adminPin,
      'x-file-name': encodeURIComponent(file.name || 'live_cricket_app.apk')
    },
    timeoutMs: 300_000
  });
  if (xhrRes.status < 200 || xhrRes.status >= 300 || !xhrRes.json?.url) {
    throw new Error(xhrRes.json?.error || `Failed to upload APK file (HTTP ${xhrRes.status})`);
  }
  return xhrRes.json;
}

export async function fetchServerAdminNews(): Promise<{
  news: NewsItem[];
  settings: CricketNewsSettings | null;
}> {
  try {
    const res = await fetch(buildApiUrl('/api/news'), {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return { news: [], settings: null };
    const json = await res.json();
    return {
      news: Array.isArray(json.news) ? json.news : [],
      settings: json.settings || null
    };
  } catch {
    return { news: [], settings: null };
  }
}

export async function fetchPublicCricketNewsFeed(): Promise<{
  enabled: boolean;
  settings: CricketNewsSettings | null;
  items: FetchedCricketNewsItem[];
}> {
  try {
    const res = await fetch(buildApiUrl('/api/news/cricket-feed'), {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return { enabled: false, settings: null, items: [] };
    const json = await res.json();
    return {
      enabled: Boolean(json.enabled),
      settings: json.settings || null,
      items: Array.isArray(json.items) ? json.items : []
    };
  } catch {
    return { enabled: false, settings: null, items: [] };
  }
}

export async function fetchAdminCricketNewsFeed(
  params: {
    source?: CricketNewsSource;
    query?: string;
    limit?: number;
    preferPlayerImage?: boolean;
    refresh?: boolean;
  },
  adminPin: string
): Promise<{ items: FetchedCricketNewsItem[]; settings: CricketNewsSettings | null }> {
  const sp = new URLSearchParams();
  if (params.source) sp.set('source', params.source);
  if (params.query !== undefined) sp.set('query', params.query);
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.preferPlayerImage !== undefined) sp.set('preferPlayerImage', String(params.preferPlayerImage));
  if (params.refresh) sp.set('refresh', '1');

  const res = await fetch(buildApiUrl(`/api/admin/cricket-news/feed?${sp.toString()}`), {
    headers: {
      Accept: 'application/json',
      'x-admin-pin': adminPin
    }
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Failed to fetch cricket news feed');
  }
  return {
    items: Array.isArray(json.items) ? json.items : [],
    settings: json.settings || null
  };
}

export async function updateAdminCricketNewsSettings(
  settings: Partial<CricketNewsSettings>,
  adminPin: string
): Promise<CricketNewsSettings> {
  const res = await fetch(buildApiUrl('/api/admin/cricket-news/settings'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ ...settings, adminPin })
  });
  const json = await res.json();
  if (!res.ok || !json.settings) {
    throw new Error(json.error || 'Failed to save cricket news settings');
  }
  return json.settings;
}

export async function saveAdminNewsToServer(item: NewsItem, adminPin: string): Promise<NewsItem[]> {
  const res = await fetch(buildApiUrl('/api/admin/news'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ item, adminPin })
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Failed to save news on server');
  }
  return Array.isArray(json.news) ? json.news : [];
}

export async function deleteAdminNewsFromServer(id: string, adminPin: string): Promise<NewsItem[]> {
  const res = await fetch(buildApiUrl(`/api/admin/news/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: {
      'x-admin-pin': adminPin
    }
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Failed to delete news on server');
  }
  return Array.isArray(json.news) ? json.news : [];
}

export async function fetchAiNewsStudioState(): Promise<AiNewsStudioState | null> {
  try {
    const res = await fetch(buildApiUrl('/api/news-studio/state'), {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.state || null;
  } catch {
    return null;
  }
}

export function getAiNewsBulletinAudioUrl(bulletinId: string, voiceName?: AiNewsVoiceName): string {
  const sp = new URLSearchParams();
  if (voiceName) sp.set('voice', voiceName);
  const qs = sp.toString();
  return buildApiUrl(`/api/news-studio/audio/${encodeURIComponent(bulletinId)}${qs ? `?${qs}` : ''}`);
}

export async function updateAiNewsStudioConfig(
  config: Partial<AiNewsStudioConfig>,
  adminPin: string
): Promise<AiNewsStudioState> {
  const res = await fetch(buildApiUrl('/api/admin/news-studio/config'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ config, adminPin })
  });
  const json = await res.json();
  if (!res.ok || !json.state) {
    throw new Error(json.error || 'Failed to update AI News Studio settings');
  }
  return json.state;
}

export async function refreshAiNewsStudioNow(
  adminPin: string,
  force: boolean = true
): Promise<AiNewsStudioState> {
  const res = await fetch(buildApiUrl('/api/admin/news-studio/refresh'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ force, adminPin })
  });
  const json = await res.json();
  if (!res.ok || !json.state) {
    throw new Error(json.error || 'Failed to gather verified news');
  }
  return json.state;
}

export async function previewAiNewsVoiceSample(
  voiceName: AiNewsVoiceName,
  anchorName: string,
  adminPin: string
): Promise<Blob> {
  const res = await fetch(buildApiUrl('/api/admin/news-studio/preview-voice'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ voiceName, anchorName, adminPin })
  });
  if (!res.ok) {
    let msg = 'Failed to synthesize voice preview';
    try {
      const errJson = await res.json();
      if (errJson?.error) msg = errJson.error;
    } catch {}
    throw new Error(msg);
  }
  return res.blob();
}

export async function updateAiNewsBulletin(
  bulletinId: string,
  patch: { editorialCategory?: AiNewsEditorialCategory; isBreaking?: boolean },
  adminPin: string
): Promise<AiNewsStudioState> {
  const res = await fetch(
    buildApiUrl(`/api/admin/news-studio/bulletins/${encodeURIComponent(bulletinId)}`),
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': adminPin
      },
      body: JSON.stringify({ ...patch, adminPin })
    }
  );
  const json = await res.json();
  if (!res.ok || !json.state) {
    throw new Error(json.error || 'Failed to update bulletin category');
  }
  return json.state;
}

export async function deleteAiNewsBulletin(
  bulletinId: string,
  adminPin: string
): Promise<AiNewsStudioState> {
  const res = await fetch(
    buildApiUrl(`/api/admin/news-studio/bulletins/${encodeURIComponent(bulletinId)}`),
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': adminPin
      },
      body: JSON.stringify({ adminPin })
    }
  );
  const json = await res.json();
  if (!res.ok || !json.state) {
    throw new Error(json.error || 'Failed to delete bulletin');
  }
  return json.state;
}

export interface AppDownloadIntentPayload {
  elementId: string;
  variant: 'banner' | 'compact' | 'mini';
  action: 'apk_download' | 'pwa_install' | 'install_modal';
  fileUrl?: string;
  version?: string;
  siteName?: string;
}

export function logAppDownloadIntent(payload: AppDownloadIntentPayload): void {
  if (typeof window === 'undefined') return;

  const eventData = {
    elementId: payload.elementId,
    variant: payload.variant,
    action: payload.action,
    fileUrl: payload.fileUrl || '',
    version: payload.version || '',
    siteName: payload.siteName || '',
    pagePath: `${window.location.pathname}${window.location.search}`,
    timestamp: Date.now()
  };

  // 1. Trigger Google Analytics (gtag / GTM dataLayer) if loaded
  try {
    const win = window as unknown as {
      gtag?: (...args: unknown[]) => void;
      dataLayer?: Array<Record<string, unknown>>;
    };
    if (typeof win.gtag === 'function') {
      win.gtag('event', 'app_download_intent', {
        event_category: 'app_download',
        event_label: payload.elementId,
        download_action: payload.action,
        app_variant: payload.variant,
        file_url: payload.fileUrl || '',
        app_version: payload.version || ''
      });
    } else if (Array.isArray(win.dataLayer)) {
      win.dataLayer.push({
        event: 'app_download_intent',
        ...eventData
      });
    }
  } catch {
    // Ignore third-party analytics errors so downloads never break
  }

  // 2. Log download intent to internal analytics endpoint (non-blocking)
  try {
    const endpoint = buildApiUrl('/api/analytics/download-intent');
    const serialized = JSON.stringify(eventData);

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([serialized], { type: 'application/json' });
      if (navigator.sendBeacon(endpoint, blob)) {
        return;
      }
    }

    void fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: serialized,
      keepalive: true
    }).catch(() => {});
  } catch {
    // Never obstruct file download if analytics fails
  }
}

export interface ApkUrlVerifyResult {
  valid: boolean;
  is200Ok?: boolean;
  status: number;
  statusText?: string;
  methodUsed?: 'HEAD' | 'GET_RANGE' | 'LOCAL';
  latencyMs?: number;
  contentType?: string;
  finalUrl?: string;
  contentLength?: number;
  checkedAt?: number;
  error?: string;
}

export async function verifyApkDownloadUrl(
  url: string,
  adminPin: string
): Promise<ApkUrlVerifyResult> {
  const res = await fetch(buildApiUrl('/api/admin/apk/verify'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ url: url.trim(), adminPin })
  });
  const json = await res.json();
  if (!res.ok && json?.valid === undefined) {
    throw new Error(json?.error || 'Failed to verify APK URL');
  }
  return json as ApkUrlVerifyResult;
}
