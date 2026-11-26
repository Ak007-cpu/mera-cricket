import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  Filter,
  Image as ImageIcon,
  Mic,
  Newspaper,
  Radio,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Tv,
  Type as TypeIcon,
  Upload,
  UserCheck,
  Volume2
} from 'lucide-react';
import {
  AI_NEWS_CATEGORIES,
  AI_NEWS_EDITORIAL_CATEGORIES,
  AI_NEWS_VOICES,
  AiNewsAnchorId,
  AiNewsCategory,
  AiNewsEditorialCategory,
  AiNewsStudioConfig,
  AiNewsStudioState,
  AiNewsVoiceName,
  BroadcastTickerMode
} from '../../types/cricket';
import { ScrollingNewsTicker } from '../Broadcast/ScrollingNewsTicker';
import {
  buildApiUrl,
  deleteAiNewsBulletin,
  fetchAiNewsStudioState,
  previewAiNewsVoiceSample,
  refreshAiNewsStudioNow,
  updateAiNewsBulletin,
  updateAiNewsStudioConfig,
  uploadAdminMedia
} from '../../services/api';
import anchorMaleImg from '../../assets/images/anchor_male_pk_1795595980240.jpg';
import anchorFemaleImg from '../../assets/images/anchor_female_pk_1795595980224.jpg';
import defaultChannelLogo from '../../assets/images/datavault_sports_logo_1795595979043.jpg';

interface StudioAiNewsPanelProps {
  adminPin: string;
  onStatusMessage: (msg: { text: string; type: 'success' | 'error' } | null) => void;
}

export const StudioAiNewsPanel: React.FC<StudioAiNewsPanelProps> = ({
  adminPin,
  onStatusMessage
}) => {
  const [studioState, setStudioState] = useState<AiNewsStudioState | null>(null);
  const [draft, setDraft] = useState<AiNewsStudioConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingNews, setIsRefreshingNews] = useState(false);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingAnchor, setIsUploadingAnchor] = useState(false);
  const [filterCategory, setFilterCategory] = useState<'All' | AiNewsEditorialCategory>('All');
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const [busyBulletinId, setBusyBulletinId] = useState<string | null>(null);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const anchorFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadState = async () => {
    setIsLoading(true);
    try {
      const state = await fetchAiNewsStudioState();
      if (state) {
        setStudioState(state);
        setDraft(state.config);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadState();
  }, []);

  const handleSaveConfig = async (overridePatch?: Partial<AiNewsStudioConfig>) => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const payload = overridePatch ? { ...draft, ...overridePatch } : draft;
      const updated = await updateAiNewsStudioConfig(payload, adminPin);
      setStudioState(updated);
      setDraft(updated.config);
      onStatusMessage({
        text: `${updated.config.companyName} Studio settings saved & synced live to all TV screens.`,
        type: 'success'
      });
    } catch (err: any) {
      onStatusMessage({
        text: err?.message || 'Failed to save AI News Studio settings',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshNewsNow = async () => {
    setIsRefreshingNews(true);
    try {
      const updated = await refreshAiNewsStudioNow(adminPin, true);
      setStudioState(updated);
      setDraft(updated.config);
      if (updated.lastError) {
        onStatusMessage({
          text: `News fetch reported issue: ${updated.lastError}`,
          type: 'error'
        });
      } else {
        onStatusMessage({
          text: `Fetched ${updated.bulletins.length} verified sports bulletins & generated Urdu broadcast scripts.`,
          type: 'success'
        });
      }
    } catch (err: any) {
      onStatusMessage({
        text: err?.message || 'Failed to fetch verified sports news',
        type: 'error'
      });
    } finally {
      setIsRefreshingNews(false);
    }
  };

  const handlePreviewVoice = async () => {
    if (!draft) return;
    setIsPreviewingVoice(true);
    try {
      const blob = await previewAiNewsVoiceSample(draft.voiceName, draft.anchorName, adminPin);
      const url = URL.createObjectURL(blob);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(url);
      audio.playbackRate = draft.speechRate || 1.0;
      previewAudioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      onStatusMessage({
        text: `Playing Gemini Urdu Voice preview (${draft.voiceName}) for ${draft.anchorName}.`,
        type: 'success'
      });
    } catch (err: any) {
      onStatusMessage({
        text: err?.message || 'Could not play Gemini TTS voice preview',
        type: 'error'
      });
    } finally {
      setIsPreviewingVoice(false);
    }
  };

  const handleUploadImageFile = async (
    file: File,
    target: 'logo' | 'anchor'
  ) => {
    const reader = new FileReader();
    if (target === 'logo') setIsUploadingLogo(true);
    else setIsUploadingAnchor(true);

    reader.onload = async () => {
      try {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!dataUrl) throw new Error('Could not read selected file');
        const res = await uploadAdminMedia(
          dataUrl,
          target === 'logo' ? 'studio_logo' : 'studio_anchor',
          adminPin
        );
        if (draft) {
          const patch =
            target === 'logo'
              ? { logoUrl: res.imageUrl }
              : { anchorId: 'custom' as AiNewsAnchorId, customAnchorImageUrl: res.imageUrl };
          setDraft({ ...draft, ...patch });
          await handleSaveConfig(patch);
        }
      } catch (err: any) {
        onStatusMessage({
          text: err?.message || 'Image upload failed',
          type: 'error'
        });
      } finally {
        if (target === 'logo') setIsUploadingLogo(false);
        else setIsUploadingAnchor(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleCategory = (catId: AiNewsCategory) => {
    if (!draft) return;
    const exists = draft.categories.includes(catId);
    const next = exists
      ? draft.categories.filter((c) => c !== catId)
      : [...draft.categories, catId];
    if (next.length === 0) return;
    setDraft({ ...draft, categories: next });
  };

  const handleUpdateBulletin = async (
    bulletinId: string,
    patch: { editorialCategory?: AiNewsEditorialCategory; isBreaking?: boolean }
  ) => {
    setBusyBulletinId(bulletinId);
    try {
      const updated = await updateAiNewsBulletin(bulletinId, patch, adminPin);
      setStudioState(updated);
      onStatusMessage({
        text: 'News bulletin category & status updated live.',
        type: 'success'
      });
    } catch (err: any) {
      onStatusMessage({
        text: err?.message || 'Failed to update bulletin',
        type: 'error'
      });
    } finally {
      setBusyBulletinId(null);
    }
  };

  const handleDeleteBulletin = async (bulletinId: string) => {
    setBusyBulletinId(bulletinId);
    try {
      const updated = await deleteAiNewsBulletin(bulletinId, adminPin);
      setStudioState(updated);
      onStatusMessage({
        text: 'Bulletin removed from AI News Studio queue.',
        type: 'success'
      });
    } catch (err: any) {
      onStatusMessage({
        text: err?.message || 'Failed to delete bulletin',
        type: 'error'
      });
    } finally {
      setBusyBulletinId(null);
    }
  };

  const allBulletins = studioState?.bulletins || [];

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allBulletins.length };
    for (const cat of AI_NEWS_EDITORIAL_CATEGORIES) {
      counts[cat.id] = 0;
    }
    for (const b of allBulletins) {
      const key = b.editorialCategory || 'General';
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [allBulletins]);

  const filteredBulletins = useMemo(() => {
    const q = queueSearchQuery.trim().toLowerCase();
    return allBulletins.filter((b) => {
      const bCat = b.editorialCategory || 'General';
      if (filterCategory !== 'All' && bCat !== filterCategory) return false;
      if (!q) return true;
      return (
        b.englishHeadline.toLowerCase().includes(q) ||
        b.urduHeadline.toLowerCase().includes(q) ||
        (b.matchedPlayerName || '').toLowerCase().includes(q) ||
        (b.matchedTeamCode || '').toLowerCase().includes(q) ||
        bCat.toLowerCase().includes(q)
      );
    });
  }, [allBulletins, filterCategory, queueSearchQuery]);

  if (isLoading || !draft) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-xs text-slate-300 flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
        <span>Loading DATA VAULT SPORTS HD AI News Studio...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Studio Header & Quick Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-black text-[10px] uppercase tracking-wider">
              AI SPORTS NEWS TV STUDIO
            </span>
            <span className="text-[11px] text-slate-400">
              Google Search Grounding + Pakistani Urdu Anchor + Gemini TTS
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-400" />
            <span>{draft.companyName || 'DATA VAULT SPORTS HD'} Control Desk</span>
          </h2>
          <p className="text-xs text-slate-400">
            Live cricket match na hone par Broadcast TV automatically Urdu AI Sports News mode mein chala jata hai.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href="?view=news-tv"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Tv className="w-3.5 h-3.5 text-sky-400" />
            <span>Open 24/7 News TV</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>

          <button
            type="button"
            disabled={isRefreshingNews || studioState?.isFetching}
            onClick={handleRefreshNewsNow}
            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-xs font-black inline-flex items-center gap-1.5 shadow whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingNews || studioState?.isFetching ? 'animate-spin' : ''}`} />
            <span>{isRefreshingNews || studioState?.isFetching ? 'Gathering News...' : 'Fetch Verified News Now'}</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveConfig()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-black inline-flex items-center gap-1.5 shadow whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Studio Settings'}</span>
          </button>
        </div>
      </div>

      {/* Status / Error Banner */}
      {studioState?.lastError && (
        <div className="rounded-2xl border border-amber-500/45 bg-amber-950/30 px-4 py-3 text-xs text-amber-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-black text-amber-200">AI Newsroom Status Notice</div>
              <div className="mt-0.5 leading-relaxed">{studioState.lastError}</div>
              {studioState.nextScheduledFetchAt > Date.now() && (
                <div className="mt-1 text-[11px] text-amber-300/80">
                  Next automatic retry at{' '}
                  {new Date(studioState.nextScheduledFetchAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  . You can also click Fetch Verified News Now to retry manually.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Broadcast Mode & Branding Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Branding & Auto Broadcast Mode */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
          <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2 pb-2 border-b border-slate-800">
            <ImageIcon className="w-4 h-4 text-amber-400" />
            <span>Company Branding &amp; Broadcast Mode</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <div>
                <div className="text-xs font-black text-white">AI Studio Enabled</div>
                <div className="text-[11px] text-slate-400">Auto background updates</div>
              </div>
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                className="w-4 h-4 accent-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <div>
                <div className="text-xs font-black text-white">Auto Switch (No Match)</div>
                <div className="text-[11px] text-slate-400">Show News TV when idle</div>
              </div>
              <input
                type="checkbox"
                checked={draft.autoSwitchOnNoMatch}
                onChange={(e) => setDraft({ ...draft, autoSwitchOnNoMatch: e.target.checked })}
                className="w-4 h-4 accent-emerald-500"
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Company / Channel Name</label>
            <input
              type="text"
              value={draft.companyName}
              onChange={(e) => setDraft({ ...draft, companyName: e.target.value })}
              placeholder="DATA VAULT SPORTS HD"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300">Channel Logo (URL or Upload)</label>
            <div className="flex items-center gap-3">
              <img
                src={draft.logoUrl ? (draft.logoUrl.startsWith('/api/') ? buildApiUrl(draft.logoUrl) : draft.logoUrl) : defaultChannelLogo}
                alt="Channel logo preview"
                className="w-12 h-12 rounded-xl object-cover border border-amber-400/50 bg-slate-950 shrink-0"
              />
              <input
                type="text"
                value={draft.logoUrl}
                onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })}
                placeholder="Leave empty for built-in DATA VAULT emblem"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadImageFile(file, 'logo');
                }}
              />
              <button
                type="button"
                disabled={isUploadingLogo}
                onClick={() => logoFileInputRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploadingLogo ? 'Uploading...' : 'Upload'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">News Refresh (Mins)</label>
              <input
                type="number"
                min={5}
                max={180}
                value={draft.refreshIntervalMinutes}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    refreshIntervalMinutes: Math.max(5, Math.min(180, Number(e.target.value) || 15))
                  })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">Slide Fallback (Sec)</label>
              <input
                type="number"
                min={10}
                max={90}
                value={draft.bulletinDurationSec}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    bulletinDurationSec: Math.max(10, Math.min(90, Number(e.target.value) || 22))
                  })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">Ticker Speed</label>
              <select
                value={draft.tickerSpeed}
                onChange={(e) =>
                  setDraft({ ...draft, tickerSpeed: e.target.value as 'slow' | 'normal' | 'fast' })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
              >
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </div>
          </div>
        </div>

        {/* AI Urdu Anchor & Voice Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
          <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2 pb-2 border-b border-slate-800">
            <UserCheck className="w-4 h-4 text-sky-400" />
            <span>AI Urdu News Anchor &amp; Studio Voice</span>
          </h3>

          {/* Anchor Preset Picker */}
          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                { id: 'male_pk', label: 'Zain Tariq', sub: 'Male Anchor', img: anchorMaleImg, defaultVoice: 'Charon' },
                { id: 'female_pk', label: 'Ayesha Khan', sub: 'Female Anchor', img: anchorFemaleImg, defaultVoice: 'Kore' },
                {
                  id: 'custom',
                  label: 'Custom Anchor',
                  sub: 'Uploaded Photo',
                  img: draft.customAnchorImageUrl
                    ? draft.customAnchorImageUrl.startsWith('/api/')
                      ? buildApiUrl(draft.customAnchorImageUrl)
                      : draft.customAnchorImageUrl
                    : anchorMaleImg,
                  defaultVoice: draft.voiceName
                }
              ] as const
            ).map((preset) => {
              const selected = draft.anchorId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      anchorId: preset.id,
                      anchorName: preset.id === 'custom' ? draft.anchorName : preset.label,
                      voiceName: preset.defaultVoice as AiNewsVoiceName
                    })
                  }
                  className={`p-2 rounded-xl border text-left transition-all flex flex-col items-center gap-1.5 ${
                    selected
                      ? 'bg-sky-500/20 border-sky-400 shadow-md'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <img
                    src={preset.img}
                    alt={preset.label}
                    className="w-12 h-14 rounded-lg object-cover object-top border border-white/15"
                  />
                  <div className="text-center">
                    <div className="text-[11px] font-black text-white leading-tight">{preset.label}</div>
                    <div className="text-[10px] text-slate-400">{preset.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">Anchor Name</label>
              <input
                type="text"
                value={draft.anchorName}
                onChange={(e) => setDraft({ ...draft, anchorName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">Anchor Desk Title</label>
              <input
                type="text"
                value={draft.anchorTitle}
                onChange={(e) => setDraft({ ...draft, anchorTitle: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
              />
            </div>
          </div>

          {draft.anchorId === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft.customAnchorImageUrl}
                onChange={(e) => setDraft({ ...draft, customAnchorImageUrl: e.target.value })}
                placeholder="Custom anchor portrait URL..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
              <input
                ref={anchorFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadImageFile(file, 'anchor');
                }}
              />
              <button
                type="button"
                disabled={isUploadingAnchor}
                onClick={() => anchorFileInputRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 whitespace-nowrap"
              >
                {isUploadingAnchor ? 'Uploading...' : 'Upload Photo'}
              </button>
            </div>
          )}

          {/* Voice Selection + Test Urdu Voice Button */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-7 space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                <span>Gemini Urdu Broadcast Voice</span>
              </label>
              <select
                value={draft.voiceName}
                onChange={(e) => setDraft({ ...draft, voiceName: e.target.value as AiNewsVoiceName })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
              >
                {AI_NEWS_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} — {v.tone}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-5">
              <button
                type="button"
                disabled={isPreviewingVoice}
                onClick={handlePreviewVoice}
                className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isPreviewingVoice ? 'Synthesizing...' : 'Test Urdu Voice'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span>Speech Speed</span>
                <span className="text-sky-300 font-mono">{draft.speechRate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.8}
                max={1.35}
                step={0.05}
                value={draft.speechRate}
                onChange={(e) => setDraft({ ...draft, speechRate: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.autoSpeak}
                  onChange={(e) => setDraft({ ...draft, autoSpeak: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span>Auto-Speak Urdu</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.showSourcesOnScreen}
                  onChange={(e) => setDraft({ ...draft, showSourcesOnScreen: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span>Show Sources</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BroadcastView Scrolling News Ticker Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <TypeIcon className="w-4 h-4 text-rose-400" />
              <span>BroadcastView Scrolling News Ticker</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Pulls breaking headlines from AI News Studio or streams custom manual text on the Broadcast screen.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={draft.broadcastTickerEnabled}
              disabled={isSaving}
              onClick={() => {
                const next = !draft.broadcastTickerEnabled;
                setDraft({ ...draft, broadcastTickerEnabled: next });
                handleSaveConfig({ broadcastTickerEnabled: next });
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border transition-all whitespace-nowrap shrink-0 disabled:opacity-60 ${
                draft.broadcastTickerEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {draft.broadcastTickerEnabled ? (
                <Eye className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {draft.broadcastTickerEnabled ? 'Visible on Broadcast' : 'Hidden on Broadcast'}
              </span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveConfig()}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-xs font-black inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Save className="w-3.5 h-3.5 shrink-0" />
              <span>{isSaving ? 'Syncing...' : 'Apply Ticker Live'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Source Mode & Breaking Filter */}
          <div className="lg:col-span-5 space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Ticker Content Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'auto', label: 'AI Breaking' },
                    { id: 'manual', label: 'Manual Only' },
                    { id: 'combined', label: 'Combined' }
                  ] as Array<{ id: BroadcastTickerMode; label: string }>
                ).map((opt) => {
                  const selected = draft.broadcastTickerMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, broadcastTickerMode: opt.id })}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all whitespace-nowrap ${
                        selected
                          ? 'bg-emerald-500/20 border-emerald-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <div className="min-w-0 pr-3">
                <div className="text-xs font-black text-white">Breaking News Filter</div>
                <div className="text-[11px] text-slate-400">
                  Prioritize breaking AI bulletins (falls back to top verified news if none marked breaking)
                </div>
              </div>
              <input
                type="checkbox"
                checked={draft.broadcastTickerBreakingOnly}
                onChange={(e) =>
                  setDraft({ ...draft, broadcastTickerBreakingOnly: e.target.checked })
                }
                className="w-4 h-4 accent-emerald-500 shrink-0"
              />
            </label>
          </div>

          {/* Manual Ticker Text Editor */}
          <div className="lg:col-span-7 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Manual Ticker Text (English / اردو)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  {(draft.broadcastTickerManualText || '').length}/800
                </span>
                {draft.broadcastTickerManualText && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, broadcastTickerManualText: '' })}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>
            <textarea
              dir="auto"
              rows={3}
              maxLength={800}
              value={draft.broadcastTickerManualText}
              onChange={(e) =>
                setDraft({ ...draft, broadcastTickerManualText: e.target.value })
              }
              placeholder="Example: BREAKING: Pakistan squad announced for T20 series | بابر اعظم کی شاندار واپسی"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-400">
              Separate multiple ticker headlines using <code className="text-slate-200">|</code> or a new line. Works in Manual Only or Combined mode.
            </p>
          </div>
        </div>

        {/* Live Ticker Preview */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
            <span>BroadcastView Live Preview</span>
            {!draft.broadcastTickerEnabled && (
              <span className="text-amber-400">
                Currently hidden on BroadcastView (dimmed preview)
              </span>
            )}
          </div>
          <ScrollingNewsTicker
            studioState={studioState}
            previewConfigOverride={draft}
            forceShowInPreview
          />
        </div>
      </div>

      {/* 4. Automated News Categories */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-emerald-400" />
            <span>Verified News Categories (Google Search Grounding)</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            Selected: {draft.categories.length} / {AI_NEWS_CATEGORIES.length}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {AI_NEWS_CATEGORIES.map((cat) => {
            const active = draft.categories.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between gap-2 ${
                  active
                    ? 'bg-emerald-500/15 border-emerald-400/55 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{cat.label}</div>
                  <div dir="rtl" className="font-urdu text-[11px] text-amber-300 mt-0.5 truncate">
                    {cat.urduLabel}
                  </div>
                </div>
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-400' : 'text-slate-700'}`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Active Broadcast Queue, Category Filter & Content Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Active On-Air Urdu News Queue ({filteredBulletins.length}/{allBulletins.length})
            </span>
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span>
              Last Fetch:{' '}
              <strong className="text-slate-200 tabular-nums">
                {studioState?.lastFetchedAt
                  ? new Date(studioState.lastFetchedAt).toLocaleString()
                  : 'Never'}
              </strong>
            </span>
            <span>
              Deduplicated Stories Tracked:{' '}
              <strong className="text-emerald-300 tabular-nums">
                {studioState?.coveredHistoryCount || 0}
              </strong>
            </span>
          </div>
        </div>

        {/* Category Filter Controls + Broadcast Filter + Search */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-5 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={queueSearchQuery}
              onChange={(e) => setQueueSearchQuery(e.target.value)}
              placeholder="Search bulletins by headline, player, team..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="lg:col-span-3 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <select
              value={filterCategory}
              onChange={(e) =>
                setFilterCategory(e.target.value as 'All' | AiNewsEditorialCategory)
              }
              aria-label="Category filter for news bulletins"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-sky-500"
            >
              <option value="All">Category: All ({categoryCounts.All})</option>
              {AI_NEWS_EDITORIAL_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label} ({categoryCounts[cat.id] || 0})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-4 flex items-center gap-2">
            <label
              htmlFor="broadcast-category-lock"
              className="text-[11px] font-bold text-slate-400 whitespace-nowrap shrink-0"
            >
              On-Air Filter:
            </label>
            <select
              id="broadcast-category-lock"
              value={draft.broadcastCategoryFilter || 'All'}
              disabled={isSaving}
              onChange={(e) => {
                const nextCat = e.target.value as 'All' | AiNewsEditorialCategory;
                setDraft({ ...draft, broadcastCategoryFilter: nextCat });
                handleSaveConfig({ broadcastCategoryFilter: nextCat });
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-emerald-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="All">All Categories (Auto Rotate)</option>
              {AI_NEWS_EDITORIAL_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  Broadcast {cat.label} Only
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div
          role="tablist"
          aria-label="Filter AI news bulletins by category"
          className="flex flex-wrap items-center gap-1.5 text-xs"
        >
          {(
            [
              { id: 'All', label: 'All' },
              ...AI_NEWS_EDITORIAL_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))
            ] as Array<{ id: 'All' | AiNewsEditorialCategory; label: string }>
          ).map((tab) => {
            const active = filterCategory === tab.id;
            const count = categoryCounts[tab.id] || 0;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilterCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    active ? 'text-sky-100' : 'text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {filteredBulletins.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredBulletins.map((b, idx) => {
              const isBusy = busyBulletinId === b.id;
              const currentEditorial = b.editorialCategory || 'General';
              return (
                <div
                  key={b.id}
                  className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/35 text-sky-300 text-[10px] font-black uppercase tabular-nums">
                          #{idx + 1} • {currentEditorial}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {b.categoryLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleUpdateBulletin(b.id, { isBreaking: !b.isBreaking })
                          }
                          title="Toggle Breaking status"
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors whitespace-nowrap shrink-0 ${
                            b.isBreaking
                              ? 'bg-rose-600 text-white hover:bg-rose-500'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {b.isBreaking ? 'Breaking' : 'Mark Breaking'}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeleteBulletin(b.id)}
                          aria-label="Delete bulletin"
                          title="Remove bulletin from queue"
                          className="p-1 rounded bg-slate-900 hover:bg-rose-600/20 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div dir="rtl" className="font-urdu text-sm font-bold text-white leading-relaxed">
                      {b.urduHeadline}
                    </div>
                    <div className="text-xs font-semibold text-slate-300">
                      {b.englishHeadline}
                    </div>
                    <p
                      dir="rtl"
                      className="font-urdu text-xs text-slate-400 leading-relaxed line-clamp-3"
                    >
                      {b.urduScript}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      {b.sources.map((s, si) => (
                        <a
                          key={`${s.url}_${si}`}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-emerald-300 hover:text-white"
                        >
                          <span>{s.name}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))}
                    </div>

                    <select
                      value={currentEditorial}
                      disabled={isBusy}
                      aria-label={`Change category for ${b.englishHeadline}`}
                      onChange={(e) =>
                        handleUpdateBulletin(b.id, {
                          editorialCategory: e.target.value as AiNewsEditorialCategory
                        })
                      }
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-200 focus:outline-none focus:border-sky-500 shrink-0"
                    >
                      {AI_NEWS_EDITORIAL_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        ) : allBulletins.length > 0 ? (
          <div className="rounded-xl bg-slate-950/70 border border-slate-800 py-8 px-4 text-center space-y-2.5">
            <div className="text-xs font-bold text-slate-300">
              No bulletins match category &ldquo;{filterCategory}&rdquo;
              {queueSearchQuery.trim() ? ` and search "${queueSearchQuery.trim()}"` : ''}.
            </div>
            <button
              type="button"
              onClick={() => {
                setFilterCategory('All');
                setQueueSearchQuery('');
              }}
              className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold whitespace-nowrap"
            >
              Show All Categories ({allBulletins.length})
            </button>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-400">
            No bulletins cached yet. Click &ldquo;Fetch Verified News Now&rdquo; to trigger Google Search grounding.
          </div>
        )}
      </div>
    </div>
  );
};
