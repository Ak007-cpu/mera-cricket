import fs from 'fs/promises';
import path from 'path';
import { MonetizationConfig } from '../src/types/cricket';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const MONETIZATION_FILE = path.resolve(DATA_DIR, 'monetization.json');

const DEFAULT_CONFIG: MonetizationConfig = {
  adsEnabled: false,
  adsensePublisherId: '',
  adsenseAutoAds: true,
  adsenseTestMode: false,
  adsenseHidePlaceholders: false,
  adsTxtCustomLines: '',
  slots: {
    topBanner: {
      enabled: true,
      slotId: '',
      adFormat: 'auto',
      adSource: 'auto',
      imageUrl: '',
      linkUrl: '',
      title: ''
    },
    inContent: {
      enabled: true,
      slotId: '',
      adFormat: 'auto',
      adSource: 'auto',
      imageUrl: '',
      linkUrl: '',
      title: ''
    },
    footerBanner: {
      enabled: true,
      slotId: '',
      adFormat: 'auto',
      adSource: 'auto',
      imageUrl: '',
      linkUrl: '',
      title: ''
    },
    mobileBanner: {
      enabled: true,
      slotId: '',
      adFormat: 'horizontal',
      adSource: 'auto',
      imageUrl: '',
      linkUrl: '',
      title: ''
    }
  },
  sponsor: {
    enabled: false,
    name: 'Official Broadcast Partner',
    tagline: 'Sponsor your brand across every live delivery',
    logoUrl: '',
    imageUrl: '',
    linkUrl: ''
  },
  siteName: 'Live Cricket HD',
  contactEmail: 'contact@livecrickethd.com',
  broadcastSettings: {
    animationsEnabled: true,
    newsMarqueeEnabled: true,
    breakScreen: {
      active: false,
      type: 'drinks',
      subtitle: '',
      startedAt: undefined
    },
    winProbabilityEnabled: true,
    winProbabilityOverride: {
      enabled: false,
      battingTeamPct: 50
    },
    obsPanels: {
      targetPanel: true,
      winProbabilityBar: true,
      runRateGraph: true
    },
    appDownload: {
      enabled: true,
      apkUrl: '',
      version: '1.0.0'
    },
    sixProCricket: {
      enabled: true,
      apkUrl: '',
      sizeLabel: '12 MB'
    },
    nextMatch: {
      matchName: '',
      matchTime: ''
    },
    announcement: {
      enabled: false,
      text: '',
      linkUrl: ''
    },
    mobileApp: {
      adsEnabled: true,
      sponsorEnabled: true,
      newsTickerEnabled: true,
      pollEnabled: true,
      scorecardEnabled: true,
      newsPageEnabled: true,
      blogPageEnabled: true,
      brandBadge: ''
    },
    holdScreen: {
      active: false,
      reason: 'Break',
      obsEnabled: false,
      videoEnabled: false,
      videoUrls: [],
      videoLoop: true,
      sponsorEnabled: false,
      sponsorMode: 'with_content',
      sponsorImageUrl: '',
      sponsorLinkUrl: ''
    },
    matchTimer: {
      active: false,
      startedAt: 0,
      accumulatedMs: 0
    },
    tvScreen: {
      enabled: false,
      obsEnabled: false,
      fullScreenTakeover: false,
      loop: true,
      batBallBetweenAds: false,
      batBallGapSec: 6,
      playNowItemId: '',
      playNowNonce: 0,
      playbackStopped: false,
      sponsorName: '',
      sponsorLink: '',
      playlist: []
    },
    soundSettings: {
      enabled: true,
      obsEnabled: true,
      effectsVolume: 80,
      crowdVolume: 28,
      voiceRate: 1.05,
      voiceVolume: 90,
      customSounds: {
        fourUrl: '',
        sixUrl: '',
        wicketUrl: '',
        crowdUrl: ''
      }
    }
  },
  updatedAt: 0
};

const VALID_BREAK_TYPES = new Set(['drinks', 'rain', 'innings', 'starting_soon']);
const VALID_HOLD_REASONS = new Set([
  'Break',
  'Rain',
  'Drinks',
  'Innings Break',
  'Match Starting Soon',
  'Technical Issue'
]);

class MonetizationService {
  private config: MonetizationConfig = structuredClone(DEFAULT_CONFIG);
  private listeners = new Set<(config: MonetizationConfig) => void>();

  constructor() {
    this.loadFromDisk();
  }

  private async loadFromDisk() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const raw = await fs.readFile(MONETIZATION_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      this.config = this.mergeWithDefaults(parsed);
    } catch {
      this.config = structuredClone(DEFAULT_CONFIG);
      await this.saveToDisk();
    }
  }

  private mergeWithDefaults(input: Partial<MonetizationConfig> | null | undefined): MonetizationConfig {
    if (!input || typeof input !== 'object') {
      return structuredClone(DEFAULT_CONFIG);
    }

    const rawBreakType = input.broadcastSettings?.breakScreen?.type;
    const safeBreakType =
      rawBreakType && VALID_BREAK_TYPES.has(rawBreakType) ? rawBreakType : 'drinks';

    const sanitizeSlotFormat = (val: unknown, fallback: 'auto' | 'horizontal' | 'rectangle' | 'vertical' = 'auto') =>
      val === 'auto' || val === 'horizontal' || val === 'rectangle' || val === 'vertical' ? val : fallback;
    const sanitizeSlotSource = (val: unknown) =>
      val === 'auto' || val === 'adsense' || val === 'custom' ? val : 'auto';

    return {
      adsEnabled: typeof input.adsEnabled === 'boolean' ? input.adsEnabled : DEFAULT_CONFIG.adsEnabled,
      adsensePublisherId: typeof input.adsensePublisherId === 'string' ? input.adsensePublisherId.trim().slice(0, 120) : '',
      adsenseAutoAds: typeof input.adsenseAutoAds === 'boolean' ? input.adsenseAutoAds : true,
      adsenseTestMode: typeof input.adsenseTestMode === 'boolean' ? input.adsenseTestMode : false,
      adsenseHidePlaceholders:
        typeof input.adsenseHidePlaceholders === 'boolean' ? input.adsenseHidePlaceholders : false,
      adsTxtCustomLines:
        typeof input.adsTxtCustomLines === 'string' ? input.adsTxtCustomLines.trim().slice(0, 2000) : '',
      slots: {
        topBanner: {
          enabled: typeof input.slots?.topBanner?.enabled === 'boolean' ? input.slots.topBanner.enabled : true,
          slotId: typeof input.slots?.topBanner?.slotId === 'string' ? input.slots.topBanner.slotId.trim().slice(0, 120) : '',
          adFormat: sanitizeSlotFormat(input.slots?.topBanner?.adFormat, 'auto'),
          adSource: sanitizeSlotSource(input.slots?.topBanner?.adSource),
          imageUrl: typeof input.slots?.topBanner?.imageUrl === 'string' ? this.sanitizeUrl(input.slots.topBanner.imageUrl).slice(0, 2000) : '',
          linkUrl: typeof input.slots?.topBanner?.linkUrl === 'string' ? this.sanitizeUrl(input.slots.topBanner.linkUrl).slice(0, 2000) : '',
          title: typeof input.slots?.topBanner?.title === 'string' ? input.slots.topBanner.title.trim().slice(0, 120) : ''
        },
        inContent: {
          enabled: typeof input.slots?.inContent?.enabled === 'boolean' ? input.slots.inContent.enabled : true,
          slotId: typeof input.slots?.inContent?.slotId === 'string' ? input.slots.inContent.slotId.trim().slice(0, 120) : '',
          adFormat: sanitizeSlotFormat(input.slots?.inContent?.adFormat, 'auto'),
          adSource: sanitizeSlotSource(input.slots?.inContent?.adSource),
          imageUrl: typeof input.slots?.inContent?.imageUrl === 'string' ? this.sanitizeUrl(input.slots.inContent.imageUrl).slice(0, 2000) : '',
          linkUrl: typeof input.slots?.inContent?.linkUrl === 'string' ? this.sanitizeUrl(input.slots.inContent.linkUrl).slice(0, 2000) : '',
          title: typeof input.slots?.inContent?.title === 'string' ? input.slots.inContent.title.trim().slice(0, 120) : ''
        },
        footerBanner: {
          enabled: typeof input.slots?.footerBanner?.enabled === 'boolean' ? input.slots.footerBanner.enabled : true,
          slotId: typeof input.slots?.footerBanner?.slotId === 'string' ? input.slots.footerBanner.slotId.trim().slice(0, 120) : '',
          adFormat: sanitizeSlotFormat(input.slots?.footerBanner?.adFormat, 'auto'),
          adSource: sanitizeSlotSource(input.slots?.footerBanner?.adSource),
          imageUrl: typeof input.slots?.footerBanner?.imageUrl === 'string' ? this.sanitizeUrl(input.slots.footerBanner.imageUrl).slice(0, 2000) : '',
          linkUrl: typeof input.slots?.footerBanner?.linkUrl === 'string' ? this.sanitizeUrl(input.slots.footerBanner.linkUrl).slice(0, 2000) : '',
          title: typeof input.slots?.footerBanner?.title === 'string' ? input.slots.footerBanner.title.trim().slice(0, 120) : ''
        },
        mobileBanner: {
          enabled: typeof input.slots?.mobileBanner?.enabled === 'boolean' ? input.slots.mobileBanner.enabled : true,
          slotId: typeof input.slots?.mobileBanner?.slotId === 'string' ? input.slots.mobileBanner.slotId.trim().slice(0, 120) : '',
          adFormat: sanitizeSlotFormat(input.slots?.mobileBanner?.adFormat, 'horizontal'),
          adSource: sanitizeSlotSource(input.slots?.mobileBanner?.adSource),
          imageUrl: typeof input.slots?.mobileBanner?.imageUrl === 'string' ? this.sanitizeUrl(input.slots.mobileBanner.imageUrl).slice(0, 2000) : '',
          linkUrl: typeof input.slots?.mobileBanner?.linkUrl === 'string' ? this.sanitizeUrl(input.slots.mobileBanner.linkUrl).slice(0, 2000) : '',
          title: typeof input.slots?.mobileBanner?.title === 'string' ? input.slots.mobileBanner.title.trim().slice(0, 120) : ''
        }
      },
      sponsor: {
        enabled: typeof input.sponsor?.enabled === 'boolean' ? input.sponsor.enabled : DEFAULT_CONFIG.sponsor.enabled,
        name: typeof input.sponsor?.name === 'string' ? input.sponsor.name.trim() : DEFAULT_CONFIG.sponsor.name,
        tagline: typeof input.sponsor?.tagline === 'string' ? input.sponsor.tagline.trim() : DEFAULT_CONFIG.sponsor.tagline,
        logoUrl: typeof input.sponsor?.logoUrl === 'string' ? this.sanitizeUrl(input.sponsor.logoUrl) : '',
        imageUrl: typeof input.sponsor?.imageUrl === 'string' ? this.sanitizeUrl(input.sponsor.imageUrl) : '',
        linkUrl: typeof input.sponsor?.linkUrl === 'string' ? this.sanitizeUrl(input.sponsor.linkUrl) : ''
      },
      siteName: typeof input.siteName === 'string' && input.siteName.trim() ? input.siteName.trim() : DEFAULT_CONFIG.siteName,
      contactEmail: typeof input.contactEmail === 'string' && input.contactEmail.trim() ? input.contactEmail.trim() : DEFAULT_CONFIG.contactEmail,
      broadcastSettings: {
        animationsEnabled:
          typeof input.broadcastSettings?.animationsEnabled === 'boolean'
            ? input.broadcastSettings.animationsEnabled
            : true,
        newsMarqueeEnabled:
          typeof input.broadcastSettings?.newsMarqueeEnabled === 'boolean'
            ? input.broadcastSettings.newsMarqueeEnabled
            : true,
        breakScreen: {
          active:
            typeof input.broadcastSettings?.breakScreen?.active === 'boolean'
              ? input.broadcastSettings.breakScreen.active
              : false,
          type: safeBreakType,
          subtitle:
            typeof input.broadcastSettings?.breakScreen?.subtitle === 'string'
              ? input.broadcastSettings.breakScreen.subtitle.trim().slice(0, 140)
              : '',
          startedAt:
            typeof input.broadcastSettings?.breakScreen?.startedAt === 'number'
              ? input.broadcastSettings.breakScreen.startedAt
              : undefined
        },
        winProbabilityEnabled:
          typeof input.broadcastSettings?.winProbabilityEnabled === 'boolean'
            ? input.broadcastSettings.winProbabilityEnabled
            : true,
        winProbabilityOverride: {
          enabled:
            typeof input.broadcastSettings?.winProbabilityOverride?.enabled === 'boolean'
              ? input.broadcastSettings.winProbabilityOverride.enabled
              : false,
          battingTeamPct: Number.isFinite(Number(input.broadcastSettings?.winProbabilityOverride?.battingTeamPct))
            ? Math.max(0, Math.min(100, Math.round(Number(input.broadcastSettings?.winProbabilityOverride?.battingTeamPct))))
            : 50
        },
        obsPanels: {
          targetPanel:
            typeof input.broadcastSettings?.obsPanels?.targetPanel === 'boolean'
              ? input.broadcastSettings.obsPanels.targetPanel
              : true,
          winProbabilityBar:
            typeof input.broadcastSettings?.obsPanels?.winProbabilityBar === 'boolean'
              ? input.broadcastSettings.obsPanels.winProbabilityBar
              : true,
          runRateGraph:
            typeof input.broadcastSettings?.obsPanels?.runRateGraph === 'boolean'
              ? input.broadcastSettings.obsPanels.runRateGraph
              : true
        },
        appDownload: {
          enabled:
            typeof input.broadcastSettings?.appDownload?.enabled === 'boolean'
              ? input.broadcastSettings.appDownload.enabled
              : true,
          apkUrl:
            typeof input.broadcastSettings?.appDownload?.apkUrl === 'string'
              ? this.sanitizeUrl(input.broadcastSettings.appDownload.apkUrl).slice(0, 2000)
              : '',
          version:
            typeof input.broadcastSettings?.appDownload?.version === 'string' &&
            input.broadcastSettings.appDownload.version.trim()
              ? input.broadcastSettings.appDownload.version.trim().slice(0, 40)
              : '1.0.0'
        },
        sixProCricket: {
          enabled:
            typeof input.broadcastSettings?.sixProCricket?.enabled === 'boolean'
              ? input.broadcastSettings.sixProCricket.enabled
              : true,
          apkUrl:
            typeof input.broadcastSettings?.sixProCricket?.apkUrl === 'string'
              ? this.sanitizeUrl(input.broadcastSettings.sixProCricket.apkUrl).slice(0, 2000)
              : '',
          sizeLabel:
            typeof input.broadcastSettings?.sixProCricket?.sizeLabel === 'string' &&
            input.broadcastSettings.sixProCricket.sizeLabel.trim()
              ? input.broadcastSettings.sixProCricket.sizeLabel.trim().slice(0, 40)
              : '12 MB'
        },
        nextMatch: {
          matchName:
            typeof input.broadcastSettings?.nextMatch?.matchName === 'string'
              ? input.broadcastSettings.nextMatch.matchName.trim().slice(0, 100)
              : '',
          matchTime:
            typeof input.broadcastSettings?.nextMatch?.matchTime === 'string'
              ? input.broadcastSettings.nextMatch.matchTime.trim().slice(0, 80)
              : ''
        },
        announcement: {
          enabled:
            typeof input.broadcastSettings?.announcement?.enabled === 'boolean'
              ? input.broadcastSettings.announcement.enabled
              : false,
          text:
            typeof input.broadcastSettings?.announcement?.text === 'string'
              ? input.broadcastSettings.announcement.text.trim().slice(0, 240)
              : '',
          linkUrl:
            typeof input.broadcastSettings?.announcement?.linkUrl === 'string'
              ? this.sanitizeUrl(input.broadcastSettings.announcement.linkUrl).slice(0, 2000)
              : ''
        },
        mobileApp: {
          adsEnabled:
            typeof input.broadcastSettings?.mobileApp?.adsEnabled === 'boolean'
              ? input.broadcastSettings.mobileApp.adsEnabled
              : true,
          sponsorEnabled:
            typeof input.broadcastSettings?.mobileApp?.sponsorEnabled === 'boolean'
              ? input.broadcastSettings.mobileApp.sponsorEnabled
              : true,
          newsTickerEnabled:
            typeof input.broadcastSettings?.mobileApp?.newsTickerEnabled === 'boolean'
              ? input.broadcastSettings.mobileApp.newsTickerEnabled
              : true,
          pollEnabled:
            typeof input.broadcastSettings?.mobileApp?.pollEnabled === 'boolean'
              ? input.broadcastSettings.mobileApp.pollEnabled
              : true,
          scorecardEnabled:
            typeof input.broadcastSettings?.mobileApp?.scorecardEnabled === 'boolean'
              ? input.broadcastSettings.mobileApp.scorecardEnabled
              : true,
          newsPageEnabled:
            typeof input.broadcastSettings?.mobileApp?.newsPageEnabled === 'boolean'
              ? input.broadcastSettings.mobileApp.newsPageEnabled
              : true,
          blogPageEnabled:
            typeof input.broadcastSettings?.mobileApp?.blogPageEnabled === 'boolean'
              ? input.broadcastSettings.mobileApp.blogPageEnabled
              : true,
          brandBadge:
            typeof input.broadcastSettings?.mobileApp?.brandBadge === 'string'
              ? input.broadcastSettings.mobileApp.brandBadge.trim().slice(0, 60)
              : ''
        },
        holdScreen: {
          active:
            typeof input.broadcastSettings?.holdScreen?.active === 'boolean'
              ? input.broadcastSettings.holdScreen.active
              : false,
          reason:
            typeof input.broadcastSettings?.holdScreen?.reason === 'string' &&
            VALID_HOLD_REASONS.has(input.broadcastSettings.holdScreen.reason)
              ? (input.broadcastSettings.holdScreen.reason as NonNullable<
                  MonetizationConfig['broadcastSettings']
                >['holdScreen'] extends infer H
                  ? H extends { reason: infer R }
                    ? R
                    : never
                  : never)
              : 'Break',
          obsEnabled:
            typeof input.broadcastSettings?.holdScreen?.obsEnabled === 'boolean'
              ? input.broadcastSettings.holdScreen.obsEnabled
              : false,
          videoEnabled:
            typeof input.broadcastSettings?.holdScreen?.videoEnabled === 'boolean'
              ? input.broadcastSettings.holdScreen.videoEnabled
              : false,
          videoUrls: Array.isArray(input.broadcastSettings?.holdScreen?.videoUrls)
            ? input.broadcastSettings!.holdScreen!.videoUrls
                .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
                .map((u) => u.trim().slice(0, 2000))
                .slice(0, 20)
            : [],
          videoLoop:
            typeof input.broadcastSettings?.holdScreen?.videoLoop === 'boolean'
              ? input.broadcastSettings.holdScreen.videoLoop
              : true,
          sponsorEnabled:
            typeof input.broadcastSettings?.holdScreen?.sponsorEnabled === 'boolean'
              ? input.broadcastSettings.holdScreen.sponsorEnabled
              : false,
          sponsorMode:
            input.broadcastSettings?.holdScreen?.sponsorMode === 'replace_video'
              ? 'replace_video'
              : 'with_content',
          sponsorImageUrl:
            typeof input.broadcastSettings?.holdScreen?.sponsorImageUrl === 'string'
              ? this.sanitizeUrl(input.broadcastSettings.holdScreen.sponsorImageUrl).slice(0, 2000)
              : '',
          sponsorLinkUrl:
            typeof input.broadcastSettings?.holdScreen?.sponsorLinkUrl === 'string'
              ? this.sanitizeUrl(input.broadcastSettings.holdScreen.sponsorLinkUrl).slice(0, 2000)
              : ''
        },
        matchTimer: {
          active:
            typeof input.broadcastSettings?.matchTimer?.active === 'boolean'
              ? input.broadcastSettings.matchTimer.active
              : false,
          startedAt:
            Number.isFinite(Number(input.broadcastSettings?.matchTimer?.startedAt)) &&
            Number(input.broadcastSettings?.matchTimer?.startedAt) >= 0
              ? Math.floor(Number(input.broadcastSettings?.matchTimer?.startedAt))
              : 0,
          accumulatedMs:
            Number.isFinite(Number(input.broadcastSettings?.matchTimer?.accumulatedMs)) &&
            Number(input.broadcastSettings?.matchTimer?.accumulatedMs) >= 0
              ? Math.floor(Number(input.broadcastSettings?.matchTimer?.accumulatedMs))
              : 0
        },
        tvScreen: {
          enabled:
            typeof input.broadcastSettings?.tvScreen?.enabled === 'boolean'
              ? input.broadcastSettings.tvScreen.enabled
              : false,
          obsEnabled:
            typeof input.broadcastSettings?.tvScreen?.obsEnabled === 'boolean'
              ? input.broadcastSettings.tvScreen.obsEnabled
              : false,
          fullScreenTakeover:
            typeof input.broadcastSettings?.tvScreen?.fullScreenTakeover === 'boolean'
              ? input.broadcastSettings.tvScreen.fullScreenTakeover
              : false,
          loop:
            typeof input.broadcastSettings?.tvScreen?.loop === 'boolean'
              ? input.broadcastSettings.tvScreen.loop
              : true,
          batBallBetweenAds:
            typeof input.broadcastSettings?.tvScreen?.batBallBetweenAds === 'boolean'
              ? input.broadcastSettings.tvScreen.batBallBetweenAds
              : false,
          batBallGapSec: Number.isFinite(Number(input.broadcastSettings?.tvScreen?.batBallGapSec))
            ? Math.max(2, Math.min(60, Math.round(Number(input.broadcastSettings?.tvScreen?.batBallGapSec))))
            : 6,
          playNowItemId:
            typeof input.broadcastSettings?.tvScreen?.playNowItemId === 'string'
              ? input.broadcastSettings.tvScreen.playNowItemId.trim().slice(0, 128)
              : '',
          playNowNonce:
            Number.isFinite(Number(input.broadcastSettings?.tvScreen?.playNowNonce)) &&
            Number(input.broadcastSettings?.tvScreen?.playNowNonce) >= 0
              ? Math.floor(Number(input.broadcastSettings?.tvScreen?.playNowNonce))
              : 0,
          playbackStopped:
            typeof input.broadcastSettings?.tvScreen?.playbackStopped === 'boolean'
              ? input.broadcastSettings.tvScreen.playbackStopped
              : false,
          sponsorName:
            typeof input.broadcastSettings?.tvScreen?.sponsorName === 'string'
              ? input.broadcastSettings.tvScreen.sponsorName.trim().slice(0, 120)
              : '',
          sponsorLink:
            typeof input.broadcastSettings?.tvScreen?.sponsorLink === 'string'
              ? this.sanitizeUrl(input.broadcastSettings.tvScreen.sponsorLink).slice(0, 2000)
              : '',
          playlist: Array.isArray(input.broadcastSettings?.tvScreen?.playlist)
            ? input.broadcastSettings!.tvScreen!.playlist
                .filter((item): item is NonNullable<MonetizationConfig['broadcastSettings']>['tvScreen'] extends infer T ? T extends { playlist: (infer P)[] } ? P : never : never =>
                  Boolean(item && typeof item === 'object' && typeof item.url === 'string' && item.url.trim().length > 0)
                )
                .slice(0, 20)
                .map((item, idx) => ({
                  id:
                    typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(item.id)
                      ? item.id
                      : `tv_item_${Date.now()}_${idx}`,
                  mediaType: (item.mediaType === 'video' || item.mediaType === 'youtube' || item.mediaType === 'news_feed' || item.mediaType === 'embed' ? item.mediaType : 'image') as 'image' | 'video' | 'youtube' | 'news_feed' | 'embed',
                  url: this.sanitizeUrl(item.url).slice(0, 2000) || item.url.trim().slice(0, 2000),
                  title: typeof item.title === 'string' ? item.title.trim().slice(0, 120) : '',
                  durationSec: Number.isFinite(Number(item.durationSec))
                    ? Math.max(3, Math.min(600, Math.round(Number(item.durationSec))))
                    : 10
                }))
            : []
        },
        soundSettings: {
          enabled:
            typeof input.broadcastSettings?.soundSettings?.enabled === 'boolean'
              ? input.broadcastSettings.soundSettings.enabled
              : true,
          obsEnabled:
            typeof input.broadcastSettings?.soundSettings?.obsEnabled === 'boolean'
              ? input.broadcastSettings.soundSettings.obsEnabled
              : true,
          effectsVolume: Number.isFinite(Number(input.broadcastSettings?.soundSettings?.effectsVolume))
            ? Math.max(0, Math.min(100, Math.round(Number(input.broadcastSettings?.soundSettings?.effectsVolume))))
            : 80,
          crowdVolume: Number.isFinite(Number(input.broadcastSettings?.soundSettings?.crowdVolume))
            ? Math.max(0, Math.min(100, Math.round(Number(input.broadcastSettings?.soundSettings?.crowdVolume))))
            : 28,
          voiceRate: Number.isFinite(Number(input.broadcastSettings?.soundSettings?.voiceRate))
            ? Math.round(Math.max(0.6, Math.min(1.6, Number(input.broadcastSettings?.soundSettings?.voiceRate))) * 100) / 100
            : 1.05,
          voiceVolume: Number.isFinite(Number(input.broadcastSettings?.soundSettings?.voiceVolume))
            ? Math.max(0, Math.min(100, Math.round(Number(input.broadcastSettings?.soundSettings?.voiceVolume))))
            : 90,
          customSounds: {
            fourUrl:
              typeof input.broadcastSettings?.soundSettings?.customSounds?.fourUrl === 'string'
                ? this.sanitizeUrl(input.broadcastSettings.soundSettings.customSounds.fourUrl).slice(0, 2000)
                : '',
            sixUrl:
              typeof input.broadcastSettings?.soundSettings?.customSounds?.sixUrl === 'string'
                ? this.sanitizeUrl(input.broadcastSettings.soundSettings.customSounds.sixUrl).slice(0, 2000)
                : '',
            wicketUrl:
              typeof input.broadcastSettings?.soundSettings?.customSounds?.wicketUrl === 'string'
                ? this.sanitizeUrl(input.broadcastSettings.soundSettings.customSounds.wicketUrl).slice(0, 2000)
                : '',
            crowdUrl:
              typeof input.broadcastSettings?.soundSettings?.customSounds?.crowdUrl === 'string'
                ? this.sanitizeUrl(input.broadcastSettings.soundSettings.customSounds.crowdUrl).slice(0, 2000)
                : ''
          }
        }
      },
      updatedAt:
        typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt) && input.updatedAt >= 0
          ? input.updatedAt
          : 0
    };
  }

  private sanitizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return '';
    // Allow http(s) and relative paths starting with /
    if (/^(https?:\/\/|\/)/i.test(trimmed)) {
      return trimmed;
    }
    // Prepend https:// if user entered bare domain like example.com
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return '';
  }

  private async saveToDisk() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(MONETIZATION_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('[MONETIZATION] Failed to save config to disk:', err);
    }
  }

  public getConfig(): MonetizationConfig {
    return structuredClone(this.config);
  }

  public async updateConfig(patch: Partial<MonetizationConfig>): Promise<MonetizationConfig> {
    const currentBroadcast = this.config.broadcastSettings || {
      animationsEnabled: true,
      breakScreen: { active: false, type: 'drinks' as const, subtitle: '' },
      winProbabilityEnabled: true,
      winProbabilityOverride: { enabled: false, battingTeamPct: 50 },
      obsPanels: { targetPanel: true, winProbabilityBar: true, runRateGraph: true },
      appDownload: { enabled: true, apkUrl: '', version: '1.0.0' },
      sixProCricket: { enabled: true, apkUrl: '', sizeLabel: '12 MB' }
    };

    const merged = this.mergeWithDefaults({
      ...this.config,
      ...patch,
      slots: {
        topBanner: {
          ...this.config.slots.topBanner,
          ...(patch.slots?.topBanner || {})
        },
        inContent: {
          ...this.config.slots.inContent,
          ...(patch.slots?.inContent || {})
        },
        footerBanner: {
          ...this.config.slots.footerBanner,
          ...(patch.slots?.footerBanner || {})
        },
        mobileBanner: {
          ...(this.config.slots.mobileBanner || { enabled: true, slotId: '', imageUrl: '', linkUrl: '', title: '' }),
          ...(patch.slots?.mobileBanner || {})
        }
      },
      sponsor: {
        ...this.config.sponsor,
        ...(patch.sponsor || {})
      },
      broadcastSettings: {
        ...currentBroadcast,
        ...(patch.broadcastSettings || {}),
        breakScreen: {
          ...currentBroadcast.breakScreen,
          ...(patch.broadcastSettings?.breakScreen || {})
        },
        winProbabilityOverride: {
          ...(currentBroadcast.winProbabilityOverride || { enabled: false, battingTeamPct: 50 }),
          ...(patch.broadcastSettings?.winProbabilityOverride || {})
        },
        obsPanels: {
          ...(currentBroadcast.obsPanels || { targetPanel: true, winProbabilityBar: true, runRateGraph: true }),
          ...(patch.broadcastSettings?.obsPanels || {})
        },
        appDownload: {
          ...(currentBroadcast.appDownload || { enabled: true, apkUrl: '', version: '1.0.0' }),
          ...(patch.broadcastSettings?.appDownload || {})
        },
        sixProCricket: {
          ...(currentBroadcast.sixProCricket || { enabled: true, apkUrl: '', sizeLabel: '12 MB' }),
          ...(patch.broadcastSettings?.sixProCricket || {})
        },
        nextMatch: {
          ...(currentBroadcast.nextMatch || { matchName: '', matchTime: '' }),
          ...(patch.broadcastSettings?.nextMatch || {})
        },
        announcement: {
          ...(currentBroadcast.announcement || { enabled: false, text: '', linkUrl: '' }),
          ...(patch.broadcastSettings?.announcement || {})
        },
        mobileApp: {
          ...(currentBroadcast.mobileApp || DEFAULT_CONFIG.broadcastSettings!.mobileApp!),
          ...(patch.broadcastSettings?.mobileApp || {})
        },
        holdScreen: {
          ...(currentBroadcast.holdScreen || {
            active: false,
            reason: 'Break' as const,
            obsEnabled: false,
            videoEnabled: false,
            videoUrls: [],
            videoLoop: true,
            sponsorEnabled: false,
            sponsorMode: 'with_content' as const,
            sponsorImageUrl: '',
            sponsorLinkUrl: ''
          }),
          ...(patch.broadcastSettings?.holdScreen || {})
        },
        matchTimer: {
          ...(currentBroadcast.matchTimer || { active: false, startedAt: 0, accumulatedMs: 0 }),
          ...(patch.broadcastSettings?.matchTimer || {})
        },
        tvScreen: {
          ...(currentBroadcast.tvScreen || DEFAULT_CONFIG.broadcastSettings!.tvScreen!),
          ...(patch.broadcastSettings?.tvScreen || {})
        },
        soundSettings: {
          ...(currentBroadcast.soundSettings || DEFAULT_CONFIG.broadcastSettings!.soundSettings!),
          ...(patch.broadcastSettings?.soundSettings || {}),
          customSounds: {
            ...(currentBroadcast.soundSettings?.customSounds || {}),
            ...(patch.broadcastSettings?.soundSettings?.customSounds || {})
          }
        }
      },
      updatedAt: Date.now()
    });

    this.config = merged;
    await this.saveToDisk();

    for (const listener of this.listeners) {
      try {
        listener(this.getConfig());
      } catch {}
    }

    return this.getConfig();
  }

  public subscribe(listener: (config: MonetizationConfig) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const monetizationService = new MonetizationService();
