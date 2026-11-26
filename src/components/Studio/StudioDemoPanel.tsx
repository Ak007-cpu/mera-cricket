import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MatchState, MonetizationConfig } from '../../types/cricket';
import { BroadcastView } from '../Broadcast/BroadcastView';
import { AndroidAppView } from '../AndroidApp/AndroidAppView';
import { OBSOverlay } from '../OBS/OBSOverlay';
import {
  DemoSpeed,
  DemoBallOutcome,
  SPEED_MS,
  createInitialDemoMatch,
  simulateDemoDelivery
} from '../../utils/demoMatchSimulator';
import {
  FlaskConical,
  Play,
  Pause,
  RotateCcw,
  Zap,
  ShieldCheck,
  Gauge,
  Tv,
  Layers,
  Smartphone,
  EyeOff
} from 'lucide-react';

export type { DemoSpeed, DemoBallOutcome };

interface StudioDemoPanelProps {
  realMatch: MatchState | null;
  animationsEnabled?: boolean;
  monetization?: MonetizationConfig | null;
}

export const StudioDemoPanel: React.FC<StudioDemoPanelProps> = ({
  realMatch,
  animationsEnabled = true,
  monetization = null
}) => {
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [previewNoMatch, setPreviewNoMatch] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [speed, setSpeed] = useState<DemoSpeed>('normal');
  const [previewSurface, setPreviewSurface] = useState<'broadcast' | 'mobile' | 'obs'>('broadcast');
  const [demoMatch, setDemoMatch] = useState<MatchState>(() => createInitialDemoMatch());
  const [lastTriggeredLabel, setLastTriggeredLabel] = useState<string>('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pendingTestTimerRef.current) clearTimeout(pendingTestTimerRef.current);
    };
  }, []);

  const handleToggleDemoMode = () => {
    setDemoEnabled((prev) => {
      const next = !prev;
      if (next) {
        setPreviewNoMatch(false);
        setAutoPlay(true);
        setLastTriggeredLabel('Demo Mode ON — Team A vs Team B running');
      } else {
        setLastTriggeredLabel('Demo Mode OFF — Reverted to Live Data');
      }
      return next;
    });
  };

  const handleToggleNoMatchPreview = () => {
    setPreviewNoMatch((prev) => {
      const next = !prev;
      if (next) {
        setDemoEnabled(false);
        setAutoPlay(false);
        setLastTriggeredLabel('Previewing No-Match Animation Screen');
      } else {
        setLastTriggeredLabel('No-Match Preview closed');
      }
      return next;
    });
  };

  const triggerSingleDemoBall = useCallback(
    (outcome: DemoBallOutcome, label: string) => {
      setPreviewNoMatch(false);
      if (!demoEnabled) {
        // First mount Demo baseline so Auto Ball Animation diffs cleanly from baseline -> test ball
        setDemoEnabled(true);
        setAutoPlay(false);
        if (pendingTestTimerRef.current) clearTimeout(pendingTestTimerRef.current);
        pendingTestTimerRef.current = setTimeout(() => {
          setDemoMatch((prev) => simulateDemoDelivery(prev, outcome));
          setLastTriggeredLabel(`Triggered: ${label}`);
        }, 60);
        return;
      }
      setDemoMatch((prev) => simulateDemoDelivery(prev, outcome));
      setLastTriggeredLabel(`Triggered: ${label}`);
    },
    [demoEnabled]
  );

  const handleResetDemo = () => {
    setPreviewNoMatch(false);
    setDemoMatch(createInitialDemoMatch());
    setLastTriggeredLabel('Demo Match Reset (Team A 128/3 • 14.2 ov)');
  };

  // Automatic ball-by-ball engine while Demo Mode is ON & Auto-Play is active
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!demoEnabled || !autoPlay) return;

    timerRef.current = setInterval(() => {
      setDemoMatch((prev) => simulateDemoDelivery(prev));
    }, SPEED_MS[speed]);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [demoEnabled, autoPlay, speed]);

  const previewMatch = previewNoMatch ? null : demoEnabled ? demoMatch : realMatch;

  return (
    <div className="space-y-5">
      {/* Control Header & Public Isolation Guarantee */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <FlaskConical className="w-5 h-5 text-violet-400" />
              <h2 className="text-lg font-black text-white tracking-tight">
                Demo / Test Mode (Animation Studio)
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  demoEnabled
                    ? 'bg-violet-500/20 text-violet-300 border-violet-400/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {demoEnabled ? 'DEMO ACTIVE (ADMIN PREVIEW)' : 'DEMO OFF (REAL CREX DATA)'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Bina asli match ke har ball animation (SINGLE, FOUR!, SIX!, WICKET!, WIDE!, DOT) aur live broadcast graphics test karein.
            </p>
          </div>

          {/* Demo Mode ON/OFF + Preview No-Match Screen Button */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleNoMatchPreview}
              aria-pressed={previewNoMatch}
              className={`px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 border transition-all ${
                previewNoMatch
                  ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-300 shadow-lg shadow-sky-900/40'
                  : 'bg-slate-950 hover:bg-slate-800 text-sky-300 border-sky-500/40'
              }`}
            >
              <EyeOff className="w-4 h-4" />
              <span>{previewNoMatch ? 'Exit No-Match Preview' : 'Preview No-Match Screen'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleDemoMode}
              role="switch"
              aria-checked={demoEnabled}
              className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-3 border transition-all ${
                demoEnabled
                  ? 'bg-violet-600 hover:bg-violet-500 text-white border-violet-300 shadow-lg shadow-violet-900/50'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <span
                className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors ${
                  demoEnabled ? 'bg-emerald-400 justify-end' : 'bg-slate-700 justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-slate-950 shadow" />
              </span>
              <span>Demo Mode: {demoEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Public Safety / Isolation Notice */}
        <div className="bg-emerald-950/25 border border-emerald-500/30 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Public View Safe:</strong> Demo Mode sirf is Admin Preview mein chalta hai. Public viewers ko hamesha asli CREX data ya{' '}
            <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300">"No live match right now"</code> dikhega.
          </span>
        </div>

        {/* Speed Selector & Playback Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
          {/* Speed Option: Slow / Normal / Fast */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-sky-400" />
              <span>Speed:</span>
            </span>
            <div className="flex items-center gap-1.5">
              {(['slow', 'normal', 'fast'] as DemoSpeed[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSpeed(opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all border ${
                    speed === opt
                      ? 'bg-sky-600 text-white border-sky-400 shadow'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {opt} ({opt === 'slow' ? '5.5s' : opt === 'normal' ? '3.5s' : '1.5s'})
                </button>
              ))}
            </div>
          </div>

          {/* Auto Ball Loop + Reset */}
          <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-300 font-semibold truncate">
              {lastTriggeredLabel ||
                (demoEnabled
                  ? `Running Team A vs Team B (${demoMatch.battingTeam.score.runs}/${demoMatch.battingTeam.score.wickets})`
                  : 'Demo OFF — Toggle Demo Mode ON or click a Test button')}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {demoEnabled && (
                <button
                  type="button"
                  onClick={() => setAutoPlay((p) => !p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                    autoPlay
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 hover:bg-amber-500/30'
                      : 'bg-emerald-600 text-white border-emerald-400 hover:bg-emerald-500'
                  }`}
                >
                  {autoPlay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{autoPlay ? 'Pause Auto Balls' : 'Resume Auto Balls'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleResetDemo}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Match</span>
              </button>
            </div>
          </div>
        </div>

        {/* One-Shot Animation Test Buttons */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>One-Click Ball Animation Triggers</span>
            </span>
            <span className="text-[11px] text-slate-400">
              Har button us delivery ki exact broadcast animation turant chalata hai
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => triggerSingleDemoBall('4', 'FOUR!')}
              className="px-4 py-2 rounded-xl bg-blue-600/25 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/50 font-black text-xs transition-all"
            >
              Test Four
            </button>
            <button
              type="button"
              onClick={() => triggerSingleDemoBall('6', 'SIX!')}
              className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-slate-950 border border-amber-400/50 font-black text-xs transition-all"
            >
              Test Six
            </button>
            <button
              type="button"
              onClick={() => triggerSingleDemoBall('wicket', 'WICKET!')}
              className="px-4 py-2 rounded-xl bg-rose-600/25 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/50 font-black text-xs transition-all"
            >
              Test Wicket
            </button>
            <button
              type="button"
              onClick={() => triggerSingleDemoBall('dot', 'DOT BALL')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-black text-xs transition-all"
            >
              Test Dot
            </button>
            <button
              type="button"
              onClick={() => triggerSingleDemoBall('wide', 'WIDE!')}
              className="px-4 py-2 rounded-xl bg-cyan-600/25 hover:bg-cyan-600 text-cyan-200 hover:text-white border border-cyan-500/50 font-black text-xs transition-all"
            >
              Test Wide
            </button>
            <button
              type="button"
              onClick={() => triggerSingleDemoBall('1', 'SINGLE (+1)')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 font-bold text-xs transition-all"
            >
              Test Single
            </button>
            <button
              type="button"
              onClick={() => triggerSingleDemoBall('no-ball', 'NO BALL!')}
              className="px-3.5 py-2 rounded-xl bg-orange-600/20 hover:bg-orange-600 text-orange-200 hover:text-white border border-orange-500/40 font-bold text-xs transition-all"
            >
              Test No Ball
            </button>
          </div>
        </div>
      </div>

      {/* Live Preview Stage inside Admin */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                demoEnabled ? 'bg-violet-400 animate-ping' : realMatch ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span className="text-xs font-black uppercase tracking-wider text-white">
              {previewNoMatch
                ? 'No-Match Animation Preview (Demo Preview)'
                : demoEnabled
                ? 'Live Demo Preview (Team A vs Team B)'
                : realMatch
                ? `Real Feed Preview (${realMatch.title})`
                : 'Real Feed Preview (No Live Match)'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 flex-wrap">
            <button
              type="button"
              onClick={() => setPreviewSurface('broadcast')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                previewSurface === 'broadcast'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Broadcast View</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewSurface('mobile')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                previewSurface === 'mobile'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile App</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewSurface('obs')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                previewSurface === 'obs'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>OBS Lower-Third</span>
            </button>
          </div>
        </div>

        {!animationsEnabled && (
          <div className="mx-4 mt-3 px-3.5 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200">
            Admin Panel mein <strong>Ball Animation: OFF</strong> hai. Animations dekhne ke liye upar Ball Animation switch ON karein.
          </div>
        )}

        {/* Containing block (transform) scopes fixed broadcast flashes & banners neatly inside the preview box */}
        <div className="relative overflow-hidden bg-[#030712] [transform:translateZ(0)]">
          {previewSurface === 'broadcast' ? (
            <BroadcastView
              match={previewMatch}
              monetization={monetization}
              isLoading={false}
              isDemoPreview={true}
              ignoreHoldScreen={!previewNoMatch}
              animationsEnabled={animationsEnabled}
            />
          ) : previewSurface === 'mobile' ? (
            <div className="py-5 px-3 bg-slate-950 flex justify-center">
              <div className="w-[375px] h-[667px] rounded-[2rem] overflow-hidden border-2 border-slate-700 shadow-2xl bg-[#030712]">
                <AndroidAppView
                  match={previewMatch}
                  config={null}
                  monetization={monetization}
                  isLoading={false}
                  onRefresh={() => {}}
                />
              </div>
            </div>
          ) : (
            <div className="p-4 bg-[repeating-conic-gradient(#0f172a_0%_25%,#020617_0%_50%)] [background-size:24px_24px]">
              {previewMatch ? (
                <OBSOverlay
                  match={previewMatch}
                  isDemoPreview={true}
                  animationsEnabled={animationsEnabled}
                />
              ) : (
                <div className="h-[220px] flex items-center justify-center text-xs text-slate-400">
                  OBS Overlay transparent standby (No-Match animation yahan nahi dikhti)
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
