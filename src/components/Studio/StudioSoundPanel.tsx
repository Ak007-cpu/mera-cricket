import React, { useEffect, useState } from 'react';
import { SoundCustomUrls, SoundSettingsConfig } from '../../types/cricket';
import { uploadAudioAsset, isFirebaseAdminSignedIn } from '../../services/firebaseContentService';
import {
  buildApiUrl,
  DefaultAudioAssetInfo,
  fetchDefaultAudioAssets
} from '../../services/api';
import {
  audioController,
  CricketEffectType,
  DEFAULT_AUDIO_ASSETS
} from '../../utils/AudioController';
import {
  isSpeechSynthesisSupported,
  speakFemaleBallCall,
  warmUpSpeechSynthesis
} from '../../utils/femaleVoiceAnnouncer';
import {
  Volume2,
  VolumeX,
  Power,
  Tv,
  Upload,
  Play,
  Square,
  RotateCcw,
  Save,
  Sliders,
  Music2,
  FolderOpen,
  CheckCircle2,
  Cloud,
  Mic,
  Gauge
} from 'lucide-react';

interface StudioSoundPanelProps {
  soundSettings: SoundSettingsConfig;
  adminPin: string;
  isSaving: boolean;
  onUpdateSoundSettings: (patch: Partial<SoundSettingsConfig>, successText: string) => Promise<void>;
  onStatusMessage: (msg: { text: string; type: 'success' | 'error' }) => void;
}

type AudioSlotKey = 'four' | 'six' | 'wicket' | 'crowd';

interface AudioSlotMeta {
  key: AudioSlotKey;
  urlField: keyof SoundCustomUrls;
  title: string;
  desc: string;
  placeholderPath: string;
  badgeColor: string;
}

const AUDIO_SLOTS: AudioSlotMeta[] = [
  {
    key: 'four',
    urlField: 'fourUrl',
    title: 'Four (4) Boundary Sound',
    desc: 'Bat crack + outfield bounce + modest applause & crowd cheer.',
    placeholderPath: DEFAULT_AUDIO_ASSETS.four,
    badgeColor: 'text-sky-300 border-sky-500/30 bg-sky-500/10'
  },
  {
    key: 'six',
    urlField: 'sixUrl',
    title: 'Six (6) Maximum Sound',
    desc: 'Heavy sweet-spot bat smash + stadium roar & energetic applause.',
    placeholderPath: DEFAULT_AUDIO_ASSETS.six,
    badgeColor: 'text-amber-300 border-amber-500/30 bg-amber-500/10'
  },
  {
    key: 'wicket',
    urlField: 'wicketUrl',
    title: 'Wicket Shatter Sound',
    desc: 'Timber stump clatter + dramatic crowd gasp & cheer swell.',
    placeholderPath: DEFAULT_AUDIO_ASSETS.wicket,
    badgeColor: 'text-rose-300 border-rose-500/30 bg-rose-500/10'
  },
  {
    key: 'crowd',
    urlField: 'crowdUrl',
    title: 'Crowd Ambience (Seamless Loop)',
    desc: 'Continuous stadium crowd murmur played when match is live (swells on 4/6/W).',
    placeholderPath: DEFAULT_AUDIO_ASSETS.crowd,
    badgeColor: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
  }
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export const StudioSoundPanel: React.FC<StudioSoundPanelProps> = ({
  soundSettings,
  adminPin,
  isSaving,
  onUpdateSoundSettings,
  onStatusMessage
}) => {
  const [effectsVol, setEffectsVol] = useState<number>(soundSettings.effectsVolume ?? 80);
  const [crowdVol, setCrowdVol] = useState<number>(soundSettings.crowdVolume ?? 28);
  const [voiceRate, setVoiceRate] = useState<number>(soundSettings.voiceRate ?? 1.05);
  const [voiceVol, setVoiceVol] = useState<number>(soundSettings.voiceVolume ?? 90);
  const [urlDrafts, setUrlDrafts] = useState<SoundCustomUrls>({
    fourUrl: soundSettings.customSounds?.fourUrl || '',
    sixUrl: soundSettings.customSounds?.sixUrl || '',
    wicketUrl: soundSettings.customSounds?.wicketUrl || '',
    crowdUrl: soundSettings.customSounds?.crowdUrl || ''
  });
  const [uploadingSlot, setUploadingSlot] = useState<AudioSlotKey | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<AudioSlotKey | null>(null);
  const [isTestingCrowd, setIsTestingCrowd] = useState(false);
  const [defaultAssets, setDefaultAssets] = useState<Record<string, DefaultAudioAssetInfo>>({});
  const speechSupported = isSpeechSynthesisSupported();

  useEffect(() => {
    setEffectsVol(soundSettings.effectsVolume ?? 80);
    setCrowdVol(soundSettings.crowdVolume ?? 28);
    setVoiceRate(soundSettings.voiceRate ?? 1.05);
    setVoiceVol(soundSettings.voiceVolume ?? 90);
    setUrlDrafts({
      fourUrl: soundSettings.customSounds?.fourUrl || '',
      sixUrl: soundSettings.customSounds?.sixUrl || '',
      wicketUrl: soundSettings.customSounds?.wicketUrl || '',
      crowdUrl: soundSettings.customSounds?.crowdUrl || ''
    });
  }, [soundSettings]);

  useEffect(() => {
    let mounted = true;
    fetchDefaultAudioAssets().then((list) => {
      if (!mounted) return;
      const map: Record<string, DefaultAudioAssetInfo> = {};
      for (const item of list) {
        map[item.key] = item;
      }
      setDefaultAssets(map);
    });
    return () => {
      mounted = false;
      audioController.stopAll();
    };
  }, []);

  const handleToggleMaster = async () => {
    const next = !soundSettings.enabled;
    await onUpdateSoundSettings(
      { enabled: next },
      next
        ? 'Broadcast & Mobile Sound ON — Viewers can unmute from the Broadcast speaker bar.'
        : 'Broadcast & Mobile Sound OFF — Effects and crowd audio muted globally.'
    );
  };

  const handleToggleObsSound = async () => {
    const next = !soundSettings.obsEnabled;
    await onUpdateSoundSettings(
      { obsEnabled: next },
      next
        ? 'OBS Overlay Sound ON — (?view=overlay) will play cricket audio & crowd.'
        : 'OBS Overlay Sound OFF — (?view=overlay) is now muted.'
    );
  };

  const handleSaveVolumes = async () => {
    const cleanEffects = Math.max(0, Math.min(100, Math.round(effectsVol)));
    const cleanCrowd = Math.max(0, Math.min(100, Math.round(crowdVol)));
    const cleanRate = Math.round(Math.max(0.6, Math.min(1.6, voiceRate)) * 100) / 100;
    const cleanVoiceVol = Math.max(0, Math.min(100, Math.round(voiceVol)));
    await onUpdateSoundSettings(
      {
        effectsVolume: cleanEffects,
        crowdVolume: cleanCrowd,
        voiceRate: cleanRate,
        voiceVolume: cleanVoiceVol
      },
      `Audio & Voice settings saved (Effects ${cleanEffects}%, Crowd ${cleanCrowd}%, Voice ${cleanRate.toFixed(2)}x @ ${cleanVoiceVol}%).`
    );
  };

  const handleTestVoiceCall = (eventType: 'four' | 'six' | 'wicket' | 'single') => {
    warmUpSpeechSynthesis();
    speakFemaleBallCall(eventType, {
      batterName: eventType === 'wicket' ? 'Rizwan' : 'Babar',
      rate: voiceRate,
      volume01: Math.max(0, Math.min(1, voiceVol / 100))
    });
  };

  const voicePaceLabel =
    voiceRate <= 0.88
      ? 'Calm / Relaxed'
      : voiceRate <= 1.12
      ? 'Natural Broadcast'
      : voiceRate <= 1.32
      ? 'Crisp / Fast'
      : 'T20 Rush';

  const handlePreviewEffect = async (type: CricketEffectType) => {
    await audioController.unlock();
    const url =
      type === 'four'
        ? urlDrafts.fourUrl || soundSettings.customSounds?.fourUrl
        : type === 'six'
        ? urlDrafts.sixUrl || soundSettings.customSounds?.sixUrl
        : type === 'wicket'
        ? urlDrafts.wicketUrl || soundSettings.customSounds?.wicketUrl
        : undefined;
    await audioController.playEffect(type, Math.max(0.1, effectsVol / 100), url, {
      bypassMute: true
    });
  };

  const handleToggleTestCrowd = async () => {
    if (isTestingCrowd) {
      audioController.setCrowdAmbience(false, 0, undefined, { bypassMute: true });
      setIsTestingCrowd(false);
      return;
    }
    await audioController.unlock();
    setIsTestingCrowd(true);
    const url = urlDrafts.crowdUrl || soundSettings.customSounds?.crowdUrl;
    await audioController.setCrowdAmbience(true, Math.max(0.1, crowdVol / 100), url, {
      bypassMute: true
    });
    setTimeout(() => {
      audioController.setCrowdAmbience(false, 0, undefined, { bypassMute: true });
      setIsTestingCrowd(false);
    }, 3500);
  };

  const processAudioUpload = async (file: File, slot: AudioSlotMeta) => {
    const validExt = /\.(mp3|wav|ogg|webm|m4a|aac)$/i.test(file.name);
    const validMime = file.type.startsWith('audio/');
    if (!validMime && !validExt) {
      onStatusMessage({
        text: 'Unsupported file type. Please upload an MP3, WAV, OGG, M4A, AAC, or WEBM audio file.',
        type: 'error'
      });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      onStatusMessage({
        text: 'Audio file must be under 3 MB so Broadcast & OBS load fast.',
        type: 'error'
      });
      return;
    }

    setUploadingSlot(slot.key);
    try {
      const res = await uploadAudioAsset(file, slot.key, adminPin);
      audioController.invalidateCache(res.url);
      const nextCustom: SoundCustomUrls = {
        ...(soundSettings.customSounds || {}),
        [slot.urlField]: res.url
      };
      setUrlDrafts((prev) => ({ ...prev, [slot.urlField]: res.url }));
      await onUpdateSoundSettings(
        { customSounds: nextCustom },
        `${slot.title} replaced (${res.storedInFirebase ? 'Firebase Storage' : 'Server Audio Media'}) and synced live!`
      );
      audioController.preloadAssets({ [slot.key]: res.url });
    } catch (err: any) {
      onStatusMessage({
        text: err?.message || 'Audio upload failed',
        type: 'error'
      });
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleUploadSlot = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: AudioSlotMeta
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await processAudioUpload(file, slot);
  };

  const handleDropOnSlot = async (
    e: React.DragEvent<HTMLDivElement>,
    slot: AudioSlotMeta
  ) => {
    e.preventDefault();
    setDragOverSlot(null);
    if (uploadingSlot || isSaving) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processAudioUpload(file, slot);
    }
  };

  const handleSaveSlotUrl = async (slot: AudioSlotMeta) => {
    const cleanUrl = (urlDrafts[slot.urlField] || '').trim();
    audioController.invalidateCache(cleanUrl || slot.placeholderPath);
    const nextCustom: SoundCustomUrls = {
      ...(soundSettings.customSounds || {}),
      [slot.urlField]: cleanUrl
    };
    await onUpdateSoundSettings(
      { customSounds: nextCustom },
      cleanUrl
        ? `${slot.title} URL saved!`
        : `${slot.title} restored to ${slot.placeholderPath} placeholder.`
    );
  };

  const handleResetSlot = async (slot: AudioSlotMeta) => {
    audioController.invalidateCache(soundSettings.customSounds?.[slot.urlField]);
    setUrlDrafts((prev) => ({ ...prev, [slot.urlField]: '' }));
    const nextCustom: SoundCustomUrls = {
      ...(soundSettings.customSounds || {}),
      [slot.urlField]: ''
    };
    await onUpdateSoundSettings(
      { customSounds: nextCustom },
      `${slot.title} restored to default placeholder (${slot.placeholderPath}).`
    );
  };

  const firebaseSignedIn = isFirebaseAdminSignedIn();

  return (
    <div className="space-y-5">
      {/* 1. Master Sound Controls (Broadcast/Mobile + OBS Separate Toggle) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Volume2 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-black text-white tracking-tight">
                Match Sound Effects &amp; Crowd Audio
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  soundSettings.enabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {soundSettings.enabled ? 'SOUND ENABLED' : 'MUTED GLOBALLY'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Plays synchronized Four, Six, Wicket, Bat-on-Ball, Umpire Signal &amp; Crowd Roar cues + live crowd ambience. Audio pauses automatically when TV ads or Hold Screen videos play.
            </p>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleToggleMaster}
            className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all shrink-0 disabled:opacity-50 ${
              soundSettings.enabled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-300 shadow-lg shadow-emerald-950/40'
                : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-300 shadow-lg shadow-rose-950/40'
            }`}
          >
            {soundSettings.enabled ? <Power className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundSettings.enabled ? 'Master Sound: ON' : 'Master Sound: OFF'}</span>
          </button>
        </div>

        {/* Separate OBS Sound Toggle */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <Tv className={`w-5 h-5 shrink-0 ${soundSettings.obsEnabled ? 'text-purple-400' : 'text-slate-500'}`} />
            <div>
              <div className="text-xs font-black text-white">Separate OBS Overlay Audio (?view=overlay)</div>
              <div className="text-[11px] text-slate-400">
                Independent switch for OBS Browser Source — turn OFF if you want OBS silent while Broadcast plays audio.
              </div>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={soundSettings.obsEnabled}
            disabled={isSaving}
            onClick={handleToggleObsSound}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border transition-all shrink-0 disabled:opacity-50 ${
              soundSettings.obsEnabled
                ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-300'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {soundSettings.obsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>OBS Sound: {soundSettings.obsEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Volume Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                Effects Volume (4 / 6 / Wicket / Match Cues)
              </span>
              <span className="font-score font-black text-sky-300">{effectsVol}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={effectsVol}
              onChange={(e) => setEffectsVol(Number(e.target.value))}
              className="w-full accent-sky-400 cursor-pointer"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => handlePreviewEffect('four')}
                className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 text-xs font-bold flex items-center gap-1"
              >
                <Play className="w-3 h-3" /> Test Four
              </button>
              <button
                type="button"
                onClick={() => handlePreviewEffect('six')}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-slate-950 border border-amber-400/40 text-xs font-bold flex items-center gap-1"
              >
                <Play className="w-3 h-3" /> Test Six
              </button>
              <button
                type="button"
                onClick={() => handlePreviewEffect('wicket')}
                className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 text-xs font-bold flex items-center gap-1"
              >
                <Play className="w-3 h-3" /> Test Wicket
              </button>
              <button
                type="button"
                onClick={() => handlePreviewEffect('bat-on-ball')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 text-xs font-bold flex items-center gap-1"
              >
                <Play className="w-3 h-3" /> Bat-on-Ball
              </button>
              <button
                type="button"
                onClick={() => handlePreviewEffect('umpire-wide')}
                className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600 text-cyan-200 hover:text-white border border-cyan-500/40 text-xs font-bold flex items-center gap-1"
              >
                <Play className="w-3 h-3" /> Umpire Signal
              </button>
              <button
                type="button"
                onClick={() => handlePreviewEffect('crowd-roar')}
                className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-bold flex items-center gap-1"
              >
                <Play className="w-3 h-3" /> Crowd Roar
              </button>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Music2 className="w-3.5 h-3.5 text-emerald-400" />
                Background Crowd Ambience Volume
              </span>
              <span className="font-score font-black text-emerald-300">{crowdVol}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={crowdVol}
              onChange={(e) => setCrowdVol(Number(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleToggleTestCrowd}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                  isTestingCrowd
                    ? 'bg-rose-600 text-white border-rose-400'
                    : 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-200 hover:text-white border-emerald-500/40'
                }`}
              >
                {isTestingCrowd ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{isTestingCrowd ? 'Stop Crowd Test' : 'Test Crowd (3.5s)'}</span>
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveVolumes}
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save All Audio</span>
              </button>
            </div>
          </div>
        </div>

        {/* Web Speech Voice Announcements (Speed & Volume) */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Mic className="w-4 h-4 text-fuchsia-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Web Speech Voice Alerts (Pace &amp; Volume)
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300">
                  {voicePaceLabel}
                </span>
                {!speechSupported && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-amber-500/30 bg-amber-500/10 text-amber-300">
                    Speech API unavailable in this browser
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Tune the synthesized female commentary speed and volume for Four, Six, Wicket &amp; Run announcements to match live match pacing.
              </p>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveVolumes}
              className="px-4 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Voice Settings</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Voice Playback Speed Slider */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-fuchsia-400" />
                  Voice Playback Speed (Pace)
                </span>
                <span className="font-score font-black text-fuchsia-300">
                  {voiceRate.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                aria-label="Web Speech Voice Playback Speed"
                min={0.6}
                max={1.6}
                step={0.05}
                value={voiceRate}
                onChange={(e) => setVoiceRate(Number(e.target.value))}
                className="w-full accent-fuchsia-400 cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                <span>0.60x Slow</span>
                <span>1.05x Natural</span>
                <span>1.60x Fast</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { label: '0.85x Calm', val: 0.85 },
                  { label: '1.05x Natural', val: 1.05 },
                  { label: '1.25x Fast', val: 1.25 },
                  { label: '1.45x T20 Rush', val: 1.45 }
                ].map((preset) => {
                  const active = Math.abs(voiceRate - preset.val) < 0.03;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setVoiceRate(preset.val)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                        active
                          ? 'bg-fuchsia-600 text-white border-fuchsia-400'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Voice Volume Slider */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-fuchsia-400" />
                  Voice Announcement Volume
                </span>
                <span className="font-score font-black text-fuchsia-300">{voiceVol}%</span>
              </div>
              <input
                type="range"
                aria-label="Web Speech Voice Volume"
                min={0}
                max={100}
                step={1}
                value={voiceVol}
                onChange={(e) => setVoiceVol(Number(e.target.value))}
                className="w-full accent-fuchsia-400 cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                <span>0% Mute Voice</span>
                <span>50% Balanced</span>
                <span>100% Max</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={!speechSupported || voiceVol <= 0}
                  onClick={() => handleTestVoiceCall('four')}
                  className="px-2.5 py-1 rounded-md bg-blue-600/20 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 text-[11px] font-bold flex items-center gap-1 disabled:opacity-40"
                >
                  <Play className="w-3 h-3" /> Voice: Four
                </button>
                <button
                  type="button"
                  disabled={!speechSupported || voiceVol <= 0}
                  onClick={() => handleTestVoiceCall('six')}
                  className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-slate-950 border border-amber-400/40 text-[11px] font-bold flex items-center gap-1 disabled:opacity-40"
                >
                  <Play className="w-3 h-3" /> Voice: Six
                </button>
                <button
                  type="button"
                  disabled={!speechSupported || voiceVol <= 0}
                  onClick={() => handleTestVoiceCall('wicket')}
                  className="px-2.5 py-1 rounded-md bg-rose-600/20 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 disabled:opacity-40"
                >
                  <Play className="w-3 h-3" /> Voice: Wicket
                </button>
                <button
                  type="button"
                  disabled={!speechSupported || voiceVol <= 0}
                  onClick={() => handleTestVoiceCall('single')}
                  className="px-2.5 py-1 rounded-md bg-emerald-600/20 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 disabled:opacity-40"
                >
                  <Play className="w-3 h-3" /> Voice: 1 Run
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Assets Folder Placeholder Files & Admin Replacement Manager */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Audio Assets Manager (<code className="text-sky-300 lowercase">/Assets</code> Folder &amp; Replacements)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              High-quality lightweight MP3 files in <code className="text-slate-300">Assets/</code> serve as default placeholders. Upload or drag &amp; drop an audio file (&lt; 3 MB) on any slot to replace it, or restore the default asset anytime.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold shrink-0 border-slate-700 bg-slate-950 text-slate-300">
            <Cloud className={`w-3.5 h-3.5 ${firebaseSignedIn ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span>
              {firebaseSignedIn ? 'Uploads synced to Firebase Storage' : 'Uploads saved to Server Storage'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AUDIO_SLOTS.map((slot) => {
            const currentUrl = urlDrafts[slot.urlField] || '';
            const savedUrl = (soundSettings.customSounds?.[slot.urlField] || '').trim();
            const isCustom = Boolean(savedUrl);
            const isUploading = uploadingSlot === slot.key;
            const isDragOver = dragOverSlot === slot.key;
            const assetMeta = defaultAssets[slot.key];
            const activePlaybackUrl = buildApiUrl(savedUrl || slot.placeholderPath);

            return (
              <div
                key={slot.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isUploading && !isSaving) setDragOverSlot(slot.key);
                }}
                onDragLeave={() => setDragOverSlot((cur) => (cur === slot.key ? null : cur))}
                onDrop={(e) => handleDropOnSlot(e, slot)}
                className={`bg-slate-950 border rounded-xl p-4 space-y-3 transition-colors ${
                  isDragOver
                    ? 'border-sky-400 ring-2 ring-sky-400/30 bg-sky-950/20'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-black text-white">{slot.title}</div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{slot.desc}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 flex items-center gap-1 ${
                      isCustom
                        ? slot.badgeColor
                        : 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {isCustom ? 'Replaced' : 'Assets Placeholder'}
                  </span>
                </div>

                {/* Default Placeholder Asset Info + Inline Audio Preview */}
                <div className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-slate-300 truncate">
                      Default: <span className="text-sky-300">{slot.placeholderPath}</span>
                    </span>
                    <span className="font-score text-slate-400 shrink-0">
                      {assetMeta?.exists ? formatBytes(assetMeta.sizeBytes) : 'MP3'}
                    </span>
                  </div>
                  <audio
                    key={activePlaybackUrl}
                    controls
                    preload="metadata"
                    src={activePlaybackUrl}
                    className="w-full h-8 opacity-90"
                  />
                </div>

                {/* Custom URL Override */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Active: ${slot.placeholderPath} (or paste custom URL)`}
                    value={currentUrl}
                    onChange={(e) =>
                      setUrlDrafts((prev) => ({ ...prev, [slot.urlField]: e.target.value }))
                    }
                    className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                  />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveSlotUrl(slot)}
                    className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shrink-0 disabled:opacity-40"
                  >
                    Save URL
                  </button>
                </div>

                {/* Replace File / Preview / Restore Actions */}
                <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                  <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      {isUploading
                        ? 'Uploading...'
                        : isCustom
                        ? 'Replace Custom Audio (<3MB)'
                        : 'Replace Placeholder (<3MB)'}
                    </span>
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a,.aac"
                      disabled={isUploading || isSaving}
                      onChange={(e) => handleUploadSlot(e, slot)}
                      className="hidden"
                    />
                  </label>

                  <div className="flex items-center gap-1.5">
                    {slot.key !== 'crowd' ? (
                      <button
                        type="button"
                        onClick={() => handlePreviewEffect(slot.key as CricketEffectType)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" /> Test SFX
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleToggleTestCrowd}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" /> Test Loop
                      </button>
                    )}

                    {isCustom && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleResetSlot(slot)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1"
                        title={`Restore ${slot.placeholderPath}`}
                      >
                        <RotateCcw className="w-3 h-3" /> Restore Placeholder
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
