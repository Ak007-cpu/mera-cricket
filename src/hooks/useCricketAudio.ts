import { useCallback, useEffect, useRef, useState } from 'react';
import { MatchState, SoundSettingsConfig } from '../types/cricket';
import { ActiveAutoBallEvent, AutoBallEventType } from './useAutoBallAnimation';
import {
  audioController,
  AUDIO_PREFS_STORAGE_KEY,
  AudioViewMode,
  CricketCueType,
  CricketEffectType,
  hasStoredAudioPrefs,
  readStoredAudioPrefs,
  StoredAudioPreferences
} from '../utils/AudioController';
import {
  cancelFemaleVoice,
  FEMALE_VOICE_EVENT,
  FEMALE_VOICE_STORAGE_KEY,
  pickFemaleVoice,
  readFemaleVoiceEnabled,
  speakFemaleBallCall,
  speakSynthesizedAlert,
  warmUpSpeechSynthesis,
  writeFemaleVoiceEnabled
} from '../utils/femaleVoiceAnnouncer';

export { AUDIO_PREFS_STORAGE_KEY };
export type { StoredAudioPreferences };

export interface ActiveAudioCueInfo {
  cue: CricketCueType;
  label: string;
  timestamp: number;
}

interface MatchAudioSnapshot {
  matchId: string;
  gameState: MatchState['gameState'];
  currentInnings: 1 | 2;
  alertId: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  latestBallId: string;
  requiredRuns: number;
  remainingBalls: number;
}

const MILESTONE_ROAR_ALERTS = new Set([
  'thirty',
  'fifty',
  'century',
  'one_fifty',
  'double_century',
  'three_wickets',
  'four_wickets',
  'five_wickets',
  'milestone',
  'tight_finish',
  'match_result'
]);

function mapBallEventToCue(
  eventType: AutoBallEventType
): { cue: CricketCueType; label: string } {
  switch (eventType) {
    case 'four':
      return { cue: 'four', label: 'FOUR! Boundary' };
    case 'six':
      return { cue: 'six', label: 'SIX! Crowd Roar' };
    case 'wicket':
      return { cue: 'wicket', label: 'WICKET! Timber' };
    case 'wide':
      return { cue: 'umpire-wide', label: 'Umpire Signal: Wide' };
    case 'no-ball':
      return { cue: 'umpire-noball', label: 'Umpire Signal: No Ball' };
    case 'dot':
      return { cue: 'dot', label: 'Bat-on-Ball (Dot)' };
    case 'single':
    case 'two':
    case 'three':
    case 'bye':
    case 'leg-bye':
    default:
      return { cue: 'bat-on-ball', label: 'Bat-on-Ball' };
  }
}

function clampPct(val: unknown, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampRate(val: unknown, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.max(0.5, Math.min(2.0, n)) * 100) / 100;
}

function getObsQuerySoundOverride(): boolean | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const val = params.get('sound');
    if (val === '1' || val === 'true' || val === 'on') return true;
    if (val === '0' || val === 'false' || val === 'off') return false;
  } catch {}
  return null;
}

function getObsQueryVoiceOverride(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const val = params.get('voice');
    return val === '1' || val === 'true' || val === 'on';
  } catch {}
  return false;
}

function detectScoreEventFromSnapshotDiff(
  prev: MatchAudioSnapshot,
  currMatch: MatchState
): { type: AutoBallEventType; batterName: string } | null {
  const currRuns = Number(currMatch.battingTeam?.score?.runs || 0);
  const currWickets = Number(currMatch.battingTeam?.score?.wickets || 0);
  const currOvers = Number(currMatch.battingTeam?.score?.overs || 0);
  const currBallsNum = Number(currMatch.battingTeam?.score?.balls || 0);

  const deltaRuns = currRuns - prev.runs;
  const deltaWickets = currWickets - prev.wickets;
  const deltaBalls = (currOvers * 6 + currBallsNum) - (prev.overs * 6 + prev.balls);

  const currBall = currMatch.recentBalls?.[0];
  const currBallId = currBall?.id || '';
  const hasNewBallRecord = Boolean(currBallId && currBallId !== prev.latestBallId);

  if (deltaRuns === 0 && deltaWickets === 0 && deltaBalls === 0 && !hasNewBallRecord) {
    return null;
  }

  if (
    deltaRuns < 0 ||
    deltaWickets < 0 ||
    deltaBalls < 0 ||
    deltaWickets > 1 ||
    deltaBalls > 2 ||
    deltaRuns > 7
  ) {
    return null;
  }

  const batterName = currBall?.batsmanName || currMatch.striker?.name || '';

  if (deltaWickets === 1 || (hasNewBallRecord && currBall?.isWicket && deltaWickets <= 1)) {
    return { type: 'wicket', batterName };
  }

  if (hasNewBallRecord && currBall?.isExtra && currBall.extraType) {
    const ex = currBall.extraType;
    if (ex === 'wide' && deltaBalls === 0 && deltaRuns >= 1 && deltaRuns <= 5) {
      return { type: 'wide', batterName };
    }
    if (ex === 'no-ball' && deltaBalls === 0 && deltaRuns >= 1 && deltaRuns <= 7) {
      return { type: 'no-ball', batterName };
    }
    if (ex === 'bye' && deltaBalls >= 1 && deltaBalls <= 2 && deltaRuns >= 1 && deltaRuns <= 4) {
      return { type: 'bye', batterName };
    }
    if (ex === 'leg-bye' && deltaBalls >= 1 && deltaBalls <= 2 && deltaRuns >= 1 && deltaRuns <= 4) {
      return { type: 'leg-bye', batterName };
    }
  }

  if (deltaWickets === 0 && (deltaBalls >= 1 || (deltaRuns >= 1 && deltaRuns <= 6))) {
    if (deltaRuns === 6) return { type: 'six', batterName };
    if (deltaRuns === 5 || deltaRuns === 4) return { type: 'four', batterName };
    if (deltaRuns === 3) return { type: 'three', batterName };
    if (deltaRuns === 2) return { type: 'two', batterName };
    if (deltaRuns === 1) return { type: 'single', batterName };
    if (deltaRuns === 0 && deltaBalls >= 1) return { type: 'dot', batterName };
  }

  return null;
}

interface UseCricketAudioOptions {
  mode: AudioViewMode;
  match: MatchState | null;
  activeBallEvent: ActiveAutoBallEvent | null;
  soundSettings?: SoundSettingsConfig | null;
  suppressForAdOrHold?: boolean;
  testAudioEnabled?: boolean;
}

export function useCricketAudio({
  mode,
  match,
  activeBallEvent,
  soundSettings,
  suppressForAdOrHold = false,
  testAudioEnabled = false
}: UseCricketAudioOptions) {
  const [audioPrefs, setAudioPrefs] = useState<StoredAudioPreferences>(() =>
    readStoredAudioPrefs(mode)
  );
  const [femaleVoiceEnabled, setFemaleVoiceEnabled] = useState<boolean>(() => readFemaleVoiceEnabled());
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState<boolean>(false);
  const [audioUnlockedTick, setAudioUnlockedTick] = useState<number>(0);
  const [lastAudioCue, setLastAudioCue] = useState<ActiveAudioCueInfo | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const lastHandledEventKeyRef = useRef<number | null>(null);
  const lastDispatchedBallSigRef = useRef<{ sig: string; at: number } | null>(null);
  const prevMatchMetaRef = useRef<MatchAudioSnapshot | null>(null);
  const delayedCueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cueBadgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const strikerNameRef = useRef<string>('');
  strikerNameRef.current = match?.striker?.name || '';
  const latestBallSigRef = useRef<string>('');
  latestBallSigRef.current = match
    ? `${match.matchId}|${match.currentInnings}|${match.battingTeam?.score?.runs || 0}/${match.battingTeam?.score?.wickets || 0}|${match.battingTeam?.score?.overs || 0}.${match.battingTeam?.score?.balls || 0}|${match.recentBalls?.[0]?.id || ''}`
    : '';

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefersReducedMotion(mq.matches);
    setPrefersReducedMotion(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Pre-warm speechSynthesis female voice list
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    pickFemaleVoice();
    const onVoicesChanged = () => pickFemaleVoice();
    window.speechSynthesis.addEventListener?.('voiceschanged', onVoicesChanged);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', onVoicesChanged);
    };
  }, []);

  // Subscribe to central AudioController localStorage preferences sync + female voice toggle sync
  useEffect(() => {
    setAudioPrefs(readStoredAudioPrefs(mode));
    setFemaleVoiceEnabled(readFemaleVoiceEnabled());
    const unsubAudio = audioController.subscribePreferences((next) => {
      setAudioPrefs(next);
    });
    const onVoiceEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ enabled?: boolean }>).detail;
      if (detail && typeof detail.enabled === 'boolean') {
        setFemaleVoiceEnabled(detail.enabled);
      } else {
        setFemaleVoiceEnabled(readFemaleVoiceEnabled());
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === FEMALE_VOICE_STORAGE_KEY || e.key === null) {
        setFemaleVoiceEnabled(readFemaleVoiceEnabled());
      }
    };
    window.addEventListener(FEMALE_VOICE_EVENT, onVoiceEvent);
    window.addEventListener('storage', onStorage);
    return () => {
      unsubAudio();
      window.removeEventListener(FEMALE_VOICE_EVENT, onVoiceEvent);
      window.removeEventListener('storage', onStorage);
    };
  }, [mode]);

  const adminBroadcastEnabled = soundSettings?.enabled ?? true;
  const adminObsEnabled = soundSettings?.obsEnabled ?? true;
  const adminEffectsVol = clampPct(soundSettings?.effectsVolume, 80);
  const adminCrowdVol = clampPct(soundSettings?.crowdVolume, 28);
  const adminVoiceRate = clampRate(soundSettings?.voiceRate, 1.05);
  const adminVoiceVol = clampPct(soundSettings?.voiceVolume, 90);
  const customSounds = soundSettings?.customSounds;

  const obsQueryOverride = mode === 'obs' ? getObsQuerySoundOverride() : null;
  const obsVoiceEnabled = mode === 'obs' ? getObsQueryVoiceOverride() : true;
  const obsLocalStorageActive = mode === 'obs' && hasStoredAudioPrefs() ? !audioPrefs.muted : true;
  const effectiveObsEnabled =
    obsQueryOverride !== null
      ? obsQueryOverride && obsLocalStorageActive
      : adminObsEnabled && adminBroadcastEnabled && obsLocalStorageActive;

  const isSoundOn =
    mode === 'obs'
      ? effectiveObsEnabled
      : mode === 'test'
      ? testAudioEnabled
      : adminBroadcastEnabled && !audioPrefs.muted;

  const canPlayAudio =
    isSoundOn && !suppressForAdOrHold && !(mode === 'mobile' && prefersReducedMotion);

  const effectiveVoiceVol01 = Math.max(0, Math.min(1, adminVoiceVol / 100));
  const canPlaySpeech =
    canPlayAudio && femaleVoiceEnabled && obsVoiceEnabled && effectiveVoiceVol01 > 0.005;

  const isLiveMatch = Boolean(match && match.gameState === 'live');
  const viewerEffectsScale = mode === 'test' ? 1 : audioPrefs.effectsVolume / 100;
  const viewerCrowdScale = mode === 'test' ? 1 : audioPrefs.crowdVolume / 100;

  const effectiveEffectsVol01 = (adminEffectsVol / 100) * viewerEffectsScale;
  const effectiveCrowdVol01 = (adminCrowdVol / 100) * viewerCrowdScale;

  const livePlaybackRef = useRef({
    canPlayAudio,
    canPlaySpeech,
    effectiveEffectsVol01,
    effectiveCrowdVol01,
    effectiveVoiceVol01,
    adminVoiceRate,
    isLiveMatch,
    mode
  });
  livePlaybackRef.current = {
    canPlayAudio,
    canPlaySpeech,
    effectiveEffectsVol01,
    effectiveCrowdVol01,
    effectiveVoiceVol01,
    adminVoiceRate,
    isLiveMatch,
    mode
  };

  const announceAudioCue = useCallback((cue: CricketCueType, label: string) => {
    if (cueBadgeTimerRef.current) {
      clearTimeout(cueBadgeTimerRef.current);
      cueBadgeTimerRef.current = null;
    }
    setLastAudioCue({ cue, label, timestamp: Date.now() });
    cueBadgeTimerRef.current = setTimeout(() => {
      setLastAudioCue((curr) => (curr && curr.cue === cue ? null : curr));
      cueBadgeTimerRef.current = null;
    }, 2400);
  }, []);

  // Unlock AudioContext & prime Web Speech API on load or first user gesture
  useEffect(() => {
    if (!canPlayAudio) return;

    let cancelled = false;
    const attemptUnlock = async () => {
      if (canPlaySpeech) {
        warmUpSpeechSynthesis();
      }
      if (mode === 'test') return true;
      const running = await audioController.unlock();
      if (!cancelled && running) {
        setAudioUnlockedTick((t) => t + 1);
      }
      return running;
    };

    if (mode !== 'test') {
      attemptUnlock();
    }

    const onUserGesture = () => {
      attemptUnlock().then((running) => {
        if (running) {
          window.removeEventListener('pointerdown', onUserGesture);
          window.removeEventListener('keydown', onUserGesture);
        }
      });
    };

    window.addEventListener('pointerdown', onUserGesture, { passive: true });
    window.addEventListener('keydown', onUserGesture, { passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', onUserGesture);
      window.removeEventListener('keydown', onUserGesture);
    };
  }, [canPlayAudio, canPlaySpeech, mode]);

  // Preload active event & crowd audio assets (custom URLs or /Assets/*.mp3 placeholders)
  useEffect(() => {
    if (!canPlayAudio || mode === 'test') return;
    audioController.preloadAssets({
      four: customSounds?.fourUrl,
      six: customSounds?.sixUrl,
      wicket: customSounds?.wicketUrl,
      crowd: customSounds?.crowdUrl
    });
  }, [
    canPlayAudio,
    mode,
    audioUnlockedTick,
    customSounds?.fourUrl,
    customSounds?.sixUrl,
    customSounds?.wicketUrl,
    customSounds?.crowdUrl
  ]);

  // Manage seamless looping crowd ambience via central AudioController
  useEffect(() => {
    const shouldPlayCrowd = canPlayAudio && isLiveMatch && effectiveCrowdVol01 > 0.005;
    audioController.setCrowdAmbience(
      shouldPlayCrowd,
      effectiveCrowdVol01,
      customSounds?.crowdUrl,
      {
        mode,
        bypassMute: mode === 'test'
      }
    );
  }, [canPlayAudio, isLiveMatch, effectiveCrowdVol01, customSounds?.crowdUrl, audioUnlockedTick, mode]);

  // Cross-fade out active sound & cancel speech immediately if suppressed (ad/video started) or audio turned off
  useEffect(() => {
    if (!canPlayAudio) {
      if (delayedCueTimerRef.current) {
        clearTimeout(delayedCueTimerRef.current);
        delayedCueTimerRef.current = null;
      }
      audioController.crossFadeOutCurrentEffect(0.12);
      cancelFemaleVoice();
      setIsVoiceSpeaking(false);
    }
  }, [canPlayAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (delayedCueTimerRef.current) {
        clearTimeout(delayedCueTimerRef.current);
        delayedCueTimerRef.current = null;
      }
      if (cueBadgeTimerRef.current) {
        clearTimeout(cueBadgeTimerRef.current);
        cueBadgeTimerRef.current = null;
      }
      cancelFemaleVoice();
      audioController.stopAll();
    };
  }, []);

  // Trigger delivery cues & Web Speech alerts synced with animation event (and manual replays)
  useEffect(() => {
    if (!activeBallEvent) {
      audioController.crossFadeOutCurrentEffect(0.12);
      return;
    }

    if (lastHandledEventKeyRef.current === activeBallEvent.key) return;
    lastHandledEventKeyRef.current = activeBallEvent.key;

    if (!canPlayAudio) return;

    // Mark current ball signature so the direct match-diff fallback monitor does not double-fire
    if (!activeBallEvent.isReplay && latestBallSigRef.current) {
      lastDispatchedBallSigRef.current = {
        sig: latestBallSigRef.current,
        at: Date.now()
      };
    }

    const { cue, label } = mapBallEventToCue(activeBallEvent.type);
    const customUrl =
      cue === 'four'
        ? customSounds?.fourUrl
        : cue === 'six'
        ? customSounds?.sixUrl
        : cue === 'wicket'
        ? customSounds?.wicketUrl
        : undefined;

    if (effectiveEffectsVol01 > 0.005) {
      const eventType: CricketEffectType = cue;
      audioController.playEffect(eventType, effectiveEffectsVol01, customUrl, {
        mode,
        bypassMute: mode === 'test'
      });
      announceAudioCue(cue, label);

      if (isLiveMatch && effectiveCrowdVol01 > 0.005) {
        audioController.swellCrowd(eventType, mode === 'test', mode);
      }
    }

    // Web Speech API Female Voice Commentary synced with SFX
    if (canPlaySpeech) {
      speakFemaleBallCall(activeBallEvent.type, {
        batterName: strikerNameRef.current,
        rate: adminVoiceRate,
        volume01: effectiveVoiceVol01,
        onStart: () => setIsVoiceSpeaking(true),
        onEnd: () => setIsVoiceSpeaking(false)
      });
    }
  }, [
    activeBallEvent,
    canPlayAudio,
    canPlaySpeech,
    effectiveEffectsVol01,
    effectiveCrowdVol01,
    effectiveVoiceVol01,
    adminVoiceRate,
    isLiveMatch,
    mode,
    customSounds?.fourUrl,
    customSounds?.sixUrl,
    customSounds?.wicketUrl,
    announceAudioCue
  ]);

  // Trigger match-state transition & milestone cues (Completed Crowd Roar, Innings Break / Resume Umpire Signal, Milestones)
  useEffect(() => {
    if (!match) {
      prevMatchMetaRef.current = null;
      if (delayedCueTimerRef.current) {
        clearTimeout(delayedCueTimerRef.current);
        delayedCueTimerRef.current = null;
      }
      return;
    }

    const currSnapshot: MatchAudioSnapshot = {
      matchId: match.matchId,
      gameState: match.gameState,
      currentInnings: match.currentInnings,
      alertId: match.notificationAlert?.id || '',
      runs: Number(match.battingTeam?.score?.runs || 0),
      wickets: Number(match.battingTeam?.score?.wickets || 0),
      overs: Number(match.battingTeam?.score?.overs || 0),
      balls: Number(match.battingTeam?.score?.balls || 0),
      latestBallId: match.recentBalls?.[0]?.id || '',
      requiredRuns: Number(match.requiredRuns ?? 0),
      remainingBalls: Number(match.remainingBalls ?? 0)
    };

    const prev = prevMatchMetaRef.current;
    // Set baseline silently on initial mount or match switch
    if (!prev || prev.matchId !== currSnapshot.matchId) {
      prevMatchMetaRef.current = currSnapshot;
      return;
    }

    const ballStateChanged =
      prev.runs !== currSnapshot.runs ||
      prev.wickets !== currSnapshot.wickets ||
      prev.overs !== currSnapshot.overs ||
      prev.balls !== currSnapshot.balls ||
      Boolean(currSnapshot.latestBallId && currSnapshot.latestBallId !== prev.latestBallId);

    const gameStateChanged = prev.gameState !== currSnapshot.gameState;
    const inningsChanged = prev.currentInnings !== currSnapshot.currentInnings;
    const alertId = currSnapshot.alertId;
    const alertType = match.notificationAlert?.type;
    const alertChanged = Boolean(alertId && alertId !== prev.alertId);
    const enteredTightFinish =
      currSnapshot.gameState === 'live' &&
      prev.requiredRuns > 12 &&
      currSnapshot.requiredRuns > 0 &&
      currSnapshot.requiredRuns <= 12 &&
      currSnapshot.remainingBalls > 0 &&
      currSnapshot.remainingBalls <= 18;

    prevMatchMetaRef.current = currSnapshot;

    if (!canPlayAudio) return;

    // Direct match-state fallback: ensures Four / Six / Wicket Web Speech + SFX still fire
    // when visual animations are turned OFF (activeBallEvent is null)
    const detectedDiff = detectScoreEventFromSnapshotDiff(prev, match);
    const currSig = `${currSnapshot.matchId}|${currSnapshot.currentInnings}|${currSnapshot.runs}/${currSnapshot.wickets}|${currSnapshot.overs}.${currSnapshot.balls}|${currSnapshot.latestBallId}`;
    const alreadyHandledByAnim =
      lastDispatchedBallSigRef.current &&
      lastDispatchedBallSigRef.current.sig === currSig &&
      Date.now() - lastDispatchedBallSigRef.current.at < 800;

    if (detectedDiff && !alreadyHandledByAnim) {
      lastDispatchedBallSigRef.current = { sig: currSig, at: Date.now() };
      const { cue, label } = mapBallEventToCue(detectedDiff.type);
      const customUrl =
        cue === 'four'
          ? customSounds?.fourUrl
          : cue === 'six'
          ? customSounds?.sixUrl
          : cue === 'wicket'
          ? customSounds?.wicketUrl
          : undefined;

      if (effectiveEffectsVol01 > 0.005) {
        audioController.playEffect(cue, effectiveEffectsVol01, customUrl, {
          mode,
          bypassMute: mode === 'test'
        });
        announceAudioCue(cue, label);
        if (isLiveMatch && effectiveCrowdVol01 > 0.005) {
          audioController.swellCrowd(cue, mode === 'test', mode);
        }
      }

      if (canPlaySpeech) {
        speakFemaleBallCall(detectedDiff.type, {
          batterName: detectedDiff.batterName,
          rate: adminVoiceRate,
          volume01: effectiveVoiceVol01,
          onStart: () => setIsVoiceSpeaking(true),
          onEnd: () => setIsVoiceSpeaking(false)
        });
      }
    }

    const triggerTransitionCue = (
      cue: CricketCueType,
      label: string,
      delayMs: number,
      speechText?: string
    ) => {
      if (delayedCueTimerRef.current) {
        clearTimeout(delayedCueTimerRef.current);
        delayedCueTimerRef.current = null;
      }

      const fire = () => {
        const live = livePlaybackRef.current;
        if (!live.canPlayAudio) return;
        if (live.effectiveEffectsVol01 > 0.005) {
          audioController.playEffect(cue, live.effectiveEffectsVol01, undefined, {
            mode: live.mode,
            bypassMute: live.mode === 'test'
          });
          announceAudioCue(cue, label);
          if (live.isLiveMatch && live.effectiveCrowdVol01 > 0.005) {
            audioController.swellCrowd(cue, live.mode === 'test', live.mode);
          }
        }
        if (speechText && live.canPlaySpeech) {
          speakSynthesizedAlert(speechText, {
            urgent: true,
            delayMs: 120,
            rate: live.adminVoiceRate,
            volume01: live.effectiveVoiceVol01,
            onStart: () => setIsVoiceSpeaking(true),
            onEnd: () => setIsVoiceSpeaking(false)
          });
        }
      };

      if (delayMs > 0) {
        delayedCueTimerRef.current = setTimeout(() => {
          delayedCueTimerRef.current = null;
          fire();
        }, delayMs);
      } else {
        fire();
      }
    };

    if (gameStateChanged) {
      if (currSnapshot.gameState === 'completed') {
        const winMsg = match.statusText?.trim()
          ? `Match complete! ${match.statusText.trim()}`
          : 'Match complete!';
        triggerTransitionCue(
          'crowd-roar',
          'Match Result: Crowd Roar',
          ballStateChanged ? 1850 : 0,
          winMsg
        );
      } else if (currSnapshot.gameState === 'innings_break') {
        triggerTransitionCue(
          'umpire-break',
          'Innings Break: Umpire Signal',
          ballStateChanged ? 1600 : 0,
          'Innings break!'
        );
      } else if (currSnapshot.gameState === 'delayed') {
        triggerTransitionCue('umpire-break', 'Match Delay: Umpire Signal', 0, 'Play delayed.');
      } else if (
        currSnapshot.gameState === 'live' &&
        (prev.gameState === 'scheduled' ||
          prev.gameState === 'innings_break' ||
          prev.gameState === 'delayed')
      ) {
        triggerTransitionCue('umpire-signal', 'Play Live: Umpire Signal', 0);
      }
      return;
    }

    if (inningsChanged) {
      triggerTransitionCue('umpire-signal', 'New Innings: Umpire Signal', 0, 'Second innings underway.');
      return;
    }

    if (alertChanged && alertType) {
      if (MILESTONE_ROAR_ALERTS.has(alertType)) {
        triggerTransitionCue(
          'crowd-roar',
          'Milestone: Crowd Roar',
          ballStateChanged ? 1550 : 0
        );
      } else if (alertType === 'innings_break') {
        triggerTransitionCue(
          'umpire-break',
          'Innings Break: Umpire Signal',
          ballStateChanged ? 1500 : 0
        );
      } else if (alertType === 'match_starting') {
        triggerTransitionCue('umpire-signal', 'Match Starting: Umpire Signal', 0);
      }
      return;
    }

    if (enteredTightFinish) {
      triggerTransitionCue(
        'crowd-roar',
        'Tight Finish: Crowd Roar',
        ballStateChanged ? 1400 : 0
      );
    }
  }, [
    match,
    canPlayAudio,
    canPlaySpeech,
    effectiveEffectsVol01,
    effectiveCrowdVol01,
    effectiveVoiceVol01,
    adminVoiceRate,
    isLiveMatch,
    mode,
    customSounds?.fourUrl,
    customSounds?.sixUrl,
    customSounds?.wicketUrl,
    announceAudioCue
  ]);

  const toggleViewerSound = useCallback(async () => {
    const nextMuted = !audioPrefs.muted;
    const nextPrefs: StoredAudioPreferences = {
      ...audioPrefs,
      muted: nextMuted
    };
    if (!nextMuted) {
      await audioController.unlock();
      warmUpSpeechSynthesis();
      setAudioUnlockedTick((t) => t + 1);
    } else {
      cancelFemaleVoice();
      setIsVoiceSpeaking(false);
      audioController.stopAll();
    }
    setAudioPrefs(nextPrefs);
    audioController.updatePreferences(nextPrefs);
  }, [audioPrefs]);

  const toggleFemaleVoice = useCallback(() => {
    const next = !femaleVoiceEnabled;
    setFemaleVoiceEnabled(next);
    writeFemaleVoiceEnabled(next);
    if (!next) {
      cancelFemaleVoice();
      setIsVoiceSpeaking(false);
    } else {
      warmUpSpeechSynthesis();
    }
  }, [femaleVoiceEnabled]);

  const setEffectsVolume = useCallback(
    async (nextVol: number) => {
      const clamped = clampPct(nextVol, 85);
      const nextPrefs: StoredAudioPreferences = {
        ...audioPrefs,
        effectsVolume: clamped
      };
      if (!nextPrefs.muted) {
        await audioController.unlock();
      }
      setAudioPrefs(nextPrefs);
      audioController.updatePreferences(nextPrefs);
    },
    [audioPrefs]
  );

  const setCrowdVolume = useCallback(
    async (nextVol: number) => {
      const clamped = clampPct(nextVol, 75);
      const nextPrefs: StoredAudioPreferences = {
        ...audioPrefs,
        crowdVolume: clamped
      };
      if (!nextPrefs.muted) {
        await audioController.unlock();
      }
      setAudioPrefs(nextPrefs);
      audioController.updatePreferences(nextPrefs);
    },
    [audioPrefs]
  );

  const unlockAudio = useCallback(async () => {
    const ok = await audioController.unlock();
    if (ok) setAudioUnlockedTick((t) => t + 1);
    return ok;
  }, []);

  const isCrowdActive = canPlayAudio && isLiveMatch && effectiveCrowdVol01 > 0.005;

  return {
    isSoundOn,
    isMuted: audioPrefs.muted,
    canPlayAudio,
    isCrowdActive,
    femaleVoiceEnabled,
    isVoiceSpeaking,
    lastAudioCue,
    adminSoundEnabled: adminBroadcastEnabled,
    effectsVolume: audioPrefs.effectsVolume,
    crowdVolume: audioPrefs.crowdVolume,
    prefersReducedMotion,
    toggleViewerSound,
    toggleFemaleVoice,
    setEffectsVolume,
    setCrowdVolume,
    unlockAudio
  };
}

