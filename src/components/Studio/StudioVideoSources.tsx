import React, { useMemo, useState } from 'react';
import {
  TvPlaylistItem,
  TvPlaylistMediaType,
  TvScreenConfig,
  VideoSourceCategory,
  VideoSourceConfig,
  VideoSourceType
} from '../../types/cricket';
import { useContent } from '../../context/ContentContext';
import {
  deleteVideoSourceFromFirestore,
  deleteVideoSourcesBatchFromFirestore,
  saveVideoSourcesBatchToFirestore,
  saveVideoSourceToFirestore,
  uploadTvVideoAsset
} from '../../services/firebaseContentService';
import {
  HoldYouTubePlayer
} from '../Common/HoldYouTubePlayer';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { VideoSourceThumbnail } from './VideoSourceThumbnail';
import { BatchVideoSourcesPanel } from './BatchVideoSourcesPanel';
import { buildApiUrl } from '../../services/api';
import {
  normalizeUrlForComparison,
  validateVideoSourceInput,
  VIDEO_SOURCE_CATEGORIES
} from '../../utils/videoSourceParser';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Edit3,
  ExternalLink,
  Eye,
  Film,
  Globe,
  HardDrive,
  Layers,
  Link2,
  Play,
  Plus,
  Radio,
  Save,
  Search,
  Trash2,
  Tv,
  Upload,
  X,
  Youtube
} from 'lucide-react';

interface StudioVideoSourcesProps {
  adminPin: string;
  isAuthorized: boolean;
  tvScreen: TvScreenConfig;
  liveMatchActive?: boolean;
  compact?: boolean;
  onUpdateTvScreen: (patch: Partial<TvScreenConfig>, successText: string) => Promise<void>;
  onStatusMessage?: (msg: { text: string; type: 'success' | 'error' }) => void;
  onOpenFullTab?: () => void;
}

export { validateVideoSourceInput };

const CATEGORIES: VideoSourceCategory[] = VIDEO_SOURCE_CATEGORIES;

function mapSourceTypeToTvMediaType(sourceType: VideoSourceType): TvPlaylistMediaType {
  if (sourceType === 'youtube') return 'youtube';
  if (sourceType === 'local_video') return 'video';
  return 'embed';
}

export const StudioVideoSources: React.FC<StudioVideoSourcesProps> = ({
  adminPin,
  isAuthorized,
  tvScreen,
  liveMatchActive = false,
  compact = false,
  onUpdateTvScreen,
  onStatusMessage,
  onOpenFullTab
}) => {
  const {
    videoSources,
    isFirebaseAdmin,
    upsertBackupVideoSource,
    upsertBackupVideoSourcesBatch,
    removeBackupVideoSource,
    removeBackupVideoSourcesBatch
  } = useContent();

  // Form & Batch Import state
  const [showAddForm, setShowAddForm] = useState(!compact);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<VideoSourceType>('youtube');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<VideoSourceCategory>('Main Feed');
  const [notes, setNotes] = useState('');
  const [durationSec, setDurationSec] = useState<number>(300);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSwitchingId, setIsSwitchingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filter / preview / delete / batch selection
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | VideoSourceType>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VideoSourceConfig | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [batchDeleteTargets, setBatchDeleteTargets] = useState<VideoSourceConfig[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const playlist = tvScreen.playlist || [];

  const activeLiveUrlKey = useMemo(() => {
    if (!tvScreen.enabled || tvScreen.playbackStopped || playlist.length === 0) return '';
    const activeItem =
      (tvScreen.playNowItemId
        ? playlist.find((item) => item.id === tvScreen.playNowItemId)
        : null) || playlist[0];
    return activeItem ? normalizeUrlForComparison(activeItem.url) : '';
  }, [tvScreen.enabled, tvScreen.playbackStopped, tvScreen.playNowItemId, playlist]);

  const filteredSources = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return videoSources.filter((src) => {
      if (typeFilter !== 'all' && src.sourceType !== typeFilter) return false;
      if (!q) return true;
      return (
        src.name.toLowerCase().includes(q) ||
        src.url.toLowerCase().includes(q) ||
        (src.category || '').toLowerCase().includes(q) ||
        (src.notes || '').toLowerCase().includes(q)
      );
    });
  }, [videoSources, searchQuery, typeFilter]);

  const formValidationPreview = useMemo(() => {
    if (!url.trim()) return null;
    const res = validateVideoSourceInput(url, sourceType);
    return res.ok ? res : null;
  }, [url, sourceType]);

  if (!isAuthorized) return null;

  const notify = (text: string, type: 'success' | 'error') => {
    setFeedback({ text, type });
    onStatusMessage?.({ text, type });
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setSourceType('youtube');
    setUrl('');
    setCategory('Main Feed');
    setNotes('');
    setDurationSec(300);
  };

  const handleEdit = (src: VideoSourceConfig) => {
    setShowAddForm(true);
    setEditingId(src.id);
    setName(src.name);
    setSourceType(src.sourceType);
    setUrl(src.url);
    setCategory(
      (CATEGORIES.includes(src.category as VideoSourceCategory)
        ? src.category
        : 'Main Feed') as VideoSourceCategory
    );
    setNotes(src.notes || '');
    setDurationSec(src.durationSec || 300);
    setFeedback(null);
  };

  const handleUploadLocalVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setFeedback(null);
    setIsUploading(true);
    try {
      const res = await uploadTvVideoAsset(file, file.name, adminPin, 'tv_ads');
      setSourceType('local_video');
      setUrl(res.url);
      setCategory('Local Stream');
      if (!name.trim()) {
        setName(file.name.replace(/\.[^.]+$/, '').slice(0, 120));
      }
      notify(
        `${res.storedInFirebase ? 'Firebase Storage' : 'Local Server'} par upload ho gayi — ab Save Source ya Save & Go Live dabayein!`,
        'success'
      );
    } catch (err: any) {
      notify(err?.message || 'Video upload fail ho gaya.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const buildSourceFromForm = (): VideoSourceConfig | null => {
    const cleanName = name.trim().slice(0, 120);
    if (!cleanName) {
      notify('Feed / Video Source ka naam likhna zaroori hai (e.g. Main Feed, Willow, Local Stream).', 'error');
      return null;
    }

    const validated = validateVideoSourceInput(url, sourceType);
    if (!validated.ok) {
      notify(validated.error, 'error');
      return null;
    }

    const existing = editingId ? videoSources.find((s) => s.id === editingId) : undefined;
    const id =
      editingId || `src_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    return {
      id,
      name: cleanName,
      sourceType: validated.sourceType,
      url: validated.url,
      category,
      notes: notes.trim().slice(0, 300),
      durationSec: Math.max(3, Math.min(600, Math.round(Number(durationSec) || 300))),
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    };
  };

  const switchToVideoSource = async (src: VideoSourceConfig, targetSlotIndex?: number) => {
    setIsSwitchingId(src.id);
    setFeedback(null);
    try {
      const tvItem: TvPlaylistItem = {
        id: `tv_src_${src.id}`.slice(0, 120),
        mediaType: mapSourceTypeToTvMediaType(src.sourceType),
        url: src.url,
        title: src.name.slice(0, 120),
        durationSec: Math.max(3, Math.min(600, Number(src.durationSec) || 300))
      };

      const nextPlaylist: TvPlaylistItem[] = [...playlist];

      if (typeof targetSlotIndex === 'number' && targetSlotIndex >= 0 && targetSlotIndex < 4) {
        // Ensure earlier slots are not overwritten; replace or place cleanly into slot index
        const duplicateIdx = nextPlaylist.findIndex(
          (it, idx) => idx !== targetSlotIndex && normalizeUrlForComparison(it.url) === normalizeUrlForComparison(src.url)
        );
        if (duplicateIdx >= 0) {
          nextPlaylist.splice(duplicateIdx, 1);
        }
        const boundedIdx = Math.min(targetSlotIndex, nextPlaylist.length);
        if (boundedIdx < nextPlaylist.length) {
          nextPlaylist[boundedIdx] = tvItem;
        } else {
          nextPlaylist.push(tvItem);
        }
      } else {
        const existingIdx = nextPlaylist.findIndex(
          (it) =>
            it.id === tvItem.id ||
            normalizeUrlForComparison(it.url) === normalizeUrlForComparison(src.url)
        );
        if (existingIdx >= 0) {
          nextPlaylist[existingIdx] = {
            ...nextPlaylist[existingIdx],
            ...tvItem,
            id: nextPlaylist[existingIdx].id
          };
          tvItem.id = nextPlaylist[existingIdx].id;
        } else if (nextPlaylist.length < 4) {
          nextPlaylist.unshift(tvItem);
        } else {
          // Put active feed in Slot 1 while retaining Slots 2–4 and keeping playlist <= 20
          nextPlaylist.splice(0, 1, tvItem);
        }
      }

      const finalPlaylist = nextPlaylist.slice(0, 20);
      const slotLabel =
        typeof targetSlotIndex === 'number' ? ` (Slot ${targetSlotIndex + 1})` : '';
      const msg = `"${src.name}"${slotLabel} ab Broadcast TV screen par LIVE chal rahi hai!`;

      await onUpdateTvScreen(
        {
          enabled: true,
          playbackStopped: false,
          playlist: finalPlaylist,
          playNowItemId: tvItem.id,
          playNowNonce: Date.now()
        },
        msg
      );
      notify(msg, 'success');
    } catch (err: any) {
      notify(err?.message || 'Match feed switch karne mein error aaya.', 'error');
    } finally {
      setIsSwitchingId(null);
    }
  };

  const handleSaveSource = async (goLiveAfterSave = false) => {
    if (isSaving || isUploading) return;
    const src = buildSourceFromForm();
    if (!src) return;

    const isNew = !editingId || !videoSources.some((s) => s.id === editingId);
    setIsSaving(true);
    setFeedback(null);

    try {
      upsertBackupVideoSource(src);
      if (isFirebaseAdmin) {
        await saveVideoSourceToFirestore(src, isNew);
      }

      if (goLiveAfterSave) {
        await switchToVideoSource(src);
      } else {
        notify(
          isFirebaseAdmin
            ? isNew
              ? `"${src.name}" Video Sources mein save ho gaya!`
              : `"${src.name}" Video Source update ho gaya!`
            : `"${src.name}" local backup mein save ho gaya. Cloud sync ke liye Google Admin Sign-In karein.`,
          'success'
        );
      }

      resetForm();
      if (compact) setShowAddForm(false);
    } catch (err: any) {
      notify(err?.message || 'Video Source save karne mein masla aaya.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (batchDeleteTargets && batchDeleteTargets.length > 0) {
      const idsToDelete = batchDeleteTargets.map((s) => s.id);
      const idSet = new Set(idsToDelete);
      setIsDeleting(true);
      try {
        removeBackupVideoSourcesBatch(idsToDelete);
        if (isFirebaseAdmin) {
          await deleteVideoSourcesBatchFromFirestore(idsToDelete);
        }
        if (editingId && idSet.has(editingId)) resetForm();
        if (previewId && idSet.has(previewId)) setPreviewId(null);
        setSelectedSourceIds((prev) => prev.filter((id) => !idSet.has(id)));
        notify(
          `${idsToDelete.length} selected video ${
            idsToDelete.length === 1 ? 'source' : 'sources'
          } permanently deleted.`,
          'success'
        );
      } catch (err: any) {
        notify(err?.message || 'Batch delete karne mein error aaya.', 'error');
      } finally {
        setIsDeleting(false);
        setBatchDeleteTargets(null);
      }
      return;
    }

    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      removeBackupVideoSource(deleteTarget.id);
      if (isFirebaseAdmin) {
        await deleteVideoSourceFromFirestore(deleteTarget.id);
      }
      if (editingId === deleteTarget.id) resetForm();
      if (previewId === deleteTarget.id) setPreviewId(null);
      setSelectedSourceIds((prev) => prev.filter((id) => id !== deleteTarget.id));
      notify(`"${deleteTarget.name}" Video Sources se delete ho gaya.`, 'success');
    } catch (err: any) {
      notify(err?.message || 'Delete karne mein error aaya.', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleBatchImportSources = async (
    importedSources: VideoSourceConfig[],
    options: { queueIntoLivePlaylist: boolean }
  ) => {
    if (importedSources.length === 0 || isBatchImporting) return;
    setIsBatchImporting(true);
    setFeedback(null);

    try {
      upsertBackupVideoSourcesBatch(importedSources);
      if (isFirebaseAdmin) {
        await saveVideoSourcesBatchToFirestore(importedSources);
      }

      let playlistMessage = '';
      if (options.queueIntoLivePlaylist) {
        const existingKeys = new Set(playlist.map((it) => normalizeUrlForComparison(it.url)));
        const additions: TvPlaylistItem[] = [];
        for (const src of importedSources) {
          const key = normalizeUrlForComparison(src.url);
          if (key && existingKeys.has(key)) continue;
          if (key) existingKeys.add(key);
          additions.push({
            id: `tv_src_${src.id}`.slice(0, 120),
            mediaType: mapSourceTypeToTvMediaType(src.sourceType),
            url: src.url,
            title: src.name.slice(0, 120),
            durationSec: Math.max(3, Math.min(600, Number(src.durationSec) || 300))
          });
        }
        const mergedPlaylist = [...playlist, ...additions].slice(0, 20);
        if (additions.length > 0) {
          await onUpdateTvScreen(
            { playlist: mergedPlaylist },
            `${additions.length} imported feeds Live TV Playlist mein queue ho gaye.`
          );
          playlistMessage = ` (${Math.min(additions.length, Math.max(0, 20 - playlist.length))} Live TV Playlist mein queue kiye gaye).`;
        }
      }

      notify(
        isFirebaseAdmin
          ? `${importedSources.length} Video Sources batch import aur Cloud sync ho gaye${playlistMessage || '!'}`
          : `${importedSources.length} Video Sources local backup mein batch import ho gaye${playlistMessage || '.'}`,
        'success'
      );
      setShowBatchImport(false);
    } catch (err: any) {
      notify(err?.message || 'Batch import karne mein error aaya.', 'error');
    } finally {
      setIsBatchImporting(false);
    }
  };

  const renderSourceBadge = (type: VideoSourceType) => {
    if (type === 'youtube') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/35 text-[10px] font-black uppercase">
          <Youtube className="w-3 h-3" />
          <span>YouTube</span>
        </span>
      );
    }
    if (type === 'local_video') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 text-[10px] font-black uppercase">
          <Film className="w-3 h-3" />
          <span>Local Video</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/35 text-[10px] font-black uppercase">
        <Globe className="w-3 h-3" />
        <span>Stream / Embed</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-emerald-500/35 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Radio className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                Video Sources (Saved Match Feeds)
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-black text-emerald-300 uppercase">
                {videoSources.length} Saved
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  isFirebaseAdmin
                    ? 'bg-sky-500/15 border-sky-400/40 text-sky-300'
                    : 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                }`}
              >
                {isFirebaseAdmin ? (
                  <>
                    <Cloud className="w-3 h-3" />
                    <span>Cloud Synced</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="w-3 h-3" />
                    <span>Local Backup</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Apne YouTube, Local Video (.mp4), ya Local/External Stream URLs save karein aur 1 click mein match feed switch karein.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setShowBatchImport((v) => !v);
                setFeedback(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-colors ${
                showBatchImport
                  ? 'bg-sky-600 text-white border-sky-400 shadow'
                  : 'bg-slate-950 hover:bg-slate-800 border-sky-500/50 text-sky-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showBatchImport ? 'Close Batch Import' : 'Batch Import (.txt)'}</span>
            </button>

            {compact && (
              <button
                type="button"
                onClick={() => {
                  setShowAddForm((v) => !v);
                  if (showAddForm && editingId) resetForm();
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow"
              >
                {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{showAddForm ? 'Close Form' : 'Add Video Source'}</span>
              </button>
            )}
            {onOpenFullTab && (
              <button
                type="button"
                onClick={onOpenFullTab}
                className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-emerald-300 flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Manage All Sources</span>
              </button>
            )}
          </div>
        </div>

        {/* Batch Upload / Bulk Add Schedule Panel */}
        {showBatchImport && (
          <BatchVideoSourcesPanel
            existingSources={videoSources}
            isImporting={isBatchImporting}
            onImportSources={handleBatchImportSources}
            onClose={() => setShowBatchImport(false)}
          />
        )}

        {/* Add / Edit Video Source Form */}
        {showAddForm && (
          <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                <span>{editingId ? 'Edit Video Source' : 'New Video Source Configuration'}</span>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    if (compact) setShowAddForm(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 border border-slate-700"
                >
                  <X className="w-3 h-3" />
                  <span>Cancel Edit</span>
                </button>
              )}
            </div>

            {/* Source Type Selector */}
            <div className="flex flex-wrap gap-2">
              {[
                {
                  id: 'youtube' as VideoSourceType,
                  label: 'YouTube Live / Video',
                  icon: Youtube,
                  activeClass: 'bg-rose-600 text-white border-rose-400'
                },
                {
                  id: 'embed' as VideoSourceType,
                  label: 'Local / Embed Stream URL',
                  icon: Globe,
                  activeClass: 'bg-cyan-600 text-white border-cyan-400'
                },
                {
                  id: 'local_video' as VideoSourceType,
                  label: 'Local Video / MP4 Upload',
                  icon: Film,
                  activeClass: 'bg-indigo-600 text-white border-indigo-400'
                }
              ].map((opt) => {
                const Icon = opt.icon;
                const active = sourceType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSourceType(opt.id);
                      setFeedback(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                      active
                        ? `${opt.activeClass} shadow`
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Feed Name *
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. PAK vs SL Main YouTube / Local OBS"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as VideoSourceCategory)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Switch (Sec)
                </label>
                <input
                  type="number"
                  min={3}
                  max={600}
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-white text-center focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="1080p primary, backup feed..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {sourceType === 'local_video' && (
                <div className="md:col-span-3">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Upload Local Video
                  </label>
                  <label
                    className={`w-full px-3 py-2 rounded-xl border border-dashed text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      isUploading
                        ? 'bg-slate-800 border-slate-600 text-slate-400 cursor-wait'
                        : 'bg-slate-900 hover:bg-slate-800 border-indigo-500/60 text-indigo-300'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploading ? 'Uploading...' : 'Choose MP4/WebM'}</span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*,.mp4,.webm,.mov,.m4v,.mkv"
                      disabled={isUploading || isSaving}
                      onChange={handleUploadLocalVideo}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              <div className={sourceType === 'local_video' ? 'md:col-span-5' : 'md:col-span-8'}>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  {sourceType === 'youtube'
                    ? 'YouTube Watch / Live / Share URL *'
                    : sourceType === 'local_video'
                    ? 'Local Video Path or MP4 URL *'
                    : 'Local / External Stream Player URL *'}
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setUrl(nextVal);
                    if (
                      /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(nextVal) &&
                      sourceType !== 'youtube'
                    ) {
                      setSourceType('youtube');
                    }
                    if (feedback?.type === 'error') setFeedback(null);
                  }}
                  placeholder={
                    sourceType === 'youtube'
                      ? 'https://www.youtube.com/watch?v=... ya https://youtu.be/...'
                      : sourceType === 'local_video'
                      ? '/api/media/match.mp4 ya http://localhost:3000/video.mp4'
                      : 'http://localhost:8080/live.html ya https://stream-player-url'
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="button"
                  disabled={isSaving || isUploading}
                  onClick={() => handleSaveSource(false)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Save className="w-3.5 h-3.5 text-sky-400" />
                  <span>{isSaving ? 'Saving...' : editingId ? 'Update' : 'Save Source'}</span>
                </button>
              </div>

              <div className="md:col-span-2">
                <button
                  type="button"
                  disabled={isSaving || isUploading}
                  onClick={() => handleSaveSource(true)}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow disabled:opacity-40"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Save &amp; Go Live</span>
                </button>
              </div>
            </div>

            {formValidationPreview && (
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-2.5 flex items-center justify-between gap-3 text-[11px] text-slate-300">
                <div className="flex items-center gap-2.5 min-w-0">
                  <VideoSourceThumbnail
                    name={name.trim() || 'New Stream'}
                    url={formValidationPreview.url}
                    sourceType={formValidationPreview.sourceType}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Thumbnail Preview ({formValidationPreview.sourceType})
                    </div>
                    <code className="text-emerald-300 font-mono block truncate">
                      {formValidationPreview.url}
                    </code>
                  </div>
                </div>
                <span className="text-emerald-400 font-bold shrink-0 whitespace-nowrap">Valid URL</span>
              </div>
            )}
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            role="alert"
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              feedback.type === 'error'
                ? 'bg-rose-950/60 border-rose-500/60 text-rose-200'
                : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
            }`}
          >
            {feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Filter & Search Bar */}
        {videoSources.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved feeds..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all' as const, label: 'All' },
                { id: 'youtube' as const, label: 'YouTube' },
                { id: 'embed' as const, label: 'Stream / Embed' },
                { id: 'local_video' as const, label: 'Local Video' }
              ].map((flt) => (
                <button
                  key={flt.id}
                  type="button"
                  onClick={() => setTypeFilter(flt.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                    typeFilter === flt.id
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {flt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Batch Select & Delete Action Bar */}
        {videoSources.length > 0 && (() => {
          const selectedSet = new Set(selectedSourceIds);
          const selectedSources = videoSources.filter((s) => selectedSet.has(s.id));
          const allFilteredSelected =
            filteredSources.length > 0 && filteredSources.every((s) => selectedSet.has(s.id));

          return (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950/80 border border-slate-800 px-3.5 py-2">
              <div className="flex items-center gap-2.5">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    disabled={filteredSources.length === 0 || isDeleting}
                    onChange={() => {
                      const filteredIds = filteredSources.map((s) => s.id);
                      const filteredSet = new Set(filteredIds);
                      if (allFilteredSelected) {
                        setSelectedSourceIds((prev) => prev.filter((id) => !filteredSet.has(id)));
                      } else {
                        setSelectedSourceIds((prev) =>
                          Array.from(new Set([...prev, ...filteredIds]))
                        );
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-rose-500 focus:ring-0"
                  />
                  <span>
                    {allFilteredSelected
                      ? `Deselect All (${filteredSources.length})`
                      : `Select All (${filteredSources.length})`}
                  </span>
                </label>

                {selectedSources.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/40 text-[11px] font-black text-rose-200 tabular-nums">
                    {selectedSources.length} Selected
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedSources.length > 0 && (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setSelectedSourceIds([])}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300"
                  >
                    Clear Selection
                  </button>
                )}
                <button
                  type="button"
                  disabled={selectedSources.length === 0 || isDeleting}
                  onClick={() => setBatchDeleteTargets(selectedSources)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    Delete Selected
                    {selectedSources.length > 0 ? ` (${selectedSources.length})` : ''}
                  </span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Saved Video Sources Grid */}
        {filteredSources.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-950 border border-dashed border-slate-800 text-xs text-slate-400 space-y-1.5">
            <p className="font-bold text-slate-300">
              {videoSources.length === 0
                ? 'Abhi koi Video Source save nahi hai.'
                : 'Search / filter se koi Video Source match nahi hua.'}
            </p>
            <p>
              {compact && !showAddForm
                ? '"Add Video Source" par click karke YouTube ya Local Stream URL configurations save karein.'
                : 'Upar form mein YouTube ya Local Stream URL save karein taake match ke dauran 1 click mein switch kar sakein.'}
            </p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${compact ? 'lg:grid-cols-2' : 'xl:grid-cols-2'} gap-3`}>
            {filteredSources.map((src) => {
              const isOnAir =
                Boolean(activeLiveUrlKey) &&
                normalizeUrlForComparison(src.url) === activeLiveUrlKey;
              const isPreviewOpen = previewId === src.id;
              const isSelected = selectedSourceIds.includes(src.id);
              const slotIdx = playlist.findIndex(
                (p, idx) => idx < 4 && normalizeUrlForComparison(p.url) === normalizeUrlForComparison(src.url)
              );

              return (
                <div
                  key={src.id}
                  className={`rounded-xl border p-3.5 space-y-2.5 transition-colors ${
                    isSelected
                      ? 'bg-rose-950/20 border-rose-500/70 ring-1 ring-rose-500/35'
                      : isOnAir
                      ? 'bg-emerald-950/30 border-emerald-400/70'
                      : editingId === src.id
                      ? 'bg-sky-950/30 border-sky-500/60'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDeleting}
                      onChange={() =>
                        setSelectedSourceIds((prev) =>
                          prev.includes(src.id)
                            ? prev.filter((id) => id !== src.id)
                            : [...prev, src.id]
                        )
                      }
                      aria-label={`Select ${src.name} for batch delete`}
                      className="w-4 h-4 mt-1 rounded border-slate-600 bg-slate-900 text-rose-500 focus:ring-0 shrink-0 cursor-pointer"
                    />
                    <VideoSourceThumbnail
                      name={src.name}
                      url={src.url}
                      sourceType={src.sourceType}
                      durationSec={src.durationSec}
                      isOnAir={isOnAir}
                      isPreviewOpen={isPreviewOpen}
                      onTogglePreview={() => setPreviewId(isPreviewOpen ? null : src.id)}
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {renderSourceBadge(src.sourceType)}
                        {src.category && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                            {src.category}
                          </span>
                        )}
                        {slotIdx >= 0 && (
                          <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 text-[10px] font-black">
                            Slot {slotIdx + 1}
                          </span>
                        )}
                        {isOnAir && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/60 text-emerald-200 text-[10px] font-black uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>ON AIR</span>
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-white truncate">{src.name}</h4>
                      {src.notes && (
                        <p className="text-[11px] text-slate-400 line-clamp-1">{src.notes}</p>
                      )}
                      <p className="text-[11px] font-mono text-slate-500 truncate">{src.url}</p>
                    </div>
                  </div>

                  {/* Preview */}
                  {isPreviewOpen && (
                    <div className="rounded-xl overflow-hidden bg-black aspect-video border border-slate-800">
                      {src.sourceType === 'youtube' ? (
                        <HoldYouTubePlayer
                          videoUrls={[src.url]}
                          loop={false}
                          fillContainer
                          autoAdvanceOnEnd={false}
                          onFallback={() => {}}
                        />
                      ) : src.sourceType === 'local_video' ? (
                        <video
                          src={src.url.startsWith('/') ? buildApiUrl(src.url) : src.url}
                          controls
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <iframe
                          src={src.url}
                          title={src.name}
                          className="w-full h-full border-0 bg-black"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                        />
                      )}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isSwitchingId === src.id}
                        onClick={() => switchToVideoSource(src)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 disabled:opacity-40 ${
                          isOnAir
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        <Tv className="w-3.5 h-3.5" />
                        <span>
                          {isSwitchingId === src.id
                            ? 'Switching...'
                            : isOnAir
                            ? 'Playing Live'
                            : liveMatchActive
                            ? 'Switch Feed'
                            : 'Play Live'}
                        </span>
                      </button>

                      {/* Quick Assign to Playback Slots 1–4 */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-0.5">
                        <span className="text-[10px] font-bold text-slate-400 px-1">Slot:</span>
                        {[0, 1, 2, 3].map((sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            disabled={isSwitchingId === src.id}
                            onClick={() => switchToVideoSource(src, sIdx)}
                            title={`Assign "${src.name}" to Playback URL ${sIdx + 1} & Play`}
                            className={`w-5 h-5 rounded text-[10px] font-black transition-colors ${
                              slotIdx === sIdx
                                ? 'bg-cyan-500 text-slate-950'
                                : 'bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white'
                            }`}
                          >
                            {sIdx + 1}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewId(isPreviewOpen ? null : src.id)}
                        className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 ${
                          isPreviewOpen
                            ? 'bg-indigo-600 border-indigo-400 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>{isPreviewOpen ? 'Hide' : 'Preview'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEdit(src)}
                        aria-label={`Edit ${src.name}`}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(src)}
                        aria-label={`Delete ${src.name}`}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget || (batchDeleteTargets && batchDeleteTargets.length > 0))}
        title={
          batchDeleteTargets && batchDeleteTargets.length > 0
            ? `Delete ${batchDeleteTargets.length} Selected Video ${
                batchDeleteTargets.length === 1 ? 'Source' : 'Sources'
              }?`
            : 'Video Source Delete Karein?'
        }
        itemName={deleteTarget?.name}
        itemNames={batchDeleteTargets?.map((s) => s.name)}
        isDeleting={isDeleting}
        onCancel={() => {
          if (isDeleting) return;
          setDeleteTarget(null);
          setBatchDeleteTargets(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
