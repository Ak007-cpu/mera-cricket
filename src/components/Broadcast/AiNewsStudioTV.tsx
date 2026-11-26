import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Newspaper,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Volume2,
  VolumeX
} from 'lucide-react';
import {
  AiNewsBulletin,
  AiNewsStudioConfig,
  AiNewsStudioState
} from '../../types/cricket';
import {
  buildApiUrl,
  fetchAiNewsStudioState,
  getAiNewsBulletinAudioUrl
} from '../../services/api';
import studioBackdropImg from '../../assets/images/studio_newsroom_bg_1795595995886.jpg';
import anchorMaleImg from '../../assets/images/anchor_male_pk_1795595980240.jpg';
import anchorFemaleImg from '../../assets/images/anchor_female_pk_1795595980224.jpg';
import defaultChannelLogo from '../../assets/images/datavault_sports_logo_1795595979043.jpg';

export interface AiNewsStudioTVProps {
  fullScreen?: boolean;
  compact?: boolean;
  nextMatch?: { matchName: string; matchTime: string };
}

const DEFAULT_STUDIO_CONFIG: AiNewsStudioConfig = {
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

const TICKER_DURATIONS_SEC: Record<'slow' | 'normal' | 'fast', number> = {
  slow: 52,
  normal: 34,
  fast: 22
};

function resolveAssetUrl(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/api/')) return buildApiUrl(trimmed);
  return trimmed;
}

export const AiNewsStudioTV: React.FC<AiNewsStudioTVProps> = ({
  fullScreen = false,
  compact = false,
  nextMatch
}) => {
  const [studioState, setStudioState] = useState<AiNewsStudioState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [audioProgressPct, setAudioProgressPct] = useState(0);
  const [studioClock, setStudioClock] = useState(() =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [failedLogo, setFailedLogo] = useState(false);
  const [failedAnchor, setFailedAnchor] = useState(false);
  const [failedStoryImages, setFailedStoryImages] = useState<Record<string, boolean>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeBulletinKeyRef = useRef<string>('');

  const clearPlaybackTimers = useCallback(() => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const stopAllAudio = useCallback(() => {
    clearPlaybackTimers();
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.removeAttribute('src');
      } catch {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsSpeaking(false);
    setIsLoadingAudio(false);
    setAudioProgressPct(0);
  }, [clearPlaybackTimers]);

  // Live studio clock (tabular-nums)
  useEffect(() => {
    const timer = setInterval(() => {
      setStudioClock(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load initial studio state & subscribe to real-time SSE updates
  useEffect(() => {
    let mounted = true;

    const loadInitial = async () => {
      const state = await fetchAiNewsStudioState();
      if (mounted && state) {
        setStudioState(state);
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
            setStudioState(parsed);
          }
        } catch {}
      });
    } catch {}

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
  }, []);

  const config = studioState?.config || DEFAULT_STUDIO_CONFIG;
  const rawBulletins = studioState?.bulletins || [];
  const bulletins = useMemo(() => {
    const filter = config.broadcastCategoryFilter || 'All';
    if (filter === 'All') return rawBulletins;
    const filtered = rawBulletins.filter((b) => b.editorialCategory === filter);
    return filtered.length > 0 ? filtered : rawBulletins;
  }, [rawBulletins, config.broadcastCategoryFilter]);

  useEffect(() => {
    if (bulletins.length > 0 && activeIndex >= bulletins.length) {
      setActiveIndex(0);
    }
  }, [bulletins.length, activeIndex]);

  useEffect(() => {
    setFailedLogo(false);
  }, [config.logoUrl]);

  useEffect(() => {
    setFailedAnchor(false);
  }, [config.anchorId, config.customAnchorImageUrl]);

  const currentBulletin: AiNewsBulletin | null =
    bulletins.length > 0 ? bulletins[activeIndex % bulletins.length] : null;

  const advanceBulletin = useCallback(
    (delta: number) => {
      if (bulletins.length <= 1) return;
      setActiveIndex((prev) => (prev + delta + bulletins.length) % bulletins.length);
    },
    [bulletins.length]
  );

  // Start fallback timed progression (used when muted, autoSpeak off, or audio fails)
  const scheduleTimedAdvance = useCallback(
    (durationSec: number) => {
      clearPlaybackTimers();
      if (isPaused || bulletins.length <= 1) return;
      const ms = Math.max(8, durationSec) * 1000;
      fallbackTimerRef.current = setTimeout(() => {
        advanceBulletin(1);
      }, ms);
    },
    [clearPlaybackTimers, isPaused, bulletins.length, advanceBulletin]
  );

  // Browser Web Speech Urdu fallback ONLY when server TTS endpoint fails/unavailable
  const speakWithBrowserFallback = useCallback(
    (bulletin: AiNewsBulletin) => {
      if (
        typeof window === 'undefined' ||
        !('speechSynthesis' in window) ||
        isMuted ||
        isPaused ||
        !config.autoSpeak
      ) {
        scheduleTimedAdvance(config.bulletinDurationSec);
        return;
      }

      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(bulletin.urduScript);
        const voices = window.speechSynthesis.getVoices();
        const urVoice =
          voices.find((v) => v.lang.toLowerCase().startsWith('ur-pk')) ||
          voices.find((v) => v.lang.toLowerCase().startsWith('ur')) ||
          voices.find((v) => v.lang.toLowerCase().includes('hi'));
        if (urVoice) {
          utterance.voice = urVoice;
          utterance.lang = urVoice.lang;
        } else {
          utterance.lang = 'ur-PK';
        }
        utterance.rate = config.speechRate || 1.0;

        utterance.onstart = () => {
          setIsSpeaking(true);
          setAudioProgressPct(15);
        };
        utterance.onend = () => {
          setIsSpeaking(false);
          setAudioProgressPct(100);
          if (!isPaused && bulletins.length > 1) {
            advanceTimeoutRef.current = setTimeout(() => advanceBulletin(1), 1800);
          }
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          scheduleTimedAdvance(config.bulletinDurationSec);
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
        scheduleTimedAdvance(config.bulletinDurationSec);
      }
    },
    [
      isMuted,
      isPaused,
      config.autoSpeak,
      config.speechRate,
      config.bulletinDurationSec,
      bulletins.length,
      advanceBulletin,
      scheduleTimedAdvance
    ]
  );

  const startBulletinVoice = useCallback(
    async (bulletin: AiNewsBulletin) => {
      stopAllAudio();
      if (isPaused) return;

      if (isMuted || !config.autoSpeak) {
        scheduleTimedAdvance(config.bulletinDurationSec);
        return;
      }

      const audioEl = audioRef.current;
      if (!audioEl) {
        scheduleTimedAdvance(config.bulletinDurationSec);
        return;
      }

      const key = `${bulletin.id}_${config.voiceName}`;
      activeBulletinKeyRef.current = key;
      setIsLoadingAudio(true);

      const audioUrl = getAiNewsBulletinAudioUrl(bulletin.id, config.voiceName);

      try {
        audioEl.src = audioUrl;
        audioEl.playbackRate = config.speechRate || 1.0;
        audioEl.muted = false;
        await audioEl.play();
        if (activeBulletinKeyRef.current !== key) return;
        setAutoplayBlocked(false);
        setIsLoadingAudio(false);
        setIsSpeaking(true);
      } catch (err: any) {
        if (activeBulletinKeyRef.current !== key) return;
        setIsLoadingAudio(false);

        const errName = String(err?.name || '');
        if (errName === 'NotAllowedError') {
          // Browser blocked unmuted autoplay prior to user interaction
          setAutoplayBlocked(true);
          setIsSpeaking(false);
          scheduleTimedAdvance(config.bulletinDurationSec);
        } else {
          // Audio synthesis failed or unavailable -> fallback cleanly
          speakWithBrowserFallback(bulletin);
        }
      }
    },
    [
      stopAllAudio,
      isPaused,
      isMuted,
      config.autoSpeak,
      config.voiceName,
      config.speechRate,
      config.bulletinDurationSec,
      scheduleTimedAdvance,
      speakWithBrowserFallback
    ]
  );

  // Trigger audio playback whenever active bulletin, pause state, mute, or voice changes
  useEffect(() => {
    if (!currentBulletin || isPaused) {
      stopAllAudio();
      return;
    }
    startBulletinVoice(currentBulletin);

    return () => {
      stopAllAudio();
    };
  }, [
    currentBulletin?.id,
    config.voiceName,
    config.autoSpeak,
    isPaused,
    isMuted,
    startBulletinVoice,
    stopAllAudio
  ]);

  // Keep speech rate updated live
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = config.speechRate || 1.0;
    }
  }, [config.speechRate]);

  // Attach HTMLAudioElement listeners
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const handleTimeUpdate = () => {
      if (audioEl.duration && Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
        const pct = Math.min(100, Math.max(0, (audioEl.currentTime / audioEl.duration) * 100));
        setAudioProgressPct(pct);
      }
    };

    const handleEnded = () => {
      setIsSpeaking(false);
      setAudioProgressPct(100);
      if (!isPaused && bulletins.length > 1) {
        advanceTimeoutRef.current = setTimeout(() => {
          advanceBulletin(1);
        }, 1800);
      } else if (!isPaused && bulletins.length === 1) {
        advanceTimeoutRef.current = setTimeout(() => {
          if (currentBulletin) startBulletinVoice(currentBulletin);
        }, 5000);
      }
    };

    const handleError = () => {
      setIsLoadingAudio(false);
      setIsSpeaking(false);
      if (currentBulletin && !isPaused && !isMuted && config.autoSpeak) {
        speakWithBrowserFallback(currentBulletin);
      } else {
        scheduleTimedAdvance(config.bulletinDurationSec);
      }
    };

    audioEl.addEventListener('timeupdate', handleTimeUpdate);
    audioEl.addEventListener('ended', handleEnded);
    audioEl.addEventListener('error', handleError);

    return () => {
      audioEl.removeEventListener('timeupdate', handleTimeUpdate);
      audioEl.removeEventListener('ended', handleEnded);
      audioEl.removeEventListener('error', handleError);
    };
  }, [
    isPaused,
    isMuted,
    bulletins.length,
    currentBulletin,
    config.autoSpeak,
    config.bulletinDurationSec,
    advanceBulletin,
    startBulletinVoice,
    speakWithBrowserFallback,
    scheduleTimedAdvance
  ]);

  const handleEnableAudioClick = () => {
    setAutoplayBlocked(false);
    setIsMuted(false);
    if (currentBulletin && !isPaused) {
      startBulletinVoice(currentBulletin);
    }
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        stopAllAudio();
        scheduleTimedAdvance(config.bulletinDurationSec);
      } else {
        setAutoplayBlocked(false);
      }
      return next;
    });
  };

  const resolvedLogo = !failedLogo && config.logoUrl ? resolveAssetUrl(config.logoUrl) : defaultChannelLogo;
  const resolvedAnchorImg =
    !failedAnchor && config.anchorId === 'custom' && config.customAnchorImageUrl
      ? resolveAssetUrl(config.customAnchorImageUrl)
      : config.anchorId === 'female_pk'
      ? anchorFemaleImg
      : anchorMaleImg;

  const resolvedStoryImg = currentBulletin?.imageUrl ? resolveAssetUrl(currentBulletin.imageUrl) : '';
  const showStoryImg =
    Boolean(currentBulletin && resolvedStoryImg && !failedStoryImages[currentBulletin.id]);

  const tickerDurationSec = TICKER_DURATIONS_SEC[config.tickerSpeed || 'normal'] || 34;

  const tickerText = useMemo(() => {
    const manualRaw = (config.broadcastTickerManualText || '').trim();
    const manualItems = manualRaw
      ? manualRaw
          .split(/\r?\n|\||•/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    if (config.broadcastTickerMode === 'manual' && manualItems.length > 0) {
      return manualItems.join('    ❖    ');
    }

    const aiItems =
      bulletins.length > 0
        ? bulletins.map((b) => {
            const prefix = b.isBreaking ? '🔴 بریکنگ نیوز: ' : '';
            return `${prefix}${b.tickerUrdu}  •  ${b.tickerEnglish}`;
          })
        : [];

    if (config.broadcastTickerMode === 'combined' && manualItems.length > 0) {
      return [...manualItems, ...aiItems].join('    ❖    ');
    }

    if (aiItems.length === 0) {
      return `${config.companyName} • تازہ ترین کرکٹ اور اسپورٹس خبریں جلد نشر کی جا رہی ہیں • Verified Global Cricket & Sports Network`;
    }
    return aiItems.join('    ❖    ');
  }, [
    bulletins,
    config.companyName,
    config.broadcastTickerMode,
    config.broadcastTickerManualText
  ]);

  const stageContent = (
    <div className="relative w-full h-full overflow-hidden bg-[#030916] text-white flex flex-col justify-between select-none">
      {/* Hidden Studio WAV Player */}
      <audio ref={audioRef} preload="auto" className="hidden" />

      {/* 1. HD Studio Background Layer */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <img
          src={studioBackdropImg}
          alt="DATA VAULT SPORTS HD Broadcast Studio"
          className="w-full h-full object-cover object-center opacity-45 scale-[1.02]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(105deg, rgba(2,6,23,0.92) 0%, rgba(4,16,38,0.78) 52%, rgba(2,8,20,0.86) 100%)'
          }}
        />
        {/* Studio Wall Subtle Watermark Branding */}
        <div className="absolute top-14 inset-x-0 flex justify-center opacity-[0.07]">
          <span className="font-score text-3xl sm:text-5xl lg:text-6xl font-black tracking-[0.22em] uppercase text-emerald-300 whitespace-nowrap">
            {config.companyName}
          </span>
        </div>
      </div>

      {/* 2. Top Studio Header Bar & Channel Branding Bug */}
      <header className="relative z-20 flex items-center justify-between gap-2 px-3 sm:px-5 py-2 bg-slate-950/85 backdrop-blur-md border-b border-emerald-400/25 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden border border-amber-400/50 bg-slate-900 shrink-0 shadow-[0_0_16px_rgba(245,158,11,0.25)]">
            <img
              src={resolvedLogo}
              alt={config.companyName}
              referrerPolicy="no-referrer"
              onError={() => setFailedLogo(true)}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-score font-black text-xs sm:text-base tracking-wider uppercase text-white truncate">
                {config.companyName}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-score text-[9px] sm:text-[10px] font-black tracking-wider uppercase whitespace-nowrap shrink-0">
                AI STUDIO
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-300">
              <span className="inline-flex items-center gap-1 text-rose-400 font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-live-dot" />
                ON AIR • اردو اسپورٹس نیوز
              </span>
              {nextMatch?.matchName && (
                <span className="hidden md:inline text-amber-300/90 truncate">
                  • Next Live: {nextMatch.matchName} {nextMatch.matchTime ? `(${nextMatch.matchTime})` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Studio Clock & Broadcast Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="hidden sm:inline-block px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700/80 font-mono text-[11px] font-bold text-sky-300 tabular-nums whitespace-nowrap">
            {studioClock}
          </span>

          {bulletins.length > 0 && (
            <span className="px-2 py-1 rounded-md bg-slate-900/90 border border-slate-700 text-[11px] font-score font-bold text-slate-200 tabular-nums whitespace-nowrap">
              {String((activeIndex % bulletins.length) + 1).padStart(2, '0')}/
              {String(bulletins.length).padStart(2, '0')}
            </span>
          )}

          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Unmute Urdu News Anchor' : 'Mute Urdu News Anchor'}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              isMuted
                ? 'bg-rose-500/20 border-rose-400/50 text-rose-200 hover:bg-rose-500/30'
                : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/30'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Voice ON'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (currentBulletin) {
                setAutoplayBlocked(false);
                setIsMuted(false);
                setIsPaused(false);
                startBulletinVoice(currentBulletin);
              }
            }}
            title="Replay current Urdu bulletin"
            aria-label="Replay Urdu bulletin"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            aria-label={isPaused ? 'Resume broadcast' : 'Pause broadcast'}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors shrink-0"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          {bulletins.length > 1 && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => advanceBulletin(-1)}
                aria-label="Previous story"
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => advanceBulletin(1)}
                aria-label="Next story"
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 shrink-0"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Breaking News Stinger Banner */}
      {currentBulletin?.isBreaking && (
        <div className="relative z-20 bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 border-b border-rose-300/40 px-4 py-1 flex items-center justify-between gap-3 shrink-0 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span className="font-score text-[11px] font-black uppercase tracking-[0.2em] text-white">
              BREAKING SPORTS ALERT
            </span>
          </div>
          <span dir="rtl" className="font-urdu text-xs sm:text-sm font-bold text-amber-200">
            بریکنگ نیوز • {config.companyName}
          </span>
        </div>
      )}

      {/* 3. Main Studio Broadcast Stage */}
      <div
        className={`relative z-10 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 ${
          compact ? 'p-2.5 sm:p-3.5' : 'p-3 sm:p-5 lg:p-6'
        } items-stretch`}
      >
        {/* LEFT: Studio LED Newsroom Video Wall (Headlines, Player Photo, Team Flag, Verified Sources) */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl bg-slate-950/75 backdrop-blur-md border border-sky-400/25 shadow-[0_18px_50px_rgba(0,0,0,0.65)] overflow-hidden">
          {currentBulletin ? (
            <>
              {/* LED Monitor Header Strip */}
              <div className="flex items-center justify-between gap-2 px-4 py-2 bg-gradient-to-r from-emerald-950/90 via-slate-900/95 to-sky-950/90 border-b border-emerald-400/20">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-score font-black uppercase tracking-wider whitespace-nowrap ${
                      currentBulletin.isBreaking
                        ? 'bg-rose-600 text-white'
                        : 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                    }`}
                  >
                    {currentBulletin.editorialCategory || currentBulletin.categoryLabel}
                  </span>
                  {currentBulletin.editorialCategory &&
                    currentBulletin.categoryLabel &&
                    currentBulletin.editorialCategory.toLowerCase() !==
                      currentBulletin.categoryLabel.toLowerCase() && (
                      <span className="hidden sm:inline text-[11px] font-bold text-slate-300 truncate">
                        {currentBulletin.categoryLabel}
                      </span>
                    )}
                  <span dir="rtl" className="font-urdu text-xs font-bold text-amber-300 truncate">
                    {currentBulletin.categoryUrdu}
                  </span>
                </div>

                <span className="font-mono text-[11px] text-slate-400 shrink-0 tabular-nums">
                  {currentBulletin.publishedAt}
                </span>
              </div>

              {/* LED Story Body */}
              <div className="flex-1 min-h-0 p-3.5 sm:p-5 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                {/* Player Portrait / Team Crest / Studio Emblem Box */}
                <div className="w-28 h-32 sm:w-36 sm:h-44 rounded-xl overflow-hidden bg-gradient-to-b from-slate-800 to-slate-950 border border-amber-400/35 shrink-0 relative shadow-xl flex items-center justify-center">
                  {showStoryImg ? (
                    <img
                      src={resolvedStoryImg}
                      alt={currentBulletin.matchedPlayerName || currentBulletin.matchedTeamCode || 'Sports News'}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedStoryImages((prev) => ({ ...prev, [currentBulletin.id]: true }))
                      }
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <img
                      src={resolvedLogo}
                      alt={config.companyName}
                      className="w-20 h-20 object-contain opacity-85"
                    />
                  )}

                  {(currentBulletin.matchedPlayerName || currentBulletin.matchedTeamCode) && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent px-2 py-1.5 text-center">
                      <div className="text-[11px] font-black text-white truncate">
                        {currentBulletin.matchedPlayerName || currentBulletin.matchedTeamCode}
                      </div>
                      {currentBulletin.matchedPlayerName && currentBulletin.matchedTeamCode && (
                        <div className="text-[9px] font-score font-bold uppercase tracking-widest text-amber-300">
                          {currentBulletin.matchedTeamCode}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Urdu Headline + English Subhead + Verified Key Takeaways */}
                <div className="flex-1 min-w-0 w-full space-y-2.5 text-right" dir="rtl">
                  <h2
                    className={`font-urdu font-extrabold text-white leading-relaxed ${
                      fullScreen ? 'text-xl sm:text-2xl lg:text-3xl' : 'text-base sm:text-xl lg:text-2xl'
                    }`}
                  >
                    {currentBulletin.urduHeadline}
                  </h2>

                  <p
                    dir="ltr"
                    className="text-left text-xs sm:text-sm font-semibold text-sky-200/95 leading-snug border-l-2 border-amber-400 pl-2.5"
                  >
                    {currentBulletin.englishHeadline}
                  </p>

                  {currentBulletin.urduSummaryPoints.length > 0 && (
                    <ul className="space-y-1.5 pt-1">
                      {currentBulletin.urduSummaryPoints.map((pt, i) => (
                        <li
                          key={i}
                          className="font-urdu text-xs sm:text-sm text-slate-200 flex items-start gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2.5 shrink-0" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Verified Grounding Sources Footer */}
              {config.showSourcesOnScreen && currentBulletin.sources.length > 0 && (
                <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-emerald-300 font-bold shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verified Sources:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    {currentBulletin.sources.map((src, idx) => (
                      <a
                        key={`${src.url}_${idx}`}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-200 hover:text-white transition-colors truncate max-w-[190px]"
                      >
                        <span className="truncate">{src.name}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-75" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
              {studioState?.isFetching ? (
                <>
                  <RefreshCw className="w-9 h-9 text-emerald-400 animate-spin" />
                  <div className="text-sm sm:text-base font-black text-white">
                    Gathering Verified Cricket &amp; Sports News via Google Search...
                  </div>
                  <p className="text-xs text-slate-400 max-w-md">
                    {config.companyName} AI Newsroom is verifying headlines and preparing Urdu broadcast scripts.
                  </p>
                </>
              ) : studioState?.lastError ? (
                <>
                  <Newspaper className="w-9 h-9 text-amber-400" />
                  <div className="text-sm font-black text-amber-200">
                    AI Newsroom Standby
                  </div>
                  <p className="text-xs text-rose-300 max-w-md bg-rose-950/40 border border-rose-500/30 rounded-xl px-3 py-2">
                    {studioState.lastError}
                  </p>
                </>
              ) : (
                <>
                  <Radio className="w-9 h-9 text-sky-400 animate-pulse" />
                  <div className="text-sm sm:text-base font-black text-white">
                    {config.companyName} • Urdu Sports Studio
                  </div>
                  <p className="text-xs text-slate-400">
                    Waiting for verified sports news bulletins...
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: AI Urdu News Presenter Desk & Live Teleprompter */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/95 border border-amber-400/30 shadow-[0_18px_50px_rgba(0,0,0,0.7)] overflow-hidden relative">
          {/* Studio Anchor Backdrop & Portrait */}
          <div className="relative flex-1 min-h-[210px] sm:min-h-[250px] flex items-end justify-center overflow-hidden bg-gradient-to-b from-[#08152b] via-[#040c1d] to-[#02050d]">
            {/* Ambient studio rim glow reactive to speaking */}
            <div
              className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
                isSpeaking ? 'opacity-100' : 'opacity-45'
              }`}
              style={{
                background:
                  'radial-gradient(circle at 50% 38%, rgba(16, 185, 129, 0.24) 0%, rgba(14, 165, 233, 0.12) 42%, transparent 72%)'
              }}
            />

            {/* Top Studio Desk Corner Bug */}
            <div className="absolute top-2.5 left-3 right-3 z-20 flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/65 backdrop-blur-md border border-white/15">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isSpeaking
                      ? 'bg-emerald-400 animate-ping'
                      : isLoadingAudio
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-sky-400'
                  }`}
                />
                <span className="font-score text-[10px] font-black uppercase tracking-wider text-white whitespace-nowrap">
                  {isSpeaking
                    ? 'ANCHOR LIVE'
                    : isLoadingAudio
                    ? 'PREPARING VOICE'
                    : isPaused
                    ? 'PAUSED'
                    : 'STUDIO READY'}
                </span>
              </div>

              {/* Audio Visualizer Equalizer Bars */}
              <div
                aria-hidden="true"
                className="flex items-end gap-1 h-5 px-2 py-1 rounded-md bg-black/60 border border-white/10"
              >
                {[0, 120, 240, 90, 180].map((delayMs, idx) => (
                  <span
                    key={idx}
                    className={`w-1 rounded-full ${
                      isSpeaking
                        ? 'bg-emerald-400 animate-eq-bar h-3.5'
                        : 'bg-slate-600 h-1'
                    }`}
                    style={isSpeaking ? { animationDelay: `${delayMs}ms` } : undefined}
                  />
                ))}
              </div>
            </div>

            {/* Autoplay Unblock Prompt if Browser Requires First Click */}
            {autoplayBlocked && !isMuted && (
              <div className="absolute inset-x-4 top-12 z-30 flex justify-center">
                <button
                  type="button"
                  onClick={handleEnableAudioClick}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-2xl inline-flex items-center gap-2 border-2 border-white/70 whitespace-nowrap"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Tap for Urdu Studio Voice</span>
                </button>
              </div>
            )}

            {/* AI Anchor Image */}
            <img
              src={resolvedAnchorImg}
              alt={config.anchorName}
              referrerPolicy="no-referrer"
              onError={() => setFailedAnchor(true)}
              className={`relative z-10 h-full max-h-[290px] sm:max-h-[340px] w-auto object-contain object-bottom drop-shadow-[0_10px_28px_rgba(0,0,0,0.85)] ${
                isSpeaking ? 'animate-anchor-speak' : 'animate-anchor-breathe'
              }`}
            />

            {/* Glossy Studio News Desk Lower Third Plate */}
            <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-r from-slate-950/95 via-[#071836]/95 to-slate-950/95 border-t-2 border-amber-400/70 px-3.5 py-2 flex items-center justify-between gap-2 shadow-2xl">
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-black text-white tracking-wide uppercase truncate">
                  {config.anchorName}
                </div>
                <div className="text-[10px] font-bold text-amber-300 uppercase tracking-widest truncate">
                  {config.anchorTitle}
                </div>
              </div>
              <div className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 font-score text-[9px] font-black text-emerald-200 uppercase tracking-wider whitespace-nowrap shrink-0">
                {config.companyName}
              </div>
            </div>
          </div>

          {/* Urdu Spoken Broadcast Script / Live Teleprompter */}
          <div className="bg-slate-950/95 border-t border-slate-800 px-3.5 py-2.5 space-y-2 shrink-0">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Urdu Broadcast Script</span>
              <span className="text-emerald-300 font-score">Voice: {config.voiceName}</span>
            </div>
            <p
              dir="rtl"
              className="font-urdu text-xs sm:text-sm text-slate-100 leading-relaxed line-clamp-3 min-h-[3.4rem]"
            >
              {currentBulletin?.urduScript ||
                `${config.companyName} کے اسٹوڈیو میں خوش آمدید۔ تازہ ترین تصدیق شدہ اسپورٹس خبریں جلد پیش کی جا رہی ہیں۔`}
            </p>
            {/* Audio Progress Line */}
            <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-400 transition-all duration-300"
                style={{ width: `${audioProgressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Scrolling Broadcast News Ticker */}
      <footer className="relative z-20 bg-amber-400 text-slate-950 flex items-center overflow-hidden border-t-2 border-amber-300 shrink-0 shadow-2xl">
        <div className="px-3 sm:px-4 py-1.5 bg-slate-950 text-amber-300 font-score text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 border-r border-amber-400/40">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span className="whitespace-nowrap">{config.companyName}</span>
        </div>

        <div className="relative flex-1 overflow-hidden py-1.5 px-3">
          <div
            className={`flex w-max whitespace-nowrap text-xs sm:text-sm font-extrabold animate-ticker-marquee ${
              isPaused ? 'ticker-paused' : ''
            }`}
            style={{ animationDuration: `${tickerDurationSec}s` }}
          >
            <span className="font-urdu pr-12">{tickerText}</span>
            <span className="font-urdu pr-12" aria-hidden="true">
              {tickerText}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen w-full bg-[#02050e] flex items-center justify-center p-2 sm:p-4">
        <div className="w-full max-w-[1440px] aspect-video rounded-2xl overflow-hidden border border-emerald-400/35 shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
          {stageContent}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1380px] mx-auto aspect-[16/10] sm:aspect-video rounded-2xl overflow-hidden border border-emerald-400/30 shadow-[0_24px_75px_rgba(0,0,0,0.75)]">
      {stageContent}
    </div>
  );
};
