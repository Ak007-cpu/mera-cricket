import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ADMIN_EMAIL, auth, db, storage } from '../firebase';
import {
  AdSlotFormat,
  AdSlotSource,
  BlogPost,
  HoldReason,
  ManagedPlayerProfile,
  ManagedTeamProfile,
  MatchPollChoice,
  MatchPollData,
  MediaLibraryItem,
  MediaLibraryMediaType,
  MediaLibrarySource,
  MonetizationConfig,
  NEWS_CATEGORIES,
  NewsCategory,
  NewsItem,
  TvPlaylistItem,
  TvPlaylistMediaType,
  VideoSourceConfig,
  VideoSourceType
} from '../types/cricket';
import { compressImageFile, dataUrlToBlob } from '../utils/mediaStorage';
import { uploadAdminMedia, uploadAudioFile, uploadTvMediaFile } from './api';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isFirebaseAdminSignedIn(): boolean {
  const user = auth.currentUser;
  return Boolean(user && user.email === ADMIN_EMAIL && user.emailVerified);
}

export function sanitizeFirestoreId(raw: string, fallbackPrefix = 'item'): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return cleaned || `${fallbackPrefix}_${Date.now()}`;
}

function clampString(val: unknown, maxLen: number): string {
  return typeof val === 'string' ? val.trim().slice(0, maxLen) : '';
}

function toMillis(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as any).toMillis === 'function') {
    return (val as any).toMillis();
  }
  if (val && typeof val === 'object' && 'seconds' in val && typeof (val as any).seconds === 'number') {
    return (val as any).seconds * 1000;
  }
  return Date.now();
}

/**
 * Compresses & uploads an image file to Firebase Storage (`public/<folder>/...`),
 * setting explicit `image/*` contentType and long Cache-Control headers.
 * Falls back to the Express media endpoint when Admin isn't signed into Firebase yet.
 */
export async function uploadImageAsset(
  file: File,
  folder: 'players' | 'teams' | 'news' | 'blogs' | 'sponsors' | 'ads' | 'tv_ads',
  assetKey: string,
  adminPin?: string,
  maxDim = 640
): Promise<{ url: string; dataUrl: string; storedInFirebase: boolean; storageError?: string }> {
  const maxBytes = folder === 'players' || folder === 'teams' ? 140_000 : 320_000;
  const dataUrl = await compressImageFile(file, maxDim, maxBytes);
  const safeKey = sanitizeFirestoreId(assetKey, folder);
  let storageError: string | undefined;

  if (isFirebaseAdminSignedIn()) {
    try {
      const blob = dataUrlToBlob(dataUrl);
      const mime = blob.type || 'image/jpeg';
      const ext = mime.includes('png')
        ? 'png'
        : mime.includes('webp')
        ? 'webp'
        : mime.includes('svg')
        ? 'svg'
        : 'jpg';
      const storagePath = `public/${folder}/${safeKey}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob, {
        contentType: mime,
        cacheControl: 'public, max-age=31536000'
      });
      const downloadUrl = await getDownloadURL(storageRef);
      return { url: downloadUrl, dataUrl, storedInFirebase: true };
    } catch (err: any) {
      storageError = err?.code || err?.message || 'Firebase Storage upload failed';
      console.warn('Firebase Storage upload error, checking fallback:', storageError, err);
    }
  } else {
    storageError = 'Firebase Admin Google login active nahi hai';
  }

  if (adminPin) {
    try {
      const serverRes = await uploadAdminMedia(dataUrl, `${folder}_${safeKey}`, adminPin);
      if (serverRes.imageUrl) {
        return { url: serverRes.imageUrl, dataUrl, storedInFirebase: false, storageError };
      }
    } catch (err) {
      console.warn('Server media upload fallback:', err);
    }
  }

  return { url: dataUrl, dataUrl, storedInFirebase: false, storageError };
}

/**
 * Uploads a lightweight cricket sound effect or crowd loop (< 3MB) to Firebase Storage
 * when signed in as Admin, with automatic fallback to the Express server audio endpoint.
 */
export async function uploadAudioAsset(
  file: File,
  slot: 'four' | 'six' | 'wicket' | 'crowd',
  adminPin?: string
): Promise<{ url: string; storedInFirebase: boolean }> {
  if (file.size > 3 * 1024 * 1024) {
    throw new Error('Audio file 3MB se chhoti honi chahiye taake app tez chale.');
  }

  if (isFirebaseAdminSignedIn()) {
    try {
      const extMatch = file.name.toLowerCase().match(/\.(mp3|wav|ogg|webm|m4a|aac)$/);
      const ext = extMatch ? extMatch[1] : 'mp3';
      const storagePath = `public/audio/${slot}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file, {
        contentType: file.type || 'audio/mpeg',
        cacheControl: 'public, max-age=31536000'
      });
      const downloadUrl = await getDownloadURL(storageRef);
      return { url: downloadUrl, storedInFirebase: true };
    } catch (err) {
      console.warn('Firebase Storage audio upload fallback to Express server:', err);
    }
  }

  if (!adminPin) {
    throw new Error('Admin PIN required to upload audio file.');
  }
  const serverRes = await uploadAudioFile(file, adminPin);
  return { url: serverRes.url, storedInFirebase: false };
}

/**
 * Uploads a pre-recorded or live-recorded video clip (< 60MB) for Broadcast TV & Standby.
 * Tries Firebase Storage (`public/tv_ads/...`) when signed in as Admin, with automatic
 * fallback to the Express server `/api/admin/tv-media/upload` endpoint.
 */
export async function uploadTvVideoAsset(
  file: Blob,
  fileName: string,
  adminPin?: string,
  folder: 'tv_ads' | 'media_library' = 'tv_ads'
): Promise<{ url: string; storedInFirebase: boolean }> {
  if (file.size > 60 * 1024 * 1024) {
    throw new Error('Video file 60MB se chhoti honi chahiye.');
  }

  const rawType = (file.type || 'video/webm').split(';')[0].trim().toLowerCase();
  const extFromMime: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogg',
    'video/quicktime': 'mov',
    'video/x-m4v': 'm4v',
    'video/x-matroska': 'mkv',
    'video/3gpp': '3gp'
  };
  const extMatch = fileName.toLowerCase().match(/\.(mp4|webm|ogg|mov|m4v|mkv|3gp)$/);
  const ext = extFromMime[rawType] || (extMatch ? extMatch[1] : 'webm');

  if (isFirebaseAdminSignedIn()) {
    try {
      const storagePath = `public/${folder}/vid_${Date.now()}.${ext}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file, {
        contentType: rawType.startsWith('video/') ? rawType : `video/${ext === 'mov' ? 'quicktime' : ext}`,
        cacheControl: 'public, max-age=31536000'
      });
      const downloadUrl = await getDownloadURL(storageRef);
      return { url: downloadUrl, storedInFirebase: true };
    } catch (err) {
      console.warn('Firebase Storage TV video upload fallback to Express server:', err);
    }
  }

  if (!adminPin) {
    throw new Error('Admin PIN required to upload video file.');
  }
  const serverRes = await uploadTvMediaFile(file, adminPin, fileName);
  return { url: serverRes.url, storedInFirebase: false };
}

// ---------------------------------------------------------------------------
// REAL-TIME SUBSCRIPTIONS (Public Reads, Auth-Aware Blog Filtering)
// ---------------------------------------------------------------------------

export function subscribeManagedPlayers(
  onData: (players: ManagedPlayerProfile[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const path = 'players';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: ManagedPlayerProfile[] = snapshot.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: data.id || d.id,
          name: String(data.name || ''),
          originalName: data.originalName ? String(data.originalName) : undefined,
          role: data.role || 'Batter',
          teamCode: data.teamCode ? String(data.teamCode) : undefined,
          imageUrl: data.imageUrl ? String(data.imageUrl) : '',
          updatedAt: toMillis(data.updatedAt),
          updatedBy: data.updatedBy
        };
      });
      onData(list);
    },
    (error) => {
      onError?.(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {}
    }
  );
}

export function subscribeManagedTeams(
  onData: (teams: ManagedTeamProfile[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const path = 'teams';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: ManagedTeamProfile[] = snapshot.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: data.id || d.id,
          code: String(data.code || d.id).toUpperCase(),
          name: String(data.name || ''),
          logoUrl: data.logoUrl ? String(data.logoUrl) : '',
          updatedAt: toMillis(data.updatedAt),
          updatedBy: data.updatedBy
        };
      });
      onData(list);
    },
    (error) => {
      onError?.(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {}
    }
  );
}

export function subscribeNewsItems(
  onData: (items: NewsItem[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const path = 'news';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: NewsItem[] = snapshot.docs.map((d) => {
        const data = d.data() as any;
        const resolvedFeatured = data.featuredImageUrl
          ? String(data.featuredImageUrl)
          : data.imageUrl
          ? String(data.imageUrl)
          : '';
        const resolvedBody = data.body ? String(data.body) : String(data.description || '');
        return {
          id: data.id || d.id,
          title: String(data.title || ''),
          description: String(data.description || ''),
          body: resolvedBody,
          imageUrl: data.imageUrl ? String(data.imageUrl) : resolvedFeatured,
          featuredImageUrl: resolvedFeatured,
          date: String(data.date || ''),
          category: NEWS_CATEGORIES.includes(data.category as NewsCategory)
            ? (data.category as NewsCategory)
            : 'General',
          pinned: Boolean(data.pinned),
          isBreaking: Boolean(data.isBreaking),
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
          authorUid: data.authorUid
        };
      });
      items.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.isBreaking !== b.isBreaking) return a.isBreaking ? -1 : 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
      onData(items);
    },
    (error) => {
      onError?.(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {}
    }
  );
}

export function subscribeBlogPosts(
  isAdminView: boolean,
  onData: (posts: BlogPost[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const path = 'blogs';
  const refOrQuery = isAdminView
    ? collection(db, path)
    : query(collection(db, path), where('status', '==', 'published'));

  return onSnapshot(
    refOrQuery,
    (snapshot) => {
      const posts: BlogPost[] = snapshot.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: data.id || d.id,
          slug: String(data.slug || d.id),
          title: String(data.title || ''),
          excerpt: data.excerpt ? String(data.excerpt) : '',
          coverImageUrl: data.coverImageUrl ? String(data.coverImageUrl) : '',
          content: String(data.content || ''),
          status: data.status === 'published' ? 'published' : 'draft',
          publishedAt: data.publishedAt ? String(data.publishedAt) : '',
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
          authorUid: data.authorUid
        };
      });
      posts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      onData(posts);
    },
    (error) => {
      onError?.(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {}
    }
  );
}

export function subscribeSiteMonetization(
  onData: (config: Partial<MonetizationConfig> | null) => void,
  onError?: (err: unknown) => void
): () => void {
  const path = 'site_config/monetization';
  return onSnapshot(
    doc(db, 'site_config', 'monetization'),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data() as any;
      const parseFormat = (v: unknown, fb: AdSlotFormat = 'auto'): AdSlotFormat =>
        v === 'auto' || v === 'horizontal' || v === 'rectangle' || v === 'vertical' ? v : fb;
      const parseSource = (v: unknown): AdSlotSource =>
        v === 'auto' || v === 'adsense' || v === 'custom' ? v : 'auto';

      onData({
        adsEnabled: Boolean(d.adsEnabled),
        adsensePublisherId: clampString(d.adsensePublisherId, 120),
        adsenseAutoAds: d.adsenseAutoAds !== undefined ? Boolean(d.adsenseAutoAds) : true,
        adsenseTestMode: Boolean(d.adsenseTestMode),
        adsenseHidePlaceholders: Boolean(d.adsenseHidePlaceholders),
        adsTxtCustomLines: clampString(d.adsTxtCustomLines, 2000),
        slots: {
          topBanner: {
            enabled: d.topSlotEnabled !== undefined ? Boolean(d.topSlotEnabled) : true,
            slotId: clampString(d.topSlotId, 120),
            adFormat: parseFormat(d.topSlotFormat, 'auto'),
            adSource: parseSource(d.topSlotSource),
            imageUrl: clampString(d.topSlotImageUrl, 2000),
            linkUrl: clampString(d.topSlotLinkUrl, 2000),
            title: clampString(d.topSlotTitle, 120)
          },
          inContent: {
            enabled: d.inContentSlotEnabled !== undefined ? Boolean(d.inContentSlotEnabled) : true,
            slotId: clampString(d.inContentSlotId, 120),
            adFormat: parseFormat(d.inContentSlotFormat, 'auto'),
            adSource: parseSource(d.inContentSlotSource),
            imageUrl: clampString(d.inContentSlotImageUrl, 2000),
            linkUrl: clampString(d.inContentSlotLinkUrl, 2000),
            title: clampString(d.inContentSlotTitle, 120)
          },
          footerBanner: {
            enabled: d.footerSlotEnabled !== undefined ? Boolean(d.footerSlotEnabled) : true,
            slotId: clampString(d.footerSlotId, 120),
            adFormat: parseFormat(d.footerSlotFormat, 'auto'),
            adSource: parseSource(d.footerSlotSource),
            imageUrl: clampString(d.footerSlotImageUrl, 2000),
            linkUrl: clampString(d.footerSlotLinkUrl, 2000),
            title: clampString(d.footerSlotTitle, 120)
          },
          mobileBanner: {
            enabled: d.mobileSlotEnabled !== undefined ? Boolean(d.mobileSlotEnabled) : true,
            slotId: clampString(d.mobileSlotId, 120),
            adFormat: parseFormat(d.mobileSlotFormat, 'horizontal'),
            adSource: parseSource(d.mobileSlotSource),
            imageUrl: clampString(d.mobileSlotImageUrl, 2000),
            linkUrl: clampString(d.mobileSlotLinkUrl, 2000),
            title: clampString(d.mobileSlotTitle, 120)
          }
        },
        sponsor: {
          enabled: Boolean(d.sponsorEnabled),
          name: clampString(d.sponsorName, 160),
          tagline: clampString(d.sponsorTagline, 240),
          logoUrl: clampString(d.sponsorLogoUrl, 2000),
          imageUrl: clampString(d.sponsorImageUrl, 2000),
          linkUrl: clampString(d.sponsorLinkUrl, 2000)
        },
        siteName: clampString(d.siteName, 120) || 'Live Cricket HD',
        contactEmail: clampString(d.contactEmail, 160),
        broadcastSettings: {
          animationsEnabled: d.animationsEnabled !== undefined ? Boolean(d.animationsEnabled) : true,
          newsMarqueeEnabled:
            d.broadcastNewsMarqueeEnabled !== undefined ? Boolean(d.broadcastNewsMarqueeEnabled) : true,
          breakScreen: { active: false, type: 'drinks', subtitle: '' },
          winProbabilityEnabled:
            d.winProbabilityEnabled !== undefined ? Boolean(d.winProbabilityEnabled) : true,
          winProbabilityOverride: {
            enabled: Boolean(d.winProbOverrideEnabled),
            battingTeamPct:
              typeof d.winProbBattingPct === 'number' &&
              Number.isFinite(d.winProbBattingPct) &&
              d.winProbBattingPct >= 0 &&
              d.winProbBattingPct <= 100
                ? Math.round(d.winProbBattingPct)
                : 50
          },
          obsPanels: {
            targetPanel: d.obsTargetPanel !== undefined ? Boolean(d.obsTargetPanel) : true,
            winProbabilityBar: d.obsWinProbBar !== undefined ? Boolean(d.obsWinProbBar) : true,
            runRateGraph: d.obsRunRateGraph !== undefined ? Boolean(d.obsRunRateGraph) : true
          },
          appDownload: {
            enabled: d.appDownloadEnabled !== undefined ? Boolean(d.appDownloadEnabled) : true,
            apkUrl: clampString(d.apkUrl, 2000),
            version: clampString(d.appVersion, 40) || '1.0.0'
          },
          sixProCricket: {
            enabled: d.gameDownloadEnabled !== undefined ? Boolean(d.gameDownloadEnabled) : true,
            apkUrl: clampString(d.gameApkUrl, 2000),
            sizeLabel: clampString(d.gameSizeLabel, 40) || '12 MB'
          },
          nextMatch: {
            matchName: clampString(d.nextMatchName, 100),
            matchTime: clampString(d.nextMatchTime, 80)
          },
          announcement: {
            enabled: Boolean(d.announcementEnabled),
            text: clampString(d.announcementText, 240),
            linkUrl: clampString(d.announcementLinkUrl, 2000)
          },
          mobileApp: {
            adsEnabled: d.mobileAdsEnabled !== undefined ? Boolean(d.mobileAdsEnabled) : true,
            sponsorEnabled: d.mobileSponsorEnabled !== undefined ? Boolean(d.mobileSponsorEnabled) : true,
            newsTickerEnabled:
              d.mobileNewsTickerEnabled !== undefined ? Boolean(d.mobileNewsTickerEnabled) : true,
            pollEnabled: d.mobilePollEnabled !== undefined ? Boolean(d.mobilePollEnabled) : true,
            scorecardEnabled:
              d.mobileScorecardEnabled !== undefined ? Boolean(d.mobileScorecardEnabled) : true,
            newsPageEnabled:
              d.mobileNewsPageEnabled !== undefined ? Boolean(d.mobileNewsPageEnabled) : true,
            blogPageEnabled:
              d.mobileBlogPageEnabled !== undefined ? Boolean(d.mobileBlogPageEnabled) : true,
            brandBadge: clampString(d.mobileBrandBadge, 60)
          },
          holdScreen: {
            active: Boolean(d.holdActive),
            reason: (
              ['Break', 'Rain', 'Drinks', 'Innings Break', 'Match Starting Soon', 'Technical Issue'].includes(
                d.holdReason
              )
                ? d.holdReason
                : 'Break'
            ) as HoldReason,
            obsEnabled: Boolean(d.holdObsEnabled),
            videoEnabled: Boolean(d.holdVideoEnabled),
            videoUrls: Array.isArray(d.holdVideoUrls)
              ? d.holdVideoUrls
                  .filter((u: unknown): u is string => typeof u === 'string' && u.trim().length > 0)
                  .map((u: string) => u.trim().slice(0, 2000))
                  .slice(0, 20)
              : [],
            videoLoop: d.holdVideoLoop !== undefined ? Boolean(d.holdVideoLoop) : true,
            sponsorEnabled: Boolean(d.holdSponsorEnabled),
            sponsorMode: d.holdSponsorMode === 'replace_video' ? 'replace_video' : 'with_content',
            sponsorImageUrl: clampString(d.holdSponsorImageUrl, 2000),
            sponsorLinkUrl: clampString(d.holdSponsorLinkUrl, 2000)
          },
          matchTimer: {
            active: Boolean(d.matchTimerActive),
            startedAt:
              typeof d.matchTimerStartedAt === 'number' && d.matchTimerStartedAt >= 0
                ? Math.floor(d.matchTimerStartedAt)
                : 0,
            accumulatedMs:
              typeof d.matchTimerAccumulatedMs === 'number' && d.matchTimerAccumulatedMs >= 0
                ? Math.floor(d.matchTimerAccumulatedMs)
                : 0
          },
          tvScreen: {
            enabled: Boolean(d.tvEnabled),
            obsEnabled: Boolean(d.tvObsEnabled),
            fullScreenTakeover: Boolean(d.tvFullScreenTakeover),
            loop: d.tvLoop !== undefined ? Boolean(d.tvLoop) : true,
            batBallBetweenAds: Boolean(d.tvBatBallBetweenAds),
            batBallGapSec:
              typeof d.tvBatBallGapSec === 'number' && d.tvBatBallGapSec >= 2 && d.tvBatBallGapSec <= 60
                ? Math.round(d.tvBatBallGapSec)
                : 6,
            playNowItemId: clampString(d.tvPlayNowItemId, 128),
            playNowNonce:
              typeof d.tvPlayNowNonce === 'number' && d.tvPlayNowNonce >= 0
                ? Math.floor(d.tvPlayNowNonce)
                : 0,
            playbackStopped: Boolean(d.tvPlaybackStopped),
            sponsorName: clampString(d.tvSponsorName, 120),
            sponsorLink: clampString(d.tvSponsorLink, 2000),
            playlist: Array.isArray(d.tvPlaylist)
              ? d.tvPlaylist
                  .filter((item: any) => item && typeof item === 'object' && typeof item.url === 'string' && item.url.trim().length > 0)
                  .slice(0, 20)
                  .map((item: any, idx: number): TvPlaylistItem => ({
                    id: sanitizeFirestoreId(String(item.id || `tv_${idx}`), 'tv'),
                    mediaType: (['image', 'video', 'youtube', 'news_feed', 'embed'].includes(item.mediaType)
                      ? item.mediaType
                      : 'image') as TvPlaylistMediaType,
                    url: clampString(item.url, 2000),
                    title: clampString(item.title || '', 120),
                    durationSec:
                      typeof item.durationSec === 'number' && Number.isFinite(item.durationSec)
                        ? Math.max(3, Math.min(600, Math.round(item.durationSec)))
                        : 10
                  }))
              : []
          },
          soundSettings: {
            enabled: d.soundEnabled !== undefined ? Boolean(d.soundEnabled) : true,
            obsEnabled: d.soundObsEnabled !== undefined ? Boolean(d.soundObsEnabled) : true,
            effectsVolume:
              typeof d.soundEffectsVolume === 'number' &&
              Number.isFinite(d.soundEffectsVolume) &&
              d.soundEffectsVolume >= 0 &&
              d.soundEffectsVolume <= 100
                ? Math.round(d.soundEffectsVolume)
                : 80,
            crowdVolume:
              typeof d.soundCrowdVolume === 'number' &&
              Number.isFinite(d.soundCrowdVolume) &&
              d.soundCrowdVolume >= 0 &&
              d.soundCrowdVolume <= 100
                ? Math.round(d.soundCrowdVolume)
                : 28,
            voiceRate:
              typeof d.soundVoiceRate === 'number' &&
              Number.isFinite(d.soundVoiceRate) &&
              d.soundVoiceRate >= 0.5 &&
              d.soundVoiceRate <= 2.0
                ? Math.round(d.soundVoiceRate * 100) / 100
                : 1.05,
            voiceVolume:
              typeof d.soundVoiceVolume === 'number' &&
              Number.isFinite(d.soundVoiceVolume) &&
              d.soundVoiceVolume >= 0 &&
              d.soundVoiceVolume <= 100
                ? Math.round(d.soundVoiceVolume)
                : 90,
            customSounds: {
              fourUrl: clampString(d.soundFourUrl, 2000),
              sixUrl: clampString(d.soundSixUrl, 2000),
              wicketUrl: clampString(d.soundWicketUrl, 2000),
              crowdUrl: clampString(d.soundCrowdUrl, 2000)
            }
          }
        },
        updatedAt: toMillis(d.updatedAt)
      });
    },
    (error) => {
      onError?.(error);
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {}
    }
  );
}

// ---------------------------------------------------------------------------
// ADMIN CRUD MUTATIONS (Strict Blueprint Validation + Error Reporting)
// ---------------------------------------------------------------------------

function requireFirebaseAdminUid(): string {
  const user = auth.currentUser;
  if (!user || user.email !== ADMIN_EMAIL || !user.emailVerified) {
    throw new Error('Firebase Admin Google Login required to save globally to Firestore.');
  }
  return user.uid;
}

export async function saveManagedPlayerToFirestore(player: ManagedPlayerProfile): Promise<void> {
  const uid = requireFirebaseAdminUid();
  const id = sanitizeFirestoreId(player.id || player.originalName || player.name, 'player');
  const path = `players/${id}`;
  // Avoid storing oversized raw base64 directly inside Firestore (limit 2000 chars per blueprint)
  const safeImageUrl =
    player.imageUrl && player.imageUrl.length <= 2000 && !player.imageUrl.startsWith('data:')
      ? clampString(player.imageUrl, 2000)
      : '';

  const payload = {
    id,
    name: clampString(player.name, 120) || 'Player',
    originalName: clampString(player.originalName || player.name, 120),
    role: (['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper'].includes(player.role)
      ? player.role
      : 'Batter') as ManagedPlayerProfile['role'],
    teamCode: clampString(player.teamCode || '', 24).toUpperCase(),
    imageUrl: safeImageUrl,
    updatedAt: serverTimestamp(),
    updatedBy: uid
  };

  try {
    await setDoc(doc(db, 'players', id), payload, { merge: false });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteManagedPlayerFromFirestore(playerId: string): Promise<void> {
  requireFirebaseAdminUid();
  const id = sanitizeFirestoreId(playerId, 'player');
  const path = `players/${id}`;
  try {
    await deleteDoc(doc(db, 'players', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveManagedTeamToFirestore(team: ManagedTeamProfile): Promise<void> {
  const uid = requireFirebaseAdminUid();
  const id = sanitizeFirestoreId(team.id || team.code, 'team');
  const path = `teams/${id}`;
  const safeLogoUrl =
    team.logoUrl && team.logoUrl.length <= 2000 && !team.logoUrl.startsWith('data:')
      ? clampString(team.logoUrl, 2000)
      : '';

  const payload = {
    id,
    code: clampString(team.code, 24).toUpperCase() || id.toUpperCase(),
    name: clampString(team.name, 120) || team.code.toUpperCase(),
    logoUrl: safeLogoUrl,
    updatedAt: serverTimestamp(),
    updatedBy: uid
  };

  try {
    await setDoc(doc(db, 'teams', id), payload, { merge: false });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteManagedTeamFromFirestore(teamId: string): Promise<void> {
  requireFirebaseAdminUid();
  const id = sanitizeFirestoreId(teamId, 'team');
  const path = `teams/${id}`;
  try {
    await deleteDoc(doc(db, 'teams', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveNewsItemToFirestore(item: NewsItem, isNew: boolean): Promise<string> {
  const uid = requireFirebaseAdminUid();
  const id = sanitizeFirestoreId(item.id || `news_${Date.now()}`, 'news');
  const path = `news/${id}`;
  const rawImage = item.featuredImageUrl ?? item.imageUrl ?? '';
  const safeFeaturedImageUrl =
    rawImage && rawImage.length <= 2000 && !rawImage.startsWith('data:')
      ? clampString(rawImage, 2000)
      : '';
  const fullBody = clampString(item.body || item.description || '', 50000);
  const rawSummary = clampString(item.description || '', 1200);
  const safeDescription =
    rawSummary ||
    (fullBody.length > 320 ? `${fullBody.slice(0, 317).trim()}...` : fullBody);

  const basePayload = {
    title: clampString(item.title, 200),
    description: safeDescription,
    body: fullBody,
    imageUrl: safeFeaturedImageUrl,
    featuredImageUrl: safeFeaturedImageUrl,
    date: clampString(item.date || new Date().toISOString().slice(0, 10), 40),
    category: NEWS_CATEGORIES.includes(item.category) ? item.category : 'General',
    pinned: Boolean(item.pinned),
    isBreaking: Boolean(item.isBreaking),
    updatedAt: serverTimestamp(),
    authorUid: uid
  };

  try {
    const docRef = doc(db, 'news', id);
    if (isNew) {
      await setDoc(docRef, { id, ...basePayload, createdAt: serverTimestamp() }, { merge: false });
    } else {
      try {
        await updateDoc(docRef, basePayload);
      } catch (updateErr: any) {
        if (updateErr?.code === 'not-found') {
          await setDoc(docRef, { id, ...basePayload, createdAt: serverTimestamp() }, { merge: false });
        } else {
          throw updateErr;
        }
      }
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteNewsItemFromFirestore(newsId: string): Promise<void> {
  requireFirebaseAdminUid();
  const id = sanitizeFirestoreId(newsId, 'news');
  const path = `news/${id}`;
  try {
    await deleteDoc(doc(db, 'news', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveBlogPostToFirestore(post: BlogPost, isNew: boolean): Promise<string> {
  const uid = requireFirebaseAdminUid();
  const id = sanitizeFirestoreId(post.id || `post_${Date.now()}`, 'post');
  const slug = sanitizeFirestoreId(post.slug || post.title || id, id);
  const path = `blogs/${id}`;
  const safeCover =
    post.coverImageUrl && post.coverImageUrl.length <= 2000 && !post.coverImageUrl.startsWith('data:')
      ? clampString(post.coverImageUrl, 2000)
      : '';

  const basePayload = {
    slug,
    title: clampString(post.title, 220),
    excerpt: clampString(post.excerpt || '', 500),
    coverImageUrl: safeCover,
    content: clampString(post.content, 50000),
    status: post.status === 'published' ? 'published' : 'draft',
    publishedAt: clampString(post.publishedAt || new Date().toISOString().slice(0, 10), 40),
    updatedAt: serverTimestamp(),
    authorUid: uid
  };

  try {
    const docRef = doc(db, 'blogs', id);
    if (isNew) {
      await setDoc(docRef, { id, ...basePayload, createdAt: serverTimestamp() }, { merge: false });
    } else {
      try {
        await updateDoc(docRef, basePayload);
      } catch (updateErr: any) {
        if (updateErr?.code === 'not-found') {
          await setDoc(docRef, { id, ...basePayload, createdAt: serverTimestamp() }, { merge: false });
        } else {
          throw updateErr;
        }
      }
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteBlogPostFromFirestore(blogId: string): Promise<void> {
  requireFirebaseAdminUid();
  const id = sanitizeFirestoreId(blogId, 'post');
  const path = `blogs/${id}`;
  try {
    await deleteDoc(doc(db, 'blogs', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSiteConfigToFirestore(cfg: MonetizationConfig): Promise<void> {
  const uid = requireFirebaseAdminUid();
  const path = 'site_config/monetization';

  const safeSponsorLogo =
    cfg.sponsor?.logoUrl && cfg.sponsor.logoUrl.length <= 2000 && !cfg.sponsor.logoUrl.startsWith('data:')
      ? clampString(cfg.sponsor.logoUrl, 2000)
      : '';
  const safeSponsorBanner =
    cfg.sponsor?.imageUrl && cfg.sponsor.imageUrl.length <= 2000 && !cfg.sponsor.imageUrl.startsWith('data:')
      ? clampString(cfg.sponsor.imageUrl, 2000)
      : '';

  const safeHoldSponsorImg =
    cfg.broadcastSettings?.holdScreen?.sponsorImageUrl &&
    cfg.broadcastSettings.holdScreen.sponsorImageUrl.length <= 2000 &&
    !cfg.broadcastSettings.holdScreen.sponsorImageUrl.startsWith('data:')
      ? clampString(cfg.broadcastSettings.holdScreen.sponsorImageUrl, 2000)
      : '';

  const safeHoldVideoUrls = Array.isArray(cfg.broadcastSettings?.holdScreen?.videoUrls)
    ? cfg.broadcastSettings!.holdScreen!.videoUrls
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .map((u) => clampString(u, 2000))
        .slice(0, 20)
    : [];

  const validHoldReasons: HoldReason[] = [
    'Break',
    'Rain',
    'Drinks',
    'Innings Break',
    'Match Starting Soon',
    'Technical Issue'
  ];
  const rawHoldReason = cfg.broadcastSettings?.holdScreen?.reason;
  const safeHoldReason: HoldReason =
    rawHoldReason && validHoldReasons.includes(rawHoldReason) ? rawHoldReason : 'Break';

  const safeFiniteInt = (val: unknown, fallback: number, min: number, max?: number): number => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    const rounded = Math.round(n);
    const lower = Math.max(min, rounded);
    return max !== undefined ? Math.min(max, lower) : lower;
  };

  const safeFiniteRate = (val: unknown, fallback: number, min: number, max: number): number => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    const clamped = Math.max(min, Math.min(max, n));
    return Math.round(clamped * 100) / 100;
  };

  const safeNonDataUrl = (val: unknown): string =>
    typeof val === 'string' && val.length <= 2000 && !val.startsWith('data:')
      ? clampString(val, 2000)
      : '';

  const safeAdFormat = (val: unknown, fb: AdSlotFormat = 'auto'): AdSlotFormat =>
    val === 'auto' || val === 'horizontal' || val === 'rectangle' || val === 'vertical' ? val : fb;
  const safeAdSource = (val: unknown): AdSlotSource =>
    val === 'auto' || val === 'adsense' || val === 'custom' ? val : 'auto';

  const payload = {
    adsEnabled: Boolean(cfg.adsEnabled),
    adsensePublisherId: clampString(cfg.adsensePublisherId, 120),
    adsenseAutoAds: cfg.adsenseAutoAds !== false,
    adsenseTestMode: Boolean(cfg.adsenseTestMode),
    adsenseHidePlaceholders: Boolean(cfg.adsenseHidePlaceholders),
    adsTxtCustomLines: clampString(cfg.adsTxtCustomLines || '', 2000),
    topSlotId: clampString(cfg.slots?.topBanner?.slotId || '', 120),
    topSlotFormat: safeAdFormat(cfg.slots?.topBanner?.adFormat, 'auto'),
    topSlotSource: safeAdSource(cfg.slots?.topBanner?.adSource),
    topSlotImageUrl: safeNonDataUrl(cfg.slots?.topBanner?.imageUrl),
    topSlotLinkUrl: clampString(cfg.slots?.topBanner?.linkUrl || '', 2000),
    topSlotTitle: clampString(cfg.slots?.topBanner?.title || '', 120),
    inContentSlotId: clampString(cfg.slots?.inContent?.slotId || '', 120),
    inContentSlotFormat: safeAdFormat(cfg.slots?.inContent?.adFormat, 'auto'),
    inContentSlotSource: safeAdSource(cfg.slots?.inContent?.adSource),
    inContentSlotImageUrl: safeNonDataUrl(cfg.slots?.inContent?.imageUrl),
    inContentSlotLinkUrl: clampString(cfg.slots?.inContent?.linkUrl || '', 2000),
    inContentSlotTitle: clampString(cfg.slots?.inContent?.title || '', 120),
    footerSlotId: clampString(cfg.slots?.footerBanner?.slotId || '', 120),
    footerSlotFormat: safeAdFormat(cfg.slots?.footerBanner?.adFormat, 'auto'),
    footerSlotSource: safeAdSource(cfg.slots?.footerBanner?.adSource),
    footerSlotImageUrl: safeNonDataUrl(cfg.slots?.footerBanner?.imageUrl),
    footerSlotLinkUrl: clampString(cfg.slots?.footerBanner?.linkUrl || '', 2000),
    footerSlotTitle: clampString(cfg.slots?.footerBanner?.title || '', 120),
    mobileSlotId: clampString(cfg.slots?.mobileBanner?.slotId || '', 120),
    mobileSlotFormat: safeAdFormat(cfg.slots?.mobileBanner?.adFormat, 'horizontal'),
    mobileSlotSource: safeAdSource(cfg.slots?.mobileBanner?.adSource),
    mobileSlotImageUrl: safeNonDataUrl(cfg.slots?.mobileBanner?.imageUrl),
    mobileSlotLinkUrl: clampString(cfg.slots?.mobileBanner?.linkUrl || '', 2000),
    mobileSlotTitle: clampString(cfg.slots?.mobileBanner?.title || '', 120),
    topSlotEnabled: cfg.slots?.topBanner?.enabled !== false,
    inContentSlotEnabled: cfg.slots?.inContent?.enabled !== false,
    footerSlotEnabled: cfg.slots?.footerBanner?.enabled !== false,
    mobileSlotEnabled: cfg.slots?.mobileBanner?.enabled !== false,
    sponsorEnabled: Boolean(cfg.sponsor?.enabled),
    sponsorName: clampString(cfg.sponsor?.name || '', 160),
    sponsorTagline: clampString(cfg.sponsor?.tagline || '', 240),
    sponsorLogoUrl: safeSponsorLogo,
    sponsorImageUrl: safeSponsorBanner,
    sponsorLinkUrl: clampString(cfg.sponsor?.linkUrl || '', 2000),
    siteName: clampString(cfg.siteName || 'Live Cricket HD', 120),
    contactEmail: clampString(cfg.contactEmail || '', 160),
    animationsEnabled: cfg.broadcastSettings?.animationsEnabled !== false,
    broadcastNewsMarqueeEnabled: cfg.broadcastSettings?.newsMarqueeEnabled !== false,
    winProbabilityEnabled: cfg.broadcastSettings?.winProbabilityEnabled !== false,
    winProbOverrideEnabled: Boolean(cfg.broadcastSettings?.winProbabilityOverride?.enabled),
    winProbBattingPct: safeFiniteInt(cfg.broadcastSettings?.winProbabilityOverride?.battingTeamPct, 50, 0, 100),
    obsTargetPanel: cfg.broadcastSettings?.obsPanels?.targetPanel !== false,
    obsWinProbBar: cfg.broadcastSettings?.obsPanels?.winProbabilityBar !== false,
    obsRunRateGraph: cfg.broadcastSettings?.obsPanels?.runRateGraph !== false,
    announcementEnabled: Boolean(cfg.broadcastSettings?.announcement?.enabled),
    announcementText: clampString(cfg.broadcastSettings?.announcement?.text || '', 240),
    announcementLinkUrl: clampString(cfg.broadcastSettings?.announcement?.linkUrl || '', 2000),
    mobileAdsEnabled: cfg.broadcastSettings?.mobileApp?.adsEnabled !== false,
    mobileSponsorEnabled: cfg.broadcastSettings?.mobileApp?.sponsorEnabled !== false,
    mobileNewsTickerEnabled: cfg.broadcastSettings?.mobileApp?.newsTickerEnabled !== false,
    mobilePollEnabled: cfg.broadcastSettings?.mobileApp?.pollEnabled !== false,
    mobileScorecardEnabled: cfg.broadcastSettings?.mobileApp?.scorecardEnabled !== false,
    mobileNewsPageEnabled: cfg.broadcastSettings?.mobileApp?.newsPageEnabled !== false,
    mobileBlogPageEnabled: cfg.broadcastSettings?.mobileApp?.blogPageEnabled !== false,
    mobileBrandBadge: clampString(cfg.broadcastSettings?.mobileApp?.brandBadge || '', 60),
    appDownloadEnabled: cfg.broadcastSettings?.appDownload?.enabled !== false,
    apkUrl: clampString(cfg.broadcastSettings?.appDownload?.apkUrl || '', 2000),
    appVersion: clampString(cfg.broadcastSettings?.appDownload?.version || '1.0.0', 40) || '1.0.0',
    gameDownloadEnabled: cfg.broadcastSettings?.sixProCricket?.enabled !== false,
    gameApkUrl: clampString(cfg.broadcastSettings?.sixProCricket?.apkUrl || '', 2000),
    gameSizeLabel: clampString(cfg.broadcastSettings?.sixProCricket?.sizeLabel || '12 MB', 40) || '12 MB',
    holdActive: Boolean(cfg.broadcastSettings?.holdScreen?.active),
    holdReason: safeHoldReason,
    holdObsEnabled: Boolean(cfg.broadcastSettings?.holdScreen?.obsEnabled),
    holdVideoEnabled: Boolean(cfg.broadcastSettings?.holdScreen?.videoEnabled),
    holdVideoLoop: cfg.broadcastSettings?.holdScreen?.videoLoop !== false,
    holdVideoUrls: safeHoldVideoUrls,
    holdSponsorEnabled: Boolean(cfg.broadcastSettings?.holdScreen?.sponsorEnabled),
    holdSponsorMode:
      cfg.broadcastSettings?.holdScreen?.sponsorMode === 'replace_video'
        ? 'replace_video'
        : 'with_content',
    holdSponsorImageUrl: safeHoldSponsorImg,
    holdSponsorLinkUrl: clampString(cfg.broadcastSettings?.holdScreen?.sponsorLinkUrl || '', 2000),
    nextMatchName: clampString(cfg.broadcastSettings?.nextMatch?.matchName || '', 100),
    nextMatchTime: clampString(cfg.broadcastSettings?.nextMatch?.matchTime || '', 80),
    matchTimerActive: Boolean(cfg.broadcastSettings?.matchTimer?.active),
    matchTimerStartedAt: safeFiniteInt(cfg.broadcastSettings?.matchTimer?.startedAt, 0, 0),
    matchTimerAccumulatedMs: safeFiniteInt(cfg.broadcastSettings?.matchTimer?.accumulatedMs, 0, 0),
    tvEnabled: Boolean(cfg.broadcastSettings?.tvScreen?.enabled),
    tvObsEnabled: Boolean(cfg.broadcastSettings?.tvScreen?.obsEnabled),
    tvFullScreenTakeover: Boolean(cfg.broadcastSettings?.tvScreen?.fullScreenTakeover),
    tvLoop: cfg.broadcastSettings?.tvScreen?.loop !== false,
    tvBatBallBetweenAds: Boolean(cfg.broadcastSettings?.tvScreen?.batBallBetweenAds),
    tvBatBallGapSec: safeFiniteInt(cfg.broadcastSettings?.tvScreen?.batBallGapSec, 6, 2, 60),
    tvPlayNowItemId: clampString(cfg.broadcastSettings?.tvScreen?.playNowItemId || '', 128),
    tvPlayNowNonce: safeFiniteInt(cfg.broadcastSettings?.tvScreen?.playNowNonce, 0, 0),
    tvPlaybackStopped: Boolean(cfg.broadcastSettings?.tvScreen?.playbackStopped),
    tvSponsorName: clampString(cfg.broadcastSettings?.tvScreen?.sponsorName || '', 120),
    tvSponsorLink: clampString(cfg.broadcastSettings?.tvScreen?.sponsorLink || '', 2000),
    tvPlaylist: Array.isArray(cfg.broadcastSettings?.tvScreen?.playlist)
      ? cfg.broadcastSettings!.tvScreen!.playlist
          .filter((item) => item && typeof item.url === 'string' && item.url.trim().length > 0 && !item.url.startsWith('data:'))
          .slice(0, 20)
          .map((item, idx) => ({
            id: sanitizeFirestoreId(item.id || `tv_${Date.now()}_${idx}`, 'tv'),
            mediaType: (['image', 'video', 'youtube', 'news_feed', 'embed'].includes(item.mediaType)
              ? item.mediaType
              : 'image') as TvPlaylistMediaType,
            url: clampString(item.url, 2000),
            title: clampString(item.title || '', 120),
            durationSec: safeFiniteInt(item.durationSec, 10, 3, 600)
          }))
      : [],
    soundEnabled: cfg.broadcastSettings?.soundSettings?.enabled !== false,
    soundObsEnabled: Boolean(cfg.broadcastSettings?.soundSettings?.obsEnabled),
    soundEffectsVolume: safeFiniteInt(cfg.broadcastSettings?.soundSettings?.effectsVolume, 80, 0, 100),
    soundCrowdVolume: safeFiniteInt(cfg.broadcastSettings?.soundSettings?.crowdVolume, 28, 0, 100),
    soundVoiceRate: safeFiniteRate(cfg.broadcastSettings?.soundSettings?.voiceRate, 1.05, 0.5, 2.0),
    soundVoiceVolume: safeFiniteInt(cfg.broadcastSettings?.soundSettings?.voiceVolume, 90, 0, 100),
    soundFourUrl: clampString(cfg.broadcastSettings?.soundSettings?.customSounds?.fourUrl || '', 2000),
    soundSixUrl: clampString(cfg.broadcastSettings?.soundSettings?.customSounds?.sixUrl || '', 2000),
    soundWicketUrl: clampString(cfg.broadcastSettings?.soundSettings?.customSounds?.wicketUrl || '', 2000),
    soundCrowdUrl: clampString(cfg.broadcastSettings?.soundSettings?.customSounds?.crowdUrl || '', 2000),
    updatedAt: serverTimestamp(),
    updatedBy: uid
  };

  try {
    await setDoc(doc(db, 'site_config', 'monetization'), payload, { merge: false });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ---------------------------------------------------------------------------
// ADMIN MEDIA LIBRARY (Firebase Storage + Firestore Persistence)
// ---------------------------------------------------------------------------

export function subscribeMediaLibrary(
  isAdminView: boolean,
  onData: (items: MediaLibraryItem[]) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!isAdminView) {
    return () => {};
  }
  const path = 'media_library';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: MediaLibraryItem[] = snapshot.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: data.id || d.id,
          title: clampString(data.title || 'Untitled Video', 120) || 'Untitled Video',
          mediaType: (data.mediaType === 'youtube' ? 'youtube' : 'video') as MediaLibraryMediaType,
          url: clampString(data.url || '', 2000),
          durationSec:
            typeof data.durationSec === 'number' && Number.isFinite(data.durationSec)
              ? Math.max(3, Math.min(600, Math.round(data.durationSec)))
              : 15,
          source: (['upload', 'url', 'recording'].includes(data.source)
            ? data.source
            : 'url') as MediaLibrarySource,
          category: clampString(data.category || 'Standby', 60) || 'Standby',
          description: clampString(data.description || '', 300),
          storedInFirebase: Boolean(data.storedInFirebase),
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
          authorUid: data.authorUid
        };
      });
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      onData(items);
    },
    (error) => {
      onError?.(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {}
    }
  );
}

export async function saveMediaLibraryItemToFirestore(
  item: MediaLibraryItem,
  isNew: boolean
): Promise<string> {
  const uid = requireFirebaseAdminUid();
  const id = sanitizeFirestoreId(item.id || `media_${Date.now()}`, 'media');
  const path = `media_library/${id}`;

  const cleanUrl =
    item.url && item.url.length <= 2000 && !item.url.startsWith('data:')
      ? clampString(item.url, 2000)
      : '';
  if (!cleanUrl) {
    throw new Error('Valid video URL is required before saving to Firestore Media Library.');
  }

  const basePayload = {
    title: clampString(item.title, 120) || 'Untitled Video',
    mediaType: (item.mediaType === 'youtube' ? 'youtube' : 'video') as MediaLibraryMediaType,
    url: cleanUrl,
    durationSec: Math.max(3, Math.min(600, Math.round(Number(item.durationSec || 15)))),
    source: (['upload', 'url', 'recording'].includes(item.source)
      ? item.source
      : 'url') as MediaLibrarySource,
    category: clampString(item.category || 'Standby', 60) || 'Standby',
    description: clampString(item.description || '', 300),
    storedInFirebase: Boolean(item.storedInFirebase),
    updatedAt: serverTimestamp(),
    authorUid: uid
  };

  try {
    const docRef = doc(db, 'media_library', id);
    if (isNew) {
      await setDoc(docRef, { id, ...basePayload, createdAt: serverTimestamp() }, { merge: false });
    } else {
      try {
        await updateDoc(docRef, basePayload);
      } catch (updateErr: any) {
        if (updateErr?.code === 'not-found') {
          await setDoc(docRef, { id, ...basePayload, createdAt: serverTimestamp() }, { merge: false });
        } else {
          throw updateErr;
        }
      }
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteMediaLibraryItemFromFirestore(mediaId: string): Promise<void> {
  requireFirebaseAdminUid();
  const id = sanitizeFirestoreId(mediaId, 'media');
  const path = `media_library/${id}`;
  try {
    await deleteDoc(doc(db, 'media_library', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// ADMIN SAVED VIDEO SOURCES (YouTube & Local Stream URL Configurations)
// ---------------------------------------------------------------------------

export function subscribeVideoSources(
  isAdminView: boolean,
  onData: (sources: VideoSourceConfig[]) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!isAdminView) {
    return () => {};
  }
  const path = 'video_sources';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const sources: VideoSourceConfig[] = snapshot.docs.map((d) => {
        const data = d.data() as any;
        const rawType = data.sourceType;
        const sourceType: VideoSourceType =
          rawType === 'youtube' || rawType === 'local_video' || rawType === 'embed'
            ? rawType
            : 'embed';
        return {
          id: data.id || d.id,
          name: clampString(data.name || 'Match Feed', 120) || 'Match Feed',
          sourceType,
          url: clampString(data.url || '', 2000),
          category: clampString(data.category || 'Main Feed', 60) || 'Main Feed',
          notes: clampString(data.notes || '', 300),
          durationSec:
            typeof data.durationSec === 'number' && Number.isFinite(data.durationSec)
              ? Math.max(3, Math.min(600, Math.round(data.durationSec)))
              : 300,
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
          authorUid: data.authorUid
        };
      });
      sources.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      onData(sources);
    },
    (error) => {
      onError?.(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {}
    }
  );
}

export async function saveVideoSourceToFirestore(
  source: VideoSourceConfig,
  isNew: boolean
): Promise<string> {
  const uid = requireFirebaseAdminUid();
  const id = sanitizeFirestoreId(source.id || `src_${Date.now()}`, 'src');
  const path = `video_sources/${id}`;

  const cleanUrl =
    source.url && source.url.length <= 2000 && !source.url.startsWith('data:')
      ? clampString(source.url, 2000)
      : '';
  if (!cleanUrl) {
    throw new Error('Valid stream or video URL is required before saving Video Source.');
  }

  const validSourceType: VideoSourceType =
    source.sourceType === 'youtube' ||
    source.sourceType === 'local_video' ||
    source.sourceType === 'embed'
      ? source.sourceType
      : 'embed';

  const basePayload = {
    name: clampString(source.name, 120) || 'Match Feed',
    sourceType: validSourceType,
    url: cleanUrl,
    category: clampString(source.category || 'Main Feed', 60) || 'Main Feed',
    notes: clampString(source.notes || '', 300),
    durationSec: Math.max(3, Math.min(600, Math.round(Number(source.durationSec || 300)))),
    updatedAt: serverTimestamp(),
    authorUid: uid
  };

  try {
    const docRef = doc(db, 'video_sources', id);
    if (isNew) {
      await setDoc(docRef, { id, ...basePayload, createdAt: serverTimestamp() }, { merge: false });
    } else {
      try {
        await updateDoc(docRef, basePayload);
      } catch (updateErr: any) {
        if (updateErr?.code === 'not-found') {
          await setDoc(
            docRef,
            { id, ...basePayload, createdAt: serverTimestamp() },
            { merge: false }
          );
        } else {
          throw updateErr;
        }
      }
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function saveVideoSourcesBatchToFirestore(
  sources: VideoSourceConfig[]
): Promise<number> {
  const uid = requireFirebaseAdminUid();
  if (!Array.isArray(sources) || sources.length === 0) return 0;

  const validEntries = sources
    .map((source, idx) => {
      const cleanUrl =
        source.url && source.url.length <= 2000 && !source.url.startsWith('data:')
          ? clampString(source.url, 2000)
          : '';
      if (!cleanUrl) return null;

      const id = sanitizeFirestoreId(source.id || `src_${Date.now()}_${idx}`, 'src');
      const validSourceType: VideoSourceType =
        source.sourceType === 'youtube' ||
        source.sourceType === 'local_video' ||
        source.sourceType === 'embed'
          ? source.sourceType
          : 'embed';

      return {
        id,
        payload: {
          id,
          name: clampString(source.name, 120) || 'Match Feed',
          sourceType: validSourceType,
          url: cleanUrl,
          category: clampString(source.category || 'Main Feed', 60) || 'Main Feed',
          notes: clampString(source.notes || '', 300),
          durationSec: Math.max(3, Math.min(600, Math.round(Number(source.durationSec || 300)))),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          authorUid: uid
        }
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (validEntries.length === 0) return 0;

  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < validEntries.length; i += CHUNK_SIZE) {
      const chunk = validEntries.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.set(doc(db, 'video_sources', item.id), item.payload, { merge: false });
      }
      await batch.commit();
    }
    return validEntries.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'video_sources');
  }
}

export async function deleteVideoSourceFromFirestore(sourceId: string): Promise<void> {
  requireFirebaseAdminUid();
  const id = sanitizeFirestoreId(sourceId, 'src');
  const path = `video_sources/${id}`;
  try {
    await deleteDoc(doc(db, 'video_sources', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// LIVE FAN POLL ("WHO WILL WIN?")
// ---------------------------------------------------------------------------

export function subscribeMatchPoll(
  matchId: string,
  onData: (poll: MatchPollData | null) => void,
  onError?: (err: unknown) => void
): () => void {
  const pollId = sanitizeFirestoreId(matchId || 'live_match', 'poll');
  const path = `match_polls/${pollId}`;
  return onSnapshot(
    doc(db, 'match_polls', pollId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const data = snap.data() as any;
      onData({
        id: data.id || pollId,
        matchId: clampString(data.matchId || matchId, 128),
        team1Code: clampString(data.team1Code || 'T1', 24),
        team1Name: clampString(data.team1Name || 'Team 1', 120),
        team2Code: clampString(data.team2Code || 'T2', 24),
        team2Name: clampString(data.team2Name || 'Team 2', 120),
        team1Votes: Math.max(0, Math.floor(Number(data.team1Votes || 0))),
        team2Votes: Math.max(0, Math.floor(Number(data.team2Votes || 0))),
        drawVotes: Math.max(0, Math.floor(Number(data.drawVotes || 0))),
        updatedAt: toMillis(data.updatedAt)
      });
    },
    (error) => {
      onError?.(error);
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {}
    }
  );
}

export async function castMatchPollVote(params: {
  matchId: string;
  team1Code: string;
  team1Name: string;
  team2Code: string;
  team2Name: string;
  choice: MatchPollChoice;
}): Promise<void> {
  const pollId = sanitizeFirestoreId(params.matchId || 'live_match', 'poll');
  const path = `match_polls/${pollId}`;
  const docRef = doc(db, 'match_polls', pollId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists()) {
        tx.set(docRef, {
          id: pollId,
          matchId: clampString(params.matchId || pollId, 128) || pollId,
          team1Code: clampString(params.team1Code || 'T1', 24).toUpperCase() || 'T1',
          team1Name: clampString(params.team1Name || 'Team 1', 120) || 'Team 1',
          team2Code: clampString(params.team2Code || 'T2', 24).toUpperCase() || 'T2',
          team2Name: clampString(params.team2Name || 'Team 2', 120) || 'Team 2',
          team1Votes: params.choice === 'team1' ? 1 : 0,
          team2Votes: params.choice === 'team2' ? 1 : 0,
          drawVotes: params.choice === 'draw' ? 1 : 0,
          updatedAt: serverTimestamp()
        });
        return;
      }

      const data = snap.data() as any;
      const curT1 = Math.max(0, Math.floor(Number(data.team1Votes || 0)));
      const curT2 = Math.max(0, Math.floor(Number(data.team2Votes || 0)));
      const curDraw = Math.max(0, Math.floor(Number(data.drawVotes || 0)));

      tx.update(docRef, {
        team1Votes: params.choice === 'team1' ? curT1 + 1 : curT1,
        team2Votes: params.choice === 'team2' ? curT2 + 1 : curT2,
        drawVotes: params.choice === 'draw' ? curDraw + 1 : curDraw,
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

