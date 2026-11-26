import React, { useState, useEffect } from 'react';
import { ActiveMatchConfig, BallEvent, MatchState } from '../../types/cricket';
import {
  editMatchDetails,
  ManualBallOutcome,
  recordManualBall,
  setDataSourceMode,
  syncMatchNow,
  uploadPlayerPhoto
} from '../../services/api';
import { saveStoredPlayerPhoto } from '../../utils/mediaStorage';
import {
  sanitizeFirestoreId,
  saveManagedPlayerToFirestore,
  uploadImageAsset
} from '../../services/firebaseContentService';
import { useContent } from '../../context/ContentContext';
import { PlayerAvatar } from '../PlayerAvatar';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Edit3,
  Image as ImageIcon,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  Zap
} from 'lucide-react';

interface ManualScorePanelProps {
  match: MatchState | null;
  config: ActiveMatchConfig | null;
  adminPin: string;
  isAuthorized: boolean;
  onRefresh: () => void;
  onStatusMessage?: (msg: { text: string; type: 'success' | 'error' }) => void;
}

const DELIVERY_TOKENS: ManualBallOutcome[] = ['0', '1', '2', '3', '4', '6', 'W', 'wd', 'nb'];

function ballEventToToken(ball: BallEvent): ManualBallOutcome {
  if (ball.isWicket) return 'W';
  if (ball.isExtra && ball.extraType === 'wide') return 'wd';
  if (ball.isExtra && ball.extraType === 'no-ball') return 'nb';
  if (ball.isSix || ball.runs === 6) return '6';
  if (ball.isFour || ball.runs === 4) return '4';
  if (ball.runs === 3) return '3';
  if (ball.runs === 2) return '2';
  if (ball.runs === 1) return '1';
  return '0';
}

function getDeliveryChipClass(tok: ManualBallOutcome): string {
  if (tok === 'W') return 'bg-rose-600 text-white border-rose-400';
  if (tok === '6') return 'bg-purple-600 text-white border-purple-400';
  if (tok === '4') return 'bg-blue-600 text-white border-blue-400';
  if (tok === 'wd' || tok === 'nb') return 'bg-amber-600 text-white border-amber-400';
  if (tok === '0') return 'bg-slate-800 text-slate-300 border-slate-600';
  return 'bg-emerald-700/80 text-white border-emerald-500/60';
}

export const ManualScorePanel: React.FC<ManualScorePanelProps> = ({
  match,
  config,
  adminPin,
  isAuthorized,
  onRefresh,
  onStatusMessage
}) => {
  const { isFirebaseAdmin, upsertBackupPlayer, findManagedPlayerOverride } = useContent();
  const dataSourceMode: 'auto' | 'manual' =
    config?.dataSourceMode === 'manual' || config?.isAutoSyncEnabled === false ? 'manual' : 'auto';
  const isSyncFailed = dataSourceMode === 'auto' && (config?.syncStatus === 'failed' || Boolean(config?.syncError));

  const [isBusy, setIsBusy] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);

  const [form, setForm] = useState({
    title: '',
    matchType: 'T20' as 'T20' | 'ODI' | 'TEST' | 'T10',
    gameState: 'live' as 'scheduled' | 'live' | 'innings_break' | 'completed' | 'delayed',
    currentInnings: 1 as 1 | 2,
    venue: '',
    toss: '',
    statusText: '',
    target: 0,
    battingTeamName: '',
    battingTeamCode: '',
    runs: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    currentRunRate: 0,
    bowlingTeamName: '',
    bowlingTeamCode: '',
    bowlingTeamRuns: 0,
    bowlingTeamWickets: 0,
    bowlingTeamOvers: 0,
    bowlingTeamBalls: 0,
    strikerName: '',
    strikerRuns: 0,
    strikerBalls: 0,
    strikerFours: 0,
    strikerSixes: 0,
    nonStrikerName: '',
    nonStrikerRuns: 0,
    nonStrikerBalls: 0,
    nonStrikerFours: 0,
    nonStrikerSixes: 0,
    bowlerName: '',
    bowlerOvers: 0,
    bowlerMaidens: 0,
    bowlerRuns: 0,
    bowlerWickets: 0,
    partnershipRuns: 0,
    partnershipBalls: 0,
    partnershipPlayer1Runs: 0,
    partnershipPlayer2Runs: 0
  });

  // Deliveries in chronological order (oldest -> newest) for editing "Is over ki deliveries"
  const [overDeliveries, setOverDeliveries] = useState<ManualBallOutcome[]>([]);

  // Player Photo URL drafts for Striker, Non-Striker, and Bowler
  const [photoUrls, setPhotoUrls] = useState({
    striker: '',
    nonStriker: '',
    bowler: ''
  });
  const [photoBusyRole, setPhotoBusyRole] = useState<'striker' | 'nonStriker' | 'bowler' | null>(null);

  // Populate form from live match whenever match updates & user is not mid-edit
  useEffect(() => {
    if (!match || isFormDirty) return;
    setForm({
      title: match.title || '',
      matchType: match.matchType || 'T20',
      gameState: match.gameState || 'live',
      currentInnings: match.currentInnings || 1,
      venue: match.venue || '',
      toss: match.toss || '',
      statusText: match.statusText || '',
      target: match.target || 0,
      battingTeamName: match.battingTeam?.name || '',
      battingTeamCode: match.battingTeam?.code || '',
      runs: match.battingTeam?.score?.runs ?? 0,
      wickets: match.battingTeam?.score?.wickets ?? 0,
      overs: match.battingTeam?.score?.overs ?? 0,
      balls: match.battingTeam?.score?.balls ?? 0,
      currentRunRate: match.currentRunRate ?? 0,
      bowlingTeamName: match.bowlingTeam?.name || '',
      bowlingTeamCode: match.bowlingTeam?.code || '',
      bowlingTeamRuns: match.bowlingTeam?.score?.runs ?? 0,
      bowlingTeamWickets: match.bowlingTeam?.score?.wickets ?? 0,
      bowlingTeamOvers: match.bowlingTeam?.score?.overs ?? 0,
      bowlingTeamBalls: match.bowlingTeam?.score?.balls ?? 0,
      strikerName: match.striker?.name || '',
      strikerRuns: match.striker?.runs ?? 0,
      strikerBalls: match.striker?.balls ?? 0,
      strikerFours: match.striker?.fours ?? 0,
      strikerSixes: match.striker?.sixes ?? 0,
      nonStrikerName: match.nonStriker?.name || '',
      nonStrikerRuns: match.nonStriker?.runs ?? 0,
      nonStrikerBalls: match.nonStriker?.balls ?? 0,
      nonStrikerFours: match.nonStriker?.fours ?? 0,
      nonStrikerSixes: match.nonStriker?.sixes ?? 0,
      bowlerName: match.currentBowler?.name || '',
      bowlerOvers: match.currentBowler?.overs ?? 0,
      bowlerMaidens: match.currentBowler?.maidens ?? 0,
      bowlerRuns: match.currentBowler?.runs ?? 0,
      bowlerWickets: match.currentBowler?.wickets ?? 0,
      partnershipRuns: match.currentPartnership?.runs ?? 0,
      partnershipBalls: match.currentPartnership?.balls ?? 0,
      partnershipPlayer1Runs: match.currentPartnership?.player1Runs ?? match.striker?.runs ?? 0,
      partnershipPlayer2Runs: match.currentPartnership?.player2Runs ?? match.nonStriker?.runs ?? 0
    });

    const latestSlice = (match.recentBalls || []).slice(0, 8);
    setOverDeliveries(latestSlice.map(ballEventToToken).reverse());

    setPhotoUrls({
      striker:
        match.striker?.imageUrl && !match.striker.imageUrl.startsWith('/api/player/photo?')
          ? match.striker.imageUrl
          : '',
      nonStriker:
        match.nonStriker?.imageUrl && !match.nonStriker.imageUrl.startsWith('/api/player/photo?')
          ? match.nonStriker.imageUrl
          : '',
      bowler:
        match.currentBowler?.imageUrl && !match.currentBowler.imageUrl.startsWith('/api/player/photo?')
          ? match.currentBowler.imageUrl
          : ''
    });
  }, [match, isFormDirty]);

  if (!isAuthorized) {
    return null;
  }

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setIsFormDirty(true);
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'runs' || key === 'overs' || key === 'balls') {
        const totalBalls = Number(next.overs) * 6 + Number(next.balls);
        next.currentRunRate = totalBalls > 0 ? Number(((Number(next.runs) / totalBalls) * 6).toFixed(2)) : 0;
      }
      return next;
    });
  };

  const handleSwitchMode = async (mode: 'auto' | 'manual') => {
    setIsBusy(true);
    try {
      await setDataSourceMode(mode, adminPin);
      setIsFormDirty(false);
      onStatusMessage?.({
        text:
          mode === 'manual'
            ? 'Manual Mode ON — Ab aap sabhi scores khud update kar sakte hain.'
            : 'Auto Sync Mode ON — Background sync chalu ho gaya hai.',
        type: 'success'
      });
      onRefresh();
    } catch (err: any) {
      onStatusMessage?.({ text: err.message || 'Mode switch failed', type: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRetrySync = async () => {
    setIsBusy(true);
    try {
      const res = await syncMatchNow(adminPin);
      if (res.success) {
        onStatusMessage?.({ text: 'Live sync successful!', type: 'success' });
      } else {
        onStatusMessage?.({ text: res.error || 'Sync band hai, Manual mode on karein.', type: 'error' });
      }
      onRefresh();
    } catch (err: any) {
      onStatusMessage?.({ text: err.message || 'Sync failed', type: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRecordBall = async (outcome: ManualBallOutcome) => {
    setIsBusy(true);
    try {
      await recordManualBall(outcome, adminPin);
      setIsFormDirty(false);
      onStatusMessage?.({
        text: `Ball (${outcome}) updated — Broadcast, OBS & App par live ho gaya.`,
        type: 'success'
      });
      onRefresh();
    } catch (err: any) {
      onStatusMessage?.({ text: err.message || 'Failed to record ball', type: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSwapStrike = async () => {
    setIsBusy(true);
    try {
      await editMatchDetails(
        {
          strikerName: form.nonStrikerName,
          strikerRuns: form.nonStrikerRuns,
          strikerBalls: form.nonStrikerBalls,
          strikerFours: form.nonStrikerFours,
          strikerSixes: form.nonStrikerSixes,
          nonStrikerName: form.strikerName,
          nonStrikerRuns: form.strikerRuns,
          nonStrikerBalls: form.strikerBalls,
          nonStrikerFours: form.strikerFours,
          nonStrikerSixes: form.strikerSixes,
          partnershipPlayer1Runs: form.partnershipPlayer2Runs,
          partnershipPlayer2Runs: form.partnershipPlayer1Runs
        },
        adminPin
      );
      setIsFormDirty(false);
      onStatusMessage?.({ text: 'Striker & Non-Striker swapped live!', type: 'success' });
      onRefresh();
    } catch (err: any) {
      onStatusMessage?.({ text: err.message || 'Swap strike failed', type: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveManualScore = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    try {
      await editMatchDetails(
        {
          ...form,
          currentOverDeliveries: overDeliveries
        },
        adminPin
      );
      setIsFormDirty(false);
      onStatusMessage?.({
        text: 'Manual Score saved! Broadcast, OBS Overlay & Android App par foran update ho gaya.',
        type: 'success'
      });
      onRefresh();
    } catch (err: any) {
      onStatusMessage?.({ text: err.message || 'Failed to save manual score', type: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  const persistPlayerToCloud = async (
    role: 'striker' | 'nonStriker' | 'bowler',
    playerName: string | undefined,
    teamCode: string | undefined,
    finalUrl: string
  ) => {
    const cleanName = (playerName || '').trim();
    if (!cleanName) return false;
    const tCode = (teamCode || 'CRX').trim().toUpperCase();
    const existingCloud = findManagedPlayerOverride(undefined, cleanName, tCode);
    const docId = existingCloud?.id || sanitizeFirestoreId(`${tCode}_${cleanName}`, 'player');
    const profile = {
      id: docId,
      name: cleanName,
      originalName: existingCloud?.originalName || cleanName,
      role: (role === 'bowler' ? 'Bowler' : existingCloud?.role || 'Batter') as 'Batter' | 'Bowler' | 'All-rounder' | 'Wicketkeeper',
      teamCode: tCode,
      imageUrl: finalUrl,
      updatedAt: Date.now()
    };
    upsertBackupPlayer(profile);
    if (isFirebaseAdmin) {
      await saveManagedPlayerToFirestore(profile);
      return true;
    }
    return false;
  };

  const handleApplyPhotoUrl = async (role: 'striker' | 'nonStriker' | 'bowler', urlOverride?: string) => {
    setPhotoBusyRole(role);
    try {
      const targetUrl = (urlOverride !== undefined ? urlOverride : photoUrls[role]).trim();
      const playerName =
        role === 'striker'
          ? form.strikerName || match?.striker?.name
          : role === 'nonStriker'
          ? form.nonStrikerName || match?.nonStriker?.name
          : form.bowlerName || match?.currentBowler?.name;
      const teamCode =
        role === 'bowler'
          ? form.bowlingTeamCode || match?.bowlingTeam?.code
          : form.battingTeamCode || match?.battingTeam?.code;

      await uploadPlayerPhoto(
        {
          role,
          imageUrl: targetUrl,
          playerName,
          teamCode
        },
        adminPin
      );
      if (playerName) {
        saveStoredPlayerPhoto(playerName, teamCode, targetUrl);
      }
      const savedInFirestore = await persistPlayerToCloud(role, playerName, teamCode, targetUrl);
      if (urlOverride !== undefined) {
        setPhotoUrls((prev) => ({ ...prev, [role]: urlOverride }));
      }
      onStatusMessage?.({
        text: targetUrl
          ? `${playerName || role} ki photo save ho gayi${savedInFirestore ? ' (Firebase Cloud + Cache)' : ' (Local/Server — sab devices ke liye Google Admin Sign-in karein)'}!`
          : `${playerName || role} ki photo reset ho gayi (default/initials).`,
        type: 'success'
      });
      onRefresh();
    } catch (err: any) {
      onStatusMessage?.({ text: err.message || 'Photo update failed', type: 'error' });
    } finally {
      setPhotoBusyRole(null);
    }
  };

  const handleUploadPhotoFile = async (role: 'striker' | 'nonStriker' | 'bowler', file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      onStatusMessage?.({ text: 'Photo 5MB se chhoti honi chahiye.', type: 'error' });
      return;
    }
    setPhotoBusyRole(role);
    try {
      const playerName =
        role === 'striker'
          ? form.strikerName || match?.striker?.name
          : role === 'nonStriker'
          ? form.nonStrikerName || match?.nonStriker?.name
          : form.bowlerName || match?.currentBowler?.name;
      const teamCode =
        role === 'bowler'
          ? form.bowlingTeamCode || match?.bowlingTeam?.code
          : form.battingTeamCode || match?.battingTeam?.code;

      const tCode = (teamCode || 'CRX').trim().toUpperCase();
      const existingCloud = playerName ? findManagedPlayerOverride(undefined, playerName, tCode) : undefined;
      const assetKey = existingCloud?.id || sanitizeFirestoreId(`${tCode}_${playerName || role}`, 'player');

      const uploaded = await uploadImageAsset(file, 'players', assetKey, adminPin, 300);
      const cacheValue = uploaded.storedInFirebase ? uploaded.url : uploaded.url || uploaded.dataUrl;

      if (playerName) {
        saveStoredPlayerPhoto(playerName, teamCode, cacheValue);
      }
      const res = await uploadPlayerPhoto(
        {
          role,
          imageUrl: uploaded.url.startsWith('data:') ? '' : uploaded.url,
          imageDataUrl: uploaded.url.startsWith('data:') ? uploaded.dataUrl : undefined,
          playerName,
          teamCode
        },
        adminPin
      );
      const finalResolvedUrl =
        uploaded.storedInFirebase ? uploaded.url : res.imageUrl || uploaded.url || uploaded.dataUrl;

      if (playerName && finalResolvedUrl) {
        saveStoredPlayerPhoto(playerName, teamCode, finalResolvedUrl);
      }

      const savedInFirestore =
        uploaded.storedInFirebase && isFirebaseAdmin
          ? await persistPlayerToCloud(role, playerName, teamCode, uploaded.url)
          : false;

      setPhotoUrls((prev) => ({
        ...prev,
        [role]: finalResolvedUrl.startsWith('data:') ? '' : finalResolvedUrl
      }));
      onStatusMessage?.({
        text: savedInFirestore
          ? `${playerName || role} ki compressed photo Firebase Storage & Firestore mein save ho gayi!`
          : `${playerName || role} ki photo compress & save ho gayi (Firebase Cloud sync ke liye Google Admin login zaroori hai).`,
        type: 'success'
      });
      onRefresh();
    } catch (err: any) {
      onStatusMessage?.({ text: err.message || 'Photo upload failed', type: 'error' });
    } finally {
      setPhotoBusyRole(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
      {/* Header + Data Source Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black uppercase tracking-wider text-white">
              Data Source &amp; Manual Score Entry
            </span>
            {dataSourceMode === 'manual' ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                MANUAL ACTIVE
              </span>
            ) : isSyncFailed ? (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40">
                SYNC PAUSED / FAILED
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                AUTO SYNC ACTIVE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Data Source select karein. Manual mode mein diya gaya score Broadcast, OBS aur Android par turant update hota hai.
          </p>
        </div>

        {/* Toggle Switch: Data Source: Auto Sync / Manual */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto">
          <span className="text-[11px] font-bold text-slate-400 px-2">Data Source:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleSwitchMode('auto')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dataSourceMode === 'auto'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Auto Sync
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleSwitchMode('manual')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dataSourceMode === 'manual'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Manual
            </button>
          </div>
        </div>
      </div>

      {/* Sync Failure Warning in Admin */}
      {isSyncFailed && (
        <div className="bg-rose-950/50 border border-rose-500/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-black text-rose-200">
                {config?.syncError || 'Sync band hai, Manual mode on karein.'}
              </div>
              <p className="text-xs text-rose-300/80 mt-0.5">
                Public screen par purana last score safe dikh raha hai. Live score khud update karne ke liye Manual mode on karein.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isBusy}
              onClick={handleRetrySync}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Sync</span>
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleSwitchMode('manual')}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Manual Mode On Karein</span>
            </button>
          </div>
        </div>
      )}

      {/* Manual Mode Controls */}
      {dataSourceMode === 'manual' ? (
        <div className="space-y-5">
          {/* Quick Ball-by-Ball Live Tap Pad */}
          <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Instant Ball-by-Ball Scoring (Auto Updates Score, Overs, Batsman, Bowler &amp; Partnership)
                </span>
              </div>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleSwapStrike}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
                <span>Swap Strike</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {DELIVERY_TOKENS.map((tok) => (
                <button
                  key={tok}
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleRecordBall(tok)}
                  className={`min-w-[46px] px-3.5 py-2 rounded-xl text-sm font-black font-mono border shadow-sm transition-transform active:scale-95 disabled:opacity-50 ${getDeliveryChipClass(
                    tok
                  )}`}
                >
                  {tok}
                </button>
              ))}
            </div>
          </div>

          {/* Full Manual Score Entry Form */}
          <form onSubmit={handleSaveManualScore} className="space-y-5">
            {/* Section 1: Match Info & Teams */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="text-xs font-black uppercase tracking-wider text-blue-400">
                1. Teams, Toss, Venue &amp; Match Info
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-slate-400 block mb-1">Match Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Match Type</label>
                  <select
                    value={form.matchType}
                    onChange={(e) => updateField('matchType', e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  >
                    <option value="T20">T20</option>
                    <option value="ODI">ODI</option>
                    <option value="TEST">TEST</option>
                    <option value="T10">T10</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Match State</label>
                  <select
                    value={form.gameState}
                    onChange={(e) => updateField('gameState', e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  >
                    <option value="live">Live</option>
                    <option value="innings_break">Innings Break</option>
                    <option value="completed">Completed</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="delayed">Delayed</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Batting Team Name</label>
                  <input
                    type="text"
                    value={form.battingTeamName}
                    onChange={(e) => updateField('battingTeamName', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Batting Team Code</label>
                  <input
                    type="text"
                    value={form.battingTeamCode}
                    onChange={(e) => updateField('battingTeamCode', e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Bowling Team Name</label>
                  <input
                    type="text"
                    value={form.bowlingTeamName}
                    onChange={(e) => updateField('bowlingTeamName', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Bowling Team Code</label>
                  <input
                    type="text"
                    value={form.bowlingTeamCode}
                    onChange={(e) => updateField('bowlingTeamCode', e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-slate-400 block mb-1">Toss Result</label>
                  <input
                    type="text"
                    value={form.toss}
                    onChange={(e) => updateField('toss', e.target.value)}
                    placeholder="e.g. India won the toss and elected to bat"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-slate-400 block mb-1">Venue</label>
                  <input
                    type="text"
                    value={form.venue}
                    onChange={(e) => updateField('venue', e.target.value)}
                    placeholder="e.g. Wankhede Stadium, Mumbai"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="text-slate-400 block mb-1">Match Status Banner Text</label>
                  <input
                    type="text"
                    value={form.statusText}
                    onChange={(e) => updateField('statusText', e.target.value)}
                    placeholder="e.g. IND need 24 runs in 12 balls"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Target (0 = 1st Inn)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.target}
                    onChange={(e) => updateField('target', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Score, Overs & Current Run Rate */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="text-xs font-black uppercase tracking-wider text-emerald-400">
                2. Score, Overs &amp; Current Run Rate
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Runs</label>
                  <input
                    type="number"
                    min={0}
                    value={form.runs}
                    onChange={(e) => updateField('runs', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Wickets (0-10)</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={form.wickets}
                    onChange={(e) => updateField('wickets', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Overs</label>
                  <input
                    type="number"
                    min={0}
                    value={form.overs}
                    onChange={(e) => updateField('overs', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Balls in Over (0-5)</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={form.balls}
                    onChange={(e) => updateField('balls', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Current Run Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.currentRunRate}
                    onChange={(e) => updateField('currentRunRate', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/70 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-slate-500 block mb-1">Bowling Team Runs</label>
                  <input
                    type="number"
                    min={0}
                    value={form.bowlingTeamRuns}
                    onChange={(e) => updateField('bowlingTeamRuns', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Bowling Team Wickets</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={form.bowlingTeamWickets}
                    onChange={(e) => updateField('bowlingTeamWickets', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Bowling Team Overs</label>
                  <input
                    type="number"
                    min={0}
                    value={form.bowlingTeamOvers}
                    onChange={(e) => updateField('bowlingTeamOvers', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Bowling Team Balls</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={form.bowlingTeamBalls}
                    onChange={(e) => updateField('bowlingTeamBalls', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Striker, Non-Striker & Current Bowler Figures */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="text-xs font-black uppercase tracking-wider text-amber-400">
                3. Striker, Non-Striker &amp; Bowler Figures
              </div>

              {/* Striker */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs items-end">
                <div className="col-span-2">
                  <label className="text-amber-300 font-semibold block mb-1">Striker Name (*)</label>
                  <input
                    type="text"
                    value={form.strikerName}
                    onChange={(e) => updateField('strikerName', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Runs</label>
                  <input
                    type="number"
                    min={0}
                    value={form.strikerRuns}
                    onChange={(e) => updateField('strikerRuns', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Balls</label>
                  <input
                    type="number"
                    min={0}
                    value={form.strikerBalls}
                    onChange={(e) => updateField('strikerBalls', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">4s</label>
                  <input
                    type="number"
                    min={0}
                    value={form.strikerFours}
                    onChange={(e) => updateField('strikerFours', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">6s</label>
                  <input
                    type="number"
                    min={0}
                    value={form.strikerSixes}
                    onChange={(e) => updateField('strikerSixes', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
              </div>

              {/* Non-Striker */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs items-end pt-2 border-t border-slate-800/70">
                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Non-Striker Name</label>
                  <input
                    type="text"
                    value={form.nonStrikerName}
                    onChange={(e) => updateField('nonStrikerName', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Runs</label>
                  <input
                    type="number"
                    min={0}
                    value={form.nonStrikerRuns}
                    onChange={(e) => updateField('nonStrikerRuns', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Balls</label>
                  <input
                    type="number"
                    min={0}
                    value={form.nonStrikerBalls}
                    onChange={(e) => updateField('nonStrikerBalls', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">4s</label>
                  <input
                    type="number"
                    min={0}
                    value={form.nonStrikerFours}
                    onChange={(e) => updateField('nonStrikerFours', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">6s</label>
                  <input
                    type="number"
                    min={0}
                    value={form.nonStrikerSixes}
                    onChange={(e) => updateField('nonStrikerSixes', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
              </div>

              {/* Current Bowler */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs items-end pt-2 border-t border-slate-800/70">
                <div className="col-span-2">
                  <label className="text-emerald-300 font-semibold block mb-1">Current Bowler Name</label>
                  <input
                    type="text"
                    value={form.bowlerName}
                    onChange={(e) => updateField('bowlerName', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Overs</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={form.bowlerOvers}
                    onChange={(e) => updateField('bowlerOvers', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Maidens</label>
                  <input
                    type="number"
                    min={0}
                    value={form.bowlerMaidens}
                    onChange={(e) => updateField('bowlerMaidens', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Runs</label>
                  <input
                    type="number"
                    min={0}
                    value={form.bowlerRuns}
                    onChange={(e) => updateField('bowlerRuns', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Wickets</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={form.bowlerWickets}
                    onChange={(e) => updateField('bowlerWickets', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Current Partnership & This Over Deliveries */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Current Partnership */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-purple-400">
                  4. Current Partnership
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Total Runs</label>
                    <input
                      type="number"
                      min={0}
                      value={form.partnershipRuns}
                      onChange={(e) => updateField('partnershipRuns', Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Total Balls</label>
                    <input
                      type="number"
                      min={0}
                      value={form.partnershipBalls}
                      onChange={(e) => updateField('partnershipBalls', Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Striker Contrib</label>
                    <input
                      type="number"
                      min={0}
                      value={form.partnershipPlayer1Runs}
                      onChange={(e) => updateField('partnershipPlayer1Runs', Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Non-Striker Contrib</label>
                    <input
                      type="number"
                      min={0}
                      value={form.partnershipPlayer2Runs}
                      onChange={(e) => updateField('partnershipPlayer2Runs', Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* This Over Deliveries Editor */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-sky-400">
                    5. Is Over Ki Deliveries (0, 1, 2, 3, 4, 6, W, wd, nb)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormDirty(true);
                      setOverDeliveries([]);
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </div>

                {/* Current Deliveries Preview Chips */}
                <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] bg-slate-900/90 border border-slate-800 rounded-lg p-2">
                  {overDeliveries.length > 0 ? (
                    overDeliveries.map((tok, idx) => (
                      <button
                        key={`${tok}-${idx}`}
                        type="button"
                        title="Click to remove delivery"
                        onClick={() => {
                          setIsFormDirty(true);
                          setOverDeliveries((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border flex items-center gap-1 hover:opacity-80 ${getDeliveryChipClass(
                          tok
                        )}`}
                      >
                        <span>{tok}</span>
                        <span className="text-[10px] opacity-75">×</span>
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">Niche buttons se deliveries add karein...</span>
                  )}
                </div>

                {/* Add Delivery Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {DELIVERY_TOKENS.map((tok) => (
                    <button
                      key={`add-${tok}`}
                      type="button"
                      onClick={() => {
                        setIsFormDirty(true);
                        setOverDeliveries((prev) => [...prev, tok].slice(-12));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold border border-slate-700"
                    >
                      +{tok}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                {isFormDirty ? (
                  <span className="text-amber-400 font-semibold">Unsaved changes ready to apply</span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Synced with Broadcast, OBS &amp; App
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isBusy}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isBusy ? 'Updating...' : 'Save & Update Broadcast / OBS / App'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>
            Abhi <strong className="text-emerald-400">Auto Sync</strong> active hai. Agar khud score, batsmen, bowler, partnership ya deliveries edit karni hain to upar <strong className="text-amber-300">Manual</strong> switch par click karein.
          </span>
          <button
            type="button"
            disabled={isBusy}
            onClick={handleRetrySync}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Test / Refresh Auto Sync</span>
          </button>
        </div>
      )}

      {/* Player Photos Manager: Photo Upload or Image URL for Striker, Non-Striker & Bowler */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-black uppercase tracking-wider text-sky-300">
              Player Photos (Photo Upload ya Image URL)
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Photo na hone par initials avatar dikhega. Transparent PNG best rehta hai.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {(
            [
              {
                role: 'striker' as const,
                label: 'Striker (Gold Ring)',
                name: form.strikerName || match?.striker?.name || 'Striker',
                team: form.battingTeamCode || match?.battingTeam?.code,
                currentImg: match?.striker?.imageUrl,
                ring: 'gold' as const,
                accent: 'text-amber-300 border-amber-500/30'
              },
              {
                role: 'nonStriker' as const,
                label: 'Non-Striker',
                name: form.nonStrikerName || match?.nonStriker?.name || 'Non-Striker',
                team: form.battingTeamCode || match?.battingTeam?.code,
                currentImg: match?.nonStriker?.imageUrl,
                ring: 'blue' as const,
                accent: 'text-sky-300 border-sky-500/30'
              },
              {
                role: 'bowler' as const,
                label: 'Bowler (Green Ring)',
                name: form.bowlerName || match?.currentBowler?.name || 'Bowler',
                team: form.bowlingTeamCode || match?.bowlingTeam?.code,
                currentImg: match?.currentBowler?.imageUrl,
                ring: 'green' as const,
                accent: 'text-emerald-300 border-emerald-500/30'
              }
            ]
          ).map((item) => {
            const isRoleBusy = photoBusyRole === item.role;
            return (
              <div
                key={item.role}
                className={`bg-slate-900/90 border rounded-xl p-3 space-y-2.5 ${item.accent}`}
              >
                <div className="flex items-center gap-3">
                  <PlayerAvatar
                    name={item.name}
                    teamCode={item.team}
                    imageUrl={item.currentImg}
                    size="md"
                    ringVariant={item.ring}
                    showJerseyNumber={false}
                    showStrikeBadge={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                      {item.label}
                    </div>
                    <div className="text-xs font-black text-white truncate">{item.name}</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <input
                    type="url"
                    value={photoUrls[item.role]}
                    onChange={(e) =>
                      setPhotoUrls((prev) => ({ ...prev, [item.role]: e.target.value }))
                    }
                    placeholder="https://... Image URL paste karein"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-slate-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <label className="flex-1 cursor-pointer px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors">
                      <Upload className="w-3 h-3 text-sky-400" />
                      <span>{isRoleBusy ? 'Uploading...' : 'Photo Upload'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        disabled={isRoleBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadPhotoFile(item.role, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={isRoleBusy}
                      onClick={() => handleApplyPhotoUrl(item.role)}
                      className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold disabled:opacity-50"
                    >
                      Save URL
                    </button>
                    <button
                      type="button"
                      disabled={isRoleBusy}
                      title="Reset to initials/default"
                      onClick={() => handleApplyPhotoUrl(item.role, '')}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 border border-slate-700 disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
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
