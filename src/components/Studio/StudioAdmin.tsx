import React, { Suspense, lazy, useState, useEffect } from 'react';
import {
  MatchState,
  ActiveMatchConfig,
  DiscoverableMatch,
  MonetizationConfig,
  HoldReason,
  HoldScreenConfig,
  HoldSponsorMode,
  MatchTimerConfig,
  TvScreenConfig,
  SoundSettingsConfig,
  AnnouncementConfig,
  MobileAppConfig,
  LiveViewerStats
} from '../../types/cricket';
import {
  connectCrexMatch,
  disconnectMatch,
  triggerLiveEvent,
  toggleAutoSync,
  fetchDiscoverableMatches,
  verifyAdminPin,
  editMatchDetails,
  fetchMonetizationConfig,
  updateMonetizationConfig,
  fetchAdminViewerStats,
  uploadApkFile,
  verifyApkDownloadUrl,
  ApkUrlVerifyResult
} from '../../services/api';
import {
  Tv,
  Link,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  Sparkles,
  ExternalLink,
  Flame,
  Layers,
  Smartphone,
  Radio,
  Server,
  Bell,
  Edit3,
  Save,
  X,
  Plus,
  Calculator,
  DollarSign,
  Users,
  Newspaper,
  BookOpen,
  Cloud,
  LogOut,
  LogIn,
  FlaskConical,
  CalendarClock,
  PauseCircle,
  Video,
  Repeat,
  Trash2,
  Megaphone,
  Timer,
  Pause,
  RotateCcw,
  Volume2,
  Clapperboard,
  Globe,
  LayoutGrid,
  Eye,
  Keyboard,
  Upload,
  Download,
  TrendingUp,
  Gamepad2
} from 'lucide-react';
import { useContent } from '../../context/ContentContext';
import { saveSiteConfigToFirestore } from '../../services/firebaseContentService';
import { StudioNotificationsPanel } from './StudioNotificationsPanel';
import { DlsTargetCalculator } from './DlsTargetCalculator';
import { StudioMonetizationPanel } from './StudioMonetizationPanel';
const StudioMonetizationAnalyticsPanel = lazy(() =>
  import('./StudioMonetizationAnalyticsPanel').then((m) => ({
    default: m.StudioMonetizationAnalyticsPanel
  }))
);
import { ManualScorePanel } from './ManualScorePanel';
import { StudioMediaManager } from './StudioMediaManager';
import { StudioMediaLibrary } from './StudioMediaLibrary';
import { StudioNewsManager } from './StudioNewsManager';
import { StudioFirestoreNewsSection } from './StudioFirestoreNewsSection';
import { StudioBlogManager } from './StudioBlogManager';
import { StudioDemoPanel } from './StudioDemoPanel';
import { StudioBroadcastTestView } from './StudioBroadcastTestView';
import { StudioTvScreenPanel } from './StudioTvScreenPanel';
import { TvMultiUrlSlots } from './TvMultiUrlSlots';
import { StudioVideoSources } from './StudioVideoSources';
import { StudioSoundPanel } from './StudioSoundPanel';
import { StudioAiNewsPanel } from './StudioAiNewsPanel';
import { StudioScrollingTickerCard } from './StudioScrollingTickerCard';
import { extractYouTubeVideoId, isYouTubeChannelLiveUrl } from '../Common/HoldYouTubePlayer';
import { MatchElapsedTimer, computeElapsedMs } from '../Broadcast/MatchElapsedTimer';

interface StudioAdminProps {
  match: MatchState | null;
  config: ActiveMatchConfig | null;
  viewerStats?: LiveViewerStats | null;
  onRefresh: () => void;
  onExitAdmin?: () => void;
  onViewBroadcast?: () => void;
  onViewMobile?: () => void;
}

export const StudioAdmin: React.FC<StudioAdminProps> = ({
  match,
  config,
  viewerStats: liveViewerStatsProp,
  onRefresh,
  onExitAdmin,
  onViewBroadcast,
  onViewMobile
}) => {
  const {
    firebaseUser,
    isFirebaseAdmin,
    authError: firebaseAuthError,
    signInWithGoogle,
    signOutFirebase,
    cloudMonetization,
    mergeMonetization,
    setBackupMonetization,
    videoSources
  } = useContent();

  const [adminPin, setAdminPin] = useState(localStorage.getItem('crex_admin_pin') || '');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState('');
  const [crexUrlInput, setCrexUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [discoverMatches, setDiscoverMatches] = useState<DiscoverableMatch[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<
    'match' | 'site_mobile' | 'tv_screen' | 'ai_news_studio' | 'video_sources' | 'media_library' | 'sound' | 'demo' | 'media' | 'news' | 'blog' | 'monetization' | 'monetization_analytics' | 'notifications' | 'dls'
  >('match');
  const [siteSettings, setSiteSettings] = useState<MonetizationConfig | null>(null);
  const [testViewEnabled, setTestViewEnabled] = useState(false);
  const [isTogglingAnimation, setIsTogglingAnimation] = useState(false);
  const [isSavingBroadcastWidget, setIsSavingBroadcastWidget] = useState(false);
  const [manualProbInput, setManualProbInput] = useState<number>(50);
  const [apkUrlInput, setApkUrlInput] = useState<string>('');
  const [apkVersionInput, setApkVersionInput] = useState<string>('1.0.0');
  const [nextMatchNameInput, setNextMatchNameInput] = useState<string>('');
  const [nextMatchTimeInput, setNextMatchTimeInput] = useState<string>('');
  const [holdConfirmPending, setHoldConfirmPending] = useState<boolean>(false);
  const [holdVideoUrlInput, setHoldVideoUrlInput] = useState<string>('');
  const [holdSponsorImgInput, setHoldSponsorImgInput] = useState<string>('');
  const [holdSponsorLinkInput, setHoldSponsorLinkInput] = useState<string>('');
  const [announcementTextInput, setAnnouncementTextInput] = useState<string>('');
  const [announcementLinkInput, setAnnouncementLinkInput] = useState<string>('');
  const [mobileBrandBadgeInput, setMobileBrandBadgeInput] = useState<string>('LIVE CRICKET TV');
  const [polledViewerStats, setPolledViewerStats] = useState<LiveViewerStats | null>(null);
  const [isUploadingApk, setIsUploadingApk] = useState(false);
  const [gameApkUrlInput, setGameApkUrlInput] = useState<string>('');
  const [gameApkSizeInput, setGameApkSizeInput] = useState<string>('12 MB');
  const [isUploadingGameApk, setIsUploadingGameApk] = useState(false);
  const [isVerifyingGameApk, setIsVerifyingGameApk] = useState(false);
  const [gameApkVerifyStatus, setGameApkVerifyStatus] = useState<ApkUrlVerifyResult | null>(null);

  const effectiveViewerStats: LiveViewerStats = liveViewerStatsProp || polledViewerStats || {
    total: 0,
    web: 0,
    mobile: 0,
    obs: 0,
    admin: 0,
    peak: 0,
    updatedAt: 0
  };

  const ballAnimationsEnabled = siteSettings?.broadcastSettings?.animationsEnabled ?? true;
  const broadcastNewsMarqueeEnabled = siteSettings?.broadcastSettings?.newsMarqueeEnabled ?? true;
  const winProbabilityEnabled = siteSettings?.broadcastSettings?.winProbabilityEnabled ?? true;
  const winProbabilityOverride = siteSettings?.broadcastSettings?.winProbabilityOverride || {
    enabled: false,
    battingTeamPct: 50
  };
  const obsPanels = siteSettings?.broadcastSettings?.obsPanels || {
    targetPanel: true,
    winProbabilityBar: true,
    runRateGraph: true
  };
  const appDownload = siteSettings?.broadcastSettings?.appDownload || {
    enabled: true,
    apkUrl: '',
    version: '1.0.0'
  };
  const sixProCricket = siteSettings?.broadcastSettings?.sixProCricket || {
    enabled: true,
    apkUrl: '',
    sizeLabel: '12 MB'
  };
  const holdScreen: HoldScreenConfig = siteSettings?.broadcastSettings?.holdScreen || {
    active: false,
    reason: 'Break',
    obsEnabled: false,
    videoEnabled: false,
    videoLoop: true,
    videoUrls: [],
    sponsorEnabled: false,
    sponsorMode: 'with_content',
    sponsorImageUrl: '',
    sponsorLinkUrl: ''
  };
  const matchTimer: MatchTimerConfig = siteSettings?.broadcastSettings?.matchTimer || {
    active: false,
    startedAt: 0,
    accumulatedMs: 0
  };
  const tvScreen: TvScreenConfig = siteSettings?.broadcastSettings?.tvScreen || {
    enabled: false,
    obsEnabled: false,
    fullScreenTakeover: false,
    loop: true,
    batBallBetweenAds: false,
    batBallGapSec: 5,
    playNowItemId: '',
    playNowNonce: 0,
    playbackStopped: false,
    sponsorName: '',
    sponsorLink: '',
    playlist: []
  };
  const tvPlaylistItems = tvScreen.playlist || [];
  const matchedTvIdx = tvScreen.playNowItemId
    ? tvPlaylistItems.findIndex((item) => item.id === tvScreen.playNowItemId)
    : tvPlaylistItems.length > 0
    ? 0
    : -1;
  const activeTvStreamIndex = matchedTvIdx >= 0 ? matchedTvIdx : tvPlaylistItems.length > 0 ? 0 : -1;
  const activeTvStreamLabel =
    activeTvStreamIndex >= 0
      ? tvPlaylistItems[activeTvStreamIndex]?.title?.trim() ||
        `Playback URL ${activeTvStreamIndex + 1}`
      : '';
  const soundSettings: SoundSettingsConfig = siteSettings?.broadcastSettings?.soundSettings || {
    enabled: true,
    obsEnabled: true,
    effectsVolume: 80,
    crowdVolume: 28,
    voiceRate: 1.05,
    voiceVolume: 90,
    customSounds: {
      fourUrl: '',
      sixUrl: '',
      wicketUrl: '',
      crowdUrl: ''
    }
  };
  const announcement: AnnouncementConfig = siteSettings?.broadcastSettings?.announcement || {
    enabled: false,
    text: '',
    linkUrl: ''
  };
  const mobileApp: MobileAppConfig = siteSettings?.broadcastSettings?.mobileApp || {
    adsEnabled: true,
    sponsorEnabled: true,
    newsTickerEnabled: true,
    pollEnabled: true,
    scorecardEnabled: true,
    newsPageEnabled: true,
    blogPageEnabled: true,
    brandBadge: 'LIVE CRICKET TV'
  };

  const [isEditingScore, setIsEditingScore] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    battingTeamName: '',
    battingTeamCode: '',
    runs: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    bowlingTeamName: '',
    bowlingTeamCode: '',
    strikerName: '',
    bowlerName: '',
    target: 0,
    statusText: ''
  });

  // Populate editor with current match state when opening
  const openScoreEditor = () => {
    if (!match) return;
    setEditFormData({
      title: match.title,
      battingTeamName: match.battingTeam.name,
      battingTeamCode: match.battingTeam.code,
      runs: match.battingTeam.score.runs,
      wickets: match.battingTeam.score.wickets,
      overs: match.battingTeam.score.overs,
      balls: match.battingTeam.score.balls,
      bowlingTeamName: match.bowlingTeam.name,
      bowlingTeamCode: match.bowlingTeam.code,
      strikerName: match.striker.name,
      bowlerName: match.currentBowler.name,
      target: match.target || 0,
      statusText: match.statusText
    });
    setIsEditingScore(true);
  };

  const handleSaveScoreEdit = async () => {
    setIsSubmitting(true);
    try {
      await editMatchDetails(editFormData, adminPin);
      setStatusMessage({ text: 'Match updated live! Propagated to OBS Overlay, Broadcast & App.', type: 'success' });
      setIsEditingScore(false);
      onRefresh();
    } catch (e: any) {
      setStatusMessage({ text: e.message || 'Failed to update match', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAddScore = async (runsToAdd: number, isWicket: boolean = false) => {
    if (!match) return;
    const bat = match.battingTeam.score;
    const newRuns = bat.runs + runsToAdd;
    const newWickets = isWicket ? Math.min(10, bat.wickets + 1) : bat.wickets;
    let newBalls = bat.balls + 1;
    let newOvers = bat.overs;
    if (newBalls >= 6) {
      newOvers += 1;
      newBalls = 0;
    }

    try {
      await editMatchDetails(
        {
          runs: newRuns,
          wickets: newWickets,
          overs: newOvers,
          balls: newBalls,
          strikerRuns: match.striker.runs + runsToAdd,
          strikerBalls: match.striker.balls + 1,
          bowlerRuns: match.currentBowler.runs + runsToAdd,
          bowlerWickets: isWicket ? match.currentBowler.wickets + 1 : match.currentBowler.wickets
        },
        adminPin
      );
      setStatusMessage({ text: `Score updated: +${runsToAdd} runs ${isWicket ? '• WICKET!' : ''}`, type: 'success' });
      onRefresh();
    } catch (e: any) {
      setStatusMessage({ text: e.message || 'Quick score update failed', type: 'error' });
    }
  };

  // Check pin and load settings on load
  useEffect(() => {
    const savedPin = localStorage.getItem('crex_admin_pin');
    if (savedPin) {
      checkPin(savedPin);
    }
    loadDiscoverable();
    fetchMonetizationConfig().then((cfg) => {
      const merged = mergeMonetization(cfg);
      if (merged) {
        setSiteSettings(merged);
        if (typeof merged.broadcastSettings?.winProbabilityOverride?.battingTeamPct === 'number') {
          setManualProbInput(merged.broadcastSettings.winProbabilityOverride.battingTeamPct);
        }
        if (merged.broadcastSettings?.appDownload) {
          setApkUrlInput(merged.broadcastSettings.appDownload.apkUrl || '');
          setApkVersionInput(merged.broadcastSettings.appDownload.version || '1.0.0');
        }
        if (merged.broadcastSettings?.sixProCricket) {
          setGameApkUrlInput(merged.broadcastSettings.sixProCricket.apkUrl || '');
          setGameApkSizeInput(merged.broadcastSettings.sixProCricket.sizeLabel || '12 MB');
        }
        if (merged.broadcastSettings?.nextMatch) {
          setNextMatchNameInput(merged.broadcastSettings.nextMatch.matchName || '');
          setNextMatchTimeInput(merged.broadcastSettings.nextMatch.matchTime || '');
        }
        if (merged.broadcastSettings?.holdScreen) {
          setHoldSponsorImgInput(merged.broadcastSettings.holdScreen.sponsorImageUrl || '');
          setHoldSponsorLinkInput(merged.broadcastSettings.holdScreen.sponsorLinkUrl || '');
        }
        if (merged.broadcastSettings?.announcement) {
          setAnnouncementTextInput(merged.broadcastSettings.announcement.text || '');
          setAnnouncementLinkInput(merged.broadcastSettings.announcement.linkUrl || '');
        }
        if (merged.broadcastSettings?.mobileApp?.brandBadge) {
          setMobileBrandBadgeInput(merged.broadcastSettings.mobileApp.brandBadge);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!cloudMonetization?.broadcastSettings) return;
    setSiteSettings((prev) => mergeMonetization(prev));
    if (cloudMonetization.broadcastSettings.appDownload?.apkUrl !== undefined) {
      setApkUrlInput((prev) => prev || cloudMonetization.broadcastSettings?.appDownload?.apkUrl || '');
    }
    if (cloudMonetization.broadcastSettings.appDownload?.version) {
      setApkVersionInput((prev) =>
        prev && prev !== '1.0.0'
          ? prev
          : cloudMonetization.broadcastSettings?.appDownload?.version || '1.0.0'
      );
    }
    if (cloudMonetization.broadcastSettings.sixProCricket?.apkUrl !== undefined) {
      setGameApkUrlInput((prev) => prev || cloudMonetization.broadcastSettings?.sixProCricket?.apkUrl || '');
    }
    if (cloudMonetization.broadcastSettings.sixProCricket?.sizeLabel) {
      setGameApkSizeInput((prev) =>
        prev && prev !== '12 MB'
          ? prev
          : cloudMonetization.broadcastSettings?.sixProCricket?.sizeLabel || '12 MB'
      );
    }
    if (cloudMonetization.broadcastSettings.nextMatch) {
      setNextMatchNameInput((prev) => prev || cloudMonetization.broadcastSettings?.nextMatch?.matchName || '');
      setNextMatchTimeInput((prev) => prev || cloudMonetization.broadcastSettings?.nextMatch?.matchTime || '');
    }
    if (cloudMonetization.broadcastSettings.holdScreen) {
      setHoldSponsorImgInput((prev) => prev || cloudMonetization.broadcastSettings?.holdScreen?.sponsorImageUrl || '');
      setHoldSponsorLinkInput((prev) => prev || cloudMonetization.broadcastSettings?.holdScreen?.sponsorLinkUrl || '');
    }
    if (cloudMonetization.broadcastSettings.announcement) {
      setAnnouncementTextInput((prev) => prev || cloudMonetization.broadcastSettings?.announcement?.text || '');
      setAnnouncementLinkInput((prev) => prev || cloudMonetization.broadcastSettings?.announcement?.linkUrl || '');
    }
    if (cloudMonetization.broadcastSettings.mobileApp?.brandBadge) {
      setMobileBrandBadgeInput((prev) =>
        prev && prev !== 'LIVE CRICKET TV'
          ? prev
          : cloudMonetization.broadcastSettings?.mobileApp?.brandBadge || 'LIVE CRICKET TV'
      );
    }
  }, [cloudMonetization, mergeMonetization]);

  const persistBroadcastSettings = async (
    patch: Partial<NonNullable<MonetizationConfig['broadcastSettings']>>,
    successText: string
  ) => {
    if (!isAuthorized) return;
    const mergedCurrent = mergeMonetization(siteSettings)?.broadcastSettings;
    const currentSettings = mergedCurrent || siteSettings?.broadcastSettings || {
      animationsEnabled: true,
      breakScreen: { active: false, type: 'drinks' as const, subtitle: '' },
      winProbabilityEnabled: true,
      winProbabilityOverride: { enabled: false, battingTeamPct: 50 },
      obsPanels: { targetPanel: true, winProbabilityBar: true, runRateGraph: true },
      appDownload: { enabled: true, apkUrl: '', version: '1.0.0' },
      holdScreen
    };
    const updated = await updateMonetizationConfig(
      {
        broadcastSettings: {
          ...currentSettings,
          ...patch,
          breakScreen: patch.breakScreen || currentSettings.breakScreen,
          winProbabilityOverride:
            patch.winProbabilityOverride || currentSettings.winProbabilityOverride,
          obsPanels: patch.obsPanels || currentSettings.obsPanels,
          appDownload: patch.appDownload || currentSettings.appDownload,
          sixProCricket: patch.sixProCricket || currentSettings.sixProCricket,
          nextMatch: patch.nextMatch || currentSettings.nextMatch,
          holdScreen: patch.holdScreen || currentSettings.holdScreen,
          matchTimer: patch.matchTimer || currentSettings.matchTimer,
          tvScreen: patch.tvScreen || currentSettings.tvScreen,
          soundSettings: patch.soundSettings || currentSettings.soundSettings,
          announcement: patch.announcement || currentSettings.announcement,
          mobileApp: patch.mobileApp || currentSettings.mobileApp
        }
      },
      adminPin
    );
    setSiteSettings(updated);
    setBackupMonetization(updated);
    if (isFirebaseAdmin) {
      await saveSiteConfigToFirestore(updated);
    }
    setStatusMessage({
      text: isFirebaseAdmin ? `${successText} (Firebase Cloud Synced)` : successText,
      type: 'success'
    });
  };

  const updateTvScreenField = async (
    patch: Partial<TvScreenConfig>,
    successText: string
  ) => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        {
          tvScreen: {
            ...tvScreen,
            ...patch
          }
        },
        successText
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'TV Screen setting update failed', type: 'error' });
      throw err;
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const updateSoundSettingsField = async (
    patch: Partial<SoundSettingsConfig>,
    successText: string
  ) => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        {
          soundSettings: {
            ...soundSettings,
            ...patch,
            customSounds: {
              ...(soundSettings.customSounds || {}),
              ...(patch.customSounds || {})
            }
          }
        },
        successText
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Sound settings update failed', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleToggleAnnouncement = async () => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    const nextEnabled = !announcement.enabled;
    const nextText = announcementTextInput.trim() || announcement.text;
    if (nextEnabled && !nextText) {
      setStatusMessage({
        text: 'Notice ON karne se pehle upar Announcement message likhein.',
        type: 'error'
      });
      return;
    }
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        {
          announcement: {
            enabled: nextEnabled,
            text: nextText,
            linkUrl: announcementLinkInput.trim()
          }
        },
        `Global Announcement ${nextEnabled ? 'ON' : 'OFF'} — Website aur Mobile App par update ho gaya!`
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to toggle announcement', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleSaveAnnouncement = async (clear: boolean = false) => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    setIsSavingBroadcastWidget(true);
    const trimmedText = clear ? '' : announcementTextInput.trim();
    const payload: AnnouncementConfig = clear
      ? { enabled: false, text: '', linkUrl: '' }
      : {
          enabled: trimmedText ? true : false,
          text: trimmedText,
          linkUrl: announcementLinkInput.trim()
        };
    try {
      await persistBroadcastSettings(
        { announcement: payload },
        clear
          ? 'Global Announcement clear ho gaya!'
          : 'Global Announcement Website & Mobile App sab users par live publish ho gaya!'
      );
      if (clear) {
        setAnnouncementTextInput('');
        setAnnouncementLinkInput('');
      }
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to save announcement', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleToggleMobileAppField = async (
    field: Exclude<keyof MobileAppConfig, 'brandBadge'>,
    label: string
  ) => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    const nextVal = !mobileApp[field];
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        {
          mobileApp: {
            ...mobileApp,
            [field]: nextVal
          }
        },
        `Mobile App "${label}" ${nextVal ? 'ON' : 'OFF'} — Sab mobile users ke app par update ho gaya!`
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Mobile App setting update failed', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleSaveMobileBrandBadge = async () => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    const badge = mobileBrandBadgeInput.trim() || 'LIVE CRICKET TV';
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        {
          mobileApp: {
            ...mobileApp,
            brandBadge: badge
          }
        },
        `Mobile App Brand Badge "${badge}" har user ke mobile par update ho gaya!`
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to update Mobile Brand Badge', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleToggleBallAnimation = async () => {
    if (!isAuthorized || isTogglingAnimation) return;
    const nextEnabled = !ballAnimationsEnabled;
    setIsTogglingAnimation(true);
    try {
      await persistBroadcastSettings(
        { animationsEnabled: nextEnabled },
        `Ball Animation ${nextEnabled ? 'ON' : 'OFF'} — Broadcast & OBS Overlay par update ho gaya!`
      );
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || 'Failed to update Ball Animation setting',
        type: 'error'
      });
    } finally {
      setIsTogglingAnimation(false);
    }
  };

  const handleToggleWinProbability = async () => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    const next = !winProbabilityEnabled;
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        { winProbabilityEnabled: next },
        `Win Probability Bar ${next ? 'ON' : 'OFF'} — Broadcast screen par update ho gaya!`
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to update Win Probability', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleToggleBroadcastNewsMarquee = async () => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    const next = !broadcastNewsMarqueeEnabled;
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        { newsMarqueeEnabled: next },
        `Broadcast Scrolling News Marquee ${next ? 'ON' : 'OFF'} — Live Broadcast screen par update ho gaya!`
      );
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || 'Failed to update Broadcast News Marquee setting',
        type: 'error'
      });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleSaveManualWinProbability = async (enableOverride: boolean, pctValue: number) => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    const clamped = Math.max(0, Math.min(100, Math.round(pctValue)));
    setManualProbInput(clamped);
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        {
          winProbabilityOverride: {
            enabled: enableOverride,
            battingTeamPct: clamped
          }
        },
        enableOverride
          ? `Win Probability manual override saved (${clamped}% / ${100 - clamped}%)!`
          : 'Win Probability wapas automatic CREX estimate par set ho gaya!'
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to save override', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleToggleObsPanel = async (
    panelKey: 'targetPanel' | 'winProbabilityBar' | 'runRateGraph'
  ) => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    const nextPanels = {
      ...obsPanels,
      [panelKey]: !obsPanels[panelKey]
    };
    const labelMap = {
      targetPanel: 'OBS Target Panel',
      winProbabilityBar: 'OBS Win Probability Bar',
      runRateGraph: 'OBS Run Rate Graph'
    };
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        { obsPanels: nextPanels },
        `${labelMap[panelKey]} ${nextPanels[panelKey] ? 'ON' : 'OFF'} — OBS Overlay (?view=overlay) par update ho gaya!`
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to update OBS setting', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleToggleAppDownload = async () => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    const nextEnabled = !appDownload.enabled;
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        {
          appDownload: {
            enabled: nextEnabled,
            apkUrl: apkUrlInput.trim(),
            version: apkVersionInput.trim() || '1.0.0'
          }
        },
        `Download Android App button ${nextEnabled ? 'ON' : 'OFF'} — Broadcast screen par update ho gaya!`
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to update App Download switch', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleSaveAppDownload = async () => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        {
          appDownload: {
            enabled: appDownload.enabled,
            apkUrl: apkUrlInput.trim(),
            version: apkVersionInput.trim() || '1.0.0'
          }
        },
        'App Download APK URL & version Broadcast screen par save ho gaya!'
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to save App Download settings', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleUploadApkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isAuthorized || isUploadingApk) return;
    setIsUploadingApk(true);
    try {
      const uploaded = await uploadApkFile(file, adminPin);
      setApkUrlInput(uploaded.url);
      await persistBroadcastSettings(
        {
          appDownload: {
            enabled: true,
            apkUrl: uploaded.url,
            version: apkVersionInput.trim() || '1.0.0'
          }
        },
        `APK file "${file.name}" upload & live website download button par attach ho gayi!`
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'APK upload fail ho gayi', type: 'error' });
    } finally {
      setIsUploadingApk(false);
    }
  };

  const handleToggleGameDownload = async () => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    const nextEnabled = !sixProCricket.enabled;
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        {
          sixProCricket: {
            enabled: nextEnabled,
            apkUrl: gameApkUrlInput.trim(),
            sizeLabel: gameApkSizeInput.trim() || '12 MB'
          }
        },
        `SIX PRO 3D CRICKET download banner ${nextEnabled ? 'ON' : 'OFF'} — website par update ho gaya!`
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to update SIX PRO 3D CRICKET switch', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleVerifyGameApkUrl = async (): Promise<ApkUrlVerifyResult | null> => {
    const candidate = gameApkUrlInput.trim();
    if (!candidate || !isAuthorized || isVerifyingGameApk) return null;
    setIsVerifyingGameApk(true);
    setGameApkVerifyStatus(null);
    try {
      const result = await verifyApkDownloadUrl(candidate, adminPin);
      setGameApkVerifyStatus(result);
      return result;
    } catch (err: any) {
      const errRes: ApkUrlVerifyResult = {
        valid: false,
        status: 0,
        error: err?.message || 'Verification failed'
      };
      setGameApkVerifyStatus(errRes);
      return errRes;
    } finally {
      setIsVerifyingGameApk(false);
    }
  };

  const handleSaveGameDownload = async () => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    const candidate = gameApkUrlInput.trim();
    setIsSavingBroadcastWidget(true);
    try {
      if (candidate) {
        const check = await verifyApkDownloadUrl(candidate, adminPin);
        setGameApkVerifyStatus(check);
        if (!check.valid) {
          setStatusMessage({
            text: `URL verify nahi hui (${check.error || `HTTP ${check.status}`}). Valid APK link paste karein ya .APK upload karein.`,
            type: 'error'
          });
          return;
        }
      } else {
        setGameApkVerifyStatus(null);
      }

      await persistBroadcastSettings(
        {
          sixProCricket: {
            enabled: sixProCricket.enabled,
            apkUrl: candidate,
            sizeLabel: gameApkSizeInput.trim() || '12 MB'
          }
        },
        candidate
          ? 'SIX PRO 3D CRICKET verified APK URL save ho gaya!'
          : 'SIX PRO 3D CRICKET APK URL clear kar diya gaya (Coming Soon mode).'
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to save SIX PRO 3D CRICKET APK settings', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleUploadGameApkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isAuthorized || isUploadingGameApk) return;
    setIsUploadingGameApk(true);
    try {
      const uploaded = await uploadApkFile(file, adminPin);
      const sizeMb = `${Math.max(1, Math.round(file.size / (1024 * 1024)))} MB`;
      setGameApkUrlInput(uploaded.url);
      setGameApkSizeInput(sizeMb);
      setGameApkVerifyStatus({ valid: true, status: 200, finalUrl: uploaded.url, contentLength: file.size });
      await persistBroadcastSettings(
        {
          sixProCricket: {
            enabled: true,
            apkUrl: uploaded.url,
            sizeLabel: sizeMb
          }
        },
        `SIX PRO 3D CRICKET APK "${file.name}" (${sizeMb}) upload & live download button par attach ho gayi!`
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Game APK upload fail ho gayi', type: 'error' });
    } finally {
      setIsUploadingGameApk(false);
    }
  };

  const handleSaveNextMatchNotice = async (clear: boolean = false) => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    setIsSavingBroadcastWidget(true);
    const nextMatchPayload = clear
      ? { matchName: '', matchTime: '' }
      : {
          matchName: nextMatchNameInput.trim(),
          matchTime: nextMatchTimeInput.trim()
        };
    try {
      await persistBroadcastSettings(
        { nextMatch: nextMatchPayload },
        clear
          ? 'Next Match info clear ho gayi!'
          : 'Next Match info No-Match screen par save ho gayi!'
      );
      if (clear) {
        setNextMatchNameInput('');
        setNextMatchTimeInput('');
      }
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to save Next Match notice', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const HOLD_REASONS: HoldReason[] = [
    'Break',
    'Rain',
    'Drinks',
    'Innings Break',
    'Match Starting Soon',
    'Technical Issue'
  ];

  const updateHoldScreenField = async (
    patch: Partial<HoldScreenConfig>,
    successText: string
  ) => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        {
          holdScreen: {
            ...holdScreen,
            ...patch
          }
        },
        successText
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Hold Screen setting update failed', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleToggleHoldButton = async () => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    if (holdScreen.active) {
      setHoldConfirmPending(false);
      await updateHoldScreenField(
        { active: false },
        'Hold Screen OFF — Sab viewers par wapas live score aa gaya!'
      );
    } else {
      setHoldConfirmPending(true);
    }
  };

  const handleConfirmEnableHold = async () => {
    setHoldConfirmPending(false);
    await updateHoldScreenField(
      { active: true },
      `Hold Screen ON (${holdScreen.reason}) — Sab viewers ko ab Hold Screen dikh rahi hai!`
    );
  };

  const handleAddHoldVideoUrl = async () => {
    const trimmed = holdVideoUrlInput.trim();
    if (!trimmed) return;
    if (holdScreen.videoUrls.length >= 20) {
      setStatusMessage({ text: 'Maximum 20 videos playlist mein add ki ja sakti hain.', type: 'error' });
      return;
    }
    const videoId = extractYouTubeVideoId(trimmed);
    if (!videoId) {
      setStatusMessage({
        text: isYouTubeChannelLiveUrl(trimmed)
          ? 'Channel /live link embed nahi hota. Video ke Share button se https://youtu.be/... ya https://youtube.com/live/VIDEO_ID copy karein.'
          : 'Galat YouTube link! Sahih link dalein (https://youtube.com/watch?v=... ya https://youtu.be/...).',
        type: 'error'
      });
      return;
    }
    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const nextUrls = [...holdScreen.videoUrls, cleanUrl];
    setHoldVideoUrlInput('');
    await updateHoldScreenField(
      { videoUrls: nextUrls },
      'YouTube video Hold Screen playlist mein add ho gayi!'
    );
  };

  const handleRemoveHoldVideoUrl = async (idx: number) => {
    const nextUrls = holdScreen.videoUrls.filter((_, i) => i !== idx);
    await updateHoldScreenField(
      { videoUrls: nextUrls },
      'Video playlist se hata di gayi!'
    );
  };

  const handleSaveHoldSponsor = async () => {
    await updateHoldScreenField(
      {
        sponsorImageUrl: holdSponsorImgInput.trim(),
        sponsorLinkUrl: holdSponsorLinkInput.trim()
      },
      'Hold Screen Sponsor banner save ho gaya!'
    );
  };

  const checkPin = async (pin: string) => {
    if (!pin || !pin.trim()) {
      setIsAuthorized(false);
      setAuthError('Please enter your Admin PIN');
      return;
    }
    const res = await verifyAdminPin(pin);
    const ok = typeof res === 'boolean' ? res : res.authorized;
    setIsAuthorized(ok);
    if (ok) {
      localStorage.setItem('crex_admin_pin', pin);
      try {
        window.sessionStorage.setItem('crex_admin_session_unlocked', '1');
      } catch {}
      setAuthError('');
    } else {
      const err = typeof res === 'object' && res.error ? res.error : 'Invalid Admin PIN';
      setAuthError(err);
    }
  };

  useEffect(() => {
    if (!isAuthorized || !adminPin) return;
    let active = true;
    const loadStats = () => {
      fetchAdminViewerStats(adminPin).then((stats) => {
        if (active && stats) setPolledViewerStats(stats);
      });
    };
    loadStats();
    const timer = setInterval(loadStats, 12000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isAuthorized, adminPin]);

  const loadDiscoverable = async () => {
    try {
      const list = await fetchDiscoverableMatches();
      setDiscoverMatches(list);
    } catch (e) {
      console.warn('Error loading discoverable matches:', e);
    }
  };

  const handleStartMatchTimer = async () => {
    if (!isAuthorized || isSavingBroadcastWidget || matchTimer.active) return;
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        {
          matchTimer: {
            active: true,
            startedAt: Date.now(),
            accumulatedMs: Math.max(0, matchTimer.accumulatedMs || 0)
          }
        },
        'Match Stopwatch started — Broadcast view timer live ho gaya!'
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to start match timer', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handlePauseMatchTimer = async () => {
    if (!isAuthorized || isSavingBroadcastWidget || !matchTimer.active) return;
    setIsSavingBroadcastWidget(true);
    const totalElapsed = computeElapsedMs(matchTimer, Date.now());
    try {
      await persistBroadcastSettings(
        {
          matchTimer: {
            active: false,
            startedAt: 0,
            accumulatedMs: totalElapsed
          }
        },
        'Match Stopwatch paused!'
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to pause match timer', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleResetMatchTimer = async () => {
    if (!isAuthorized || isSavingBroadcastWidget) return;
    setIsSavingBroadcastWidget(true);
    try {
      await persistBroadcastSettings(
        {
          matchTimer: {
            active: false,
            startedAt: 0,
            accumulatedMs: 0
          }
        },
        'Match Stopwatch reset to 00:00:00!'
      );
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to reset match timer', type: 'error' });
    } finally {
      setIsSavingBroadcastWidget(false);
    }
  };

  const handleConnect = async (urlOrId: string) => {
    if (!urlOrId.trim()) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      await connectCrexMatch(urlOrId, adminPin);
      if (!matchTimer.active) {
        await persistBroadcastSettings(
          {
            matchTimer: {
              active: true,
              startedAt: Date.now(),
              accumulatedMs: 0
            }
          },
          'Match connected & Broadcast stopwatch started!'
        );
      } else {
        setStatusMessage({ text: 'Match connected & persisted to server successfully!', type: 'success' });
      }
      setCrexUrlInput('');
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to connect match', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect the active match? All clients will return to waiting state.')) {
      return;
    }
    setIsSubmitting(true);
    try {
      await disconnectMatch(adminPin);
      if (matchTimer.active) {
        await persistBroadcastSettings(
          {
            matchTimer: {
              active: false,
              startedAt: 0,
              accumulatedMs: computeElapsedMs(matchTimer, Date.now())
            }
          },
          'Active match disconnected & stopwatch paused.'
        );
      } else {
        setStatusMessage({ text: 'Active match disconnected.', type: 'success' });
      }
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to disconnect', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerEvent = async (
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
      | 'dot'
  ) => {
    try {
      await triggerLiveEvent(type, adminPin);
      setStatusMessage({ text: `Simulated event [${type.toUpperCase()}] broadcasted to all Android apps & screens!`, type: 'success' });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    }
  };

  const handleToggleAutoSync = async () => {
    if (!config) return;
    const newState = !config.isAutoSyncEnabled;
    try {
      await toggleAutoSync(newState, adminPin);
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(label);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const origin = window.location.origin;
  const broadcastUrl = origin;
  const obsUrl = `${origin}?view=overlay`;
  const appUrl = `${origin}?view=android`;
  const adminUrl = `${origin}?view=admin`;

  if (!isAuthorized) {
    return (
      <div className="min-h-[82vh] flex items-center justify-center px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            checkPin(adminPin);
          }}
          className="w-full max-w-sm bg-slate-900/95 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-black text-white">Restricted Access</h1>
              <p className="text-xs text-slate-400">Enter Admin Key to continue</p>
            </div>
          </div>

          <input
            type="password"
            autoFocus
            placeholder="Admin Key / PIN"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          />

          {authError && (
            <div className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {authError}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider transition-colors"
            >
              Unlock
            </button>
            {onExitAdmin && (
              <button
                type="button"
                onClick={onExitAdmin}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
              >
                Back
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Studio Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-xs border border-blue-500/30">
              CREX SYNC HUB
            </span>
            <span className="text-xs text-slate-400">Server Persistent Mode</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Cricket Studio & Master Controller
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Centralized source of truth. Connect a match once; Android app, OBS overlay, and Broadcast sync automatically.
          </p>
        </div>

        {/* PIN Authorization Status + Quick View Jump + Exit Admin */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 mr-1">
            <Unlock className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-xs font-semibold text-slate-200">Admin Authorized</div>
              <div className="text-[10px] text-slate-400">PIN: {adminPin ? '••••••' : 'None'}</div>
            </div>
          </div>

          {onViewBroadcast && (
            <button
              type="button"
              onClick={onViewBroadcast}
              className="px-2.5 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/35 border border-sky-500/40 text-sky-200 text-xs font-bold inline-flex items-center gap-1 transition-colors"
              title="Open Broadcast TV View (Alt+Shift+M)"
            >
              <Tv className="w-3.5 h-3.5 text-sky-400" />
              <span>Broadcast</span>
            </button>
          )}

          {onViewMobile && (
            <button
              type="button"
              onClick={onViewMobile}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-200 text-xs font-bold inline-flex items-center gap-1 transition-colors"
              title="Open Mobile App View (Alt+Shift+M)"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>App View</span>
            </button>
          )}

          {onExitAdmin && (
            <button
              type="button"
              onClick={onExitAdmin}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1 transition-colors"
              title="Exit Admin & Return (F9 / Alt+Shift+A)"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          )}
        </div>
      </div>

      {/* Live View Counter Strip (Always visible in StudioAdmin) */}
      {isAuthorized && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <Eye className="w-4 h-4 text-emerald-300" />
              <span className="text-xs font-black text-white tabular-nums">
                {effectiveViewerStats.total} LIVE VIEWERS
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold">
              <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-sky-300 tabular-nums">
                Web TV: {effectiveViewerStats.web}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-emerald-300 tabular-nums">
                Mobile App: {effectiveViewerStats.mobile}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-purple-300 tabular-nums">
                OBS: {effectiveViewerStats.obs}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 tabular-nums">
                Peak: {effectiveViewerStats.peak}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-300 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 shrink-0">
            <Keyboard className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>
              PC: <strong className="text-white">F9</strong> / <strong className="text-white">Alt+Shift+A</strong> • Mobile: <strong className="text-amber-300">Hold LIVE 1.2s</strong> (or 5x Tap)
            </span>
          </div>
        </div>
      )}

      {/* Master Controls Strip: Ball Animation + Broadcast Test View Toggle */}
      {isAuthorized && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles className={`w-4 h-4 shrink-0 ${ballAnimationsEnabled ? 'text-sky-400' : 'text-slate-500'}`} />
            <div className="min-w-0">
              <div className="text-xs font-black text-white">Ball Animation &amp; Broadcast Test View</div>
              <div className="text-[11px] text-slate-400">
                Broadcast screen aur OBS Overlay par auto ball-by-ball animations (DOT, SINGLE, 4, 6, WICKET)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={testViewEnabled}
              onClick={() => setTestViewEnabled((prev) => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2.5 border transition-all whitespace-nowrap shrink-0 ${
                testViewEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-300 shadow-md'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-700'
              }`}
            >
              <Tv className="w-3.5 h-3.5 shrink-0" />
              <span>Test View</span>
              <span
                className={`w-8 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                  testViewEnabled ? 'bg-white justify-end' : 'bg-slate-700 justify-start'
                }`}
              >
                <span className="w-3 h-3 rounded-full bg-slate-950 shadow" />
              </span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={ballAnimationsEnabled}
              disabled={isTogglingAnimation}
              onClick={handleToggleBallAnimation}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2.5 border transition-all whitespace-nowrap shrink-0 disabled:opacity-60 ${
                ballAnimationsEnabled
                  ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-300 shadow-md'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <span>Animations: {ballAnimationsEnabled ? 'ON' : 'OFF'}</span>
              <span
                className={`w-8 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                  ballAnimationsEnabled ? 'bg-emerald-400 justify-end' : 'bg-slate-700 justify-start'
                }`}
              >
                <span className="w-3 h-3 rounded-full bg-slate-950 shadow" />
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Simulated Broadcast Test View (when Test View toggle is ON) */}
      {isAuthorized && testViewEnabled && (
        <StudioBroadcastTestView
          monetization={mergeMonetization(siteSettings)}
          animationsEnabled={ballAnimationsEnabled}
          onEnableAnimations={!ballAnimationsEnabled ? handleToggleBallAnimation : undefined}
          onClose={() => setTestViewEnabled(false)}
        />
      )}

      {authError && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{authError}</span>
        </div>
      )}

      {statusMessage && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border border-rose-800 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Firebase Cloud Sync Auth Banner (only visible after Admin PIN is verified) */}
      {isAuthorized && (
        <div
          className={`rounded-2xl p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isFirebaseAdmin
              ? 'bg-emerald-950/30 border-emerald-500/35'
              : 'bg-amber-950/25 border-amber-500/40'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <Cloud
              className={`w-5 h-5 shrink-0 ${
                isFirebaseAdmin ? 'text-emerald-400' : 'text-amber-400'
              }`}
            />
            <div className="min-w-0">
              <div className="text-xs font-black text-white">
                {isFirebaseAdmin
                  ? `Firebase Cloud Sync Active (${firebaseUser?.email})`
                  : 'Firebase Cloud Sync (Global Public Save)'}
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {isFirebaseAdmin
                  ? 'Players, Teams, News, Blog aur Sponsor/Ads changes Firestore + Storage mein save ho rahi hain aur sab users ko live dikhengi.'
                  : firebaseAuthError ||
                    'Players, News, Blog aur Sponsor ko har user ke liye globally Firebase mein save karne ke liye Google Admin login karein.'}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {isFirebaseAdmin ? (
              <button
                type="button"
                onClick={signOutFirebase}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out Google</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Persistent Active Hold Screen Indicator Banner */}
      {isAuthorized && holdScreen.active && (
        <div className="rounded-2xl border border-amber-400/60 bg-amber-500/15 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
            <div>
              <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-200 flex items-center gap-2">
                <PauseCircle className="w-4 h-4 text-amber-300" />
                <span>HOLD SCREEN ABHI ON HAI — {holdScreen.reason}</span>
              </div>
              <p className="text-[11px] text-amber-100/80 mt-0.5">
                Sab Mobile &amp; Broadcast viewers ko hold screen dikh rahi hai (peeche live score sync chal raha hai).
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSavingBroadcastWidget}
            onClick={handleToggleHoldButton}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wide shrink-0 shadow disabled:opacity-50"
          >
            Hold OFF Karein (Live Wapas Layein)
          </button>
        </div>
      )}

      {/* Persistent Active TV Screen Indicator Banner */}
      {isAuthorized && tvScreen.enabled && (
        <div className="rounded-2xl border border-sky-400/60 bg-sky-500/15 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-sky-400 animate-ping shrink-0" />
            <div>
              <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-sky-200 flex items-center gap-2 flex-wrap">
                <Tv className="w-4 h-4 text-sky-300" />
                <span>
                  {tvScreen.fullScreenTakeover
                    ? 'TV SCREEN ON — FULL SCREEN TAKEOVER ACTIVE'
                    : 'TV SCREEN ON (BROADCAST TV CARD)'}
                </span>
                {activeTvStreamLabel && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 text-[11px] font-black normal-case">
                    Stream: {activeTvStreamLabel} (URL {activeTvStreamIndex + 1})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-sky-100/80 mt-0.5">
                {activeTvStreamLabel
                  ? `Selected stream "${activeTvStreamLabel}" abhi Broadcast screen par active hai${
                      tvScreen.loop && tvPlaylistItems.length > 1 ? ' (Auto-switch 5m ON).' : '.'
                    }`
                  : tvScreen.fullScreenTakeover
                  ? 'Full Screen Takeover ON hai — Broadcast par poori screen par TV Player chal raha hai.'
                  : 'Broadcast ke Live Ground TV Card mein abhi Ads / YouTube / Bat-Ball chal raha hai (scoreboard baqi hai).'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSavingBroadcastWidget}
            onClick={() =>
              updateTvScreenField(
                { enabled: false },
                'TV Screen OFF — Sab viewers par wapas live score / Live Ground aa gaya!'
              ).catch(() => {})
            }
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wide shrink-0 shadow disabled:opacity-50"
          >
            TV Screen OFF Karein
          </button>
        </div>
      )}

      {/* Studio Content Manager Tabs */}
      <div className="flex flex-wrap bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-md gap-1.5">
        <button
          onClick={() => setAdminTab('match')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            adminTab === 'match'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Match &amp; Score</span>
        </button>

        {isAuthorized && (
          <button
            onClick={() => setAdminTab('site_mobile')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 relative ${
              adminTab === 'site_mobile'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-300" />
            <span>Web &amp; App Control</span>
            {announcement.enabled && (
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" title="Notice Active" />
            )}
          </button>
        )}

        {isAuthorized && (
          <button
            onClick={() => setAdminTab('tv_screen')}
            className={`flex-1 min-w-[125px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 relative ${
              adminTab === 'tv_screen'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="w-4 h-4 text-sky-300" />
            <span>TV &amp; Standby</span>
            {tvScreen.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="TV Screen ON" />
            )}
          </button>
        )}

        {isAuthorized && (
          <button
            onClick={() => setAdminTab('ai_news_studio')}
            className={`flex-1 min-w-[135px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 relative whitespace-nowrap ${
              adminTab === 'ai_news_studio'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4 text-amber-300" />
            <span>AI News Studio</span>
            <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" title="DATA VAULT SPORTS HD" />
          </button>
        )}

        {isAuthorized && (
          <button
            onClick={() => setAdminTab('video_sources')}
            className={`flex-1 min-w-[130px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 relative ${
              adminTab === 'video_sources'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-300" />
            <span>Video Sources</span>
            {videoSources.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-400/20 text-emerald-200 text-[10px] font-black">
                {videoSources.length}
              </span>
            )}
          </button>
        )}

        {isAuthorized && (
          <button
            onClick={() => setAdminTab('media_library')}
            className={`flex-1 min-w-[130px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              adminTab === 'media_library'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clapperboard className="w-4 h-4 text-indigo-300" />
            <span>Media Library</span>
          </button>
        )}

        {isAuthorized && (
          <button
            onClick={() => setAdminTab('sound')}
            className={`flex-1 min-w-[115px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 relative ${
              adminTab === 'sound'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-4 h-4 text-emerald-300" />
            <span>Sound &amp; Assets</span>
            {soundSettings.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Sound Enabled" />
            )}
          </button>
        )}

        {isAuthorized && (
          <button
            onClick={() => setAdminTab('media')}
            className={`flex-1 min-w-[130px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              adminTab === 'media'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4 text-sky-300" />
            <span>Players &amp; Teams</span>
          </button>
        )}

        {isAuthorized && (
          <button
            onClick={() => setAdminTab('news')}
            className={`flex-1 min-w-[150px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              adminTab === 'news'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Newspaper className="w-4 h-4 text-rose-300" />
            <span>News Management</span>
          </button>
        )}

        {isAuthorized && (
          <button
            onClick={() => setAdminTab('blog')}
            className={`flex-1 min-w-[110px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              adminTab === 'blog'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-200" />
            <span>Blog</span>
          </button>
        )}

        {isAuthorized && (
          <button
            onClick={() => setAdminTab('monetization')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 relative ${
              adminTab === 'monetization'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4 text-emerald-300" />
            <span>AdSense &amp; Ads</span>
            {siteSettings?.adsEnabled && (
              <span
                className={`w-2 h-2 rounded-full ${
                  siteSettings?.adsensePublisherId ? 'bg-emerald-300 animate-pulse' : 'bg-amber-300'
                }`}
                title={siteSettings?.adsensePublisherId ? 'AdSense Active' : 'Ads Enabled'}
              />
            )}
          </button>
        )}

        {isAuthorized && (
          <button
            onClick={() => setAdminTab('monetization_analytics')}
            className={`flex-1 min-w-[165px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              adminTab === 'monetization_analytics'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-teal-300" />
            <span>Monetization Analytics</span>
          </button>
        )}

        <button
          onClick={() => setAdminTab('notifications')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            adminTab === 'notifications'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bell className="w-4 h-4 text-amber-400" />
          <span>Notifications</span>
        </button>

        <button
          onClick={() => setAdminTab('dls')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 relative ${
            adminTab === 'dls'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calculator className="w-4 h-4 text-purple-300" />
          <span>DLS</span>
          {match?.dlsDetails?.applied && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-1" title="DLS Active on Broadcast" />
          )}
        </button>

        {isAuthorized && (
          <button
            onClick={() => setAdminTab('demo')}
            className={`flex-1 min-w-[130px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              adminTab === 'demo'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FlaskConical className="w-4 h-4 text-violet-300" />
            <span>Demo / Test</span>
          </button>
        )}
      </div>

      {adminTab === 'tv_screen' && isAuthorized ? (
        <StudioTvScreenPanel
          tvScreen={tvScreen}
          adminPin={adminPin}
          isSaving={isSavingBroadcastWidget}
          isFirebaseAdmin={isFirebaseAdmin}
          liveMatchActive={Boolean(match)}
          onUpdateTvScreen={updateTvScreenField}
          onStatusMessage={setStatusMessage}
        />
      ) : adminTab === 'ai_news_studio' && isAuthorized ? (
        <StudioAiNewsPanel
          adminPin={adminPin}
          onStatusMessage={setStatusMessage}
        />
      ) : adminTab === 'video_sources' && isAuthorized ? (
        <StudioVideoSources
          adminPin={adminPin}
          isAuthorized={isAuthorized}
          tvScreen={tvScreen}
          liveMatchActive={Boolean(match)}
          onUpdateTvScreen={updateTvScreenField}
          onStatusMessage={setStatusMessage}
        />
      ) : adminTab === 'media_library' && isAuthorized ? (
        <StudioMediaLibrary
          adminPin={adminPin}
          isAuthorized={isAuthorized}
          tvScreen={tvScreen}
          liveMatchActive={Boolean(match)}
          onUpdateTvScreen={updateTvScreenField}
          onStatusMessage={setStatusMessage}
        />
      ) : adminTab === 'sound' && isAuthorized ? (
        <StudioSoundPanel
          soundSettings={soundSettings}
          adminPin={adminPin}
          isSaving={isSavingBroadcastWidget}
          onUpdateSoundSettings={updateSoundSettingsField}
          onStatusMessage={setStatusMessage}
        />
      ) : adminTab === 'demo' && isAuthorized ? (
        <StudioDemoPanel
          realMatch={match}
          animationsEnabled={ballAnimationsEnabled}
          monetization={mergeMonetization(siteSettings)}
        />
      ) : adminTab === 'media' && isAuthorized ? (
        <StudioMediaManager
          match={match}
          adminPin={adminPin}
          isAuthorized={isAuthorized}
          onRefresh={onRefresh}
        />
      ) : adminTab === 'news' && isAuthorized ? (
        <StudioNewsManager
          adminPin={adminPin}
          isAuthorized={isAuthorized}
          broadcastNewsMarqueeEnabled={broadcastNewsMarqueeEnabled}
          isTogglingBroadcastMarquee={isSavingBroadcastWidget}
          onToggleBroadcastMarquee={handleToggleBroadcastNewsMarquee}
        />
      ) : adminTab === 'blog' && isAuthorized ? (
        <StudioBlogManager adminPin={adminPin} isAuthorized={isAuthorized} />
      ) : adminTab === 'monetization' && isAuthorized ? (
        <StudioMonetizationPanel
          adminPin={adminPin}
          isAuthorized={isAuthorized}
        />
      ) : adminTab === 'monetization_analytics' && isAuthorized ? (
        <Suspense
          fallback={
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-xs text-slate-400">
              Loading Monetization Analytics...
            </div>
          }
        >
          <StudioMonetizationAnalyticsPanel
            initialMonetization={mergeMonetization(siteSettings)}
            viewerBaseline={effectiveViewerStats.peak || effectiveViewerStats.total}
            onOpenMonetizationSettings={() => setAdminTab('monetization')}
          />
        </Suspense>
      ) : adminTab === 'dls' ? (
        <DlsTargetCalculator
          match={match}
          adminPin={adminPin}
          isAuthorized={isAuthorized}
          onRefresh={onRefresh}
        />
      ) : adminTab === 'site_mobile' && isAuthorized ? (
        <div className="space-y-6">
          {/* 0. Live Viewers Counter & PC/Mobile Shortcut Keys Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>Live Audience &amp; View Counter</span>
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Real-time
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl bg-slate-950 border border-emerald-500/35 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Total Live</div>
                  <div className="text-2xl font-black text-emerald-300 tabular-nums mt-0.5">
                    {effectiveViewerStats.total}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-950 border border-sky-500/30 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Website TV</div>
                  <div className="text-2xl font-black text-sky-300 tabular-nums mt-0.5">
                    {effectiveViewerStats.web}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-950 border border-emerald-500/30 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Mobile App</div>
                  <div className="text-2xl font-black text-white tabular-nums mt-0.5">
                    {effectiveViewerStats.mobile}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-950 border border-amber-500/30 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Peak Online</div>
                  <div className="text-2xl font-black text-amber-300 tabular-nums mt-0.5">
                    {effectiveViewerStats.peak}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Website, Mobile App (<code className="text-slate-300">?view=android</code>) aur OBS Overlays (<code className="text-slate-300">{effectiveViewerStats.obs}</code>) sab live track ho rahe hain.
              </p>
            </div>

            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
              <div className="pb-2.5 border-b border-slate-800">
                <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-sky-400" />
                  <span>Admin Shortcut Keys (PC &amp; Mobile)</span>
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 space-y-1">
                  <div className="font-black text-sky-300 uppercase text-[11px]">PC / Laptop Keyboard</div>
                  <div className="text-slate-200">
                    • <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">F9</kbd> ya{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">Alt+Shift+A</kbd> ya{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">Ctrl+Alt+A</kbd>: Admin Open / Exit
                  </div>
                  <div className="text-slate-400">
                    • <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">Alt+Shift+M</kbd>: Broadcast TV ↔ Mobile App switch
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 space-y-1">
                  <div className="font-black text-amber-300 uppercase text-[11px]">Mobile Touchscreen</div>
                  <div className="text-slate-200">
                    • Top-left <strong className="text-white">LIVE / Status pill</strong> (ya top-left corner) par{' '}
                    <strong className="text-amber-300">1.2 second dabaye rakhein (Long-Press)</strong> ya <strong className="text-white">5x Fast Tap</strong> karein — Admin khul jayega!
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Website App Download Button & APK Upload/Link Control */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Website App Download Button &amp; APK</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Website ke top header aur bottom par &quot;Download App&quot; button ON/OFF karein, direct .apk file upload karein ya APK URL paste karein.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={appDownload.enabled}
                disabled={isSavingBroadcastWidget}
                onClick={handleToggleAppDownload}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all shrink-0 disabled:opacity-50 ${
                  appDownload.enabled
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-slate-950 text-slate-400 border-slate-700'
                }`}
              >
                {appDownload.enabled ? 'Download Button: ON' : 'Download Button: OFF'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-6">
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                  APK Download URL (Optional — khali hone par Web App Install khulta hai)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/live-cricket-app.apk"
                  value={apkUrlInput}
                  onChange={(e) => setApkUrlInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                  Version
                </label>
                <input
                  type="text"
                  placeholder="1.0.0"
                  value={apkVersionInput}
                  onChange={(e) => setApkVersionInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-score text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="md:col-span-4 flex items-center gap-2">
                <label className="flex-1 cursor-pointer px-3 py-2.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/35 border border-sky-500/45 text-sky-200 text-xs font-black flex items-center justify-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span>{isUploadingApk ? 'Uploading...' : 'Upload .APK'}</span>
                  <input
                    type="file"
                    accept=".apk,application/vnd.android.package-archive"
                    disabled={isUploadingApk || isSavingBroadcastWidget}
                    onChange={handleUploadApkFile}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  disabled={isSavingBroadcastWidget}
                  onClick={handleSaveAppDownload}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>

          {/* 0.6 SIX PRO 3D CRICKET — Game APK Download Config */}
          <div className="bg-slate-900 border border-emerald-500/35 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-emerald-400" />
                  <span>SIX PRO 3D CRICKET — Game APK Download</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Website par SIX PRO 3D CRICKET gaming banner ke green DOWNLOAD NOW button ka APK URL yahan se replace ya upload karein.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={sixProCricket.enabled}
                disabled={isSavingBroadcastWidget}
                onClick={handleToggleGameDownload}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all shrink-0 disabled:opacity-50 ${
                  sixProCricket.enabled
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-slate-950 text-slate-400 border-slate-700'
                }`}
              >
                {sixProCricket.enabled ? 'Game Banner: ON' : 'Game Banner: OFF'}
              </button>
            </div>

            {!gameApkUrlInput.trim() && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/35 px-3.5 py-2.5 text-xs text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Pichla GitHub link (<code className="text-amber-300">vi.0/app-release.2.apk</code>) 404 return kar raha tha isliye disable kiya gaya hai. Naya valid APK URL paste karein (Verify check ke saath) ya seedha <strong>.APK</strong> file upload karein.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-5">
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                  SIX PRO 3D CRICKET APK URL
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/.../releases/download/.../six-pro-3d-cricket.apk"
                  value={gameApkUrlInput}
                  onChange={(e) => {
                    setGameApkUrlInput(e.target.value);
                    setGameApkVerifyStatus(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                  APK Size
                </label>
                <input
                  type="text"
                  placeholder="12 MB"
                  value={gameApkSizeInput}
                  onChange={(e) => setGameApkSizeInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-score text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="md:col-span-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!gameApkUrlInput.trim() || isVerifyingGameApk || isSavingBroadcastWidget}
                  onClick={handleVerifyGameApkUrl}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>{isVerifyingGameApk ? 'Checking...' : 'Verify URL'}</span>
                </button>
                <label className="flex-1 cursor-pointer px-3 py-2.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/35 border border-sky-500/45 text-sky-200 text-xs font-black flex items-center justify-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span>{isUploadingGameApk ? 'Uploading...' : 'Upload .APK'}</span>
                  <input
                    type="file"
                    accept=".apk,application/vnd.android.package-archive"
                    disabled={isUploadingGameApk || isSavingBroadcastWidget}
                    onChange={handleUploadGameApkFile}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  disabled={isSavingBroadcastWidget || isVerifyingGameApk}
                  onClick={handleSaveGameDownload}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            </div>

            {gameApkVerifyStatus && (
              <div
                className={`rounded-xl px-3.5 py-2 text-xs flex items-center gap-2 border ${
                  gameApkVerifyStatus.valid
                    ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/35 text-rose-300'
                }`}
              >
                {gameApkVerifyStatus.valid ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {gameApkVerifyStatus.valid
                    ? `Verified OK (HTTP ${gameApkVerifyStatus.status}) — download link working hai.`
                    : `URL unreachable (${gameApkVerifyStatus.error || `HTTP ${gameApkVerifyStatus.status}`}) — Save blocked taake 404 error na aaye.`}
                </span>
              </div>
            )}
          </div>

          {/* 1. Global Website + Mobile Announcement Notice Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-400" />
                  <span>Global Announcement / Notice Bar (Web &amp; Mobile App)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Yahan koi bhi notice, tournament offer ya breaking message likhein — foran har user ki website aur mobile app ke top par show hoga.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={announcement.enabled}
                disabled={isSavingBroadcastWidget}
                onClick={handleToggleAnnouncement}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border transition-all shrink-0 ${
                  announcement.enabled
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <span>{announcement.enabled ? 'Notice: ON' : 'Notice: OFF'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Notice Message
                </label>
                <input
                  type="text"
                  value={announcementTextInput}
                  onChange={(e) => setAnnouncementTextInput(e.target.value)}
                  placeholder="e.g., Aaj Sham 7:30 PM Final Match Live — Subscribe & Share Karein!"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Optional Click Link (URL)
                </label>
                <input
                  type="text"
                  value={announcementLinkInput}
                  onChange={(e) => setAnnouncementLinkInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={isSavingBroadcastWidget}
                onClick={() => handleSaveAnnouncement(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wide flex items-center gap-1.5 shadow disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Publish Notice Live</span>
              </button>
              <button
                type="button"
                disabled={isSavingBroadcastWidget}
                onClick={() => handleSaveAnnouncement(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-600/80 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Notice</span>
              </button>
            </div>
          </div>

          {/* 2. Mobile App (?view=android) Live Feature Switches & Branding */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Mobile App (?view=android) Live Feature Control</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Har user ke Mobile App mein kaun se features aur Ads dikhne chahiye — ek click mein ON/OFF karein (real-time Firebase sync).
                </p>
              </div>
              {onViewMobile && (
                <button
                  type="button"
                  onClick={onViewMobile}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-200 text-xs font-black uppercase tracking-wide flex items-center gap-1.5 shrink-0"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Preview Mobile App</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(
                [
                  {
                    key: 'adsEnabled',
                    label: 'Ads on Mobile App',
                    desc: 'Mobile App ke bottom par Ad Banner / AdSense show karein'
                  },
                  {
                    key: 'sponsorEnabled',
                    label: 'Sponsor Banner on Mobile',
                    desc: 'Main Sponsor logo aur link Mobile App mein dikhayein'
                  },
                  {
                    key: 'newsTickerEnabled',
                    label: 'Breaking News Ticker',
                    desc: 'Mobile App header ke neeche live breaking news patti'
                  },
                  {
                    key: 'pollEnabled',
                    label: 'Live Fan Poll',
                    desc: 'Mobile users vote kar sakein (Poll button)'
                  },
                  {
                    key: 'scorecardEnabled',
                    label: 'Full Scorecard & XI',
                    desc: 'Mobile Hub mein batting/bowling scorecard aur playing XI'
                  },
                  {
                    key: 'newsPageEnabled',
                    label: 'Mobile News Section',
                    desc: 'Mobile Hub mein admin published News stories'
                  },
                  {
                    key: 'blogPageEnabled',
                    label: 'Mobile Blog Section',
                    desc: 'Mobile Hub mein cricket blog articles'
                  }
                ] as const
              ).map((item) => {
                const active = Boolean(mobileApp[item.key]);
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="switch"
                    aria-checked={active}
                    disabled={isSavingBroadcastWidget}
                    onClick={() => handleToggleMobileAppField(item.key, item.label)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 disabled:opacity-60 ${
                      active
                        ? 'bg-emerald-950/30 border-emerald-500/45 hover:border-emerald-400'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-black text-white">{item.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{item.desc}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                        active ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {active ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Mobile App Header Brand Badge Text
                </label>
                <input
                  type="text"
                  value={mobileBrandBadgeInput}
                  onChange={(e) => setMobileBrandBadgeInput(e.target.value)}
                  placeholder="LIVE CRICKET TV"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                disabled={isSavingBroadcastWidget}
                onClick={handleSaveMobileBrandBadge}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wide flex items-center justify-center gap-1.5 shadow disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Mobile Badge</span>
              </button>
            </div>
          </div>

          {/* 3. Master All-Website & Mobile Functions Command Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-sky-400" />
                  <span>All Website &amp; Mobile App Functions — Master Command Center</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Yahan se website aur mobile app ke har section ko ek click mein open aur manage karein.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setAdminTab('monetization')}
                className="p-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-emerald-500/35 text-left transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-black text-emerald-300 uppercase">
                    <DollarSign className="w-4 h-4" /> Google AdSense &amp; Ads
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${siteSettings?.adsensePublisherId ? 'bg-emerald-500 text-slate-950' : 'bg-emerald-500/15 text-emerald-300'}`}>
                    {siteSettings?.adsensePublisherId ? 'AdSense Ready' : 'Setup'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Google AdSense Publisher ID, Auto Ads, ads.txt, &lt;ins&gt; code paste aur 4 Web + Mobile Ad Slots setup karein.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('tv_screen')}
                className="p-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-sky-500/35 text-left transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-black text-sky-300 uppercase">
                    <Tv className="w-4 h-4" /> TV &amp; Standby Screen
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${tvScreen.enabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    {tvScreen.enabled ? 'LIVE' : 'OFF'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Standby TV par YouTube, recorded videos, images ya Bat-Ball ads schedule aur play karein.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('video_sources')}
                className="p-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-emerald-500/35 text-left transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-black text-emerald-300 uppercase">
                    <Radio className="w-4 h-4" /> Video Sources
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                    {videoSources.length} Saved
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  YouTube aur local match stream URLs save karein aur 1 click mein feed switch karein.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('media_library')}
                className="p-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-indigo-500/35 text-left transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-black text-indigo-300 uppercase">
                    <Clapperboard className="w-4 h-4" /> Media Library
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300">
                    Firebase
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Apni recorded MP4/WebM videos upload ya link karein aur 1 click mein TV playlist par bhejein.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('sound')}
                className="p-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-emerald-500/35 text-left transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-black text-emerald-300 uppercase">
                    <Volume2 className="w-4 h-4" /> Sound &amp; Voice Pace
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${soundSettings.enabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    {soundSettings.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Female voice commentary speed/volume sliders, stadium SFX aur custom audio URLs adjust karein.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('media')}
                className="p-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-sky-500/35 text-left transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-black text-sky-300 uppercase">
                    <Users className="w-4 h-4" /> Players &amp; Team Logos
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Players photos, team flags/logos aur tournament sponsor badges upload aur sync karein.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('news')}
                className="p-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-rose-500/35 text-left transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-black text-rose-300 uppercase">
                    <Newspaper className="w-4 h-4" /> Breaking News Manager
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Live breaking ticker aur cricket news publish karein — Website aur Mobile App dono par dikhegi.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('blog')}
                className="p-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-amber-500/35 text-left transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-black text-amber-300 uppercase">
                    <BookOpen className="w-4 h-4" /> Cricket Blog Articles
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Full match previews aur cricket articles likhein jo users website aur mobile Hub mein padh sakein.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('notifications')}
                className="p-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-blue-500/35 text-left transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-black text-blue-300 uppercase">
                    <Bell className="w-4 h-4" /> Polls &amp; Push Alerts
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Fan Voting Poll launch karein aur sab viewers ko instant Push Notification bhejein.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('match')}
                className="p-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-purple-500/35 text-left transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-black text-purple-300 uppercase">
                    <Layers className="w-4 h-4" /> Match, Hold &amp; APK Link
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  CREX Live URL, Manual Score, Hold/Rain Screen, Next Match Notice aur APK Download URL control karein.
                </p>
              </button>
            </div>
          </div>
        </div>
      ) : adminTab === 'notifications' ? (
        <StudioNotificationsPanel
          match={match}
          config={config}
          adminPin={adminPin}
          isAuthorized={isAuthorized}
          onRefresh={onRefresh}
        />
      ) : (
        <>
          {/* Broadcast Playback URLs (1 - 4 Slots & Quick Toggle) */}
          {isAuthorized && (
            <TvMultiUrlSlots
              tvScreen={tvScreen}
              isSaving={isSavingBroadcastWidget}
              liveMatchActive={Boolean(match)}
              compact
              onUpdateTvScreen={updateTvScreenField}
              onStatusMessage={setStatusMessage}
              onOpenFullTvTab={() => setAdminTab('tv_screen')}
            />
          )}

          {/* Video Sources (Saved Match Feed Configurations & 1-Click Switcher) */}
          {isAuthorized && (
            <StudioVideoSources
              adminPin={adminPin}
              isAuthorized={isAuthorized}
              tvScreen={tvScreen}
              liveMatchActive={Boolean(match)}
              compact
              onUpdateTvScreen={updateTvScreenField}
              onStatusMessage={setStatusMessage}
              onOpenFullTab={() => setAdminTab('video_sources')}
            />
          )}

          {/* Win Probability Override & OBS Overlay Widget Toggles */}
          {isAuthorized && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                    <Tv className="w-4 h-4 text-sky-400" />
                    <span>Win Probability &amp; OBS Overlay Controls</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Broadcast Win Probability on/off ya manual override karein, aur OBS Overlay (?view=overlay) ke widgets alag control karein.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Win Probability Controls */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-black text-white">Broadcast Win Probability Bar</div>
                      <div className="text-[11px] text-slate-400">
                        Automatic CREX estimate (ya manual override)
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={winProbabilityEnabled}
                      disabled={isSavingBroadcastWidget}
                      onClick={handleToggleWinProbability}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase border transition-all disabled:opacity-50 ${
                        winProbabilityEnabled
                          ? 'bg-sky-600 text-white border-sky-400'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                    >
                      {winProbabilityEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Manual Override Controls */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-300">
                        Manual Override:{' '}
                        <span className={winProbabilityOverride.enabled ? 'text-amber-300' : 'text-emerald-400'}>
                          {winProbabilityOverride.enabled ? 'MANUAL ACTIVE' : 'AUTO (CREX)'}
                        </span>
                      </span>
                      {winProbabilityOverride.enabled && (
                        <button
                          type="button"
                          disabled={isSavingBroadcastWidget}
                          onClick={() => handleSaveManualWinProbability(false, manualProbInput)}
                          className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 border border-slate-700"
                        >
                          Reset to Auto
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs font-score text-slate-200">
                      <span>
                        {match?.battingTeam?.code || 'Batting'}:{' '}
                        <strong className="text-sky-300">{manualProbInput}%</strong>
                      </span>
                      <span>
                        {match?.bowlingTeam?.code || 'Bowling'}:{' '}
                        <strong className="text-amber-300">{100 - manualProbInput}%</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={manualProbInput}
                        onChange={(e) => setManualProbInput(Number(e.target.value))}
                        className="flex-1 accent-sky-500"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={manualProbInput}
                        onChange={(e) =>
                          setManualProbInput(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                        }
                        className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-score text-white text-center"
                      />
                      <button
                        type="button"
                        disabled={isSavingBroadcastWidget}
                        onClick={() => handleSaveManualWinProbability(true, manualProbInput)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shrink-0 disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>

                {/* OBS Overlay Independent Switches */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-2.5">
                  <div className="text-xs font-black text-white">
                    OBS Overlay Widgets (?view=overlay)
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Transparent OBS browser source par har widget ka alag ON/OFF control:
                  </p>

                  <div className="space-y-2 pt-1">
                    {[
                      {
                        key: 'targetPanel' as const,
                        label: 'OBS Target Panel (2nd Innings)',
                        enabled: obsPanels.targetPanel
                      },
                      {
                        key: 'winProbabilityBar' as const,
                        label: 'OBS Win Probability Bar',
                        enabled: obsPanels.winProbabilityBar
                      },
                      {
                        key: 'runRateGraph' as const,
                        label: 'OBS Run Rate Graph',
                        enabled: obsPanels.runRateGraph
                      }
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-3 bg-slate-900/70 border border-slate-800/80 rounded-lg px-3 py-2"
                      >
                        <span className="text-xs font-semibold text-slate-200">{item.label}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.enabled}
                          disabled={isSavingBroadcastWidget}
                          onClick={() => handleToggleObsPanel(item.key)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-black uppercase border transition-all disabled:opacity-50 ${
                            item.enabled
                              ? 'bg-emerald-600 text-white border-emerald-400'
                              : 'bg-slate-950 text-slate-400 border-slate-700'
                          }`}
                        >
                          {item.enabled ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* App Download Button Settings (Broadcast Public Screen) */}
          {isAuthorized && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>App Download</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Public Broadcast screen par &quot;Download Android App&quot; button, APK link aur version control karein (link khali hone par &quot;Coming soon&quot; dikhega).
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={appDownload.enabled}
                  disabled={isSavingBroadcastWidget}
                  onClick={handleToggleAppDownload}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase border transition-all shrink-0 disabled:opacity-50 ${
                    appDownload.enabled
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-slate-950 text-slate-400 border-slate-700'
                  }`}
                >
                  {appDownload.enabled ? 'Button ON' : 'Button OFF'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-6">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    APK Download URL (or Upload .APK)
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/live-cricket-app.apk"
                    value={apkUrlInput}
                    onChange={(e) => setApkUrlInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Version Number
                  </label>
                  <input
                    type="text"
                    placeholder="1.0.0"
                    value={apkVersionInput}
                    onChange={(e) => setApkVersionInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-score text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="md:col-span-4 flex items-center gap-2">
                  <label className="flex-1 cursor-pointer px-3 py-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/35 border border-sky-500/45 text-sky-200 text-xs font-black flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span>{isUploadingApk ? 'Uploading...' : 'Upload .APK'}</span>
                    <input
                      type="file"
                      accept=".apk,application/vnd.android.package-archive"
                      disabled={isUploadingApk || isSavingBroadcastWidget}
                      onChange={handleUploadApkFile}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={isSavingBroadcastWidget}
                    onClick={handleSaveAppDownload}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Hold Screen Control (Live Hold, YouTube Playlist & Hold Sponsor) */}
          {isAuthorized && (
            <div
              className={`bg-slate-900 rounded-2xl p-5 shadow-lg space-y-5 border ${
                holdScreen.active ? 'border-amber-400/70 ring-1 ring-amber-400/30' : 'border-slate-800'
              }`}
            >
              {/* Header & Big Hold Screen ON/OFF Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                      <PauseCircle className="w-4 h-4 text-amber-400" />
                      <span>Hold Screen Control</span>
                    </h3>
                    {holdScreen.active ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-[11px] font-black text-amber-300 uppercase">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        Hold Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-400 uppercase">
                        Off (Live Mode)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    On karne par sab viewers (Mobile App aur Broadcast) ko score ki jagah Hold Screen dikhegi, aur peeche score sync chalta rahega.
                  </p>
                  {!isFirebaseAdmin && (
                    <p className="text-[11px] text-amber-300 font-semibold">
                      Note: Global Firebase cloud sync ke liye upar Google Admin Sign In karein.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isSavingBroadcastWidget}
                  onClick={handleToggleHoldButton}
                  className={`px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-wider border transition-all shrink-0 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
                    holdScreen.active
                      ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-rose-600/30'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow-amber-500/25'
                  }`}
                >
                  <PauseCircle className="w-5 h-5" />
                  <span>{holdScreen.active ? 'Hold Screen ON (Tap to OFF)' : 'Hold Screen ON Karein'}</span>
                </button>
              </div>

              {/* Confirmation Prompt before activating Hold Screen */}
              {holdConfirmPending && !holdScreen.active && (
                <div className="rounded-xl bg-amber-500/15 border border-amber-400/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-amber-100 text-xs sm:text-sm font-bold">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Sab viewers ko hold screen dikhegi ({holdScreen.reason}). Kya aap Hold Screen ON karna chahte hain?</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setHoldConfirmPending(false)}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingBroadcastWidget}
                      onClick={handleConfirmEnableHold}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase"
                    >
                      Haan, Hold ON Karein
                    </button>
                  </div>
                </div>
              )}

              {/* Hold Reason + Separate OBS Overlay Switch */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
                  <div className="text-xs font-black text-white uppercase tracking-wide">
                    Hold Reason Chunein
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {HOLD_REASONS.map((reasonOption) => {
                      const selected = holdScreen.reason === reasonOption;
                      return (
                        <button
                          key={reasonOption}
                          type="button"
                          disabled={isSavingBroadcastWidget}
                          onClick={() =>
                            updateHoldScreenField(
                              { reason: reasonOption },
                              `Hold reason "${reasonOption}" par set ho gaya!`
                            )
                          }
                          className={`px-3 py-2 rounded-xl text-xs font-bold border text-center transition-all disabled:opacity-50 ${
                            selected
                              ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {reasonOption}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* OBS Overlay Independent Hold Switch */}
                <div className="lg:col-span-4 bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-white flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-sky-400" />
                      <span>OBS Overlay Hold Screen</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      OBS Overlay (?view=overlay) par Hold Banner alag se ON ya OFF rakhein.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={holdScreen.obsEnabled}
                    disabled={isSavingBroadcastWidget}
                    onClick={() =>
                      updateHoldScreenField(
                        { obsEnabled: !holdScreen.obsEnabled },
                        `OBS Overlay Hold Screen ${!holdScreen.obsEnabled ? 'ON' : 'OFF'} ho gaya!`
                      )
                    }
                    className={`w-full py-2.5 rounded-xl text-xs font-black uppercase border transition-all disabled:opacity-50 ${
                      holdScreen.obsEnabled
                        ? 'bg-sky-600 text-white border-sky-400'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {holdScreen.obsEnabled ? 'OBS Hold: ON' : 'OBS Hold: OFF'}
                  </button>
                </div>
              </div>

              {/* YouTube Video Playlist + Loop Section */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-800/80">
                  <div>
                    <div className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-2">
                      <Video className="w-4 h-4 text-rose-400" />
                      <span>Video (YouTube Playlist)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      YouTube links paste karein. Video muted autoplay se shuru hogi (user Sound button se unmute karega). Link khali/error par wapas Bat-Ball animation dikhegi.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={holdScreen.videoLoop}
                      disabled={isSavingBroadcastWidget}
                      onClick={() =>
                        updateHoldScreenField(
                          { videoLoop: !holdScreen.videoLoop },
                          `Hold Video Playlist Loop ${!holdScreen.videoLoop ? 'ON' : 'OFF'} ho gaya!`
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                        holdScreen.videoLoop
                          ? 'bg-violet-600 text-white border-violet-400'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span>Loop: {holdScreen.videoLoop ? 'ON' : 'OFF'}</span>
                    </button>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={holdScreen.videoEnabled}
                      disabled={isSavingBroadcastWidget}
                      onClick={() =>
                        updateHoldScreenField(
                          { videoEnabled: !holdScreen.videoEnabled },
                          `Play on Hold Screen ${!holdScreen.videoEnabled ? 'ON' : 'OFF'} ho gaya!`
                        )
                      }
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase border transition-all disabled:opacity-50 ${
                        holdScreen.videoEnabled
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                    >
                      Play on Hold Screen: {holdScreen.videoEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                {/* Add YouTube URL Input */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    placeholder="YouTube video link paste karein (https://youtube.com/watch?v=... ya youtu.be/...)"
                    value={holdVideoUrlInput}
                    onChange={(e) => setHoldVideoUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddHoldVideoUrl();
                      }
                    }}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
                  />
                  <button
                    type="button"
                    disabled={isSavingBroadcastWidget || !holdVideoUrlInput.trim()}
                    onClick={handleAddHoldVideoUrl}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add to Playlist</span>
                  </button>
                </div>

                {/* Playlist Items */}
                {holdScreen.videoUrls.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {holdScreen.videoUrls.map((url, idx) => (
                      <div
                        key={`${url}-${idx}`}
                        className="flex items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-rose-500/20 border border-rose-400/40 text-[10px] font-black text-rose-300 flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs text-slate-200 truncate">{url}</span>
                        </div>
                        <button
                          type="button"
                          disabled={isSavingBroadcastWidget}
                          onClick={() => handleRemoveHoldVideoUrl(idx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 shrink-0"
                          title="Remove video"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Playlist khali hai — agar &quot;Play on Hold Screen&quot; on ho tab bhi khali hone par Bat-Ball animation chalegi.
                  </p>
                )}
              </div>

              {/* Hold Sponsor / Ad Banner Section */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-800/80">
                  <div>
                    <div className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-emerald-400" />
                      <span>Hold Screen Sponsor / Ad Banner</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Hold screen par video/animation ke saath ya us ki jagah Sponsor banner (image aur link) dikhayein.
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={holdScreen.sponsorEnabled}
                    disabled={isSavingBroadcastWidget}
                    onClick={() =>
                      updateHoldScreenField(
                        { sponsorEnabled: !holdScreen.sponsorEnabled },
                        `Hold Sponsor Banner ${!holdScreen.sponsorEnabled ? 'ON' : 'OFF'} ho gaya!`
                      )
                    }
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase border shrink-0 transition-all disabled:opacity-50 ${
                      holdScreen.sponsorEnabled
                        ? 'bg-emerald-600 text-white border-emerald-400'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    Sponsor Banner: {holdScreen.sponsorEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Mode Selector: With Content vs Replace Video/Animation */}
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { value: 'with_content' as HoldSponsorMode, label: 'Video / Animation ke Saath' },
                    { value: 'replace_video' as HoldSponsorMode, label: 'Video / Animation ki Jagah' }
                  ].map((modeOpt) => {
                    const active = holdScreen.sponsorMode === modeOpt.value;
                    return (
                      <button
                        key={modeOpt.value}
                        type="button"
                        disabled={isSavingBroadcastWidget}
                        onClick={() =>
                          updateHoldScreenField(
                            { sponsorMode: modeOpt.value },
                            `Sponsor display mode "${modeOpt.label}" par set ho gaya!`
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-50 ${
                          active
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                            : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {modeOpt.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-5">
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Sponsor Image URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/sponsor-banner.png"
                      value={holdSponsorImgInput}
                      onChange={(e) => setHoldSponsorImgInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="md:col-span-5">
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Sponsor Link URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://sponsor-website.com"
                      value={holdSponsorLinkInput}
                      onChange={(e) => setHoldSponsorLinkInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      disabled={isSavingBroadcastWidget}
                      onClick={handleSaveHoldSponsor}
                      className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Next Match Info (Shown on No-Match Animation Screen) */}
          {isAuthorized && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
              <div className="pb-2.5 border-b border-slate-800">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-sky-400" />
                  <span>Next Match Info (No-Match Screen)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Jab koi live match na ho to Mobile App aur Broadcast screen par agle match ka naam aur waqt dikhayein (jaise &quot;Next: PAK vs SL, 10 Nov, 2:00 PM&quot;).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-5">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Agle Match ka Naam
                  </label>
                  <input
                    type="text"
                    placeholder="PAK vs SL"
                    value={nextMatchNameInput}
                    onChange={(e) => setNextMatchNameInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Date / Waqt
                  </label>
                  <input
                    type="text"
                    placeholder="10 Nov, 2:00 PM"
                    value={nextMatchTimeInput}
                    onChange={(e) => setNextMatchTimeInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="md:col-span-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSavingBroadcastWidget}
                    onClick={() => handleSaveNextMatchNotice(false)}
                    className="flex-1 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSavingBroadcastWidget}
                    onClick={() => handleSaveNextMatchNotice(true)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Match Stopwatch / Elapsed Timer (Firebase Synced) */}
          {isAuthorized && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <Timer className="w-4 h-4 text-emerald-400" />
                  <span>Broadcast Match Stopwatch (Firebase)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Tracks elapsed match time on the Broadcast view based on Firebase active state.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <MatchElapsedTimer timer={matchTimer} />

                {matchTimer.active ? (
                  <button
                    type="button"
                    disabled={isSavingBroadcastWidget}
                    onClick={handlePauseMatchTimer}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSavingBroadcastWidget}
                    onClick={handleStartMatchTimer}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{matchTimer.accumulatedMs > 0 ? 'Resume' : 'Start Timer'}</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSavingBroadcastWidget}
                  onClick={handleResetMatchTimer}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          )}

          {/* Active Match Status Overview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white uppercase tracking-wider">
              Server Active Match
            </span>
            {config?.activeMatchId ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                ONLINE & PERSISTED
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                NO ACTIVE MATCH
              </span>
            )}
          </div>

          {config?.activeMatchId && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setAdminTab('dls')}
                className="px-3 py-1.5 rounded-xl bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-500/40 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>{match?.dlsDetails?.applied ? 'DLS Target Active' : 'Calculate DLS'}</span>
              </button>
              <button
                onClick={openScoreEditor}
                disabled={isSubmitting || !isAuthorized}
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/40 text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Score & Teams</span>
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isSubmitting || !isAuthorized}
                className="px-3 py-1.5 rounded-xl bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/40 text-xs font-bold transition-all disabled:opacity-40"
              >
                Disconnect Match
              </button>
            </div>
          )}
        </div>

        {config?.activeMatchId && match ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-base font-bold text-white flex items-center gap-2">
                  <span>{match.title}</span>
                  <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    {match.battingTeam.shortName} {match.battingTeam.score.runs}/{match.battingTeam.score.wickets} ({match.battingTeam.score.overs}.{match.battingTeam.score.balls})
                  </span>
                </div>
                <div className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">{config.crexUrl}</span>
                </div>
                <div className="text-[11px] text-slate-400 flex flex-wrap gap-4 pt-1 font-mono">
                  <span>Striker: <strong className="text-slate-200">{match.striker.name} ({match.striker.runs}*)</strong></span>
                  <span>Bowler: <strong className="text-slate-200">{match.currentBowler.name} ({match.currentBowler.wickets}/{match.currentBowler.runs})</strong></span>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-semibold">Engine Status</span>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-300">Data Source:</span>
                    <button
                      onClick={handleToggleAutoSync}
                      disabled={!isAuthorized}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${
                        config.dataSourceMode === 'manual' || !config.isAutoSyncEnabled
                          ? 'bg-amber-500 text-slate-950'
                          : config.syncStatus === 'failed'
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {config.dataSourceMode === 'manual' || !config.isAutoSyncEnabled
                        ? 'MANUAL'
                        : config.syncStatus === 'failed'
                        ? 'SYNC BAND HAI'
                        : 'AUTO SYNC'}
                    </button>
                  </div>
                  {isAuthorized && config.syncStatus === 'failed' && (
                    <div className="mt-2 text-[11px] font-bold text-rose-400">
                      {config.syncError || 'Sync band hai, Manual mode on karein.'}
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 font-mono mt-3">
                  Last synced: {new Date(config.lastSyncedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Quick Score Adjustment Controls */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Instant Ball Scoring:</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => handleQuickAddScore(1)}
                  disabled={!isAuthorized || isSubmitting}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700"
                >
                  +1 Run
                </button>
                <button
                  onClick={() => handleQuickAddScore(2)}
                  disabled={!isAuthorized || isSubmitting}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700"
                >
                  +2 Runs
                </button>
                <button
                  onClick={() => handleQuickAddScore(4)}
                  disabled={!isAuthorized || isSubmitting}
                  className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-bold border border-blue-500/40"
                >
                  +4 Four
                </button>
                <button
                  onClick={() => handleQuickAddScore(6)}
                  disabled={!isAuthorized || isSubmitting}
                  className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white text-xs font-bold border border-purple-500/40"
                >
                  +6 Six
                </button>
                <button
                  onClick={() => handleQuickAddScore(0, true)}
                  disabled={!isAuthorized || isSubmitting}
                  className="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold border border-rose-500/40"
                >
                  🚨 Wicket!
                </button>
                <button
                  onClick={() => handleQuickAddScore(0)}
                  disabled={!isAuthorized || isSubmitting}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-mono"
                >
                  Dot (•)
                </button>
              </div>
            </div>

            {/* Live Score & Match Editor Form */}
            {isEditingScore && (
              <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/40 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-bold text-sm text-blue-400 flex items-center gap-2">
                    <Edit3 className="w-4 h-4" /> Live Match Details Editor (Applies to OBS & Broadcast)
                  </span>
                  <button onClick={() => setIsEditingScore(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Match Title</label>
                    <input
                      type="text"
                      value={editFormData.title}
                      onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Batting Team Name</label>
                    <input
                      type="text"
                      value={editFormData.battingTeamName}
                      onChange={(e) => setEditFormData({ ...editFormData, battingTeamName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Bowling Team Name</label>
                    <input
                      type="text"
                      value={editFormData.bowlingTeamName}
                      onChange={(e) => setEditFormData({ ...editFormData, bowlingTeamName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Target</label>
                    <input
                      type="number"
                      value={editFormData.target}
                      onChange={(e) => setEditFormData({ ...editFormData, target: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Runs</label>
                    <input
                      type="number"
                      value={editFormData.runs}
                      onChange={(e) => setEditFormData({ ...editFormData, runs: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Wickets</label>
                    <input
                      type="number"
                      value={editFormData.wickets}
                      onChange={(e) => setEditFormData({ ...editFormData, wickets: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Overs</label>
                    <input
                      type="number"
                      value={editFormData.overs}
                      onChange={(e) => setEditFormData({ ...editFormData, overs: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Balls in Over (0-5)</label>
                    <input
                      type="number"
                      value={editFormData.balls}
                      onChange={(e) => setEditFormData({ ...editFormData, balls: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Striker Batsman</label>
                    <input
                      type="text"
                      value={editFormData.strikerName}
                      onChange={(e) => setEditFormData({ ...editFormData, strikerName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Current Bowler</label>
                    <input
                      type="text"
                      value={editFormData.bowlerName}
                      onChange={(e) => setEditFormData({ ...editFormData, bowlerName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-slate-400 block mb-1">Status Text</label>
                    <input
                      type="text"
                      value={editFormData.statusText}
                      onChange={(e) => setEditFormData({ ...editFormData, statusText: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsEditingScore(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveScoreEdit}
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Apply to OBS & Broadcast</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 bg-slate-950 rounded-xl border border-dashed border-slate-800">
            No active match connected. Paste a CREX URL below, choose from Discoverable Matches, or switch to Manual mode after verifying PIN.
          </div>
        )}
      </div>

      {/* Password-Protected Data Source Toggle & Manual Score Entry Panel */}
      {isAuthorized ? (
        <ManualScorePanel
          match={match}
          config={config}
          adminPin={adminPin}
          isAuthorized={isAuthorized}
          onRefresh={onRefresh}
          onStatusMessage={setStatusMessage}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-400">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Data Source (Auto Sync / Manual) aur Manual Score Entry controls dekhne ke liye upar Admin PIN verify karein.</span>
        </div>
      )}

      {/* Connect Match Input */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2 text-blue-400">
          <Link className="w-4 h-4" /> Connect or Change CREX Match
        </h3>
        <p className="text-xs text-slate-400">
          Paste any CREX match URL (e.g., <code className="text-blue-300 bg-slate-950 px-1 py-0.5 rounded">https://crex.live/scoreboard/...</code>) or Match ID.
          Once connected, all Android users, OBS overlays, and broadcasts update simultaneously with that exact match!
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Paste CREX Scoreboard URL or Match ID..."
            value={crexUrlInput}
            onChange={(e) => setCrexUrlInput(e.target.value)}
            disabled={!isAuthorized || isSubmitting}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
          />
          <button
            onClick={() => handleConnect(crexUrlInput)}
            disabled={!isAuthorized || isSubmitting || !crexUrlInput.trim()}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Connecting...' : 'Connect Match'}
          </button>
        </div>

        {/* Quick One-Click Match Switcher */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>One-Click Quick Presets (Auto-Parses & Displays on OBS & Broadcast):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleConnect('https://crex.com/cricket-live-score/ban-vs-wi-2nd-test-west-indies-tour-of-bangladesh-2026-match-updates-13TE')}
              disabled={!isAuthorized || isSubmitting}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>WI vs BAN 2nd Test (Live CREX)</span>
            </button>
            <button
              onClick={() => handleConnect('https://crex.com/cricket-live-score/prs-w-vs-syt-w-11th-t20-womens-big-bash-league-2026-match-updates-12XE')}
              disabled={!isAuthorized || isSubmitting}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-purple-500/30 hover:border-purple-500/60 text-purple-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              <span>Perth vs Sydney (Live BBL)</span>
            </button>
            <button
              onClick={() => handleConnect('m_eng_pak_t20')}
              disabled={!isAuthorized || isSubmitting}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
            >
              <span>🇵🇰 PAK vs ENG (T20)</span>
            </button>
            <button
              onClick={() => handleConnect('https://crex.live/scoreboard/m44211/lahore-qalandars-vs-karachi-kings-15th-match-psl-2026')}
              disabled={!isAuthorized || isSubmitting}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
            >
              <span>🏏 Lahore Qalandars vs Karachi Kings (PSL)</span>
            </button>
            <button
              onClick={() => handleConnect('https://crex.live/scoreboard/m44212/peshawar-zalmi-vs-islamabad-united-16th-match-psl-2026')}
              disabled={!isAuthorized || isSubmitting}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
            >
              <span>⚡ Peshawar Zalmi vs Islamabad United (PSL)</span>
            </button>
            <button
              onClick={() => handleConnect('m_ind_aus_t20_wc')}
              disabled={!isAuthorized || isSubmitting}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
            >
              <span>🇮🇳 IND vs AUS (T20 WC)</span>
            </button>
            <button
              onClick={() => handleConnect('m_sa_ind_test')}
              disabled={!isAuthorized || isSubmitting}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
            >
              <span>🇿🇦 SA vs IND (Test)</span>
            </button>
            <button
              onClick={() => handleConnect('m_aus_eng_ashes')}
              disabled={!isAuthorized || isSubmitting}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
            >
              <span>🇦🇺 AUS vs ENG (The Ashes)</span>
            </button>
            <button
              onClick={() => handleConnect('m_nz_wi_odi')}
              disabled={!isAuthorized || isSubmitting}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
            >
              <span>🌴 WI vs NZ (ODI)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Discover Live Matches (1-Click Connect) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2 text-amber-400">
              <Flame className="w-4 h-4" /> Discoverable Matches (All CREX Feeds)
            </h3>
            <p className="text-xs text-slate-400">
              All publicly accessible matches on CREX (Live & Upcoming):
            </p>
          </div>
          <button
            onClick={loadDiscoverable}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>↻ Refresh Feeds</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {discoverMatches.map((dm) => (
            <div
              key={dm.id}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                config?.activeMatchId === dm.id
                  ? 'bg-blue-950/30 border-blue-500 shadow-md'
                  : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm truncate">{dm.title}</span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-1.5 py-0.2 rounded border border-slate-700 shrink-0">
                    {dm.format}
                  </span>
                  {dm.isLive && (
                    <span className="text-[9px] bg-red-600 text-white font-black px-1.5 py-0.2 rounded uppercase shrink-0">
                      LIVE
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">{dm.series}</div>
                <div className="text-[11px] text-amber-400 font-mono mt-1">{dm.status}</div>
              </div>

              <div className="shrink-0">
                {config?.activeMatchId === dm.id ? (
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                    Active
                  </span>
                ) : (
                  <button
                    onClick={() => handleConnect(dm.id)}
                    disabled={!isAuthorized || isSubmitting}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-40"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Simulation / Test Controls for Overlays */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
        <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2 text-purple-400">
          <Sparkles className="w-4 h-4" /> Live Milestone & Event Test Console
        </h3>
        <p className="text-xs text-slate-400">
          Test real-time animations, boundary sirens, milestone celebration banners, and OBS graphic overlays:
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => handleTriggerEvent('four')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-blue-600/30 border border-blue-500 text-blue-300 hover:bg-blue-600 hover:text-white font-bold text-xs transition-all disabled:opacity-40"
          >
            FOUR (4)
          </button>
          <button
            onClick={() => handleTriggerEvent('six')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-purple-600/30 border border-purple-500 text-purple-300 hover:bg-purple-600 hover:text-white font-bold text-xs transition-all disabled:opacity-40"
          >
            SIX (6)
          </button>
          <button
            onClick={() => handleTriggerEvent('wicket')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-rose-600/30 border border-rose-500 text-rose-300 hover:bg-rose-600 hover:text-white font-bold text-xs transition-all disabled:opacity-40"
          >
            WICKET (W)
          </button>
          <button
            onClick={() => handleTriggerEvent('thirty')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-sky-600/30 border border-sky-500 text-sky-300 hover:bg-sky-600 hover:text-white font-bold text-xs transition-all disabled:opacity-40"
          >
            THIRTY (30*)
          </button>
          <button
            onClick={() => handleTriggerEvent('fifty')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-yellow-600/30 border border-yellow-500 text-yellow-300 hover:bg-yellow-600 hover:text-white font-bold text-xs transition-all disabled:opacity-40"
          >
            FIFTY (50*)
          </button>
          <button
            onClick={() => handleTriggerEvent('century')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-amber-600/30 border border-amber-500 text-amber-300 hover:bg-amber-600 hover:text-white font-bold text-xs transition-all disabled:opacity-40"
          >
            CENTURY (100*)
          </button>
          <button
            onClick={() => handleTriggerEvent('double_century')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-purple-700/30 border border-purple-600 text-purple-200 hover:bg-purple-700 hover:text-white font-bold text-xs transition-all disabled:opacity-40"
          >
            200* DOUBLE TON
          </button>
          <button
            onClick={() => handleTriggerEvent('three_wickets')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-teal-600/30 border border-teal-500 text-teal-300 hover:bg-teal-600 hover:text-white font-bold text-xs transition-all disabled:opacity-40"
          >
            3-WICKET SPELL
          </button>
          <button
            onClick={() => handleTriggerEvent('five_wickets')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-emerald-600/30 border border-emerald-500 text-emerald-300 hover:bg-emerald-600 hover:text-white font-bold text-xs transition-all disabled:opacity-40"
          >
            5W HAUL
          </button>
          <button
            onClick={() => handleTriggerEvent('maiden')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white font-bold text-xs transition-all disabled:opacity-40"
          >
            MAIDEN OVER
          </button>
          <button
            onClick={() => handleTriggerEvent('innings_break')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-blue-600/30 border border-blue-500 text-blue-300 hover:bg-blue-600 hover:text-white font-bold text-xs transition-all disabled:opacity-40"
          >
            INNINGS BREAK
          </button>
          <button
            onClick={() => handleTriggerEvent('match_result')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500 hover:text-slate-950 font-bold text-xs transition-all disabled:opacity-40"
          >
            MATCH RESULT
          </button>
          <button
            onClick={() => handleTriggerEvent('tight_finish')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-red-600/30 border border-red-500 text-red-300 hover:bg-red-600 hover:text-white font-bold text-xs transition-all disabled:opacity-40"
          >
            TIGHT FINISH (LAST OVER)
          </button>
          <button
            onClick={() => handleTriggerEvent('single')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 font-bold text-xs transition-all disabled:opacity-40"
          >
            Single (1)
          </button>
          <button
            onClick={() => handleTriggerEvent('dot')}
            disabled={!isAuthorized || !match}
            className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 font-bold text-xs transition-all disabled:opacity-40"
          >
            Dot Ball (•)
          </button>
        </div>
      </div>

      {/* BroadcastView Scrolling News Ticker Quick Control */}
      <StudioScrollingTickerCard
        adminPin={adminPin}
        isAuthorized={isAuthorized}
        onOpenAiNewsStudioTab={() => setAdminTab('ai_news_studio')}
        onStatusMessage={setStatusMessage}
      />

      {/* Active Firestore News Articles Section */}
      <StudioFirestoreNewsSection
        adminPin={adminPin}
        isAuthorized={isAuthorized}
        onOpenFullNewsTab={() => setAdminTab('news')}
        broadcastNewsMarqueeEnabled={broadcastNewsMarqueeEnabled}
        isTogglingBroadcastMarquee={isSavingBroadcastWidget}
        onToggleBroadcastMarquee={handleToggleBroadcastNewsMarquee}
      />

      {/* Connected Application Links */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
        <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2 text-emerald-400">
          <Layers className="w-4 h-4" /> Live Feeds & Overlay URLs
        </h3>
        <p className="text-xs text-slate-400">
          Share these URLs with your production team or OBS Browser Sources:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Public Broadcast (Default / Clean) */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/30 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Radio className="w-4 h-4 text-emerald-400" /> Public Broadcast
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Normal link. Clean TV graphics, no menus, no tabs.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <a
                href={broadcastUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-1.5 text-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
              >
                Open TV
              </a>
              <button
                onClick={() => copyToClipboard(broadcastUrl, 'broadcast')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono"
              >
                {copiedUrl === 'broadcast' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* OBS Overlay */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-purple-500/30 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Tv className="w-4 h-4 text-purple-400" /> OBS Overlay
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Transparent lower-third for OBS Studio (?view=overlay).
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <a
                href={obsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-1.5 text-center rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all"
              >
                Open OBS
              </a>
              <button
                onClick={() => copyToClipboard(obsUrl, 'obs')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono"
              >
                {copiedUrl === 'obs' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Android App */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-blue-500/30 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Smartphone className="w-4 h-4 text-blue-400" /> Android App
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Mobile scoreboard & commentary (?view=android).
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <a
                href={appUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-1.5 text-center rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all"
              >
                Open App
              </a>
              <button
                onClick={() => copyToClipboard(appUrl, 'app')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono"
              >
                {copiedUrl === 'app' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Studio Admin (Bookmark) */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/30 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Lock className="w-4 h-4 text-amber-400" /> Studio Admin
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Hidden admin console link (?view=admin).
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => copyToClipboard(adminUrl, 'admin')}
                className="w-full py-1.5 text-center rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all"
              >
                {copiedUrl === 'admin' ? 'Admin Link Copied!' : 'Copy Admin Link'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )}
</div>
  );
};
