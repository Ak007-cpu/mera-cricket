import React, { useState, useEffect } from 'react';
import { CompletedMatchItem } from '../../types/cricket';
import { fetchMatchHistory } from '../../services/api';
import { CACHED_LAST_5_MATCHES } from '../../data/matchHistoryData';
import {
  Trophy,
  Award,
  Calendar,
  MapPin,
  CheckCircle2,
  RotateCw,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Flame,
  ArrowRight
} from 'lucide-react';
import { PlayerAvatar } from '../PlayerAvatar';
import { TeamFlag } from '../TeamFlag';

interface MatchHistoryViewProps {
  onSelectPlayer?: (player: { name: string; team?: string; id?: string }) => void;
  onOpenLiveMatch?: () => void;
}

export const MatchHistoryView: React.FC<MatchHistoryViewProps> = ({
  onSelectPlayer,
  onOpenLiveMatch
}) => {
  const [matches, setMatches] = useState<CompletedMatchItem[]>(() => {
    // 1. Try local storage cache
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('cricket_cached_match_history');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 5);
        }
      } catch {}
    }
    return CACHED_LAST_5_MATCHES;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<number>(Date.now());
  const [formatFilter, setFormatFilter] = useState<'ALL' | 'T20' | 'ODI' | 'TEST'>('ALL');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Load from backend /api/matches/history
  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await fetchMatchHistory();
      if (data && data.length > 0) {
        setMatches(data.slice(0, 5));
        setLastRefreshed(Date.now());
      }
    } catch (e) {
      console.debug('Error refreshing match history:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filtered =
    formatFilter === 'ALL' ? matches : matches.filter((m) => m.format === formatFilter);

  const getFormatBadgeStyle = (format: 'T20' | 'ODI' | 'TEST') => {
    switch (format) {
      case 'T20':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'ODI':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'TEST':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-3.5 pb-6">
      {/* View Header & Format Tabs */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 shadow-sm">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-sm text-white uppercase tracking-wider">
                  Match History
                </h3>
                <span className="text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                  CREX Cached
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Last 5 completed matches with official scores & Player of the Match
              </p>
            </div>
          </div>

          <button
            onClick={loadHistory}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-50"
            title="Refresh Cached CREX Matches"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>

        {/* Format Filter Bar */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          {(['ALL', 'T20', 'ODI', 'TEST'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setFormatFilter(fmt)}
              className={`flex-1 py-1.5 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1 ${
                formatFilter === fmt
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{fmt}</span>
              {fmt === 'ALL' && (
                <span className="text-[9px] opacity-75 font-mono">({matches.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Meta details status row */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            Showing last {filtered.length} completed matches
          </span>
          <span className="font-mono">
            Synced: {new Date(lastRefreshed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      {/* List of the Last 5 Completed Matches */}
      <div className="space-y-3">
        {filtered.map((match, index) => {
          const isExpanded = expandedMatchId === match.id;
          return (
            <div
              key={match.id}
              className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-slate-700/80 transition-all shadow-md overflow-hidden"
            >
              {/* Match Header Tag */}
              <div className="bg-slate-950/60 px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    #{index + 1}
                  </span>
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider font-mono ${getFormatBadgeStyle(
                      match.format
                    )}`}
                  >
                    {match.format}
                  </span>
                  <span className="font-semibold text-slate-300 text-xs truncate">
                    {match.series}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono text-slate-400">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>{match.dateStr}</span>
                </div>
              </div>

              {/* Main Scoreboard Area */}
              <div className="p-4 space-y-3.5">
                {/* Teams & Scores Comparison */}
                <div className="space-y-2.5">
                  {/* Team 1 */}
                  <div
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      match.team1.isWinner
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : 'bg-slate-950/40 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TeamFlag teamName={match.team1.name} teamCode={match.team1.code} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-sm font-black truncate ${
                              match.team1.isWinner ? 'text-white' : 'text-slate-300'
                            }`}
                          >
                            {match.team1.name}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            ({match.team1.code})
                          </span>
                          {match.team1.isWinner && (
                            <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              WON
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-black text-sm font-mono ${
                          match.team1.isWinner ? 'text-emerald-400' : 'text-slate-300'
                        }`}
                      >
                        {match.team1.scoreStr}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {match.team1.oversStr}
                      </div>
                    </div>
                  </div>

                  {/* Team 2 */}
                  <div
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      match.team2.isWinner
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : 'bg-slate-950/40 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TeamFlag teamName={match.team2.name} teamCode={match.team2.code} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-sm font-black truncate ${
                              match.team2.isWinner ? 'text-white' : 'text-slate-300'
                            }`}
                          >
                            {match.team2.name}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            ({match.team2.code})
                          </span>
                          {match.team2.isWinner && (
                            <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              WON
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-black text-sm font-mono ${
                          match.team2.isWinner ? 'text-emerald-400' : 'text-slate-300'
                        }`}
                      >
                        {match.team2.scoreStr}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {match.team2.oversStr}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Match Result Summary Banner */}
                <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 p-2.5 rounded-xl border border-blue-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-black text-amber-300 tracking-wide">
                      {match.resultSummary}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                    Verified
                  </span>
                </div>

                {/* Player of the Match (POTM) Hero Spotlight Card */}
                {match.playerOfMatch && (
                  <div className="bg-gradient-to-br from-amber-950/30 via-slate-950 to-slate-900 p-3.5 rounded-xl border border-amber-500/30 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black tracking-wider uppercase text-amber-400 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        Player of the Match
                      </span>
                      {match.playerOfMatch.role && (
                        <span className="text-[9px] font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 font-mono">
                          {match.playerOfMatch.role} • {match.playerOfMatch.teamCode}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Player Face Photo */}
                      <div className="relative shrink-0">
                        <PlayerAvatar
                          name={match.playerOfMatch.name}
                          teamCode={match.playerOfMatch.teamCode}
                          imageUrl={match.playerOfMatch.imageUrl}
                          playerId={match.playerOfMatch.id}
                          size="md"
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-[9px] shadow-sm">
                          ★
                        </div>
                      </div>

                      {/* Player Info and Performance Data */}
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-white text-xs truncate">
                          {match.playerOfMatch.name}
                        </div>
                        <div className="text-[11px] font-bold text-amber-300 font-mono mt-0.5">
                          {match.playerOfMatch.stats}
                        </div>
                        {match.playerOfMatch.impactSummary && (
                          <div className="text-[10px] text-slate-400 italic line-clamp-1 mt-0.5">
                            &quot;{match.playerOfMatch.impactSummary}&quot;
                          </div>
                        )}
                      </div>

                      {/* Interactive View Stats Button */}
                      {onSelectPlayer && (
                        <button
                          onClick={() =>
                            onSelectPlayer({
                              name: match.playerOfMatch.name,
                              team: match.playerOfMatch.teamCode,
                              id: match.playerOfMatch.id
                            })
                          }
                          className="shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 text-[10px] font-bold transition-all flex items-center gap-1 shadow-xs"
                          title="View complete stats for this player"
                        >
                          <UserCheck className="w-3 h-3 text-amber-400" />
                          <span>Stats</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Match Venue & Expandable Highlights */}
                <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 min-w-0 truncate pr-2">
                    <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
                    <span className="truncate">{match.venue}</span>
                  </div>

                  {match.highlights && match.highlights.length > 0 && (
                    <button
                      onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 shrink-0"
                    >
                      <span>{isExpanded ? 'Less' : 'Highlights'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {/* Expanded Highlights Accordion */}
                {isExpanded && match.highlights && (
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5 text-xs animate-fadeIn">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Key Match Highlights
                    </div>
                    <ul className="space-y-1">
                      {match.highlights.map((h, i) => (
                        <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                          <span className="text-blue-400 font-bold">•</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
          <Trophy className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-white">No matches found for this filter</p>
          <button
            onClick={() => setFormatFilter('ALL')}
            className="text-xs text-blue-400 font-bold hover:underline"
          >
            Show All Completed Matches
          </button>
        </div>
      )}
    </div>
  );
};
