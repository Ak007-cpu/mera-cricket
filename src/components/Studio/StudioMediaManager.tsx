import React, { useState, useEffect, useMemo } from 'react';
import {
  ManagedPlayerProfile,
  ManagedTeamProfile,
  MatchState,
  PlayerRole
} from '../../types/cricket';
import {
  uploadPlayerPhoto,
  uploadTeamFlag,
  fetchCustomMedia,
  editMatchDetails
} from '../../services/api';
import {
  compressImageFile,
  saveStoredPlayerPhoto,
  getStoredPlayerPhoto,
  saveStoredTeamFlag,
  getStoredTeamFlag
} from '../../utils/mediaStorage';
import { useContent } from '../../context/ContentContext';
import {
  deleteManagedPlayerFromFirestore,
  deleteManagedTeamFromFirestore,
  sanitizeFirestoreId,
  saveManagedPlayerToFirestore,
  saveManagedTeamToFirestore,
  uploadImageAsset
} from '../../services/firebaseContentService';
import { normalizePlayerName } from '../../data/playersRegistry';
import { PlayerAvatar } from '../PlayerAvatar';
import { TeamFlag } from '../TeamFlag';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import {
  Upload,
  Flag,
  Users,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Save,
  Trash2
} from 'lucide-react';

interface StudioMediaManagerProps {
  match: MatchState | null;
  adminPin: string;
  isAuthorized: boolean;
  onRefresh: () => void;
}

interface PlayerEntry {
  id: string;
  key: string;
  originalName: string;
  name: string;
  teamCode: string;
  role: PlayerRole;
  roleTag: string;
  apiRole: 'striker' | 'nonStriker' | 'bowler' | 'player';
  imageUrl?: string;
  isCustom?: boolean;
}

const ROLES: PlayerRole[] = ['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper'];

export const StudioMediaManager: React.FC<StudioMediaManagerProps> = ({
  match,
  adminPin,
  isAuthorized,
  onRefresh
}) => {
  const {
    players: cloudPlayers,
    teams: cloudTeams,
    isFirebaseAdmin,
    upsertBackupPlayer,
    removeBackupPlayer,
    upsertBackupTeam,
    removeBackupTeam
  } = useContent();

  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Editable drafts for each player card
  const [playerDrafts, setPlayerDrafts] = useState<
    Record<string, { name: string; role: PlayerRole; imageUrl: string }>
  >({});

  // Editable drafts for batting & bowling teams
  const [teamDrafts, setTeamDrafts] = useState<{
    batting: { name: string; code: string; logoUrl: string };
    bowling: { name: string; code: string; logoUrl: string };
  }>({
    batting: { name: '', code: '', logoUrl: '' },
    bowling: { name: '', code: '', logoUrl: '' }
  });

  // Add new player state
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerTeam, setNewPlayerTeam] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState<PlayerRole>('Batter');
  const [newPlayerUrl, setNewPlayerUrl] = useState('');

  // Add/update custom team state
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCode, setNewTeamCode] = useState('');
  const [newTeamLogoUrl, setNewTeamLogoUrl] = useState('');

  const [serverCustomPlayers, setServerCustomPlayers] = useState<Record<string, string>>({});

  // Confirm delete modal target
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'player'; item: PlayerEntry }
    | { kind: 'team'; id: string; label: string; side?: 'batting' | 'bowling'; code: string; name: string }
    | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchCustomMedia().then((res) => {
      setServerCustomPlayers(res.players || {});
    });
  }, []);

  useEffect(() => {
    if (!match) return;
    setTeamDrafts({
      batting: {
        name: match.battingTeam.name || '',
        code: match.battingTeam.code || '',
        logoUrl:
          getStoredTeamFlag(match.battingTeam.name, match.battingTeam.code) ||
          (match.battingTeam.logoUrl && !match.battingTeam.logoUrl.startsWith('/api/team/flag/')
            ? match.battingTeam.logoUrl
            : '')
      },
      bowling: {
        name: match.bowlingTeam.name || '',
        code: match.bowlingTeam.code || '',
        logoUrl:
          getStoredTeamFlag(match.bowlingTeam.name, match.bowlingTeam.code) ||
          (match.bowlingTeam.logoUrl && !match.bowlingTeam.logoUrl.startsWith('/api/team/flag/')
            ? match.bowlingTeam.logoUrl
            : '')
      }
    });
    if (!newPlayerTeam && match.battingTeam?.code) {
      setNewPlayerTeam(match.battingTeam.code);
    }
  }, [match]);

  // Build unified deduplicated list of match players + Firebase managed players
  const allPlayers: PlayerEntry[] = useMemo(() => {
    const map = new Map<string, PlayerEntry>();

    const inferRole = (tag: string, explicit?: PlayerRole): PlayerRole => {
      if (explicit && ROLES.includes(explicit)) return explicit;
      if (tag.toLowerCase().includes('bowl')) return 'Bowler';
      return 'Batter';
    };

    const addPlayer = (
      name: string | undefined,
      teamCode: string,
      roleTag: string,
      apiRole: PlayerEntry['apiRole'],
      imageUrl?: string,
      explicitId?: string,
      explicitRole?: PlayerRole,
      isCustom = false
    ) => {
      if (!name || !name.trim()) return;
      const clean = normalizePlayerName(name);
      if (!clean) return;
      const existing = map.get(clean);
      const stored = getStoredPlayerPhoto(name, teamCode);
      const effectiveUrl = stored || imageUrl;
      const docId = explicitId || sanitizeFirestoreId(`${teamCode || 'crx'}_${clean}`, 'player');

      if (!existing) {
        map.set(clean, {
          id: docId,
          key: clean,
          originalName: name.trim(),
          name: name.trim(),
          teamCode: teamCode || 'CRX',
          role: inferRole(roleTag, explicitRole),
          roleTag,
          apiRole,
          imageUrl: effectiveUrl,
          isCustom
        });
      } else {
        map.set(clean, {
          ...existing,
          id: explicitId || existing.id,
          name: isCustom ? name.trim() : existing.name,
          role: explicitRole || existing.role,
          roleTag: apiRole !== 'player' && existing.apiRole === 'player' ? roleTag : existing.roleTag,
          apiRole: apiRole !== 'player' ? apiRole : existing.apiRole,
          imageUrl: effectiveUrl || existing.imageUrl,
          isCustom: existing.isCustom || isCustom
        });
      }
    };

    if (match) {
      const batCode = match.battingTeam?.code || 'BAT';
      const bowlCode = match.bowlingTeam?.code || 'BWL';

      addPlayer(match.striker?.name, batCode, 'Striker (On Strike)', 'striker', match.striker?.imageUrl);
      addPlayer(match.nonStriker?.name, batCode, 'Non-Striker', 'nonStriker', match.nonStriker?.imageUrl);
      addPlayer(match.currentBowler?.name, bowlCode, 'Current Bowler', 'bowler', match.currentBowler?.imageUrl);

      [match.scorecards?.firstInnings, match.scorecards?.secondInnings].forEach((inn) => {
        if (!inn) return;
        const innBat = inn.teamCode || batCode;
        const innBowl = innBat === batCode ? bowlCode : batCode;
        inn.batting?.forEach((b) => addPlayer(b.name, innBat, `${innBat} Batter`, 'player', b.imageUrl));
        inn.bowling?.forEach((bw) => addPlayer(bw.name, innBowl, `${innBowl} Bowler`, 'player', bw.imageUrl));
      });
    }

    Object.entries(serverCustomPlayers).forEach(([k, url]) => {
      if (k.includes(':')) {
        const [tCode, pName] = k.split(':');
        addPlayer(pName, tCode, `${tCode} Custom`, 'player', url, undefined, undefined, true);
      } else {
        addPlayer(k, 'CRX', 'Custom Saved', 'player', url, undefined, undefined, true);
      }
    });

    // Apply Firestore managed profiles (source of truth for name, role, photo)
    cloudPlayers.forEach((cp) => {
      const matchKey = normalizePlayerName(cp.originalName || cp.name);
      const existing = map.get(matchKey);
      if (existing) {
        map.set(matchKey, {
          ...existing,
          id: cp.id,
          name: cp.name,
          role: cp.role,
          teamCode: cp.teamCode || existing.teamCode,
          imageUrl: cp.imageUrl || existing.imageUrl,
          isCustom: true
        });
      } else {
        addPlayer(cp.name, cp.teamCode || 'CRX', `${cp.teamCode || 'CRX'} ${cp.role}`, 'player', cp.imageUrl, cp.id, cp.role, true);
      }
    });

    return Array.from(map.values());
  }, [match, serverCustomPlayers, cloudPlayers]);

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allPlayers;
    return allPlayers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.teamCode.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q)
    );
  }, [allPlayers, searchQuery]);

  if (!isAuthorized) return null;

  const getPlayerDraft = (player: PlayerEntry) => {
    const d = playerDrafts[player.key];
    return {
      name: d?.name ?? player.name,
      role: d?.role ?? player.role,
      imageUrl:
        d?.imageUrl ??
        (player.imageUrl &&
        !player.imageUrl.startsWith('/api/player/photo?') &&
        !player.imageUrl.startsWith('data:')
          ? player.imageUrl
          : '')
    };
  };

  const setPlayerDraftField = (
    player: PlayerEntry,
    patch: Partial<{ name: string; role: PlayerRole; imageUrl: string }>
  ) => {
    const cur = getPlayerDraft(player);
    setPlayerDrafts((prev) => ({
      ...prev,
      [player.key]: { ...cur, ...patch }
    }));
  };

  const savePlayerUnified = async (
    player: PlayerEntry,
    nextName: string,
    nextRole: PlayerRole,
    nextImageUrl: string,
    compressedBackupDataUrl?: string
  ) => {
    const cleanName = nextName.trim() || player.name;
    const backupImg = nextImageUrl && !nextImageUrl.startsWith('data:')
      ? nextImageUrl
      : compressedBackupDataUrl || nextImageUrl;

    // 1. Browser localStorage cache
    saveStoredPlayerPhoto(player.originalName, player.teamCode, backupImg);
    if (cleanName !== player.originalName) {
      saveStoredPlayerPhoto(cleanName, player.teamCode, backupImg);
    }

    // 2. Live Express server match + upload sync
    await uploadPlayerPhoto(
      {
        role: player.apiRole,
        imageDataUrl:
          nextImageUrl.startsWith('data:') && compressedBackupDataUrl?.startsWith('data:')
            ? compressedBackupDataUrl
            : undefined,
        imageUrl: nextImageUrl.startsWith('data:') ? '' : nextImageUrl,
        playerName: cleanName,
        teamCode: player.teamCode
      },
      adminPin
    );

    if (cleanName !== player.originalName && player.apiRole !== 'player') {
      await editMatchDetails(
        player.apiRole === 'striker'
          ? { strikerName: cleanName }
          : player.apiRole === 'nonStriker'
          ? { nonStrikerName: cleanName }
          : { bowlerName: cleanName },
        adminPin
      );
    }

    // 3. ContentContext + Firebase Firestore (preserve valid cloud URL if fallback was data:)
    const existingCloud = cloudPlayers.find((cp) => cp.id === player.id);
    const firestoreUrl =
      nextImageUrl && !nextImageUrl.startsWith('data:') && !nextImageUrl.startsWith('/api/player/photo?')
        ? nextImageUrl
        : existingCloud?.imageUrl || '';

    const profile: ManagedPlayerProfile = {
      id: player.id,
      name: cleanName,
      originalName: player.originalName,
      role: nextRole,
      teamCode: player.teamCode,
      imageUrl: firestoreUrl,
      updatedAt: Date.now()
    };
    upsertBackupPlayer(profile);

    if (isFirebaseAdmin) {
      await saveManagedPlayerToFirestore(profile);
    }
  };

  const handlePlayerPhotoFile = async (player: PlayerEntry, file?: File) => {
    if (!file) return;
    setBusyKey(`player:${player.key}`);
    setFeedback(null);
    try {
      const draft = getPlayerDraft(player);
      const uploaded = await uploadImageAsset(file, 'players', player.id, adminPin, 300);
      await savePlayerUnified(player, draft.name, draft.role, uploaded.url, uploaded.dataUrl);
      setPlayerDraftField(player, { imageUrl: uploaded.url.startsWith('data:') ? '' : uploaded.url });
      setFeedback({
        text: uploaded.storedInFirebase
          ? `${draft.name} ki compressed photo Firebase Storage & Firestore mein save ho gayi!`
          : `${draft.name} ki photo compress & local/server par save hui (${uploaded.storageError || 'Firebase Cloud ke liye Google Admin Sign-in zaroori hai'}).`,
        type: 'success'
      });
      onRefresh();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Player photo upload failed', type: 'error' });
    } finally {
      setBusyKey(null);
    }
  };

  const handleSavePlayerCard = async (player: PlayerEntry) => {
    const draft = getPlayerDraft(player);
    setBusyKey(`player:${player.key}`);
    setFeedback(null);
    try {
      const candidate = draft.imageUrl.trim() || player.imageUrl || '';
      const urlToSave = candidate.startsWith('/api/player/photo?') ? '' : candidate;
      await savePlayerUnified(player, draft.name, draft.role, urlToSave);
      setFeedback({
        text: `${draft.name} (${draft.role}) save ho gaya aur sab screens par update ho gaya!`,
        type: 'success'
      });
      onRefresh();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Failed to save player', type: 'error' });
    } finally {
      setBusyKey(null);
    }
  };

  const handleAddCustomPlayer = async (file?: File) => {
    const cleanName = newPlayerName.trim();
    if (!cleanName) {
      setFeedback({ text: 'Pehle player ka naam likhein.', type: 'error' });
      return;
    }
    const tCode = (newPlayerTeam || match?.battingTeam?.code || 'CRX').trim().toUpperCase();
    const docId = sanitizeFirestoreId(`${tCode}_${cleanName}_${Date.now()}`, 'player');
    setBusyKey('new-player');
    setFeedback(null);
    try {
      let finalUrl = newPlayerUrl.trim();
      let backupDataUrl: string | undefined;

      if (file) {
        const uploaded = await uploadImageAsset(file, 'players', docId, adminPin, 300);
        finalUrl = uploaded.url;
        backupDataUrl = uploaded.dataUrl;
      }

      if (backupDataUrl || finalUrl) {
        saveStoredPlayerPhoto(cleanName, tCode, backupDataUrl || finalUrl);
      }

      await uploadPlayerPhoto(
        {
          role: 'player',
          imageDataUrl: backupDataUrl,
          imageUrl: finalUrl,
          playerName: cleanName,
          teamCode: tCode
        },
        adminPin
      );

      const profile: ManagedPlayerProfile = {
        id: docId,
        name: cleanName,
        originalName: cleanName,
        role: newPlayerRole,
        teamCode: tCode,
        imageUrl: finalUrl,
        updatedAt: Date.now()
      };
      upsertBackupPlayer(profile);
      if (isFirebaseAdmin) {
        await saveManagedPlayerToFirestore(profile);
      }

      setServerCustomPlayers((prev) => ({
        ...prev,
        [`${tCode}:${normalizePlayerName(cleanName)}`]: backupDataUrl || finalUrl
      }));
      setNewPlayerName('');
      setNewPlayerUrl('');
      setFeedback({
        text: `${cleanName} (${newPlayerRole}) add aur save ho gaya!`,
        type: 'success'
      });
      onRefresh();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Custom player add failed', type: 'error' });
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveTeam = async (side: 'batting' | 'bowling', file?: File) => {
    if (!match) return;
    const draft = teamDrafts[side];
    const cleanName = draft.name.trim() || (side === 'batting' ? match.battingTeam.name : match.bowlingTeam.name);
    const cleanCode = (draft.code.trim() || (side === 'batting' ? match.battingTeam.code : match.bowlingTeam.code)).toUpperCase();
    const docId = sanitizeFirestoreId(`team_${cleanCode}`, 'team');

    setBusyKey(`team:${side}`);
    setFeedback(null);
    try {
      let finalLogoUrl = draft.logoUrl.trim();
      let dataUrl: string | undefined;
      if (file) {
        const uploaded = await uploadImageAsset(file, 'teams', docId, adminPin, 256);
        finalLogoUrl = uploaded.url;
        dataUrl = uploaded.dataUrl;
      }

      saveStoredTeamFlag(cleanCode, cleanName, dataUrl || finalLogoUrl);

      await uploadTeamFlag(
        {
          role: side,
          teamCode: cleanCode,
          teamName: cleanName,
          imageDataUrl: dataUrl,
          imageUrl: finalLogoUrl
        },
        adminPin
      );

      await editMatchDetails(
        side === 'batting'
          ? { battingTeamName: cleanName, battingTeamCode: cleanCode }
          : { bowlingTeamName: cleanName, bowlingTeamCode: cleanCode },
        adminPin
      );

      const teamProfile: ManagedTeamProfile = {
        id: docId,
        code: cleanCode,
        name: cleanName,
        logoUrl: finalLogoUrl,
        updatedAt: Date.now()
      };
      upsertBackupTeam(teamProfile);
      if (isFirebaseAdmin) {
        await saveManagedTeamToFirestore(teamProfile);
      }

      setTeamDrafts((prev) => ({
        ...prev,
        [side]: { name: cleanName, code: cleanCode, logoUrl: finalLogoUrl }
      }));

      setFeedback({
        text: `${cleanName} (${cleanCode}) team details & flag/logo save ho gayi!`,
        type: 'success'
      });
      onRefresh();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Team save failed', type: 'error' });
    } finally {
      setBusyKey(null);
    }
  };

  const handleAddExtraTeam = async (file?: File) => {
    const cleanName = newTeamName.trim();
    const cleanCode = newTeamCode.trim().toUpperCase();
    if (!cleanName || !cleanCode) {
      setFeedback({ text: 'Team ka naam aur short code (e.g. IND, PAK) likhein.', type: 'error' });
      return;
    }
    const docId = sanitizeFirestoreId(`team_${cleanCode}`, 'team');
    setBusyKey('new-team');
    setFeedback(null);
    try {
      let logoUrl = newTeamLogoUrl.trim();
      let dataUrl: string | undefined;
      if (file) {
        const uploaded = await uploadImageAsset(file, 'teams', docId, adminPin, 256);
        logoUrl = uploaded.url;
        dataUrl = uploaded.dataUrl;
      }
      if (dataUrl || logoUrl) {
        saveStoredTeamFlag(cleanCode, cleanName, dataUrl || logoUrl);
      }
      const profile: ManagedTeamProfile = {
        id: docId,
        code: cleanCode,
        name: cleanName,
        logoUrl,
        updatedAt: Date.now()
      };
      upsertBackupTeam(profile);
      if (isFirebaseAdmin) {
        await saveManagedTeamToFirestore(profile);
      }
      setNewTeamName('');
      setNewTeamCode('');
      setNewTeamLogoUrl('');
      setFeedback({ text: `${cleanName} (${cleanCode}) team save ho gayi!`, type: 'success' });
    } catch (err: any) {
      setFeedback({ text: err.message || 'Team add failed', type: 'error' });
    } finally {
      setBusyKey(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.kind === 'player') {
        const p = deleteTarget.item;
        saveStoredPlayerPhoto(p.originalName, p.teamCode, '');
        saveStoredPlayerPhoto(p.name, p.teamCode, '');
        await uploadPlayerPhoto(
          {
            role: p.apiRole,
            imageUrl: '',
            playerName: p.name,
            teamCode: p.teamCode
          },
          adminPin
        );
        removeBackupPlayer(p.id);
        if (isFirebaseAdmin) {
          await deleteManagedPlayerFromFirestore(p.id);
        }
        setFeedback({ text: `${p.name} ki custom profile delete/reset ho gayi.`, type: 'success' });
      } else {
        saveStoredTeamFlag(deleteTarget.code, deleteTarget.name, '');
        if (deleteTarget.side) {
          await uploadTeamFlag(
            {
              role: deleteTarget.side,
              teamCode: deleteTarget.code,
              teamName: deleteTarget.name,
              imageUrl: ''
            },
            adminPin
          );
        }
        removeBackupTeam(deleteTarget.id);
        if (isFirebaseAdmin) {
          await deleteManagedTeamFromFirestore(deleteTarget.id);
        }
        setFeedback({ text: `${deleteTarget.label} custom flag/record delete ho gaya.`, type: 'success' });
      }
      setDeleteTarget(null);
      onRefresh();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Delete failed', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border border-rose-800 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 1. Teams: Name + Flag/Logo Manager */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                Teams: Names, Flags &amp; Logos
              </h3>
              <p className="text-xs text-slate-400">
                Teams ka naam aur flag/logo badlein — Broadcast, OBS Overlay aur Android app par foran update hoga.
              </p>
            </div>
          </div>
        </div>

        {match ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(
              [
                { side: 'batting' as const, label: 'Batting Team', team: match.battingTeam },
                { side: 'bowling' as const, label: 'Bowling Team', team: match.bowlingTeam }
              ]
            ).map(({ side, label, team }) => {
              const isSideBusy = busyKey === `team:${side}`;
              const draft = teamDrafts[side];
              const docId = sanitizeFirestoreId(`team_${draft.code || team.code}`, 'team');
              return (
                <div
                  key={side}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <TeamFlag
                      teamName={draft.name || team.name}
                      teamCode={draft.code || team.code}
                      logoUrl={draft.logoUrl || team.logoUrl}
                      size="lg"
                      className="border-2 border-sky-400/50"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                        {label}
                      </div>
                      <div className="text-sm font-black text-white truncate">
                        {draft.name || team.name} ({draft.code || team.code})
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 block mb-1">Team Name</label>
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) =>
                          setTeamDrafts((prev) => ({
                            ...prev,
                            [side]: { ...prev[side], name: e.target.value }
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Code</label>
                      <input
                        type="text"
                        value={draft.code}
                        onChange={(e) =>
                          setTeamDrafts((prev) => ({
                            ...prev,
                            [side]: { ...prev[side], code: e.target.value.toUpperCase() }
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Flag / Logo URL</label>
                    <input
                      type="url"
                      value={draft.logoUrl}
                      onChange={(e) =>
                        setTeamDrafts((prev) => ({
                          ...prev,
                          [side]: { ...prev[side], logoUrl: e.target.value }
                        }))
                      }
                      placeholder="https://... Team Logo / Flag URL"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder:text-slate-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex-1 cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-sky-400" />
                      <span>{isSideBusy ? 'Uploading...' : 'Upload Logo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isSideBusy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleSaveTeam(side, f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={isSideBusy}
                      onClick={() => handleSaveTeam(side)}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSideBusy}
                      title="Delete custom team flag"
                      onClick={() =>
                        setDeleteTarget({
                          kind: 'team',
                          id: docId,
                          label: draft.name || team.name,
                          side,
                          code: draft.code || team.code,
                          name: draft.name || team.name
                        })
                      }
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-700 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-400 bg-slate-950 p-4 rounded-xl border border-slate-800">
            Active match connect karne par live teams yahan dikhengi.
          </div>
        )}

        {/* Add Custom Team Row */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Additional Team Flag / Name Save Karein</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team Name (e.g. Pakistan)"
              className="sm:col-span-4 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
            />
            <input
              type="text"
              value={newTeamCode}
              onChange={(e) => setNewTeamCode(e.target.value.toUpperCase())}
              placeholder="Code (PAK)"
              className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono"
            />
            <input
              type="url"
              value={newTeamLogoUrl}
              onChange={(e) => setNewTeamLogoUrl(e.target.value)}
              placeholder="Logo URL (optional)"
              className="sm:col-span-4 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono"
            />
            <div className="sm:col-span-2 flex gap-1.5">
              <label className="flex-1 cursor-pointer px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 flex items-center justify-center gap-1">
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAddExtraTeam(f);
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                disabled={busyKey === 'new-team' || !newTeamName.trim() || !newTeamCode.trim()}
                onClick={() => handleAddExtraTeam()}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>

          {cloudTeams.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/70">
              {cloudTeams.map((ct) => (
                <div
                  key={ct.id}
                  className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs"
                >
                  <TeamFlag teamName={ct.name} teamCode={ct.code} logoUrl={ct.logoUrl} size="xs" />
                  <span className="font-bold text-white">{ct.name}</span>
                  <span className="text-slate-400 font-mono">({ct.code})</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({
                        kind: 'team',
                        id: ct.id,
                        label: ct.name,
                        code: ct.code,
                        name: ct.name
                      })
                    }
                    className="text-slate-500 hover:text-rose-400 ml-1"
                    title="Delete team"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Players: Photo, Name & Role Manager */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                Players: Photo, Name &amp; Role ({allPlayers.length} Players)
              </h3>
              <p className="text-xs text-slate-400">
                Har player ki photo upload ya URL, naam aur role edit karke Save karein.
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player, team, role..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Add New Player Row */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Naya Player Add Karein (Name, Role, Team &amp; Photo)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Player Name (e.g. Virat Kohli)"
              className="sm:col-span-3 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
            />
            <select
              value={newPlayerRole}
              onChange={(e) => setNewPlayerRole(e.target.value as PlayerRole)}
              className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newPlayerTeam}
              onChange={(e) => setNewPlayerTeam(e.target.value.toUpperCase())}
              placeholder="Team (IND)"
              className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono"
            />
            <input
              type="url"
              value={newPlayerUrl}
              onChange={(e) => setNewPlayerUrl(e.target.value)}
              placeholder="Image URL (optional)"
              className="sm:col-span-3 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono"
            />
            <div className="sm:col-span-2 flex gap-1.5">
              <label className="flex-1 cursor-pointer px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 flex items-center justify-center gap-1">
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAddCustomPlayer(f);
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                disabled={busyKey === 'new-player' || !newPlayerName.trim()}
                onClick={() => handleAddCustomPlayer()}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* All Players Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPlayers.map((player) => {
            const isBusy = busyKey === `player:${player.key}`;
            const draft = getPlayerDraft(player);

            const ring =
              player.apiRole === 'striker'
                ? 'gold'
                : player.apiRole === 'bowler'
                ? 'green'
                : 'blue';

            return (
              <div
                key={player.key}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5"
              >
                <div className="flex items-center gap-3">
                  <PlayerAvatar
                    name={draft.name}
                    teamCode={player.teamCode}
                    imageUrl={draft.imageUrl || player.imageUrl}
                    size="md"
                    ringVariant={ring}
                    showJerseyNumber={false}
                    showStrikeBadge={false}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="font-bold text-sky-300">{player.teamCode}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400 truncate">{player.roleTag}</span>
                    </div>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) => setPlayerDraftField(player, { name: e.target.value })}
                      placeholder="Player Name"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <select
                    value={draft.role}
                    onChange={(e) =>
                      setPlayerDraftField(player, { role: e.target.value as PlayerRole })
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <input
                    type="url"
                    value={draft.imageUrl}
                    onChange={(e) => setPlayerDraftField(player, { imageUrl: e.target.value })}
                    placeholder="Image URL"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono placeholder:text-slate-500"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <label className="flex-1 cursor-pointer px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 flex items-center justify-center gap-1">
                    <Upload className="w-3 h-3 text-emerald-400" />
                    <span>{isBusy ? 'Saving...' : 'Photo Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isBusy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePlayerPhotoFile(player, f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleSavePlayerCard(player)}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold flex items-center gap-1 disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" />
                    <span>Save</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    title="Delete / Reset player media"
                    onClick={() => setDeleteTarget({ kind: 'player', item: player })}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-700 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Are you sure?"
        itemName={
          deleteTarget?.kind === 'player' ? deleteTarget.item.name : deleteTarget?.label
        }
        isDeleting={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
