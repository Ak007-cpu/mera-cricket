import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { load } from 'cheerio';
import { VERIFIED_PLAYERS } from '../src/data/playersRegistry';
import {
  CricketNewsSettings,
  CricketNewsSource,
  FetchedCricketNewsItem,
  NewsCategory,
  NewsItem
} from '../src/types/cricket';
import { crexService } from './crex-service';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'cricket-news-settings.json');
const ADMIN_NEWS_FILE = path.join(DATA_DIR, 'admin-news.json');

interface PlayerMatchEntry {
  name: string;
  teamCode: string;
  aliases: string[];
}

const KNOWN_PLAYER_ALIASES: Array<{ name: string; teamCode: string; aliases?: string[] }> = [
  { name: 'Virat Kohli', teamCode: 'IND', aliases: ['Kohli'] },
  { name: 'Rohit Sharma', teamCode: 'IND', aliases: ['Rohit'] },
  { name: 'Jasprit Bumrah', teamCode: 'IND', aliases: ['Bumrah'] },
  { name: 'MS Dhoni', teamCode: 'IND', aliases: ['Dhoni'] },
  { name: 'Shubman Gill', teamCode: 'IND', aliases: ['Gill'] },
  { name: 'Rishabh Pant', teamCode: 'IND', aliases: ['Pant'] },
  { name: 'Hardik Pandya', teamCode: 'IND', aliases: ['Pandya', 'Hardik'] },
  { name: 'Suryakumar Yadav', teamCode: 'IND', aliases: ['Suryakumar', 'SKY'] },
  { name: 'KL Rahul', teamCode: 'IND' },
  { name: 'Ravindra Jadeja', teamCode: 'IND', aliases: ['Jadeja'] },
  { name: 'Yashasvi Jaiswal', teamCode: 'IND', aliases: ['Jaiswal'] },
  { name: 'Sanju Samson', teamCode: 'IND', aliases: ['Samson'] },
  { name: 'Arshdeep Singh', teamCode: 'IND', aliases: ['Arshdeep'] },
  { name: 'Mohammed Siraj', teamCode: 'IND', aliases: ['Siraj'] },
  { name: 'Mohammed Shami', teamCode: 'IND', aliases: ['Shami'] },
  { name: 'Kuldeep Yadav', teamCode: 'IND', aliases: ['Kuldeep'] },
  { name: 'Abhishek Sharma', teamCode: 'IND' },
  { name: 'Tilak Varma', teamCode: 'IND' },
  { name: 'Babar Azam', teamCode: 'PAK', aliases: ['Babar'] },
  { name: 'Mohammad Rizwan', teamCode: 'PAK', aliases: ['Rizwan'] },
  { name: 'Shaheen Shah Afridi', teamCode: 'PAK', aliases: ['Shaheen Afridi', 'Shaheen'] },
  { name: 'Naseem Shah', teamCode: 'PAK', aliases: ['Naseem'] },
  { name: 'Fakhar Zaman', teamCode: 'PAK', aliases: ['Fakhar'] },
  { name: 'Shadab Khan', teamCode: 'PAK', aliases: ['Shadab'] },
  { name: 'Haris Rauf', teamCode: 'PAK', aliases: ['Rauf'] },
  { name: 'Saim Ayub', teamCode: 'PAK', aliases: ['Saim Ayub'] },
  { name: 'Salman Ali Agha', teamCode: 'PAK', aliases: ['Salman Agha'] },
  { name: 'Pat Cummins', teamCode: 'AUS', aliases: ['Cummins'] },
  { name: 'Steve Smith', teamCode: 'AUS', aliases: ['Steven Smith'] },
  { name: 'Travis Head', teamCode: 'AUS', aliases: ['Travis Head'] },
  { name: 'Mitchell Starc', teamCode: 'AUS', aliases: ['Starc'] },
  { name: 'Glenn Maxwell', teamCode: 'AUS', aliases: ['Maxwell'] },
  { name: 'David Warner', teamCode: 'AUS', aliases: ['Warner'] },
  { name: 'Josh Hazlewood', teamCode: 'AUS', aliases: ['Hazlewood'] },
  { name: 'Adam Zampa', teamCode: 'AUS', aliases: ['Zampa'] },
  { name: 'Mitchell Marsh', teamCode: 'AUS' },
  { name: 'Ben Stokes', teamCode: 'ENG', aliases: ['Stokes'] },
  { name: 'Joe Root', teamCode: 'ENG', aliases: ['Root'] },
  { name: 'Jos Buttler', teamCode: 'ENG', aliases: ['Buttler'] },
  { name: 'Harry Brook', teamCode: 'ENG', aliases: ['Brook'] },
  { name: 'Jofra Archer', teamCode: 'ENG', aliases: ['Archer'] },
  { name: 'Mark Wood', teamCode: 'ENG' },
  { name: 'Phil Salt', teamCode: 'ENG', aliases: ['Salt'] },
  { name: 'Kane Williamson', teamCode: 'NZ', aliases: ['Williamson'] },
  { name: 'Trent Boult', teamCode: 'NZ', aliases: ['Boult'] },
  { name: 'Rachin Ravindra', teamCode: 'NZ', aliases: ['Rachin'] },
  { name: 'Mitchell Santner', teamCode: 'NZ', aliases: ['Santner'] },
  { name: 'Kagiso Rabada', teamCode: 'SA', aliases: ['Rabada'] },
  { name: 'Quinton de Kock', teamCode: 'SA', aliases: ['de Kock'] },
  { name: 'Heinrich Klaasen', teamCode: 'SA', aliases: ['Klaasen'] },
  { name: 'Aiden Markram', teamCode: 'SA', aliases: ['Markram'] },
  { name: 'Temba Bavuma', teamCode: 'SA', aliases: ['Bavuma'] },
  { name: 'Rashid Khan', teamCode: 'AFG', aliases: ['Rashid Khan'] },
  { name: 'Rahmanullah Gurbaz', teamCode: 'AFG', aliases: ['Gurbaz'] },
  { name: 'Shakib Al Hasan', teamCode: 'BAN', aliases: ['Shakib'] },
  { name: 'Litton Das', teamCode: 'BAN', aliases: ['Litton'] },
  { name: 'Mustafizur Rahman', teamCode: 'BAN', aliases: ['Mustafizur'] },
  { name: 'Nicholas Pooran', teamCode: 'WI', aliases: ['Pooran'] },
  { name: 'Andre Russell', teamCode: 'WI', aliases: ['Russell'] },
  { name: 'Shai Hope', teamCode: 'WI', aliases: ['Shai Hope'] },
  { name: 'Jason Holder', teamCode: 'WI', aliases: ['Holder'] },
  { name: 'Alzarri Joseph', teamCode: 'WI' },
  { name: 'Wanindu Hasaranga', teamCode: 'SL', aliases: ['Hasaranga'] },
  { name: 'Pathum Nissanka', teamCode: 'SL', aliases: ['Nissanka'] },
  { name: 'Charith Asalanka', teamCode: 'SL', aliases: ['Asalanka'] },
  { name: 'Kusal Mendis', teamCode: 'SL', aliases: ['Mendis'] },
  { name: 'AB de Villiers', teamCode: 'SA', aliases: ['de Villiers'] },
  { name: 'Sachin Tendulkar', teamCode: 'IND', aliases: ['Tendulkar', 'Sachin'] },
  { name: 'Ravichandran Ashwin', teamCode: 'IND', aliases: ['R Ashwin', 'Ashwin'] },
  { name: 'Shreyas Iyer', teamCode: 'IND', aliases: ['Iyer'] },
  { name: 'Axar Patel', teamCode: 'IND', aliases: ['Axar'] },
  { name: 'Varun Chakaravarthy', teamCode: 'IND' },
  { name: 'Marnus Labuschagne', teamCode: 'AUS', aliases: ['Labuschagne'] },
  { name: 'Usman Khawaja', teamCode: 'AUS', aliases: ['Khawaja'] },
  { name: 'Alex Carey', teamCode: 'AUS' },
  { name: 'Nathan Lyon', teamCode: 'AUS', aliases: ['Lyon'] },
  { name: 'Ricky Ponting', teamCode: 'AUS', aliases: ['Ponting'] },
  { name: 'Daryl Mitchell', teamCode: 'NZ' },
  { name: 'Tom Latham', teamCode: 'NZ', aliases: ['Latham'] },
  { name: 'Devon Conway', teamCode: 'NZ', aliases: ['Conway'] },
  { name: 'Rachin Ravindra', teamCode: 'NZ' },
  { name: 'Matt Henry', teamCode: 'NZ' },
  { name: 'Tim Southee', teamCode: 'NZ', aliases: ['Southee'] },
  { name: 'Brendon McCullum', teamCode: 'ENG', aliases: ['McCullum'] },
  { name: 'Zak Crawley', teamCode: 'ENG', aliases: ['Crawley'] },
  { name: 'Ben Duckett', teamCode: 'ENG', aliases: ['Duckett'] },
  { name: 'Ollie Pope', teamCode: 'ENG' },
  { name: 'Saud Shakeel', teamCode: 'PAK', aliases: ['Saud Shakeel'] },
  { name: 'Shan Masood', teamCode: 'PAK', aliases: ['Shan Masood'] },
  { name: 'Abrar Ahmed', teamCode: 'PAK' },
  { name: 'Shahid Afridi', teamCode: 'PAK' },
  { name: 'Wasim Akram', teamCode: 'PAK', aliases: ['Wasim Akram'] },
  { name: 'Marco Jansen', teamCode: 'SA', aliases: ['Jansen'] },
  { name: 'Rassie van der Dussen', teamCode: 'SA' },
  { name: 'Mohammad Nabi', teamCode: 'AFG', aliases: ['Nabi'] },
  { name: 'Mushfiqur Rahim', teamCode: 'BAN', aliases: ['Mushfiqur'] },
  { name: 'Taskin Ahmed', teamCode: 'BAN', aliases: ['Taskin'] }
];

const TEAM_KEYWORDS: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /\b(india|indian|bcci|team india)\b/i, code: 'IND' },
  { pattern: /\b(pakistan|pakistani|pcb|pak)\b/i, code: 'PAK' },
  { pattern: /\b(australia|australian|aussies|mcg|scg|ca)\b/i, code: 'AUS' },
  { pattern: /\b(england|english|ecb|eng)\b/i, code: 'ENG' },
  { pattern: /\b(new zealand|black caps|kiwis|basin reserve)\b/i, code: 'NZ' },
  { pattern: /\b(south africa|south african|proteas)\b/i, code: 'SA' },
  { pattern: /\b(sri lanka|sri lankan)\b/i, code: 'SL' },
  { pattern: /\b(bangladesh|bangladeshi|tigers)\b/i, code: 'BAN' },
  { pattern: /\b(west indies|west indian|windies)\b/i, code: 'WI' },
  { pattern: /\b(afghanistan|afghan|afg)\b/i, code: 'AFG' }
];

const DEFAULT_SETTINGS: CricketNewsSettings = {
  autoSyncEnabled: true,
  source: 'all',
  query: '',
  maxItems: 6,
  preferPlayerImage: true,
  updatedAt: Date.now()
};

const feedCache = new Map<string, { fetchedAt: number; items: FetchedCricketNewsItem[] }>();
const FEED_CACHE_TTL_MS = 5 * 60 * 1000;

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPlayerMatchers(): PlayerMatchEntry[] {
  const byName = new Map<string, PlayerMatchEntry>();

  const addEntry = (name: string, teamCode: string, aliases: string[] = []) => {
    const clean = name.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      aliases.forEach((a) => {
        if (a && !existing.aliases.includes(a)) existing.aliases.push(a);
      });
      if (!existing.teamCode && teamCode) existing.teamCode = teamCode;
      return;
    }
    byName.set(key, {
      name: clean,
      teamCode: teamCode || 'CRX',
      aliases: [clean, ...aliases].filter((a) => a.trim().length >= 4)
    });
  };

  KNOWN_PLAYER_ALIASES.forEach((p) => addEntry(p.name, p.teamCode, p.aliases || []));

  Object.values(VERIFIED_PLAYERS).forEach((p) => {
    addEntry(p.name, p.teamCode, []);
  });

  // Also include players from the currently active live match so live match stars match immediately
  try {
    const active = crexService.getActiveMatch()?.matchState;
    if (active) {
      const batCode = active.battingTeam?.code || 'CRX';
      const bowlCode = active.bowlingTeam?.code || 'CRX';
      if (active.striker?.name) addEntry(active.striker.name, batCode, []);
      if (active.nonStriker?.name) addEntry(active.nonStriker.name, batCode, []);
      if (active.currentBowler?.name) addEntry(active.currentBowler.name, bowlCode, []);
      active.scorecards?.firstInnings?.batting?.forEach((b) => addEntry(b.name, active.scorecards?.firstInnings?.teamCode || batCode));
      active.scorecards?.firstInnings?.bowling?.forEach((b) => addEntry(b.name, bowlCode));
      active.scorecards?.secondInnings?.batting?.forEach((b) => addEntry(b.name, active.scorecards?.secondInnings?.teamCode || bowlCode));
      active.scorecards?.secondInnings?.bowling?.forEach((b) => addEntry(b.name, batCode));
    }
  } catch {}

  return Array.from(byName.values());
}

function detectPlayerInText(text: string, matchers: PlayerMatchEntry[]): { name: string; teamCode: string } | null {
  if (!text) return null;

  // Priority 1: Exact full name match (longest full names first)
  const fullSorted = [...matchers].sort((a, b) => b.name.length - a.name.length);
  for (const entry of fullSorted) {
    if (entry.name.length < 4) continue;
    const rx = new RegExp(`\\b${escapeRegex(entry.name)}\\b`, 'i');
    if (rx.test(text)) {
      return { name: entry.name, teamCode: entry.teamCode };
    }
  }

  // Priority 2: Known unique surname / nickname alias match
  for (const entry of matchers) {
    for (const alias of entry.aliases) {
      if (alias === entry.name || alias.length < 4) continue;
      const rx = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
      if (rx.test(text)) {
        return { name: entry.name, teamCode: entry.teamCode };
      }
    }
  }

  return null;
}

function detectTeamCodeInText(text: string): string | null {
  for (const t of TEAM_KEYWORDS) {
    if (t.pattern.test(text)) return t.code;
  }
  return null;
}

function inferCategory(title: string, description: string): NewsCategory {
  const combined = `${title} ${description}`.toLowerCase();
  if (/(breaking|ruled out|injured|injury|shock|banned|suspended|resigns|sacked)/i.test(combined)) {
    return 'Breaking';
  }
  if (/\b(icc|world cup|champions trophy|wtc|world test championship|rankings?|t20 world cup)\b/i.test(combined)) {
    return 'ICC';
  }
  if (/(transfer|auction|signed|retained|released|trade|squad|draft|captain)/i.test(combined)) {
    return 'Transfer';
  }
  if (/\b(ranji|psl|ipl|bbl|cpl|sa20|ilt20|county|vitality blast|sheffield shield|domestic|quaid-e-azam|super smash)\b/i.test(combined)) {
    return 'Domestic';
  }
  if (/\b(bilateral|tour of|odi|t20i|test match|international|series)\b/i.test(combined)) {
    return 'International';
  }
  if (/(beat|win|won|century|hundred|wicket|match|score|chase|final)/i.test(combined)) {
    return 'Match Update';
  }
  return 'General';
}

function sanitizeHttpImageUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  let trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('http://')) {
    trimmed = `https://${trimmed.slice(7)}`;
  }
  if (trimmed.startsWith('https://')) {
    // Skip generic tiny google news icons
    if (trimmed.includes('lh3.googleusercontent.com/J6_coFbogxhRI9iM864NL_liGXvsQp2AupsKei7z0cNNfDvGUmWUy20nuUhkREQyrpY4bEeIBuc')) {
      return undefined;
    }
    return trimmed.slice(0, 1900);
  }
  return undefined;
}

function formatDateIso(rawDate: string): string {
  if (!rawDate) return new Date().toISOString().slice(0, 10);
  const parsed = Date.parse(rawDate);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function stripHtmlSummary(rawHtml: string, fallbackTitle: string): string {
  if (!rawHtml) return fallbackTitle;
  try {
    const $ = load(rawHtml);
    const clean = $.text().replace(/\s+/g, ' ').trim();
    if (!clean) return fallbackTitle;
    return clean.slice(0, 420);
  } catch {
    return rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 420) || fallbackTitle;
  }
}

async function fetchRssXml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LiveCricketHD/2.0; +https://livecricket.app)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*'
      },
      signal: AbortSignal.timeout(5500)
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function buildSourceUrls(source: CricketNewsSource, query: string): Array<{ url: string; sourceName: string }> {
  const cleanQuery = query.trim().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  const gNewsSearch = cleanQuery
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(`cricket ${cleanQuery}`)}&hl=en-US&gl=US&ceid=US:en`
    : 'https://news.google.com/rss/search?q=cricket+when:3d&hl=en-US&gl=US&ceid=US:en';

  const espn = {
    url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',
    sourceName: 'ESPNcricinfo'
  };
  const bbc = {
    url: 'https://feeds.bbci.co.uk/sport/cricket/rss.xml',
    sourceName: 'BBC Sport Cricket'
  };
  const gnews = {
    url: gNewsSearch,
    sourceName: cleanQuery ? `Cricket News (${cleanQuery})` : 'Google News Cricket'
  };

  if (source === 'espncricinfo') return [espn];
  if (source === 'bbc') return [bbc];
  if (source === 'googlenews') return [gnews];
  return [espn, bbc, gnews];
}

function parseRssFeedItems(
  xml: string,
  sourceName: string,
  matchers: PlayerMatchEntry[]
): FetchedCricketNewsItem[] {
  const results: FetchedCricketNewsItem[] = [];
  const $ = load(xml, { xmlMode: true });

  $('item').each((idx, el) => {
    if (results.length >= 16) return false;
    const item = $(el);
    const title = item.find('title').first().text().replace(/\s+/g, ' ').trim();
    if (!title) return;

    const rawDesc =
      item.find('description').first().text() ||
      item.find('content\\:encoded').first().text() ||
      '';
    const description = stripHtmlSummary(rawDesc, title);
    const pubDate = item.find('pubDate').first().text() || item.find('dc\\:date').first().text() || '';
    const articleUrl = item.find('link').first().text().trim();

    // Extract article image from RSS media tags, enclosure, or HTML img inside description
    let rawArticleImg =
      item.find('media\\:content').attr('url') ||
      item.find('media\\:thumbnail').attr('url') ||
      item.find('enclosure[type^="image"]').attr('url') ||
      item.find('enclosure').attr('url') ||
      '';

    if (!rawArticleImg && rawDesc.includes('<img')) {
      try {
        const $desc = load(rawDesc);
        rawArticleImg = $desc('img').first().attr('src') || '';
      } catch {}
    }

    const articleImageUrl = sanitizeHttpImageUrl(rawArticleImg);
    const combinedText = `${title} ${description}`;
    const matchedPlayer = detectPlayerInText(combinedText, matchers);
    const detectedTeam = matchedPlayer?.teamCode || detectTeamCodeInText(combinedText) || undefined;

    const playerImageUrl = matchedPlayer
      ? `/api/player/photo?name=${encodeURIComponent(matchedPlayer.name)}&team=${encodeURIComponent(matchedPlayer.teamCode)}`
      : undefined;

    const teamFallbackUrl = detectedTeam
      ? `/api/team/flag/${encodeURIComponent(detectedTeam)}`
      : undefined;

    const recommendedImageUrl = playerImageUrl || articleImageUrl || teamFallbackUrl || '';
    const slugHash = crypto
      .createHash('sha256')
      .update(`${sourceName}|${articleUrl || title}|${idx}`)
      .digest('hex')
      .slice(0, 16);

    results.push({
      id: `rss_${slugHash}`,
      title: title.slice(0, 200),
      description: description.slice(0, 1200),
      date: formatDateIso(pubDate),
      sourceName,
      articleUrl,
      articleImageUrl,
      playerImageUrl,
      matchedPlayerName: matchedPlayer?.name,
      matchedTeamCode: detectedTeam,
      recommendedImageUrl,
      suggestedCategory: inferCategory(title, description)
    });
  });

  return results;
}

class CricketNewsService {
  private settings: CricketNewsSettings = { ...DEFAULT_SETTINGS };
  private adminNews: NewsItem[] = [];

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      fsSync.mkdirSync(DATA_DIR, { recursive: true });
      if (fsSync.existsSync(SETTINGS_FILE)) {
        const raw = JSON.parse(fsSync.readFileSync(SETTINGS_FILE, 'utf-8'));
        this.settings = {
          autoSyncEnabled: raw.autoSyncEnabled !== undefined ? Boolean(raw.autoSyncEnabled) : true,
          source: ['all', 'espncricinfo', 'bbc', 'googlenews'].includes(raw.source) ? raw.source : 'all',
          query: typeof raw.query === 'string' ? raw.query.slice(0, 60) : '',
          maxItems:
            typeof raw.maxItems === 'number' && Number.isFinite(raw.maxItems)
              ? Math.max(2, Math.min(12, Math.round(raw.maxItems)))
              : 6,
          preferPlayerImage: raw.preferPlayerImage !== undefined ? Boolean(raw.preferPlayerImage) : true,
          updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
        };
      }
      if (fsSync.existsSync(ADMIN_NEWS_FILE)) {
        const rawNews = JSON.parse(fsSync.readFileSync(ADMIN_NEWS_FILE, 'utf-8'));
        if (Array.isArray(rawNews)) {
          this.adminNews = rawNews;
        }
      }
    } catch (err) {
      console.warn('[CricketNewsService] Could not load persisted state:', err);
    }
  }

  private async persistSettings() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[CricketNewsService] Failed saving settings:', err);
    }
  }

  private async persistAdminNews() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(ADMIN_NEWS_FILE, JSON.stringify(this.adminNews, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[CricketNewsService] Failed saving admin news:', err);
    }
  }

  getSettings(): CricketNewsSettings {
    return { ...this.settings };
  }

  async updateSettings(patch: Partial<CricketNewsSettings>): Promise<CricketNewsSettings> {
    this.settings = {
      autoSyncEnabled:
        patch.autoSyncEnabled !== undefined ? Boolean(patch.autoSyncEnabled) : this.settings.autoSyncEnabled,
      source:
        patch.source && ['all', 'espncricinfo', 'bbc', 'googlenews'].includes(patch.source)
          ? patch.source
          : this.settings.source,
      query: typeof patch.query === 'string' ? patch.query.trim().slice(0, 60) : this.settings.query,
      maxItems:
        typeof patch.maxItems === 'number' && Number.isFinite(patch.maxItems)
          ? Math.max(2, Math.min(12, Math.round(patch.maxItems)))
          : this.settings.maxItems,
      preferPlayerImage:
        patch.preferPlayerImage !== undefined
          ? Boolean(patch.preferPlayerImage)
          : this.settings.preferPlayerImage,
      updatedAt: Date.now()
    };
    feedCache.clear();
    await this.persistSettings();
    return this.getSettings();
  }

  getAdminNews(): NewsItem[] {
    return [...this.adminNews].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.isBreaking !== b.isBreaking) return a.isBreaking ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }

  async upsertAdminNews(item: NewsItem): Promise<NewsItem[]> {
    const resolvedFeatured =
      typeof item.featuredImageUrl === 'string' && item.featuredImageUrl.trim()
        ? item.featuredImageUrl.trim().slice(0, 2000)
        : typeof item.imageUrl === 'string'
        ? item.imageUrl.trim().slice(0, 2000)
        : '';
    const resolvedBody =
      typeof item.body === 'string' && item.body.trim()
        ? item.body.trim().slice(0, 50000)
        : String(item.description || '').trim().slice(0, 50000);
    const resolvedDesc =
      String(item.description || '').trim().slice(0, 1200) ||
      (resolvedBody.length > 320 ? `${resolvedBody.slice(0, 317).trim()}...` : resolvedBody);

    const cleanItem: NewsItem = {
      id: String(item.id || `news_${Date.now()}`).slice(0, 128),
      title: String(item.title || '').trim().slice(0, 200),
      description: resolvedDesc,
      body: resolvedBody,
      imageUrl: resolvedFeatured,
      featuredImageUrl: resolvedFeatured,
      date: String(item.date || new Date().toISOString().slice(0, 10)).slice(0, 40),
      category: [
        'Domestic',
        'International',
        'ICC',
        'Match Update',
        'Breaking',
        'Transfer',
        'General'
      ].includes(item.category)
        ? item.category
        : 'General',
      pinned: Boolean(item.pinned),
      isBreaking: Boolean(item.isBreaking),
      createdAt: item.createdAt || Date.now(),
      updatedAt: item.updatedAt || Date.now(),
      authorUid: item.authorUid
    };

    const idx = this.adminNews.findIndex((n) => n.id === cleanItem.id);
    if (idx >= 0) {
      this.adminNews[idx] = cleanItem;
    } else {
      this.adminNews.unshift(cleanItem);
    }
    this.adminNews = this.adminNews.slice(0, 80);
    await this.persistAdminNews();
    return this.getAdminNews();
  }

  async deleteAdminNews(id: string): Promise<NewsItem[]> {
    this.adminNews = this.adminNews.filter((n) => n.id !== id);
    await this.persistAdminNews();
    return this.getAdminNews();
  }

  async fetchCricketNewsFeed(options?: {
    source?: CricketNewsSource;
    query?: string;
    limit?: number;
    preferPlayerImage?: boolean;
    forceRefresh?: boolean;
  }): Promise<FetchedCricketNewsItem[]> {
    const source = options?.source && ['all', 'espncricinfo', 'bbc', 'googlenews'].includes(options.source)
      ? options.source
      : this.settings.source;
    const query = typeof options?.query === 'string' ? options.query.trim().slice(0, 60) : this.settings.query;
    const limit = Math.max(1, Math.min(18, options?.limit || this.settings.maxItems || 8));
    const preferPlayerImage =
      options?.preferPlayerImage !== undefined ? options.preferPlayerImage : this.settings.preferPlayerImage;

    const cacheKey = `${source}|${query.toLowerCase()}|${preferPlayerImage}`;
    const cached = feedCache.get(cacheKey);
    if (!options?.forceRefresh && cached && Date.now() - cached.fetchedAt < FEED_CACHE_TTL_MS) {
      return cached.items.slice(0, limit);
    }

    const targets = buildSourceUrls(source, query);
    const matchers = buildPlayerMatchers();

    const xmlResults = await Promise.all(
      targets.map(async (t) => {
        const xml = await fetchRssXml(t.url);
        if (!xml) return [];
        return parseRssFeedItems(xml, t.sourceName, matchers);
      })
    );

    const seenTitles = new Set<string>();
    const seenIds = new Set<string>();
    let combined: FetchedCricketNewsItem[] = [];

    for (const list of xmlResults) {
      for (const item of list) {
        const normTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48);
        if (!normTitle || seenTitles.has(normTitle) || seenIds.has(item.id)) continue;
        seenTitles.add(normTitle);
        seenIds.add(item.id);

        // Optional keyword filter when querying ESPN/BBC feeds
        if (query && source !== 'googlenews') {
          const qLower = query.toLowerCase();
          const haystack = `${item.title} ${item.description} ${item.matchedPlayerName || ''}`.toLowerCase();
          if (!haystack.includes(qLower)) continue;
        }

        const recommendedImageUrl = preferPlayerImage
          ? item.playerImageUrl || item.articleImageUrl || (item.matchedTeamCode ? `/api/team/flag/${encodeURIComponent(item.matchedTeamCode)}` : '')
          : item.articleImageUrl || item.playerImageUrl || (item.matchedTeamCode ? `/api/team/flag/${encodeURIComponent(item.matchedTeamCode)}` : '');

        combined.push({
          ...item,
          recommendedImageUrl
        });
      }
    }

    // Prioritize articles that matched a cricket player photo or article image, and newest date
    combined.sort((a, b) => {
      const aScore = (a.playerImageUrl ? 2 : a.articleImageUrl ? 1 : 0);
      const bScore = (b.playerImageUrl ? 2 : b.articleImageUrl ? 1 : 0);
      if (bScore !== aScore && b.date === a.date) return bScore - aScore;
      return b.date.localeCompare(a.date);
    });

    feedCache.set(cacheKey, { fetchedAt: Date.now(), items: combined });
    return combined.slice(0, limit);
  }
}

export const cricketNewsService = new CricketNewsService();
