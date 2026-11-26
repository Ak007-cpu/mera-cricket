import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MatchState, MonetizationConfig } from '../../types/cricket';
import { BroadcastView } from '../Broadcast/BroadcastView';
import {
  DemoBallOutcome,
  DemoMatchStatePreset,
  createInitialDemoMatch,
  createDemoPresetMatch,
  simulateDemoDelivery
} from '../../utils/demoMatchSimulator';
import { Play, Pause, RotateCcw, Tv, X, Zap, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { audioController } from '../../utils/AudioController';
import {
  cancelFemaleVoice,
  readFemaleVoiceEnabled,
  warmUpSpeechSynthesis,
  writeFemaleVoiceEnabled
} from '../../utils/femaleVoiceAnnouncer';

interface StudioBroadcastTestViewProps {
  monetization: MonetizationConfig | null;
  animationsEnabled: boolean;
  onEnableAnimations?: () => void;
  onClose: () => void;
}

export const StudioBroadcastTestView: React.FC<StudioBroadcastTestViewProps> = ({
  monetization,
  animationsEnabled,
  onEnableAnimations,
  onClose
}) => {
  const [simulatedMatch, setSimulatedMatch] = useState<MatchState | null>(() =>
    createInitialDemoMatch()
  );
  const [activePreset, setActivePreset] = useState<DemoMatchStatePreset>('live_chase');
  const [autoPlay, setAutoPlay] = useState(false);
  const [testAudioEnabled, setTestAudioEnabled] = useState(true);
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState<boolean>(() => readFemaleVoiceEnabled());
  const [lastEventLabel, setLastEventLabel] = useState('Ready — Trigger any ball or match state below');

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoIntervalRef.current) {
      clearInterval(autoIntervalRef.current);
      autoIntervalRef.current = null;
    }
    if (!autoPlay) return;

    autoIntervalRef.current = setInterval(() => {
      setSimulatedMatch((prev) => {
        if (!prev || prev.gameState !== 'live') {
          return createInitialDemoMatch();
        }
        return simulateDemoDelivery(prev);
      });
    }, 3200);

    return () => {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    };
  }, [autoPlay]);

  const handleTriggerBall = useCallback(
    (outcome: DemoBallOutcome, label: string) => {
      if (testAudioEnabled) {
        audioController.unlock();
        if (voiceAlertsEnabled) {
          warmUpSpeechSynthesis();
        }
      }
      setActivePreset('live_chase');
      if (!simulatedMatch || simulatedMatch.gameState !== 'live') {
        const baseline = createInitialDemoMatch();
        setSimulatedMatch(baseline);
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = setTimeout(() => {
          setSimulatedMatch((curr) =>
            simulateDemoDelivery(curr || baseline, outcome)
          );
          setLastEventLabel(`Triggered: ${label}`);
        }, 60);
        return;
      }

      setSimulatedMatch((prev) =>
        simulateDemoDelivery(prev || createInitialDemoMatch(), outcome)
      );
      setLastEventLabel(`Triggered: ${label}`);
    },
    [simulatedMatch, testAudioEnabled, voiceAlertsEnabled]
  );

  const handleSelectPreset = useCallback(
    (preset: DemoMatchStatePreset, label: string) => {
      if (testAudioEnabled) {
        audioController.unlock();
        if (voiceAlertsEnabled) {
          warmUpSpeechSynthesis();
        }
      }
      setAutoPlay(false);
      setActivePreset(preset);
      setSimulatedMatch(createDemoPresetMatch(preset));
      setLastEventLabel(`State: ${label}`);
    },
    [testAudioEnabled, voiceAlertsEnabled]
  );

  const handleReset = () => {
    setAutoPlay(false);
    setActivePreset('live_chase');
    setSimulatedMatch(createInitialDemoMatch());
    setLastEventLabel('Reset to Live Chase (128/3 · 14.2 ov)');
  };

  return (
    <section
      aria-label="Broadcast Test View"
      className="bg-slate-900 border border-sky-500/40 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Top Bar */}
      <div className="px-4 py-3 sm:px-5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Tv className="w-4 h-4 text-sky-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate">
              Broadcast Test View
            </h2>
            <p className="text-xs text-slate-400 truncate tabular-nums">
              {simulatedMatch
                ? `${simulatedMatch.battingTeam.shortName} ${simulatedMatch.battingTeam.score.runs}/${simulatedMatch.battingTeam.score.wickets} (${simulatedMatch.battingTeam.score.overs}.${simulatedMatch.battingTeam.score.balls} ov) · ${lastEventLabel}`
                : `No Live Match State · ${lastEventLabel}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const next = !testAudioEnabled;
              if (next) {
                audioController.unlock();
                if (voiceAlertsEnabled) warmUpSpeechSynthesis();
              } else {
                cancelFemaleVoice();
                audioController.stopAll();
              }
              setTestAudioEnabled(next);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              testAudioEnabled
                ? 'bg-emerald-600/25 text-emerald-200 border-emerald-400/50 hover:bg-emerald-600/35'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            {testAudioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{testAudioEnabled ? 'Test Sound: ON' : 'Test Sound: OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !voiceAlertsEnabled;
              setVoiceAlertsEnabled(next);
              writeFemaleVoiceEnabled(next);
              if (next) {
                warmUpSpeechSynthesis();
              } else {
                cancelFemaleVoice();
              }
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              voiceAlertsEnabled
                ? 'bg-sky-600/25 text-sky-200 border-sky-400/50 hover:bg-sky-600/35'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            {voiceAlertsEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            <span>{voiceAlertsEnabled ? 'Voice Alerts: ON' : 'Voice Alerts: OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setAutoPlay((p) => !p)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              autoPlay
                ? 'bg-amber-500/20 text-amber-200 border-amber-400/50 hover:bg-amber-500/30'
                : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
            }`}
          >
            {autoPlay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoPlay ? 'Pause Auto' : 'Auto Simulate'}</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Trigger Controls */}
      <div className="p-4 sm:p-5 space-y-4 border-b border-slate-800 bg-slate-900/95">
        {!animationsEnabled && (
          <div className="px-3.5 py-2.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2">
            <span>
              Ball Animation is currently OFF — turn it ON to verify Broadcast flash &amp; zoom overlays.
            </span>
            {onEnableAnimations && (
              <button
                type="button"
                onClick={onEnableAnimations}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0"
              >
                Enable Ball Animations
              </button>
            )}
          </div>
        )}

        {/* Delivery / Animation Triggers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Animation Triggers (Zero API)</span>
            </span>
            <span className="text-xs text-slate-400">
              Click any outcome to trigger Broadcast overlay
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleTriggerBall('wicket', 'WICKET!')}
              className="px-4 py-2 rounded-xl bg-rose-600/25 hover:bg-rose-600 text-rose-100 hover:text-white border border-rose-500/50 font-bold text-xs whitespace-nowrap shrink-0 transition-colors"
            >
              Wicket
            </button>
            <button
              type="button"
              onClick={() => handleTriggerBall('6', 'SIX!')}
              className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-slate-950 border border-amber-400/50 font-bold text-xs whitespace-nowrap shrink-0 transition-colors"
            >
              Six
            </button>
            <button
              type="button"
              onClick={() => handleTriggerBall('4', 'FOUR!')}
              className="px-4 py-2 rounded-xl bg-blue-600/25 hover:bg-blue-600 text-blue-100 hover:text-white border border-blue-500/50 font-bold text-xs whitespace-nowrap shrink-0 transition-colors"
            >
              Four
            </button>
            <button
              type="button"
              onClick={() => handleTriggerBall('1', 'SINGLE')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 font-bold text-xs whitespace-nowrap shrink-0 transition-colors"
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => handleTriggerBall('2', 'TWO RUNS')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/35 font-bold text-xs whitespace-nowrap shrink-0 transition-colors"
            >
              2 Runs
            </button>
            <button
              type="button"
              onClick={() => handleTriggerBall('3', 'THREE RUNS')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/35 font-bold text-xs whitespace-nowrap shrink-0 transition-colors"
            >
              3 Runs
            </button>
            <button
              type="button"
              onClick={() => handleTriggerBall('dot', 'DOT BALL')}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs whitespace-nowrap shrink-0 transition-colors"
            >
              Dot Ball
            </button>
            <button
              type="button"
              onClick={() => handleTriggerBall('wide', 'WIDE!')}
              className="px-3.5 py-2 rounded-xl bg-cyan-600/25 hover:bg-cyan-600 text-cyan-200 hover:text-white border border-cyan-500/50 font-bold text-xs whitespace-nowrap shrink-0 transition-colors"
            >
              Wide
            </button>
            <button
              type="button"
              onClick={() => handleTriggerBall('no-ball', 'NO BALL!')}
              className="px-3.5 py-2 rounded-xl bg-orange-600/20 hover:bg-orange-600 text-orange-200 hover:text-white border border-orange-500/40 font-bold text-xs whitespace-nowrap shrink-0 transition-colors"
            >
              No Ball
            </button>
          </div>
        </div>

        {/* Match State Presets */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-400">Match States:</span>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'live_chase', label: 'Live Chase' },
                { id: 'tight_finish', label: 'Tight Finish' },
                { id: 'innings_break', label: 'Innings Break' },
                { id: 'match_won', label: 'Match Result' },
                { id: 'no_match', label: 'No Match' }
              ] as { id: DemoMatchStatePreset; label: string }[]
            ).map((preset) => {
              const active = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id, preset.label)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-sky-600 text-white border-sky-400'
                      : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Embedded Broadcast View Container (isolated from public viewers & API) */}
      <div className="relative overflow-hidden bg-[#030712] [transform:translateZ(0)] max-h-[720px] overflow-y-auto">
        <BroadcastView
          match={simulatedMatch}
          monetization={monetization}
          isLoading={false}
          isDemoPreview={true}
          ignoreHoldScreen={true}
          hideAppDownload={true}
          animationsEnabled={animationsEnabled}
          testAudioEnabled={testAudioEnabled}
        />
      </div>
    </section>
  );
};
