import { buildApiUrl } from '../services/api';

export type AudioAssetSlot = 'four' | 'six' | 'wicket' | 'crowd';
export type CricketCueType =
  | 'four'
  | 'six'
  | 'wicket'
  | 'bat-on-ball'
  | 'dot'
  | 'umpire-wide'
  | 'umpire-noball'
  | 'umpire-break'
  | 'umpire-signal'
  | 'crowd-roar';
export type CricketEffectType = CricketCueType;
export type AudioViewMode = 'broadcast' | 'mobile' | 'obs' | 'test';

export const AUDIO_PREFS_STORAGE_KEY = 'cricket_audio_preferences';
export const LEGACY_VOLUME_STORAGE_KEY = 'cricket_viewer_sound_volume';
export const AUDIO_PREFS_EVENT = 'cricket-audio-prefs-changed';

export const DEFAULT_AUDIO_ASSETS: Record<AudioAssetSlot, string> = {
  four: '/Assets/four.mp3',
  six: '/Assets/six.mp3',
  wicket: '/Assets/wicket.mp3',
  crowd: '/Assets/crowd.mp3'
};

export interface StoredAudioPreferences {
  muted: boolean;
  effectsVolume: number; // 0..100
  crowdVolume: number;   // 0..100
}

export interface PlayEffectOptions {
  /** Only true for explicit Studio Admin / Test audition buttons */
  bypassMute?: boolean;
  /** Cross-fade overlap duration in seconds (default 0.14s) */
  crossFadeSec?: number;
  /** View mode used to interpret default mute when localStorage has no entry yet */
  mode?: AudioViewMode;
}

export interface CrowdAmbienceOptions {
  /** Only true for Studio Admin "Test Loop" button */
  bypassMute?: boolean;
  /** View mode used to interpret default mute when localStorage has no entry yet */
  mode?: AudioViewMode;
}

function clampPct(val: unknown, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function hasStoredAudioPrefs(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(AUDIO_PREFS_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function readStoredAudioPrefs(mode: AudioViewMode = 'broadcast'): StoredAudioPreferences {
  let legacyVol = 85;
  try {
    const rawLegacy = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_VOLUME_STORAGE_KEY) : null;
    if (rawLegacy !== null) {
      legacyVol = clampPct(rawLegacy, 85);
    }
  } catch {}

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(AUDIO_PREFS_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          muted: typeof parsed.muted === 'boolean' ? parsed.muted : mode !== 'obs',
          effectsVolume: clampPct(parsed.effectsVolume, legacyVol),
          crowdVolume: clampPct(parsed.crowdVolume, 75)
        };
      }
    }
  } catch {}

  return {
    muted: mode !== 'obs',
    effectsVolume: legacyVol,
    crowdVolume: 75
  };
}

export function writeStoredAudioPrefs(prefs: StoredAudioPreferences): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUDIO_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUDIO_PREFS_EVENT, { detail: prefs }));
    }
  } catch {}
}

function resolveAudioUrl(rawUrl?: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) {
    return buildApiUrl(trimmed);
  }
  return trimmed;
}

function buildEqualPowerFadeIn(steps = 24): Float32Array<ArrayBuffer> {
  const buf = new ArrayBuffer(steps * 4);
  const arr = new Float32Array(buf);
  for (let i = 0; i < steps; i++) {
    const phase = (i / (steps - 1)) * (Math.PI * 0.5);
    arr[i] = Math.sin(phase);
  }
  return arr;
}

function buildEqualPowerFadeOut(steps = 24): Float32Array<ArrayBuffer> {
  const buf = new ArrayBuffer(steps * 4);
  const arr = new Float32Array(buf);
  for (let i = 0; i < steps; i++) {
    const phase = (i / (steps - 1)) * (Math.PI * 0.5);
    arr[i] = Math.cos(phase);
  }
  return arr;
}

const FADE_IN_CURVE = buildEqualPowerFadeIn(24);
const FADE_OUT_CURVE = buildEqualPowerFadeOut(24);

interface ActiveEffectVoice {
  id: number;
  gainNode: GainNode;
  stopNodes: () => void;
  fadeTimer: ReturnType<typeof setTimeout> | null;
  endTimer: ReturnType<typeof setTimeout> | null;
}

interface CrowdDeckNode {
  source: AudioBufferSourceNode;
  gain: GainNode;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Central Web Audio API controller handling:
 * - Equal-power / linear cross-fades between match event SFX (Four, Six, Wicket)
 * - Dual-deck seamless overlapping crowd ambience looping with trimmed MP3 boundaries
 * - Automatic enforcement of localStorage mute state across Broadcast, Mobile, and OBS views
 * - Real-time FFT Analyser tap for live sound-wave visualizers
 */
class AudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private effectGain: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowdAnalyser: AnalyserNode | null = null;
  private crowdFreqData: Uint8Array<ArrayBuffer> | null = null;
  private waveLevelsCache: number[] = [0, 0, 0, 0, 0];

  private pinkNoiseBuffer: AudioBuffer | null = null;
  private customBufferCache = new Map<string, AudioBuffer>();
  private loadingPromises = new Map<string, Promise<AudioBuffer | null>>();

  // Event voice management (supports cross-fading outgoing -> incoming event audio)
  private activeEffectVoices: ActiveEffectVoice[] = [];
  private effectVoiceSeq = 0;
  private effectLoadSeq = 0;

  // Seamless dual-deck crowd loop state
  private crowdDecks: CrowdDeckNode[] = [];
  private crowdLoopTimer: ReturnType<typeof setTimeout> | null = null;
  private crowdStopTimer: ReturnType<typeof setTimeout> | null = null;
  private crowdFilterA: BiquadFilterNode | null = null;
  private crowdFilterB: BiquadFilterNode | null = null;
  private crowdLfo: OscillatorNode | null = null;
  private crowdLfoGain: GainNode | null = null;
  private crowdActive = false;
  private crowdTargetVol = 0;
  private crowdCustomUrl = '';
  private crowdSessionId = 0;
  private crowdIsProcedural = false;

  // Synced localStorage preferences listener
  private storageListenerAttached = false;
  private prefListeners = new Set<(prefs: StoredAudioPreferences) => void>();

  constructor() {
    this.attachStorageSync();
  }

  private attachStorageSync(): void {
    if (this.storageListenerAttached || typeof window === 'undefined') return;
    this.storageListenerAttached = true;

    const handleSync = (detail?: StoredAudioPreferences) => {
      const prefs = detail
        ? {
            muted: Boolean(detail.muted),
            effectsVolume: clampPct(detail.effectsVolume, 85),
            crowdVolume: clampPct(detail.crowdVolume, 75)
          }
        : readStoredAudioPrefs('broadcast');

      if (prefs.muted) {
        this.fadeOutAndMuteAll(0.16);
      }
      this.prefListeners.forEach((cb) => {
        try {
          cb(prefs);
        } catch {}
      });
    };

    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === AUDIO_PREFS_STORAGE_KEY || e.key === null) {
        handleSync();
      }
    });

    window.addEventListener(AUDIO_PREFS_EVENT, (e: Event) => {
      const detail = (e as CustomEvent<StoredAudioPreferences>).detail;
      handleSync(detail);
    });
  }

  public subscribePreferences(cb: (prefs: StoredAudioPreferences) => void): () => void {
    this.attachStorageSync();
    this.prefListeners.add(cb);
    return () => {
      this.prefListeners.delete(cb);
    };
  }

  public getPreferences(mode: AudioViewMode = 'broadcast'): StoredAudioPreferences {
    return readStoredAudioPrefs(mode);
  }

  public updatePreferences(nextPrefs: StoredAudioPreferences): void {
    const clean: StoredAudioPreferences = {
      muted: Boolean(nextPrefs.muted),
      effectsVolume: clampPct(nextPrefs.effectsVolume, 85),
      crowdVolume: clampPct(nextPrefs.crowdVolume, 75)
    };
    writeStoredAudioPrefs(clean);
    if (clean.muted) {
      this.fadeOutAndMuteAll(0.16);
    }
  }

  public isMuted(mode: AudioViewMode = 'broadcast'): boolean {
    if (mode === 'obs' && !hasStoredAudioPrefs()) {
      return false;
    }
    return readStoredAudioPrefs(mode).muted;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);

      this.effectGain = this.ctx.createGain();
      this.effectGain.gain.value = 1;
      this.effectGain.connect(this.masterGain);

      this.crowdGain = this.ctx.createGain();
      this.crowdGain.gain.value = 0;
      this.crowdGain.connect(this.masterGain);

      this.crowdAnalyser = this.ctx.createAnalyser();
      this.crowdAnalyser.fftSize = 512;
      this.crowdAnalyser.minDecibels = -88;
      this.crowdAnalyser.maxDecibels = -18;
      this.crowdAnalyser.smoothingTimeConstant = 0.72;
      this.crowdGain.connect(this.crowdAnalyser);
      this.crowdFreqData = new Uint8Array(new ArrayBuffer(this.crowdAnalyser.frequencyBinCount));
    }
    return this.ctx;
  }

  public async unlock(): Promise<boolean> {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      if (ctx.state === 'running') {
        this.preloadAssets();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public isRunning(): boolean {
    return Boolean(this.ctx && this.ctx.state === 'running');
  }

  public preloadAssets(customUrls?: Partial<Record<AudioAssetSlot, string>>): void {
    const slots: AudioAssetSlot[] = ['four', 'six', 'wicket', 'crowd'];
    for (const slot of slots) {
      const target = (customUrls?.[slot] || '').trim() || DEFAULT_AUDIO_ASSETS[slot];
      void this.loadCustomBuffer(target);
    }
  }

  public invalidateCache(rawUrl?: string): void {
    if (!rawUrl) {
      this.customBufferCache.clear();
      return;
    }
    const resolved = resolveAudioUrl(rawUrl);
    if (resolved) {
      this.customBufferCache.delete(resolved);
    }
  }

  private getPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.pinkNoiseBuffer && this.pinkNoiseBuffer.sampleRate === ctx.sampleRate) {
      return this.pinkNoiseBuffer;
    }
    const durationSec = 6;
    const length = Math.floor(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.095;
      b6 = white * 0.115926;
      data[i] = Math.max(-0.98, Math.min(0.98, sample));
    }

    const fadeSamples = Math.min(Math.floor(ctx.sampleRate * 0.15), Math.floor(length / 4));
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      const tailIdx = length - fadeSamples + i;
      const blended = data[i] * t + data[tailIdx] * (1 - t);
      data[i] = blended;
      data[tailIdx] = blended;
    }

    this.pinkNoiseBuffer = buffer;
    return buffer;
  }

  private async loadCustomBuffer(rawUrl: string): Promise<AudioBuffer | null> {
    const resolved = resolveAudioUrl(rawUrl);
    if (!resolved) return null;
    const cached = this.customBufferCache.get(resolved);
    if (cached) return cached;

    const existingPromise = this.loadingPromises.get(resolved);
    if (existingPromise) return existingPromise;

    const ctx = this.ensureContext();
    if (!ctx) return null;

    const promise = (async () => {
      try {
        const res = await fetch(resolved);
        if (!res.ok) return null;
        const arrBuf = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrBuf);
        if (this.customBufferCache.size >= 16) {
          const oldestKey = this.customBufferCache.keys().next().value;
          if (oldestKey) this.customBufferCache.delete(oldestKey);
        }
        this.customBufferCache.set(resolved, decoded);
        return decoded;
      } catch (err) {
        console.warn('AudioController decode fallback to procedural synthesis:', err);
        return null;
      } finally {
        this.loadingPromises.delete(resolved);
      }
    })();

    this.loadingPromises.set(resolved, promise);
    return promise;
  }

  /**
   * Computes trimmed [offsetSec, durationSec] skipping MP3 encoder silence padding
   * so looped crowd ambience never exhibits boundary gaps.
   */
  private getTrimmedLoopWindow(buffer: AudioBuffer): { offsetSec: number; durationSec: number } {
    const sr = buffer.sampleRate;
    const data = buffer.getChannelData(0);
    const len = data.length;
    const maxScan = Math.min(Math.floor(len / 4), Math.floor(sr * 0.15));
    const threshold = 0.0018;

    let startSample = 0;
    while (startSample < maxScan && Math.abs(data[startSample]) < threshold) {
      startSample++;
    }

    let endSample = len - 1;
    const minEnd = Math.max(startSample + Math.floor(sr * 0.5), len - maxScan);
    while (endSample > minEnd && Math.abs(data[endSample]) < threshold) {
      endSample--;
    }

    const offsetSec = startSample / sr;
    const durationSec = Math.max(0.25, (endSample - startSample + 1) / sr);
    return { offsetSec, durationSec };
  }

  /**
   * Smoothly cross-fades out any currently playing event sound(s) over `fadeSec`
   * instead of cutting off abruptly.
   */
  public crossFadeOutCurrentEffect(fadeSec = 0.14): void {
    this.effectLoadSeq++;
    const ctx = this.ctx;
    const voices = this.activeEffectVoices;
    this.activeEffectVoices = [];

    for (const voice of voices) {
      if (voice.endTimer) {
        clearTimeout(voice.endTimer);
        voice.endTimer = null;
      }
      if (voice.fadeTimer) {
        clearTimeout(voice.fadeTimer);
        voice.fadeTimer = null;
      }

      if (ctx && ctx.state === 'running' && fadeSec > 0.01) {
        const now = ctx.currentTime;
        try {
          voice.gainNode.gain.cancelScheduledValues(now);
          voice.gainNode.gain.setValueAtTime(Math.max(0.0001, voice.gainNode.gain.value), now);
          voice.gainNode.gain.linearRampToValueAtTime(0, now + fadeSec);
        } catch {}
        voice.fadeTimer = setTimeout(() => {
          voice.stopNodes();
        }, Math.ceil(fadeSec * 1000) + 30);
      } else {
        voice.stopNodes();
      }
    }
  }

  public stopCurrentEffect(): void {
    this.crossFadeOutCurrentEffect(0.08);
  }

  private registerEffectVoice(voice: ActiveEffectVoice): void {
    this.activeEffectVoices.push(voice);
  }

  private removeEffectVoice(voiceId: number): void {
    this.activeEffectVoices = this.activeEffectVoices.filter((v) => v.id !== voiceId);
  }

  private scheduleBatCrack(
    ctx: AudioContext,
    dest: AudioNode,
    atTime: number,
    intensity: number,
    cleanupList: Array<() => void>
  ) {
    const noiseBuf = this.getPinkNoiseBuffer(ctx);

    const clickSrc = ctx.createBufferSource();
    clickSrc.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1750, atTime);
    bp.Q.setValueAtTime(1.4, atTime);

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.001, atTime);
    clickGain.gain.linearRampToValueAtTime(0.95 * intensity, atTime + 0.004);
    clickGain.gain.exponentialRampToValueAtTime(0.001, atTime + 0.055);

    clickSrc.connect(bp);
    bp.connect(clickGain);
    clickGain.connect(dest);
    clickSrc.start(atTime, Math.random() * 2, 0.07);
    clickSrc.stop(atTime + 0.07);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, atTime);
    osc.frequency.exponentialRampToValueAtTime(88, atTime + 0.065);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.001, atTime);
    oscGain.gain.linearRampToValueAtTime(0.68 * intensity, atTime + 0.003);
    oscGain.gain.exponentialRampToValueAtTime(0.001, atTime + 0.07);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(atTime);
    osc.stop(atTime + 0.075);

    cleanupList.push(() => {
      try {
        clickSrc.stop();
        clickSrc.disconnect();
        osc.stop();
        osc.disconnect();
      } catch {}
    });
  }

  private scheduleApplauseBursts(
    ctx: AudioContext,
    dest: AudioNode,
    startTime: number,
    durationSec: number,
    count: number,
    amplitude: number,
    cleanupList: Array<() => void>
  ) {
    const noiseBuf = this.getPinkNoiseBuffer(ctx);
    for (let i = 0; i < count; i++) {
      const progress = i / Math.max(1, count);
      const t = startTime + progress * durationSec * 0.85 + Math.random() * 0.04;
      const clapSrc = ctx.createBufferSource();
      clapSrc.buffer = noiseBuf;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1150 + Math.random() * 1700, t);
      bp.Q.setValueAtTime(1.5, t);

      const g = ctx.createGain();
      const burstPeak = amplitude * (0.35 + Math.sin(Math.PI * Math.min(1, progress * 1.15)) * 0.65);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(burstPeak, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

      clapSrc.connect(bp);
      bp.connect(g);
      g.connect(dest);

      const offset = Math.random() * 4.5;
      clapSrc.start(t, offset, 0.08);
      clapSrc.stop(t + 0.08);

      cleanupList.push(() => {
        try {
          clapSrc.stop();
          clapSrc.disconnect();
        } catch {}
      });
    }
  }

  private scheduleCrowdRoarEnvelope(
    ctx: AudioContext,
    dest: AudioNode,
    startTime: number,
    durationSec: number,
    peakGain: number,
    lowHz: number,
    highHz: number,
    cleanupList: Array<() => void>
  ) {
    const noiseBuf = this.getPinkNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(lowHz, startTime);
    filter.frequency.exponentialRampToValueAtTime(highHz, startTime + Math.min(0.45, durationSec * 0.3));
    filter.frequency.exponentialRampToValueAtTime(lowHz * 1.1, startTime + durationSec);
    filter.Q.setValueAtTime(0.85, startTime);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, startTime);
    g.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.18, durationSec * 0.15));
    g.gain.setValueAtTime(peakGain * 0.85, startTime + durationSec * 0.55);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

    src.connect(filter);
    filter.connect(g);
    g.connect(dest);

    src.start(startTime, Math.random() * 2.5);
    src.stop(startTime + durationSec + 0.05);

    cleanupList.push(() => {
      try {
        src.stop();
        src.disconnect();
        filter.disconnect();
        g.disconnect();
      } catch {}
    });
  }

  private scheduleWicketTimber(
    ctx: AudioContext,
    dest: AudioNode,
    atTime: number,
    cleanupList: Array<() => void>
  ) {
    const noiseBuf = this.getPinkNoiseBuffer(ctx);
    const hits = [
      { delay: 0, freq: 720, gain: 0.9 },
      { delay: 0.045, freq: 1080, gain: 0.72 },
      { delay: 0.095, freq: 1540, gain: 0.55 }
    ];

    hits.forEach((h) => {
      const t = atTime + h.delay;

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(h.freq, t);
      osc.frequency.exponentialRampToValueAtTime(h.freq * 0.62, t + 0.14);

      const og = ctx.createGain();
      og.gain.setValueAtTime(0.001, t);
      og.gain.linearRampToValueAtTime(h.gain * 0.55, t + 0.004);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      osc.connect(og);
      og.connect(dest);
      osc.start(t);
      osc.stop(t + 0.17);

      const clatter = ctx.createBufferSource();
      clatter.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(h.freq * 1.4, t);
      bp.Q.setValueAtTime(2.2, t);

      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.001, t);
      cg.gain.linearRampToValueAtTime(h.gain * 0.75, t + 0.003);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.075);

      clatter.connect(bp);
      bp.connect(cg);
      cg.connect(dest);
      clatter.start(t, Math.random() * 3, 0.08);
      clatter.stop(t + 0.08);

      cleanupList.push(() => {
        try {
          osc.stop();
          osc.disconnect();
          clatter.stop();
          clatter.disconnect();
        } catch {}
      });
    });
  }

  private scheduleUmpireChime(
    ctx: AudioContext,
    dest: AudioNode,
    startTime: number,
    notes: Array<{ delay: number; freq: number; dur: number; gain: number }>,
    cleanupList: Array<() => void>
  ) {
    notes.forEach((n) => {
      const t = startTime + n.delay;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, t);

      const overtone = ctx.createOscillator();
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(n.freq * 2, t);

      const overGain = ctx.createGain();
      overGain.gain.setValueAtTime(0.001, t);
      overGain.gain.linearRampToValueAtTime(n.gain * 0.22, t + 0.012);
      overGain.gain.exponentialRampToValueAtTime(0.001, t + Math.min(n.dur * 0.75, 0.22));

      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.001, t);
      noteGain.gain.linearRampToValueAtTime(n.gain * 0.65, t + 0.015);
      noteGain.gain.exponentialRampToValueAtTime(0.001, t + n.dur);

      osc.connect(noteGain);
      overtone.connect(overGain);
      overGain.connect(noteGain);
      noteGain.connect(dest);

      osc.start(t);
      osc.stop(t + n.dur + 0.03);
      overtone.start(t);
      overtone.stop(t + n.dur + 0.03);

      cleanupList.push(() => {
        try {
          osc.stop();
          osc.disconnect();
          overtone.stop();
          overtone.disconnect();
          overGain.disconnect();
          noteGain.disconnect();
        } catch {}
      });
    });
  }

  private playProceduralEffect(
    type: CricketEffectType,
    volume01: number,
    voiceId: number,
    fadeInSec: number
  ): number {
    const ctx = this.ctx;
    if (!ctx || !this.effectGain) return 0;

    const now = ctx.currentTime;
    const localGain = ctx.createGain();
    localGain.gain.setValueAtTime(0.001, now);
    localGain.gain.linearRampToValueAtTime(volume01, now + Math.max(0.008, fadeInSec));
    localGain.connect(this.effectGain);

    const cleanupList: Array<() => void> = [];
    let dur = 1.85;

    if (type === 'four') {
      dur = 1.85;
      this.scheduleBatCrack(ctx, localGain, now, 1.0, cleanupList);
      this.scheduleCrowdRoarEnvelope(ctx, localGain, now + 0.07, dur - 0.07, 0.56, 420, 950, cleanupList);
      this.scheduleApplauseBursts(ctx, localGain, now + 0.1, 1.45, 18, 0.5, cleanupList);
    } else if (type === 'six') {
      dur = 2.85;
      this.scheduleBatCrack(ctx, localGain, now, 1.25, cleanupList);
      const whooshOsc = ctx.createOscillator();
      whooshOsc.type = 'sine';
      whooshOsc.frequency.setValueAtTime(220, now + 0.03);
      whooshOsc.frequency.exponentialRampToValueAtTime(640, now + 0.35);
      const wg = ctx.createGain();
      wg.gain.setValueAtTime(0.001, now + 0.03);
      wg.gain.linearRampToValueAtTime(0.14, now + 0.12);
      wg.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      whooshOsc.connect(wg);
      wg.connect(localGain);
      whooshOsc.start(now + 0.03);
      whooshOsc.stop(now + 0.4);
      cleanupList.push(() => {
        try {
          whooshOsc.stop();
          whooshOsc.disconnect();
        } catch {}
      });

      this.scheduleCrowdRoarEnvelope(ctx, localGain, now + 0.04, dur - 0.04, 1.05, 380, 920, cleanupList);
      this.scheduleCrowdRoarEnvelope(ctx, localGain, now + 0.12, dur - 0.2, 0.65, 800, 1450, cleanupList);
      this.scheduleApplauseBursts(ctx, localGain, now + 0.14, 2.35, 30, 0.8, cleanupList);
    } else if (type === 'wicket') {
      dur = 2.85;
      this.scheduleWicketTimber(ctx, localGain, now, cleanupList);
      this.scheduleCrowdRoarEnvelope(ctx, localGain, now + 0.05, 0.85, 0.72, 340, 560, cleanupList);
      this.scheduleCrowdRoarEnvelope(ctx, localGain, now + 0.3, dur - 0.3, 0.82, 480, 1050, cleanupList);
      this.scheduleApplauseBursts(ctx, localGain, now + 0.45, 2.1, 22, 0.62, cleanupList);
    } else if (type === 'bat-on-ball') {
      dur = 0.85;
      this.scheduleBatCrack(ctx, localGain, now, 0.85, cleanupList);
      this.scheduleCrowdRoarEnvelope(ctx, localGain, now + 0.06, 0.7, 0.24, 380, 720, cleanupList);
      this.scheduleApplauseBursts(ctx, localGain, now + 0.1, 0.58, 7, 0.26, cleanupList);
    } else if (type === 'dot') {
      dur = 0.35;
      this.scheduleBatCrack(ctx, localGain, now, 0.56, cleanupList);
    } else if (type === 'umpire-wide') {
      dur = 0.92;
      this.scheduleUmpireChime(
        ctx,
        localGain,
        now,
        [
          { delay: 0, freq: 659.25, dur: 0.22, gain: 0.65 },
          { delay: 0.15, freq: 523.25, dur: 0.34, gain: 0.6 }
        ],
        cleanupList
      );
      this.scheduleCrowdRoarEnvelope(ctx, localGain, now + 0.1, 0.65, 0.16, 360, 620, cleanupList);
    } else if (type === 'umpire-noball') {
      dur = 1.02;
      this.scheduleUmpireChime(
        ctx,
        localGain,
        now,
        [
          { delay: 0, freq: 587.33, dur: 0.16, gain: 0.68 },
          { delay: 0.13, freq: 783.99, dur: 0.18, gain: 0.72 },
          { delay: 0.27, freq: 932.33, dur: 0.34, gain: 0.65 }
        ],
        cleanupList
      );
      this.scheduleCrowdRoarEnvelope(ctx, localGain, now + 0.14, 0.7, 0.24, 420, 880, cleanupList);
    } else if (type === 'umpire-break') {
      dur = 1.1;
      this.scheduleUmpireChime(
        ctx,
        localGain,
        now,
        [
          { delay: 0, freq: 523.25, dur: 0.24, gain: 0.56 },
          { delay: 0.18, freq: 659.25, dur: 0.24, gain: 0.56 },
          { delay: 0.36, freq: 783.99, dur: 0.48, gain: 0.62 }
        ],
        cleanupList
      );
    } else if (type === 'umpire-signal') {
      dur = 0.95;
      this.scheduleUmpireChime(
        ctx,
        localGain,
        now,
        [
          { delay: 0, freq: 587.33, dur: 0.2, gain: 0.58 },
          { delay: 0.16, freq: 880, dur: 0.42, gain: 0.62 }
        ],
        cleanupList
      );
    } else {
      // 'crowd-roar': celebratory stadium roar + applause for milestones / match victory
      dur = 2.4;
      this.scheduleCrowdRoarEnvelope(ctx, localGain, now, dur, 0.88, 350, 860, cleanupList);
      this.scheduleCrowdRoarEnvelope(ctx, localGain, now + 0.08, dur - 0.12, 0.55, 780, 1420, cleanupList);
      this.scheduleApplauseBursts(ctx, localGain, now + 0.1, 2.05, 24, 0.68, cleanupList);
    }

    const stopNodes = () => {
      cleanupList.forEach((fn) => fn());
      try {
        localGain.disconnect();
      } catch {}
    };

    const endTimer = setTimeout(() => {
      stopNodes();
      this.removeEffectVoice(voiceId);
    }, dur * 1000 + 80);

    this.registerEffectVoice({
      id: voiceId,
      gainNode: localGain,
      stopNodes,
      fadeTimer: null,
      endTimer
    });

    return dur * 1000;
  }

  /**
   * Plays a match audio cue (boundary, wicket, bat-on-ball, umpire signal, or crowd roar)
   * with smooth cross-fading from any previous active event sound, respecting localStorage mute state.
   */
  public async playCue(
    cue: CricketCueType,
    volume01: number,
    customUrl?: string,
    options?: PlayEffectOptions
  ): Promise<void> {
    return this.playEffect(cue, volume01, customUrl, options);
  }

  public async playEffect(
    type: CricketEffectType,
    volume01: number,
    customUrl?: string,
    options?: PlayEffectOptions
  ): Promise<void> {
    const mode = options?.mode ?? 'broadcast';
    if (!options?.bypassMute && this.isMuted(mode)) {
      this.crossFadeOutCurrentEffect(0.1);
      return;
    }

    const clampedVol = Math.max(0, Math.min(1, volume01));
    if (clampedVol <= 0.005) {
      this.crossFadeOutCurrentEffect(0.1);
      return;
    }

    const crossFadeSec = options?.crossFadeSec ?? 0.14;
    const hadPreviousVoice = this.activeEffectVoices.length > 0;
    this.crossFadeOutCurrentEffect(crossFadeSec);

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }
    if (ctx.state !== 'running') return;
    if (!options?.bypassMute && this.isMuted(mode)) return;

    const myLoadSeq = ++this.effectLoadSeq;
    const defaultSlotUrl =
      type === 'four' || type === 'six' || type === 'wicket' ? DEFAULT_AUDIO_ASSETS[type] : '';
    const targetUrl = (customUrl && customUrl.trim()) || defaultSlotUrl;

    if (targetUrl) {
      const customBuf = await this.loadCustomBuffer(targetUrl);
      if (myLoadSeq !== this.effectLoadSeq) return; // Preempted by newer event while loading
      if (!options?.bypassMute && this.isMuted(mode)) return;

      if (customBuf && this.effectGain) {
        const now = ctx.currentTime;
        const maxDur = type === 'four' ? 2.2 : 3.0;
        const playDur = Math.min(customBuf.duration, maxDur);
        const fadeInSec = hadPreviousVoice ? Math.min(0.06, playDur * 0.15) : 0.025;
        const voiceId = ++this.effectVoiceSeq;

        const src = ctx.createBufferSource();
        src.buffer = customBuf;

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(clampedVol, now + fadeInSec);
        if (playDur > 0.35) {
          env.gain.setValueAtTime(clampedVol, now + playDur - 0.22);
          env.gain.linearRampToValueAtTime(0.0001, now + playDur);
        }

        src.connect(env);
        env.connect(this.effectGain);
        src.start(now);
        src.stop(now + playDur + 0.03);

        const stopNodes = () => {
          try {
            src.stop();
            src.disconnect();
            env.disconnect();
          } catch {}
        };

        const endTimer = setTimeout(() => {
          stopNodes();
          this.removeEffectVoice(voiceId);
        }, playDur * 1000 + 60);

        this.registerEffectVoice({
          id: voiceId,
          gainNode: env,
          stopNodes,
          fadeTimer: null,
          endTimer
        });
        return;
      }
    }

    if (myLoadSeq !== this.effectLoadSeq) return;
    const voiceId = ++this.effectVoiceSeq;
    this.playProceduralEffect(type, clampedVol, voiceId, hadPreviousVoice ? 0.06 : 0.015);
  }

  private tearDownCrowdDecks(fadeSec = 0) {
    if (this.crowdLoopTimer) {
      clearTimeout(this.crowdLoopTimer);
      this.crowdLoopTimer = null;
    }

    const decks = this.crowdDecks;
    this.crowdDecks = [];
    const ctx = this.ctx;

    for (const deck of decks) {
      if (deck.stopTimer) {
        clearTimeout(deck.stopTimer);
        deck.stopTimer = null;
      }
      if (fadeSec > 0.02 && ctx && ctx.state === 'running') {
        const now = ctx.currentTime;
        try {
          deck.gain.gain.cancelScheduledValues(now);
          deck.gain.gain.setValueAtTime(Math.max(0.0001, deck.gain.gain.value), now);
          deck.gain.gain.linearRampToValueAtTime(0, now + fadeSec);
        } catch {}
        setTimeout(() => {
          try {
            deck.source.stop();
            deck.source.disconnect();
            deck.gain.disconnect();
          } catch {}
        }, Math.ceil(fadeSec * 1000) + 40);
      } else {
        try {
          deck.source.stop();
          deck.source.disconnect();
          deck.gain.disconnect();
        } catch {}
      }
    }
  }

  private tearDownCrowdFilterGraph() {
    this.tearDownCrowdDecks(0);
    try {
      this.crowdLfo?.stop();
      this.crowdLfo?.disconnect();
    } catch {}
    try {
      this.crowdLfoGain?.disconnect();
      this.crowdFilterA?.disconnect();
      this.crowdFilterB?.disconnect();
    } catch {}
    this.crowdLfo = null;
    this.crowdLfoGain = null;
    this.crowdFilterA = null;
    this.crowdFilterB = null;
  }

  private ensureCrowdFilterGraph(ctx: AudioContext, cleanVol: number, isProcedural: boolean) {
    if (this.crowdFilterA && this.crowdFilterB && this.crowdIsProcedural === isProcedural) {
      return;
    }

    // Tear down stale filter/LFO chain before rebuilding
    try {
      this.crowdLfo?.stop();
      this.crowdLfo?.disconnect();
      this.crowdLfoGain?.disconnect();
      this.crowdFilterA?.disconnect();
      this.crowdFilterB?.disconnect();
    } catch {}

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(isProcedural ? 1050 : 5400, ctx.currentTime);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isProcedural ? 390 : 1080, ctx.currentTime);
    bp.Q.setValueAtTime(isProcedural ? 0.72 : 0.3, ctx.currentTime);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.17, ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(cleanVol * 0.14, ctx.currentTime);
    lfo.connect(lfoGain);
    if (this.crowdGain) {
      lfoGain.connect(this.crowdGain.gain);
    }

    lp.connect(bp);
    if (this.crowdGain) {
      bp.connect(this.crowdGain);
    }
    lfo.start(ctx.currentTime);

    this.crowdFilterA = lp;
    this.crowdFilterB = bp;
    this.crowdLfo = lfo;
    this.crowdLfoGain = lfoGain;
    this.crowdIsProcedural = isProcedural;
  }

  /**
   * Schedules alternating equal-power cross-fading AudioBufferSourceNode decks so crowd ambience
   * loops seamlessly without MP3 padding gaps or audible boundary clicks.
   */
  private startSeamlessCrowdLoop(
    ctx: AudioContext,
    buffer: AudioBuffer,
    sessionId: number,
    initialCrossFadeIn: boolean
  ) {
    if (!this.crowdActive || sessionId !== this.crowdSessionId || !this.crowdFilterA) return;

    const { offsetSec, durationSec } = this.getTrimmedLoopWindow(buffer);

    // Fallback for tiny custom samples (< 1.2s): native hardware loop
    if (durationSec < 1.2) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = offsetSec;
      src.loopEnd = offsetSec + durationSec;

      const deckGain = ctx.createGain();
      const now = ctx.currentTime;
      deckGain.gain.setValueAtTime(initialCrossFadeIn ? 0.0001 : 1, now);
      if (initialCrossFadeIn) {
        deckGain.gain.linearRampToValueAtTime(1, now + 0.35);
      }

      src.connect(deckGain);
      deckGain.connect(this.crowdFilterA);
      src.start(now, offsetSec);

      this.crowdDecks.push({ source: src, gain: deckGain, stopTimer: null });
      return;
    }

    const overlapSec = Math.min(0.55, durationSec * 0.18);
    const stepSec = Math.max(0.4, durationSec - overlapSec);

    const scheduleNextDeck = (startTime: number, isFirstDeck: boolean) => {
      if (!this.crowdActive || sessionId !== this.crowdSessionId || !this.crowdFilterA || ctx.state !== 'running') {
        return;
      }

      const safeStart = Math.max(ctx.currentTime, startTime);
      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const deckGain = ctx.createGain();
      const fadeInDur = isFirstDeck ? (initialCrossFadeIn ? 0.4 : 0.25) : overlapSec;
      const fadeOutStart = safeStart + stepSec;

      try {
        deckGain.gain.setValueCurveAtTime(FADE_IN_CURVE, safeStart, fadeInDur);
        deckGain.gain.setValueCurveAtTime(FADE_OUT_CURVE, fadeOutStart, overlapSec);
      } catch {
        deckGain.gain.setValueAtTime(0.001, safeStart);
        deckGain.gain.linearRampToValueAtTime(1, safeStart + fadeInDur);
        deckGain.gain.setValueAtTime(1, fadeOutStart);
        deckGain.gain.linearRampToValueAtTime(0.0001, fadeOutStart + overlapSec);
      }

      src.connect(deckGain);
      deckGain.connect(this.crowdFilterA);
      src.start(safeStart, offsetSec, durationSec + 0.02);
      src.stop(safeStart + durationSec + 0.04);

      const deckRef: CrowdDeckNode = {
        source: src,
        gain: deckGain,
        stopTimer: null
      };

      const lifetimeMs = Math.max(100, (safeStart + durationSec - ctx.currentTime) * 1000 + 80);
      deckRef.stopTimer = setTimeout(() => {
        try {
          src.disconnect();
          deckGain.disconnect();
        } catch {}
        this.crowdDecks = this.crowdDecks.filter((d) => d !== deckRef);
      }, lifetimeMs);

      this.crowdDecks.push(deckRef);

      const nextDeckStart = safeStart + stepSec;
      const wakeDelayMs = Math.max(80, (nextDeckStart - ctx.currentTime - 0.2) * 1000);
      this.crowdLoopTimer = setTimeout(() => {
        scheduleNextDeck(nextDeckStart, false);
      }, wakeDelayMs);
    };

    scheduleNextDeck(ctx.currentTime, true);
  }

  /**
   * Starts, updates volume, cross-fades URL replacements, or smoothly fades out seamless crowd ambience.
   * Automatically enforces mute state stored in localStorage unless `options.bypassMute` is true.
   */
  public async setCrowdAmbience(
    active: boolean,
    targetVol01: number,
    customCrowdUrl?: string,
    options?: CrowdAmbienceOptions
  ): Promise<void> {
    const mode = options?.mode ?? 'broadcast';
    const mutedInStorage = !options?.bypassMute && this.isMuted(mode);
    const effectiveActive = active && !mutedInStorage;

    const cleanVol = effectiveActive ? Math.max(0, Math.min(0.65, targetVol01 * 0.45)) : 0;
    const cleanUrl = (customCrowdUrl || '').trim() || DEFAULT_AUDIO_ASSETS.crowd;
    const urlChanged = cleanUrl !== this.crowdCustomUrl;

    this.crowdActive = effectiveActive && cleanVol > 0.002;
    this.crowdTargetVol = cleanVol;
    this.crowdCustomUrl = cleanUrl;

    if (this.crowdStopTimer) {
      clearTimeout(this.crowdStopTimer);
      this.crowdStopTimer = null;
    }

    const ctx = this.ctx;
    if (!this.crowdActive) {
      this.crowdSessionId++;
      if (this.crowdLoopTimer) {
        clearTimeout(this.crowdLoopTimer);
        this.crowdLoopTimer = null;
      }
      if (ctx && this.crowdGain && this.crowdDecks.length > 0) {
        const now = ctx.currentTime;
        this.crowdGain.gain.cancelScheduledValues(now);
        this.crowdGain.gain.setValueAtTime(Math.max(0.0001, this.crowdGain.gain.value), now);
        this.crowdGain.gain.linearRampToValueAtTime(0, now + 0.24);
        this.crowdStopTimer = setTimeout(() => {
          if (!this.crowdActive) {
            this.tearDownCrowdFilterGraph();
          }
        }, 280);
      } else {
        this.tearDownCrowdFilterGraph();
      }
      return;
    }

    const activeCtx = this.ensureContext();
    if (!activeCtx || !this.crowdGain) return;

    if (activeCtx.state === 'suspended') {
      try {
        await activeCtx.resume();
      } catch {
        return;
      }
    }
    if (activeCtx.state !== 'running' || !this.crowdActive) return;

    const hadExistingDecks = this.crowdDecks.length > 0;
    if (urlChanged && hadExistingDecks) {
      // Cross-fade outgoing crowd URL decks out over 0.42s while incoming fades in
      this.tearDownCrowdDecks(0.42);
    }

    if (this.crowdDecks.length === 0) {
      const mySession = ++this.crowdSessionId;
      const loadedBuffer = cleanUrl ? await this.loadCustomBuffer(cleanUrl) : null;
      if (!this.crowdActive || activeCtx.state !== 'running' || mySession !== this.crowdSessionId) {
        return;
      }
      const isProceduralPink = !loadedBuffer;
      const buffer = loadedBuffer || this.getPinkNoiseBuffer(activeCtx);

      this.ensureCrowdFilterGraph(activeCtx, cleanVol, isProceduralPink);
      this.startSeamlessCrowdLoop(activeCtx, buffer, mySession, hadExistingDecks && urlChanged);
    }

    const now = activeCtx.currentTime;
    this.crowdGain.gain.cancelScheduledValues(now);
    this.crowdGain.gain.setValueAtTime(Math.max(0.0001, this.crowdGain.gain.value), now);
    this.crowdGain.gain.linearRampToValueAtTime(cleanVol, now + 0.35);
    if (this.crowdLfoGain) {
      this.crowdLfoGain.gain.setValueAtTime(cleanVol * 0.14, now);
    }
  }

  /**
   * Coordinates background crowd ambience ducking + celebratory swell smoothly around match audio cues.
   */
  public swellCrowd(type: CricketEffectType, bypassMute = false, mode: AudioViewMode = 'broadcast'): void {
    if (!bypassMute && this.isMuted(mode)) return;
    if (type === 'dot' || type === 'umpire-break' || type === 'umpire-signal') return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.crowdGain || !this.crowdActive) return;

    const base = Math.max(0.01, this.crowdTargetVol);
    const boostMult =
      type === 'six'
        ? 2.4
        : type === 'wicket'
        ? 2.15
        : type === 'crowd-roar'
        ? 2.1
        : type === 'four'
        ? 1.7
        : type === 'bat-on-ball'
        ? 1.25
        : 1.18;
    const peak = Math.min(0.75, base * boostMult);
    const holdSec =
      type === 'six' || type === 'wicket'
        ? 2.65
        : type === 'crowd-roar'
        ? 2.2
        : type === 'four'
        ? 1.55
        : 0.72;
    const now = ctx.currentTime;

    // Brief 65ms dip on bat/stump crack before swelling seamlessly into the crowd roar
    const duckVol = Math.max(0.005, base * 0.68);
    this.crowdGain.gain.cancelScheduledValues(now);
    this.crowdGain.gain.setValueAtTime(Math.max(0.002, this.crowdGain.gain.value), now);
    this.crowdGain.gain.linearRampToValueAtTime(duckVol, now + 0.065);
    this.crowdGain.gain.linearRampToValueAtTime(peak, now + 0.28);
    this.crowdGain.gain.linearRampToValueAtTime(base, now + holdSec);
  }

  public getCrowdWaveLevels(barCount = 5): { levels: number[]; overall: number; isActive: boolean } {
    if (this.waveLevelsCache.length !== barCount) {
      this.waveLevelsCache = new Array<number>(barCount).fill(0);
    }

    if (
      !this.crowdActive ||
      this.crowdDecks.length === 0 ||
      !this.crowdAnalyser ||
      !this.crowdFreqData ||
      !this.ctx ||
      this.ctx.state !== 'running'
    ) {
      for (let i = 0; i < barCount; i++) {
        this.waveLevelsCache[i] = 0;
      }
      return { levels: this.waveLevelsCache, overall: 0, isActive: false };
    }

    this.crowdAnalyser.getByteFrequencyData(this.crowdFreqData);
    const data = this.crowdFreqData;
    const bandRanges: Array<[number, number]> = [
      [1, 2],
      [3, 4],
      [5, 7],
      [8, 11],
      [12, 16]
    ];

    let sumAll = 0;
    for (let i = 0; i < barCount; i++) {
      const range = bandRanges[i] ?? [
        1 + i * 3,
        Math.min(data.length - 1, 3 + i * 3)
      ];
      const start = Math.min(data.length - 1, range[0]);
      const end = Math.min(data.length - 1, range[1]);
      let bandSum = 0;
      let count = 0;
      for (let b = start; b <= end; b++) {
        bandSum += data[b];
        count++;
      }
      const avg01 = count > 0 ? bandSum / (count * 255) : 0;
      const shaped = Math.min(1, Math.pow(avg01, 0.78) * 1.35);
      this.waveLevelsCache[i] = shaped;
      sumAll += shaped;
    }

    const overall = barCount > 0 ? sumAll / barCount : 0;
    return { levels: this.waveLevelsCache, overall, isActive: true };
  }

  public fadeOutAndMuteAll(fadeSec = 0.16): void {
    this.crossFadeOutCurrentEffect(fadeSec);
    this.crowdActive = false;
    this.crowdSessionId++;
    if (this.crowdLoopTimer) {
      clearTimeout(this.crowdLoopTimer);
      this.crowdLoopTimer = null;
    }
    if (this.crowdStopTimer) {
      clearTimeout(this.crowdStopTimer);
      this.crowdStopTimer = null;
    }
    if (this.ctx && this.crowdGain && this.crowdDecks.length > 0 && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      this.crowdGain.gain.cancelScheduledValues(now);
      this.crowdGain.gain.setValueAtTime(Math.max(0.0001, this.crowdGain.gain.value), now);
      this.crowdGain.gain.linearRampToValueAtTime(0, now + fadeSec);
      this.crowdStopTimer = setTimeout(() => {
        if (!this.crowdActive) {
          this.tearDownCrowdFilterGraph();
        }
      }, Math.ceil(fadeSec * 1000) + 40);
    } else {
      this.tearDownCrowdFilterGraph();
    }
  }

  public stopAll(): void {
    this.fadeOutAndMuteAll(0.14);
  }
}

export const audioController = new AudioController();
