import React, { useEffect, useMemo, useState } from 'react';
import { Gauge, Pause, Play, Radio } from 'lucide-react';
import {
  AiNewsBulletin,
  AiNewsStudioConfig,
  AiNewsStudioState
} from '../../types/cricket';
import { buildApiUrl, fetchAiNewsStudioState } from '../../services/api';

export interface ScrollingNewsTickerProps {
  /** Shared AI News Studio state when already subscribed in parent (avoids duplicate fetch) */
  studioState?: AiNewsStudioState | null;
  /** Optional preview config override (used inside StudioAdmin live preview) */
  previewConfigOverride?: Partial<AiNewsStudioConfig> | null;
  /** Optional click handler to navigate to the full News page */
  onOpenNews?: () => void;
  /** Optional flag for preview contexts to always render even when disabled */
  forceShowInPreview?: boolean;
}

interface TickerEntry {
  id: string;
  tag: string;
  isBreaking: boolean;
  isManual: boolean;
  englishText: string;
  urduText?: string;
  sourceName?: string;
}

const SPEED_DURATIONS_SEC: Record<'slow' | 'normal' | 'fast', number> = {
  slow: 52,
  normal: 34,
  fast: 20
};

const URDU_CHAR_RE = /[\u0600-\u06FF]/;

function splitManualTickerLines(raw: string): string[] {
  return raw
    .split(/\r?\n|\||•/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

export const ScrollingNewsTicker: React.FC<ScrollingNewsTickerProps> = ({
  studioState: studioStateProp,
  previewConfigOverride = null,
  onOpenNews,
  forceShowInPreview = false
}) => {
  const [internalState, setInternalState] = useState<AiNewsStudioState | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [speedOverride, setSpeedOverride] = useState<'slow' | 'normal' | 'fast' | null>(null);

  const hasExternalState = studioStateProp !== undefined;

  // Keep synchronized with the AI News Studio data source (/api/news-studio/state + SSE)
  useEffect(() => {
    if (hasExternalState) return;
    let mounted = true;

    const loadInitial = async () => {
      const state = await fetchAiNewsStudioState();
      if (mounted && state) {
        setInternalState(state);
      }
    };
    loadInitial();

    let es: EventSource | null = null;
    try {
      es = new EventSource(buildApiUrl('/api/match/stream?view=broadcast'));
      es.addEventListener('ai_news_studio', (evt) => {
        try {
          const parsed = JSON.parse((evt as MessageEvent).data) as AiNewsStudioState;
          if (mounted && parsed && parsed.config) {
            setInternalState(parsed);
          }
        } catch {
          // ignore malformed SSE payload
        }
      });
    } catch {
      // ignore SSE setup errors in non-browser/restricted environments
    }

    const pollTimer = setInterval(loadInitial, 60_000);
    return () => {
      mounted = false;
      clearInterval(pollTimer);
      if (es) {
        try {
          es.close();
        } catch {}
      }
    };
  }, [hasExternalState]);

  const effectiveState = hasExternalState ? studioStateProp : internalState;

  const effectiveConfig = useMemo(() => {
    const base = effectiveState?.config;
    if (!base && !previewConfigOverride) return null;
    return {
      companyName: previewConfigOverride?.companyName ?? base?.companyName ?? 'DATA VAULT SPORTS HD',
      tickerSpeed: previewConfigOverride?.tickerSpeed ?? base?.tickerSpeed ?? 'normal',
      broadcastTickerEnabled:
        previewConfigOverride?.broadcastTickerEnabled ?? base?.broadcastTickerEnabled ?? true,
      broadcastTickerMode:
        previewConfigOverride?.broadcastTickerMode ?? base?.broadcastTickerMode ?? 'auto',
      broadcastTickerBreakingOnly:
        previewConfigOverride?.broadcastTickerBreakingOnly ?? base?.broadcastTickerBreakingOnly ?? true,
      broadcastTickerManualText:
        previewConfigOverride?.broadcastTickerManualText ?? base?.broadcastTickerManualText ?? '',
      broadcastCategoryFilter:
        previewConfigOverride?.broadcastCategoryFilter ?? base?.broadcastCategoryFilter ?? 'All'
    };
  }, [effectiveState?.config, previewConfigOverride]);

  const isVisible = effectiveConfig ? effectiveConfig.broadcastTickerEnabled : true;
  const effectiveSpeed: 'slow' | 'normal' | 'fast' =
    speedOverride || effectiveConfig?.tickerSpeed || 'normal';
  const durationSec = SPEED_DURATIONS_SEC[effectiveSpeed] || 34;

  const bulletins: AiNewsBulletin[] = effectiveState?.bulletins || [];

  const entries: TickerEntry[] = useMemo(() => {
    const mode = effectiveConfig?.broadcastTickerMode || 'auto';
    const breakingOnly = effectiveConfig?.broadcastTickerBreakingOnly ?? true;
    const manualText = (effectiveConfig?.broadcastTickerManualText || '').trim();
    const companyName = effectiveConfig?.companyName || 'DATA VAULT SPORTS HD';

    const manualEntries: TickerEntry[] = manualText
      ? splitManualTickerLines(manualText).map((line, idx) => {
          const isUrdu = URDU_CHAR_RE.test(line);
          return {
            id: `manual_${idx}`,
            tag: 'Breaking',
            isBreaking: true,
            isManual: true,
            englishText: isUrdu ? '' : line,
            urduText: isUrdu ? line : undefined,
            sourceName: companyName
          };
        })
      : [];

    const categoryFilter = effectiveConfig?.broadcastCategoryFilter || 'All';
    const rawBulletins =
      categoryFilter === 'All'
        ? bulletins
        : bulletins.filter((b) => b.editorialCategory === categoryFilter);
    const scopedBulletins = rawBulletins.length > 0 ? rawBulletins : bulletins;

    const breakingBulletins = scopedBulletins.filter((b) => b.isBreaking);
    const chosenBulletins = breakingOnly
      ? breakingBulletins.length > 0
        ? breakingBulletins
        : scopedBulletins.slice(0, 5)
      : [...breakingBulletins, ...scopedBulletins.filter((b) => !b.isBreaking)];

    const aiEntries: TickerEntry[] = chosenBulletins.map((b) => ({
      id: `ai_${b.id}`,
      tag: b.isBreaking ? 'Breaking' : b.editorialCategory || b.categoryLabel || 'Sports Desk',
      isBreaking: Boolean(b.isBreaking),
      isManual: false,
      englishText: (b.tickerEnglish || b.englishHeadline || '').trim(),
      urduText: (b.tickerUrdu || b.urduHeadline || '').trim() || undefined,
      sourceName: b.sources?.[0]?.name
    }));

    if (mode === 'manual') {
      if (manualEntries.length > 0) return manualEntries;
      return [
        {
          id: 'manual_empty_fallback',
          tag: 'News Desk',
          isBreaking: false,
          isManual: true,
          englishText: `${companyName} Breaking Wire Ready — Edit manual ticker text in Studio Admin`,
          sourceName: companyName
        }
      ];
    }

    if (mode === 'combined') {
      const combined = [...manualEntries, ...aiEntries];
      if (combined.length > 0) return combined;
    }

    if (aiEntries.length > 0) {
      return aiEntries;
    }

    if (manualEntries.length > 0) {
      return manualEntries;
    }

    return [
      {
        id: 'ai_standby',
        tag: 'News Desk',
        isBreaking: false,
        isManual: false,
        englishText: `${companyName} Verified Sports Wire — Latest breaking cricket & sports updates appear automatically`,
        urduText: `${companyName} — تازہ ترین تصدیق شدہ کرکٹ اور اسپورٹس خبریں`,
        sourceName: companyName
      }
    ];
  }, [
    bulletins,
    effectiveConfig?.broadcastTickerMode,
    effectiveConfig?.broadcastTickerBreakingOnly,
    effectiveConfig?.broadcastTickerManualText,
    effectiveConfig?.broadcastCategoryFilter,
    effectiveConfig?.companyName
  ]);

  if (!isVisible && !forceShowInPreview) {
    return null;
  }

  const hasBreaking = entries.some((entry) => entry.isBreaking);
  const companyCue = effectiveConfig?.companyName || 'DATA VAULT SPORTS HD';
  const modeCue =
    effectiveConfig?.broadcastTickerMode === 'manual'
      ? 'Studio Alert'
      : hasBreaking
      ? 'Breaking News'
      : 'AI News Desk';

  const handleCycleSpeed = () => {
    const order: Array<'slow' | 'normal' | 'fast'> = ['slow', 'normal', 'fast'];
    const next = order[(order.indexOf(effectiveSpeed) + 1) % order.length];
    setSpeedOverride(next);
    if (isPaused) setIsPaused(false);
  };

  const renderTrack = (isDuplicate: boolean) => (
    <div
      className="flex items-center shrink-0"
      aria-hidden={isDuplicate ? 'true' : undefined}
    >
      {entries.map((entry) => {
        const tagClass = entry.isBreaking
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-emerald-700 dark:text-emerald-300';

        const inner = (
          <span className="inline-flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap">
            <span className={`font-black uppercase tracking-wider text-[11px] ${tagClass}`}>
              {entry.tag}
            </span>

            {entry.englishText && (
              <span className="text-slate-900 dark:text-slate-100 font-semibold">
                {entry.englishText}
              </span>
            )}

            {entry.urduText && (
              <span
                dir="rtl"
                className="font-urdu text-slate-800 dark:text-amber-200 font-bold text-xs sm:text-[13px]"
              >
                {entry.urduText}
              </span>
            )}

            {entry.sourceName && !entry.isManual && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                [{entry.sourceName}]
              </span>
            )}

            <span className="text-slate-400 dark:text-slate-600 px-2.5" aria-hidden="true">
              •
            </span>
          </span>
        );

        if (!entry.isManual && onOpenNews && !isDuplicate && entry.id.startsWith('ai_nb_')) {
          return (
            <a
              key={`${entry.id}_${isDuplicate ? 'dup' : 'main'}`}
              href="?page=news"
              onClick={(e) => {
                e.preventDefault();
                onOpenNews();
              }}
              className="hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors focus-visible:outline-none focus-visible:underline"
            >
              {inner}
            </a>
          );
        }

        return (
          <React.Fragment key={`${entry.id}_${isDuplicate ? 'dup' : 'main'}`}>
            {inner}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <section
      aria-label="Scrolling Breaking News Ticker"
      className="max-w-[1440px] mx-auto w-full shrink-0"
    >
      <div
        className={`h-10 flex items-center overflow-hidden rounded-xl bg-white dark:bg-[#071127]/95 backdrop-blur-md border shadow-sm dark:shadow-lg ${
          !isVisible && forceShowInPreview
            ? 'border-amber-400/70 opacity-65'
            : hasBreaking
            ? 'border-rose-400/70 dark:border-rose-500/50'
            : 'border-slate-300 dark:border-slate-700/80'
        }`}
      >
        {/* Left Broadcast Breaking / Channel Cue */}
        <div
          className={`h-full px-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider shrink-0 border-r border-slate-300 dark:border-slate-700/80 ${
            hasBreaking
              ? 'bg-rose-600 text-white'
              : 'bg-emerald-700 dark:bg-emerald-600 text-white'
          }`}
        >
          {hasBreaking ? (
            <span className="w-2 h-2 rounded-full bg-white animate-live-dot shrink-0" />
          ) : (
            <Radio className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="whitespace-nowrap">{modeCue}</span>
          <span className="hidden md:inline text-[10px] font-bold opacity-85 border-l border-white/30 pl-2 whitespace-nowrap">
            {companyCue}
          </span>
        </div>

        {/* Continuous Horizontal Marquee Track */}
        <div className="relative flex-1 overflow-hidden h-full flex items-center">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-white dark:from-[#071127] to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-white dark:from-[#071127] to-transparent z-10" />

          <div
            className={`flex w-max items-center animate-ticker-marquee ${
              isPaused ? 'ticker-paused' : ''
            }`}
            style={{ animationDuration: `${durationSec}s` }}
          >
            {renderTrack(false)}
            {renderTrack(true)}
          </div>
        </div>

        {/* Speed Selector */}
        <button
          type="button"
          onClick={handleCycleSpeed}
          aria-label={`News ticker speed: ${effectiveSpeed}. Click to change speed`}
          title={`Ticker speed: ${effectiveSpeed.toUpperCase()} — Click to adjust`}
          className="h-full px-2.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 border-l border-slate-300 dark:border-slate-700/80 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <Gauge className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{effectiveSpeed}</span>
        </button>

        {/* Pause / Resume Toggle */}
        <button
          type="button"
          onClick={() => setIsPaused((prev) => !prev)}
          aria-pressed={isPaused}
          aria-label={isPaused ? 'Resume scrolling news ticker' : 'Pause scrolling news ticker'}
          title={isPaused ? 'Resume ticker' : 'Pause ticker'}
          className="h-full px-3 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border-l border-slate-300 dark:border-slate-700/80 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
        </button>
      </div>
    </section>
  );
};
