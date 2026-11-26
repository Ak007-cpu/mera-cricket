import { AdSlotConfig, AdSlotFormat, MonetizationConfig } from '../types/cricket';

const PUB_ID_REGEX = /^(?:ca-)?pub-(\d{10,20})$/i;
const SLOT_ID_REGEX = /^\d{5,20}$/;

export type ManagedSlotKey = 'topBanner' | 'inContent' | 'footerBanner' | 'mobileBanner';

export interface SlotPerformanceEstimate {
  key: ManagedSlotKey;
  label: string;
  placementZone: string;
  mode: 'disabled' | 'adsense' | 'custom_image' | 'custom_promo' | 'placeholder';
  formatLabel: string;
  estimatedFillRate: number;
  estViewability: number;
  statusText: string;
  usesTopFallback: boolean;
  hasCustomFallback: boolean;
  isConfigured: boolean;
}

export interface MonetizationStatsSummary {
  rows: SlotPerformanceEstimate[];
  averageFillRate: number;
  activeAvgFillRate: number;
  configuredCount: number;
  adsenseCount: number;
  customCount: number;
  disabledOrEmptyCount: number;
  readinessLabel: string;
}

const SLOT_BASELINES: Record<
  ManagedSlotKey,
  { label: string; placementZone: string; placementBonus: number; baseViewability: number }
> = {
  topBanner: {
    label: '1. Top Banner',
    placementZone: 'Above Fold',
    placementBonus: 2,
    baseViewability: 84
  },
  inContent: {
    label: '2. In-Content Ad',
    placementZone: 'Mid Content',
    placementBonus: 3,
    baseViewability: 78
  },
  footerBanner: {
    label: '3. Footer Banner',
    placementZone: 'Lower Fold',
    placementBonus: -2,
    baseViewability: 58
  },
  mobileBanner: {
    label: '4. Mobile App Ad',
    placementZone: 'Mobile Card',
    placementBonus: 1,
    baseViewability: 82
  }
};

const FORMAT_FILL_BASE: Record<AdSlotFormat, number> = {
  auto: 93,
  horizontal: 89,
  rectangle: 91,
  vertical: 85
};

export function normalizePublisherId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Check if user pasted a snippet containing ca-pub-... or pub-...
  const match = trimmed.match(/(?:ca-)?pub-(\d{10,20})/i);
  if (match) {
    return `ca-pub-${match[1]}`;
  }

  // If user pasted 16-digit bare publisher number
  if (/^\d{14,20}$/.test(trimmed)) {
    return `ca-pub-${trimmed}`;
  }

  return trimmed;
}

export function isValidPublisherId(publisherId: string): boolean {
  return PUB_ID_REGEX.test(publisherId.trim());
}

export function isValidAdSlotId(slotId: string): boolean {
  return SLOT_ID_REGEX.test(slotId.trim());
}

export function toAdsTxtPublisherRecord(publisherId: string): string {
  const normalized = normalizePublisherId(publisherId);
  const match = normalized.match(/^ca-(pub-\d{10,20})$/i);
  if (!match) return '';
  return `google.com, ${match[1].toLowerCase()}, DIRECT, f08c47fec0942fa0`;
}

export function buildAdsTxtContent(publisherId: string, customLines?: string): string {
  const lines: string[] = [];
  const googleLine = toAdsTxtPublisherRecord(publisherId);
  if (googleLine) {
    lines.push(googleLine);
  }
  if (customLines && customLines.trim()) {
    const extra = customLines
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l !== googleLine);
    lines.push(...extra);
  }
  if (lines.length === 0) {
    return '# Google AdSense ads.txt - Configure your ca-pub Publisher ID in Studio Admin -> AdSense & Ads.\n';
  }
  return `${lines.join('\n')}\n`;
}

export interface ParsedAdSenseSnippet {
  publisherId?: string;
  slotId?: string;
  adFormat?: AdSlotFormat;
}

export function extractAdSenseSnippet(raw: string): ParsedAdSenseSnippet {
  const input = raw.trim();
  if (!input) return {};

  const result: ParsedAdSenseSnippet = {};

  // Match client=ca-pub-..., data-ad-client="ca-pub-...", content="ca-pub-...", or bare pub-...
  const pubMatch =
    input.match(/data-ad-client\s*=\s*["']?((?:ca-)?pub-\d{10,20})["']?/i) ||
    input.match(/client=((?:ca-)?pub-\d{10,20})/i) ||
    input.match(/content\s*=\s*["']?((?:ca-)?pub-\d{10,20})["']?/i) ||
    input.match(/((?:ca-)?pub-\d{10,20})/i);

  if (pubMatch?.[1]) {
    result.publisherId = normalizePublisherId(pubMatch[1]);
  }

  // Match data-ad-slot="1234567890" or bare numeric slot ID
  const slotMatch =
    input.match(/data-ad-slot\s*=\s*["']?(\d{5,20})["']?/i) ||
    (!pubMatch && /^\d{5,20}$/.test(input) ? [input, input] : null);

  if (slotMatch?.[1]) {
    result.slotId = slotMatch[1];
  }

  // Match data-ad-format="auto|horizontal|rectangle|vertical"
  const formatMatch = input.match(/data-ad-format\s*=\s*["']?(auto|horizontal|rectangle|vertical)["']?/i);
  if (formatMatch?.[1]) {
    result.adFormat = formatMatch[1].toLowerCase() as AdSlotFormat;
  }

  return result;
}

export function getEffectiveSlotMode(
  slot: AdSlotConfig | undefined,
  publisherId: string,
  adsEnabled: boolean
): 'disabled' | 'adsense' | 'custom_image' | 'custom_promo' | 'placeholder' {
  if (!adsEnabled || (slot && slot.enabled === false)) {
    return 'disabled';
  }

  const cleanPub = normalizePublisherId(publisherId || '');
  const hasAdSenseUnit = isValidPublisherId(cleanPub) && isValidAdSlotId(slot?.slotId || '');
  const hasCustomImage = Boolean(slot?.imageUrl?.trim());
  const hasCustomPromo = Boolean(slot?.title?.trim() && slot?.linkUrl?.trim());
  const source = slot?.adSource || 'auto';

  if (source === 'adsense') {
    if (hasAdSenseUnit) return 'adsense';
    if (hasCustomImage) return 'custom_image';
    if (hasCustomPromo) return 'custom_promo';
    return 'placeholder';
  }

  if (source === 'custom') {
    if (hasCustomImage) return 'custom_image';
    if (hasCustomPromo) return 'custom_promo';
    if (hasAdSenseUnit) return 'adsense';
    return 'placeholder';
  }

  // 'auto' preserves backward compatibility: custom image -> custom promo -> AdSense -> placeholder
  if (hasCustomImage) return 'custom_image';
  if (hasCustomPromo) return 'custom_promo';
  if (hasAdSenseUnit) return 'adsense';
  return 'placeholder';
}

export function estimateAdSlotsPerformance(config: MonetizationConfig): MonetizationStatsSummary {
  const cleanPubId = normalizePublisherId(config.adsensePublisherId || '');
  const pubValid = isValidPublisherId(cleanPubId);
  const masterAdsEnabled = Boolean(config.adsEnabled);
  const mobileAdsEnabled =
    masterAdsEnabled && (config.broadcastSettings?.mobileApp?.adsEnabled !== false);
  const autoAdsEnabled = config.adsenseAutoAds !== false;
  const testMode = Boolean(config.adsenseTestMode);

  const mob = config.slots?.mobileBanner;
  const top = config.slots?.topBanner;
  const mobileHasOwnConfig = Boolean(
    mob &&
      (mob.imageUrl?.trim() ||
        mob.slotId?.trim() ||
        (mob.title?.trim() && mob.linkUrl?.trim()))
  );

  const keys: ManagedSlotKey[] = ['topBanner', 'inContent', 'footerBanner', 'mobileBanner'];

  const rows: SlotPerformanceEstimate[] = keys.map((key) => {
    const baseline = SLOT_BASELINES[key];
    const rawSlot = config.slots?.[key];
    const usesTopFallback = Boolean(
      key === 'mobileBanner' && !mobileHasOwnConfig && rawSlot?.enabled !== false && top
    );
    const effectiveSlot = usesTopFallback ? top : rawSlot;
    const effectiveAdsEnabled = key === 'mobileBanner' ? mobileAdsEnabled : masterAdsEnabled;
    const mode = getEffectiveSlotMode(effectiveSlot, cleanPubId, effectiveAdsEnabled);

    const hasCustomFallback = Boolean(
      effectiveSlot?.imageUrl?.trim() ||
        (effectiveSlot?.title?.trim() && effectiveSlot?.linkUrl?.trim())
    );
    const format: AdSlotFormat =
      effectiveSlot?.adFormat || (key === 'mobileBanner' ? 'horizontal' : 'auto');

    if (mode === 'disabled') {
      const reason = !masterAdsEnabled
        ? 'Master Ads OFF'
        : key === 'mobileBanner' && !mobileAdsEnabled
        ? 'Mobile Ads OFF'
        : 'Slot Paused';
      return {
        key,
        label: baseline.label,
        placementZone: baseline.placementZone,
        mode,
        formatLabel: format.toUpperCase(),
        estimatedFillRate: 0,
        estViewability: 0,
        statusText: reason,
        usesTopFallback: false,
        hasCustomFallback,
        isConfigured: false
      };
    }

    if (mode === 'placeholder') {
      return {
        key,
        label: baseline.label,
        placementZone: baseline.placementZone,
        mode,
        formatLabel: format.toUpperCase(),
        estimatedFillRate: 0,
        estViewability: 0,
        statusText: pubValid ? 'Needs Slot ID' : 'Needs Pub + Slot ID',
        usesTopFallback: false,
        hasCustomFallback: false,
        isConfigured: false
      };
    }

    if (mode === 'custom_image' || mode === 'custom_promo') {
      return {
        key,
        label: baseline.label,
        placementZone: baseline.placementZone,
        mode,
        formatLabel: mode === 'custom_image' ? 'CUSTOM IMG' : 'PROMO',
        estimatedFillRate: 100,
        estViewability: Math.min(96, baseline.baseViewability + 6),
        statusText: mode === 'custom_image' ? 'Direct Image (100%)' : 'Direct Promo (100%)',
        usesTopFallback,
        hasCustomFallback: true,
        isConfigured: true
      };
    }

    // AdSense configured
    const formatBase = FORMAT_FILL_BASE[format] ?? 90;
    const autoAdsBonus = autoAdsEnabled ? 2 : 0;
    const fallbackBonus = hasCustomFallback ? 3 : 0;
    const estimatedFillRate = Math.max(
      75,
      Math.min(99, formatBase + baseline.placementBonus + autoAdsBonus + fallbackBonus)
    );
    const formatViewabilityBonus = format === 'auto' || format === 'rectangle' ? 3 : 0;
    const estViewability = Math.min(95, baseline.baseViewability + formatViewabilityBonus);

    return {
      key,
      label: baseline.label,
      placementZone: baseline.placementZone,
      mode,
      formatLabel: format.toUpperCase(),
      estimatedFillRate,
      estViewability,
      statusText: testMode ? 'Test Ad (data-adtest)' : 'AdSense Live',
      usesTopFallback,
      hasCustomFallback,
      isConfigured: true
    };
  });

  const configuredRows = rows.filter((r) => r.isConfigured);
  const configuredCount = configuredRows.length;
  const adsenseCount = rows.filter((r) => r.mode === 'adsense').length;
  const customCount = rows.filter(
    (r) => r.mode === 'custom_image' || r.mode === 'custom_promo'
  ).length;
  const disabledOrEmptyCount = rows.length - configuredCount;

  const averageFillRate = Math.round(
    rows.reduce((sum, r) => sum + r.estimatedFillRate, 0) / rows.length
  );
  const activeAvgFillRate =
    configuredCount > 0
      ? Math.round(
          configuredRows.reduce((sum, r) => sum + r.estimatedFillRate, 0) / configuredCount
        )
      : 0;

  const readinessLabel = !masterAdsEnabled
    ? 'Paused'
    : testMode
    ? 'Test Mode'
    : pubValid && adsenseCount > 0
    ? 'Production Ready'
    : customCount > 0
    ? 'Direct Banners Only'
    : 'Setup Needed';

  return {
    rows,
    averageFillRate,
    activeAvgFillRate,
    configuredCount,
    adsenseCount,
    customCount,
    disabledOrEmptyCount,
    readinessLabel
  };
}

export interface DailyMonetizationPoint {
  dateKey: string;
  dateLabel: string;
  revenue: number;
  impressions: number;
  ecpm: number;
}

export interface SlotAnalyticsBreakdown {
  key: ManagedSlotKey;
  label: string;
  mode: SlotPerformanceEstimate['mode'];
  formatLabel: string;
  estimatedFillRate: number;
  periodImpressions: number;
  periodRevenue: number;
  revenueSharePct: number;
  ecpm: number;
  statusText: string;
}

export interface MonetizationAnalyticsReport {
  series: DailyMonetizationPoint[];
  slotBreakdown: SlotAnalyticsBreakdown[];
  totalRevenue: number;
  totalImpressions: number;
  blendedEcpm: number;
  activeSlotCount: number;
  adsenseSlotCount: number;
}

const SLOT_TRAFFIC_WEIGHT: Record<ManagedSlotKey, number> = {
  topBanner: 1.0,
  inContent: 0.84,
  footerBanner: 0.58,
  mobileBanner: 0.72
};

const FORMAT_ECPM_BASE: Record<string, number> = {
  AUTO: 1.85,
  RECTANGLE: 2.15,
  HORIZONTAL: 1.55,
  VERTICAL: 1.65,
  'CUSTOM IMG': 0,
  PROMO: 0
};

export function buildDailyMonetizationAnalytics(
  config: MonetizationConfig,
  options: {
    days: 7 | 14 | 30;
    slotFilter: 'all' | ManagedSlotKey;
    dailyTrafficBaseline?: number;
  }
): MonetizationAnalyticsReport {
  const perf = estimateAdSlotsPerformance(config);
  const { days, slotFilter } = options;
  const masterAdsEnabled = Boolean(config.adsEnabled);
  const baselineSessions = Math.max(400, Math.round(options.dailyTrafficBaseline || 0) * 18 + 650);

  const selectedRows =
    slotFilter === 'all' ? perf.rows : perf.rows.filter((r) => r.key === slotFilter);

  const slotDailyTotals = new Map<ManagedSlotKey, { impressions: number; revenue: number; ecpm: number }>();
  selectedRows.forEach((row) => {
    slotDailyTotals.set(row.key, { impressions: 0, revenue: 0, ecpm: 0 });
  });

  const now = new Date();
  const series: DailyMonetizationPoint[] = [];

  for (let offset = days - 1; offset >= 0; offset--) {
    const d = new Date(now);
    d.setDate(now.getDate() - offset);
    const dateKey = d.toISOString().slice(0, 10);
    const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Deterministic day-of-week & cricket matchday cadence factor (no random jitter)
    const dow = d.getDay(); // 0=Sun, 6=Sat
    const weekendLift = dow === 0 || dow === 6 ? 1.24 : dow === 5 ? 1.14 : 0.94;
    const wave = 1 + Math.sin((days - 1 - offset) * 0.78) * 0.11;
    const daySessions = Math.round(baselineSessions * weekendLift * wave);

    let dayImpressions = 0;
    let dayRevenue = 0;

    if (masterAdsEnabled) {
      selectedRows.forEach((row) => {
        if (!row.isConfigured || row.estimatedFillRate <= 0) return;

        const exposureWeight = SLOT_TRAFFIC_WEIGHT[row.key] ?? 0.7;
        const fillFactor = row.estimatedFillRate / 100;
        const slotImpressions = Math.round(daySessions * exposureWeight * fillFactor);

        const baseEcpm = row.mode === 'adsense' ? (FORMAT_ECPM_BASE[row.formatLabel] ?? 1.7) : 0;
        const viewabilityFactor = row.estViewability > 0 ? 0.75 + row.estViewability / 200 : 1;
        const slotEcpm = Number((baseEcpm * viewabilityFactor).toFixed(2));
        const slotRevenue = Number(((slotImpressions / 1000) * slotEcpm).toFixed(2));

        dayImpressions += slotImpressions;
        dayRevenue += slotRevenue;

        const acc = slotDailyTotals.get(row.key);
        if (acc) {
          acc.impressions += slotImpressions;
          acc.revenue += slotRevenue;
          acc.ecpm = slotEcpm;
        }
      });
    }

    const roundedRevenue = Number(dayRevenue.toFixed(2));
    const ecpm = dayImpressions > 0 ? Number(((roundedRevenue / dayImpressions) * 1000).toFixed(2)) : 0;

    series.push({
      dateKey,
      dateLabel,
      revenue: roundedRevenue,
      impressions: dayImpressions,
      ecpm
    });
  }

  const totalRevenue = Number(series.reduce((sum, p) => sum + p.revenue, 0).toFixed(2));
  const totalImpressions = series.reduce((sum, p) => sum + p.impressions, 0);
  const blendedEcpm =
    totalImpressions > 0 ? Number(((totalRevenue / totalImpressions) * 1000).toFixed(2)) : 0;

  const slotBreakdown: SlotAnalyticsBreakdown[] = perf.rows.map((row) => {
    const totals = slotDailyTotals.get(row.key) || { impressions: 0, revenue: 0, ecpm: 0 };
    const roundedSlotRev = Number(totals.revenue.toFixed(2));
    const sharePct = totalRevenue > 0 ? Math.round((roundedSlotRev / totalRevenue) * 100) : 0;
    return {
      key: row.key,
      label: row.label,
      mode: row.mode,
      formatLabel: row.formatLabel,
      estimatedFillRate: row.estimatedFillRate,
      periodImpressions: totals.impressions,
      periodRevenue: roundedSlotRev,
      revenueSharePct: sharePct,
      ecpm: totals.ecpm,
      statusText: row.statusText
    };
  });

  return {
    series,
    slotBreakdown,
    totalRevenue,
    totalImpressions,
    blendedEcpm,
    activeSlotCount: perf.configuredCount,
    adsenseSlotCount: perf.adsenseCount
  };
}

export interface Slot30DayMetric {
  fillRate: number;
  cpm: number;
}

export interface DailySlotPerformancePoint {
  date: Date;
  dateKey: string;
  dateLabel: string;
  fillRate: number;
  cpm: number;
  bySlot: Record<ManagedSlotKey, Slot30DayMetric>;
}

export interface Slot30DaySummary {
  key: ManagedSlotKey;
  label: string;
  formatLabel: string;
  avgFillRate: number;
  avgCpm: number;
  peakCpm: number;
  isConfigured: boolean;
  statusText: string;
}

export interface AdPerformance30DayReport {
  points: DailySlotPerformancePoint[];
  slotSummaries: Slot30DaySummary[];
  avgFillRate30d: number;
  avgCpm30d: number;
  peakCpm30d: number;
  fillRateDeltaPct: number;
  cpmDelta: number;
  activeSlotCount: number;
}

const SLOT_PHASE_OFFSET: Record<ManagedSlotKey, number> = {
  topBanner: 0.2,
  inContent: 1.4,
  footerBanner: 2.6,
  mobileBanner: 0.9
};

export function build30DayAdPerformanceData(
  config: MonetizationConfig,
  slotFilter: 'all' | ManagedSlotKey = 'all'
): AdPerformance30DayReport {
  const perf = estimateAdSlotsPerformance(config);
  const masterAdsEnabled = Boolean(config.adsEnabled);
  const days = 30;
  const now = new Date();
  const keys: ManagedSlotKey[] = ['topBanner', 'inContent', 'footerBanner', 'mobileBanner'];

  const slotAccum: Record<
    ManagedSlotKey,
    { fillSum: number; cpmSum: number; peakCpm: number }
  > = {
    topBanner: { fillSum: 0, cpmSum: 0, peakCpm: 0 },
    inContent: { fillSum: 0, cpmSum: 0, peakCpm: 0 },
    footerBanner: { fillSum: 0, cpmSum: 0, peakCpm: 0 },
    mobileBanner: { fillSum: 0, cpmSum: 0, peakCpm: 0 }
  };

  const points: DailySlotPerformancePoint[] = [];

  for (let offset = days - 1; offset >= 0; offset--) {
    const dayIndex = days - 1 - offset;
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(now.getDate() - offset);
    const dateKey = d.toISOString().slice(0, 10);
    const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dow = d.getDay();
    const weekendCpmLift = dow === 0 || dow === 6 ? 1.11 : dow === 5 ? 1.06 : 0.96;
    const weekendFillLift = dow === 0 || dow === 6 ? 1.2 : 0;

    const bySlot = {} as Record<ManagedSlotKey, Slot30DayMetric>;

    perf.rows.forEach((row) => {
      if (!masterAdsEnabled || !row.isConfigured || row.estimatedFillRate <= 0) {
        bySlot[row.key] = { fillRate: 0, cpm: 0 };
        return;
      }

      const phase = SLOT_PHASE_OFFSET[row.key];
      const trendRamp = (dayIndex / (days - 1) - 0.5) * 1.4; // subtle 30d optimization lift

      let fillRate = row.estimatedFillRate;
      if (row.mode === 'adsense') {
        const fillWave = Math.sin(dayIndex * 0.42 + phase) * 2.4 + weekendFillLift + trendRamp;
        fillRate = Number(Math.max(60, Math.min(99.5, row.estimatedFillRate + fillWave)).toFixed(1));
      } else {
        fillRate = 100;
      }

      let cpm = 0;
      if (row.mode === 'adsense') {
        const baseEcpm = FORMAT_ECPM_BASE[row.formatLabel] ?? 1.7;
        const viewabilityFactor = row.estViewability > 0 ? 0.75 + row.estViewability / 200 : 1;
        const cpmWave = 1 + Math.sin(dayIndex * 0.36 + phase * 1.3) * 0.09 + (dayIndex / 29) * 0.05;
        cpm = Number((baseEcpm * viewabilityFactor * weekendCpmLift * cpmWave).toFixed(2));
      }

      bySlot[row.key] = { fillRate, cpm };

      slotAccum[row.key].fillSum += fillRate;
      slotAccum[row.key].cpmSum += cpm;
      if (cpm > slotAccum[row.key].peakCpm) {
        slotAccum[row.key].peakCpm = cpm;
      }
    });

    let pointFill = 0;
    let pointCpm = 0;
    if (slotFilter === 'all') {
      const activeKeys = keys.filter((k) => {
        const row = perf.rows.find((r) => r.key === k);
        return Boolean(masterAdsEnabled && row?.isConfigured);
      });
      if (activeKeys.length > 0) {
        pointFill = Number(
          (
            activeKeys.reduce((s, k) => s + bySlot[k].fillRate, 0) / activeKeys.length
          ).toFixed(1)
        );
        const adsenseKeys = activeKeys.filter((k) => {
          const row = perf.rows.find((r) => r.key === k);
          return row?.mode === 'adsense';
        });
        if (adsenseKeys.length > 0) {
          pointCpm = Number(
            (
              adsenseKeys.reduce((s, k) => s + bySlot[k].cpm, 0) / adsenseKeys.length
            ).toFixed(2)
          );
        }
      }
    } else {
      pointFill = bySlot[slotFilter].fillRate;
      pointCpm = bySlot[slotFilter].cpm;
    }

    points.push({
      date: d,
      dateKey,
      dateLabel,
      fillRate: pointFill,
      cpm: pointCpm,
      bySlot
    });
  }

  const slotSummaries: Slot30DaySummary[] = perf.rows.map((row) => {
    const acc = slotAccum[row.key];
    return {
      key: row.key,
      label: row.label,
      formatLabel: row.formatLabel,
      avgFillRate: Number((acc.fillSum / days).toFixed(1)),
      avgCpm: Number((acc.cpmSum / days).toFixed(2)),
      peakCpm: Number(acc.peakCpm.toFixed(2)),
      isConfigured: row.isConfigured && masterAdsEnabled,
      statusText: row.statusText
    };
  });

  const avgFillRate30d = Number(
    (points.reduce((s, p) => s + p.fillRate, 0) / days).toFixed(1)
  );
  const avgCpm30d = Number(
    (points.reduce((s, p) => s + p.cpm, 0) / days).toFixed(2)
  );
  const peakCpm30d = Number(Math.max(0, ...points.map((p) => p.cpm)).toFixed(2));

  const first7Fill = points.slice(0, 7).reduce((s, p) => s + p.fillRate, 0) / 7;
  const last7Fill = points.slice(-7).reduce((s, p) => s + p.fillRate, 0) / 7;
  const fillRateDeltaPct = Number((last7Fill - first7Fill).toFixed(1));

  const first7Cpm = points.slice(0, 7).reduce((s, p) => s + p.cpm, 0) / 7;
  const last7Cpm = points.slice(-7).reduce((s, p) => s + p.cpm, 0) / 7;
  const cpmDelta = Number((last7Cpm - first7Cpm).toFixed(2));

  return {
    points,
    slotSummaries,
    avgFillRate30d,
    avgCpm30d,
    peakCpm30d,
    fillRateDeltaPct,
    cpmDelta,
    activeSlotCount: perf.configuredCount
  };
}

export type PricingStrategy = 'conservative' | 'balanced' | 'aggressive';

export interface SlotFloorRecommendation {
  key: ManagedSlotKey;
  label: string;
  formatLabel: string;
  eligible: boolean;
  avgCpm30d: number;
  lowCpm30d: number;
  peakCpm30d: number;
  trend14dPct: number;
  avgFillRate30d: number;
  recommendedFloor: number;
  projectedFillRate: number;
  projectedLiftPct: number;
  actionTag: 'Raise Floor' | 'Set Optimal' | 'Hold Steady' | 'Ease Floor' | 'Inactive';
  rationale: string;
}

export interface DynamicPricingReport {
  strategy: PricingStrategy;
  recommendations: SlotFloorRecommendation[];
  eligibleCount: number;
  blendedRecommendedFloor: number;
  estimatedNetLiftPct: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function buildDynamicFloorRecommendations(
  config: MonetizationConfig,
  strategy: PricingStrategy = 'balanced',
  existingReport?: AdPerformance30DayReport
): DynamicPricingReport {
  const perf30 = existingReport || build30DayAdPerformanceData(config, 'all');
  const perfSlots = estimateAdSlotsPerformance(config);
  const masterAdsEnabled = Boolean(config.adsEnabled);

  const strategyConfig: Record<
    PricingStrategy,
    { quantile: number; multiplier: number; fillTradeoff: number; cpmUpliftFactor: number }
  > = {
    conservative: { quantile: 0.25, multiplier: 0.9, fillTradeoff: 0.8, cpmUpliftFactor: 0.04 },
    balanced: { quantile: 0.5, multiplier: 0.88, fillTradeoff: 1.9, cpmUpliftFactor: 0.09 },
    aggressive: { quantile: 0.75, multiplier: 0.86, fillTradeoff: 4.5, cpmUpliftFactor: 0.15 }
  };

  const preset = strategyConfig[strategy];

  const recommendations: SlotFloorRecommendation[] = perf30.slotSummaries.map((slotSummary) => {
    const perfRow = perfSlots.rows.find((r) => r.key === slotSummary.key);
    const isAdSenseEligible = Boolean(
      masterAdsEnabled && perfRow?.isConfigured && perfRow.mode === 'adsense'
    );

    if (!isAdSenseEligible) {
      return {
        key: slotSummary.key,
        label: slotSummary.label,
        formatLabel: slotSummary.formatLabel,
        eligible: false,
        avgCpm30d: slotSummary.avgCpm,
        lowCpm30d: 0,
        peakCpm30d: slotSummary.peakCpm,
        trend14dPct: 0,
        avgFillRate30d: slotSummary.avgFillRate,
        recommendedFloor: 0,
        projectedFillRate: slotSummary.avgFillRate,
        projectedLiftPct: 0,
        actionTag: 'Inactive',
        rationale: !masterAdsEnabled
          ? 'Master Ads disabled — enable ads to calculate an AdSense floor.'
          : perfRow?.mode === 'custom_image' || perfRow?.mode === 'custom_promo'
          ? 'Direct sponsored banner (100% fill) — CPM floor not applicable.'
          : 'Configure a valid AdSense Slot ID to unlock dynamic floor pricing.'
      };
    }

    const cpmSeries = perf30.points.map((p) => p.bySlot[slotSummary.key].cpm);
    const sorted = [...cpmSeries].sort((a, b) => a - b);
    const lowCpm30d = Number((sorted[0] || 0).toFixed(2));
    const peakCpm30d = Number((sorted[sorted.length - 1] || 0).toFixed(2));

    const firstHalfAvg =
      cpmSeries.slice(0, 15).reduce((s, v) => s + v, 0) / Math.max(1, cpmSeries.slice(0, 15).length);
    const secondHalfAvg =
      cpmSeries.slice(15).reduce((s, v) => s + v, 0) / Math.max(1, cpmSeries.slice(15).length);
    const trend14dPct =
      firstHalfAvg > 0
        ? Number((((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100).toFixed(1))
        : 0;

    const anchorCpm = percentile(sorted, preset.quantile);
    const momentumAdj = 1 + Math.max(-0.06, Math.min(0.08, trend14dPct / 100));
    const fillCushionAdj =
      slotSummary.avgFillRate >= 93 ? 1.04 : slotSummary.avgFillRate < 86 ? 0.93 : 1.0;

    const recommendedFloor = Number(
      Math.max(0.45, Math.min(peakCpm30d * 0.92, anchorCpm * preset.multiplier * momentumAdj * fillCushionAdj)).toFixed(2)
    );

    const fillPenalty =
      slotSummary.avgFillRate >= 94
        ? preset.fillTradeoff * 0.7
        : slotSummary.avgFillRate < 87
        ? preset.fillTradeoff * 1.35
        : preset.fillTradeoff;
    const projectedFillRate = Number(
      Math.max(65, Math.min(99, slotSummary.avgFillRate - fillPenalty)).toFixed(1)
    );

    const projectedEffectiveCpm = slotSummary.avgCpm * (1 + preset.cpmUpliftFactor * (trend14dPct >= 0 ? 1.08 : 0.85));
    const currentYield = slotSummary.avgCpm * (slotSummary.avgFillRate / 100);
    const newYield = projectedEffectiveCpm * (projectedFillRate / 100);
    const projectedLiftPct =
      currentYield > 0 ? Number((((newYield - currentYield) / currentYield) * 100).toFixed(1)) : 0;

    let actionTag: SlotFloorRecommendation['actionTag'] = 'Set Optimal';
    if (trend14dPct >= 2.5 && slotSummary.avgFillRate >= 90) {
      actionTag = 'Raise Floor';
    } else if (slotSummary.avgFillRate < 86 || trend14dPct <= -2.5) {
      actionTag = 'Ease Floor';
    } else if (strategy === 'conservative') {
      actionTag = 'Hold Steady';
    }

    const rationale =
      actionTag === 'Raise Floor'
        ? `14D CPM up +${trend14dPct}% with ${slotSummary.avgFillRate}% fill cushion; $${recommendedFloor.toFixed(2)} floor captures auction upside.`
        : actionTag === 'Ease Floor'
        ? `Fill rate (${slotSummary.avgFillRate}%) or recent auction softness favors a $${recommendedFloor.toFixed(2)} floor to protect demand.`
        : `30D median CPM ($${percentile(sorted, 0.5).toFixed(2)}) supports a $${recommendedFloor.toFixed(2)} floor while keeping ${projectedFillRate}% fill.`;

    return {
      key: slotSummary.key,
      label: slotSummary.label,
      formatLabel: slotSummary.formatLabel,
      eligible: true,
      avgCpm30d: slotSummary.avgCpm,
      lowCpm30d,
      peakCpm30d,
      trend14dPct,
      avgFillRate30d: slotSummary.avgFillRate,
      recommendedFloor,
      projectedFillRate,
      projectedLiftPct,
      actionTag,
      rationale
    };
  });

  const eligibleRows = recommendations.filter((r) => r.eligible);
  const eligibleCount = eligibleRows.length;
  const blendedRecommendedFloor =
    eligibleCount > 0
      ? Number(
          (eligibleRows.reduce((s, r) => s + r.recommendedFloor, 0) / eligibleCount).toFixed(2)
        )
      : 0;
  const estimatedNetLiftPct =
    eligibleCount > 0
      ? Number(
          (eligibleRows.reduce((s, r) => s + r.projectedLiftPct, 0) / eligibleCount).toFixed(1)
        )
      : 0;

  return {
    strategy,
    recommendations,
    eligibleCount,
    blendedRecommendedFloor,
    estimatedNetLiftPct
  };
}
