import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MediaLibraryItem, TvPlaylistItem, TvPlaylistMediaType, TvScreenConfig } from '../../types/cricket';
import { uploadImageAsset, uploadTvVideoAsset } from '../../services/firebaseContentService';
import { useContent } from '../../context/ContentContext';
import { extractYouTubeVideoId, isYouTubeChannelLiveUrl } from '../Common/HoldYouTubePlayer';
import {
  Tv,
  Power,
  Plus,
  Play,
  Square,
  Repeat,
  ArrowUp,
  ArrowDown,
  Trash2,
  Upload,
  Youtube,
  Image as ImageIcon,
  Film,
  Sparkles,
  Save,
  Layers,
  ExternalLink,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  Cloud,
  Video,
  Mic,
  Monitor,
  RotateCcw,
  Radio,
  Newspaper,
  Copy,
  Check,
  Globe
} from 'lucide-react';
import { TvMultiUrlSlots } from './TvMultiUrlSlots';

interface StudioTvScreenPanelProps {
  tvScreen: TvScreenConfig;
  adminPin: string;
  isSaving: boolean;
  isFirebaseAdmin?: boolean;
  liveMatchActive?: boolean;
  onUpdateTvScreen: (patch: Partial<TvScreenConfig>, successText: string) => Promise<void>;
  onStatusMessage: (msg: { text: string; type: 'success' | 'error' }) => void;
}

type AddMediaTab = TvPlaylistMediaType | 'record';
type RecordSourceMode = 'camera' | 'voice' | 'screen';

function pickSupportedRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4'
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

function formatTimer(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

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

function validateAndNormalizeMediaInput(
  rawUrl: string,
  selectedType: TvPlaylistMediaType
): { ok: true; mediaType: TvPlaylistMediaType; url: string } | { ok: false; error: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: 'Pehle Image/Video URL ya YouTube link dalein (ya file upload karein).' };
  }

  if (/^(javascript|vbscript):/i.test(trimmed)) {
    return { ok: false, error: 'Ye URL format safe nahi hai. Sahih https:// link dalein.' };
  }

  const looksLikeNewsTv =
    /(?:[?&]view=news-tv|live-sports-news|cricket-news-tv)/i.test(trimmed) ||
    selectedType === 'news_feed';

  if (looksLikeNewsTv) {
    if (trimmed.startsWith('/')) {
      return {
        ok: true,
        mediaType: 'news_feed',
        url: trimmed.slice(0, 2000)
      };
    }
    const newsCandidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(newsCandidate);
      return {
        ok: true,
        mediaType: 'news_feed',
        url: parsed.toString().slice(0, 2000)
      };
    } catch {
      return {
        ok: false,
        error: 'Galat News TV link! Sahih /?view=news-tv ya https://.../?view=news-tv link dalein.'
      };
    }
  }

  const looksLikeYouTube =
    /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(trimmed) ||
    selectedType === 'youtube';

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
          'Galat YouTube link! Sahih format dalein: https://youtube.com/watch?v=... , https://youtu.be/... ya https://youtube.com/live/...'
      };
    }

    return {
      ok: true,
      mediaType: 'youtube',
      url: `https://www.youtube.com/watch?v=${videoId}`
    };
  }

  // Relative uploaded paths (/api/media/... or /Assets/...) or data URLs
  if (trimmed.startsWith('/')) {
    if (trimmed.length < 2 || /\s/.test(trimmed)) {
      return { ok: false, error: 'Galat file path! Sahih path ya https:// URL dalein.' };
    }
    return {
      ok: true,
      mediaType: selectedType,
      url: trimmed.slice(0, 2000)
    };
  }

  if (trimmed.startsWith('data:image/')) {
    if (selectedType === 'video' || selectedType === 'embed') {
      return { ok: false, error: 'Stream/Video URL ke liye valid https:// link dalein.' };
    }
    return {
      ok: true,
      mediaType: 'image',
      url: trimmed
    };
  }

  if (/^data:/i.test(trimmed)) {
    return { ok: false, error: 'Ye URL format allowed nahi hai. Sahih https:// link dalein.' };
  }

  // HTTP / HTTPS / bare domain
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    const hasDotOrLocalhost =
      parsed.hostname.includes('.') || parsed.hostname === 'localhost';
    if (!hasDotOrLocalhost || /\s/.test(trimmed)) {
      return {
        ok: false,
        error: 'Galat URL! Poora link dalein (maslan https://example.com/ad.jpg ya YouTube link).'
      };
    }
    return {
      ok: true,
      mediaType: selectedType,
      url: parsed.toString().slice(0, 2000)
    };
  } catch {
    return {
      ok: false,
      error: 'Galat URL format! Sahih https:// link dalein ya file upload karein.'
    };
  }
}

export const StudioTvScreenPanel: React.FC<StudioTvScreenPanelProps> = ({
  tvScreen,
  adminPin,
  isSaving,
  isFirebaseAdmin = false,
  liveMatchActive = false,
  onUpdateTvScreen,
  onStatusMessage
}) => {
  const { mediaLibrary } = useContent();
  const [activeTab, setActiveTab] = useState<AddMediaTab>('video');
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [durationInput, setDurationInput] = useState<number>(15);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [newsCopied, setNewsCopied] = useState(false);
  const [newsTitleInput, setNewsTitleInput] = useState('Live Cricket Sports News');
  const [newsDurationInput, setNewsDurationInput] = useState<number>(45);

  // Studio Recorder State
  const [recordMode, setRecordMode] = useState<RecordSourceMode>('camera');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string>('');
  const [recordedTitle, setRecordedTitle] = useState<string>('');
  const [recordedDurationSec, setRecordedDurationSec] = useState<number>(15);
  const [isSavingRecording, setIsSavingRecording] = useState(false);

  const [gapSecInput, setGapSecInput] = useState<number>(tvScreen.batBallGapSec || 5);
  const [sponsorNameInput, setSponsorNameInput] = useState<string>(tvScreen.sponsorName || '');
  const [sponsorLinkInput, setSponsorLinkInput] = useState<string>(tvScreen.sponsorLink || '');
  const [durationDrafts, setDurationDrafts] = useState<Record<string, number>>({});

  const livePreviewRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const canvasRafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordStartMsRef = useRef<number>(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setGapSecInput(tvScreen.batBallGapSec || 5);
    setSponsorNameInput(tvScreen.sponsorName || '');
    setSponsorLinkInput(tvScreen.sponsorLink || '');
    const map: Record<string, number> = {};
    (tvScreen.playlist || []).forEach((item) => {
      map[item.id] = item.durationSec || 10;
    });
    setDurationDrafts(map);
  }, [tvScreen]);

  const cleanupRecordingHardware = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (canvasRafRef.current !== null) {
      cancelAnimationFrame(canvasRafRef.current);
      canvasRafRef.current = null;
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((t) => t.stop());
      activeStreamRef.current = null;
    }
    if (canvasStreamRef.current) {
      canvasStreamRef.current.getTracks().forEach((t) => t.stop());
      canvasStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (livePreviewRef.current) {
      livePreviewRef.current.srcObject = null;
    }
  }, []);

  const clearRecordedClip = useCallback(() => {
    setRecordedBlob(null);
    setRecordedPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setRecordedTitle('');
    setRecordedDurationSec(15);
  }, []);

  useEffect(() => {
    return () => {
      cleanupRecordingHardware();
    };
  }, [cleanupRecordingHardware]);

  useEffect(() => {
    return () => {
      if (recordedPreviewUrl) {
        URL.revokeObjectURL(recordedPreviewUrl);
      }
    };
  }, [recordedPreviewUrl]);

  const markSaved = (label: string) => {
    setSavedLabel(isFirebaseAdmin ? `${label} (Firebase Synced)` : label);
  };

  const safeUpdateTv = async (patch: Partial<TvScreenConfig>, successText: string, badgeLabel = 'Saved') => {
    setFormError(null);
    try {
      await onUpdateTvScreen(patch, successText);
      markSaved(badgeLabel);
      return true;
    } catch (err: any) {
      const msg = err?.message || 'TV Screen save failed';
      setFormError(msg);
      return false;
    }
  };

  const handleToggleTvEnabled = async () => {
    const next = !tvScreen.enabled;
    await safeUpdateTv(
      { enabled: next },
      next
        ? tvScreen.fullScreenTakeover
          ? 'TV Screen ON (Full Screen Takeover) — Sab viewers par TV screen live ho gayi!'
          : 'TV Screen ON — Broadcast TV Card mein ab Ads / Recorded Media / Bat-Ball chalega!'
        : 'TV Screen OFF — Broadcast TV Card wapas Live Ground par aa gaya!',
      next ? 'TV Screen ON Saved' : 'TV Screen OFF Saved'
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetType: 'image' | 'video') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setFormError(null);
    setIsUploading(true);
    try {
      if (targetType === 'image') {
        const res = await uploadImageAsset(file, 'tv_ads', file.name.split('.')[0] || 'tv_ad', adminPin, 1280);
        setUrlInput(res.url);
        if (!titleInput.trim()) {
          setTitleInput(file.name.replace(/\.[^.]+$/, '').slice(0, 80));
        }
        onStatusMessage({
          text: res.storedInFirebase
            ? 'Ad image Firebase Storage mein upload ho gayi — ab "Add to Standby" dabayein!'
            : 'Ad image server par upload ho gayi — ab "Add to Standby" dabayein!',
          type: 'success'
        });
      } else {
        if (file.size > 60 * 1024 * 1024) {
          throw new Error('Video file 60MB se chhoti honi chahiye.');
        }
        const [probedDur, res] = await Promise.all([
          probeVideoDurationSec(file),
          uploadTvVideoAsset(file, file.name, adminPin)
        ]);
        setUrlInput(res.url);
        if (probedDur) {
          setDurationInput(probedDur);
        }
        if (!titleInput.trim()) {
          setTitleInput(file.name.replace(/\.[^.]+$/, '').slice(0, 80));
        }
        onStatusMessage({
          text: `${
            res.storedInFirebase ? 'Video Firebase Storage mein' : 'Recorded video server par'
          } upload ho gayi${probedDur ? ` (${probedDur}s)` : ''} — ab "Add to Standby" dabayein!`,
          type: 'success'
        });
      }
    } catch (err: any) {
      const msg = err?.message || 'Media upload fail ho gaya';
      setFormError(msg);
      onStatusMessage({
        text: msg,
        type: 'error'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleStopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {}
    }
    setIsRecording(false);
  }, []);

  const handleStartRecording = async () => {
    if (isRecording || isSavingRecording) return;
    setFormError(null);
    clearRecordedClip();
    cleanupRecordingHardware();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
      const msg = 'Is browser/device mein direct recording support nahi hai. "Video Upload / URL" se pre-recorded file upload karein.';
      setFormError(msg);
      onStatusMessage({ text: msg, type: 'error' });
      return;
    }

    try {
      let sourceStream: MediaStream;
      let combinedStream: MediaStream;

      if (recordMode === 'camera') {
        sourceStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true
        });
        activeStreamRef.current = sourceStream;
        combinedStream = sourceStream;
      } else if (recordMode === 'screen') {
        if (!navigator.mediaDevices.getDisplayMedia) {
          throw new Error('Screen recording is device par available nahi hai. Camera ya Voice Studio chunein.');
        }
        sourceStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        activeStreamRef.current = sourceStream;
        combinedStream = sourceStream;
      } else {
        // Voice / Studio Audio mode -> render sleek animated broadcast standby visual onto canvas + mic track
        sourceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        activeStreamRef.current = sourceStream;

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');

        let analyser: AnalyserNode | null = null;
        let freqData: Uint8Array<ArrayBuffer> | null = null;
        try {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const actx = new AudioCtx();
          audioCtxRef.current = actx;
          const srcNode = actx.createMediaStreamSource(sourceStream);
          analyser = actx.createAnalyser();
          analyser.fftSize = 64;
          srcNode.connect(analyser);
          freqData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        } catch {}

        const drawFrame = (now: number) => {
          if (ctx) {
            const grad = ctx.createLinearGradient(0, 0, 640, 360);
            grad.addColorStop(0, '#040a18');
            grad.addColorStop(0.55, '#0a1630');
            grad.addColorStop(1, '#030712');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 640, 360);

            // Subtle glow ring
            ctx.beginPath();
            ctx.arc(320, 165, 92 + Math.sin(now * 0.004) * 5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Animated voice equalizer bars
            if (analyser && freqData) {
              analyser.getByteFrequencyData(freqData);
            }
            const barCount = 16;
            const totalW = barCount * 16;
            const startX = (640 - totalW) / 2;
            for (let i = 0; i < barCount; i++) {
              const rawVal = freqData ? freqData[i % freqData.length] / 255 : (0.25 + 0.35 * Math.abs(Math.sin(now * 0.006 + i)));
              const h = Math.max(12, Math.round(rawVal * 88));
              const x = startX + i * 16;
              const y = 165 - h / 2;
              ctx.fillStyle = i % 2 === 0 ? '#38bdf8' : '#34d399';
              ctx.fillRect(x, y, 10, h);
            }

            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('BROADCAST STUDIO STANDBY', 320, 265);

            ctx.fillStyle = '#e2e8f0';
            ctx.font = '600 14px sans-serif';
            ctx.fillText(recordedTitle.trim() || 'Recorded Broadcast Message', 320, 292);
          }
          canvasRafRef.current = requestAnimationFrame(drawFrame);
        };
        canvasRafRef.current = requestAnimationFrame(drawFrame);

        const cStream = canvas.captureStream(24);
        sourceStream.getAudioTracks().forEach((track) => cStream.addTrack(track));
        canvasStreamRef.current = cStream;
        combinedStream = cStream;
      }

      if (livePreviewRef.current) {
        livePreviewRef.current.srcObject = combinedStream;
        livePreviewRef.current.play().catch(() => {});
      }

      const mimeType = pickSupportedRecorderMime();
      const recorder = mimeType
        ? new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 1_500_000 })
        : new MediaRecorder(combinedStream);

      recordChunksRef.current = [];
      recorderRef.current = recorder;

      // Auto-stop if user stops screen share via browser chrome
      sourceStream.getVideoTracks().forEach((vt) => {
        vt.onended = () => {
          if (recorder.state !== 'inactive') {
            handleStopRecording();
          }
        };
      });

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const elapsedSec = Math.max(3, Math.min(600, Math.round((Date.now() - recordStartMsRef.current) / 1000)));
        const finalMime = recorder.mimeType || mimeType || 'video/webm';
        const blob = new Blob(recordChunksRef.current, { type: finalMime });
        recordChunksRef.current = [];
        cleanupRecordingHardware();
        setIsRecording(false);

        if (blob.size === 0) {
          setFormError('Recording khali thi — dobara koshish karein.');
          return;
        }
        if (blob.size > 60 * 1024 * 1024) {
          setFormError('Recorded video 60MB se badi hai — chhoti clip record karein.');
          return;
        }

        const probed = await probeVideoDurationSec(blob);
        const dur = probed || elapsedSec;
        const preview = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedPreviewUrl(preview);
        setRecordedDurationSec(dur);
        if (!recordedTitle.trim()) {
          const prefix =
            recordMode === 'camera'
              ? 'Studio Video'
              : recordMode === 'voice'
              ? 'Voice Message'
              : 'Screen Clip';
          setRecordedTitle(`${prefix} (${dur}s)`);
        }
      };

      recordStartMsRef.current = Date.now();
      setRecordingSec(0);
      setIsRecording(true);
      recorder.start(500);

      recordTimerRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - recordStartMsRef.current) / 1000);
        setRecordingSec(sec);
        if (sec >= 600) {
          handleStopRecording();
        }
      }, 500);
    } catch (err: any) {
      cleanupRecordingHardware();
      setIsRecording(false);
      const rawMsg = String(err?.message || '');
      const friendly = /denied|permission|notallowed/i.test(rawMsg)
        ? 'Camera / Mic permission deny ho gayi. Browser settings se allow karein ya pre-recorded file upload karein.'
        : rawMsg || 'Recording start nahi ho saki.';
      setFormError(friendly);
      onStatusMessage({ text: friendly, type: 'error' });
    }
  };

  const handleSaveRecordedClipToStandby = async () => {
    if (!recordedBlob || isSavingRecording || isSaving) return;
    if ((tvScreen.playlist || []).length >= 20) {
      const msg = 'Playlist mein maximum 20 items add kiye ja sakte hain.';
      setFormError(msg);
      onStatusMessage({ text: msg, type: 'error' });
      return;
    }

    setFormError(null);
    setIsSavingRecording(true);
    try {
      const ext = (recordedBlob.type || '').includes('mp4') ? 'mp4' : 'webm';
      const fileName = `recorded_${recordMode}_${Date.now()}.${ext}`;
      const uploadRes = await uploadTvVideoAsset(recordedBlob, fileName, adminPin);

      const newItem: TvPlaylistItem = {
        id: `tv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        mediaType: 'video',
        url: uploadRes.url,
        title:
          recordedTitle.trim().slice(0, 120) ||
          `Recorded Standby ${(tvScreen.playlist?.length || 0) + 1}`,
        durationSec: Math.max(3, Math.min(600, Math.round(recordedDurationSec || 15)))
      };

      const nextPlaylist = [...(tvScreen.playlist || []), newItem];
      const ok = await safeUpdateTv(
        {
          playlist: nextPlaylist,
          playbackStopped: false,
          playNowItemId: newItem.id,
          playNowNonce: Date.now()
        },
        liveMatchActive && !tvScreen.enabled
          ? `"${newItem.title}" TV Standby Playlist mein save ho gaya! Live match ke dauran dikhane ke liye TV Screen ON karein.`
          : `"${newItem.title}" Broadcast TV Standby par save aur chalna shuru ho gaya!`,
        'Recorded Clip Saved'
      );

      if (ok) {
        clearRecordedClip();
      }
    } catch (err: any) {
      const msg = err?.message || 'Recorded video save nahi ho saki';
      setFormError(msg);
      onStatusMessage({ text: msg, type: 'error' });
    } finally {
      setIsSavingRecording(false);
    }
  };

  const handleAddPlaylistItem = async () => {
    setFormError(null);
    if (activeTab === 'record') return;
    if ((tvScreen.playlist || []).length >= 20) {
      const msg = 'Playlist mein maximum 20 ads/videos add kiye ja sakte hain.';
      setFormError(msg);
      onStatusMessage({ text: msg, type: 'error' });
      return;
    }

    const validated = validateAndNormalizeMediaInput(urlInput, activeTab);
    if (!validated.ok) {
      setFormError(validated.error);
      onStatusMessage({ text: validated.error, type: 'error' });
      return;
    }

    if (validated.mediaType !== activeTab) {
      setActiveTab(validated.mediaType);
    }

    const clampedDur = Math.max(3, Math.min(600, Math.round(Number(durationInput) || 10)));
    const newItem: TvPlaylistItem = {
      id: `tv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      mediaType: validated.mediaType,
      url: validated.url,
      title:
        titleInput.trim().slice(0, 120) ||
        `${validated.mediaType === 'video' ? 'Recorded Video' : validated.mediaType.toUpperCase()} ${(tvScreen.playlist?.length || 0) + 1}`,
      durationSec: clampedDur
    };
    const nextPlaylist = [...(tvScreen.playlist || []), newItem];

    const ok = await safeUpdateTv(
      { playlist: nextPlaylist, playbackStopped: false },
      liveMatchActive && !tvScreen.enabled
        ? 'Item TV Standby Playlist mein save ho gaya! Live match mein chalane ke liye "Play Now" dabayein.'
        : 'Recorded Media / Ad Broadcast TV Standby playlist mein add aur save ho gaya!',
      'Saved'
    );

    if (ok) {
      setUrlInput('');
      setTitleInput('');
      setDurationInput(15);
    }
  };

  const liveNewsChannelUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/?view=news-tv` : '/?view=news-tv';

  const handleCopyNewsLink = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(liveNewsChannelUrl);
      }
      setNewsCopied(true);
      onStatusMessage({
        text: 'Live Cricket Sports News link copy ho gaya!',
        type: 'success'
      });
      setTimeout(() => setNewsCopied(false), 2500);
    } catch {
      onStatusMessage({
        text: `Link copy karein: ${liveNewsChannelUrl}`,
        type: 'success'
      });
    }
  };

  const handleAddAndPlayLiveNews = async () => {
    setFormError(null);
    const currentPlaylist = [...(tvScreen.playlist || [])];
    const existing = currentPlaylist.find(
      (it) =>
        it.mediaType === 'news_feed' ||
        /(?:[?&]view=news-tv|live-sports-news|cricket-news-tv)/i.test(it.url || '')
    );

    const clampedDur = Math.max(10, Math.min(600, Math.round(Number(newsDurationInput) || 45)));
    const cleanTitle = newsTitleInput.trim().slice(0, 120) || 'Live Cricket Sports News';

    let targetId: string;
    let nextPlaylist: TvPlaylistItem[];

    if (existing) {
      targetId = existing.id;
      nextPlaylist = currentPlaylist.map((it) =>
        it.id === existing.id
          ? { ...it, mediaType: 'news_feed', url: liveNewsChannelUrl, title: cleanTitle, durationSec: clampedDur }
          : it
      );
    } else {
      if (currentPlaylist.length >= 20) {
        const msg = 'Playlist mein maximum 20 items add kiye ja sakte hain. Pehle koi purana item delete karein.';
        setFormError(msg);
        onStatusMessage({ text: msg, type: 'error' });
        return;
      }
      targetId = `tv_news_${Date.now().toString(36)}`;
      nextPlaylist = [
        ...currentPlaylist,
        {
          id: targetId,
          mediaType: 'news_feed',
          url: liveNewsChannelUrl,
          title: cleanTitle,
          durationSec: clampedDur
        }
      ];
    }

    await safeUpdateTv(
      {
        enabled: true,
        playlist: nextPlaylist,
        playbackStopped: false,
        playNowItemId: targetId,
        playNowNonce: Date.now()
      },
      'Live Cricket Sports News ab Live Ground TV Screen par score ke saath chal rahi hai!',
      'Live News Active'
    );
  };

  const handlePlayNow = async (itemId: string, itemTitle: string) => {
    await safeUpdateTv(
      {
        enabled: true,
        playNowItemId: itemId,
        playNowNonce: Date.now(),
        playbackStopped: false
      },
      `"${itemTitle || 'Selected Item'}" ab Broadcast TV Card / Standby mein chal raha hai!`,
      'Playing & Saved'
    );
  };

  const handleStopPlayback = async () => {
    await safeUpdateTv(
      {
        playbackStopped: true,
        playNowItemId: ''
      },
      'Standby Playback Stop — TV Screen ab default Bat-Ball animation dikhayegi!',
      'Stopped & Saved'
    );
  };

  const handleResumePlayback = async () => {
    await safeUpdateTv(
      {
        enabled: liveMatchActive ? true : tvScreen.enabled,
        playbackStopped: false,
        playNowItemId: tvScreen.playlist?.[0]?.id || '',
        playNowNonce: Date.now()
      },
      'TV Standby Playlist ab chal rahi hai!',
      'Playing & Saved'
    );
  };

  const handleMoveItem = async (idx: number, direction: -1 | 1) => {
    const list = [...(tvScreen.playlist || [])];
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    await safeUpdateTv({ playlist: list }, 'Playlist ki tarteeb save ho gayi!', 'Order Saved');
  };

  const handleDeleteItem = async (itemId: string) => {
    const nextPlaylist = (tvScreen.playlist || []).filter((it) => it.id !== itemId);
    const patch: Partial<TvScreenConfig> = { playlist: nextPlaylist };
    if (tvScreen.playNowItemId === itemId) {
      patch.playNowItemId = '';
    }
    await safeUpdateTv(patch, 'Item playlist se delete aur save ho gaya!', 'Deleted & Saved');
  };

  const handleSaveItemDuration = async (itemId: string) => {
    const val = Math.max(3, Math.min(600, Math.round(Number(durationDrafts[itemId]) || 10)));
    const nextPlaylist = (tvScreen.playlist || []).map((it) =>
      it.id === itemId ? { ...it, durationSec: val } : it
    );
    await safeUpdateTv({ playlist: nextPlaylist }, `Duration ${val} seconds save ho gaya!`, 'Duration Saved');
  };

  const handleSaveSponsor = async () => {
    await safeUpdateTv(
      {
        sponsorName: sponsorNameInput.trim().slice(0, 80),
        sponsorLink: sponsorLinkInput.trim().slice(0, 500)
      },
      'TV Screen Sponsor info save ho gayi!',
      'Sponsor Saved'
    );
  };

  const handleQuickAddFromLibrary = async (libItem: MediaLibraryItem, playNow: boolean) => {
    const existingList = [...(tvScreen.playlist || [])];
    const existingIdx = existingList.findIndex((it) => it.url.trim() === libItem.url.trim());
    let targetId: string;

    if (existingIdx >= 0) {
      targetId = existingList[existingIdx].id;
    } else {
      if (existingList.length >= 20) {
        setFormError('Playlist mein maximum 20 items add kiye ja sakte hain.');
        return;
      }
      targetId = `tv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      existingList.push({
        id: targetId,
        mediaType: libItem.mediaType,
        url: libItem.url,
        title: libItem.title,
        durationSec: libItem.durationSec
      });
    }

    if (playNow) {
      await safeUpdateTv(
        {
          playlist: existingList,
          playbackStopped: false,
          playNowItemId: targetId,
          playNowNonce: Date.now(),
          ...(liveMatchActive ? { enabled: true } : {})
        },
        `"${libItem.title}" Media Library se Standby Broadcast par chal rahi hai!`,
        'Playing & Saved'
      );
    } else {
      await safeUpdateTv(
        { playlist: existingList, playbackStopped: false },
        `"${libItem.title}" Media Library se Standby Playlist mein add ho gayi!`,
        'Added & Saved'
      );
    }
  };

  const playlist = tvScreen.playlist || [];
  const fullScreenTakeover = Boolean(tvScreen.fullScreenTakeover);

  return (
    <div className="space-y-5">
      {/* 1. Master TV Screen & Broadcast Standby Controller */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Tv className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-black text-white tracking-tight">
                Broadcast TV &amp; Standby Controller
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  tvScreen.enabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : !liveMatchActive && playlist.length > 0 && !tvScreen.playbackStopped
                    ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {tvScreen.enabled
                  ? fullScreenTakeover
                    ? 'TV ON (FULL SCREEN TAKEOVER)'
                    : 'TV ON (BROADCAST TV CARD)'
                  : !liveMatchActive && playlist.length > 0 && !tvScreen.playbackStopped
                  ? 'STANDBY PLAYLIST ACTIVE'
                  : 'LIVE GROUND / BAT-BALL'}
              </span>
              {savedLabel && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-black text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{savedLabel}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {liveMatchActive
                ? 'Live match chal raha hai: Recorded videos/ads TV Card mein chalane ke liye "TV Screen ON" ya playlist mein "Play Now" dabayein.'
                : 'Abhi Broadcast TV Standby mode par hai: Neeche add ki gayi recorded videos / ads khud-ba-khud Broadcast aur Mobile Standby screen par chalengi (jab tak Stop (Bat-Ball) na dabayein).'}
            </p>
          </div>

          {/* Big Master TV Screen On/Off Button */}
          <button
            type="button"
            disabled={isSaving}
            onClick={handleToggleTvEnabled}
            className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 border transition-all shrink-0 disabled:opacity-50 ${
              tvScreen.enabled
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-300 shadow-lg shadow-rose-950/50'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-300 shadow-lg shadow-emerald-950/40'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{tvScreen.enabled ? 'TV Screen OFF Karein' : 'TV Screen ON Karein'}</span>
          </button>
        </div>

        {/* Playback Controls Strip: Stop/Play, Full Screen Takeover, Loop, Bat-Ball Gap, OBS Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Stop / Resume Bat-Ball Switch */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-300">Standby Playback</span>
            {tvScreen.playbackStopped ? (
              <button
                type="button"
                disabled={isSaving || playlist.length === 0}
                onClick={handleResumePlayback}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Play Standby</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleStopPlayback}
                className="px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-40"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop (Bat-Ball)</span>
              </button>
            )}
          </div>

          {/* Full Screen Takeover Switch (Default OFF) */}
          <button
            type="button"
            role="switch"
            aria-checked={fullScreenTakeover}
            disabled={isSaving}
            onClick={() =>
              safeUpdateTv(
                { fullScreenTakeover: !fullScreenTakeover },
                !fullScreenTakeover
                  ? 'Full Screen Takeover ON — TV ON par ab poori Broadcast screen TV dikhayegi!'
                  : 'Full Screen Takeover OFF — TV Screen ab sirf Broadcast TV Card ke andar chalegi!',
                'Takeover Saved'
              )
            }
            className={`p-3 rounded-xl border text-xs font-black flex items-center justify-between transition-all disabled:opacity-50 ${
              fullScreenTakeover
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
            title="Default OFF: Ads run inside the Broadcast TV Card. Turn ON only for full-page TV takeover."
          >
            <span className="flex items-center gap-2 text-left">
              <Maximize2 className="w-4 h-4 shrink-0" />
              <span>Full Screen Takeover</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-black/40 shrink-0">
              {fullScreenTakeover ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Loop Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={tvScreen.loop}
            disabled={isSaving}
            onClick={() =>
              safeUpdateTv(
                { loop: !tvScreen.loop },
                `TV Playlist Loop ${!tvScreen.loop ? 'ON' : 'OFF'} ho gaya!`,
                'Loop Saved'
              )
            }
            className={`p-3 rounded-xl border text-xs font-black flex items-center justify-between transition-all disabled:opacity-50 ${
              tvScreen.loop
                ? 'bg-violet-600/25 border-violet-400 text-violet-200'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            <span className="flex items-center gap-2">
              <Repeat className="w-4 h-4" />
              <span>Loop Playlist</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-black/40">
              {tvScreen.loop ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Bat-Ball Between Ads Toggle + Seconds */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={tvScreen.batBallBetweenAds}
              disabled={isSaving}
              onClick={() =>
                safeUpdateTv(
                  { batBallBetweenAds: !tvScreen.batBallBetweenAds },
                  `Clips ke beech Bat-Ball animation ${!tvScreen.batBallBetweenAds ? 'ON' : 'OFF'} ho gayi!`,
                  'Gap Saved'
                )
              }
              className="flex items-center gap-2 text-xs font-bold text-left min-w-0"
            >
              <Sparkles
                className={`w-4 h-4 shrink-0 ${
                  tvScreen.batBallBetweenAds ? 'text-amber-400' : 'text-slate-500'
                }`}
              />
              <span className={tvScreen.batBallBetweenAds ? 'text-amber-200' : 'text-slate-400'}>
                Bat-Ball Gap: {tvScreen.batBallBetweenAds ? 'ON' : 'OFF'}
              </span>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number"
                min={2}
                max={60}
                value={gapSecInput}
                onChange={(e) => setGapSecInput(Number(e.target.value))}
                className="w-12 bg-slate-900 border border-slate-700 rounded-md px-1.5 py-1 text-xs text-white text-center"
                title="Bat-Ball gap seconds"
              />
              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  safeUpdateTv(
                    { batBallGapSec: Math.max(2, Math.min(60, Math.round(gapSecInput) || 5)) },
                    `Bat-Ball gap ${Math.max(2, Math.min(60, Math.round(gapSecInput) || 5))}s save ho gaya!`,
                    'Gap Saved'
                  )
                }
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200"
              >
                s
              </button>
            </div>
          </div>

          {/* OBS Overlay TV Screen Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={tvScreen.obsEnabled}
            disabled={isSaving}
            onClick={() =>
              safeUpdateTv(
                { obsEnabled: !tvScreen.obsEnabled },
                `OBS Overlay TV Screen ${!tvScreen.obsEnabled ? 'ON' : 'OFF'} ho gaya!`,
                'OBS Saved'
              )
            }
            className={`p-3 rounded-xl border text-xs font-black flex items-center justify-between transition-all disabled:opacity-50 ${
              tvScreen.obsEnabled
                ? 'bg-sky-600/25 border-sky-400 text-sky-200'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>OBS Overlay TV</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-black/40">
              {tvScreen.obsEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* 1b. Quick 4 URL Slots for Live Screen */}
      <TvMultiUrlSlots
        tvScreen={tvScreen}
        isSaving={isSaving}
        liveMatchActive={liveMatchActive}
        onUpdateTvScreen={onUpdateTvScreen}
        onStatusMessage={onStatusMessage}
      />

      {/* 2. Recorded Media / Video / Image / YouTube Add Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Add Recorded Media / Video / Ad to Standby</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Apni recorded video file upload karein, direct Camera/Voice/Screen record karein, ya Image/Video/YouTube link lagayein.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                isFirebaseAdmin
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950 border-slate-700 text-slate-300'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>{isFirebaseAdmin ? 'Firebase Cloud Save Active' : 'Server Save Active'}</span>
            </span>
          </div>
        </div>

        {/* Type Selector Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'embed' as AddMediaTab, label: 'Live Stream / Embed URL', icon: Globe },
            { id: 'video' as AddMediaTab, label: 'Recorded Video Upload / URL', icon: Film },
            { id: 'record' as AddMediaTab, label: 'Record Live (Cam / Voice / Screen)', icon: Video },
            { id: 'image' as AddMediaTab, label: 'Image Upload / URL', icon: ImageIcon },
            { id: 'youtube' as AddMediaTab, label: 'YouTube Link', icon: Youtube },
            { id: 'news_feed' as AddMediaTab, label: 'Live Cricket News (TV Link)', icon: Newspaper }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={isRecording}
                onClick={() => {
                  setActiveTab(tab.id);
                  setUrlInput('');
                  setFormError(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all disabled:opacity-50 ${
                  active
                    ? tab.id === 'record'
                      ? 'bg-rose-600 text-white border-rose-400 shadow'
                      : tab.id === 'news_feed'
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow'
                      : 'bg-sky-600 text-white border-sky-400 shadow'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === 'news_feed' ? (
          <div className="bg-slate-950/90 border border-emerald-500/35 rounded-2xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">
                    Live Cricket Sports News Channel Link
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Is link ko Live Ground / Broadcast TV screen par lagane se viewers right screen par live cricket sports news (ESPNcricinfo/BBC/Admin News + breaking ticker) aur left side par compact Batting Now scorecard ek saath dekh sakte hain.
                </p>
              </div>
              <a
                href={liveNewsChannelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-sky-300 shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Preview Screen</span>
              </a>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <input
                type="text"
                readOnly
                value={liveNewsChannelUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
              />
              <button
                type="button"
                onClick={handleCopyNewsLink}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-black text-white flex items-center justify-center gap-1.5 shrink-0"
              >
                {newsCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-300" />}
                <span>{newsCopied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-6">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Channel Label
                </label>
                <input
                  type="text"
                  value={newsTitleInput}
                  onChange={(e) => setNewsTitleInput(e.target.value)}
                  placeholder="Live Cricket Sports News"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Slide Sec
                </label>
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={newsDurationInput}
                  onChange={(e) => setNewsDurationInput(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white text-center focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div className="md:col-span-4">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleAddAndPlayLiveNews}
                  className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-2 shadow disabled:opacity-40"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Starting...' : 'Add & Play on Live Ground Screen'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'record' ? (
          /* Direct In-Admin Studio Recorder (Camera+Mic / Voice Studio / Screen+Audio) */
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'camera' as RecordSourceMode, label: 'Camera + Mic', icon: Video },
                  { id: 'voice' as RecordSourceMode, label: 'Voice / Audio Clip', icon: Mic },
                  { id: 'screen' as RecordSourceMode, label: 'Screen + Audio', icon: Monitor }
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = recordMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isRecording || isSavingRecording}
                      onClick={() => setRecordMode(opt.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                        active
                          ? 'bg-amber-500/20 text-amber-200 border-amber-400'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {isRecording ? (
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/50 text-xs font-score font-black text-rose-300">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span>REC {formatTimer(recordingSec)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop Recording</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isSavingRecording}
                  onClick={handleStartRecording}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow disabled:opacity-40"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{recordedPreviewUrl ? 'Record New Clip' : 'Start Recording'}</span>
                </button>
              )}
            </div>

            {/* Live Recorder Feed */}
            {isRecording && (
              <div className="rounded-xl overflow-hidden bg-black border border-rose-500/40 aspect-video max-h-64 flex items-center justify-center">
                <video
                  ref={livePreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Recorded Clip Preview + 1-Click Save to Standby */}
            {!isRecording && recordedPreviewUrl && (
              <div className="space-y-3 border-t border-slate-800 pt-3">
                <div className="rounded-xl overflow-hidden bg-black border border-emerald-500/40 aspect-video max-h-64 flex items-center justify-center">
                  <video
                    src={recordedPreviewUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5">
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Recorded Clip Title
                    </label>
                    <input
                      type="text"
                      value={recordedTitle}
                      onChange={(e) => setRecordedTitle(e.target.value)}
                      placeholder="e.g. Studio Update / Sponsor Clip"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Duration (s)
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={600}
                      value={recordedDurationSec}
                      onChange={(e) => setRecordedDurationSec(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white text-center focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      disabled={isSavingRecording}
                      onClick={clearRecordedClip}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 disabled:opacity-40"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retake</span>
                    </button>
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      disabled={isSavingRecording || isSaving}
                      onClick={handleSaveRecordedClipToStandby}
                      className="w-full px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow disabled:opacity-40"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingRecording ? 'Saving...' : 'Save to Standby'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!isRecording && !recordedPreviewUrl && (
              <p className="text-[11px] text-slate-400">
                Camera + Mic se video message, Voice / Audio Clip se mic recording (animated studio background ke saath), ya Screen + Audio record karke seedha Broadcast TV Standby par lagayein.
              </p>
            )}
          </div>
        ) : (
          /* Upload Button (for Image or Video) + URL Input + Title + Duration */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {activeTab !== 'youtube' && activeTab !== 'embed' && (
              <div className="md:col-span-3">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  {activeTab === 'image' ? 'Image File Upload' : 'Recorded Video Upload (max 60MB)'}
                </label>
                <label
                  className={`w-full px-3 py-2 rounded-xl border border-dashed text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    isUploading
                      ? 'bg-slate-800 border-slate-600 text-slate-400 cursor-wait'
                      : 'bg-slate-950 hover:bg-slate-800 border-sky-500/50 text-sky-300'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Uploading...' : activeTab === 'image' ? 'Choose Image' : 'Choose Video'}</span>
                  <input
                    type="file"
                    accept={
                      activeTab === 'image'
                        ? 'image/*'
                        : 'video/mp4,video/webm,video/ogg,video/quicktime,video/*,.mp4,.webm,.mov,.m4v,.mkv'
                    }
                    disabled={isUploading || isSaving}
                    onChange={(e) => handleFileUpload(e, activeTab === 'image' ? 'image' : 'video')}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            <div className={activeTab === 'youtube' || activeTab === 'embed' ? 'md:col-span-6' : 'md:col-span-4'}>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                {activeTab === 'youtube'
                  ? 'YouTube Video Link (watch, youtu.be, shorts)'
                  : activeTab === 'embed'
                  ? 'Live Match / Stream Player Embed URL'
                  : activeTab === 'image'
                  ? 'Image URL (auto-fills on upload)'
                  : 'Video URL (auto-fills on upload)'}
              </label>
              <input
                type="text"
                placeholder={
                  activeTab === 'youtube'
                    ? 'https://youtube.com/watch?v=... , youtu.be/... ya /shorts/...'
                    : activeTab === 'embed'
                    ? 'https://... live stream player ya channel embed URL dalein'
                    : 'https://... ya upload button dabayein'
                }
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (formError) setFormError(null);
                }}
                className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none ${
                  formError ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-sky-400'
                }`}
              />
            </div>

            <div className={activeTab === 'youtube' || activeTab === 'embed' ? 'md:col-span-3' : 'md:col-span-2'}>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Title (Optional)
              </label>
              <input
                type="text"
                placeholder="Standby Clip Name"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
              />
            </div>

            <div className="md:col-span-1">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Sec
              </label>
              <input
                type="number"
                min={3}
                max={600}
                value={durationInput}
                onChange={(e) => setDurationInput(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white text-center focus:outline-none focus:border-sky-400"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="button"
                disabled={isSaving || isUploading}
                onClick={handleAddPlaylistItem}
                className="w-full px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Add to Standby'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Clear Inline Error Message when URL or Save Fails */}
        {formError && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/60 text-xs font-semibold text-rose-200 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{formError}</span>
          </div>
        )}
      </div>

      {/* 2b. Quick Pick from Firebase Media Library */}
      {mediaLibrary.length > 0 && (
        <div className="bg-slate-900 border border-indigo-500/35 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Quick Pick from Media Library ({mediaLibrary.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              1 click mein saved Firebase videos ko Standby par lagayein
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {mediaLibrary.slice(0, 9).map((libItem) => {
              const alreadyInPlaylist = playlist.some((p) => p.url.trim() === libItem.url.trim());
              return (
                <div
                  key={libItem.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{libItem.title}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                      <span className="uppercase font-bold text-indigo-300">{libItem.mediaType}</span>
                      <span>•</span>
                      <span>{libItem.durationSec}s</span>
                      {libItem.category && (
                        <>
                          <span>•</span>
                          <span>{libItem.category}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!alreadyInPlaylist && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleQuickAddFromLibrary(libItem, false)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-bold border border-slate-700 disabled:opacity-40"
                        title="Add to Standby Playlist"
                      >
                        + Add
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleQuickAddFromLibrary(libItem, true)}
                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black flex items-center gap-1 disabled:opacity-40"
                    >
                      <Play className="w-2.5 h-2.5" />
                      <span>Play</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Playlist Manager (Reorder, Duration, Play Now, Delete) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              TV &amp; Standby Playlist ({playlist.length} {playlist.length === 1 ? 'Item' : 'Items'})
            </h3>
            {savedLabel && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-bold text-emerald-300">
                <CheckCircle2 className="w-3 h-3" />
                <span>Saved</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!liveMatchActive && !tvScreen.playbackStopped && playlist.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-[10px] font-bold text-emerald-300">
                Broadcast Standby Par Chal Rahi Hai
              </span>
            )}
            {liveMatchActive && !tvScreen.enabled && playlist.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/35 text-[10px] font-bold text-sky-300">
                Live Match Active — Play Now dabayein ya TV ON karein
              </span>
            )}
            {tvScreen.playbackStopped && playlist.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[10px] font-black text-amber-300 uppercase">
                Stopped (Bat-Ball Active)
              </span>
            )}
          </div>
        </div>

        {playlist.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-950 border border-dashed border-slate-800 text-xs text-slate-400">
            Standby playlist abhi khali hai — jab tak koi recorded video, image ya link add nahi hota, Broadcast TV Standby par default Cricket Bat &amp; Ball animation chalegi.
          </div>
        ) : (
          <div className="space-y-2">
            {playlist.map((item, idx) => {
              const isPlayingNow =
                !tvScreen.playbackStopped &&
                ((tvScreen.enabled && tvScreen.playNowItemId === item.id) ||
                  (!liveMatchActive && idx === 0 && !tvScreen.playNowItemId));
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isPlayingNow
                      ? 'bg-emerald-950/30 border-emerald-500/50'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-200 text-xs font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                        item.mediaType === 'news_feed'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                          : item.mediaType === 'embed'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/35'
                          : item.mediaType === 'youtube'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : item.mediaType === 'video'
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      {item.mediaType === 'news_feed'
                        ? 'LIVE NEWS'
                        : item.mediaType === 'embed'
                        ? 'LIVE EMBED'
                        : item.mediaType}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {item.title || 'Untitled Item'}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-md">
                        {item.url}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {/* Duration Edit */}
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                      <input
                        type="number"
                        min={3}
                        max={600}
                        value={durationDrafts[item.id] ?? item.durationSec}
                        onChange={(e) =>
                          setDurationDrafts((prev) => ({
                            ...prev,
                            [item.id]: Number(e.target.value)
                          }))
                        }
                        className="w-12 bg-transparent text-xs text-white text-center focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400">s</span>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveItemDuration(item.id)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-sky-300"
                      >
                        Set
                      </button>
                    </div>

                    {/* Play Now (plays inside Broadcast TV card / Standby immediately) */}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handlePlayNow(item.id, item.title)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1 disabled:opacity-40"
                    >
                      <Play className="w-3 h-3" />
                      <span>Play Now</span>
                    </button>

                    {/* Reorder Up / Down */}
                    <button
                      type="button"
                      disabled={isSaving || idx === 0}
                      onClick={() => handleMoveItem(idx, -1)}
                      aria-label="Move up"
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isSaving || idx === playlist.length - 1}
                      onClick={() => handleMoveItem(idx, 1)}
                      aria-label="Move down"
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleDeleteItem(item.id)}
                      aria-label="Delete item"
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Optional Sponsor Name & Link */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="pb-2 border-b border-slate-800">
          <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-amber-400" />
            <span>TV Screen Sponsor (Optional)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Agar sponsor ka naam aur website link dalenge to TV bezel ke bottom bar par dikhega (khali chhodne par hide rahega).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Sponsor Name
            </label>
            <input
              type="text"
              placeholder="e.g. Brand X"
              value={sponsorNameInput}
              onChange={(e) => setSponsorNameInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <div className="md:col-span-5">
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Sponsor Link (Optional)
            </label>
            <input
              type="url"
              placeholder="https://sponsor-website.com"
              value={sponsorLinkInput}
              onChange={(e) => setSponsorLinkInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveSponsor}
              className="w-full px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
