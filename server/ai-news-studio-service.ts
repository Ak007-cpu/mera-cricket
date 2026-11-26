import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import {
  AI_NEWS_CATEGORIES,
  AI_NEWS_EDITORIAL_CATEGORIES,
  AI_NEWS_VOICES,
  AiNewsAnchorId,
  AiNewsBulletin,
  AiNewsCategory,
  AiNewsEditorialCategory,
  AiNewsSourceAttribution,
  AiNewsStudioConfig,
  AiNewsStudioState,
  AiNewsVoiceName,
  BroadcastTickerMode
} from '../src/types/cricket';
import { VERIFIED_PLAYERS } from '../src/data/playersRegistry';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STUDIO_STATE_FILE = path.join(DATA_DIR, 'ai-news-studio.json');
const AUDIO_CACHE_DIR = path.join(DATA_DIR, 'ai-news-audio');

const DEFAULT_CONFIG: AiNewsStudioConfig = {
  enabled: true,
  autoSwitchOnNoMatch: true,
  companyName: 'DATA VAULT SPORTS HD',
  logoUrl: '',
  anchorId: 'male_pk',
  anchorName: 'Zain Tariq',
  anchorTitle: 'Senior Sports Anchor',
  customAnchorImageUrl: '',
  voiceName: 'Charon',
  voiceStyle: 'Authoritative, clear Pakistani Urdu television sports news anchor',
  speechRate: 1.0,
  autoSpeak: true,
  tickerSpeed: 'normal',
  broadcastTickerEnabled: true,
  broadcastTickerMode: 'auto',
  broadcastTickerBreakingOnly: true,
  broadcastTickerManualText: '',
  broadcastCategoryFilter: 'All',
  refreshIntervalMinutes: 15,
  bulletinDurationSec: 22,
  categories: [
    'pakistan_cricket',
    'international_cricket',
    'leagues',
    'players',
    'match_schedules',
    'transfers',
    'injuries',
    'major_sports'
  ],
  showSourcesOnScreen: true,
  updatedAt: 0
};

const VALID_CATEGORY_IDS = new Set<AiNewsCategory>(AI_NEWS_CATEGORIES.map((c) => c.id));
const VALID_EDITORIAL_CATEGORIES = new Set<AiNewsEditorialCategory>(
  AI_NEWS_EDITORIAL_CATEGORIES.map((c) => c.id)
);
const VALID_VOICE_IDS = new Set<AiNewsVoiceName>(AI_NEWS_VOICES.map((v) => v.id));

const CATEGORY_MAP = new Map(AI_NEWS_CATEGORIES.map((c) => [c.id, c]));

function normalizeEditorialCategory(
  raw: unknown,
  topicCategory: AiNewsCategory = 'pakistan_cricket',
  textHint: string = '',
  isBreaking: boolean = false
): AiNewsEditorialCategory {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (VALID_EDITORIAL_CATEGORIES.has(trimmed as AiNewsEditorialCategory)) {
      return trimmed as AiNewsEditorialCategory;
    }
    const lower = trimmed.toLowerCase();
    if (lower === 'transfer' || lower.includes('transfer') || lower.includes('squad') || lower.includes('draft') || lower.includes('signing')) {
      return 'Transfers';
    }
    if (lower.includes('domestic') || lower.includes('psl') || lower.includes('ipl') || lower.includes('bbl') || lower.includes('league')) {
      return 'Domestic';
    }
    if (lower.includes('icc')) return 'ICC';
    if (lower.includes('injur') || lower.includes('fitness')) return 'Injuries';
    if (lower.includes('internat')) return 'International';
    if (lower.includes('break')) return 'Breaking';
    if (lower.includes('match')) return 'Match Update';
  }

  const combined = `${textHint || ''}`.toLowerCase();
  if (/\b(transfer|signing|signed|draft|auction|retained|released|replacement|trade|squad announced|named squad)\b/i.test(combined)) {
    return 'Transfers';
  }
  if (/\b(injur|ruled out|hamstring|knee|fracture|fitness|rehab|recovery|scan)\b/i.test(combined)) {
    return 'Injuries';
  }
  if (/\b(icc|world cup|champions trophy|wtc|rankings|test championship)\b/i.test(combined)) {
    return 'ICC';
  }
  if (/\b(psl|ipl|bbl|sa20|ilt20|cpl|quaid-e-azam|national t20|champions cup|domestic|county|franchise)\b/i.test(combined)) {
    return 'Domestic';
  }
  if (isBreaking) {
    return 'Breaking';
  }

  switch (topicCategory) {
    case 'transfers':
      return 'Transfers';
    case 'injuries':
      return 'Injuries';
    case 'leagues':
      return 'Domestic';
    case 'international_cricket':
    case 'pakistan_cricket':
      return 'International';
    case 'match_schedules':
      return 'Match Update';
    default:
      return 'General';
  }
}

const CATEGORY_SEARCH_DESCRIPTIONS: Record<AiNewsCategory, string> = {
  pakistan_cricket: 'Pakistan cricket team, PCB, PSL, Babar Azam, Shaheen Afridi, Mohammad Rizwan, Pakistan tours and squad updates',
  international_cricket: 'International cricket bilateral series, ICC events, India, Australia, England, New Zealand, South Africa, Sri Lanka match results',
  leagues: 'Franchise T20 and cricket leagues such as PSL, IPL, BBL, SA20, ILT20, CPL, The Hundred',
  players: 'Cricket player milestones, rankings, form updates, captaincy news, and standout performances',
  match_schedules: 'Upcoming cricket match schedules, fixtures, tour itineraries, and series dates',
  transfers: 'Player signings, franchise drafts, auctions, team transfers, and squad replacements',
  injuries: 'Cricketer injury reports, medical updates, fitness recoveries, and player unavailability',
  major_sports: 'Major global and Pakistani sports headlines including football, hockey, squash, javelin, Olympics'
};

const TEAM_KEYWORD_PATTERNS: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /\b(pakistan|pcb|pakistani|psl|lahore qalandars|karachi kings|peshawar zalmi|islamabad united|multan sultans|quetta gladiators)\b/i, code: 'PAK' },
  { pattern: /\b(india|indian|bcci|ipl)\b/i, code: 'IND' },
  { pattern: /\b(australia|australian|aussies|bbl)\b/i, code: 'AUS' },
  { pattern: /\b(england|english|ecb)\b/i, code: 'ENG' },
  { pattern: /\b(new zealand|black caps|kiwis)\b/i, code: 'NZ' },
  { pattern: /\b(south africa|proteas|sa20)\b/i, code: 'SA' },
  { pattern: /\b(sri lanka|sri lankan)\b/i, code: 'SL' },
  { pattern: /\b(bangladesh|bangladeshi|bpl)\b/i, code: 'BAN' },
  { pattern: /\b(west indies|windies|cpl)\b/i, code: 'WI' },
  { pattern: /\b(afghanistan|afghan)\b/i, code: 'AFG' },
  { pattern: /\b(ireland|irish)\b/i, code: 'IRE' },
  { pattern: /\b(zimbabwe)\b/i, code: 'ZIM' }
];

const KNOWN_SEARCH_PLAYERS: Array<{ name: string; teamCode: string }> = [
  ...Object.values(VERIFIED_PLAYERS).map((p) => ({ name: p.name, teamCode: p.teamCode })),
  { name: 'Babar Azam', teamCode: 'PAK' },
  { name: 'Mohammad Rizwan', teamCode: 'PAK' },
  { name: 'Shaheen Shah Afridi', teamCode: 'PAK' },
  { name: 'Naseem Shah', teamCode: 'PAK' },
  { name: 'Fakhar Zaman', teamCode: 'PAK' },
  { name: 'Saim Ayub', teamCode: 'PAK' },
  { name: 'Salman Ali Agha', teamCode: 'PAK' },
  { name: 'Haris Rauf', teamCode: 'PAK' },
  { name: 'Shadab Khan', teamCode: 'PAK' },
  { name: 'Saud Shakeel', teamCode: 'PAK' },
  { name: 'Shan Masood', teamCode: 'PAK' },
  { name: 'Virat Kohli', teamCode: 'IND' },
  { name: 'Rohit Sharma', teamCode: 'IND' },
  { name: 'Jasprit Bumrah', teamCode: 'IND' },
  { name: 'Shubman Gill', teamCode: 'IND' },
  { name: 'Pat Cummins', teamCode: 'AUS' },
  { name: 'Steve Smith', teamCode: 'AUS' },
  { name: 'Travis Head', teamCode: 'AUS' },
  { name: 'Mitchell Starc', teamCode: 'AUS' },
  { name: 'Ben Stokes', teamCode: 'ENG' },
  { name: 'Joe Root', teamCode: 'ENG' },
  { name: 'Jos Buttler', teamCode: 'ENG' },
  { name: 'Kane Williamson', teamCode: 'NZ' },
  { name: 'Rashid Khan', teamCode: 'AFG' },
  { name: 'Kagiso Rabada', teamCode: 'SA' }
];

interface PersistedStudioData {
  config: AiNewsStudioConfig;
  bulletins: AiNewsBulletin[];
  coveredHistory: string[];
  lastFetchedAt: number;
  lastError: string | null;
  nextScheduledFetchAt: number;
}

function normalizeTitleFingerprint(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an|in|on|at|for|to|of|and|with|vs|after|over|from)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 96);
}

function sanitizeHttpUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|\/)/i.test(trimmed)) {
    return trimmed.slice(0, 2000);
  }
  return '';
}

interface ClassifiedGeminiError {
  code: number;
  status: string;
  isQuotaOrRateLimit: boolean;
  isAuthOrKeyError: boolean;
  isModelNotFound: boolean;
  isTransient: boolean;
  retryAfterMs: number;
  userMessage: string;
}

function classifyGeminiError(err: unknown): ClassifiedGeminiError {
  const rawMessage =
    typeof err === 'string'
      ? err
      : typeof (err as any)?.message === 'string'
      ? (err as any).message
      : String(err || 'Unknown Gemini API error');

  let code = Number((err as any)?.status || (err as any)?.code || 0);
  let status = String((err as any)?.statusText || '').toUpperCase();
  let innerMessage = rawMessage;
  let retryDelayMs = 0;

  const trimmed = rawMessage.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const errObj = parsed?.error || parsed;
      if (typeof errObj?.code === 'number') code = errObj.code;
      if (typeof errObj?.status === 'string') status = errObj.status.toUpperCase();
      if (typeof errObj?.message === 'string') innerMessage = errObj.message;
      const details = Array.isArray(errObj?.details) ? errObj.details : [];
      for (const d of details) {
        if (typeof d?.retryDelay === 'string') {
          const secMatch = d.retryDelay.match(/(\d+(?:\.\d+)?)s/i);
          if (secMatch) {
            retryDelayMs = Math.max(retryDelayMs, Math.ceil(Number(secMatch[1]) * 1000));
          }
        }
      }
    } catch {
      // ignore non-JSON message
    }
  }

  const lower = `${status} ${innerMessage}`.toLowerCase();
  const isMissingKey = lower.includes('gemini_api_key is not set');
  const isQuotaOrRateLimit =
    code === 429 ||
    status === 'RESOURCE_EXHAUSTED' ||
    lower.includes('resource_exhausted') ||
    lower.includes('exceeded your current quota') ||
    lower.includes('rate limit') ||
    lower.includes('rate-limit');
  const isAuthOrKeyError =
    isMissingKey ||
    code === 401 ||
    code === 403 ||
    status === 'PERMISSION_DENIED' ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('api key not valid');
  const isModelNotFound =
    code === 404 || status === 'NOT_FOUND' || lower.includes('not_found');
  const isTransient =
    !isQuotaOrRateLimit &&
    !isAuthOrKeyError &&
    !isModelNotFound &&
    (code === 500 ||
      code === 502 ||
      code === 503 ||
      code === 504 ||
      lower.includes('unavailable') ||
      lower.includes('timeout') ||
      lower.includes('econnreset') ||
      lower.includes('fetch failed'));

  if (isQuotaOrRateLimit) {
    return {
      code: code || 429,
      status: status || 'RESOURCE_EXHAUSTED',
      isQuotaOrRateLimit: true,
      isAuthOrKeyError: false,
      isModelNotFound: false,
      isTransient: false,
      retryAfterMs: Math.max(30 * 60_000, retryDelayMs),
      userMessage:
        'Gemini API quota limit reached (429 RESOURCE_EXHAUSTED). Automatic AI news refresh is paused during cooldown. Check your rate limits or select a billing-enabled API key in Settings > Secrets.'
    };
  }

  if (isAuthOrKeyError) {
    return {
      code: code || 403,
      status: status || 'PERMISSION_DENIED',
      isQuotaOrRateLimit: false,
      isAuthOrKeyError: true,
      isModelNotFound: false,
      isTransient: false,
      retryAfterMs: 30 * 60_000,
      userMessage:
        'Gemini API key is missing, invalid, or lacks permission. Please verify or select an API key in Settings > Secrets.'
    };
  }

  if (isModelNotFound) {
    return {
      code: 404,
      status: 'NOT_FOUND',
      isQuotaOrRateLimit: false,
      isAuthOrKeyError: false,
      isModelNotFound: true,
      isTransient: false,
      retryAfterMs: 30 * 60_000,
      userMessage:
        'Configured Gemini model was not found (404 NOT_FOUND). Please verify the model name.'
    };
  }

  return {
    code: code || 500,
    status: status || 'ERROR',
    isQuotaOrRateLimit: false,
    isAuthOrKeyError: false,
    isModelNotFound: false,
    isTransient,
    retryAfterMs: 10 * 60_000,
    userMessage: innerMessage.slice(0, 320) || 'Failed to fetch verified sports news via Google Search.'
  };
}

function extractJsonFromModelText(raw: string): { bulletins?: Array<Record<string, any>> } | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  const candidates: string[] = [];
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    candidates.push(fenceMatch[1].trim());
  }
  candidates.push(cleaned);

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && Array.isArray(parsed.bulletins)) {
        return parsed;
      }
      if (Array.isArray(parsed)) {
        return { bulletins: parsed };
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set on the server. AI Google Search & Urdu TTS require a valid Gemini API key.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function detectTeamAndPlayer(
  headline: string,
  hintPlayer?: string,
  hintTeamCode?: string
): { playerName?: string; teamCode?: string; imageUrl?: string } {
  const cleanHintPlayer = (hintPlayer || '').trim();
  const cleanHintTeam = (hintTeamCode || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

  let matchedPlayer: { name: string; teamCode: string } | undefined;

  if (cleanHintPlayer) {
    matchedPlayer = KNOWN_SEARCH_PLAYERS.find(
      (p) =>
        p.name.toLowerCase() === cleanHintPlayer.toLowerCase() ||
        cleanHintPlayer.toLowerCase().includes(p.name.toLowerCase()) ||
        p.name.toLowerCase().includes(cleanHintPlayer.toLowerCase())
    );
    if (!matchedPlayer && cleanHintPlayer.length >= 4) {
      matchedPlayer = {
        name: cleanHintPlayer,
        teamCode: cleanHintTeam || 'CRX'
      };
    }
  }

  if (!matchedPlayer) {
    const lowerHeadline = headline.toLowerCase();
    matchedPlayer = KNOWN_SEARCH_PLAYERS.find((p) => lowerHeadline.includes(p.name.toLowerCase()));
  }

  let teamCode = cleanHintTeam || matchedPlayer?.teamCode || '';
  if (!teamCode) {
    for (const rule of TEAM_KEYWORD_PATTERNS) {
      if (rule.pattern.test(headline)) {
        teamCode = rule.code;
        break;
      }
    }
  }

  let imageUrl = '';
  if (matchedPlayer) {
    const sp = new URLSearchParams();
    sp.set('name', matchedPlayer.name);
    if (teamCode) sp.set('team', teamCode);
    imageUrl = `/api/player/photo?${sp.toString()}`;
  } else if (teamCode && teamCode !== 'CRX') {
    imageUrl = `/api/team/flag/${encodeURIComponent(teamCode)}`;
  }

  return {
    playerName: matchedPlayer?.name,
    teamCode: teamCode || undefined,
    imageUrl: imageUrl || undefined
  };
}

class AiNewsStudioService {
  private data: PersistedStudioData = {
    config: structuredClone(DEFAULT_CONFIG),
    bulletins: [],
    coveredHistory: [],
    lastFetchedAt: 0,
    lastError: null,
    nextScheduledFetchAt: 0
  };

  private isFetching = false;
  private consecutiveQuotaErrors = 0;
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(state: AiNewsStudioState) => void>();
  private initialized = false;

  constructor() {
    this.init();
  }

  private async init() {
    await this.loadFromDisk();
    this.initialized = true;
    this.startScheduler();
    // Kick off initial news gather shortly after boot ONLY if enabled and cooldown has elapsed
    setTimeout(() => {
      if (!this.data.config.enabled || this.isFetching) return;
      const now = Date.now();
      if (now < this.data.nextScheduledFetchAt) return;
      if (this.data.bulletins.length === 0 || now >= this.data.nextScheduledFetchAt) {
        this.refreshNewsNow({ triggerSource: 'startup' }).catch(() => {});
      }
    }, 4000);
  }

  private async loadFromDisk() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.mkdir(AUDIO_CACHE_DIR, { recursive: true });
      const raw = await fs.readFile(STUDIO_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedStudioData>;
      let normalizedError = typeof parsed.lastError === 'string' ? parsed.lastError : null;
      let shouldSaveNormalized = false;

      if (normalizedError && normalizedError.trim().startsWith('{')) {
        normalizedError = classifyGeminiError(normalizedError).userMessage;
        shouldSaveNormalized = true;
      }

      this.data = {
        config: this.mergeConfig(parsed.config),
        bulletins: Array.isArray(parsed.bulletins)
          ? parsed.bulletins.slice(0, 12).map((b) => ({
              ...b,
              editorialCategory: normalizeEditorialCategory(
                b.editorialCategory,
                b.category,
                b.englishHeadline,
                b.isBreaking
              )
            }))
          : [],
        coveredHistory: Array.isArray(parsed.coveredHistory) ? parsed.coveredHistory.slice(0, 80) : [],
        lastFetchedAt: typeof parsed.lastFetchedAt === 'number' ? parsed.lastFetchedAt : 0,
        lastError: normalizedError,
        nextScheduledFetchAt: typeof parsed.nextScheduledFetchAt === 'number' ? parsed.nextScheduledFetchAt : 0
      };

      if (shouldSaveNormalized) {
        await this.saveToDisk();
      }
    } catch {
      this.data = {
        config: structuredClone(DEFAULT_CONFIG),
        bulletins: [],
        coveredHistory: [],
        lastFetchedAt: 0,
        lastError: null,
        nextScheduledFetchAt: 0
      };
      await this.saveToDisk();
    }
  }

  private async saveToDisk() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(STUDIO_STATE_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AI-NEWS-STUDIO] Failed to save studio state to disk:', err);
    }
  }

  private mergeConfig(patch?: Partial<AiNewsStudioConfig> | null): AiNewsStudioConfig {
    const base = this.data?.config || DEFAULT_CONFIG;
    if (!patch || typeof patch !== 'object') return structuredClone(base);

    const anchorId: AiNewsAnchorId =
      patch.anchorId === 'male_pk' || patch.anchorId === 'female_pk' || patch.anchorId === 'custom'
        ? patch.anchorId
        : base.anchorId;

    const voiceName: AiNewsVoiceName =
      patch.voiceName && VALID_VOICE_IDS.has(patch.voiceName) ? patch.voiceName : base.voiceName;

    const categories: AiNewsCategory[] = Array.isArray(patch.categories)
      ? Array.from(new Set(patch.categories.filter((c): c is AiNewsCategory => VALID_CATEGORY_IDS.has(c))))
      : base.categories;

    const safeCategories = categories.length > 0 ? categories : base.categories;

    const refreshIntervalMinutes = Number.isFinite(Number(patch.refreshIntervalMinutes))
      ? Math.max(5, Math.min(180, Math.round(Number(patch.refreshIntervalMinutes))))
      : base.refreshIntervalMinutes;

    const bulletinDurationSec = Number.isFinite(Number(patch.bulletinDurationSec))
      ? Math.max(10, Math.min(90, Math.round(Number(patch.bulletinDurationSec))))
      : base.bulletinDurationSec;

    const speechRate = Number.isFinite(Number(patch.speechRate))
      ? Math.round(Math.max(0.75, Math.min(1.4, Number(patch.speechRate))) * 100) / 100
      : base.speechRate;

    const tickerSpeed =
      patch.tickerSpeed === 'slow' || patch.tickerSpeed === 'normal' || patch.tickerSpeed === 'fast'
        ? patch.tickerSpeed
        : base.tickerSpeed;

    const broadcastTickerMode: BroadcastTickerMode =
      patch.broadcastTickerMode === 'auto' ||
      patch.broadcastTickerMode === 'manual' ||
      patch.broadcastTickerMode === 'combined'
        ? patch.broadcastTickerMode
        : base.broadcastTickerMode || 'auto';

    const broadcastTickerManualText =
      typeof patch.broadcastTickerManualText === 'string'
        ? patch.broadcastTickerManualText.trim().slice(0, 800)
        : base.broadcastTickerManualText || '';

    const broadcastCategoryFilter: 'All' | AiNewsEditorialCategory =
      patch.broadcastCategoryFilter === 'All' ||
      (typeof patch.broadcastCategoryFilter === 'string' &&
        VALID_EDITORIAL_CATEGORIES.has(patch.broadcastCategoryFilter as AiNewsEditorialCategory))
        ? (patch.broadcastCategoryFilter as 'All' | AiNewsEditorialCategory)
        : base.broadcastCategoryFilter || 'All';

    return {
      enabled: typeof patch.enabled === 'boolean' ? patch.enabled : base.enabled,
      autoSwitchOnNoMatch:
        typeof patch.autoSwitchOnNoMatch === 'boolean'
          ? patch.autoSwitchOnNoMatch
          : base.autoSwitchOnNoMatch,
      companyName:
        typeof patch.companyName === 'string' && patch.companyName.trim()
          ? patch.companyName.trim().slice(0, 60)
          : base.companyName,
      logoUrl:
        typeof patch.logoUrl === 'string' ? sanitizeHttpUrl(patch.logoUrl) : base.logoUrl,
      anchorId,
      anchorName:
        typeof patch.anchorName === 'string' && patch.anchorName.trim()
          ? patch.anchorName.trim().slice(0, 60)
          : anchorId === 'female_pk' && base.anchorName === 'Zain Tariq'
          ? 'Ayesha Khan'
          : anchorId === 'male_pk' && base.anchorName === 'Ayesha Khan'
          ? 'Zain Tariq'
          : base.anchorName,
      anchorTitle:
        typeof patch.anchorTitle === 'string' && patch.anchorTitle.trim()
          ? patch.anchorTitle.trim().slice(0, 80)
          : base.anchorTitle,
      customAnchorImageUrl:
        typeof patch.customAnchorImageUrl === 'string'
          ? sanitizeHttpUrl(patch.customAnchorImageUrl)
          : base.customAnchorImageUrl,
      voiceName,
      voiceStyle:
        typeof patch.voiceStyle === 'string' && patch.voiceStyle.trim()
          ? patch.voiceStyle.trim().slice(0, 200)
          : base.voiceStyle,
      speechRate,
      autoSpeak: typeof patch.autoSpeak === 'boolean' ? patch.autoSpeak : base.autoSpeak,
      tickerSpeed,
      broadcastTickerEnabled:
        typeof patch.broadcastTickerEnabled === 'boolean'
          ? patch.broadcastTickerEnabled
          : base.broadcastTickerEnabled ?? true,
      broadcastTickerMode,
      broadcastTickerBreakingOnly:
        typeof patch.broadcastTickerBreakingOnly === 'boolean'
          ? patch.broadcastTickerBreakingOnly
          : base.broadcastTickerBreakingOnly ?? true,
      broadcastTickerManualText,
      broadcastCategoryFilter,
      refreshIntervalMinutes,
      bulletinDurationSec,
      categories: safeCategories,
      showSourcesOnScreen:
        typeof patch.showSourcesOnScreen === 'boolean'
          ? patch.showSourcesOnScreen
          : base.showSourcesOnScreen,
      updatedAt: Date.now()
    };
  }

  private startScheduler() {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
    }
    this.schedulerTimer = setInterval(() => {
      if (!this.initialized || !this.data.config.enabled || this.isFetching) return;
      const now = Date.now();
      if (now >= this.data.nextScheduledFetchAt) {
        this.refreshNewsNow({ triggerSource: 'scheduler' }).catch(() => {});
      }
    }, 60_000);
  }

  private emitState() {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {}
    }
  }

  public subscribe(listener: (state: AiNewsStudioState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): AiNewsStudioState {
    return {
      config: structuredClone(this.data.config),
      bulletins: structuredClone(this.data.bulletins),
      coveredHistoryCount: this.data.coveredHistory.length,
      isFetching: this.isFetching,
      lastFetchedAt: this.data.lastFetchedAt,
      lastError: this.data.lastError,
      nextScheduledFetchAt: this.data.nextScheduledFetchAt
    };
  }

  public async updateConfig(patch: Partial<AiNewsStudioConfig>): Promise<AiNewsStudioState> {
    const prevInterval = this.data.config.refreshIntervalMinutes;
    this.data.config = this.mergeConfig(patch);

    if (prevInterval !== this.data.config.refreshIntervalMinutes && this.data.lastFetchedAt > 0) {
      this.data.nextScheduledFetchAt =
        this.data.lastFetchedAt + this.data.config.refreshIntervalMinutes * 60_000;
    }

    await this.saveToDisk();
    this.emitState();
    return this.getState();
  }

  public async updateBulletin(
    bulletinId: string,
    patch: { editorialCategory?: AiNewsEditorialCategory; isBreaking?: boolean }
  ): Promise<AiNewsStudioState> {
    const cleanId = bulletinId.replace(/[^a-zA-Z0-9_-]/g, '');
    const idx = this.data.bulletins.findIndex((b) => b.id === cleanId);
    if (idx < 0) {
      throw new Error('News bulletin not found.');
    }
    const existing = this.data.bulletins[idx];
    const nextBreaking =
      typeof patch.isBreaking === 'boolean' ? patch.isBreaking : existing.isBreaking;
    const nextEditorial =
      patch.editorialCategory && VALID_EDITORIAL_CATEGORIES.has(patch.editorialCategory)
        ? patch.editorialCategory
        : existing.editorialCategory;

    this.data.bulletins[idx] = {
      ...existing,
      editorialCategory: nextEditorial,
      isBreaking: nextBreaking
    };
    await this.saveToDisk();
    this.emitState();
    return this.getState();
  }

  public async deleteBulletin(bulletinId: string): Promise<AiNewsStudioState> {
    const cleanId = bulletinId.replace(/[^a-zA-Z0-9_-]/g, '');
    const before = this.data.bulletins.length;
    this.data.bulletins = this.data.bulletins.filter((b) => b.id !== cleanId);
    if (this.data.bulletins.length === before) {
      throw new Error('News bulletin not found.');
    }
    await this.saveToDisk();
    await this.cleanupOldAudioCache(new Set(this.data.bulletins.map((b) => b.id)));
    this.emitState();
    return this.getState();
  }

  private async cleanupOldAudioCache(keepIds: Set<string>) {
    try {
      const files = await fs.readdir(AUDIO_CACHE_DIR);
      for (const file of files) {
        const idPrefix = file.split('__')[0];
        if (!keepIds.has(idPrefix)) {
          await fs.unlink(path.join(AUDIO_CACHE_DIR, file)).catch(() => {});
        }
      }
    } catch {}
  }

  private async generateWithTransientRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const classified = classifyGeminiError(err);
      if (classified.isTransient) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return await fn();
      }
      throw err;
    }
  }

  public async refreshNewsNow(options: { force?: boolean; triggerSource?: string } = {}): Promise<AiNewsStudioState> {
    if (this.isFetching) {
      return this.getState();
    }

    if (!options.force && Date.now() < this.data.nextScheduledFetchAt) {
      return this.getState();
    }

    this.isFetching = true;
    this.data.lastError = null;
    this.emitState();

    const intervalMs = Math.max(5, this.data.config.refreshIntervalMinutes) * 60_000;

    try {
      const ai = getAiClient();
      const todayIso = new Date().toISOString().slice(0, 10);
      const selectedCats =
        this.data.config.categories.length > 0
          ? this.data.config.categories
          : DEFAULT_CONFIG.categories;

      const catPromptList = selectedCats
        .map((c) => `- ${c}: ${CATEGORY_SEARCH_DESCRIPTIONS[c]}`)
        .join('\n');

      const recentHistorySnippet = this.data.coveredHistory.slice(0, 35).join('\n- ');

      // Single-call Google Search grounding + Pakistani Urdu Broadcast Producer (minimizes API quota usage)
      const groundedBroadcastPrompt = `Current date: ${todayIso}.
You are the Senior Urdu Sports News Producer at "${this.data.config.companyName}".
Search Google right now for the LATEST verified sports and cricket news from reliable sports journalism sources (e.g. ESPNcricinfo, BBC Sport, ICC Cricket, Dawn Sports, Geo Super, Cricbuzz, Wisden, Reuters Sports).

Focus on these requested categories:
${catPromptList}

RECENTLY BROADCAST HEADLINES TO AVOID REPEATING (unless a major new verified update happened):
${recentHistorySnippet ? `- ${recentHistorySnippet}` : '- None yet'}

CRITICAL ACCURACY INSTRUCTIONS:
- Report ONLY verified facts, actual match results, official squad/transfer announcements, verified injuries, confirmed schedules, and major sports headlines appearing in Google Search results.
- NEVER fabricate or guess scores, quotes, dates, or events.

TASK:
Select up to 6 distinct, fresh, high-interest verified stories from your Google Search results and output a single valid JSON object inside a \`\`\`json code block matching this exact structure:
{
  "bulletins": [
    {
      "category": "one of [${selectedCats.join(', ')}]",
      "editorialCategory": "one of ['Domestic', 'International', 'Transfers', 'ICC', 'Match Update', 'Injuries', 'Breaking', 'General']",
      "isBreaking": false,
      "englishHeadline": "Concise factual English headline (max 110 chars)",
      "urduHeadline": "Crisp authentic Urdu news headline in Urdu script (max 140 chars)",
      "urduScript": "Natural 2 to 4 sentence Pakistani TV sports anchor spoken script in clear Urdu script (never invent quotes or facts; story 1 may open with ناظرین، ${this.data.config.companyName} کے نیوز بلیٹن میں خوش آمدید!)",
      "urduSummaryPoints": ["Short Urdu bullet point 1", "Short Urdu bullet point 2"],
      "tickerUrdu": "Single short punchy Urdu headline for bottom TV ticker",
      "tickerEnglish": "Single short factual English headline for ticker",
      "matchedPlayerName": "Full player name if centered on one cricketer, else empty string",
      "matchedTeamCode": "Uppercase code (PAK, IND, AUS, ENG, NZ, SA, SL, BAN, WI, AFG) or empty string",
      "publishedAt": "${todayIso}"
    }
  ]
}
Return ONLY valid JSON inside the \`\`\`json block.`;

      const searchResponse = await this.generateWithTransientRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: groundedBroadcastPrompt,
          config: {
            tools: [{ googleSearch: {} }]
          }
        })
      );

      const groundedText = (searchResponse.text || '').trim();
      if (!groundedText) {
        throw new Error('Google Search returned an empty briefing.');
      }

      const groundingChunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const extractedSources: AiNewsSourceAttribution[] = [];
      const seenUrls = new Set<string>();

      for (const chunk of groundingChunks) {
        const uri = chunk?.web?.uri;
        if (!uri || !/^https?:\/\//i.test(uri) || seenUrls.has(uri)) continue;
        seenUrls.add(uri);
        let hostName = '';
        try {
          hostName = new URL(uri).hostname.replace(/^www\./, '');
        } catch {}
        const rawTitle = (chunk?.web?.title || '').trim();
        const name = rawTitle && rawTitle.length <= 60 ? rawTitle : hostName || 'Verified Web Source';
        extractedSources.push({ name, url: uri });
      }

      let parsed = extractJsonFromModelText(groundedText);
      let rawItems = Array.isArray(parsed?.bulletins) ? parsed.bulletins : [];

      // Fallback formatting pass with lighter model ONLY if the single grounded response was prose instead of JSON
      if (rawItems.length === 0) {
        const sourceListForPrompt = extractedSources
          .slice(0, 20)
          .map((s, idx) => `[${idx}] ${s.name} (${s.url})`)
          .join('\n');

        const scriptPrompt = `You are the Senior Urdu Sports News Producer at "${this.data.config.companyName}".
Convert this verified Google Search sports briefing from ${todayIso} into structured Urdu TV bulletins JSON without adding any unverified facts.

VERIFIED SEARCH BRIEFING:
${groundedText}

VERIFIED GROUNDING SOURCES:
${sourceListForPrompt || '[0] Verified Google Search Wire'}

Categories allowed: ${selectedCats.join(', ')}`;

        const scriptResponse = await this.generateWithTransientRetry(() =>
          ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: scriptPrompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  bulletins: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: { type: Type.STRING },
                        editorialCategory: { type: Type.STRING },
                        isBreaking: { type: Type.BOOLEAN },
                        englishHeadline: { type: Type.STRING },
                        urduHeadline: { type: Type.STRING },
                        urduScript: { type: Type.STRING },
                        urduSummaryPoints: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING }
                        },
                        tickerUrdu: { type: Type.STRING },
                        tickerEnglish: { type: Type.STRING },
                        matchedPlayerName: { type: Type.STRING },
                        matchedTeamCode: { type: Type.STRING },
                        sourceIndices: {
                          type: Type.ARRAY,
                          items: { type: Type.INTEGER }
                        },
                        publishedAt: { type: Type.STRING }
                      },
                      required: [
                        'category',
                        'editorialCategory',
                        'isBreaking',
                        'englishHeadline',
                        'urduHeadline',
                        'urduScript',
                        'urduSummaryPoints',
                        'tickerUrdu',
                        'tickerEnglish',
                        'publishedAt'
                      ]
                    }
                  }
                },
                required: ['bulletins']
              }
            }
          })
        );

        const rawJson = (scriptResponse.text || '').trim();
        parsed = extractJsonFromModelText(rawJson);
        rawItems = Array.isArray(parsed?.bulletins) ? parsed.bulletins : [];
      }

      if (rawItems.length === 0) {
        throw new Error('AI Script Producer did not return any verified bulletins.');
      }

      const historySet = new Set(this.data.coveredHistory);
      const freshBulletins: AiNewsBulletin[] = [];
      const fallbackBulletins: AiNewsBulletin[] = [];

      for (const item of rawItems) {
        const englishHeadline = String(item.englishHeadline || '').trim().slice(0, 140);
        const urduHeadline = String(item.urduHeadline || '').trim().slice(0, 180);
        const urduScript = String(item.urduScript || '').trim().slice(0, 1400);
        if (!englishHeadline || !urduHeadline || !urduScript) continue;

        const catRaw = String(item.category || '').trim() as AiNewsCategory;
        const category: AiNewsCategory = VALID_CATEGORY_IDS.has(catRaw)
          ? catRaw
          : selectedCats[0] || 'pakistan_cricket';
        const catMeta = CATEGORY_MAP.get(category) || {
          id: category,
          label: 'Sports Update',
          urduLabel: 'اسپورٹس اپڈیٹ'
        };

        const srcIndices: number[] = Array.isArray(item.sourceIndices)
          ? item.sourceIndices.filter((n: any) => Number.isInteger(n) && n >= 0 && n < extractedSources.length)
          : [];
        const sources: AiNewsSourceAttribution[] =
          srcIndices.length > 0
            ? srcIndices.slice(0, 3).map((idx) => extractedSources[idx])
            : extractedSources.slice(0, 2);

        const detection = detectTeamAndPlayer(
          `${englishHeadline} ${item.matchedPlayerName || ''}`,
          item.matchedPlayerName,
          item.matchedTeamCode
        );

        const hash = crypto
          .createHash('sha1')
          .update(`${normalizeTitleFingerprint(englishHeadline)}_${Date.now()}`)
          .digest('hex')
          .slice(0, 12);

        const editorialCategory = normalizeEditorialCategory(
          item.editorialCategory,
          category,
          `${englishHeadline} ${item.tickerEnglish || ''}`,
          Boolean(item.isBreaking)
        );

        const bulletin: AiNewsBulletin = {
          id: `nb_${hash}`,
          category,
          editorialCategory,
          categoryLabel: catMeta.label,
          categoryUrdu: catMeta.urduLabel,
          isBreaking: Boolean(item.isBreaking),
          englishHeadline,
          urduHeadline,
          urduScript,
          urduSummaryPoints: Array.isArray(item.urduSummaryPoints)
            ? item.urduSummaryPoints
                .filter((p: any) => typeof p === 'string' && p.trim().length > 0)
                .map((p: string) => p.trim().slice(0, 180))
                .slice(0, 3)
            : [],
          tickerUrdu: String(item.tickerUrdu || urduHeadline).trim().slice(0, 200),
          tickerEnglish: String(item.tickerEnglish || englishHeadline).trim().slice(0, 180),
          matchedPlayerName: detection.playerName,
          matchedTeamCode: detection.teamCode,
          imageUrl: detection.imageUrl,
          sources,
          publishedAt: String(item.publishedAt || todayIso).trim().slice(0, 32),
          createdAt: Date.now()
        };

        const fp = normalizeTitleFingerprint(englishHeadline);
        if (!options.force && fp && historySet.has(fp)) {
          fallbackBulletins.push(bulletin);
        } else {
          freshBulletins.push(bulletin);
        }
      }

      const chosen = freshBulletins.length > 0 ? freshBulletins : fallbackBulletins;
      if (chosen.length === 0) {
        throw new Error('No valid bulletins could be constructed from grounded search.');
      }

      const updatedHistory = [...this.data.coveredHistory];
      for (const b of chosen) {
        const fp = normalizeTitleFingerprint(b.englishHeadline);
        if (fp && !updatedHistory.includes(fp)) {
          updatedHistory.unshift(fp);
        }
      }

      this.consecutiveQuotaErrors = 0;
      this.data.bulletins = chosen.slice(0, 8);
      this.data.coveredHistory = updatedHistory.slice(0, 80);
      this.data.lastFetchedAt = Date.now();
      this.data.lastError = null;
      this.data.nextScheduledFetchAt = Date.now() + intervalMs;

      await this.saveToDisk();
      await this.cleanupOldAudioCache(new Set(this.data.bulletins.map((b) => b.id)));

      console.log(
        `[AI-NEWS-STUDIO] Synced ${this.data.bulletins.length} grounded Urdu bulletins (${options.triggerSource || 'manual'}) with ${extractedSources.length} verified sources.`
      );
    } catch (err: any) {
      const classified = classifyGeminiError(err);
      this.data.lastError = classified.userMessage;

      if (classified.isQuotaOrRateLimit || classified.isAuthOrKeyError || classified.isModelNotFound) {
        this.consecutiveQuotaErrors += 1;
        const backoffFactor = Math.pow(2, Math.min(this.consecutiveQuotaErrors - 1, 2));
        const cooldownMs = Math.min(120 * 60_000, classified.retryAfterMs * backoffFactor);
        this.data.nextScheduledFetchAt = Date.now() + cooldownMs;
        console.warn(`[AI-NEWS-STUDIO] News refresh paused (${classified.status}): ${classified.userMessage}`);
      } else {
        this.data.nextScheduledFetchAt = Date.now() + Math.max(intervalMs, 10 * 60_000);
        console.warn(`[AI-NEWS-STUDIO] News refresh deferred: ${classified.userMessage}`);
      }

      await this.saveToDisk();
    } finally {
      this.isFetching = false;
      this.emitState();
    }

    return this.getState();
  }

  public async synthesizeBulletinWav(bulletinId: string, requestedVoice?: string): Promise<Buffer> {
    const cleanId = bulletinId.replace(/[^a-zA-Z0-9_-]/g, '');
    const bulletin = this.data.bulletins.find((b) => b.id === cleanId);
    if (!bulletin) {
      throw new Error('News bulletin not found.');
    }

    const voiceName: AiNewsVoiceName =
      requestedVoice && VALID_VOICE_IDS.has(requestedVoice as AiNewsVoiceName)
        ? (requestedVoice as AiNewsVoiceName)
        : this.data.config.voiceName;

    const cachePath = path.join(AUDIO_CACHE_DIR, `${cleanId}__${voiceName}.wav`);
    if (fsSync.existsSync(cachePath)) {
      return fs.readFile(cachePath);
    }

    const wavBuffer = await this.generateUrduTtsWav(
      bulletin.urduScript,
      voiceName,
      this.data.config.voiceStyle
    );

    await fs.mkdir(AUDIO_CACHE_DIR, { recursive: true });
    await fs.writeFile(cachePath, wavBuffer);
    return wavBuffer;
  }

  public async synthesizeSampleVoiceWav(voiceNameInput?: string, anchorNameInput?: string): Promise<Buffer> {
    const voiceName: AiNewsVoiceName =
      voiceNameInput && VALID_VOICE_IDS.has(voiceNameInput as AiNewsVoiceName)
        ? (voiceNameInput as AiNewsVoiceName)
        : this.data.config.voiceName;
    const anchor = (anchorNameInput || this.data.config.anchorName || 'Zain Tariq').trim();
    const company = this.data.config.companyName || 'DATA VAULT SPORTS HD';
    const sampleText = `السلام علیکم ناظرین، میں ہوں ${anchor} اور آپ دیکھ رہے ہیں ${company}۔ تازہ ترین کرکٹ اور اسپورٹس خبروں کے ساتھ ہم آپ کے ساتھ موجود ہیں۔`;
    return this.generateUrduTtsWav(sampleText, voiceName, this.data.config.voiceStyle);
  }

  private async generateUrduTtsWav(
    urduText: string,
    voiceName: AiNewsVoiceName,
    styleDescription: string
  ): Promise<Buffer> {
    try {
      const ai = getAiClient();
      const response = await this.generateWithTransientRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: urduText,
                  speechMetadata: {
                    style:
                      styleDescription ||
                      'Authoritative, natural, clear Pakistani Urdu television sports news presenter'
                  }
                } as any
              ]
            }
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName
                }
              }
            }
          } as any
        })
      );

      const parts = response.candidates?.[0]?.content?.parts || [];
      const audioPart = parts.find((p: any) => p?.inlineData?.data);
      const b64 = audioPart?.inlineData?.data;
      if (!b64) {
        throw new Error('Gemini TTS did not return audio bytes.');
      }

      return Buffer.from(b64, 'base64');
    } catch (err: any) {
      const classified = classifyGeminiError(err);
      throw new Error(classified.userMessage);
    }
  }
}

export const aiNewsStudioService = new AiNewsStudioService();
