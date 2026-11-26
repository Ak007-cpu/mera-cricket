import React, { useState, useEffect, useMemo } from 'react';
import { MatchState } from '../../types/cricket';
import { calculateDlsTarget, DlsResourceInput } from '../../utils/dlsCalculator';
import { editMatchDetails } from '../../services/api';
import { Calculator, CloudRain, Target, CheckCircle2, RotateCcw, Send, Sparkles, AlertCircle, Info, ShieldAlert } from 'lucide-react';

interface DlsTargetCalculatorProps {
  match: MatchState | null;
  adminPin: string;
  isAuthorized: boolean;
  onRefresh: () => void;
}

export const DlsTargetCalculator: React.FC<DlsTargetCalculatorProps> = ({
  match,
  adminPin,
  isAuthorized,
  onRefresh
}) => {
  // Format & Base Settings
  const [format, setFormat] = useState<'T20' | 'ODI' | 'T10' | 'CUSTOM'>(
    match?.matchType === 'ODI' ? 'ODI' : match?.matchType === 'T10' ? 'T10' : 'T20'
  );
  const [originalOvers, setOriginalOvers] = useState<number>(
    match?.matchType === 'ODI' ? 50 : match?.matchType === 'T10' ? 10 : 20
  );

  // Scenario
  const [scenario, setScenario] = useState<'before_innings2' | 'during_innings2' | 'during_innings1'>('before_innings2');

  // Team 1 Parameters
  const [team1Runs, setTeam1Runs] = useState<number>(() => {
    if (match?.currentInnings === 2 && match.bowlingTeam.score.runs > 0) {
      return match.bowlingTeam.score.runs;
    }
    return match?.battingTeam.score.runs || (format === 'ODI' ? 280 : 175);
  });
  const [team1OversFaced, setTeam1OversFaced] = useState<number>(originalOvers);
  const [team1WicketsLost, setTeam1WicketsLost] = useState<number>(4);
  const [team1AllOut, setTeam1AllOut] = useState<boolean>(false);

  // Team 2 Parameters
  const [team2RevisedOvers, setTeam2RevisedOvers] = useState<number>(() => {
    return Math.max(5, originalOvers - (originalOvers <= 20 ? 4 : 10));
  });
  const [team2OversCompleted, setTeam2OversCompleted] = useState<number>(() => {
    if (match?.currentInnings === 2) {
      return match.battingTeam.score.overs + match.battingTeam.score.balls / 10;
    }
    return 0;
  });
  const [team2WicketsLost, setTeam2WicketsLost] = useState<number>(() => {
    if (match?.currentInnings === 2) {
      return match.battingTeam.score.wickets;
    }
    return 0;
  });
  const [team2CurrentRuns, setTeam2CurrentRuns] = useState<number>(() => {
    if (match?.currentInnings === 2) {
      return match.battingTeam.score.runs;
    }
    return 0;
  });

  const [g50, setG50] = useState<number>(originalOvers <= 20 ? 160 : 245);
  const [isApplying, setIsApplying] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Auto-fill from match whenever active match changes or button clicked
  const autoFillFromMatch = () => {
    if (!match) return;

    const fmt = match.matchType === 'ODI' ? 'ODI' : match.matchType === 'T10' ? 'T10' : 'T20';
    const orig = fmt === 'ODI' ? 50 : fmt === 'T10' ? 10 : 20;

    setFormat(fmt);
    setOriginalOvers(orig);
    setG50(orig <= 20 ? 160 : 245);

    if (match.currentInnings === 2) {
      // Team 2 is batting
      const t1Score = match.bowlingTeam.score.runs > 0 ? match.bowlingTeam.score.runs : match.target ? match.target - 1 : 180;
      setTeam1Runs(t1Score);
      setTeam1OversFaced(orig);
      setTeam1WicketsLost(match.bowlingTeam.score.wickets || 5);
      setTeam2CurrentRuns(match.battingTeam.score.runs);
      setTeam2WicketsLost(match.battingTeam.score.wickets);
      setTeam2OversCompleted(match.battingTeam.score.overs + match.battingTeam.score.balls / 10);
      setScenario('during_innings2');
    } else {
      // Team 1 is batting
      setTeam1Runs(match.battingTeam.score.runs || 180);
      setTeam1OversFaced(match.battingTeam.score.overs + match.battingTeam.score.balls / 10 || orig);
      setTeam1WicketsLost(match.battingTeam.score.wickets || 3);
      setScenario('before_innings2');
    }

    setFeedback({ text: 'Parameters populated from current live match state!', type: 'success' });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Perform Calculation
  const calculation = useMemo(() => {
    const input: DlsResourceInput = {
      format,
      originalOvers,
      team1Runs,
      team1OversFaced,
      team1WicketsLost,
      team1AllOut,
      scenario,
      team2RevisedOvers,
      team2OversCompleted,
      team2WicketsLost,
      team2CurrentRuns,
      customG50: g50
    };
    return calculateDlsTarget(input);
  }, [
    format,
    originalOvers,
    team1Runs,
    team1OversFaced,
    team1WicketsLost,
    team1AllOut,
    scenario,
    team2RevisedOvers,
    team2OversCompleted,
    team2WicketsLost,
    team2CurrentRuns,
    g50
  ]);

  // Apply DLS Target to Broadcast Overlay and server
  const handleApplyToBroadcast = async () => {
    if (!isAuthorized) {
      setFeedback({ text: 'Admin authorization required to apply DLS target.', type: 'error' });
      return;
    }

    setIsApplying(true);
    try {
      const dlsPayload = {
        applied: true,
        originalOvers,
        revisedOvers: team2RevisedOvers,
        wicketsLostAtInterruption: scenario === 'during_innings2' ? team2WicketsLost : undefined,
        oversAtInterruption: scenario === 'during_innings2' ? team2OversCompleted : undefined,
        firstInningsTotal: team1Runs,
        firstInningsOvers: team1OversFaced,
        revisedTarget: calculation.revisedTarget,
        parScore: calculation.parScore,
        resourceRemainingPercent: calculation.team2ResourcePercentage,
        interruptionInnings: (scenario === 'during_innings1' ? 1 : 2) as 1 | 2,
        notes: `DLS Target: ${calculation.revisedTarget} in ${team2RevisedOvers} overs (R1: ${calculation.team1ResourcePercentage}%, R2: ${calculation.team2ResourcePercentage}%)`
      };

      const statusText = `${match?.battingTeam.name || 'Batting Team'} need ${Math.max(0, calculation.revisedTarget - team2CurrentRuns)} runs in ${calculation.remainingBalls} balls (DLS Target: ${calculation.revisedTarget} in ${team2RevisedOvers} ov)`;

      await editMatchDetails(
        {
          target: calculation.revisedTarget,
          statusText,
          dlsDetails: dlsPayload
        },
        adminPin
      );

      setFeedback({
        text: `DLS Target of ${calculation.revisedTarget} runs (${team2RevisedOvers} ov) pushed live to Broadcast & OBS!`,
        type: 'success'
      });
      onRefresh();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Failed to update broadcast DLS target', type: 'error' });
    } finally {
      setIsApplying(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Reset / Clear DLS from Match
  const handleResetDls = async () => {
    if (!isAuthorized) return;
    setIsApplying(true);
    try {
      await editMatchDetails(
        {
          dlsDetails: null,
          statusText: `${match?.battingTeam.name || 'Match'} Live • Regular Match Equation Restored`
        },
        adminPin
      );
      setFeedback({ text: 'DLS Target cleared. Regular match equation restored on Broadcast & OBS.', type: 'success' });
      onRefresh();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Failed to reset DLS', type: 'error' });
    } finally {
      setIsApplying(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const isDlsActiveOnMatch = Boolean(match?.dlsDetails?.applied);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border border-blue-500/30 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs border border-blue-500/30 flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5" />
              <span>ICC DLS TARGET ENGINE</span>
            </span>
            {isDlsActiveOnMatch && (
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs border border-purple-500/30 flex items-center gap-1 animate-pulse">
                <CloudRain className="w-3.5 h-3.5" />
                <span>DLS ACTIVE ON BROADCAST</span>
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Duckworth-Lewis-Stern Target Calculator
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Calculates revised targets, par scores, and resource percentages for rain-affected limited overs matches, and updates Broadcast and OBS overlays in real time.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={autoFillFromMatch}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Sync from Active Match</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/50 border border-rose-800 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Main Grid: Parameters on Left, Calculated Result on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Match & Rain Delay Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Match Format & Scenarios */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-blue-400" />
              <span>1. Match Format & Interruption Scenario</span>
            </h3>

            {/* Format Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormat('T20');
                  setOriginalOvers(20);
                  setG50(160);
                  setTeam2RevisedOvers(15);
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                  format === 'T20'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                T20 (20 Overs)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormat('ODI');
                  setOriginalOvers(50);
                  setG50(245);
                  setTeam2RevisedOvers(35);
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                  format === 'ODI'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                ODI (50 Overs)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormat('T10');
                  setOriginalOvers(10);
                  setG50(90);
                  setTeam2RevisedOvers(7);
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                  format === 'T10'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                T10 (10 Overs)
              </button>
            </div>

            {/* Scenario Selection */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400">Rain Interruption Scenario:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setScenario('before_innings2')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    scenario === 'before_innings2'
                      ? 'bg-blue-950/60 border-blue-500/80 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-white">Before 2nd Innings</div>
                  <div className="text-[11px] text-slate-400">Match truncated before chase starts</div>
                </button>

                <button
                  type="button"
                  onClick={() => setScenario('during_innings2')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    scenario === 'during_innings2'
                      ? 'bg-blue-950/60 border-blue-500/80 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-white">During 2nd Innings</div>
                  <div className="text-[11px] text-slate-400">Play stopped mid-chase (Par score active)</div>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: 1st Innings Score & Overs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>2. First Innings (Team 1 Total)</span>
              <span className="text-blue-400 text-[11px] font-mono">
                {match?.bowlingTeam.name || 'Team 1'}
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                  Total Runs Scored (S):
                </label>
                <input
                  type="number"
                  min={0}
                  value={team1Runs}
                  onChange={(e) => setTeam1Runs(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                  Overs Faced:
                </label>
                <input
                  type="number"
                  min={1}
                  max={originalOvers}
                  step={0.1}
                  value={team1OversFaced}
                  onChange={(e) => setTeam1OversFaced(Math.min(originalOvers, Math.max(1, parseFloat(e.target.value) || originalOvers)))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                  Wickets Lost:
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={team1WicketsLost}
                  onChange={(e) => setTeam1WicketsLost(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 pt-1">
              <input
                type="checkbox"
                checked={team1AllOut || team1WicketsLost === 10}
                onChange={(e) => setTeam1AllOut(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700"
              />
              <span>Team 1 All Out (Resources 100% consumed)</span>
            </label>
          </div>

          {/* Section 3: 2nd Innings Allotment & Interruption State */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                3. Second Innings Revised Allotment
              </h3>
              <span className="text-emerald-400 text-[11px] font-mono">
                {match?.battingTeam.name || 'Team 2 Chasing'}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-bold">Revised Total Overs for Team 2:</span>
                <span className="text-blue-400 font-mono font-black text-sm">{team2RevisedOvers} Overs</span>
              </div>
              <input
                type="range"
                min={originalOvers <= 20 ? 5 : 20}
                max={originalOvers}
                value={team2RevisedOvers}
                onChange={(e) => setTeam2RevisedOvers(parseInt(e.target.value) || originalOvers)}
                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>Min: {originalOvers <= 20 ? 5 : 20} ov</span>
                <span>Reduced Overs</span>
                <span>Max: {originalOvers} ov</span>
              </div>
            </div>

            {/* If Interruption occurred DURING 2nd innings */}
            {scenario === 'during_innings2' && (
              <div className="p-3.5 bg-slate-950/70 rounded-xl border border-blue-500/30 space-y-3">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>State at Time of Play Stoppage (Team 2):</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                      Overs Bowled:
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={team2RevisedOvers}
                      step={0.1}
                      value={team2OversCompleted}
                      onChange={(e) => setTeam2OversCompleted(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                      Wickets Down:
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={9}
                      value={team2WicketsLost}
                      onChange={(e) => setTeam2WicketsLost(Math.min(9, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                      Current Runs:
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={team2CurrentRuns}
                      onChange={(e) => setTeam2CurrentRuns(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Calculation & Overlay Broadcast Action (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Main Calculation Card */}
          <div className="bg-gradient-to-b from-blue-950/90 to-slate-900/90 border-2 border-blue-500/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-amber-400" />
                  <span>DLS Calculated Result</span>
                </span>
                <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {format} • {team2RevisedOvers} Ov
                </span>
              </div>

              {/* Giant Revised Target Display */}
              <div className="bg-slate-950/80 p-5 rounded-2xl border border-blue-500/30 text-center space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Official Revised Target
                </span>
                <div className="text-5xl sm:text-6xl font-black text-amber-300 font-mono tracking-tight drop-shadow-md">
                  {calculation.revisedTarget}
                </div>
                <div className="text-xs text-slate-300 font-mono pt-1">
                  To win from <strong>{team2RevisedOvers} Overs</strong> (Tie: {calculation.tieTarget})
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Required Run Rate:</span>
                  <span className="text-emerald-400 font-bold text-lg mt-0.5 block">
                    {calculation.requiredRunRate.toFixed(2)} RPO
                  </span>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Balls Remaining:</span>
                  <span className="text-white font-bold text-lg mt-0.5 block">
                    {calculation.remainingBalls} Balls
                  </span>
                </div>

                {scenario === 'during_innings2' && (
                  <div className="col-span-2 bg-purple-950/40 p-3 rounded-xl border border-purple-500/40 flex items-center justify-between">
                    <div>
                      <span className="text-purple-300 block text-[11px] font-bold">Current DLS Par Score:</span>
                      <span className="text-[10px] text-slate-400">At {team2OversCompleted} ov ({team2WicketsLost} wkts)</span>
                    </div>
                    <span className="text-2xl font-black text-purple-200 font-mono">
                      {calculation.parScore} Runs
                    </span>
                  </div>
                )}
              </div>

              {/* Resource Percentages Breakdown */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Team 1 Resources (R1):</span>
                  <strong className="text-white">{calculation.team1ResourcePercentage}%</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Team 2 Resources (R2):</span>
                  <strong className="text-white">{calculation.team2ResourcePercentage}%</strong>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden flex">
                  <div
                    style={{ width: `${Math.min(100, calculation.team2ResourcePercentage)}%` }}
                    className="bg-blue-500 h-full"
                  />
                </div>
              </div>
            </div>

            {/* Actions: Push to Broadcast vs Clear */}
            <div className="space-y-2 pt-6">
              <button
                type="button"
                onClick={handleApplyToBroadcast}
                disabled={!isAuthorized || isApplying}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isApplying ? 'Applying to Overlays...' : 'Apply DLS Target to Broadcast & OBS'}</span>
              </button>

              {isDlsActiveOnMatch && (
                <button
                  type="button"
                  onClick={handleResetDls}
                  disabled={!isAuthorized || isApplying}
                  className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>Clear DLS from Broadcast (Restore Regular Target)</span>
                </button>
              )}
            </div>
          </div>

          {/* Mathematical Audit Trail Note */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-[11px] text-slate-400 space-y-1.5 font-mono">
            <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              <span>ICC DLS Mathematical Equation:</span>
            </div>
            <p className="text-slate-400 break-words leading-relaxed">
              {calculation.calculationExplanation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
