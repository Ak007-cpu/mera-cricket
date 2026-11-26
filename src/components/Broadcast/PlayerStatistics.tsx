import React, { useMemo, useState } from 'react';
import { MatchState } from '../../types/cricket';
import { useContent } from '../../context/ContentContext';
import { normalizePlayerName } from '../../data/playersRegistry';
import { PlayerAvatar } from '../PlayerAvatar';
import { ArrowUpDown, Users } from 'lucide-react';

interface PlayerStatisticsProps {
  match: MatchState;
}

type StatTab = 'all' | 'batting' | 'bowling';
type SortField = 'default' | 'runs' | 'balls' | 'strikeRate' | 'wickets' | 'overs';

interface UnifiedPlayerStat {
  key: string;
  playerId: string;
  name: string;
  teamCode: string;
  imageUrl?: string;
  roleNote: string;
  isLiveStriker: boolean;
  isLiveNonStriker: boolean;
  isLiveBowler: boolean;
  hasBatted: boolean;
  hasBowled: boolean;
  runs: number;
  balls: number;
  strikeRate: number;
  fours: number;
  sixes: number;
  wickets: number;
  overs: number;
  runsConceded: number;
  economy: number;
}

function oversToBalls(overs: number): number {
  const whole = Math.floor(overs);
  const part = Math.round((overs - whole) * 10);
  return whole * 6 + part;
}

export const PlayerStatistics: React.FC<PlayerStatisticsProps> = ({ match }) => {
  const { players: managedPlayers } = useContent();
  const [activeTab, setActiveTab] = useState<StatTab>('all');
  const [sortField, setSortField] = useState<SortField>('default');
  const [sortAsc, setSortAsc] = useState(false);

  // Lookup admin CMS overrides by normalized name or id
  const cmsPlayerMap = useMemo(() => {
    const map = new Map<string, { name: string; imageUrl?: string; role?: string }>();
    managedPlayers.forEach((p) => {
      const k1 = normalizePlayerName(p.name);
      if (k1) map.set(k1, p);
      if (p.originalName) {
        const k2 = normalizePlayerName(p.originalName);
        if (k2) map.set(k2, p);
      }
      if (p.id) map.set(p.id.toLowerCase(), p);
    });
    return map;
  }, [managedPlayers]);

  const rows: UnifiedPlayerStat[] = useMemo(() => {
    const map = new Map<string, UnifiedPlayerStat>();

    const getOrCreate = (
      name: string,
      playerId: string,
      teamCode: string,
      imageUrl?: string
    ): UnifiedPlayerStat => {
      const norm = normalizePlayerName(name) || playerId.toLowerCase();
      const cmsOv = cmsPlayerMap.get(norm) || cmsPlayerMap.get(playerId.toLowerCase());
      const resolvedName = cmsOv?.name || name;
      const resolvedKey = normalizePlayerName(resolvedName) || norm;

      const existing = map.get(resolvedKey);
      if (existing) {
        if (!existing.imageUrl && (cmsOv?.imageUrl || imageUrl)) {
          existing.imageUrl = cmsOv?.imageUrl || imageUrl;
        }
        return existing;
      }

      const created: UnifiedPlayerStat = {
        key: resolvedKey,
        playerId,
        name: resolvedName,
        teamCode,
        imageUrl: cmsOv?.imageUrl || imageUrl,
        roleNote: cmsOv?.role || '',
        isLiveStriker: false,
        isLiveNonStriker: false,
        isLiveBowler: false,
        hasBatted: false,
        hasBowled: false,
        runs: 0,
        balls: 0,
        strikeRate: 0,
        fours: 0,
        sixes: 0,
        wickets: 0,
        overs: 0,
        runsConceded: 0,
        economy: 0
      };
      map.set(resolvedKey, created);
      return created;
    };

    // 1. Seed from both innings scorecards if available
    const inningsList = [match.scorecards?.secondInnings, match.scorecards?.firstInnings].filter(Boolean);
    inningsList.forEach((inn) => {
      if (!inn) return;
      inn.batting?.forEach((b) => {
        const hasActivity = b.balls > 0 || b.runs > 0 || b.isNotOut || (b.dismissal && b.dismissal !== 'yet to bat');
        if (!hasActivity && b.dismissal === 'yet to bat') return;
        const entry = getOrCreate(b.name, b.playerId || b.name, inn.teamCode, b.imageUrl);
        entry.hasBatted = true;
        entry.runs = b.runs;
        entry.balls = b.balls;
        entry.strikeRate = b.strikeRate;
        entry.fours = b.fours;
        entry.sixes = b.sixes;
        if (b.dismissal && b.dismissal !== 'yet to bat' && b.dismissal !== 'batting') {
          entry.roleNote = b.dismissal;
        }
      });

      const oppTeamCode =
        inn.teamCode === match.battingTeam.code ? match.bowlingTeam.code : match.battingTeam.code;
      inn.bowling?.forEach((bw) => {
        const entry = getOrCreate(bw.name, bw.playerId || bw.name, oppTeamCode, bw.imageUrl);
        entry.hasBowled = true;
        entry.wickets = bw.wickets;
        entry.overs = bw.overs;
        entry.runsConceded = bw.runs;
        entry.economy = bw.economy;
      });
    });

    // 2. Overlay live crease batters & current bowler so live updates always reflect immediately
    if (match.striker?.name) {
      const s = getOrCreate(
        match.striker.name,
        match.striker.playerId || match.striker.name,
        match.battingTeam.code,
        match.striker.imageUrl
      );
      s.isLiveStriker = true;
      s.hasBatted = true;
      s.runs = match.striker.runs;
      s.balls = match.striker.balls;
      s.strikeRate = match.striker.strikeRate;
      s.fours = match.striker.fours;
      s.sixes = match.striker.sixes;
      s.roleNote = 'Batting (Striker)';
    }

    if (match.nonStriker?.name) {
      const ns = getOrCreate(
        match.nonStriker.name,
        match.nonStriker.playerId || match.nonStriker.name,
        match.battingTeam.code,
        match.nonStriker.imageUrl
      );
      ns.isLiveNonStriker = true;
      ns.hasBatted = true;
      ns.runs = match.nonStriker.runs;
      ns.balls = match.nonStriker.balls;
      ns.strikeRate = match.nonStriker.strikeRate;
      ns.fours = match.nonStriker.fours;
      ns.sixes = match.nonStriker.sixes;
      ns.roleNote = 'Batting (Non-Striker)';
    }

    if (match.currentBowler?.name) {
      const cb = getOrCreate(
        match.currentBowler.name,
        match.currentBowler.playerId || match.currentBowler.name,
        match.bowlingTeam.code,
        match.currentBowler.imageUrl
      );
      cb.isLiveBowler = true;
      cb.hasBowled = true;
      cb.wickets = match.currentBowler.wickets;
      cb.overs = match.currentBowler.overs;
      cb.runsConceded = match.currentBowler.runs;
      cb.economy = match.currentBowler.economy;
      if (!cb.roleNote || cb.roleNote === 'Bowler') {
        cb.roleNote = 'Current Bowler';
      }
    }

    return Array.from(map.values());
  }, [match, cmsPlayerMap]);

  const filteredAndSortedRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (activeTab === 'batting') return r.hasBatted;
      if (activeTab === 'bowling') return r.hasBowled;
      return true;
    });

    const sorted = [...filtered];
    if (sortField === 'default') {
      sorted.sort((a, b) => {
        const aLive = a.isLiveStriker ? 3 : a.isLiveNonStriker ? 2 : a.isLiveBowler ? 1 : 0;
        const bLive = b.isLiveStriker ? 3 : b.isLiveNonStriker ? 2 : b.isLiveBowler ? 1 : 0;
        if (aLive !== bLive) return bLive - aLive;
        if (b.runs !== a.runs) return b.runs - a.runs;
        return b.wickets - a.wickets;
      });
      return sorted;
    }

    sorted.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortField === 'runs') {
        valA = a.hasBatted ? a.runs : -1;
        valB = b.hasBatted ? b.runs : -1;
      } else if (sortField === 'balls') {
        valA = a.hasBatted ? a.balls : -1;
        valB = b.hasBatted ? b.balls : -1;
      } else if (sortField === 'strikeRate') {
        valA = a.hasBatted ? a.strikeRate : -1;
        valB = b.hasBatted ? b.strikeRate : -1;
      } else if (sortField === 'wickets') {
        valA = a.hasBowled ? a.wickets : -1;
        valB = b.hasBowled ? b.wickets : -1;
      } else if (sortField === 'overs') {
        valA = a.hasBowled ? oversToBalls(a.overs) : -1;
        valB = b.hasBowled ? oversToBalls(b.overs) : -1;
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return sorted;
  }, [rows, activeTab, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const renderSortHeader = (label: string, field: Exclude<SortField, 'default'>) => {
    const isActive = sortField === field;
    return (
      <th scope="col" className="py-3 px-3.5 text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => handleSort(field)}
          className={`inline-flex items-center justify-end gap-1.5 font-bold uppercase tracking-wider text-sm transition-colors ${
            isActive
              ? 'text-amber-700 dark:text-amber-300'
              : 'text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          <span>{label}</span>
          <ArrowUpDown
            className={`w-3.5 h-3.5 ${
              isActive ? 'text-amber-700 dark:text-amber-300' : 'text-slate-400 dark:text-slate-500'
            }`}
          />
        </button>
      </th>
    );
  };

  return (
    <section
      aria-label="Current Match Player Statistics"
      className="bg-white/95 dark:bg-[#0a1329]/90 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 rounded-2xl shadow-md dark:shadow-xl overflow-hidden"
    >
      {/* Header & Filter Controls */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Users className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" />
          <h3 className="text-base font-black text-slate-950 dark:text-white tracking-tight truncate">
            Player Statistics
          </h3>
          <span className="text-sm font-score text-slate-600 dark:text-slate-300 whitespace-nowrap">
            · {filteredAndSortedRows.length} Players
          </span>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950/90 border border-slate-300 dark:border-slate-800 text-sm self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-700 dark:text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            All ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('batting')}
            className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'batting'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            Batting ({rows.filter((r) => r.hasBatted).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bowling')}
            className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'bowling'
                ? 'bg-slate-900 text-white dark:bg-slate-700 dark:text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            Bowling ({rows.filter((r) => r.hasBowled).length})
          </button>
        </div>
      </div>

      {/* Scrollable Data Table */}
      <div className="max-h-72 overflow-x-auto overflow-y-auto">
        {filteredAndSortedRows.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-600 dark:text-slate-300">
            No player statistics available for the current filter yet.
          </div>
        ) : (
          <table className="w-full min-w-[680px] text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#071024] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th
                  scope="col"
                  className="py-3 px-5 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Player
                </th>
                <th
                  scope="col"
                  className="py-3 px-3.5 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 whitespace-nowrap"
                >
                  Team
                </th>
                {renderSortHeader('Runs', 'runs')}
                {renderSortHeader('Balls', 'balls')}
                {renderSortHeader('SR', 'strikeRate')}
                {renderSortHeader('Wickets', 'wickets')}
                {renderSortHeader('Overs', 'overs')}
                <th
                  scope="col"
                  className="py-3 px-5 text-right text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 whitespace-nowrap"
                >
                  Econ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-sm">
              {filteredAndSortedRows.map((p) => {
                const isLive = p.isLiveStriker || p.isLiveNonStriker || p.isLiveBowler;
                return (
                  <tr
                    key={`${p.key}_${p.teamCode}`}
                    className={`transition-colors ${
                      isLive
                        ? 'bg-sky-50/90 hover:bg-sky-100/80 dark:bg-slate-800/45 dark:hover:bg-slate-800/65'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                    }`}
                  >
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3 min-w-0">
                        <PlayerAvatar
                          playerId={p.playerId}
                          name={p.name}
                          teamCode={p.teamCode}
                          imageUrl={p.imageUrl}
                          size="xs"
                          ringVariant={
                            p.isLiveStriker ? 'gold' : p.isLiveBowler ? 'green' : 'default'
                          }
                          showJerseyNumber={false}
                          showStrikeBadge={false}
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-950 dark:text-white truncate flex items-center gap-1.5">
                            <span className="truncate">
                              {p.name}
                              {p.isLiveStriker ? '*' : ''}
                            </span>
                          </div>
                          {p.roleNote && (
                            <div
                              className={`text-sm truncate ${
                                p.isLiveStriker
                                  ? 'text-amber-700 dark:text-amber-300 font-semibold'
                                  : p.isLiveBowler
                                  ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {p.roleNote}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3.5 font-score text-sm font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {p.teamCode}
                    </td>

                    <td className="py-3 px-3.5 text-right font-score font-black text-slate-950 dark:text-white whitespace-nowrap">
                      {p.hasBatted ? p.runs : '—'}
                    </td>

                    <td className="py-3 px-3.5 text-right font-score text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {p.hasBatted ? p.balls : '—'}
                    </td>

                    <td className="py-3 px-3.5 text-right font-score text-slate-800 dark:text-slate-100 whitespace-nowrap">
                      {p.hasBatted ? p.strikeRate.toFixed(1) : '—'}
                    </td>

                    <td className="py-3 px-3.5 text-right font-score font-black text-amber-700 dark:text-amber-300 whitespace-nowrap">
                      {p.hasBowled ? p.wickets : '—'}
                    </td>

                    <td className="py-3 px-3.5 text-right font-score text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {p.hasBowled ? p.overs : '—'}
                    </td>

                    <td className="py-3 px-5 text-right font-score text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {p.hasBowled ? p.economy.toFixed(2) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};
