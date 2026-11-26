import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TvPlaylistItem, TvPlaylistMediaType, TvScreenConfig } from '../../types/cricket';
import { extractYouTubeVideoId, isYouTubeChannelLiveUrl } from '../Common/HoldYouTubePlayer';
import {
  Tv,
  Play,
  Save,
  X,
  Power,
  AlertCircle,
  CheckCircle2,
  Link2,
  ExternalLink,
  Repeat,
  Lock,
  Radio
} from 'lucide-react';

export type SlotTypePreference = 'auto' | TvPlaylistMediaType;

interface UrlSlotDraft {
  id: string;
  url: string;
  title: string;
  preferredType: SlotTypePreference;
  durationSec: number;
}

interface TvMultiUrlSlotsProps {
  tvScreen: TvScreenConfig;
  isSaving: boolean;
  liveMatchActive?: boolean;
  compact?: boolean;
  onUpdateTvScreen: (patch: Partial<TvScreenConfig>, successText: string) => Promise<void>;
  onStatusMessage: (msg: { text: string; type: 'success' | 'error' }) => void;
  onOpenFullTvTab?: () => void;
}

const SLOT_COUNT = 4;
const AUTO_SWITCH_INTERVAL_SEC = 300; // 5 minutes

function makeSlotId(index: number): string {
  return `tv_slot_${index + 1}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

function buildDraftsFromPlaylist(playlist: TvPlaylistItem[] = []): UrlSlotDraft[] {
  const slots: UrlSlotDraft[] = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const existing = playlist[i];
    if (existing) {
      slots.push({
        id: existing.id || makeSlotId(i),
        url: existing.url || '',
        title: existing.title || '',
        preferredType: existing.mediaType || 'auto',
        durationSec: Math.max(3, Math.min(600, Number(existing.durationSec) || AUTO_SWITCH_INTERVAL_SEC))
      });
    } else {
      slots.push({
        id: makeSlotId(i),
        url: '',
        title: '',
        preferredType: 'auto',
        durationSec: AUTO_SWITCH_INTERVAL_SEC
      });
    }
  }
  return slots;
}

export function normalizeSlotMediaInput(
  rawUrl: string,
  preferredType: SlotTypePreference
): { ok: true; mediaType: TvPlaylistMediaType; url: string } | { ok: false; error: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: 'URL khali hai.' };
  }

  if (/^(javascript|vbscript):/i.test(trimmed)) {
    return { ok: false, error: 'Ye URL format safe nahi hai. Sahih https:// link dalein.' };
  }

  if (trimmed.startsWith('data:image/')) {
    return { ok: true, mediaType: 'image', url: trimmed };
  }

  if (/^data:/i.test(trimmed)) {
    return { ok: false, error: 'Sirf valid https:// link, YouTube link, video ya image URL dalein.' };
  }

  // News TV URL detection
  const looksLikeNewsTv =
    /(?:[?&]view=news-tv|live-sports-news|cricket-news-tv)/i.test(trimmed) ||
    preferredType === 'news_feed';

  if (looksLikeNewsTv) {
    if (trimmed.startsWith('/')) {
      return { ok: true, mediaType: 'news_feed', url: trimmed.slice(0, 2000) };
    }
    const newsCandidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(newsCandidate);
      return { ok: true, mediaType: 'news_feed', url: parsed.toString().slice(0, 2000) };
    } catch {
      return { ok: false, error: 'Galat News TV URL format.' };
    }
  }

  // YouTube detection (also supports mobile share text containing a YouTube URL)
  const looksLikeYouTube =
    /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(trimmed) ||
    preferredType === 'youtube';

  if (looksLikeYouTube) {
    const videoId = extractYouTubeVideoId(trimmed);
    if (!videoId) {
      if (isYouTubeChannelLiveUrl(trimmed)) {
        return {
          ok: false,
          error:
            'Channel /live link embed nahi hota. Video ke Share button se https://youtu.be/... ya https://youtube.com/live/VIDEO_ID copy karke dalein.'
        };
      }
      return {
        ok: false,
        error:
          'Galat YouTube link! Sahih format: https://youtube.com/watch?v=... , https://youtu.be/... ya https://youtube.com/live/...'
      };
    }
    return {
      ok: true,
      mediaType: 'youtube',
      url: `https://www.youtube.com/watch?v=${videoId}`
    };
  }

  // Validate relative or http(s) URL
  let resolvedUrl = '';
  if (trimmed.startsWith('/')) {
    if (trimmed.length < 2 || /\s/.test(trimmed)) {
      return { ok: false, error: 'Galat path format!' };
    }
    resolvedUrl = trimmed.slice(0, 2000);
  } else {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(candidate);
      const hasDotOrLocalhost =
        parsed.hostname.includes('.') || parsed.hostname === 'localhost';
      if (!hasDotOrLocalhost || /\s/.test(trimmed)) {
        return {
          ok: false,
          error: 'Galat URL! Poora link dalein (maslan https://example.com/live).'
        };
      }
      resolvedUrl = parsed.toString().slice(0, 2000);
    } catch {
      return {
        ok: false,
        error: 'Galat URL format! Sahih https:// link dalein.'
      };
    }
  }

  if (preferredType !== 'auto') {
    return { ok: true, mediaType: preferredType, url: resolvedUrl };
  }

  // Auto-detect by extension
  const cleanPath = resolvedUrl.split(/[?#]/)[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(cleanPath)) {
    return { ok: true, mediaType: 'image', url: resolvedUrl };
  }
  if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(cleanPath)) {
    return { ok: true, mediaType: 'video', url: resolvedUrl };
  }

  // Default for live match player / website / stream URLs
  return { ok: true, mediaType: 'embed', url: resolvedUrl };
}

export const TvMultiUrlSlots: React.FC<TvMultiUrlSlotsProps> = ({
  tvScreen,
  isSaving,
  liveMatchActive = false,
  compact = false,
  onUpdateTvScreen,
  onStatusMessage,
  onOpenFullTvTab
}) => {
  const [slots, setSlots] = useState<UrlSlotDraft[]>(() =>
    buildDraftsFromPlaylist(tvScreen.playlist)
  );
  const [slotError, setSlotError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const isDirtyRef = useRef(false);

  const externalSig = useMemo(
    () =>
      (tvScreen.playlist || [])
        .slice(0, SLOT_COUNT)
        .map((it) => `${it.id}|${it.url}|${it.title}|${it.mediaType}|${it.durationSec}`)
        .join('::'),
    [tvScreen.playlist]
  );

  useEffect(() => {
    if (!isDirtyRef.current) {
      setSlots(buildDraftsFromPlaylist(tvScreen.playlist));
    }
  }, [externalSig, tvScreen.playlist]);

  const updateSlot = (idx: number, patch: Partial<UrlSlotDraft>) => {
    isDirtyRef.current = true;
    setSlotError(null);
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const handleClearSlot = (idx: number) => {
    isDirtyRef.current = true;
    setSlotError(null);
    setSlots((prev) =>
      prev.map((s, i) =>
        i === idx
          ? { ...s, url: '', title: '', preferredType: 'auto', durationSec: AUTO_SWITCH_INTERVAL_SEC }
          : s
      )
    );
  };

  const buildMergedPlaylist = (
    overrideDurationSec?: number
  ):
    | { ok: true; nextPlaylist: TvPlaylistItem[]; slotItems: (TvPlaylistItem | null)[] }
    | { ok: false; error: string } => {
    const slotItems: (TvPlaylistItem | null)[] = [];
    const filledItems: TvPlaylistItem[] = [];

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot.url.trim()) {
        slotItems.push(null);
        continue;
      }

      const normalized = normalizeSlotMediaInput(slot.url, slot.preferredType);
      if (!normalized.ok) {
        return { ok: false, error: `URL ${i + 1}: ${normalized.error}` };
      }

      const rawDur = overrideDurationSec ?? (Number(slot.durationSec) || AUTO_SWITCH_INTERVAL_SEC);
      const dur = Math.max(3, Math.min(600, Math.round(rawDur)));
      const item: TvPlaylistItem = {
        id: slot.id || makeSlotId(i),
        mediaType: normalized.mediaType,
        url: normalized.url,
        title: slot.title.trim().slice(0, 120) || `Playback URL ${i + 1}`,
        durationSec: dur
      };
      slotItems.push(item);
      filledItems.push(item);
    }

    const tailItems = (tvScreen.playlist || []).slice(SLOT_COUNT);
    const merged = [...filledItems, ...tailItems].slice(0, 20);
    return { ok: true, nextPlaylist: merged, slotItems };
  };

  const handleSaveSlots = async (activateAutoSwitch: boolean) => {
    setSlotError(null);
    const built = buildMergedPlaylist(activateAutoSwitch ? AUTO_SWITCH_INTERVAL_SEC : undefined);
    if (!built.ok) {
      setSlotError(built.error);
      onStatusMessage({ text: built.error, type: 'error' });
      return;
    }

    if (activateAutoSwitch && built.nextPlaylist.length === 0) {
      const msg = 'Kam az kam URL 1 mein koi link dalein tab Auto-switch chalega.';
      setSlotError(msg);
      onStatusMessage({ text: msg, type: 'error' });
      return;
    }

    const patch: Partial<TvScreenConfig> = {
      playlist: built.nextPlaylist
    };

    if (activateAutoSwitch) {
      patch.enabled = true;
      patch.playbackStopped = false;
      patch.loop = true;
      patch.playNowItemId = built.nextPlaylist[0].id;
      patch.playNowNonce = Date.now();
    } else if (built.nextPlaylist.length > 0) {
      const hasValidPinned = built.nextPlaylist.some((it) => it.id === tvScreen.playNowItemId);
      if (!tvScreen.enabled || tvScreen.playbackStopped) {
        patch.enabled = true;
        patch.playbackStopped = false;
      }
      if (!hasValidPinned) {
        patch.playNowItemId = built.nextPlaylist[0].id;
        patch.playNowNonce = Date.now();
      }
    } else {
      patch.enabled = false;
      patch.playNowItemId = '';
    }

    try {
      await onUpdateTvScreen(
        patch,
        activateAutoSwitch
          ? `Auto-switch ON — ${built.nextPlaylist.length} Playback URL(s) ab har 5 minute mein automatically switch honge!`
          : built.nextPlaylist.length > 0
          ? 'Playback URLs (1–4) save aur Broadcast Live Screen par activate ho gaye!'
          : 'Sab playback URLs clear ho gaye!'
      );
      if (activateAutoSwitch) {
        setSlots((prev) =>
          prev.map((s) => (s.url.trim() ? { ...s, durationSec: AUTO_SWITCH_INTERVAL_SEC } : s))
        );
      }
      isDirtyRef.current = false;
      setSavedToast(activateAutoSwitch ? 'Auto-switch (5m) ON' : 'URLs Saved');
      setTimeout(() => setSavedToast(null), 3000);
    } catch (err: any) {
      const msg = err?.message || 'URLs save karne mein error aaya.';
      setSlotError(msg);
    }
  };

  // Toggle Auto-switch (5 min automatic cycling across active playback URLs)
  const handleToggleAutoSwitch = async () => {
    setSlotError(null);
    const nextAutoSwitch = !tvScreen.loop;

    const built = buildMergedPlaylist(nextAutoSwitch ? AUTO_SWITCH_INTERVAL_SEC : undefined);
    if (!built.ok) {
      setSlotError(built.error);
      onStatusMessage({ text: built.error, type: 'error' });
      return;
    }

    if (nextAutoSwitch && built.nextPlaylist.length === 0) {
      const msg = 'Auto-switch ON karne ke liye kam az kam 1–2 active Playback URLs dalein.';
      setSlotError(msg);
      onStatusMessage({ text: msg, type: 'error' });
      return;
    }

    const currentPinnedValid = built.nextPlaylist.some((it) => it.id === tvScreen.playNowItemId);
    const targetPlayNowId = currentPinnedValid
      ? tvScreen.playNowItemId
      : built.nextPlaylist[0]?.id || '';

    const patch: Partial<TvScreenConfig> = {
      loop: nextAutoSwitch,
      playlist: built.nextPlaylist,
      ...(nextAutoSwitch
        ? {
            enabled: true,
            playbackStopped: false,
            playNowItemId: targetPlayNowId,
            playNowNonce: Date.now()
          }
        : {
            playNowItemId: targetPlayNowId
          })
    };

    try {
      await onUpdateTvScreen(
        patch,
        nextAutoSwitch
          ? `Auto-switch ON — System ab har 5 minute (300s) mein ${built.nextPlaylist.length} active stream(s) ko cycle karega!`
          : 'Auto-switch OFF — BroadcastView ab selected URL par locked rahega.'
      );
      if (nextAutoSwitch) {
        setSlots((prev) =>
          prev.map((s) => (s.url.trim() ? { ...s, durationSec: AUTO_SWITCH_INTERVAL_SEC } : s))
        );
      }
      isDirtyRef.current = false;
      setSavedToast(nextAutoSwitch ? 'Auto-switch (5m) ON' : 'Auto-switch OFF');
      setTimeout(() => setSavedToast(null), 3000);
    } catch (err: any) {
      setSlotError(err?.message || 'Auto-switch update nahi ho saka.');
    }
  };

  // Toggle directly to a specific URL (respects current Auto-switch ON/OFF setting)
  const handleToggleToSlot = async (idx: number) => {
    setSlotError(null);
    const targetDraft = slots[idx];
    if (!targetDraft || !targetDraft.url.trim()) {
      const msg = `URL ${idx + 1} khali hai — pehle link paste karein.`;
      setSlotError(msg);
      onStatusMessage({ text: msg, type: 'error' });
      return;
    }

    const built = buildMergedPlaylist();
    if (!built.ok) {
      setSlotError(built.error);
      onStatusMessage({ text: built.error, type: 'error' });
      return;
    }

    const targetItem = built.slotItems[idx];
    if (!targetItem) return;

    const autoSwitchEnabled = Boolean(tvScreen.loop);

    try {
      await onUpdateTvScreen(
        {
          enabled: true,
          playbackStopped: false,
          loop: autoSwitchEnabled,
          playlist: built.nextPlaylist,
          playNowItemId: targetItem.id,
          playNowNonce: Date.now()
        },
        autoSwitchEnabled
          ? `URL ${idx + 1} ("${targetItem.title}") ab ON AIR hai (Auto-switch har 5m active)!`
          : `Broadcast Screen ab URL ${idx + 1} ("${targetItem.title}") par switch ho gayi hai!`
      );
      isDirtyRef.current = false;
      setSavedToast(`URL ${idx + 1} Active`);
      setTimeout(() => setSavedToast(null), 3000);
    } catch (err: any) {
      setSlotError(err?.message || 'URL switch nahi ho saka.');
    }
  };

  const activePlaylist = tvScreen.playlist || [];
  const filledCount = slots.filter((s) => s.url.trim().length > 0).length;
  const isAutoSwitchOn = Boolean(tvScreen.loop);

  const isSlotActive = (slot: UrlSlotDraft, idx: number): boolean => {
    if (!tvScreen.enabled || tvScreen.playbackStopped || activePlaylist.length === 0) return false;
    if (!slot.url.trim()) return false;
    if (tvScreen.playNowItemId) {
      return tvScreen.playNowItemId === slot.id;
    }
    return idx === 0 && activePlaylist[0]?.id === slot.id;
  };

  const activeSlotIdx = slots.findIndex((s, i) => isSlotActive(s, i));
  const activeSlotLabel =
    activeSlotIdx >= 0
      ? slots[activeSlotIdx].title.trim() || `Playback URL ${activeSlotIdx + 1}`
      : null;

  return (
    <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tv className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              Broadcast Playback URLs (1 – 4 Switcher)
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                tvScreen.enabled && !tvScreen.playbackStopped && activePlaylist.length > 0
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {tvScreen.enabled && !tvScreen.playbackStopped && activePlaylist.length > 0
                ? activeSlotLabel
                  ? `LIVE: ${activeSlotLabel}`
                  : `ON AIR (${filledCount}/4)`
                : `${filledCount}/4 SET`}
            </span>
            {savedToast && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-bold text-emerald-300">
                <CheckCircle2 className="w-3 h-3" />
                <span>{savedToast}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Har slot ko naam dein (e.g. <strong>Main Feed</strong>, <strong>Sky Sports</strong>, <strong>Willow</strong>), manually switch karein, ya <strong>Auto-switch (5 min)</strong> ON karein.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            role="switch"
            aria-checked={isAutoSwitchOn}
            disabled={isSaving}
            onClick={handleToggleAutoSwitch}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black border flex items-center gap-2 transition-all disabled:opacity-40 ${
              isAutoSwitchOn
                ? 'bg-violet-600/25 border-violet-400 text-violet-100 shadow-[0_0_14px_rgba(139,92,246,0.25)]'
                : 'bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
            title="Cycle through active playback URLs automatically every 5 minutes (300s)"
          >
            {isAutoSwitchOn ? (
              <Repeat className="w-3.5 h-3.5 text-violet-300" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>Auto-switch (5m):</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                isAutoSwitchOn
                  ? 'bg-violet-500 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isAutoSwitchOn ? 'ON' : 'OFF'}
            </span>
          </button>

          {onOpenFullTvTab && (
            <button
              type="button"
              onClick={onOpenFullTvTab}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-sky-300 flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full TV Tab</span>
            </button>
          )}

          <button
            type="button"
            disabled={isSaving}
            onClick={() =>
              onUpdateTvScreen(
                { enabled: !tvScreen.enabled, playbackStopped: false },
                !tvScreen.enabled
                  ? 'Broadcast URL Screen ON ho gayi!'
                  : 'Broadcast URL Screen OFF — Default Live Ground wapas aa gaya!'
              )
            }
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase border flex items-center gap-1.5 disabled:opacity-40 ${
              tvScreen.enabled
                ? 'bg-rose-600/90 hover:bg-rose-500 text-white border-rose-400'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{tvScreen.enabled ? 'Screen OFF' : 'Screen ON'}</span>
          </button>
        </div>
      </div>

      {/* Quick Dashboard Toggle Bar for 1-4 Playback URLs */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>Active Stream Switcher</span>
            </span>
            {activeSlotLabel ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/45 text-[11px] font-black text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  Currently Selected: {activeSlotLabel} (URL {activeSlotIdx + 1})
                </span>
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-slate-500">
                No stream currently selected on air
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400">
            {isAutoSwitchOn
              ? 'Auto-switch ON: Streams har 5 minute (300s) mein cycle hongi'
              : 'Manual Mode: Selected stream BroadcastView par locked rahegi'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {slots.map((slot, idx) => {
            const hasUrl = slot.url.trim().length > 0;
            const active = isSlotActive(slot, idx);
            const streamLabel = slot.title.trim();
            return (
              <button
                key={`toggle_${idx}`}
                type="button"
                disabled={isSaving || !hasUrl}
                onClick={() => handleToggleToSlot(idx)}
                className={`px-3 py-2 rounded-xl border text-left transition-all flex items-center justify-between gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  active
                    ? 'bg-emerald-600/25 border-emerald-400 text-white shadow-[0_0_16px_rgba(16,185,129,0.22)]'
                    : hasUrl
                    ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-slate-950 border-slate-800/80 text-slate-500'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-black uppercase ${
                        active ? 'text-emerald-300' : 'text-cyan-300'
                      }`}
                    >
                      URL {idx + 1}
                    </span>
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </div>
                  <div className="text-xs font-extrabold truncate">
                    {streamLabel || (hasUrl ? `Playback URL ${idx + 1}` : 'Empty Slot')}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                    active
                      ? 'bg-emerald-500 text-slate-950'
                      : hasUrl
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-slate-900 text-slate-600'
                  }`}
                >
                  {active ? 'LIVE' : hasUrl ? 'Switch' : '--'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Dedicated URL Slots Editor */}
      <div className={`grid grid-cols-1 ${compact ? 'xl:grid-cols-2' : 'lg:grid-cols-2'} gap-3`}>
        {slots.map((slot, idx) => {
          const isCurrentlyPlaying = isSlotActive(slot, idx);
          const displayLabel = slot.title.trim() || `Playback URL ${idx + 1}`;

          return (
            <div
              key={`slot_${idx}`}
              className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
                isCurrentlyPlaying
                  ? 'bg-emerald-950/30 border-emerald-500/60'
                  : 'bg-slate-950/90 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/35 text-[11px] font-black text-cyan-300 shrink-0">
                    <Link2 className="w-3 h-3" />
                    <span>URL {idx + 1}</span>
                  </span>
                  <span className="text-xs font-extrabold text-white truncate">
                    {displayLabel}
                  </span>
                  {isCurrentlyPlaying && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-black text-emerald-300 uppercase shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Active</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={slot.preferredType}
                    onChange={(e) =>
                      updateSlot(idx, {
                        preferredType: e.target.value as SlotTypePreference
                      })
                    }
                    aria-label={`URL ${idx + 1} type`}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-200 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="auto">Auto Detect</option>
                    <option value="embed">Live Stream / Embed</option>
                    <option value="youtube">YouTube Live</option>
                    <option value="video">MP4 / WebM Video</option>
                    <option value="image">Image / Banner</option>
                    <option value="news_feed">Live News TV</option>
                  </select>

                  <button
                    type="button"
                    disabled={isSaving || !slot.url.trim()}
                    onClick={() => handleToggleToSlot(idx)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 disabled:opacity-35 ${
                      isCurrentlyPlaying
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                    title={`Broadcast Screen ko URL ${idx + 1} par switch karein`}
                  >
                    <Play className="w-3 h-3" />
                    <span>{isCurrentlyPlaying ? 'Active' : 'Play'}</span>
                  </button>

                  {slot.url.trim() && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleClearSlot(idx)}
                      aria-label={`Clear URL ${idx + 1}`}
                      className="p-1 rounded-lg bg-slate-900 hover:bg-rose-950/70 border border-slate-700 text-slate-400 hover:text-rose-300"
                      title="Clear slot"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-8">
                  <label
                    htmlFor={`tv_slot_name_${idx}`}
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1"
                  >
                    Stream Name / Label
                  </label>
                  <input
                    id={`tv_slot_name_${idx}`}
                    type="text"
                    maxLength={120}
                    value={slot.title}
                    onChange={(e) => updateSlot(idx, { title: e.target.value })}
                    placeholder={
                      idx === 0
                        ? 'e.g. Main Feed'
                        : idx === 1
                        ? 'e.g. Sky Sports'
                        : idx === 2
                        ? 'e.g. Willow'
                        : 'e.g. Backup Feed'
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="col-span-4">
                  <label
                    htmlFor={`tv_slot_sec_${idx}`}
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1"
                  >
                    Switch (Sec)
                  </label>
                  <input
                    id={`tv_slot_sec_${idx}`}
                    type="number"
                    min={3}
                    max={600}
                    value={slot.durationSec}
                    onChange={(e) =>
                      updateSlot(idx, { durationSec: Number(e.target.value) })
                    }
                    aria-label={`URL ${idx + 1} duration seconds`}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white text-center focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor={`tv_slot_url_${idx}`}
                  className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1"
                >
                  Playback URL {idx + 1}
                </label>
                <input
                  id={`tv_slot_url_${idx}`}
                  type="text"
                  value={slot.url}
                  onChange={(e) => updateSlot(idx, { url: e.target.value })}
                  placeholder={`Paste Playback URL ${idx + 1} (YouTube Live, Embed Stream, Video, Image, ya /?view=news-tv)`}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          );
        })}
      </div>

      {slotError && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/60 text-xs font-semibold text-rose-200 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{slotError}</span>
        </div>
      )}

      {/* Save / Auto-Rotate Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
        <span className="text-[11px] text-slate-400">
          {liveMatchActive
            ? 'Live Match active hai — kisi bhi URL par click karne se BroadcastView turant switch ho jayega.'
            : 'Standby par ye 4 URLs save karke upar Toggle bar se switch kar sakte hain.'}
        </span>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveSlots(false)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5 text-sky-400" />
            <span>Save URLs (1–4)</span>
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveSlots(true)}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black flex items-center gap-1.5 shadow disabled:opacity-40"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save & Auto-switch (5m)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
