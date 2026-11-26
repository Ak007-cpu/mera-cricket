import React from 'react';
import { MatchState } from '../../types/cricket';
import { Trophy, Flame, Sparkles, Award, Zap } from 'lucide-react';
import { PlayerAvatar } from '../PlayerAvatar';

interface MatchMilestonesCardProps {
  match: MatchState;
  onTriggerTest?: (
    type: 'century' | 'fifty' | 'thirty' | 'five_wickets' | 'three_wickets' | 'maiden' | 'wicket'
  ) => void;
}

export const MatchMilestonesCard: React.FC<MatchMilestonesCardProps> = ({
  match,
  onTriggerTest
}) => {
  // Extract all milestones from current live players and scorecard
  const centuries: Array<{ name: string; runs: number; balls: number; id?: string; imageUrl?: string }> = [];
  const fifties: Array<{ name: string; runs: number; balls: number; id?: string; imageUrl?: string }> = [];
  const thirties: Array<{ name: string; runs: number; balls: number; id?: string; imageUrl?: string }> = [];
  const fiveWickets: Array<{ name: string; wickets: number; runs: number; overs: number; id?: string; imageUrl?: string }> = [];
  const threeWickets: Array<{ name: string; wickets: number; runs: number; overs: number; id?: string; imageUrl?: string }> = [];

  // Check striker & non-striker
  [match.striker, match.nonStriker].forEach((b) => {
    if (b.runs >= 100) {
      centuries.push({ name: b.name, runs: b.runs, balls: b.balls, id: b.playerId, imageUrl: b.imageUrl });
    } else if (b.runs >= 50) {
      fifties.push({ name: b.name, runs: b.runs, balls: b.balls, id: b.playerId, imageUrl: b.imageUrl });
    } else if (b.runs >= 30) {
      thirties.push({ name: b.name, runs: b.runs, balls: b.balls, id: b.playerId, imageUrl: b.imageUrl });
    }
  });

  // Check bowler
  if (match.currentBowler.wickets >= 5) {
    fiveWickets.push({
      name: match.currentBowler.name,
      wickets: match.currentBowler.wickets,
      runs: match.currentBowler.runs,
      overs: match.currentBowler.overs,
      id: match.currentBowler.playerId,
      imageUrl: match.currentBowler.imageUrl
    });
  } else if (match.currentBowler.wickets >= 3) {
    threeWickets.push({
      name: match.currentBowler.name,
      wickets: match.currentBowler.wickets,
      runs: match.currentBowler.runs,
      overs: match.currentBowler.overs,
      id: match.currentBowler.playerId,
      imageUrl: match.currentBowler.imageUrl
    });
  }

  // Check full scorecard if available
  const activeInnings = match.scorecards.firstInnings;
  if (activeInnings) {
    activeInnings.batting.forEach((b) => {
      if (b.runs >= 100 && !centuries.some((c) => c.name === b.name)) {
        centuries.push({ name: b.name, runs: b.runs, balls: b.balls, id: b.playerId, imageUrl: b.imageUrl });
      } else if (b.runs >= 50 && b.runs < 100 && !fifties.some((f) => f.name === b.name)) {
        fifties.push({ name: b.name, runs: b.runs, balls: b.balls, id: b.playerId, imageUrl: b.imageUrl });
      }
    });

    activeInnings.bowling.forEach((bw) => {
      if (bw.wickets >= 5 && !fiveWickets.some((fw) => fw.name === bw.name)) {
        fiveWickets.push({
          name: bw.name,
          wickets: bw.wickets,
          runs: bw.runs,
          overs: bw.overs,
          id: bw.playerId,
          imageUrl: bw.imageUrl
        });
      } else if (bw.wickets >= 3 && !threeWickets.some((tw) => tw.name === bw.name)) {
        threeWickets.push({
          name: bw.name,
          wickets: bw.wickets,
          runs: bw.runs,
          overs: bw.overs,
          id: bw.playerId,
          imageUrl: bw.imageUrl
        });
      }
    });
  }

  const hasAnyMilestone = centuries.length > 0 || fifties.length > 0 || fiveWickets.length > 0;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-white flex items-center gap-1.5">
              Match Milestones
              <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded-full uppercase">
                Live
              </span>
            </h4>
            <p className="text-[10px] text-slate-400">Centuries (100*), Half-Centuries (50*) & 5W Hauls</p>
          </div>
        </div>

        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
          Visual Alerts Active
        </span>
      </div>

      {/* Achieved Milestones in Match */}
      {hasAnyMilestone ? (
        <div className="space-y-2">
          {/* Centuries */}
          {centuries.map((c, idx) => (
            <div
              key={`century-${idx}`}
              className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-2.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <PlayerAvatar
                  playerId={c.id}
                  name={c.name}
                  imageUrl={c.imageUrl}
                  size="xs"
                />
                <div className="min-w-0">
                  <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                    <span>{c.name}</span>
                    <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1 rounded">
                      100*
                    </span>
                  </div>
                  <div className="text-[10px] text-amber-300 font-mono">
                    {c.runs} runs off {c.balls} balls • Magnificent Century
                  </div>
                </div>
              </div>
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
            </div>
          ))}

          {/* Half Centuries */}
          {fifties.map((f, idx) => (
            <div
              key={`fifty-${idx}`}
              className="bg-yellow-950/30 border border-yellow-500/40 rounded-xl p-2.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <PlayerAvatar
                  playerId={f.id}
                  name={f.name}
                  imageUrl={f.imageUrl}
                  size="xs"
                />
                <div className="min-w-0">
                  <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                    <span>{f.name}</span>
                    <span className="bg-yellow-400 text-slate-950 text-[9px] font-black px-1 rounded">
                      50*
                    </span>
                  </div>
                  <div className="text-[10px] text-yellow-300 font-mono">
                    {f.runs} runs off {f.balls} balls • Half-Century
                  </div>
                </div>
              </div>
              <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
            </div>
          ))}

          {/* 5-Wicket Hauls */}
          {fiveWickets.map((fw, idx) => (
            <div
              key={`fivew-${idx}`}
              className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-2.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <PlayerAvatar
                  playerId={fw.id}
                  name={fw.name}
                  imageUrl={fw.imageUrl}
                  size="xs"
                />
                <div className="min-w-0">
                  <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                    <span>{fw.name}</span>
                    <span className="bg-emerald-400 text-slate-950 text-[9px] font-black px-1 rounded">
                      5W HAUL
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-300 font-mono">
                    {fw.wickets}/{fw.runs} in {fw.overs} overs • 5-Wicket Haul
                  </div>
                </div>
              </div>
              <Flame className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-center space-y-1">
          <p className="text-xs text-slate-300 font-medium">Tracking Live Milestones in Match</p>
          <p className="text-[10px] text-slate-500">
            Visual celebration banners will trigger automatically when a batter scores 50*, 100*, or a bowler claims 5 wickets!
          </p>
        </div>
      )}

      {/* Visual Alert Trigger Controls for Milestones */}
      {onTriggerTest && (
        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              Test Milestone Visual Alerts:
            </span>
            <span className="text-[9px] font-mono text-slate-500">Instant Haptics & Audio</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => onTriggerTest('century')}
              className="py-1.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 shadow-xs"
            >
              <Trophy className="w-3 h-3 text-amber-400" />
              <span>Century 100*</span>
            </button>

            <button
              onClick={() => onTriggerTest('fifty')}
              className="py-1.5 px-2 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-[10px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 shadow-xs"
            >
              <Sparkles className="w-3 h-3 text-yellow-400" />
              <span>Fifty 50*</span>
            </button>

            <button
              onClick={() => onTriggerTest('five_wickets')}
              className="py-1.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 shadow-xs"
            >
              <Flame className="w-3 h-3 text-emerald-400" />
              <span>5W Haul</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
