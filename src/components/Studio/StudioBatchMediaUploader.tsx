import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Film,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Loader2,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Upload,
  X,
  XCircle
} from 'lucide-react';
import { MediaLibraryItem, TvPlaylistItem } from '../../types/cricket';
import { useContent } from '../../context/ContentContext';
import {
  saveMediaLibraryItemToFirestore,
  uploadImageAsset,
  uploadTvVideoAsset
} from '../../services/firebaseContentService';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

export type BatchDestination = 'tv_playlist' | 'media_library' | 'upload_only';

export type BatchItemStatus =
  | 'queued'
  | 'uploading'
  | 'saving'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface BatchQueueItem {
  id: string;
  file: File;
  fileName: string;
  fileSizeBytes: number;
  fileSizeMb: string;
  mediaKind: 'video' | 'image';
  status: BatchItemStatus;
  progressPct: number;
  stageText: string;
  uploadedUrl?: string;
  storedInFirebase?: boolean;
  durationSec?: number;
  errorMessage?: string;
  startedAt?: number;
  endedAt?: number;
  elapsedLabel?: string;
  finishedAtLabel?: string;
}

interface BatchCompletionNotice {
  id: string;
  orderNumber: number;
  fileName: string;
  ok: boolean;
  elapsedLabel: string;
  detail: string;
  timestampLabel: string;
}

export interface BatchQueueSummary {
  running: boolean;
  total: number;
  completed: number;
  failed: number;
  queued: number;
}

interface StudioBatchMediaUploaderProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  onAutoOpen?: () => void;
  adminPin: string;
  isAuthorized: boolean;
  isFirebaseAdmin: boolean;
  tvPlaylistCount: number;
  onAppendTvPlaylistItem: (item: TvPlaylistItem) => Promise<{ added: boolean; note?: string }>;
  onStatusMessage: (msg: { text: string; type: 'success' | 'error' }) => void;
  onQueueSummaryChange?: (summary: BatchQueueSummary) => void;
}

const IMAGE_EXT_REGEX = /\.(png|jpe?g|webp|gif|svg)$/i;
const VIDEO_EXT_REGEX = /\.(mp4|webm|ogg|ogv|mov|m4v|mkv|3gp|avi|ts)$/i;

function detectBatchMediaKind(file: File): 'video' | 'image' {
  const mime = (file.type || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (IMAGE_EXT_REGEX.test(file.name)) return 'image';
  if (VIDEO_EXT_REGEX.test(file.name)) return 'video';
  return 'video';
}

function formatElapsedMs(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 1000) return `${safe}ms`;
  return `${(safe / 1000).toFixed(1)}s`;
}

function probeVideoDurationFast(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
      resolve(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
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

    const timer = setTimeout(() => finish(null), 2500);
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

function getStatusPillClass(status: BatchItemStatus): string {
  switch (status) {
    case 'queued':
      return 'bg-slate-800 border-slate-700 text-slate-300';
    case 'uploading':
      return 'bg-sky-500/20 border-sky-400/50 text-sky-200';
    case 'saving':
      return 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200';
    case 'completed':
      return 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200';
    case 'failed':
      return 'bg-rose-500/20 border-rose-400/50 text-rose-200';
    case 'cancelled':
      return 'bg-amber-500/20 border-amber-400/50 text-amber-200';
  }
}

function getProgressBarClass(status: BatchItemStatus): string {
  switch (status) {
    case 'completed':
      return '[&::-webkit-progress-value]:bg-emerald-400 [&::-moz-progress-bar]:bg-emerald-400';
    case 'failed':
      return '[&::-webkit-progress-value]:bg-rose-500 [&::-moz-progress-bar]:bg-rose-500';
    case 'saving':
      return '[&::-webkit-progress-value]:bg-indigo-400 [&::-moz-progress-bar]:bg-indigo-400';
    case 'cancelled':
      return '[&::-webkit-progress-value]:bg-amber-400 [&::-moz-progress-bar]:bg-amber-400';
    default:
      return '[&::-webkit-progress-value]:bg-sky-400 [&::-moz-progress-bar]:bg-sky-400';
  }
}

export const StudioBatchMediaUploader: React.FC<StudioBatchMediaUploaderProps> = ({
  isOpen,
  onToggleOpen,
  onAutoOpen,
  adminPin,
  isAuthorized,
  isFirebaseAdmin,
  tvPlaylistCount,
  onAppendTvPlaylistItem,
  onStatusMessage,
  onQueueSummaryChange
}) => {
  const { upsertBackupMediaItem } = useContent();

  const [queue, setQueue] = useState<BatchQueueItem[]>([]);
  const [completionFeed, setCompletionFeed] = useState<BatchCompletionNotice[]>([]);
  const [destination, setDestination] = useState<BatchDestination>('tv_playlist');
  const [defaultDurationSec, setDefaultDurationSec] = useState<number>(15);
  const [autoStartOnSelect, setAutoStartOnSelect] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedQueueIds, setSelectedQueueIds] = useState<string[]>([]);
  const [confirmBatchDeleteMode, setConfirmBatchDeleteMode] = useState<'selected' | 'all' | null>(
    null
  );

  const queueRef = useRef<BatchQueueItem[]>(queue);
  queueRef.current = queue;
  const isRunningRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const destinationRef = useRef<BatchDestination>(destination);
  destinationRef.current = destination;
  const durationRef = useRef<number>(defaultDurationSec);
  durationRef.current = defaultDurationSec;
  const adminPinRef = useRef<string>(adminPin);
  adminPinRef.current = adminPin;

  const updateQueue = useCallback((updater: (prev: BatchQueueItem[]) => BatchQueueItem[]) => {
    setQueue((prev) => {
      const next = updater(prev);
      queueRef.current = next;
      return next;
    });
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<BatchQueueItem>) => {
      updateQueue((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    [updateQueue]
  );

  const pushCompletionNotice = useCallback((notice: BatchCompletionNotice) => {
    setCompletionFeed((prev) => [notice, ...prev].slice(0, 8));
  }, []);

  const summary = useMemo<BatchQueueSummary>(() => {
    const total = queue.length;
    const completed = queue.filter((i) => i.status === 'completed').length;
    const failed = queue.filter((i) => i.status === 'failed').length;
    const queued = queue.filter((i) => i.status === 'queued').length;
    return {
      running: isRunning,
      total,
      completed,
      failed,
      queued
    };
  }, [queue, isRunning]);

  useEffect(() => {
    onQueueSummaryChange?.(summary);
  }, [summary, onQueueSummaryChange]);

  const activeItemInfo = useMemo(() => {
    const activeIdx = queue.findIndex((i) => i.status === 'uploading' || i.status === 'saving');
    if (activeIdx === -1) return null;
    return { index: activeIdx + 1, item: queue[activeIdx] };
  }, [queue]);

  const overallProgressPct = useMemo(() => {
    if (queue.length === 0) return 0;
    const sum = queue.reduce((acc, it) => {
      if (it.status === 'completed' || it.status === 'failed' || it.status === 'cancelled') {
        return acc + 100;
      }
      return acc + Math.max(0, Math.min(100, it.progressPct));
    }, 0);
    return Math.round(sum / queue.length);
  }, [queue]);

  const processQueueSequentially = useCallback(async () => {
    if (!isAuthorized || isRunningRef.current) return;

    isRunningRef.current = true;
    cancelRequestedRef.current = false;
    setIsRunning(true);

    let successCount = 0;
    let failCount = 0;

    try {
      while (!cancelRequestedRef.current) {
        const nextIndex = queueRef.current.findIndex((item) => item.status === 'queued');
        if (nextIndex === -1) break;
        const nextItem = queueRef.current[nextIndex];
        const orderNumber = nextIndex + 1;
        const itemStartedAt = Date.now();

        updateItem(nextItem.id, {
          status: 'uploading',
          progressPct: 2,
          stageText: 'Starting sequential upload...',
          errorMessage: undefined,
          startedAt: itemStartedAt,
          endedAt: undefined,
          elapsedLabel: undefined
        });

        try {
          const pin = adminPinRef.current;
          const dest = destinationRef.current;
          const fallbackDur = Math.max(3, Math.min(600, Math.round(durationRef.current || 15)));

          let uploadedUrl = '';
          let storedInFirebase = false;
          let probedDuration: number | undefined;

          if (nextItem.mediaKind === 'image') {
            const baseKey = nextItem.fileName.replace(/\.[^.]+$/, '') || 'tv_ad';
            const imgRes = await uploadImageAsset(
              nextItem.file,
              'tv_ads',
              baseKey,
              pin,
              1280,
              (pct, stage) => {
                updateItem(nextItem.id, {
                  status: 'uploading',
                  progressPct: Math.max(5, Math.min(95, pct)),
                  stageText: stage
                });
              }
            );
            if (!imgRes.url || imgRes.url.startsWith('data:')) {
              throw new Error(
                imgRes.storageError
                  ? `Image upload failed (${imgRes.storageError}). Verify Admin PIN or Google Admin sign-in.`
                  : 'Image upload rejected by server and Firebase Storage.'
              );
            }
            uploadedUrl = imgRes.url;
            storedInFirebase = imgRes.storedInFirebase;
            probedDuration = fallbackDur;
          } else {
            const [vidDur, vidRes] = await Promise.all([
              probeVideoDurationFast(nextItem.file),
              uploadTvVideoAsset(
                nextItem.file,
                nextItem.fileName,
                pin,
                dest === 'media_library' ? 'media_library' : 'tv_ads',
                (pct, stage) => {
                  updateItem(nextItem.id, {
                    status: 'uploading',
                    progressPct: Math.max(3, Math.min(96, pct)),
                    stageText: stage
                  });
                }
              )
            ]);
            uploadedUrl = vidRes.url;
            storedInFirebase = vidRes.storedInFirebase;
            probedDuration = vidDur || fallbackDur;
          }

          let completionStage = storedInFirebase
            ? 'Uploaded to Firebase Storage'
            : 'Uploaded to Express server';

          if (dest === 'tv_playlist') {
            updateItem(nextItem.id, {
              status: 'saving',
              progressPct: 98,
              stageText: 'Saving to TV & Standby Playlist...'
            });
            const tvItem: TvPlaylistItem = {
              id: `tv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
              mediaType: nextItem.mediaKind === 'image' ? 'image' : 'video',
              url: uploadedUrl,
              title: nextItem.fileName.replace(/\.[^.]+$/, '').slice(0, 120) || 'Batch Media',
              durationSec: probedDuration || fallbackDur
            };
            const saveRes = await onAppendTvPlaylistItem(tvItem);
            completionStage = saveRes.added
              ? `${completionStage} • Added to TV Playlist`
              : `${completionStage} • ${saveRes.note || 'Uploaded URL ready'}`;
          } else if (dest === 'media_library') {
            if (nextItem.mediaKind === 'video') {
              updateItem(nextItem.id, {
                status: 'saving',
                progressPct: 98,
                stageText: 'Saving to Media Library...'
              });
              const libItem: MediaLibraryItem = {
                id: `media_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
                title: nextItem.fileName.replace(/\.[^.]+$/, '').slice(0, 120) || 'Batch Video',
                mediaType: 'video',
                url: uploadedUrl,
                durationSec: probedDuration || fallbackDur,
                source: 'upload',
                category: 'Standby',
                description: 'Uploaded via StudioAdmin Batch Queue',
                storedInFirebase,
                createdAt: Date.now(),
                updatedAt: Date.now()
              };
              upsertBackupMediaItem(libItem);
              if (isFirebaseAdmin) {
                await saveMediaLibraryItemToFirestore(libItem, true);
              }
              completionStage = `${completionStage} • Saved to Media Library`;
            } else {
              completionStage = `${completionStage} • Image ready (Media Library is video-only)`;
            }
          }

          const endedAt = Date.now();
          const elapsedLabel = formatElapsedMs(endedAt - itemStartedAt);
          const finishedAtLabel = new Date(endedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });

          successCount += 1;
          updateItem(nextItem.id, {
            status: 'completed',
            progressPct: 100,
            stageText: `Finished in ${elapsedLabel} • ${completionStage}`,
            uploadedUrl,
            storedInFirebase,
            durationSec: probedDuration,
            endedAt,
            elapsedLabel,
            finishedAtLabel
          });

          pushCompletionNotice({
            id: `${nextItem.id}_${endedAt}`,
            orderNumber,
            fileName: nextItem.fileName,
            ok: true,
            elapsedLabel,
            detail: completionStage,
            timestampLabel: finishedAtLabel
          });

          onStatusMessage({
            text: `#${orderNumber} "${nextItem.fileName}" finished uploading (${elapsedLabel}) — ${completionStage}`,
            type: 'success'
          });
        } catch (err: any) {
          const endedAt = Date.now();
          const elapsedLabel = formatElapsedMs(endedAt - itemStartedAt);
          const finishedAtLabel = new Date(endedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          failCount += 1;
          const msg = err?.message || 'Upload failed';

          updateItem(nextItem.id, {
            status: 'failed',
            progressPct: 100,
            stageText: msg,
            errorMessage: msg,
            endedAt,
            elapsedLabel,
            finishedAtLabel
          });

          pushCompletionNotice({
            id: `${nextItem.id}_${endedAt}`,
            orderNumber,
            fileName: nextItem.fileName,
            ok: false,
            elapsedLabel,
            detail: msg,
            timestampLabel: finishedAtLabel
          });

          onStatusMessage({
            text: `#${orderNumber} "${nextItem.fileName}" failed (${elapsedLabel}): ${msg}`,
            type: 'error'
          });
        }
      }

      if (cancelRequestedRef.current) {
        updateQueue((prev) =>
          prev.map((it) =>
            it.status === 'queued'
              ? { ...it, status: 'cancelled', stageText: 'Cancelled by admin' }
              : it
          )
        );
      }

      if (successCount + failCount > 1) {
        onStatusMessage({
          text:
            failCount === 0
              ? `Batch queue complete: all ${successCount} media files uploaded sequentially!`
              : `Batch queue finished: ${successCount} succeeded, ${failCount} failed. Check queue or Network Monitor Logs for details.`,
          type: failCount === 0 ? 'success' : 'error'
        });
      }
    } finally {
      isRunningRef.current = false;
      cancelRequestedRef.current = false;
      setIsRunning(false);
    }
  }, [
    isAuthorized,
    isFirebaseAdmin,
    onAppendTvPlaylistItem,
    onStatusMessage,
    pushCompletionNotice,
    updateItem,
    updateQueue,
    upsertBackupMediaItem
  ]);

  const addFilesToQueue = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList || []);
      if (files.length === 0) return;

      const newItems: BatchQueueItem[] = files.map((file, idx) => ({
        id: `batch_${Date.now().toString(36)}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        file,
        fileName: file.name || `media_file_${idx + 1}`,
        fileSizeBytes: file.size || 0,
        fileSizeMb: ((file.size || 0) / (1024 * 1024)).toFixed(2),
        mediaKind: detectBatchMediaKind(file),
        status: 'queued',
        progressPct: 0,
        stageText: autoStartOnSelect && isAuthorized ? 'Queued — starting sequentially...' : 'Waiting in queue...'
      }));

      updateQueue((prev) => [...prev, ...newItems]);
      onAutoOpen?.();

      if (autoStartOnSelect && isAuthorized && !isRunningRef.current) {
        setTimeout(() => {
          void processQueueSequentially();
        }, 0);
      }
    },
    [autoStartOnSelect, isAuthorized, onAutoOpen, processQueueSequentially, updateQueue]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleStopAfterCurrent = () => {
    cancelRequestedRef.current = true;
  };

  const handleRetryItem = (id: string) => {
    updateItem(id, {
      status: 'queued',
      progressPct: 0,
      stageText: 'Queued for retry...',
      errorMessage: undefined,
      startedAt: undefined,
      endedAt: undefined,
      elapsedLabel: undefined,
      finishedAtLabel: undefined
    });
  };

  const handleRetryAllFailed = () => {
    updateQueue((prev) =>
      prev.map((it) =>
        it.status === 'failed' || it.status === 'cancelled'
          ? {
              ...it,
              status: 'queued',
              progressPct: 0,
              stageText: 'Queued for retry...',
              errorMessage: undefined,
              startedAt: undefined,
              endedAt: undefined,
              elapsedLabel: undefined,
              finishedAtLabel: undefined
            }
          : it
      )
    );
  };

  const handleRemoveItem = (id: string) => {
    updateQueue((prev) =>
      prev.filter((it) => !(it.id === id && it.status !== 'uploading' && it.status !== 'saving'))
    );
    setSelectedQueueIds((prev) => prev.filter((selId) => selId !== id));
  };

  const handleToggleSelectQueueItem = (id: string) => {
    setSelectedQueueIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const handleClearCompleted = () => {
    const completedIds = new Set(
      queueRef.current.filter((it) => it.status === 'completed').map((it) => it.id)
    );
    updateQueue((prev) => prev.filter((it) => it.status !== 'completed'));
    setSelectedQueueIds((prev) => prev.filter((id) => !completedIds.has(id)));
    setCompletionFeed((prev) => prev.filter((n) => !n.ok));
  };

  const handleConfirmBatchDeleteQueue = () => {
    if (confirmBatchDeleteMode === 'all') {
      if (isRunningRef.current) {
        cancelRequestedRef.current = true;
        updateQueue((prev) =>
          prev.filter((it) => it.status === 'uploading' || it.status === 'saving')
        );
      } else {
        updateQueue(() => []);
      }
      setSelectedQueueIds([]);
      setCompletionFeed([]);
      setConfirmBatchDeleteMode(null);
      onStatusMessage({
        text: 'Media upload queue cleared.',
        type: 'success'
      });
      return;
    }

    if (confirmBatchDeleteMode === 'selected') {
      const selectedSet = new Set(selectedQueueIds);
      const removable = queueRef.current.filter(
        (it) => selectedSet.has(it.id) && it.status !== 'uploading' && it.status !== 'saving'
      );
      if (removable.length > 0) {
        const removeSet = new Set(removable.map((it) => it.id));
        updateQueue((prev) => prev.filter((it) => !removeSet.has(it.id)));
        setSelectedQueueIds((prev) => prev.filter((id) => !removeSet.has(id)));
        onStatusMessage({
          text: `${removable.length} selected ${
            removable.length === 1 ? 'file' : 'files'
          } removed from the upload queue.`,
          type: 'success'
        });
      }
      setConfirmBatchDeleteMode(null);
    }
  };

  const handleClearAll = () => {
    if (queueRef.current.length === 0) return;
    setConfirmBatchDeleteMode('all');
  };

  const handleCopyUrl = (id: string, url: string) => {
    try {
      navigator.clipboard?.writeText(url);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1800);
    } catch {}
  };

  return (
    <section
      aria-label="Batch Media Upload Queue"
      className={`bg-slate-900 border rounded-2xl shadow-lg overflow-hidden transition-colors ${
        isRunning
          ? 'border-sky-500/60'
          : summary.failed > 0
          ? 'border-rose-500/45'
          : 'border-slate-800'
      }`}
    >
      {/* Collapsible Header Strip */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 bg-slate-950/60 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <ListChecks
            className={`w-4 h-4 shrink-0 ${
              isRunning
                ? 'text-sky-400 animate-pulse'
                : summary.failed > 0
                ? 'text-rose-400'
                : 'text-emerald-400'
            }`}
          />
          <h3 className="text-xs font-black uppercase tracking-wider text-white">
            Media Upload &amp; Visual Queue
          </h3>
          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300 uppercase">
            Sequential 1-by-1
          </span>

          {summary.total > 0 && (
            <span
              className={`px-2 py-0.5 rounded-md border text-[10px] font-black tabular-nums ${
                isRunning
                  ? 'bg-sky-500/20 border-sky-400/40 text-sky-200'
                  : summary.failed > 0
                  ? 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                  : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
              }`}
            >
              {summary.completed}/{summary.total} Finished
              {summary.failed > 0 ? ` • ${summary.failed} Failed` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 cursor-pointer shadow">
            <Upload className="w-3.5 h-3.5" />
            <span>Select Multiple Files</span>
            <input
              type="file"
              multiple
              accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*,image/*,.mp4,.webm,.mov,.m4v,.mkv,.ogg,.3gp,.avi,.ts,.png,.jpg,.jpeg,.webp,.gif"
              disabled={!isAuthorized}
              onChange={handleFileInputChange}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={onToggleOpen}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5"
          >
            <span>{isOpen ? 'Hide Queue' : `Open Queue (${summary.total})`}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 space-y-4">
          {/* Controls & Dropzone */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`lg:col-span-6 rounded-xl border-2 border-dashed p-4 flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors ${
                isDragging
                  ? 'border-sky-400 bg-sky-500/10'
                  : 'border-slate-700 bg-slate-950/70 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-sky-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-white">
                    Multi-File Dropzone (Videos &amp; Images)
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Multiple MP4, WebM, MOV, MKV videos ya images select/drop karein — queue 1-by-1 sequentially upload hogi aur har file complete hone par live feedback milega.
                  </p>
                </div>
              </div>
              <label className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black whitespace-nowrap cursor-pointer shrink-0 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>Add Files</span>
                <input
                  type="file"
                  multiple
                  accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*,image/*,.mp4,.webm,.mov,.m4v,.mkv,.ogg,.3gp,.avi,.ts,.png,.jpg,.jpeg,.webp,.gif"
                  disabled={!isAuthorized}
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Destination & Default Duration */}
            <div className="lg:col-span-6 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Save Uploaded Files To
                  </label>
                  <select
                    value={destination}
                    disabled={isRunning}
                    onChange={(e) => setDestination(e.target.value as BatchDestination)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-sky-400 disabled:opacity-60"
                  >
                    <option value="tv_playlist">
                      TV &amp; Standby Playlist ({tvPlaylistCount}/20)
                    </option>
                    <option value="media_library">Media Library (Videos)</option>
                    <option value="upload_only">Upload Only (Copy URLs)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Fallback Sec
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={600}
                    disabled={isRunning}
                    value={defaultDurationSec}
                    onChange={(e) => setDefaultDurationSec(Number(e.target.value) || 15)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white text-center focus:outline-none focus:border-sky-400 disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {!isRunning ? (
                    <button
                      type="button"
                      disabled={!isAuthorized || summary.queued === 0}
                      onClick={processQueueSequentially}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-40 shadow"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Queue ({summary.queued})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopAfterCurrent}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-black flex items-center gap-1.5 shadow"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Stop Remaining</span>
                    </button>
                  )}

                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoStartOnSelect}
                      onChange={(e) => setAutoStartOnSelect(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-0"
                    />
                    <span>Auto-start</span>
                  </label>

                  {summary.failed > 0 && !isRunning && (
                    <button
                      type="button"
                      onClick={handleRetryAllFailed}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-300 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry Failed</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {summary.completed > 0 && (
                    <button
                      type="button"
                      onClick={handleClearCompleted}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300"
                    >
                      Clear Done
                    </button>
                  )}
                  {summary.total > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-rose-300 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear All</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Per-File Finish Feedback Banner */}
          {completionFeed.length > 0 && (
            <div
              role="status"
              aria-live="polite"
              className="bg-slate-950/90 border border-emerald-500/35 rounded-xl p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                <span>Live Completion Feedback ({completionFeed.length})</span>
                <button
                  type="button"
                  onClick={() => setCompletionFeed([])}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  Dismiss
                </button>
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {completionFeed.map((notice) => (
                  <div
                    key={notice.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px] border ${
                      notice.ok
                        ? 'bg-emerald-950/35 border-emerald-500/35 text-emerald-100'
                        : 'bg-rose-950/35 border-rose-500/40 text-rose-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {notice.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <span className="font-mono font-bold text-slate-300 shrink-0">
                        #{notice.orderNumber}
                      </span>
                      <span className="font-bold truncate">{notice.fileName}</span>
                      <span className="text-slate-300 truncate">— {notice.detail}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {notice.elapsedLabel} • {notice.timestampLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overall Queue Progress */}
          {queue.length > 0 && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="font-bold text-white flex items-center gap-2 min-w-0">
                  {isRunning ? (
                    <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
                  ) : summary.failed > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : summary.completed === summary.total ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <ListChecks className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span className="truncate">
                    {activeItemInfo
                      ? `Processing #${activeItemInfo.index} of ${summary.total}: ${activeItemInfo.item.fileName}`
                      : `Overall Queue Progress: ${summary.completed}/${summary.total} Finished`}
                    {!activeItemInfo && summary.queued > 0 ? ` • ${summary.queued} Pending` : ''}
                    {!activeItemInfo && summary.failed > 0 ? ` • ${summary.failed} Failed` : ''}
                  </span>
                </div>
                <span className="font-mono font-black text-sky-300 tabular-nums shrink-0">
                  {overallProgressPct}%
                </span>
              </div>
              <progress
                value={overallProgressPct}
                max={100}
                aria-label="Overall batch upload progress"
                className="w-full h-2 rounded-full overflow-hidden bg-slate-900 border border-slate-800 [&::-webkit-progress-bar]:bg-slate-900 [&::-webkit-progress-value]:bg-emerald-400 [&::-moz-progress-bar]:bg-emerald-400"
              />
            </div>
          )}

          {/* Visual Queue List */}
          <div className="bg-slate-950/50 border border-slate-800/90 rounded-xl p-3 space-y-2.5">
            {(() => {
              const selectableItems = queue.filter(
                (it) => it.status !== 'uploading' && it.status !== 'saving'
              );
              const selectableSet = new Set(selectableItems.map((it) => it.id));
              const validSelectedIds = selectedQueueIds.filter((id) => selectableSet.has(id));
              const selectedSet = new Set(validSelectedIds);
              const allSelectableSelected =
                selectableItems.length > 0 &&
                selectableItems.every((it) => selectedSet.has(it.id));

              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-300">
                      <ListChecks className="w-3.5 h-3.5 text-sky-400" />
                      <span>Visual Upload Queue ({queue.length})</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Files process strictly one after another with live progress bars
                    </span>
                  </div>

                  {queue.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={allSelectableSelected}
                            disabled={selectableItems.length === 0}
                            onChange={() => {
                              if (allSelectableSelected) {
                                setSelectedQueueIds([]);
                              } else {
                                setSelectedQueueIds(selectableItems.map((it) => it.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-rose-500 focus:ring-0"
                          />
                          <span>
                            {allSelectableSelected
                              ? `Deselect All (${selectableItems.length})`
                              : `Select All (${selectableItems.length})`}
                          </span>
                        </label>

                        {validSelectedIds.length > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/40 text-[11px] font-black text-rose-200 tabular-nums">
                            {validSelectedIds.length} Selected
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {validSelectedIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedQueueIds([])}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300"
                          >
                            Clear Selection
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={validSelectedIds.length === 0}
                          onClick={() => setConfirmBatchDeleteMode('selected')}
                          className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>
                            Delete Selected
                            {validSelectedIds.length > 0 ? ` (${validSelectedIds.length})` : ''}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {queue.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-6 text-center space-y-1">
                      <p className="text-xs font-bold text-slate-300">
                        No files queued yet
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Click <strong>Select Multiple Files</strong> or drop videos/images above to view file names, sequential progress bars, and per-file completion updates here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                      {queue.map((item, idx) => {
                        const isActiveUpload = item.status === 'uploading' || item.status === 'saving';
                        const isChecked = !isActiveUpload && selectedSet.has(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`rounded-xl border p-3 space-y-2 transition-colors ${
                              isChecked
                                ? 'bg-rose-950/20 border-rose-500/65'
                                : isActiveUpload
                                ? 'bg-slate-950 border-sky-500/60 shadow'
                                : item.status === 'failed'
                                ? 'bg-rose-950/20 border-rose-500/45'
                                : item.status === 'completed'
                                ? 'bg-emerald-950/15 border-emerald-500/35'
                                : 'bg-slate-950/70 border-slate-800'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isActiveUpload}
                                  onChange={() => handleToggleSelectQueueItem(item.id)}
                                  aria-label={`Select ${item.fileName} for batch delete`}
                                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-rose-500 focus:ring-0 shrink-0 disabled:opacity-35 cursor-pointer"
                                />
                                <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] font-bold text-slate-300 shrink-0">
                                  #{idx + 1}
                                </span>
                        {item.status === 'uploading' || item.status === 'saving' ? (
                          <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
                        ) : item.status === 'completed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : item.status === 'failed' ? (
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] font-bold text-indigo-300 uppercase flex items-center gap-1 shrink-0">
                          {item.mediaKind === 'image' ? (
                            <ImageIcon className="w-3 h-3" />
                          ) : (
                            <Film className="w-3 h-3" />
                          )}
                          {item.mediaKind}
                        </span>
                        <span className="text-xs font-bold text-white truncate" title={item.fileName}>
                          {item.fileName}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          ({item.fileSizeMb} MB)
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.elapsedLabel && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-slate-300">
                            {item.elapsedLabel}
                          </span>
                        )}

                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase flex items-center gap-1 ${getStatusPillClass(
                            item.status
                          )}`}
                        >
                          <span>
                            {item.status === 'uploading'
                              ? `Uploading ${item.progressPct}%`
                              : item.status === 'completed'
                              ? 'Finished'
                              : item.status}
                          </span>
                        </span>

                        {item.status === 'completed' && item.uploadedUrl && (
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(item.id, item.uploadedUrl!)}
                            className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-emerald-300 flex items-center gap-1"
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>URL</span>
                              </>
                            )}
                          </button>
                        )}

                        {(item.status === 'failed' || item.status === 'cancelled') && !isRunning && (
                          <button
                            type="button"
                            onClick={() => handleRetryItem(item.id)}
                            className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-amber-300 flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        )}

                        {item.status !== 'uploading' && item.status !== 'saving' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            aria-label={`Remove ${item.fileName} from queue`}
                            className="p-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Per-item Progress Bar + Stage Indicator */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={`truncate ${
                            item.status === 'failed'
                              ? 'text-rose-200 font-semibold'
                              : item.status === 'completed'
                              ? 'text-emerald-200 font-semibold'
                              : 'text-slate-300'
                          }`}
                          title={item.stageText}
                        >
                          {item.stageText}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-300 tabular-nums shrink-0">
                          {item.progressPct}%
                        </span>
                      </div>
                      <progress
                        value={item.progressPct}
                        max={100}
                        aria-label={`Queue progress for ${item.fileName}`}
                        className={`w-full h-1.5 rounded-full overflow-hidden bg-slate-900 border border-slate-800 [&::-webkit-progress-bar]:bg-slate-900 ${getProgressBarClass(
                          item.status
                        )}`}
                      />
                    </div>
                  </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        open={Boolean(confirmBatchDeleteMode)}
        title={
          confirmBatchDeleteMode === 'all'
            ? 'Clear All Queued Media Files?'
            : 'Remove Selected Queue Files?'
        }
        itemNames={
          confirmBatchDeleteMode === 'all'
            ? queue.map((it) => it.fileName)
            : queue
                .filter(
                  (it) =>
                    selectedQueueIds.includes(it.id) &&
                    it.status !== 'uploading' &&
                    it.status !== 'saving'
                )
                .map((it) => it.fileName)
        }
        description={
          confirmBatchDeleteMode === 'all'
            ? `Are you sure you want to remove all ${queue.length} items from the visual upload queue?`
            : undefined
        }
        confirmLabel={confirmBatchDeleteMode === 'all' ? 'Yes, Clear Queue' : undefined}
        onCancel={() => setConfirmBatchDeleteMode(null)}
        onConfirm={handleConfirmBatchDeleteQueue}
      />
    </section>
  );
};
