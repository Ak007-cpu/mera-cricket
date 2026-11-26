import React, { useMemo, useState } from 'react';
import {
  MediaLibraryCategory,
  MediaLibraryItem,
  MediaLibraryMediaType,
  MediaLibrarySource,
  TvPlaylistItem,
  TvScreenConfig
} from '../../types/cricket';
import { useContent } from '../../context/ContentContext';
import {
  deleteMediaLibraryItemFromFirestore,
  saveMediaLibraryItemToFirestore,
  uploadTvVideoAsset
} from '../../services/firebaseContentService';
import { extractYouTubeVideoId, HoldYouTubePlayer } from '../Common/HoldYouTubePlayer';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  Cloud,
  Edit3,
  Eye,
  Film,
  HardDrive,
  Link2,
  ListPlus,
  Play,
  Save,
  Search,
  Trash2,
  Tv,
  Upload,
  X,
  Youtube
} from 'lucide-react';

interface StudioMediaLibraryProps {
  adminPin: string;
  isAuthorized: boolean;
  tvScreen: TvScreenConfig;
  liveMatchActive?: boolean;
  onUpdateTvScreen: (patch: Partial<TvScreenConfig>, successText: string) => Promise<void>;
  onStatusMessage?: (msg: { text: string; type: 'success' | 'error' }) => void;
}

const CATEGORIES: MediaLibraryCategory[] = ['Standby', 'Promo', 'Highlight', 'Sponsor', 'General'];

function probeVideoDurationSec(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const vid = document.createElement('video');
    let settled = false;

    const finish = (val: number | null) => {
      if (settled) return;
      settled = true;
      vid.removeAttribute('src');
      vid.load();
      URL.revokeObjectURL(objectUrl);
      resolve(val);
    };

    const timer = setTimeout(() => finish(null), 4000);
    vid.preload = 'metadata';
    vid.muted = true;
    vid.onloadedmetadata = () => {
      clearTimeout(timer);
      const d = Number(vid.duration);
      if (Number.isFinite(d) && d > 0) {
        finish(Math.max(3, Math.min(600, Math.round(d))));
      } else {
        finish(null);
      }
    };
    vid.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    vid.src = objectUrl;
  });
}

function validateVideoLibraryUrl(
  rawUrl: string
): { ok: true; mediaType: MediaLibraryMediaType; url: string } | { ok: false; error: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: 'Pehle video file upload karein ya Video / YouTube URL paste karein.' };
  }
  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
    return {
      ok: false,
      error: 'Base64 data URLs aur unsafe scripts allowed nahi hain. Video upload karein ya https:// URL dalein.'
    };
  }
  if (/\s/.test(trimmed)) {
    return { ok: false, error: 'URL mein spaces allowed nahi hain. Sahih link dalein.' };
  }

  if (/(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(trimmed) || /^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    const videoId = extractYouTubeVideoId(trimmed);
    if (!videoId) {
      return {
        ok: false,
        error: 'Galat YouTube link! Sahih format dalein: youtube.com/watch?v=..., youtu.be/... ya /shorts/...'
      };
    }
    const normalized = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : /^[a-zA-Z0-9_-]{11}$/.test(trimmed)
      ? `https://www.youtube.com/watch?v=${videoId}`
      : `https://${trimmed}`;
    return {
      ok: true,
      mediaType: 'youtube',
      url: normalized.slice(0, 2000)
    };
  }

  if (trimmed.startsWith('/')) {
    if (trimmed.length < 2) {
      return { ok: false, error: 'Galat relative path. Sahih path ya https:// URL dalein.' };
    }
    return {
      ok: true,
      mediaType: 'video',
      url: trimmed.slice(0, 2000)
    };
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    const hasDotOrLocal = parsed.hostname.includes('.') || parsed.hostname === 'localhost';
    if (!hasDotOrLocal) {
      return {
        ok: false,
        error: 'Galat URL! Poora link dalein (maslan https://example.com/standby-clip.mp4).'
      };
    }
    return {
      ok: true,
      mediaType: 'video',
      url: parsed.toString().slice(0, 2000)
    };
  } catch {
    return {
      ok: false,
      error: 'Galat URL format! Sahih https:// video link dalein ya file upload karein.'
    };
  }
}

export const StudioMediaLibrary: React.FC<StudioMediaLibraryProps> = ({
  adminPin,
  isAuthorized,
  tvScreen,
  liveMatchActive = false,
  onUpdateTvScreen,
  onStatusMessage
}) => {
  const { mediaLibrary, isFirebaseAdmin, upsertBackupMediaItem, removeBackupMediaItem } = useContent();

  // Add / Edit form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [durationSec, setDurationSec] = useState<number>(15);
  const [category, setCategory] = useState<MediaLibraryCategory>('Standby');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<MediaLibrarySource>('upload');
  const [storedInFirebase, setStoredInFirebase] = useState<boolean>(false);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingStandby, setIsUpdatingStandby] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filter / preview / delete state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | MediaLibraryCategory>('All');
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaLibraryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isAuthorized) return null;

  const standbyPlaylist = tvScreen.playlist || [];

  const notify = (text: string, type: 'success' | 'error') => {
    setFeedback({ text, type });
    onStatusMessage?.({ text, type });
  };

  const resetForm = () => {
    setEditingId(null);
    setInputMode('upload');
    setTitle('');
    setUrl('');
    setDurationSec(15);
    setCategory('Standby');
    setDescription('');
    setSource('upload');
    setStoredInFirebase(false);
  };

  const handleEdit = (item: MediaLibraryItem) => {
    setEditingId(item.id);
    setInputMode(item.source === 'upload' ? 'upload' : 'url');
    setTitle(item.title);
    setUrl(item.url);
    setDurationSec(item.durationSec || 15);
    setCategory(
      (CATEGORIES.includes(item.category as MediaLibraryCategory)
        ? item.category
        : 'General') as MediaLibraryCategory
    );
    setDescription(item.description || '');
    setSource(item.source || 'url');
    setStoredInFirebase(Boolean(item.storedInFirebase));
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 60 * 1024 * 1024) {
      notify('Video file 60MB se chhoti honi chahiye.', 'error');
      return;
    }

    setFeedback(null);
    setIsUploading(true);
    try {
      const [probedDur, res] = await Promise.all([
        probeVideoDurationSec(file),
        uploadTvVideoAsset(file, file.name, adminPin, 'media_library')
      ]);

      setUrl(res.url);
      setSource('upload');
      setStoredInFirebase(Boolean(res.storedInFirebase));
      if (probedDur) {
        setDurationSec(probedDur);
      }
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 120));
      }

      notify(
        `${res.storedInFirebase ? 'Video Firebase Storage mein' : 'Video server par'} upload ho gayi${
          probedDur ? ` (${probedDur}s)` : ''
        } — ab "Save to Media Library" dabayein!`,
        'success'
      );
    } catch (err: any) {
      notify(err?.message || 'Video upload fail ho gaya.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const buildItemFromForm = (): MediaLibraryItem | null => {
    const cleanTitle = title.trim().slice(0, 120);
    if (!cleanTitle) {
      notify('Video ka Title likhna zaroori hai.', 'error');
      return null;
    }

    const validated = validateVideoLibraryUrl(url);
    if (!validated.ok) {
      notify(validated.error, 'error');
      return null;
    }

    const existing = editingId ? mediaLibrary.find((m) => m.id === editingId) : undefined;
    const itemId = editingId || `media_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    return {
      id: itemId,
      title: cleanTitle,
      mediaType: validated.mediaType,
      url: validated.url,
      durationSec: Math.max(3, Math.min(600, Math.round(Number(durationSec) || 15))),
      source: validated.mediaType === 'youtube' ? 'url' : source,
      category,
      description: description.trim().slice(0, 300),
      storedInFirebase: Boolean(storedInFirebase),
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    };
  };

  const persistLibraryItem = async (item: MediaLibraryItem, isNew: boolean) => {
    upsertBackupMediaItem(item);
    if (isFirebaseAdmin) {
      await saveMediaLibraryItemToFirestore(item, isNew);
    }
  };

  const handleSave = async (playImmediatelyOnStandby = false) => {
    if (isSaving || isUploading) return;
    const item = buildItemFromForm();
    if (!item) return;

    const isNew = !editingId || !mediaLibrary.some((m) => m.id === editingId);
    setIsSaving(true);
    setFeedback(null);

    try {
      await persistLibraryItem(item, isNew);

      if (playImmediatelyOnStandby) {
        await activateItemOnStandby(item, true);
      } else {
        notify(
          isFirebaseAdmin
            ? isNew
              ? `"${item.title}" Firebase Media Library mein save ho gayi!`
              : `"${item.title}" Firebase Media Library mein update ho gayi!`
            : `"${item.title}" local backup mein save ho gayi. Global Firebase sync ke liye Google Admin Sign-In karein.`,
          'success'
        );
      }
      resetForm();
    } catch (err: any) {
      notify(err?.message || 'Media Library save karne mein masla aaya.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const activateItemOnStandby = async (item: MediaLibraryItem, playNow: boolean) => {
    setIsUpdatingStandby(true);
    try {
      const existingIdx = standbyPlaylist.findIndex((p) => p.url.trim() === item.url.trim());
      let nextPlaylist: TvPlaylistItem[] = [...standbyPlaylist];
      let targetId: string;

      if (existingIdx >= 0) {
        targetId = nextPlaylist[existingIdx].id;
        nextPlaylist[existingIdx] = {
          ...nextPlaylist[existingIdx],
          title: item.title,
          mediaType: item.mediaType,
          durationSec: item.durationSec
        };
      } else {
        if (nextPlaylist.length >= 20) {
          throw new Error('Standby playlist mein maximum 20 items aa sakte hain. Pehle purana item hatayein.');
        }
        targetId = `tv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        nextPlaylist = [
          ...nextPlaylist,
          {
            id: targetId,
            mediaType: item.mediaType,
            url: item.url,
            title: item.title,
            durationSec: item.durationSec
          }
        ];
      }

      if (playNow) {
        const patch: Partial<TvScreenConfig> = {
          playlist: nextPlaylist,
          playbackStopped: false,
          playNowItemId: targetId,
          playNowNonce: Date.now(),
          ...(liveMatchActive ? { enabled: true } : {})
        };
        const msg = liveMatchActive
          ? `"${item.title}" ab Live TV Card aur Standby Broadcast par chal rahi hai!`
          : `"${item.title}" ab Standby Broadcast screen par chal rahi hai!`;
        await onUpdateTvScreen(patch, msg);
        notify(msg, 'success');
      } else {
        const msg = `"${item.title}" Standby Playlist mein add ho gayi!`;
        await onUpdateTvScreen({ playlist: nextPlaylist, playbackStopped: false }, msg);
        notify(msg, 'success');
      }
    } catch (err: any) {
      notify(err?.message || 'Standby broadcast update nahi ho saka.', 'error');
    } finally {
      setIsUpdatingStandby(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      removeBackupMediaItem(deleteTarget.id);
      if (isFirebaseAdmin) {
        await deleteMediaLibraryItemFromFirestore(deleteTarget.id);
      }
      if (editingId === deleteTarget.id) {
        resetForm();
      }
      if (previewItemId === deleteTarget.id) {
        setPreviewItemId(null);
      }
      notify(`"${deleteTarget.title}" Media Library se delete ho gayi.`, 'success');
    } catch (err: any) {
      notify(err?.message || 'Delete karne mein error aaya.', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mediaLibrary.filter((item) => {
      if (categoryFilter !== 'All' && (item.category || 'Standby') !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q)
      );
    });
  }, [mediaLibrary, searchQuery, categoryFilter]);

  const formValidationPreview = useMemo(() => {
    if (!url.trim()) return null;
    const res = validateVideoLibraryUrl(url);
    return res.ok ? res : null;
  }, [url]);

  return (
    <div className="space-y-5">
      {/* 1. Header & Firebase / Standby Status Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Clapperboard className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-black text-white tracking-tight">
                Firebase Video Media Library
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-indigo-500/20 text-indigo-300 border-indigo-400/40">
                {mediaLibrary.length} {mediaLibrary.length === 1 ? 'Video' : 'Videos'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Yahan apni standby videos upload ya link karke Firebase mein store karein, phir 1 click se Standby Broadcast par chalayein.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold ${
                isFirebaseAdmin
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/50 border-amber-500/40 text-amber-300'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>
                {isFirebaseAdmin
                  ? 'Firebase Storage & Firestore Synced'
                  : 'Local Backup (Sign in Google Admin for Cloud Sync)'}
              </span>
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold ${
                !liveMatchActive && standbyPlaylist.length > 0 && !tvScreen.playbackStopped
                  ? 'bg-sky-950/60 border-sky-500/40 text-sky-300'
                  : tvScreen.enabled
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950 border-slate-700 text-slate-300'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>
                {tvScreen.enabled
                  ? 'TV Screen ON'
                  : !liveMatchActive && standbyPlaylist.length > 0 && !tvScreen.playbackStopped
                  ? `Standby Active (${standbyPlaylist.length})`
                  : liveMatchActive
                  ? 'Live Match Active'
                  : 'Standby Ready'}
              </span>
            </span>
          </div>
        </div>

        {/* 2. Upload / Link Video Form */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setInputMode('upload');
                  setFeedback(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all ${
                  inputMode === 'upload'
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Upload Video File (max 60MB)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputMode('url');
                  setSource('url');
                  setStoredInFirebase(false);
                  setFeedback(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all ${
                  inputMode === 'url'
                    ? 'bg-sky-600 text-white border-sky-400 shadow'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Link2 className="w-4 h-4" />
                <span>Link Video / YouTube URL</span>
              </button>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel Edit</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {inputMode === 'upload' && (
              <div className="md:col-span-3">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Video File (MP4, WebM, MOV)
                </label>
                <label
                  className={`w-full px-3 py-2 rounded-xl border border-dashed text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    isUploading
                      ? 'bg-slate-800 border-slate-600 text-slate-400 cursor-wait'
                      : 'bg-slate-950 hover:bg-slate-800 border-indigo-500/60 text-indigo-300'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Uploading...' : 'Choose Video'}</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*,.mp4,.webm,.mov,.m4v,.mkv"
                    disabled={isUploading || isSaving}
                    onChange={handleVideoFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            <div className={inputMode === 'upload' ? 'md:col-span-5' : 'md:col-span-8'}>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                {inputMode === 'upload'
                  ? 'Firebase / Server Video URL (auto-fills after upload)'
                  : 'External MP4/WebM URL ya YouTube Link'}
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  const val = e.target.value;
                  setUrl(val);
                  if (inputMode === 'url') {
                    setSource('url');
                    setStoredInFirebase(val.includes('firebasestorage.googleapis.com'));
                  }
                  if (feedback?.type === 'error') setFeedback(null);
                }}
                placeholder="https://...mp4 ya https://youtube.com/watch?v=..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MediaLibraryCategory)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-400"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Duration (Sec)
              </label>
              <input
                type="number"
                min={3}
                max={600}
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white text-center focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Video Title *
              </label>
              <input
                type="text"
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Match Countdown Promo / Sponsor Reel"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div className="md:col-span-4">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Notes / Description (Optional)
              </label>
              <input
                type="text"
                maxLength={300}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Standby loop, pre-match intro, etc."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="button"
                disabled={isSaving || isUploading}
                onClick={() => handleSave(false)}
                className="w-full px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow disabled:opacity-40"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : editingId ? 'Update Video' : 'Save to Library'}</span>
              </button>
            </div>

            <div className="md:col-span-2">
              <button
                type="button"
                disabled={isSaving || isUploading || isUpdatingStandby}
                onClick={() => handleSave(true)}
                className="w-full px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Save &amp; Play Standby</span>
              </button>
            </div>
          </div>

          {/* Inline Live Preview of Uploaded/Linked Video */}
          {formValidationPreview && (
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Video Preview ({formValidationPreview.mediaType.toUpperCase()})</span>
                </span>
                {storedInFirebase && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Cloud className="w-3 h-3" />
                    <span>Firebase Storage</span>
                  </span>
                )}
              </div>
              <div className="rounded-xl overflow-hidden bg-black aspect-video max-h-56 mx-auto flex items-center justify-center border border-slate-800">
                {formValidationPreview.mediaType === 'youtube' ? (
                  <HoldYouTubePlayer
                    videoUrls={[formValidationPreview.url]}
                    loop={false}
                    fillContainer
                    autoAdvanceOnEnd={false}
                    onFallback={() => {}}
                  />
                ) : (
                  <video
                    src={formValidationPreview.url}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
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
        </div>
      </div>

      {/* 3. Managed Media Library Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Film className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              Saved Videos ({filteredItems.length})
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search videos..."
                className="w-full sm:w-52 bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {(['All', ...CATEGORIES] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                    categoryFilter === cat
                      ? 'bg-indigo-600 text-white border-indigo-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-950 border border-dashed border-slate-800 text-xs text-slate-400 space-y-1.5">
            <p className="font-bold text-slate-300">
              {mediaLibrary.length === 0
                ? 'Abhi Media Library khali hai.'
                : 'Filter se koi video match nahi hui.'}
            </p>
            <p>
              Upar se koi MP4/WebM video upload karein ya YouTube/Video URL link karke Firebase mein save karein.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredItems.map((item) => {
              const playlistMatch = standbyPlaylist.find((p) => p.url.trim() === item.url.trim());
              const isPlayingOnStandby =
                Boolean(playlistMatch) &&
                !tvScreen.playbackStopped &&
                ((tvScreen.playNowItemId && tvScreen.playNowItemId === playlistMatch?.id) ||
                  (!tvScreen.playNowItemId && standbyPlaylist[0]?.id === playlistMatch?.id));
              const isPreviewOpen = previewItemId === item.id;

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-4 space-y-3 transition-colors ${
                    isPlayingOnStandby
                      ? 'bg-emerald-950/25 border-emerald-500/50'
                      : editingId === item.id
                      ? 'bg-indigo-950/30 border-indigo-500/60'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  {/* Top Badges & Title */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            item.mediaType === 'youtube'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/35'
                              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/35'
                          }`}
                        >
                          {item.mediaType === 'youtube' ? (
                            <Youtube className="w-3 h-3" />
                          ) : (
                            <Film className="w-3 h-3" />
                          )}
                          <span>{item.mediaType}</span>
                        </span>

                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                          {item.category || 'Standby'}
                        </span>

                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[10px] font-score font-bold">
                          {item.durationSec}s
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.storedInFirebase
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800/80 text-slate-400'
                          }`}
                        >
                          {item.storedInFirebase ? (
                            <>
                              <Cloud className="w-2.5 h-2.5" />
                              <span>Firebase Storage</span>
                            </>
                          ) : (
                            <>
                              <HardDrive className="w-2.5 h-2.5" />
                              <span>{item.source === 'upload' ? 'Server Video' : 'Linked URL'}</span>
                            </>
                          )}
                        </span>

                        {isPlayingOnStandby ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/50 text-[10px] font-black text-emerald-200 uppercase">
                            Playing on Standby
                          </span>
                        ) : playlistMatch ? (
                          <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-[10px] font-bold text-sky-300">
                            In Standby Playlist
                          </span>
                        ) : null}
                      </div>

                      <h4 className="text-sm font-black text-white truncate">{item.title}</h4>
                      {item.description && (
                        <p className="text-xs text-slate-400 line-clamp-2">{item.description}</p>
                      )}
                      <p className="text-[11px] text-slate-500 truncate">{item.url}</p>
                    </div>
                  </div>

                  {/* Toggleable Video Player Preview */}
                  {isPreviewOpen && (
                    <div className="rounded-xl overflow-hidden bg-black aspect-video border border-slate-800">
                      {item.mediaType === 'youtube' ? (
                        <HoldYouTubePlayer
                          videoUrls={[item.url]}
                          loop={false}
                          fillContainer
                          autoAdvanceOnEnd={false}
                          onFallback={() => {}}
                        />
                      ) : (
                        <video
                          src={item.url}
                          controls
                          autoPlay
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isUpdatingStandby}
                        onClick={() => activateItemOnStandby(item, true)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Play on Standby</span>
                      </button>

                      {!playlistMatch && (
                        <button
                          type="button"
                          disabled={isUpdatingStandby}
                          onClick={() => activateItemOnStandby(item, false)}
                          className="px-3 py-1.5 rounded-lg bg-sky-600/25 hover:bg-sky-600/40 border border-sky-500/40 text-sky-200 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                          <span>Add to Standby</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewItemId(isPreviewOpen ? null : item.id)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 ${
                          isPreviewOpen
                            ? 'bg-indigo-600 border-indigo-400 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isPreviewOpen ? 'Hide' : 'Preview'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        aria-label={`Edit ${item.title}`}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        aria-label={`Delete ${item.title}`}
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

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Media Library Video Delete Karein?"
        itemName={deleteTarget?.title}
        isDeleting={isDeleting}
        onCancel={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
