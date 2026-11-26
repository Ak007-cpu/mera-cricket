import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { ADMIN_EMAIL, auth, googleProvider } from '../firebase';
import {
  BlogPost,
  ManagedPlayerProfile,
  ManagedTeamProfile,
  MatchState,
  MediaLibraryItem,
  MonetizationConfig,
  NewsItem,
  VideoSourceConfig
} from '../types/cricket';
import {
  subscribeBlogPosts,
  subscribeManagedPlayers,
  subscribeManagedTeams,
  subscribeMediaLibrary,
  subscribeNewsItems,
  subscribeSiteMonetization,
  subscribeVideoSources
} from '../services/firebaseContentService';
import { normalizePlayerName, normalizeTeamCode } from '../data/playersRegistry';
import {
  saveStoredPlayerPhoto,
  saveStoredSponsorMedia,
  saveStoredTeamFlag
} from '../utils/mediaStorage';
import { fetchServerAdminNews } from '../services/api';

const BACKUP_STORAGE_KEY = 'live_cricket_cms_backup_v1';

interface LocalCmsBackup {
  players: ManagedPlayerProfile[];
  teams: ManagedTeamProfile[];
  news: NewsItem[];
  blogs: BlogPost[];
  mediaLibrary: MediaLibraryItem[];
  videoSources: VideoSourceConfig[];
  siteMonetization?: Partial<MonetizationConfig> | null;
}

function readBackup(): LocalCmsBackup {
  if (typeof window === 'undefined') {
    return { players: [], teams: [], news: [], blogs: [], mediaLibrary: [], videoSources: [] };
  }
  try {
    const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (!raw) return { players: [], teams: [], news: [], blogs: [], mediaLibrary: [], videoSources: [] };
    const parsed = JSON.parse(raw);
    return {
      players: Array.isArray(parsed?.players) ? parsed.players : [],
      teams: Array.isArray(parsed?.teams) ? parsed.teams : [],
      news: Array.isArray(parsed?.news) ? parsed.news : [],
      blogs: Array.isArray(parsed?.blogs) ? parsed.blogs : [],
      mediaLibrary: Array.isArray(parsed?.mediaLibrary) ? parsed.mediaLibrary : [],
      videoSources: Array.isArray(parsed?.videoSources) ? parsed.videoSources : [],
      siteMonetization: parsed?.siteMonetization || null
    };
  } catch {
    return { players: [], teams: [], news: [], blogs: [], mediaLibrary: [], videoSources: [] };
  }
}

function writeBackup(data: LocalCmsBackup) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Could not write CMS localStorage backup:', err);
  }
}

interface ContentContextValue {
  firebaseUser: User | null;
  authReady: boolean;
  isFirebaseAdmin: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<boolean>;
  signOutFirebase: () => Promise<void>;
  players: ManagedPlayerProfile[];
  teams: ManagedTeamProfile[];
  news: NewsItem[];
  breakingNews: NewsItem[];
  blogs: BlogPost[];
  publishedBlogs: BlogPost[];
  mediaLibrary: MediaLibraryItem[];
  videoSources: VideoSourceConfig[];
  cloudMonetization: Partial<MonetizationConfig> | null;
  findManagedPlayerOverride: (
    playerId?: string,
    name?: string,
    teamCode?: string
  ) => ManagedPlayerProfile | undefined;
  applyContentOverridesToMatch: (match: MatchState | null) => MatchState | null;
  mergeMonetization: (serverConfig: MonetizationConfig | null) => MonetizationConfig | null;
  upsertBackupPlayer: (p: ManagedPlayerProfile) => void;
  removeBackupPlayer: (id: string) => void;
  upsertBackupTeam: (t: ManagedTeamProfile) => void;
  removeBackupTeam: (id: string) => void;
  upsertBackupNews: (n: NewsItem) => void;
  removeBackupNews: (id: string) => void;
  upsertBackupBlog: (b: BlogPost) => void;
  removeBackupBlog: (id: string) => void;
  upsertBackupMediaItem: (m: MediaLibraryItem) => void;
  removeBackupMediaItem: (id: string) => void;
  upsertBackupVideoSource: (v: VideoSourceConfig) => void;
  upsertBackupVideoSourcesBatch: (list: VideoSourceConfig[]) => void;
  removeBackupVideoSource: (id: string) => void;
  setBackupMonetization: (cfg: Partial<MonetizationConfig>) => void;
}

const ContentContext = createContext<ContentContextValue | null>(null);

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialBackup = useMemo(() => readBackup(), []);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [players, setPlayers] = useState<ManagedPlayerProfile[]>(initialBackup.players);
  const [teams, setTeams] = useState<ManagedTeamProfile[]>(initialBackup.teams);
  const [news, setNews] = useState<NewsItem[]>(initialBackup.news);
  const [blogs, setBlogs] = useState<BlogPost[]>(initialBackup.blogs);
  const [mediaLibrary, setMediaLibrary] = useState<MediaLibraryItem[]>(initialBackup.mediaLibrary);
  const [videoSources, setVideoSources] = useState<VideoSourceConfig[]>(initialBackup.videoSources);
  const [cloudMonetization, setCloudMonetization] = useState<Partial<MonetizationConfig> | null>(
    initialBackup.siteMonetization || null
  );

  const isFirebaseAdmin = Boolean(
    firebaseUser && firebaseUser.email === ADMIN_EMAIL && firebaseUser.emailVerified
  );

  // Persist backup automatically whenever state updates
  useEffect(() => {
    writeBackup({
      players,
      teams,
      news,
      blogs,
      mediaLibrary,
      videoSources,
      siteMonetization: cloudMonetization
    });
  }, [players, teams, news, blogs, mediaLibrary, videoSources, cloudMonetization]);

  // Listen for Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user && user.email !== ADMIN_EMAIL) {
        setAuthError(`Signed in as ${user.email}. Admin writes require ${ADMIN_EMAIL}.`);
      } else {
        setAuthError(null);
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to public Firestore collections (players, teams, news, site_config)
  useEffect(() => {
    const unsubPlayers = subscribeManagedPlayers(
      (list) => {
        setPlayers(list);
        list.forEach((p) => {
          if (p.imageUrl && p.imageUrl.trim()) {
            const cleanUrl = p.imageUrl.trim();
            saveStoredPlayerPhoto(p.originalName || p.name, p.teamCode, cleanUrl);
            if (p.originalName && p.originalName !== p.name) {
              saveStoredPlayerPhoto(p.name, p.teamCode, cleanUrl);
            }
            // Pre-warm browser cache silently for remote Firebase/HTTP images
            if (typeof window !== 'undefined' && /^https?:\/\//i.test(cleanUrl)) {
              const preloader = new Image();
              preloader.referrerPolicy = 'no-referrer';
              preloader.src = cleanUrl;
            }
          }
        });
      },
      (err) => console.warn('Players listener fallback to backup:', err)
    );

    const unsubTeams = subscribeManagedTeams(
      (list) => {
        setTeams(list);
        list.forEach((t) => {
          if (t.logoUrl) {
            saveStoredTeamFlag(t.code, t.name, t.logoUrl);
          }
        });
      },
      (err) => console.warn('Teams listener fallback to backup:', err)
    );

    let serverNewsSnapshot: NewsItem[] = [];
    let firestoreNewsSnapshot: NewsItem[] = [];
    let hasFirestoreNews = false;

    const mergeAndSetNews = () => {
      const byId = new Map<string, NewsItem>();
      serverNewsSnapshot.forEach((item) => {
        if (item?.id) byId.set(item.id, item);
      });
      firestoreNewsSnapshot.forEach((item) => {
        if (item?.id) byId.set(item.id, item);
      });
      if (!hasFirestoreNews && byId.size === 0) return;
      const merged = Array.from(byId.values()).sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.isBreaking !== b.isBreaking) return a.isBreaking ? -1 : 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
      setNews(merged);
    };

    fetchServerAdminNews()
      .then((res) => {
        if (res.news.length > 0) {
          serverNewsSnapshot = res.news;
          mergeAndSetNews();
        }
      })
      .catch(() => {});

    const unsubNews = subscribeNewsItems(
      (list) => {
        hasFirestoreNews = true;
        firestoreNewsSnapshot = list;
        mergeAndSetNews();
      },
      (err) => console.warn('News listener fallback to backup:', err)
    );

    const unsubMonetization = subscribeSiteMonetization(
      (cfg) => {
        if (cfg) {
          setCloudMonetization(cfg);
          if (cfg.sponsor) {
            saveStoredSponsorMedia({
              logoUrl: cfg.sponsor.logoUrl,
              imageUrl: cfg.sponsor.imageUrl
            });
          }
        }
      },
      (err) => console.warn('Site config listener fallback to backup:', err)
    );

    return () => {
      unsubPlayers();
      unsubTeams();
      unsubNews();
      unsubMonetization();
    };
  }, []);

  // Subscribe to Blogs (auth-aware: admins receive drafts + published; public receives published only)
  useEffect(() => {
    if (!authReady) return;
    const unsubBlogs = subscribeBlogPosts(
      isFirebaseAdmin,
      (list) => {
        setBlogs(list);
      },
      (err) => console.warn('Blogs listener fallback to backup:', err)
    );
    return () => unsubBlogs();
  }, [authReady, isFirebaseAdmin]);

  // Subscribe to Admin Media Library (admin-only collection)
  useEffect(() => {
    if (!authReady || !isFirebaseAdmin) return;
    const unsubMediaLibrary = subscribeMediaLibrary(
      isFirebaseAdmin,
      (list) => {
        setMediaLibrary(list);
      },
      (err) => console.warn('Media library listener fallback to backup:', err)
    );
    return () => unsubMediaLibrary();
  }, [authReady, isFirebaseAdmin]);

  // Subscribe to Admin Video Sources (admin-only collection)
  useEffect(() => {
    if (!authReady || !isFirebaseAdmin) return;
    const unsubVideoSources = subscribeVideoSources(
      isFirebaseAdmin,
      (list) => {
        setVideoSources(list);
      },
      (err) => console.warn('Video sources listener fallback to backup:', err)
    );
    return () => unsubVideoSources();
  }, [authReady, isFirebaseAdmin]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user.email !== ADMIN_EMAIL) {
        setAuthError(
          `Signed in as ${cred.user.email}. Only ${ADMIN_EMAIL} can publish changes globally.`
        );
        return false;
      }
      return true;
    } catch (err: any) {
      setAuthError(err?.message || 'Google sign-in cancelled or failed.');
      return false;
    }
  }, []);

  const signOutFirebase = useCallback(async () => {
    await signOut(auth);
    setAuthError(null);
  }, []);

  // Lookup maps for fast O(1) override application across Broadcast, OBS & Android
  const playerOverrideMap = useMemo(() => {
    const map = new Map<string, ManagedPlayerProfile>();
    const setPreferred = (key: string, p: ManagedPlayerProfile) => {
      if (!key) return;
      const existing = map.get(key);
      // Prefer profile with a saved imageUrl (or newer updatedAt)
      if (!existing || (!existing.imageUrl && p.imageUrl) || (p.imageUrl && (p.updatedAt || 0) >= (existing.updatedAt || 0))) {
        map.set(key, p);
      }
    };
    players.forEach((p) => {
      const t = p.teamCode ? normalizeTeamCode(p.teamCode) : '';
      const n1 = normalizePlayerName(p.name);
      if (n1) {
        setPreferred(n1, p);
        if (t) setPreferred(`${t}:${n1}`, p);
      }
      if (p.originalName) {
        const n2 = normalizePlayerName(p.originalName);
        if (n2) {
          setPreferred(n2, p);
          if (t) setPreferred(`${t}:${n2}`, p);
        }
      }
      if (p.id) setPreferred(p.id.toLowerCase(), p);
    });
    return map;
  }, [players]);

  const findManagedPlayerOverride = useCallback(
    (id?: string, name?: string, teamCode?: string): ManagedPlayerProfile | undefined => {
      const nKey = name ? normalizePlayerName(name) : '';
      const tKey = teamCode ? normalizeTeamCode(teamCode) : '';
      const idKey = id ? id.toLowerCase() : '';
      return (
        (tKey && nKey && playerOverrideMap.get(`${tKey}:${nKey}`)) ||
        (nKey && playerOverrideMap.get(nKey)) ||
        (idKey && playerOverrideMap.get(idKey)) ||
        undefined
      );
    },
    [playerOverrideMap]
  );

  const teamOverrideMap = useMemo(() => {
    const map = new Map<string, ManagedTeamProfile>();
    teams.forEach((t) => {
      const c = normalizeTeamCode(t.code);
      if (c) map.set(c, t);
      const n = normalizeTeamCode(t.name);
      if (n) map.set(n, t);
      if (t.id) map.set(t.id.toLowerCase(), t);
    });
    return map;
  }, [teams]);

  const applyContentOverridesToMatch = useCallback(
    (match: MatchState | null): MatchState | null => {
      if (!match) return null;
      if (players.length === 0 && teams.length === 0) return match;

      const findTeam = (name?: string, code?: string) => {
        const cKey = code ? normalizeTeamCode(code) : '';
        const nKey = name ? normalizeTeamCode(name) : '';
        return (cKey && teamOverrideMap.get(cKey)) || (nKey && teamOverrideMap.get(nKey)) || undefined;
      };

      const batTeamOv = findTeam(match.battingTeam?.name, match.battingTeam?.code);
      const bowlTeamOv = findTeam(match.bowlingTeam?.name, match.bowlingTeam?.code);
      const batCode = batTeamOv?.code || match.battingTeam?.code;
      const bowlCode = bowlTeamOv?.code || match.bowlingTeam?.code;

      const strikerOv = findManagedPlayerOverride(match.striker?.playerId, match.striker?.name, batCode);
      const nonStrikerOv = findManagedPlayerOverride(match.nonStriker?.playerId, match.nonStriker?.name, batCode);
      const bowlerOv = findManagedPlayerOverride(match.currentBowler?.playerId, match.currentBowler?.name, bowlCode);

      const overrideInnings = (inn?: typeof match.scorecards extends undefined ? never : NonNullable<MatchState['scorecards']>['firstInnings']) => {
        if (!inn) return inn;
        const innBatCode = inn.teamCode || batCode;
        const innBowlCode =
          normalizeTeamCode(innBatCode) === normalizeTeamCode(batCode) ? bowlCode : batCode;
        return {
          ...inn,
          batting: inn.batting?.map((b) => {
            const ov = findManagedPlayerOverride(b.playerId, b.name, innBatCode);
            if (!ov) return b;
            return {
              ...b,
              name: ov.name || b.name,
              imageUrl: ov.imageUrl || b.imageUrl
            };
          }),
          bowling: inn.bowling?.map((bw) => {
            const ov = findManagedPlayerOverride(bw.playerId, bw.name, innBowlCode);
            if (!ov) return bw;
            return {
              ...bw,
              name: ov.name || bw.name,
              imageUrl: ov.imageUrl || bw.imageUrl
            };
          })
        };
      };

      return {
        ...match,
        battingTeam: batTeamOv
          ? {
              ...match.battingTeam,
              name: batTeamOv.name || match.battingTeam.name,
              code: batTeamOv.code || match.battingTeam.code,
              shortName: batTeamOv.code || match.battingTeam.shortName,
              logoUrl: batTeamOv.logoUrl || match.battingTeam.logoUrl
            }
          : match.battingTeam,
        bowlingTeam: bowlTeamOv
          ? {
              ...match.bowlingTeam,
              name: bowlTeamOv.name || match.bowlingTeam.name,
              code: bowlTeamOv.code || match.bowlingTeam.code,
              shortName: bowlTeamOv.code || match.bowlingTeam.shortName,
              logoUrl: bowlTeamOv.logoUrl || match.bowlingTeam.logoUrl
            }
          : match.bowlingTeam,
        striker: strikerOv
          ? {
              ...match.striker,
              name: strikerOv.name || match.striker.name,
              imageUrl: strikerOv.imageUrl || match.striker.imageUrl
            }
          : match.striker,
        nonStriker: nonStrikerOv
          ? {
              ...match.nonStriker,
              name: nonStrikerOv.name || match.nonStriker.name,
              imageUrl: nonStrikerOv.imageUrl || match.nonStriker.imageUrl
            }
          : match.nonStriker,
        currentBowler: bowlerOv
          ? {
              ...match.currentBowler,
              name: bowlerOv.name || match.currentBowler.name,
              imageUrl: bowlerOv.imageUrl || match.currentBowler.imageUrl
            }
          : match.currentBowler,
        scorecards: match.scorecards
          ? {
              firstInnings: overrideInnings(match.scorecards.firstInnings),
              secondInnings: overrideInnings(match.scorecards.secondInnings)
            }
          : match.scorecards
      };
    },
    [players.length, teams.length, findManagedPlayerOverride, teamOverrideMap]
  );

  const mergeMonetization = useCallback(
    (serverConfig: MonetizationConfig | null): MonetizationConfig | null => {
      if (!cloudMonetization) return serverConfig;
      const base: MonetizationConfig = serverConfig || {
        adsEnabled: false,
        adsensePublisherId: '',
        adsenseAutoAds: true,
        adsenseTestMode: false,
        adsenseHidePlaceholders: false,
        adsTxtCustomLines: '',
        slots: {
          topBanner: { enabled: true, slotId: '', adFormat: 'auto', adSource: 'auto', imageUrl: '', linkUrl: '', title: '' },
          inContent: { enabled: true, slotId: '', adFormat: 'auto', adSource: 'auto', imageUrl: '', linkUrl: '', title: '' },
          footerBanner: { enabled: true, slotId: '', adFormat: 'auto', adSource: 'auto', imageUrl: '', linkUrl: '', title: '' },
          mobileBanner: { enabled: true, slotId: '', adFormat: 'horizontal', adSource: 'auto', imageUrl: '', linkUrl: '', title: '' }
        },
        sponsor: {
          enabled: false,
          name: '',
          tagline: '',
          logoUrl: '',
          imageUrl: '',
          linkUrl: ''
        },
        siteName: 'Live Cricket HD',
        contactEmail: '',
        updatedAt: Date.now()
      };

      // Prefer whichever was updated most recently (cloud Firestore vs Express memory)
      const cloudTime = cloudMonetization.updatedAt || 0;
      const serverTime = serverConfig?.updatedAt || 0;
      if (serverConfig && serverTime > cloudTime) {
        return serverConfig;
      }

      const sb = serverConfig?.broadcastSettings;
      const cb = cloudMonetization.broadcastSettings;
      const mergedBroadcastSettings = sb
        ? {
            ...sb,
            animationsEnabled:
              cb?.animationsEnabled !== undefined ? cb.animationsEnabled : sb.animationsEnabled,
            newsMarqueeEnabled:
              cb?.newsMarqueeEnabled !== undefined ? cb.newsMarqueeEnabled : sb.newsMarqueeEnabled,
            winProbabilityEnabled:
              cb?.winProbabilityEnabled !== undefined
                ? cb.winProbabilityEnabled
                : sb.winProbabilityEnabled,
            winProbabilityOverride: cb?.winProbabilityOverride || sb.winProbabilityOverride,
            obsPanels: cb?.obsPanels || sb.obsPanels,
            appDownload: cb?.appDownload || sb.appDownload,
            sixProCricket: cb?.sixProCricket || sb.sixProCricket,
            nextMatch: cb?.nextMatch || sb.nextMatch,
            announcement: cb?.announcement || sb.announcement,
            mobileApp: cb?.mobileApp || sb.mobileApp,
            holdScreen: cb?.holdScreen || sb.holdScreen,
            matchTimer: cb?.matchTimer || sb.matchTimer,
            tvScreen: cb?.tvScreen || sb.tvScreen,
            soundSettings: cb?.soundSettings || sb.soundSettings
          }
        : cb || base.broadcastSettings;

      return {
        ...base,
        ...cloudMonetization,
        slots: {
          topBanner: cloudMonetization.slots?.topBanner || base.slots.topBanner,
          inContent: cloudMonetization.slots?.inContent || base.slots.inContent,
          footerBanner: cloudMonetization.slots?.footerBanner || base.slots.footerBanner,
          mobileBanner: cloudMonetization.slots?.mobileBanner || base.slots.mobileBanner || {
            enabled: true,
            slotId: '',
            imageUrl: '',
            linkUrl: '',
            title: ''
          }
        },
        sponsor: cloudMonetization.sponsor || base.sponsor,
        broadcastSettings: mergedBroadcastSettings
      };
    },
    [cloudMonetization]
  );

  const breakingNews = useMemo(
    () => news.filter((item) => item.isBreaking || item.category === 'Breaking' || item.pinned),
    [news]
  );

  const publishedBlogs = useMemo(
    () => blogs.filter((post) => post.status === 'published'),
    [blogs]
  );

  // Local backup helper mutators
  const upsertBackupPlayer = useCallback((p: ManagedPlayerProfile) => {
    setPlayers((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = p;
        return next;
      }
      return [p, ...prev];
    });
  }, []);

  const removeBackupPlayer = useCallback((id: string) => {
    setPlayers((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const upsertBackupTeam = useCallback((t: ManagedTeamProfile) => {
    setTeams((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = t;
        return next;
      }
      return [t, ...prev];
    });
  }, []);

  const removeBackupTeam = useCallback((id: string) => {
    setTeams((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const upsertBackupNews = useCallback((n: NewsItem) => {
    setNews((prev) => {
      const idx = prev.findIndex((x) => x.id === n.id);
      const next = idx >= 0 ? prev.map((x, i) => (i === idx ? n : x)) : [n, ...prev];
      return [...next].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.isBreaking !== b.isBreaking) return a.isBreaking ? -1 : 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
    });
  }, []);

  const removeBackupNews = useCallback((id: string) => {
    setNews((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const upsertBackupBlog = useCallback((b: BlogPost) => {
    setBlogs((prev) => {
      const idx = prev.findIndex((x) => x.id === b.id);
      const next = idx >= 0 ? prev.map((x, i) => (i === idx ? b : x)) : [b, ...prev];
      return [...next].sort((a, b2) => (b2.updatedAt || 0) - (a.updatedAt || 0));
    });
  }, []);

  const removeBackupBlog = useCallback((id: string) => {
    setBlogs((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const upsertBackupMediaItem = useCallback((m: MediaLibraryItem) => {
    setMediaLibrary((prev) => {
      const idx = prev.findIndex((x) => x.id === m.id);
      const next = idx >= 0 ? prev.map((x, i) => (i === idx ? m : x)) : [m, ...prev];
      return [...next].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    });
  }, []);

  const removeBackupMediaItem = useCallback((id: string) => {
    setMediaLibrary((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const upsertBackupVideoSource = useCallback((v: VideoSourceConfig) => {
    setVideoSources((prev) => {
      const idx = prev.findIndex((x) => x.id === v.id);
      const next = idx >= 0 ? prev.map((x, i) => (i === idx ? v : x)) : [v, ...prev];
      return [...next].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    });
  }, []);

  const upsertBackupVideoSourcesBatch = useCallback((list: VideoSourceConfig[]) => {
    if (!Array.isArray(list) || list.length === 0) return;
    setVideoSources((prev) => {
      const byId = new Map<string, VideoSourceConfig>();
      for (const existing of prev) {
        byId.set(existing.id, existing);
      }
      for (const item of list) {
        if (item?.id) {
          byId.set(item.id, item);
        }
      }
      return Array.from(byId.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    });
  }, []);

  const removeBackupVideoSource = useCallback((id: string) => {
    setVideoSources((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const setBackupMonetization = useCallback((cfg: Partial<MonetizationConfig>) => {
    setCloudMonetization(cfg);
  }, []);

  return (
    <ContentContext.Provider
      value={{
        firebaseUser,
        authReady,
        isFirebaseAdmin,
        authError,
        signInWithGoogle,
        signOutFirebase,
        players,
        teams,
        news,
        breakingNews,
        blogs,
        publishedBlogs,
        mediaLibrary,
        videoSources,
        cloudMonetization,
        findManagedPlayerOverride,
        applyContentOverridesToMatch,
        mergeMonetization,
        upsertBackupPlayer,
        removeBackupPlayer,
        upsertBackupTeam,
        removeBackupTeam,
        upsertBackupNews,
        removeBackupNews,
        upsertBackupBlog,
        removeBackupBlog,
        upsertBackupMediaItem,
        removeBackupMediaItem,
        upsertBackupVideoSource,
        upsertBackupVideoSourcesBatch,
        removeBackupVideoSource,
        setBackupMonetization
      }}
    >
      {children}
    </ContentContext.Provider>
  );
};

export function useOptionalContent(): ContentContextValue | null {
  return useContext(ContentContext);
}

export function useContent(): ContentContextValue {
  const ctx = useContext(ContentContext);
  if (!ctx) {
    throw new Error('useContent must be used inside ContentProvider');
  }
  return ctx;
}
