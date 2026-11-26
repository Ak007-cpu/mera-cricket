import { AutoBallEventType } from '../hooks/useAutoBallAnimation';

export const FEMALE_VOICE_STORAGE_KEY = 'cricket_female_voice_enabled_v1';
export const FEMALE_VOICE_EVENT = 'cricket-female-voice-changed';

const FEMALE_VOICE_NAME_HINTS = [
  'google uk english female',
  'google us english',
  'microsoft zira',
  'microsoft aria',
  'microsoft jenny',
  'microsoft neerja',
  'microsoft heera',
  'samantha',
  'victoria',
  'karen',
  'veena',
  'tessa',
  'moira',
  'fiona',
  'serena',
  'kate',
  'allison',
  'ava',
  'susan',
  'female',
  'woman'
];

let cachedPreferredVoice: SpeechSynthesisVoice | null = null;
let lastSpokenAt = 0;
let pendingSpeakTimer: ReturnType<typeof setTimeout> | null = null;
let safetyEndTimer: ReturnType<typeof setTimeout> | null = null;
let speechWarmedUp = false;

function clearSpeechTimers(): void {
  if (pendingSpeakTimer) {
    clearTimeout(pendingSpeakTimer);
    pendingSpeakTimer = null;
  }
  if (safetyEndTimer) {
    clearTimeout(safetyEndTimer);
    safetyEndTimer = null;
  }
}

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

export function warmUpSpeechSynthesis(): boolean {
  if (!isSpeechSynthesisSupported()) return false;
  try {
    const synth = window.speechSynthesis;
    if (synth.paused) {
      synth.resume();
    }
    pickFemaleVoice();

    if (!speechWarmedUp && !synth.speaking && !synth.pending) {
      speechWarmedUp = true;
      const primer = new SpeechSynthesisUtterance(' ');
      primer.volume = 0;
      primer.rate = 10;
      synth.speak(primer);
    }
    return true;
  } catch {
    return false;
  }
}

export function readFemaleVoiceEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    const raw = localStorage.getItem(FEMALE_VOICE_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== 'false' && raw !== '0';
  } catch {
    return true;
  }
}

export function writeFemaleVoiceEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FEMALE_VOICE_STORAGE_KEY, enabled ? 'true' : 'false');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(FEMALE_VOICE_EVENT, { detail: { enabled } }));
    }
  } catch {}
}

export function pickFemaleVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return cachedPreferredVoice;

  const englishVoices = voices.filter((v) => /^en/i.test(v.lang));
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  for (const hint of FEMALE_VOICE_NAME_HINTS) {
    const match = pool.find((v) => v.name.toLowerCase().includes(hint));
    if (match) {
      cachedPreferredVoice = match;
      return match;
    }
  }

  // Fallback to en-GB / en-IN / first English voice
  const fallback =
    pool.find((v) => /en[-_]gb|en[-_]in/i.test(v.lang)) ||
    pool[0] ||
    voices[0] ||
    null;
  cachedPreferredVoice = fallback;
  return fallback;
}

export function buildFemaleBallAnnouncement(
  eventType: AutoBallEventType,
  batterName?: string
): string {
  const shortBatter = (batterName || '').trim().split(/\s+/).slice(-1)[0] || '';
  switch (eventType) {
    case 'four':
      return shortBatter ? `Four! Cracking boundary by ${shortBatter}!` : 'Four! Cracking boundary!';
    case 'six':
      return shortBatter ? `Six! Massive hit by ${shortBatter}!` : 'Six! Massive hit into the crowd!';
    case 'wicket':
      return shortBatter ? `Wicket! ${shortBatter} is out!` : 'Wicket! Batter is out!';
    case 'single':
      return 'One run.';
    case 'two':
      return 'Two runs.';
    case 'three':
      return 'Three runs.';
    case 'dot':
      return 'Dot ball.';
    case 'wide':
      return 'Wide ball.';
    case 'no-ball':
      return 'No ball! Free hit!';
    case 'bye':
      return 'Bye run.';
    case 'leg-bye':
      return 'Leg bye.';
    default:
      return '';
  }
}

export function cancelFemaleVoice(): void {
  clearSpeechTimers();
  try {
    if (isSpeechSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }
  } catch {}
}

function clampVoiceRate(rate: unknown, fallback: number): number {
  const n = Number(rate);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.max(0.5, Math.min(2.0, n)) * 100) / 100;
}

export function speakSynthesizedAlert(
  text: string,
  options: {
    urgent?: boolean;
    delayMs?: number;
    rate?: number;
    volume01?: number;
    onStart?: () => void;
    onEnd?: () => void;
  } = {}
): void {
  const cleanText = text.trim();
  const targetVol = options.volume01 === undefined ? 0.9 : Math.max(0, Math.min(1, options.volume01));
  if (!cleanText || !isSpeechSynthesisSupported() || targetVol <= 0.005) {
    options.onEnd?.();
    return;
  }

  const now = Date.now();
  // Prevent duplicate overlap within 320ms
  if (now - lastSpokenAt < 320) return;
  lastSpokenAt = now;

  clearSpeechTimers();

  const delayMs = options.delayMs ?? (options.urgent ? 220 : 80);

  pendingSpeakTimer = setTimeout(() => {
    pendingSpeakTimer = null;
    try {
      const synth = window.speechSynthesis;
      if (synth.speaking || synth.pending) {
        synth.cancel();
      }
      if (synth.paused) {
        synth.resume();
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voice = pickFemaleVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || 'en-GB';
      } else {
        utterance.lang = 'en-GB';
      }

      // Crisp female broadcast cadence scaled by admin pace setting
      const baseRate = clampVoiceRate(options.rate, 1.05);
      const effectiveRate = options.urgent
        ? Math.min(2.0, Math.round((baseRate + 0.04) * 100) / 100)
        : baseRate;

      utterance.pitch = 1.22;
      utterance.rate = effectiveRate;
      utterance.volume = targetVol;

      let ended = false;
      const finish = () => {
        if (ended) return;
        ended = true;
        if (safetyEndTimer) {
          clearTimeout(safetyEndTimer);
          safetyEndTimer = null;
        }
        options.onEnd?.();
      };

      utterance.onstart = () => {
        options.onStart?.();
      };
      utterance.onend = finish;
      utterance.onerror = finish;

      // Safety fallback in case browser speech queue drops onend
      safetyEndTimer = setTimeout(finish, 5000);

      synth.speak(utterance);
    } catch {
      options.onEnd?.();
    }
  }, delayMs);
}

export function speakFemaleBallCall(
  eventType: AutoBallEventType,
  options: {
    batterName?: string;
    rate?: number;
    volume01?: number;
    onStart?: () => void;
    onEnd?: () => void;
  } = {}
): void {
  const text = buildFemaleBallAnnouncement(eventType, options.batterName);
  if (!text) return;
  const urgent = eventType === 'four' || eventType === 'six' || eventType === 'wicket';
  speakSynthesizedAlert(text, {
    urgent,
    delayMs: urgent ? 220 : 80,
    rate: options.rate,
    volume01: options.volume01,
    onStart: options.onStart,
    onEnd: options.onEnd
  });
}
