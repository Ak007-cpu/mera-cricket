import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MatchState, ActiveMatchConfig, MonetizationConfig, LiveViewerStats } from './types/cricket';
import {
  fetchActiveMatch,
  fetchMonetizationConfig,
  buildApiUrl,
  verifyAdminPin,
  getViewerSessionId,
  pingViewerPresence
} from './services/api';
import { nativeNotifications } from './services/nativeNotifications';
import { useContent } from './context/ContentContext';
import { ThemeProvider } from './context/ThemeContext';
import { AndroidAppView } from './components/AndroidApp/AndroidAppView';
import { StudioAdmin } from './components/Studio/StudioAdmin';
import { OBSOverlay } from './components/OBS/OBSOverlay';
import { BroadcastView } from './components/Broadcast/BroadcastView';
import { syncAdSenseHeadTags } from './components/Broadcast/AdSlot';
import { LegalPages, LegalPageType } from './components/Legal/LegalPages';
import { NewsPage } from './components/Public/NewsPage';
import { BlogListPage, BlogArticlePage } from './components/Public/BlogPages';
import { OfflineIndicator } from './components/PWA/OfflineIndicator';
import { AiNewsStudioTV } from './components/Broadcast/AiNewsStudioTV';
import { Lock, X } from 'lucide-react';

type ActiveView = 'broadcast' | 'admin' | 'overlay' | 'android' | 'news-tv';
type PublicPageType = LegalPageType | 'news' | 'blog';

function isLikelyMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  const hasCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return window.innerWidth < 768 && (isMobileUa || hasCoarsePointer);
}

function getInitialView(): ActiveView {
  if (typeof window === 'undefined') return 'broadcast';
  const params = new URLSearchParams(window.location.search);
  const v = params.get('view')?.toLowerCase();
  if (v === 'admin' || v === 'studio') return 'admin';
  if (v === 'overlay' || v === 'obs') return 'overlay';
  if (v === 'android' || v === 'app') return 'android';
  if (v === 'news-tv' || v === 'news_tv') return 'news-tv';
  if (v === 'broadcast' || v === 'tv') return 'broadcast';
  try {
    const savedPref = window.sessionStorage.getItem('crex_view_pref');
    if (savedPref === 'broadcast' || savedPref === 'android') {
      return savedPref;
    }
  } catch {
    // ignore storage errors
  }
  if (isLikelyMobileDevice()) {
    return 'android';
  }
  return 'broadcast';
}

function getInitialPublicRoute(): { page: PublicPageType | null; article: string | null } {
  if (typeof window === 'undefined') return { page: null, article: null };
  const params = new URLSearchParams(window.location.search);
  const p = params.get('page')?.toLowerCase();
  const article = params.get('article');
  if (p === 'privacy' || p === 'terms' || p === 'contact' || p === 'news' || p === 'blog') {
    return { page: p, article: p === 'blog' ? article : null };
  }
  return { page: null, article: null };
}

export default function App() {
  const { applyContentOverridesToMatch, mergeMonetization } = useContent();

  const [currentView, setCurrentView] = useState<ActiveView>(getInitialView);
  const [publicRoute, setPublicRoute] = useState<{ page: PublicPageType | null; article: string | null }>(
    getInitialPublicRoute
  );
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [matchConfig, setMatchConfig] = useState<ActiveMatchConfig | null>(null);
  const [monetizationConfig, setMonetizationConfig] = useState<MonetizationConfig | null>(null);
  const [viewerStats, setViewerStats] = useState<LiveViewerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdminKeyModal, setShowAdminKeyModal] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [adminKeyError, setAdminKeyError] = useState('');
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const returnViewRef = useRef<'broadcast' | 'android'>('broadcast');
  const viewerSidRef = useRef<string>(getViewerSessionId());

  const openAdminKeyModal = useCallback(() => {
    try {
      const sessionUnlocked = window.sessionStorage.getItem('crex_admin_session_unlocked') === '1';
      const savedPin = localStorage.getItem('crex_admin_pin');
      if (sessionUnlocked && savedPin) {
        returnViewRef.current = currentView === 'android' ? 'android' : 'broadcast';
        setShowAdminKeyModal(false);
        setCurrentView('admin');
        return;
      }
    } catch {
      // ignore storage errors
    }
    setAdminKeyInput('');
    setAdminKeyError('');
    setShowAdminKeyModal(true);
  }, [currentView]);

  const switchViewMode = useCallback((nextView: 'broadcast' | 'android') => {
    try {
      window.sessionStorage.setItem('crex_view_pref', nextView);
    } catch {
      // ignore storage errors
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('view')) {
        url.searchParams.delete('view');
        window.history.replaceState({}, '', url.toString());
      }
    }
    setCurrentView(nextView);
  }, []);

  const handleAdminKeySubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = adminKeyInput.trim();
      if (!trimmed) {
        setAdminKeyError('Enter Admin Key / PIN');
        return;
      }
      setIsVerifyingKey(true);
      setAdminKeyError('');
      try {
        const res = await verifyAdminPin(trimmed);
        const ok = typeof res === 'boolean' ? res : res.authorized;
        if (ok) {
          localStorage.setItem('crex_admin_pin', trimmed);
          try {
            window.sessionStorage.setItem('crex_admin_session_unlocked', '1');
          } catch {}
          returnViewRef.current = currentView === 'android' ? 'android' : 'broadcast';
          setShowAdminKeyModal(false);
          setAdminKeyInput('');
          setCurrentView('admin');
        } else {
          setAdminKeyError(typeof res === 'object' && res.error ? res.error : 'Invalid Admin Key');
        }
      } catch {
        setAdminKeyError('Verification failed');
      } finally {
        setIsVerifyingKey(false);
      }
    },
    [adminKeyInput, currentView]
  );

  // PC Keyboard Shortcuts:
  // - F9 / Alt + Shift + A / Ctrl + Alt + A: Open / Exit Studio Admin
  // - Alt + Shift + M: Toggle Mobile App Preview <-> Broadcast View
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (currentView === 'overlay') return;
      if (e.key === 'Escape' && showAdminKeyModal) {
        setShowAdminKeyModal(false);
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable) return;

      const isAdminShortcut =
        e.key === 'F9' ||
        e.code === 'F9' ||
        (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyA') ||
        (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && e.code === 'KeyA');

      if (isAdminShortcut) {
        e.preventDefault();
        if (currentView === 'admin') {
          setCurrentView(returnViewRef.current);
        } else {
          openAdminKeyModal();
        }
        return;
      }
      if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyM') {
        e.preventDefault();
        setShowAdminKeyModal(false);
        if (currentView === 'android') {
          switchViewMode('broadcast');
        } else {
          switchViewMode('android');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentView, showAdminKeyModal, openAdminKeyModal, switchViewMode]);

  const navigatePublicPage = useCallback((page: PublicPageType | null, articleSlugOrId?: string | null) => {
    const nextArticle = page === 'blog' ? articleSlugOrId || null : null;
    setPublicRoute({ page, article: nextArticle });
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (page) {
        url.searchParams.set('page', page);
      } else {
        url.searchParams.delete('page');
      }
      if (nextArticle) {
        url.searchParams.set('article', nextArticle);
      } else {
        url.searchParams.delete('article');
      }
      window.history.pushState({}, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const navigateLegalPage = useCallback(
    (page: LegalPageType | null) => {
      navigatePublicPage(page);
    },
    [navigatePublicPage]
  );

  // Sync route if browser URL changes via popstate
  useEffect(() => {
    const handleUrlChange = () => {
      setCurrentView(getInitialView());
      setPublicRoute(getInitialPublicRoute());
    };

    window.addEventListener('popstate', handleUrlChange);

    // Initialize native notifications on mobile Android
    nativeNotifications.init(() => {
      setCurrentView('android');
    });

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Fetch match state from backend
  const refreshMatch = useCallback(async () => {
    try {
      const res = await fetchActiveMatch();
      setMatchState(res.data);
      setMatchConfig(res.config);
    } catch (err) {
      console.warn('Could not fetch active match:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Central background synchronization (SSE stream + fallback polling)
  useEffect(() => {
    refreshMatch();

    fetchMonetizationConfig().then((cfg) => {
      if (cfg) setMonetizationConfig(cfg);
    });

    let eventSource: EventSource | null = null;
    let fallbackPoll: NodeJS.Timeout | null = null;

    try {
      const sid = encodeURIComponent(viewerSidRef.current);
      const initialView = encodeURIComponent(getInitialView());
      const sseUrl = buildApiUrl(`/api/match/stream?sid=${sid}&view=${initialView}`);
      eventSource = new EventSource(sseUrl);

      eventSource.addEventListener('monetization', (event: MessageEvent) => {
        try {
          const parsedConfig = JSON.parse(event.data);
          if (parsedConfig && typeof parsedConfig === 'object') {
            setMonetizationConfig(parsedConfig);
          }
        } catch {}
      });

      eventSource.addEventListener('viewers', (event: MessageEvent) => {
        try {
          const parsedStats = JSON.parse(event.data);
          if (parsedStats && typeof parsedStats.total === 'number') {
            setViewerStats(parsedStats);
          }
        } catch {}
      });

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.matchState !== undefined) {
            setMatchState(parsed.matchState);
            setMatchConfig(parsed.config);
            setIsLoading(false);
          }
        } catch (e) {
          console.warn('Error parsing SSE event:', e);
        }
      };

      eventSource.onerror = () => {
        if (!fallbackPoll) {
          fallbackPoll = setInterval(refreshMatch, 3000);
        }
      };
    } catch {
      fallbackPoll = setInterval(refreshMatch, 3000);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackPoll) clearInterval(fallbackPoll);
    };
  }, [refreshMatch]);

  // Real-time Viewer Presence Heartbeat & View Switch Sync
  useEffect(() => {
    const sid = viewerSidRef.current;
    const presenceView = currentView === 'news-tv' ? 'broadcast' : currentView;
    pingViewerPresence(sid, presenceView);

    const interval = setInterval(() => {
      pingViewerPresence(sid, presenceView);
    }, 20000);

    const handleLeave = () => {
      pingViewerPresence(sid, presenceView, true);
    };
    window.addEventListener('pagehide', handleLeave);

    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', handleLeave);
    };
  }, [currentView]);

  // Ensure true alpha transparency on <html> and <body> when rendering OBS Overlay (?view=overlay)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const isObs = currentView === 'overlay';
    document.documentElement.classList.toggle('obs-transparent', isObs);
    return () => {
      document.documentElement.classList.remove('obs-transparent');
    };
  }, [currentView]);

  const effectiveMatch = useMemo(
    () => applyContentOverridesToMatch(matchState),
    [matchState, applyContentOverridesToMatch]
  );

  const effectiveMonetization = useMemo(
    () => mergeMonetization(monetizationConfig),
    [monetizationConfig, mergeMonetization]
  );

  // Sync Google AdSense verification meta tag & Auto Ads script on public viewer routes only
  useEffect(() => {
    const isPublicViewer = currentView === 'broadcast' || currentView === 'android';
    const adsEnabled = Boolean(effectiveMonetization?.adsEnabled);
    const autoAds = effectiveMonetization?.adsenseAutoAds !== false;
    const anyAdSenseSlot = Boolean(
      effectiveMonetization?.slots?.topBanner?.slotId?.trim() ||
        effectiveMonetization?.slots?.inContent?.slotId?.trim() ||
        effectiveMonetization?.slots?.footerBanner?.slotId?.trim() ||
        effectiveMonetization?.slots?.mobileBanner?.slotId?.trim()
    );
    syncAdSenseHeadTags({
      publisherId: effectiveMonetization?.adsensePublisherId,
      allowPublicAds: isPublicViewer,
      loadScript: isPublicViewer && adsEnabled && (autoAds || anyAdSenseSlot)
    });
  }, [currentView, effectiveMonetization]);

  // Public Standalone Pages (?page=news, ?page=blog, ?page=privacy|terms|contact)
  if (currentView === 'broadcast' && publicRoute.page === 'news') {
    return (
      <NewsPage
        siteName={effectiveMonetization?.siteName}
        onBackToBroadcast={() => navigatePublicPage(null)}
        onOpenBlog={() => navigatePublicPage('blog')}
      />
    );
  }

  if (currentView === 'broadcast' && publicRoute.page === 'blog') {
    if (publicRoute.article) {
      return (
        <BlogArticlePage
          articleSlugOrId={publicRoute.article}
          siteName={effectiveMonetization?.siteName}
          onBackToBlogList={() => navigatePublicPage('blog', null)}
          onBackToBroadcast={() => navigatePublicPage(null)}
        />
      );
    }
    return (
      <BlogListPage
        siteName={effectiveMonetization?.siteName}
        onSelectArticle={(slugOrId) => navigatePublicPage('blog', slugOrId)}
        onBackToBroadcast={() => navigatePublicPage(null)}
        onOpenNews={() => navigatePublicPage('news')}
      />
    );
  }

  if (
    currentView === 'broadcast' &&
    (publicRoute.page === 'privacy' || publicRoute.page === 'terms' || publicRoute.page === 'contact')
  ) {
    return (
      <LegalPages
        page={publicRoute.page}
        siteName={effectiveMonetization?.siteName}
        contactEmail={effectiveMonetization?.contactEmail}
        onNavigatePage={navigateLegalPage}
      />
    );
  }

  const isObsOverlay = currentView === 'overlay';
  const isAdminView = currentView === 'admin';
  const isAndroidView = currentView === 'android';

  return (
    <ThemeProvider forceDark={isObsOverlay || isAdminView}>
      <div
        className={`min-h-screen font-sans transition-colors duration-200 ${
          isObsOverlay
            ? 'bg-transparent text-slate-100'
            : 'bg-slate-100 dark:bg-[#030712] text-slate-950 dark:text-slate-100'
        }`}
      >
        {/* Offline Toast Indicator (hidden on OBS overlay) */}
        {!isObsOverlay && <OfflineIndicator />}

      {/* Main View Render - Default is Public Broadcast with NO top navigation bar or admin button */}
      {currentView === 'broadcast' && (
        <BroadcastView
          match={effectiveMatch}
          monetization={effectiveMonetization}
          isLoading={isLoading}
          hideAppDownload={isAndroidView}
          animationsEnabled={effectiveMonetization?.broadcastSettings?.animationsEnabled ?? true}
          onOpenLegalPage={navigateLegalPage}
          onOpenNews={() => navigatePublicPage('news')}
          onOpenBlog={() => navigatePublicPage('blog')}
          onSecretAdminTrigger={openAdminKeyModal}
          onSwitchToMobile={() => switchViewMode('android')}
        />
      )}

      {/* Hidden Link / Secret Key: Studio Admin with PIN protection + Cloud Sync - NO ADS */}
      {currentView === 'admin' && (
        <div className="min-h-screen py-4 sm:py-6">
          <StudioAdmin
            match={matchState}
            config={matchConfig}
            viewerStats={viewerStats}
            onRefresh={refreshMatch}
            onViewBroadcast={() => switchViewMode('broadcast')}
            onViewMobile={() => switchViewMode('android')}
            onExitAdmin={() => {
              if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                const v = url.searchParams.get('view')?.toLowerCase();
                if (v === 'admin' || v === 'studio') {
                  url.searchParams.delete('view');
                  window.history.replaceState({}, '', url.toString());
                }
              }
              setCurrentView(returnViewRef.current);
            }}
          />
        </div>
      )}

      {/* Hidden Link: ?view=overlay (Clean OBS Browser Source overlay - NO ADS) */}
      {currentView === 'overlay' && (
        <div className="w-full min-h-screen bg-transparent">
          <OBSOverlay
            match={effectiveMatch}
            animationsEnabled={effectiveMonetization?.broadcastSettings?.animationsEnabled ?? true}
            broadcastSettings={effectiveMonetization?.broadcastSettings}
          />
        </div>
      )}

      {/* Standalone DATA VAULT SPORTS HD AI News TV Link (?view=news-tv) */}
      {currentView === 'news-tv' && (
        <AiNewsStudioTV fullScreen />
      )}

      {/* Mobile App View (Auto-selected on mobile screens or ?view=android) */}
      {currentView === 'android' && (
        <AndroidAppView
          match={effectiveMatch}
          config={matchConfig}
          monetization={effectiveMonetization}
          isLoading={isLoading}
          onRefresh={refreshMatch}
          onSecretAdminTrigger={openAdminKeyModal}
          onSwitchToBroadcast={() => switchViewMode('broadcast')}
        />
      )}

      {/* Hidden Admin Key Modal (Opened ONLY via Alt+Shift+A on keyboard or 5-tap top-left/LIVE badge on mobile) */}
      {showAdminKeyModal && !isObsOverlay && (
        <div
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAdminKeyModal(false)}
        >
          <form
            onSubmit={handleAdminKeySubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs bg-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-2xl space-y-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-black text-white">Restricted Key</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminKeyModal(false)}
                aria-label="Close"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="password"
              autoFocus
              placeholder="Enter Admin Key"
              value={adminKeyInput}
              onChange={(e) => setAdminKeyInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />

            {adminKeyError && (
              <div className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2.5 py-1.5">
                {adminKeyError}
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifyingKey}
              className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-black uppercase tracking-wider transition-colors"
            >
              {isVerifyingKey ? 'Checking...' : 'Unlock'}
            </button>
          </form>
        </div>
      )}
      </div>
    </ThemeProvider>
  );
}
