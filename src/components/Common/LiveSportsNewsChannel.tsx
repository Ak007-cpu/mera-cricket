import React, { useEffect, useMemo, useState } from 'react';
import { useContent } from '../../context/ContentContext';
import { buildApiUrl, fetchPublicCricketNewsFeed } from '../../services/api';
import { FetchedCricketNewsItem, MatchState, NewsCategory } from '../../types/cricket';
import { ChevronLeft, ChevronRight, Gauge, Newspaper, Pause, Play, Radio } from 'lucide-react';

export type AutoScrollSpeed = 'slow' | 'normal' | 'fast' | 'off' | boolean | number;

export interface LiveSportsNewsChannelProps {
  compact?: boolean;
  fullScreen?: boolean;
  rotateIntervalMs?: number;
  mode?: 'channel' | 'marquee';
  tickerFeedUrl?: string;
  'ticker-feed'?: string;
  autoScroll?: AutoScrollSpeed;
  'auto-scroll'?: AutoScrollSpeed;
  match?: MatchState | null;
  onOpenNews?: () => void;
}

const SPEED_DURATION_SEC: Record<'slow' | 'normal' | 'fast', number> = {
  slow: 44,
  normal: 30,
  fast: 18
};

function parseAutoScrollSpeed(raw?: AutoScrollSpeed): {
  enabled: boolean;
  preset: 'slow' | 'normal' | 'fast';
  durationSec: number;
} {
  if (raw === false || raw === 'off') {
    return { enabled: false, preset: 'normal', durationSec: SPEED_DURATION_SEC.normal };
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    const clamped = Math.max(8, Math.min(120, Math.round(raw)));
    const preset = clamped >= 38 ? 'slow' : clamped <= 22 ? 'fast' : 'normal';
    return { enabled: true, preset, durationSec: clamped };
  }
  if (raw === 'slow') {
    return { enabled: true, preset: 'slow', durationSec: SPEED_DURATION_SEC.slow };
  }
  if (raw === 'fast') {
    return { enabled: true, preset: 'fast', durationSec: SPEED_DURATION_SEC.fast };
  }
  return { enabled: true, preset: 'normal', durationSec: SPEED_DURATION_SEC.normal };
}

function readAutoScrollFromUrl(): AutoScrollSpeed | undefined {
  if (typeof window === 'undefined') return undefined;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('auto-scroll') ?? params.get('autoScroll') ?? params.get('scrollSpeed');
  if (!raw) return undefined;
  const lower = raw.trim().toLowerCase();
  if (lower === 'off' || lower === 'false' || lower === '0') return false;
  if (lower === 'slow' || lower === 'normal' || lower === 'fast') return lower;
  const num = Number(lower);
  if (Number.isFinite(num) && num > 0) return num;
  return undefined;
}

interface NewsSlide {
  id: string;
  title: string;
  summary: string;
  imageUrl: string;
  category: NewsCategory;
  source: string;
  date: string;
  isBreaking: boolean;
  playerTag?: string;
}

function resolveSlideImageUrl(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/api/')) return buildApiUrl(trimmed);
  return trimmed;
}

function normalizeCategory(raw?: unknown): NewsCategory {
  const val = typeof raw === 'string' ? raw.trim() : '';
  if (
    val === 'Domestic' ||
    val === 'International' ||
    val === 'ICC' ||
    val === 'Breaking' ||
    val === 'Match Update' ||
    val === 'Transfer' ||
    val === 'General'
  ) {
    return val;
  }
  if (/icc/i.test(val)) return 'ICC';
  if (/domestic/i.test(val)) return 'Domestic';
  if (/international/i.test(val)) return 'International';
  if (/break/i.test(val)) return 'Breaking';
  if (/transfer|squad|auction|draft/i.test(val)) return 'Transfer';
  return 'Match Update';
}

function stripHtmlTags(raw: string): string {
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeRawFeedArray(rawList: unknown[], fallbackSource = 'Cricket Wire'): FetchedCricketNewsItem[] {
  const out: FetchedCricketNewsItem[] = [];
  rawList.forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const obj = entry as Record<string, unknown>;
    const title = typeof obj.title === 'string' ? stripHtmlTags(obj.title) : '';
    if (!title) return;

    const descriptionRaw =
      typeof obj.description === 'string'
        ? obj.description
        : typeof obj.summary === 'string'
        ? obj.summary
        : typeof obj.body === 'string'
        ? obj.body
        : '';
    const description = stripHtmlTags(descriptionRaw).slice(0, 320);

    const id =
      typeof obj.id === 'string' && obj.id.trim()
        ? obj.id.trim()
        : `ticker_${idx}_${title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`;

    const sourceName =
      typeof obj.sourceName === 'string' && obj.sourceName.trim()
        ? obj.sourceName.trim()
        : typeof obj.source === 'string' && obj.source.trim()
        ? obj.source.trim()
        : fallbackSource;

    const date =
      typeof obj.date === 'string' && obj.date.trim()
        ? obj.date.trim()
        : typeof obj.publishedAt === 'string' && obj.publishedAt.trim()
        ? obj.publishedAt.trim().slice(0, 10)
        : '';

    const articleImageUrl =
      typeof obj.recommendedImageUrl === 'string' && obj.recommendedImageUrl.trim()
        ? obj.recommendedImageUrl.trim()
        : typeof obj.featuredImageUrl === 'string' && obj.featuredImageUrl.trim()
        ? obj.featuredImageUrl.trim()
        : typeof obj.imageUrl === 'string' && obj.imageUrl.trim()
        ? obj.imageUrl.trim()
        : typeof obj.articleImageUrl === 'string' && obj.articleImageUrl.trim()
        ? obj.articleImageUrl.trim()
        : '';

    out.push({
      id,
      title,
      description,
      articleUrl:
        typeof obj.articleUrl === 'string'
          ? obj.articleUrl
          : typeof obj.link === 'string'
          ? obj.link
          : '',
      date,
      sourceName,
      articleImageUrl,
      playerImageUrl: typeof obj.playerImageUrl === 'string' ? obj.playerImageUrl : '',
      recommendedImageUrl: articleImageUrl,
      matchedPlayerName: typeof obj.matchedPlayerName === 'string' ? obj.matchedPlayerName : undefined,
      matchedTeamCode: typeof obj.matchedTeamCode === 'string' ? obj.matchedTeamCode : undefined,
      suggestedCategory: obj.isBreaking
        ? 'Breaking'
        : normalizeCategory(obj.suggestedCategory ?? obj.category)
    });
  });
  return out;
}

function parseXmlFeed(xmlText: string): FetchedCricketNewsItem[] {
  if (typeof DOMParser === 'undefined') return [];
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const channelTitle = doc.querySelector('channel > title, feed > title')?.textContent?.trim() || 'Cricket Wire';
    const nodes = Array.from(doc.querySelectorAll('item, entry'));
    const out: FetchedCricketNewsItem[] = [];

    nodes.slice(0, 20).forEach((node, idx) => {
      const title = stripHtmlTags(node.querySelector('title')?.textContent || '');
      if (!title) return;
      const descRaw =
        node.querySelector('description')?.textContent ||
        node.querySelector('summary')?.textContent ||
        node.querySelector('content')?.textContent ||
        '';
      const articleUrl =
        node.querySelector('link')?.getAttribute('href') ||
        node.querySelector('link')?.textContent?.trim() ||
        '';
      const pubDate =
        node.querySelector('pubDate')?.textContent?.trim() ||
        node.querySelector('updated')?.textContent?.trim() ||
        '';
      const category = node.querySelector('category')?.textContent?.trim() || '';

      out.push({
        id: `xml_${idx}_${title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`,
        title,
        description: stripHtmlTags(descRaw).slice(0, 320),
        articleUrl,
        date: pubDate ? pubDate.slice(0, 16) : '',
        sourceName: channelTitle,
        articleImageUrl: '',
        playerImageUrl: '',
        recommendedImageUrl: '',
        suggestedCategory: normalizeCategory(category)
      });
    });

    return out;
  } catch {
    return [];
  }
}

async function fetchTickerFeedFromUrl(feedUrl: string): Promise<FetchedCricketNewsItem[] | null> {
  const resolved = feedUrl.startsWith('/') ? buildApiUrl(feedUrl) : feedUrl;
  try {
    const res = await fetch(resolved, {
      headers: {
        Accept: 'application/json, application/rss+xml, application/xml, text/xml'
      }
    });
    if (!res.ok) return null;

    const rawText = await res.text();
    const trimmed = rawText.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const json = JSON.parse(trimmed) as unknown;
      if (Array.isArray(json)) {
        return normalizeRawFeedArray(json);
      }
      if (json && typeof json === 'object') {
        const record = json as Record<string, unknown>;
        if (Array.isArray(record.items)) {
          return normalizeRawFeedArray(record.items);
        }
        if (Array.isArray(record.news)) {
          return normalizeRawFeedArray(record.news, 'Official Sports Desk');
        }
        if (Array.isArray(record.articles)) {
          return normalizeRawFeedArray(record.articles);
        }
        if (Array.isArray(record.data)) {
          return normalizeRawFeedArray(record.data);
        }
      }
      return [];
    }

    if (trimmed.startsWith('<')) {
      return parseXmlFeed(trimmed);
    }

    return [];
  } catch {
    return null;
  }
}

export const LiveSportsNewsChannel: React.FC<LiveSportsNewsChannelProps> = ({
  compact = false,
  fullScreen = false,
  rotateIntervalMs = 8000,
  mode = 'channel',
  tickerFeedUrl,
  'ticker-feed': tickerFeedAttr,
  autoScroll,
  'auto-scroll': autoScrollAttr,
  match = null,
  onOpenNews
}) => {
  const { news } = useContent();
  const [feedItems, setFeedItems] = useState<FetchedCricketNewsItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [isMarqueePaused, setIsMarqueePaused] = useState(false);

  const effectiveAutoScrollProp = autoScroll ?? autoScrollAttr ?? (fullScreen ? readAutoScrollFromUrl() : undefined);
  const parsedSpeed = useMemo(
    () => parseAutoScrollSpeed(effectiveAutoScrollProp),
    [effectiveAutoScrollProp]
  );
  const [scrollDurationSec, setScrollDurationSec] = useState<number>(parsedSpeed.durationSec);
  const [scrollPreset, setScrollPreset] = useState<'slow' | 'normal' | 'fast'>(parsedSpeed.preset);

  useEffect(() => {
    setScrollDurationSec(parsedSpeed.durationSec);
    setScrollPreset(parsedSpeed.preset);
    setIsMarqueePaused(!parsedSpeed.enabled);
  }, [parsedSpeed.durationSec, parsedSpeed.preset, parsedSpeed.enabled]);

  const handleCycleScrollSpeed = () => {
    const order: Array<'slow' | 'normal' | 'fast'> = ['slow', 'normal', 'fast'];
    const nextPreset = order[(order.indexOf(scrollPreset) + 1) % order.length];
    setScrollPreset(nextPreset);
    setScrollDurationSec(SPEED_DURATION_SEC[nextPreset]);
    if (isMarqueePaused) {
      setIsMarqueePaused(false);
    }
  };

  const resolvedTickerFeedUrl = (tickerFeedUrl || tickerFeedAttr || '').trim();

  useEffect(() => {
    let mounted = true;

    const loadFeed = async () => {
      if (resolvedTickerFeedUrl) {
        const customItems = await fetchTickerFeedFromUrl(resolvedTickerFeedUrl);
        if (!mounted) return;
        if (customItems && customItems.length > 0) {
          setFeedItems(customItems);
          return;
        }
        if (customItems !== null && resolvedTickerFeedUrl === '/api/news/cricket-feed') {
          setFeedItems(customItems);
          return;
        }
      }

      try {
        const res = await fetchPublicCricketNewsFeed();
        if (!mounted) return;
        setFeedItems(res.items || []);
      } catch {
        // ignore transient network errors
      }
    };

    loadFeed();
    const refreshTimer = setInterval(loadFeed, 120_000);
    return () => {
      mounted = false;
      clearInterval(refreshTimer);
    };
  }, [resolvedTickerFeedUrl]);

  const slides = useMemo<NewsSlide[]>(() => {
    const list: NewsSlide[] = [];
    const seenTitles = new Set<string>();
    const seenIds = new Set<string>();

    for (const item of news) {
      const norm = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48);
      if (!norm || seenTitles.has(norm) || seenIds.has(item.id)) continue;
      seenTitles.add(norm);
      seenIds.add(item.id);
      list.push({
        id: item.id,
        title: item.title,
        summary: item.description || item.body || '',
        imageUrl: resolveSlideImageUrl(item.featuredImageUrl || item.imageUrl),
        category: item.category || 'Match Update',
        source: 'Official Sports Desk',
        date: item.date || '',
        isBreaking: Boolean(item.isBreaking)
      });
    }

    for (const f of feedItems) {
      const norm = f.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48);
      if (!norm || seenTitles.has(norm) || seenIds.has(f.id)) continue;
      seenTitles.add(norm);
      seenIds.add(f.id);
      list.push({
        id: f.id,
        title: f.title,
        summary: f.description,
        imageUrl: resolveSlideImageUrl(f.recommendedImageUrl || f.playerImageUrl || f.articleImageUrl),
        category: f.suggestedCategory || 'Match Update',
        source: f.sourceName || 'Cricket Wire',
        date: f.date || '',
        isBreaking: f.suggestedCategory === 'Breaking',
        playerTag: f.matchedPlayerName
          ? `${f.matchedPlayerName}${f.matchedTeamCode ? ` (${f.matchedTeamCode})` : ''}`
          : undefined
      });
    }

    return list.slice(0, 12);
  }, [news, feedItems]);

  useEffect(() => {
    if (activeIndex >= slides.length && slides.length > 0) {
      setActiveIndex(0);
    }
  }, [slides.length, activeIndex]);

  useEffect(() => {
    if (mode !== 'channel' || slides.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, rotateIntervalMs);
    return () => clearInterval(timer);
  }, [mode, slides.length, rotateIntervalMs]);

  const currentSlide = slides[activeIndex] || null;
  const tickerText = useMemo(() => {
    if (slides.length === 0) return 'LIVE CRICKET SPORTS NEWS DESK • STAY TUNED FOR LATEST MATCH UPDATES & HEADLINES';
    return slides
      .map((s) => `${s.isBreaking ? '[BREAKING] ' : ''}${s.title}`)
      .join('   •   ');
  }, [slides]);

  if (mode === 'marquee') {
    const scoreSummary = match
      ? `${match.battingTeam.shortName || match.battingTeam.code} ${match.battingTeam.score.runs}/${
          match.battingTeam.score.wickets
        } (${match.battingTeam.score.overs}.${match.battingTeam.score.balls})`
      : '';

    const renderMarqueeTrack = (isDuplicate: boolean) => (
      <div
        className="flex items-center shrink-0"
        aria-hidden={isDuplicate ? 'true' : undefined}
      >
        {slides.length > 0 ? (
          slides.map((slide) => {
            const tagColor = slide.isBreaking
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-sky-700 dark:text-sky-300';
            const label = slide.isBreaking ? 'Breaking' : slide.source;

            const itemBody = (
              <span className="inline-flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap">
                <span className={`font-bold uppercase tracking-wider text-[11px] ${tagColor}`}>
                  {label}
                </span>
                <span className="text-slate-900 dark:text-slate-100 font-semibold">
                  {slide.title}
                </span>
                <span className="text-slate-400 dark:text-slate-600 px-2.5" aria-hidden="true">
                  ·
                </span>
              </span>
            );

            if (onOpenNews && !isDuplicate) {
              return (
                <a
                  key={`${slide.id}_marquee_main`}
                  href="?page=news"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenNews();
                  }}
                  className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  {itemBody}
                </a>
              );
            }

            return (
              <React.Fragment key={`${slide.id}_marquee_${isDuplicate ? 'dup' : 'main'}`}>
                {itemBody}
              </React.Fragment>
            );
          })
        ) : (
          <span className="inline-flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap">
            <span className="font-bold uppercase tracking-wider text-[11px] text-sky-700 dark:text-sky-300">
              Cricket Wire
            </span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">
              Live cricket news updates and match stories stream here automatically
            </span>
            <span className="text-slate-400 dark:text-slate-600 px-3" aria-hidden="true">
              ·
            </span>
          </span>
        )}
      </div>
    );

    return (
      <section
        aria-label="Live Cricket News Marquee"
        className="max-w-[1440px] mx-auto w-full shrink-0"
      >
        <div className="h-9 sm:h-10 flex items-center overflow-hidden rounded-xl bg-white dark:bg-[#071127]/95 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 shadow-sm dark:shadow-lg">
          {/* Left News Wire Cue */}
          <div className="h-full px-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider shrink-0 bg-sky-700 dark:bg-sky-600 text-white border-r border-slate-300 dark:border-slate-700/80">
            <Newspaper className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Cricket News</span>
          </div>

          {/* Optional Compact Live Score Anchor Alongside News */}
          {scoreSummary && (
            <div className="hidden sm:flex h-full px-3 items-center gap-1.5 border-r border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/75 font-score tabular-nums text-xs font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
              <span>{scoreSummary}</span>
            </div>
          )}

          {/* Scrolling News Marquee */}
          <div className="relative flex-1 overflow-hidden h-full flex items-center">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-white dark:from-[#071127] to-transparent z-10" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-white dark:from-[#071127] to-transparent z-10" />

            <div
              className={`flex w-max items-center ${
                parsedSpeed.enabled ? 'animate-ticker-marquee' : ''
              } ${isMarqueePaused ? 'ticker-paused' : ''}`}
              style={parsedSpeed.enabled ? { animationDuration: `${scrollDurationSec}s` } : undefined}
            >
              {renderMarqueeTrack(false)}
              {renderMarqueeTrack(true)}
            </div>
          </div>

          {/* Scroll Speed Selector (Slow / Normal / Fast for OBS legibility) */}
          {parsedSpeed.enabled && (
            <button
              type="button"
              onClick={handleCycleScrollSpeed}
              aria-label={`Marquee scroll speed: ${scrollPreset}. Click to change speed`}
              title={`Scroll speed: ${scrollPreset.toUpperCase()} (${scrollDurationSec}s loop) — Click to adjust`}
              className="h-full px-2.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-sky-700 dark:hover:text-sky-300 border-l border-slate-300 dark:border-slate-700/80 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Gauge className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{scrollPreset}</span>
            </button>
          )}

          {/* Accessible Pause / Resume Control */}
          <button
            type="button"
            onClick={() => setIsMarqueePaused((prev) => !prev)}
            aria-pressed={isMarqueePaused}
            aria-label={isMarqueePaused ? 'Resume cricket news marquee' : 'Pause cricket news marquee'}
            title={isMarqueePaused ? 'Resume news marquee' : 'Pause news marquee'}
            className="h-full px-3 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border-l border-slate-300 dark:border-slate-700/80 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            {isMarqueePaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        </div>
      </section>
    );
  }

  const content = (
    <div className="relative w-full h-full bg-gradient-to-br from-[#061126] via-[#091734] to-[#040814] text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Top Broadcast Sports News Header */}
      <div
        className={`flex items-center justify-between gap-2 border-b border-sky-400/20 bg-slate-950/75 shrink-0 ${
          compact ? 'px-2.5 py-1.5' : 'px-3.5 py-2'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-600 text-white font-score text-[10px] font-black uppercase tracking-wider shrink-0 shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <span>SPORTS NEWS</span>
          </span>
          <span className="text-[11px] font-bold text-sky-300 truncate">
            {currentSlide ? currentSlide.source : 'Cricket News Desk'}
          </span>
        </div>

        {slides.length > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length)}
              aria-label="Previous news"
              className="pointer-events-auto p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="font-score text-[10px] font-bold text-slate-300 px-1 tabular-nums">
              {activeIndex + 1}/{slides.length}
            </span>
            <button
              type="button"
              onClick={() => setActiveIndex((prev) => (prev + 1) % slides.length)}
              aria-label="Next news"
              className="pointer-events-auto p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Main Story Stage */}
      <div className={`flex-1 min-h-0 flex items-center ${compact ? 'p-2.5 gap-2.5' : 'p-4 sm:p-5 gap-4'}`}>
        {currentSlide ? (
          <>
            {/* Story Featured / Player Image */}
            <div
              className={`rounded-xl overflow-hidden bg-slate-900 border border-sky-400/25 shrink-0 flex items-center justify-center relative ${
                fullScreen
                  ? 'w-32 h-32 sm:w-44 sm:h-44'
                  : compact
                  ? 'w-20 h-24 sm:w-24 sm:h-28'
                  : 'w-28 h-28 sm:w-32 sm:h-32'
              }`}
            >
              {currentSlide.imageUrl && !failedImages[currentSlide.id] ? (
                <img
                  src={currentSlide.imageUrl}
                  alt={currentSlide.playerTag || currentSlide.title}
                  referrerPolicy="no-referrer"
                  onError={() => setFailedImages((prev) => ({ ...prev, [currentSlide.id]: true }))}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <Newspaper className="w-7 h-7 text-sky-400/60" />
              )}
            </div>

            {/* Headline & Summary */}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center flex-wrap gap-1.5 text-[10px]">
                <span
                  className={`px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                    currentSlide.isBreaking
                      ? 'bg-rose-500/25 border border-rose-400/50 text-rose-200'
                      : 'bg-sky-500/20 border border-sky-400/40 text-sky-200'
                  }`}
                >
                  {currentSlide.isBreaking ? 'Breaking' : currentSlide.category}
                </span>
                {currentSlide.playerTag && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 font-bold truncate max-w-[140px]">
                    {currentSlide.playerTag}
                  </span>
                )}
                {currentSlide.date && (
                  <span className="text-slate-400 font-mono">{currentSlide.date}</span>
                )}
              </div>

              <h3
                className={`font-black text-white leading-snug ${
                  fullScreen
                    ? 'text-lg sm:text-2xl line-clamp-3'
                    : compact
                    ? 'text-xs sm:text-sm line-clamp-2'
                    : 'text-sm sm:text-base line-clamp-2'
                }`}
              >
                {currentSlide.title}
              </h3>

              {currentSlide.summary && (
                <p
                  className={`text-slate-300 leading-relaxed ${
                    fullScreen
                      ? 'text-xs sm:text-sm line-clamp-4'
                      : compact
                      ? 'text-[11px] line-clamp-2'
                      : 'text-xs line-clamp-3'
                  }`}
                >
                  {currentSlide.summary}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="w-full text-center space-y-2 py-4">
            <Radio className="w-7 h-7 text-sky-400 mx-auto animate-pulse" />
            <div className="text-xs sm:text-sm font-black text-white">
              Loading Live Cricket Sports News...
            </div>
            <p className="text-[11px] text-slate-400">
              Latest match headlines, breaking updates, and cricket stories appear here automatically.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Live Sports News Ticker */}
      <div className="bg-amber-400 text-slate-950 flex items-center overflow-hidden shrink-0 border-t border-amber-300">
        <span className="px-2 py-1 bg-slate-950 text-amber-300 font-score text-[10px] font-black uppercase tracking-wider shrink-0">
          CRICKET WIRE
        </span>
        <div className="relative flex-1 overflow-hidden py-1 px-2">
          <div
            className={`flex w-max whitespace-nowrap text-[11px] font-extrabold ${
              parsedSpeed.enabled ? 'animate-ticker-marquee' : ''
            } ${isMarqueePaused ? 'ticker-paused' : ''}`}
            style={parsedSpeed.enabled ? { animationDuration: `${scrollDurationSec}s` } : undefined}
          >
            <span className="pr-10">{tickerText}</span>
            <span className="pr-10" aria-hidden="true">
              {tickerText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen w-full bg-[#040814] flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden border border-sky-400/30 shadow-2xl">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
