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
  const res = await fetch(buildApiUrl('/api/admin/media/upload'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': adminPin
    },
    body: JSON.stringify({ imageDataUrl, prefix, adminPin })
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Failed to upload image');
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

export async function uploadTvMediaFile(
  file: Blob,
  adminPin: string,
  fileName?: string
): Promise<{ success: boolean; url: string }> {
  const resolvedName =
    fileName || (file instanceof File && file.name ? file.name : 'recorded_clip.webm');
  const res = await fetch(buildApiUrl('/api/admin/tv-media/upload'), {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'video/webm',
      'x-admin-pin': adminPin,
      'x-file-name': encodeURIComponent(resolvedName)
    },
    body: file
  });
  const json = await res.json();
  if (!res.ok || !json.url) {
    throw new Error(json.error || 'Failed to upload TV media file');
  }
  return json;
}

export async function uploadAudioFile(
  file: File,
  adminPin: string
): Promise<{ success: boolean; url: string }> {
  const res = await fetch(buildApiUrl('/api/admin/audio/upload'), {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-admin-pin': adminPin,
      'x-file-name': encodeURIComponent(file.name || 'cricket_sfx')
    },
    body: file
  });
  const json = await res.json();
  if (!res.ok || !json.url) {
    throw new Error(json.error || 'Failed to upload audio file');
  }
  return json;
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
  const res = await fetch(buildApiUrl('/api/admin/apk/upload'), {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/vnd.android.package-archive',
      'x-admin-pin': adminPin,
      'x-file-name': encodeURIComponent(file.name || 'live_cricket_app.apk')
    },
    body: file
  });
  const json = await res.json();
  if (!res.ok || !json.url) {
    throw new Error(json.error || 'Failed to upload APK file');
  }
  return json;
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
  status: number;
  finalUrl?: string;
  contentLength?: number;
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
