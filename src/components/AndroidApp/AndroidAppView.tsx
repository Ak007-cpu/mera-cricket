import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BallEvent, BlogPost, MatchState, ActiveMatchConfig, MonetizationConfig } from '../../types/cricket';
import { PlayerAvatar } from '../PlayerAvatar';
import { TeamFlag } from '../TeamFlag';
import { MobilePitchAnimation } from './MobilePitchAnimation';
import { HoldScreenView } from '../Common/HoldScreenView';
import { TvScreenView } from '../Common/TvScreenView';
import { LiveFanPollCard } from '../Common/LiveFanPollCard';
import { AdSlot } from '../Broadcast/AdSlot';
import { SponsorBanner } from '../Broadcast/SponsorBanner';
import { BroadcastScorecardDrawer } from '../Broadcast/BroadcastScorecardDrawer';
import { AppDownloadButton } from '../Broadcast/AppDownloadButton';
import { SixProCricketBanner } from '../Broadcast/SixProCricketBanner';
import { AppInformation } from './AppInformation';
import { ArticleRenderer } from '../Public/ArticleRenderer';
import { useContent } from '../../context/ContentContext';
import { useTheme } from '../../context/ThemeContext';
import { ThemeToggleButton } from '../Common/ThemeToggleButton';
import { vibrateDevice } from '../../services/api';
import { useAutoBallAnimation } from '../../hooks/useAutoBallAnimation';
import { useCricketAudio } from '../../hooks/useCricketAudio';
import { useSecretAdminGesture } from '../../hooks/useSecretAdminGesture';
import { getTargetChaseMetrics } from '../../utils/matchAnalytics';
import {
  RotateCw,
  Radio,
  Volume2,
  VolumeX,
  Tv,
  Mic,
  MicOff,
  BarChart2,
  X,
  Newspaper,
  BookOpen,
  ClipboardList,
  Megaphone,
  ExternalLink,
  LayoutGrid,
  ArrowLeft,
  Calendar
} from 'lucide-react';

interface AndroidAppViewProps {
  match: MatchState | null;
  config: ActiveMatchConfig | null;
  monetization?: MonetizationConfig | null;
  isLoading: boolean;
  onRefresh: () => void;
  onSecretAdminTrigger?: () => void;
  onSwitchToBroadcast?: () => void;
}

export type AndroidTab =
  | 'home'
  | 'live_score'
  | 'commentary'
  | 'scorecard'
  | 'fixtures'
  | 'results'
  | 'player_stats'
  | 'notifications'
  | 'settings';

interface MobileTeamTheme {
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  borderRgba: string;
  glowRgba: string;
  ambientRgba: string;
  accentHex: string;
  accentTextHex: string;
}

function getMobileTeamTheme(
  teamCode?: string,
  teamName?: string,
  fallbackPrimary?: string
): MobileTeamTheme {
  const key = `${teamCode || ''} ${teamName || ''}`.trim().toUpperCase();

  if (/\bPAK\b|PAKISTAN/.test(key)) {
    return {
      gradientFrom: 'rgba(6, 95, 70, 0.94)',
      gradientVia: 'rgba(4, 120, 87, 0.82)',
      gradientTo: 'rgba(6, 78, 59, 0.96)',
      borderRgba: 'rgba(52, 211, 153, 0.6)',
      glowRgba: 'rgba(16, 185, 129, 0.38)',
      ambientRgba: 'rgba(16, 185, 129, 0.24)',
      accentHex: '#10b981',
      accentTextHex: '#6ee7b7'
    };
  }
  if (/\bSL\b|SRI\s*LANKA/.test(key)) {
    return {
      gradientFrom: 'rgba(30, 58, 138, 0.95)',
      gradientVia: 'rgba(29, 78, 216, 0.84)',
      gradientTo: 'rgba(23, 37, 84, 0.96)',
      borderRgba: 'rgba(96, 165, 250, 0.62)',
      glowRgba: 'rgba(59, 130, 246, 0.4)',
      ambientRgba: 'rgba(37, 99, 235, 0.26)',
      accentHex: '#3b82f6',
      accentTextHex: '#93c5fd'
    };
  }
  if (/\bIND\b|\bINDIA\b/.test(key)) {
    return {
      gradientFrom: 'rgba(3, 105, 161, 0.94)',
      gradientVia: 'rgba(2, 132, 199, 0.82)',
      gradientTo: 'rgba(12, 74, 110, 0.96)',
      borderRgba: 'rgba(56, 189, 248, 0.6)',
      glowRgba: 'rgba(14, 165, 233, 0.36)',
      ambientRgba: 'rgba(14, 165, 233, 0.24)',
      accentHex: '#0ea5e9',
      accentTextHex: '#7dd3fc'
    };
  }
  if (/\bAUS\b|AUSTRALIA/.test(key)) {
    return {
      gradientFrom: 'rgba(161, 98, 7, 0.94)',
      gradientVia: 'rgba(202, 138, 4, 0.8)',
      gradientTo: 'rgba(113, 63, 18, 0.96)',
      borderRgba: 'rgba(250, 204, 21, 0.6)',
      glowRgba: 'rgba(234, 179, 8, 0.34)',
      ambientRgba: 'rgba(234, 179, 8, 0.22)',
      accentHex: '#eab308',
      accentTextHex: '#fde047'
    };
  }
  if (/\bENG\b|ENGLAND/.test(key)) {
    return {
      gradientFrom: 'rgba(30, 64, 175, 0.94)',
      gradientVia: 'rgba(37, 99, 235, 0.8)',
      gradientTo: 'rgba(23, 37, 84, 0.96)',
      borderRgba: 'rgba(96, 165, 250, 0.58)',
      glowRgba: 'rgba(37, 99, 235, 0.36)',
      ambientRgba: 'rgba(37, 99, 235, 0.24)',
      accentHex: '#2563eb',
      accentTextHex: '#93c5fd'
    };
  }
  if (/\b(SA|RSA)\b|SOUTH\s*AFRICA/.test(key)) {
    return {
      gradientFrom: 'rgba(21, 128, 61, 0.94)',
      gradientVia: 'rgba(22, 163, 74, 0.78)',
      gradientTo: 'rgba(20, 83, 45, 0.96)',
      borderRgba: 'rgba(74, 222, 128, 0.58)',
      glowRgba: 'rgba(22, 163, 74, 0.34)',
      ambientRgba: 'rgba(22, 163, 74, 0.22)',
      accentHex: '#16a34a',
      accentTextHex: '#86efac'
    };
  }
  if (/\bWI\b|WEST\s*INDIES/.test(key)) {
    return {
      gradientFrom: 'rgba(136, 19, 55, 0.94)',
      gradientVia: 'rgba(190, 18, 60, 0.8)',
      gradientTo: 'rgba(76, 5, 25, 0.96)',
      borderRgba: 'rgba(251, 113, 133, 0.58)',
      glowRgba: 'rgba(225, 29, 72, 0.36)',
      ambientRgba: 'rgba(225, 29, 72, 0.22)',
      accentHex: '#e11d48',
      accentTextHex: '#fda4af'
    };
  }
  if (/\bBAN\b|BANGLADESH/.test(key)) {
    return {
      gradientFrom: 'rgba(6, 95, 70, 0.94)',
      gradientVia: 'rgba(5, 150, 105, 0.8)',
      gradientTo: 'rgba(2, 44, 34, 0.96)',
      borderRgba: 'rgba(52, 211, 153, 0.58)',
      glowRgba: 'rgba(5, 150, 105, 0.34)',
      ambientRgba: 'rgba(5, 150, 105, 0.22)',
      accentHex: '#059669',
      accentTextHex: '#6ee7b7'
    };
  }
  if (/\bNZ\b|NEW\s*ZEALAND/.test(key)) {
    return {
      gradientFrom: 'rgba(30, 41, 59, 0.95)',
      gradientVia: 'rgba(51, 65, 85, 0.86)',
      gradientTo: 'rgba(15, 23, 42, 0.96)',
      borderRgba: 'rgba(203, 213, 225, 0.5)',
      glowRgba: 'rgba(148, 163, 184, 0.28)',
      ambientRgba: 'rgba(148, 163, 184, 0.18)',
      accentHex: '#cbd5e1',
      accentTextHex: '#f1f5f9'
    };
  }
  if (/\bAFG\b|AFGHANISTAN/.test(key)) {
    return {
      gradientFrom: 'rgba(29, 78, 216, 0.94)',
      gradientVia: 'rgba(37, 99, 235, 0.8)',
      gradientTo: 'rgba(15, 23, 42, 0.96)',
      borderRgba: 'rgba(96, 165, 250, 0.58)',
      glowRgba: 'rgba(59, 130, 246, 0.34)',
      ambientRgba: 'rgba(59, 130, 246, 0.22)',
      accentHex: '#3b82f6',
      accentTextHex: '#93c5fd'
    };
  }

  const cleanHex =
    fallbackPrimary && /^#[0-9a-fA-F]{6}$/.test(fallbackPrimary.trim())
      ? fallbackPrimary.trim()
      : '#0284c7';

  return {
    gradientFrom: `${cleanHex}e0`,
    gradientVia: `${cleanHex}b0`,
    gradientTo: 'rgba(15, 23, 42, 0.96)',
    borderRgba: `${cleanHex}99`,
    glowRgba: `${cleanHex}59`,
    ambientRgba: `${cleanHex}36`,
    accentHex: cleanHex,
    accentTextHex: '#e0f2fe'
  };
}

function getCurrentOverBalls(match: MatchState): BallEvent[] {
  const recent = match.recentBalls || [];
  if (recent.length === 0) return [];

  const currOver = Number(match.battingTeam?.score?.overs ?? 0);
  const currBalls = Number(match.battingTeam?.score?.balls ?? 0);
  const targetOver = currBalls > 0 ? currOver : Math.max(0, currOver - 1);

  const matchingOver = recent.filter((ball) => {
    const parsedOver =
      typeof ball.overNumber === 'number' && Number.isFinite(ball.overNumber)
        ? Math.floor(ball.overNumber)
        : Math.floor(parseFloat(String(ball.ballNumber || '0')) || 0);
    return parsedOver === targetOver;
  });

  if (matchingOver.length > 0) {
    return [...matchingOver].reverse().slice(-8);
  }

  return [...recent.slice(0, 6)].reverse();
}

function getMatchCondition(match: MatchState): {
  label: string;
  tone: 'live' | 'break' | 'rain' | 'result' | 'soon';
} {
  const status = (match.statusText || '').toLowerCase();
  if (/rain|wet|weather|bad light/.test(status)) {
    return { label: 'Rain', tone: 'rain' };
  }
  switch (match.gameState) {
    case 'live':
      return { label: 'Live', tone: 'live' };
    case 'innings_break':
      return { label: 'Innings Break', tone: 'break' };
    case 'delayed':
      return { label: 'Rain / Delay', tone: 'rain' };
    case 'completed':
      return { label: 'Result', tone: 'result' };
    default:
      return { label: 'Upcoming', tone: 'soon' };
  }
}

export const AndroidAppView: React.FC<AndroidAppViewProps> = ({
  match,
  config: _config,
  monetization,
  isLoading,
  onRefresh,
  onSecretAdminTrigger,
  onSwitchToBroadcast
}) => {
  const { isDark } = useTheme();
  const { news, breakingNews, publishedBlogs } = useContent();
  const animationsEnabled = monetization?.broadcastSettings?.animationsEnabled ?? true;
  const { activeBallEvent, scoreAnimKey } = useAutoBallAnimation(match, animationsEnabled);
  const [isPollSheetOpen, setIsPollSheetOpen] = useState(false);
  const [isHubOpen, setIsHubOpen] = useState(false);
  const [hubTab, setHubTab] = useState<'news' | 'blog' | 'info'>('news');
  const [selectedBlog, setSelectedBlog] = useState<BlogPost | null>(null);
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);
  const [newsIdx, setNewsIdx] = useState(0);

  const lastVibratedKeyRef = useRef<number | null>(null);
  const secretGestureProps = useSecretAdminGesture(onSecretAdminTrigger);
  const holdScreen = monetization?.broadcastSettings?.holdScreen;
  const tvScreen = monetization?.broadcastSettings?.tvScreen;
  const announcement = monetization?.broadcastSettings?.announcement;
  const mobileCfg = monetization?.broadcastSettings?.mobileApp;
  const appDownload = monetization?.broadcastSettings?.appDownload;
  const sixProCricket = monetization?.broadcastSettings?.sixProCricket;

  const mobileAdsEnabled = Boolean(monetization?.adsEnabled) && (mobileCfg?.adsEnabled !== false);
  const mobileSponsorEnabled = Boolean(monetization?.sponsor?.enabled) && (mobileCfg?.sponsorEnabled !== false);
  const mobileNewsTickerEnabled = mobileCfg?.newsTickerEnabled !== false;
  const mobilePollEnabled = mobileCfg?.pollEnabled !== false;
  const mobileScorecardEnabled = mobileCfg?.scorecardEnabled !== false;
  const mobileNewsPageEnabled = mobileCfg?.newsPageEnabled !== false;
  const mobileBlogPageEnabled = mobileCfg?.blogPageEnabled !== false;
  const mobileBrandBadge =
    mobileCfg?.brandBadge?.trim() || monetization?.siteName?.trim() || '';

  const mobileAdSlotConfig = useMemo(() => {
    const mob = monetization?.slots?.mobileBanner;
    const top = monetization?.slots?.topBanner;
    if (mob && (mob.imageUrl?.trim() || mob.slotId?.trim() || (mob.title?.trim() && mob.linkUrl?.trim()))) {
      return mob;
    }
    return mob?.enabled === false ? mob : top || mob;
  }, [monetization?.slots]);

  const tickerPool = useMemo(() => {
    if (breakingNews.length > 0) return breakingNews;
    return news.slice(0, 5);
  }, [breakingNews, news]);

  useEffect(() => {
    if (tickerPool.length <= 1) return;
    const timer = setInterval(() => {
      setNewsIdx((prev) => (prev + 1) % tickerPool.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [tickerPool.length]);

  const openHubTab = (tab: 'news' | 'blog' | 'info') => {
    setSelectedBlog(null);
    setHubTab(tab);
    setIsHubOpen(true);
  };

  const {
    isSoundOn,
    adminSoundEnabled,
    prefersReducedMotion,
    femaleVoiceEnabled,
    isVoiceSpeaking,
    toggleViewerSound,
    toggleFemaleVoice
  } = useCricketAudio({
    mode: 'mobile',
    match,
    activeBallEvent,
    soundSettings: monetization?.broadcastSettings?.soundSettings,
    suppressForAdOrHold: Boolean(!match || tvScreen?.enabled || holdScreen?.active)
  });

  // Subtle haptic vibration ONLY on Four, Six, and Wicket (respects reduced-motion)
  useEffect(() => {
    if (!activeBallEvent) return;
    if (lastVibratedKeyRef.current === activeBallEvent.key) return;
    lastVibratedKeyRef.current = activeBallEvent.key;

    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    if (activeBallEvent.type === 'four') {
      vibrateDevice([80, 40, 120]);
    } else if (activeBallEvent.type === 'six') {
      vibrateDevice([120, 45, 160, 45, 120]);
    } else if (activeBallEvent.type === 'wicket') {
      vibrateDevice([240, 80, 240]);
    }
  }, [activeBallEvent]);

  const teamTheme = useMemo(() => {
    if (!match?.battingTeam) {
      return getMobileTeamTheme(undefined, undefined, '#0284c7');
    }
    return getMobileTeamTheme(
      match.battingTeam.code || match.battingTeam.shortName,
      match.battingTeam.name,
      match.battingTeam.primaryColor
    );
  }, [match?.battingTeam]);

  const chaseMetrics = useMemo(() => getTargetChaseMetrics(match), [match]);
  const currentOverBalls = useMemo(() => (match ? getCurrentOverBalls(match) : []), [match]);

  // Loading Screen (Single-Screen Non-Scrolling)
  if (!match && isLoading) {
    return (
      <div className="relative h-[100dvh] max-h-[100dvh] w-full max-w-md mx-auto overflow-hidden bg-slate-100 dark:bg-[#030712] text-slate-950 dark:text-white flex flex-col items-center justify-center p-6">
        <div aria-hidden="true" {...secretGestureProps} className="absolute top-0 left-0 w-16 h-16 z-30" />
        <div className="absolute top-2.5 right-3 z-30">
          <ThemeToggleButton variant="mobile" />
        </div>
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[140%] h-72 rounded-full blur-3xl animate-stadium-glow"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(14,165,233,0.22) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(14,165,233,0.14) 0%, transparent 70%)'
          }}
        />
        <div className="relative z-10 w-full rounded-3xl bg-white/95 dark:bg-white/[0.05] backdrop-blur-md border border-slate-300 dark:border-white/15 p-7 text-center flex flex-col items-center gap-4 shadow-lg dark:shadow-none">
          <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-500/20 border border-sky-300 dark:border-sky-400/40 flex items-center justify-center">
            <Radio className="w-6 h-6 text-sky-600 dark:text-sky-400 animate-pulse" />
          </div>
          <div>
            <p className="font-cricket text-lg font-bold tracking-wide text-slate-950 dark:text-white">
              Loading Live Score
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Connecting to live match feed...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderAnnouncementOrTicker = () => {
    if (announcement?.enabled && announcement.text?.trim()) {
      const inner = (
        <div className="relative z-10 w-full rounded-xl border border-amber-400 dark:border-amber-400/45 bg-gradient-to-r from-amber-50 via-white to-sky-50 dark:from-amber-500/18 dark:via-slate-900/95 dark:to-sky-500/18 px-2.5 py-1 flex items-center gap-2 text-[11px] font-bold text-amber-950 dark:text-amber-100 shrink-0 shadow-xs">
          <Megaphone className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300 shrink-0" />
          <span className="truncate flex-1">{announcement.text}</span>
          {announcement.linkUrl?.trim() && <ExternalLink className="w-3 h-3 text-amber-700 dark:text-amber-300 shrink-0" />}
        </div>
      );
      return announcement.linkUrl?.trim() ? (
        <a
          href={announcement.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full shrink-0"
        >
          {inner}
        </a>
      ) : (
        inner
      );
    }

    if (mobileNewsTickerEnabled && tickerPool.length > 0) {
      const activeNews = tickerPool[newsIdx % tickerPool.length];
      if (!activeNews) return null;
      return (
        <button
          type="button"
          onClick={() => openHubTab(mobileNewsPageEnabled ? 'news' : 'info')}
          className="relative z-10 w-full rounded-xl border border-sky-300 dark:border-sky-400/25 bg-white/95 dark:bg-white/[0.045] px-2.5 py-1 flex items-center gap-2 text-left shrink-0 hover:bg-sky-50 dark:hover:bg-white/[0.08] transition-colors shadow-xs"
        >
          <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-score font-black uppercase tracking-wider shrink-0">
            {activeNews.isBreaking ? 'Breaking' : 'News'}
          </span>
          <span className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 truncate flex-1">
            {activeNews.title}
          </span>
        </button>
      );
    }

    return null;
  };

  const renderMobileMonetizationStrip = () => {
    if (!mobileAdsEnabled && !mobileSponsorEnabled) return null;
    return (
      <div className="relative z-10 w-full flex flex-col gap-1.5 shrink-0">
        {mobileSponsorEnabled && (
          <SponsorBanner sponsor={monetization?.sponsor} compact />
        )}
        {mobileAdsEnabled && (
          <AdSlot
            placement="mobile"
            adsEnabled={mobileAdsEnabled}
            publisherId={monetization?.adsensePublisherId}
            slotConfig={mobileAdSlotConfig}
            adTestMode={monetization?.adsenseTestMode}
            hidePlaceholder={monetization?.adsenseHidePlaceholders}
            compact
          />
        )}
      </div>
    );
  };

  const renderHubAndScorecardModals = () => (
    <>
      {isHubOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2.5"
          onClick={() => setIsHubOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[86dvh] rounded-2xl bg-white dark:bg-[#071022] border border-slate-300 dark:border-slate-700/80 shadow-2xl flex flex-col overflow-hidden text-slate-950 dark:text-white"
          >
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950/70 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <LayoutGrid className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider truncate">
                  {mobileBrandBadge || 'Live Cricket HD'} Hub
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsHubOpen(false)}
                aria-label="Close Hub"
                className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hub Tabs */}
            <div className="px-3 pt-2.5 pb-2 border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-1.5 shrink-0 bg-slate-100/70 dark:bg-slate-950/40 overflow-x-auto">
              {match && mobileScorecardEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setIsHubOpen(false);
                    setIsScorecardOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-black uppercase bg-sky-100 dark:bg-sky-600/25 border border-sky-300 dark:border-sky-400/40 text-sky-900 dark:text-sky-200 flex items-center gap-1 shrink-0"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Scorecard</span>
                </button>
              )}
              {mobileNewsPageEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBlog(null);
                    setHubTab('news');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-1 shrink-0 transition-colors ${
                    hubTab === 'news'
                      ? 'bg-rose-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-800'
                  }`}
                >
                  <Newspaper className="w-3.5 h-3.5" />
                  <span>News ({news.length})</span>
                </button>
              )}
              {mobileBlogPageEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBlog(null);
                    setHubTab('blog');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-1 shrink-0 transition-colors ${
                    hubTab === 'blog'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-800'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Blog ({publishedBlogs.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedBlog(null);
                  setHubTab('info');
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-1 shrink-0 transition-colors ${
                  hubTab === 'info'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-800'
                }`}
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>App &amp; Info</span>
              </button>
            </div>

            {/* Hub Content */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {hubTab === 'news' && mobileNewsPageEnabled && (
                news.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-600 dark:text-slate-400">
                    Abhi koi news publish nahi hui hai.
                  </div>
                ) : (
                  news.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 overflow-hidden"
                    >
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-36 object-cover bg-slate-200 dark:bg-slate-950"
                        />
                      )}
                      <div className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span
                            className={`px-2 py-0.5 rounded font-black uppercase ${
                              item.isBreaking
                                ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30'
                                : 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30'
                            }`}
                          >
                            {item.isBreaking ? 'Breaking' : item.category}
                          </span>
                          <span className="text-slate-600 dark:text-slate-400 font-mono">{item.date}</span>
                        </div>
                        <h3 className="text-sm font-black text-slate-950 dark:text-white leading-snug">{item.title}</h3>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                          {item.description}
                        </p>
                      </div>
                    </article>
                  ))
                )
              )}

              {hubTab === 'blog' && mobileBlogPageEnabled && (
                selectedBlog ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setSelectedBlog(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-300 hover:text-slate-950 dark:hover:text-white"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>All Articles</span>
                    </button>
                    {selectedBlog.coverImageUrl && (
                      <img
                        src={selectedBlog.coverImageUrl}
                        alt={selectedBlog.title}
                        className="w-full h-40 object-cover rounded-xl border border-slate-300 dark:border-slate-800"
                      />
                    )}
                    <h3 className="text-base font-black text-slate-950 dark:text-white leading-snug">
                      {selectedBlog.title}
                    </h3>
                    {selectedBlog.publishedAt && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{selectedBlog.publishedAt}</span>
                      </div>
                    )}
                    <ArticleRenderer content={selectedBlog.content} />
                  </div>
                ) : publishedBlogs.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-600 dark:text-slate-400">
                    Abhi koi blog article publish nahi hua hai.
                  </div>
                ) : (
                  publishedBlogs.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => setSelectedBlog(post)}
                      className="w-full text-left rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-400/50 overflow-hidden transition-colors"
                    >
                      {post.coverImageUrl && (
                        <img
                          src={post.coverImageUrl}
                          alt={post.title}
                          className="w-full h-32 object-cover bg-slate-200 dark:bg-slate-950"
                        />
                      )}
                      <div className="p-3 space-y-1">
                        <div className="text-[10px] font-mono text-amber-700 dark:text-amber-300">
                          {post.publishedAt || 'Featured Editorial'}
                        </div>
                        <h3 className="text-sm font-black text-slate-950 dark:text-white leading-snug">{post.title}</h3>
                        {post.excerpt && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{post.excerpt}</p>
                        )}
                      </div>
                    </button>
                  ))
                )
              )}

              {hubTab === 'info' && (
                <div className="space-y-3">
                  {mobileSponsorEnabled && (
                    <SponsorBanner sponsor={monetization?.sponsor} compact />
                  )}
                  <AppInformation
                    sixProCricket={sixProCricket}
                    version={appDownload?.version}
                    buildTimestamp={monetization?.updatedAt}
                    siteName={monetization?.siteName}
                    contactEmail={monetization?.contactEmail}
                  />
                  <SixProCricketBanner variant="mobile" layout="inline" config={sixProCricket} />
                  {(appDownload?.enabled ?? true) && (
                    <AppDownloadButton
                      variant="compact"
                      config={appDownload}
                      siteName={monetization?.siteName}
                      className="w-full justify-center py-2.5"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {match && mobileScorecardEnabled && (
        <BroadcastScorecardDrawer
          match={match}
          isOpen={isScorecardOpen}
          onClose={() => setIsScorecardOpen(false)}
        />
      )}
    </>
  );

  // Admin-Controlled TV SCREEN overrides live score across Mobile viewers (sync stays active in background)
  if (tvScreen?.enabled) {
    return (
      <div className="relative h-[100dvh] max-h-[100dvh] w-full max-w-md mx-auto overflow-hidden bg-slate-100 dark:bg-[#030712] text-slate-950 dark:text-white flex flex-col justify-between px-3 pt-2.5 pb-16 select-none gap-2">
        <div aria-hidden="true" {...secretGestureProps} className="absolute top-0 left-0 w-16 h-16 z-30" />
        <div className="relative z-20 flex items-center justify-between gap-2 shrink-0">
          {mobileBrandBadge ? (
            <span className="px-2.5 py-1 rounded-full bg-white dark:bg-white/[0.06] border border-slate-300 dark:border-white/15 text-[10px] font-score font-bold text-slate-900 dark:text-slate-200 truncate shadow-xs">
              {mobileBrandBadge}
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggleButton variant="mobile" />
            <AppDownloadButton
              variant="mini"
              config={appDownload}
              siteName={monetization?.siteName}
            />
            <button
              type="button"
              onClick={() => openHubTab(mobileNewsPageEnabled ? 'news' : 'info')}
              aria-label="Open Hub"
              className="h-[34px] px-2.5 rounded-xl bg-white dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.15] border border-slate-300 dark:border-white/15 flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-200 transition shadow-xs"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
              <span>Hub</span>
            </button>
            {onSwitchToBroadcast && (
              <button
                type="button"
                onClick={onSwitchToBroadcast}
                aria-label="Switch to Broadcast TV Mode"
                className="h-[34px] px-2.5 rounded-xl bg-white dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.15] border border-slate-300 dark:border-white/15 flex items-center gap-1 text-[11px] font-bold text-sky-800 dark:text-sky-200 transition shadow-xs"
              >
                <Tv className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>TV</span>
              </button>
            )}
          </div>
        </div>
        {renderAnnouncementOrTicker()}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[140%] h-72 rounded-full blur-3xl animate-stadium-glow"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)'
          }}
        />
        <div className="relative z-10 w-full flex-1 flex items-center min-h-0">
          <TvScreenView
            tvScreen={tvScreen}
            nextMatch={monetization?.broadcastSettings?.nextMatch}
            variant="mobile"
          />
        </div>
        {renderMobileMonetizationStrip()}
        <SixProCricketBanner variant="mobile" config={sixProCricket} />
        {renderHubAndScorecardModals()}
      </div>
    );
  }

  // Admin-Controlled HOLD SCREEN overrides live score across Mobile viewers (sync stays active in background)
  if (holdScreen?.active) {
    return (
      <div className="relative h-[100dvh] max-h-[100dvh] w-full max-w-md mx-auto overflow-hidden bg-slate-100 dark:bg-[#030712] text-slate-950 dark:text-white flex flex-col justify-between px-3 pt-2.5 pb-16 select-none gap-2">
        <div aria-hidden="true" {...secretGestureProps} className="absolute top-0 left-0 w-16 h-16 z-30" />
        <div className="relative z-20 flex items-center justify-between gap-2 shrink-0">
          {mobileBrandBadge ? (
            <span className="px-2.5 py-1 rounded-full bg-white dark:bg-white/[0.06] border border-slate-300 dark:border-white/15 text-[10px] font-score font-bold text-slate-900 dark:text-slate-200 truncate shadow-xs">
              {mobileBrandBadge}
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggleButton variant="mobile" />
            <AppDownloadButton
              variant="mini"
              config={appDownload}
              siteName={monetization?.siteName}
            />
            <button
              type="button"
              onClick={() => openHubTab(mobileNewsPageEnabled ? 'news' : 'info')}
              aria-label="Open Hub"
              className="h-[34px] px-2.5 rounded-xl bg-white dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.15] border border-slate-300 dark:border-white/15 flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-200 transition shadow-xs"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
              <span>Hub</span>
            </button>
            {onSwitchToBroadcast && (
              <button
                type="button"
                onClick={onSwitchToBroadcast}
                aria-label="Switch to Broadcast TV Mode"
                className="h-[34px] px-2.5 rounded-xl bg-white dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.15] border border-slate-300 dark:border-white/15 flex items-center gap-1 text-[11px] font-bold text-sky-800 dark:text-sky-200 transition shadow-xs"
              >
                <Tv className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>TV</span>
              </button>
            )}
          </div>
        </div>
        {renderAnnouncementOrTicker()}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[140%] h-72 rounded-full blur-3xl animate-stadium-glow"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)'
          }}
        />
        <div className="relative z-10 w-full flex-1 flex items-center min-h-0">
          <HoldScreenView
            holdScreen={holdScreen}
            nextMatch={monetization?.broadcastSettings?.nextMatch}
            variant="mobile"
          />
        </div>
        {renderMobileMonetizationStrip()}
        <SixProCricketBanner variant="mobile" config={sixProCricket} />
        {renderHubAndScorecardModals()}
      </div>
    );
  }

  // Standby Screen when no live match is active (TV Frame + Bat & Ball / Playlist + Game Banner)
  if (!match) {
    return (
      <div className="relative h-[100dvh] max-h-[100dvh] w-full max-w-md mx-auto overflow-y-auto overflow-x-hidden bg-slate-100 dark:bg-[#030712] text-slate-950 dark:text-white flex flex-col justify-between px-3 pt-2.5 pb-16 select-none gap-2">
        <div aria-hidden="true" {...secretGestureProps} className="absolute top-0 left-0 w-16 h-16 z-30" />
        {/* Top bar */}
        <div className="relative z-20 flex items-center justify-between gap-1.5 shrink-0">
          {mobileBrandBadge ? (
            <span className="px-2.5 py-1 rounded-full bg-white dark:bg-white/[0.06] border border-slate-300 dark:border-white/15 text-[10px] font-score font-bold text-slate-900 dark:text-slate-200 truncate shadow-xs">
              {mobileBrandBadge}
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggleButton variant="mobile" />
            <AppDownloadButton
              variant="mini"
              config={appDownload}
              siteName={monetization?.siteName}
            />
            <button
              type="button"
              onClick={() => openHubTab(mobileNewsPageEnabled ? 'news' : 'info')}
              aria-label="Open News, Blog & Info"
              className="h-[34px] px-2.5 rounded-xl bg-white dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] active:scale-95 border border-slate-300 dark:border-white/12 flex items-center gap-1 text-xs font-bold text-amber-800 dark:text-amber-200 transition shadow-xs"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
              <span>Hub</span>
            </button>
            {onSwitchToBroadcast && (
              <button
                type="button"
                onClick={onSwitchToBroadcast}
                aria-label="Switch to Broadcast TV Mode"
                className="h-[34px] px-2.5 rounded-xl bg-white dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] active:scale-95 border border-slate-300 dark:border-white/12 flex items-center gap-1 text-xs font-bold text-sky-800 dark:text-sky-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 shadow-xs"
              >
                <Tv className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>TV</span>
              </button>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              aria-label="Refresh"
              className="min-w-[34px] min-h-[34px] rounded-xl bg-white dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] active:scale-95 border border-slate-300 dark:border-white/12 flex items-center justify-center text-slate-800 dark:text-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 shadow-xs"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-600 dark:text-amber-300' : ''}`} />
            </button>
          </div>
        </div>

        {renderAnnouncementOrTicker()}

        <div className="relative z-10 w-full flex-1 flex items-center min-h-0">
          <TvScreenView
            tvScreen={tvScreen}
            nextMatch={monetization?.broadcastSettings?.nextMatch}
            variant="mobile"
          />
        </div>

        {renderMobileMonetizationStrip()}
        <SixProCricketBanner variant="mobile" config={sixProCricket} />
        {renderHubAndScorecardModals()}
      </div>
    );
  }

  const { battingTeam, bowlingTeam, striker, nonStriker, currentBowler } = match;
  const batCode = (battingTeam.shortName || battingTeam.code || 'BAT').toUpperCase();
  const bowlCode = (bowlingTeam.shortName || bowlingTeam.code || 'BOWL').toUpperCase();
  const condition = getMatchCondition(match);
  const isLive = condition.tone === 'live';

  // Second-innings target / chase fallback if remainingBalls is missing on raw scorecards
  const showSecondInningsChase = match.currentInnings === 2 && Number(match.target) > 0;
  const neededRuns = chaseMetrics
    ? chaseMetrics.neededRuns
    : showSecondInningsChase
    ? Math.max(0, Number(match.target) - Number(battingTeam.score?.runs ?? 0))
    : 0;
  const remainingBalls =
    chaseMetrics?.remainingBalls ?? (typeof match.remainingBalls === 'number' ? match.remainingBalls : 0);

  const firstInningsSummary = match.scorecards?.firstInnings;
  const bowlFirstInnScore =
    match.currentInnings === 2 && firstInningsSummary
      ? `${firstInningsSummary.totalRuns}/${firstInningsSummary.totalWickets}`
      : null;

  const isImpactEvent =
    activeBallEvent &&
    (activeBallEvent.type === 'four' || activeBallEvent.type === 'six' || activeBallEvent.type === 'wicket');

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] w-full max-w-md mx-auto overflow-y-auto overflow-x-hidden bg-slate-100 dark:bg-[#030712] text-slate-950 dark:text-slate-50 flex flex-col justify-between gap-1.5 px-2.5 pt-2 pb-16 sm:px-3.5 sm:pt-2.5 sm:pb-16 select-none">
      {/* Subtle Animated Stadium-Light Glow Backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div
          className="absolute -top-28 left-1/2 -translate-x-1/2 w-[140%] h-72 rounded-full blur-3xl animate-stadium-glow"
          style={{
            background: isDark
              ? `radial-gradient(ellipse at center, ${teamTheme.ambientRgba} 0%, rgba(15, 23, 42, 0.25) 58%, transparent 80%)`
              : `radial-gradient(ellipse at center, ${teamTheme.ambientRgba} 0%, rgba(226, 232, 240, 0.32) 58%, transparent 80%)`
          }}
        />
        <div
          className="absolute -bottom-32 right-0 w-72 h-72 rounded-full blur-3xl opacity-45"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(251, 191, 36, 0.14) 0%, transparent 72%)'
              : 'radial-gradient(circle, rgba(251, 191, 36, 0.10) 0%, transparent 72%)'
          }}
        />
      </div>

      {/* Non-Blocking Perimeter Stadium Flash on Four (Blue), Six (Gold), Wicket (Red) */}
      {isImpactEvent && activeBallEvent && (
        <div
          key={`screen-flash-${activeBallEvent.key}`}
          className="pointer-events-none fixed inset-0 z-40 animate-flash-3s"
          style={{
            background:
              activeBallEvent.type === 'wicket'
                ? 'radial-gradient(circle at center, transparent 34%, rgba(225, 29, 72, 0.55) 100%)'
                : activeBallEvent.type === 'six'
                ? 'radial-gradient(circle at center, transparent 34%, rgba(251, 191, 36, 0.52) 100%)'
                : 'radial-gradient(circle at center, transparent 34%, rgba(37, 99, 235, 0.52) 100%)'
          }}
        />
      )}

      {/* 1. COMPACT TOP BAR: Pulsing Red LIVE Dot + Brand/Format + Actions */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-1.5 shrink-0 min-h-[36px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            {...secretGestureProps}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 shrink-0 shadow-xs"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLive
                  ? 'bg-rose-600 dark:bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.95)] animate-live-dot'
                  : condition.tone === 'break' || condition.tone === 'rain'
                  ? 'bg-amber-500 dark:bg-amber-400'
                  : condition.tone === 'result'
                  ? 'bg-emerald-500 dark:bg-emerald-400'
                  : 'bg-slate-400'
              }`}
            />
            <span className="font-score text-[10px] font-bold tracking-wider uppercase text-slate-950 dark:text-white">
              {condition.label}
            </span>
          </div>

          <span className="font-score text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-white dark:bg-white/[0.05] border border-slate-300 dark:border-white/10 px-1.5 py-0.5 rounded-md truncate shadow-xs">
            {mobileBrandBadge ? `${mobileBrandBadge} • ` : ''}{match.matchType}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {adminSoundEnabled && !prefersReducedMotion && (
            <>
              <button
                type="button"
                onClick={toggleFemaleVoice}
                aria-label={femaleVoiceEnabled ? 'Disable female commentary voice' : 'Enable female commentary voice'}
                title={femaleVoiceEnabled ? 'Female Voice ON' : 'Female Voice OFF'}
                className={`min-w-[34px] min-h-[34px] rounded-xl border flex items-center justify-center transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 shrink-0 ${
                  femaleVoiceEnabled
                    ? isVoiceSpeaking
                      ? 'bg-amber-100 dark:bg-amber-500/25 border-amber-400 dark:border-amber-400/70 text-amber-800 dark:text-amber-200 animate-pulse'
                      : 'bg-sky-100 dark:bg-sky-500/20 border-sky-400 dark:border-sky-400/50 text-sky-800 dark:text-sky-300'
                    : 'bg-white dark:bg-white/[0.07] hover:bg-slate-200 dark:hover:bg-white/[0.15] border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-400'
                }`}
              >
                {femaleVoiceEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={toggleViewerSound}
                aria-label={isSoundOn ? 'Mute match sound' : 'Enable match sound'}
                className={`min-w-[34px] min-h-[34px] rounded-xl border flex items-center justify-center transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 shrink-0 ${
                  isSoundOn
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-400/50 text-emerald-800 dark:text-emerald-300'
                    : 'bg-white dark:bg-white/[0.07] hover:bg-slate-200 dark:hover:bg-white/[0.15] border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-300'
                }`}
              >
                {isSoundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
          <ThemeToggleButton variant="mobile" />
          {mobilePollEnabled && (
            <button
              type="button"
              onClick={() => setIsPollSheetOpen(true)}
              aria-label="Open Live Fan Poll"
              title="Who Will Win? Live Poll"
              className="min-h-[34px] px-1.5 rounded-xl bg-amber-100 dark:bg-amber-500/15 hover:bg-amber-200 dark:hover:bg-amber-500/25 active:scale-95 border border-amber-400 dark:border-amber-400/40 flex items-center gap-1 text-[10px] font-bold text-amber-900 dark:text-amber-200 transition shrink-0"
            >
              <BarChart2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
              <span>Poll</span>
            </button>
          )}
          <AppDownloadButton
            variant="mini"
            config={appDownload}
            siteName={monetization?.siteName}
          />
          <button
            type="button"
            onClick={() => openHubTab(mobileNewsPageEnabled ? 'news' : mobileBlogPageEnabled ? 'blog' : 'info')}
            aria-label="Open Scorecard, News & Blog Hub"
            title="Scorecard, News, Blog & App Info"
            className="min-h-[34px] px-1.5 rounded-xl bg-sky-100 dark:bg-sky-500/15 hover:bg-sky-200 dark:hover:bg-sky-500/25 active:scale-95 border border-sky-400 dark:border-sky-400/40 flex items-center gap-1 text-[10px] font-bold text-sky-900 dark:text-sky-200 transition shrink-0"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-sky-700 dark:text-sky-300" />
            <span>Hub</span>
          </button>
          {onSwitchToBroadcast && (
            <button
              type="button"
              onClick={onSwitchToBroadcast}
              aria-label="Switch to Broadcast TV View"
              title="Switch to Broadcast TV Mode"
              className="min-h-[34px] px-1.5 rounded-xl bg-white dark:bg-white/[0.07] hover:bg-slate-200 dark:hover:bg-white/[0.15] active:scale-95 border border-slate-300 dark:border-white/15 flex items-center gap-1 text-[10px] font-bold text-sky-800 dark:text-sky-200 transition shrink-0 shadow-xs"
            >
              <Tv className="w-3.5 h-3.5 text-sky-600 dark:text-sky-300" />
              <span>TV</span>
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh live score"
            className="min-w-[34px] min-h-[34px] rounded-xl bg-white dark:bg-white/[0.07] hover:bg-slate-200 dark:hover:bg-white/[0.15] active:scale-95 border border-slate-300 dark:border-white/15 flex items-center justify-center text-slate-900 dark:text-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 shrink-0 shadow-xs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-600 dark:text-amber-300' : ''}`} />
          </button>
        </div>
      </header>

      {/* Admin Notice OR Breaking News Strip */}
      {renderAnnouncementOrTicker()}

      {/* 2. DUAL-TEAM HERO SCORE CARD (Both Flags + VS + Status/Toss) */}
      <section aria-label="Live Match Score" className="relative z-10 flex flex-col gap-1.5 shrink-0">
        <div className="relative flex items-stretch gap-2">
          {/* BATTING TEAM CARD (Larger, Luminous, Dynamic Team Gradient) */}
          <div
            className="flex-[2.15] min-w-0 rounded-2xl px-3 py-2.5 border backdrop-blur-md flex flex-col justify-between"
            style={{
              background: `linear-gradient(135deg, ${teamTheme.gradientFrom} 0%, ${teamTheme.gradientVia} 52%, ${teamTheme.gradientTo} 100%)`,
              borderColor: teamTheme.borderRgba,
              boxShadow: isDark
                ? `0 12px 30px -10px ${teamTheme.glowRgba}`
                : '0 8px 20px -6px rgba(15, 23, 42, 0.25)'
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="rounded-full p-0.5 bg-white/20 shadow-md shrink-0">
                <TeamFlag
                  teamName={battingTeam.name}
                  teamCode={batCode}
                  logoUrl={battingTeam.logoUrl}
                  size="lg"
                  shape="circle"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-cricket font-bold text-sm sm:text-base text-white truncate">
                    {battingTeam.name || batCode}
                  </span>
                </div>
                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-black/30 border border-white/20 font-score text-[9px] font-bold uppercase tracking-wider text-amber-200">
                  Batting
                </span>
              </div>
            </div>

            <div className="mt-1.5 flex items-end justify-between gap-2">
              <div
                key={scoreAnimKey}
                className="font-score font-black tabular-nums text-[2.4rem] sm:text-5xl leading-none tracking-tight text-white animate-score-flip"
                style={{
                  textShadow: `0 0 24px ${teamTheme.glowRgba}, 0 2px 12px rgba(0, 0, 0, 0.55)`
                }}
              >
                {battingTeam.score.runs}/{battingTeam.score.wickets}
              </div>

              <div className="text-right tabular-nums shrink-0 leading-tight">
                <div className="font-score text-xs font-bold text-white">
                  {battingTeam.score.overs}.{battingTeam.score.balls} ov
                </div>
                <div className="font-score text-[11px] font-semibold text-white/85">
                  CRR {Number(match.currentRunRate || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Center VS Badge */}
          <div className="pointer-events-none absolute left-[67%] top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="w-7 h-7 rounded-full bg-white dark:bg-[#030712] border border-slate-300 dark:border-white/30 shadow-md dark:shadow-[0_0_16px_rgba(0,0,0,0.9)] flex items-center justify-center">
              <span className="font-score text-[10px] font-black tracking-wider text-amber-700 dark:text-amber-300">
                VS
              </span>
            </div>
          </div>

          {/* BOWLING TEAM CARD (Smaller & Softer) */}
          <div className="flex-1 min-w-0 rounded-2xl px-2.5 py-2.5 border border-slate-300 dark:border-white/12 bg-white/95 dark:bg-white/[0.045] backdrop-blur-md flex flex-col items-center justify-between text-center shadow-sm dark:shadow-none">
            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] border border-slate-300 dark:border-white/10 font-score text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Bowling
            </span>

            <div className="my-1 opacity-95">
              <TeamFlag
                teamName={bowlingTeam.name}
                teamCode={bowlCode}
                logoUrl={bowlingTeam.logoUrl}
                size="md"
                shape="circle"
              />
            </div>

            <div className="w-full min-w-0">
              <div className="font-cricket font-bold text-xs sm:text-sm text-slate-950 dark:text-slate-100 truncate">
                {bowlCode}
              </div>
              <div className="font-score text-[11px] font-semibold text-slate-600 dark:text-slate-400 tabular-nums truncate">
                {bowlFirstInnScore ? bowlFirstInnScore : 'Fielding'}
              </div>
            </div>
          </div>
        </div>

        {/* Compact Status Line: Target/Chase + Toss + Match State */}
        <div className="rounded-xl px-3 py-1.5 bg-white/95 dark:bg-white/[0.045] border border-slate-300 dark:border-white/10 flex flex-col gap-0.5 text-[11px] leading-tight shadow-xs dark:shadow-none">
          {showSecondInningsChase && (
            <div className="flex items-center justify-between gap-2 font-semibold">
              <span className="font-score font-bold text-amber-700 dark:text-amber-300 shrink-0">
                Target {match.target}
                {chaseMetrics ? ` • RRR ${chaseMetrics.requiredRunRate.toFixed(2)}` : ''}
              </span>
              <span className="truncate text-right text-slate-950 dark:text-white">
                {neededRuns > 0 && remainingBalls > 0
                  ? `Need ${neededRuns} ${neededRuns === 1 ? 'run' : 'runs'} in ${remainingBalls} ${
                      remainingBalls === 1 ? 'ball' : 'balls'
                    }`
                  : match.statusText}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-300">
            <span className="truncate">
              {match.toss ? `Toss: ${match.toss}` : match.statusText || `${batCode} Batting`}
            </span>
            <span
              className={`font-score font-bold uppercase text-[10px] shrink-0 ${
                isLive
                  ? 'text-rose-600 dark:text-rose-400'
                  : condition.tone === 'break' || condition.tone === 'rain'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {condition.label}
            </span>
          </div>
        </div>
      </section>

      {/* 3. TOP-DOWN ANIMATED PITCH & BALL ARENA */}
      <MobilePitchAnimation event={activeBallEvent} battingColor={teamTheme.accentHex} />

      {/* 4. BIG HD PLAYER PHOTOS (50%+ LARGER: size="xl" 88px) IN 3-COLUMN CARDS */}
      <section aria-label="Active Players" className="relative z-10 grid grid-cols-3 gap-2 shrink-0">
        {/* Striker Card - Gold Ring */}
        <div className="rounded-2xl px-1.5 py-2 backdrop-blur-md bg-amber-50/95 dark:bg-amber-500/[0.09] border-2 border-amber-400 dark:border-amber-400/55 shadow-sm dark:shadow-[0_0_22px_rgba(251,191,36,0.16)] flex flex-col items-center text-center min-w-0">
          <PlayerAvatar
            playerId={striker.playerId}
            name={striker.name || 'Striker'}
            teamCode={batCode}
            jerseyNumber={striker.jerseyNumber}
            imageUrl={striker.imageUrl}
            size="xl"
            isOnStrike
            ringVariant="gold"
          />
          <div className="mt-1.5 w-full flex items-center justify-center gap-0.5 min-w-0">
            <span className="font-cricket font-bold text-xs sm:text-sm text-slate-950 dark:text-white truncate">
              {striker.name || 'Striker'}
            </span>
            <span className="text-amber-600 dark:text-amber-300 font-black text-sm leading-none shrink-0" aria-label="On strike">
              *
            </span>
          </div>
          <div className="mt-0.5 tabular-nums leading-none">
            <span className="font-score font-black text-lg sm:text-xl text-amber-700 dark:text-amber-300">
              {striker.runs ?? 0}
            </span>
            <span className="font-score text-[11px] font-semibold text-slate-600 dark:text-slate-300 ml-0.5">
              ({striker.balls ?? 0})
            </span>
          </div>
        </div>

        {/* Non-Striker Card - Clean Surface */}
        <div className="rounded-2xl px-1.5 py-2 backdrop-blur-md bg-white/95 dark:bg-white/[0.045] border border-slate-300 dark:border-white/14 shadow-sm dark:shadow-none flex flex-col items-center text-center min-w-0">
          <PlayerAvatar
            playerId={nonStriker.playerId}
            name={nonStriker.name || 'Non-Striker'}
            teamCode={batCode}
            jerseyNumber={nonStriker.jerseyNumber}
            imageUrl={nonStriker.imageUrl}
            size="xl"
            ringVariant="default"
          />
          <div className="mt-1.5 w-full font-cricket font-semibold text-xs sm:text-sm text-slate-950 dark:text-slate-100 truncate">
            {nonStriker.name || 'Non-Striker'}
          </div>
          <div className="mt-0.5 tabular-nums leading-none">
            <span className="font-score font-black text-lg sm:text-xl text-slate-950 dark:text-white">
              {nonStriker.runs ?? 0}
            </span>
            <span className="font-score text-[11px] font-semibold text-slate-600 dark:text-slate-400 ml-0.5">
              ({nonStriker.balls ?? 0})
            </span>
          </div>
        </div>

        {/* Bowler Card - Green Ring */}
        <div className="rounded-2xl px-1.5 py-2 backdrop-blur-md bg-emerald-50/95 dark:bg-emerald-500/[0.09] border-2 border-emerald-500 dark:border-emerald-400/50 shadow-sm dark:shadow-[0_0_22px_rgba(16,185,129,0.14)] flex flex-col items-center text-center min-w-0">
          <PlayerAvatar
            playerId={currentBowler.playerId}
            name={currentBowler.name || 'Bowler'}
            teamCode={bowlCode}
            jerseyNumber={currentBowler.jerseyNumber}
            imageUrl={currentBowler.imageUrl}
            size="xl"
            ringVariant="green"
          />
          <div className="mt-1.5 w-full flex items-center justify-center gap-1 min-w-0">
            <span className="font-cricket font-bold text-xs sm:text-sm text-slate-950 dark:text-white truncate">
              {currentBowler.name || 'Bowler'}
            </span>
          </div>
          <div className="mt-0.5 tabular-nums leading-none">
            <span className="font-score font-black text-lg sm:text-xl text-emerald-700 dark:text-emerald-300">
              {currentBowler.wickets ?? 0}/{currentBowler.runs ?? 0}
            </span>
            <span className="font-score text-[11px] font-semibold text-slate-600 dark:text-slate-300 ml-0.5">
              ({currentBowler.overs ?? 0})
            </span>
          </div>
        </div>
      </section>

      {/* 5. THIS OVER: Colored Ball Chips */}
      <section
        aria-label="This Over"
        className="relative z-10 rounded-2xl px-3 py-2 backdrop-blur-md bg-white/95 dark:bg-white/[0.05] border border-slate-300 dark:border-white/12 flex items-center justify-between gap-2 shrink-0 shadow-xs dark:shadow-none"
      >
        <span className="font-score text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 shrink-0">
          This Over
        </span>

        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          {currentOverBalls.length > 0 ? (
            currentOverBalls.map((ball, idx) => {
              const isWide = ball.isExtra && ball.extraType === 'wide';
              const isNoBall = ball.isExtra && ball.extraType === 'no-ball';
              const isByeOrLegBye =
                ball.isExtra && (ball.extraType === 'bye' || ball.extraType === 'leg-bye');

              const chipLabel = ball.isWicket
                ? 'W'
                : isWide
                ? ball.runs > 1
                  ? `${ball.runs}wd`
                  : 'wd'
                : isNoBall
                ? ball.runs > 1
                  ? `${ball.runs}nb`
                  : 'nb'
                : isByeOrLegBye
                ? `${ball.runs}${ball.extraType === 'leg-bye' ? 'lb' : 'b'}`
                : ball.runs === 0
                ? '•'
                : String(ball.runs);

              // Color Spec: dot=grey, 1-3=high-contrast chip, 4=blue, 6=gold, wicket=red
              let chipStyle =
                'bg-slate-200 text-slate-900 border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-500';
              if (ball.isWicket) {
                chipStyle =
                  'bg-rose-600 text-white border-rose-300 shadow-[0_0_12px_rgba(225,29,72,0.55)]';
              } else if (ball.isSix) {
                chipStyle =
                  'bg-amber-400 text-slate-950 border-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.58)]';
              } else if (ball.isFour) {
                chipStyle =
                  'bg-blue-600 text-white border-blue-300 shadow-[0_0_12px_rgba(37,99,235,0.55)]';
              } else if (isWide || isNoBall) {
                chipStyle =
                  'bg-amber-100 text-amber-900 border-amber-400 dark:bg-slate-800 dark:text-amber-200 dark:border-amber-400/60';
              } else if (ball.runs >= 1 && ball.runs <= 3) {
                chipStyle =
                  'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-950 dark:border-white';
              }

              return (
                <span
                  key={ball.id || idx}
                  className={`min-w-[28px] h-7 px-1.5 rounded-full border flex items-center justify-center font-score font-black text-[11px] tabular-nums ${chipStyle}`}
                >
                  {chipLabel}
                </span>
              );
            })
          ) : (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Awaiting first ball
            </span>
          )}
        </div>
      </section>

      {/* 6. LIVE SPONSOR / MOBILE AD BANNER STRIP */}
      {renderMobileMonetizationStrip()}

      {/* 7. SIX PRO 3D CRICKET FIXED BOTTOM DOWNLOAD DOCK */}
      <SixProCricketBanner variant="mobile" config={sixProCricket} />

      {/* Live Fan Poll Slide-Up Sheet */}
      {isPollSheetOpen && mobilePollEnabled && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
          onClick={() => setIsPollSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#071022] border border-slate-300 dark:border-slate-700/80 p-3 shadow-2xl space-y-2 text-slate-950 dark:text-white"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Live Fan Poll
              </span>
              <button
                type="button"
                onClick={() => setIsPollSheetOpen(false)}
                aria-label="Close Fan Poll"
                className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <LiveFanPollCard match={match} variant="mobile" />
          </div>
        </div>
      )}

      {renderHubAndScorecardModals()}
    </div>
  );
};
