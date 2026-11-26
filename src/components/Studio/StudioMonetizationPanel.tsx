import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AdSlotConfig,
  AdSlotFormat,
  AdSlotSource,
  MonetizationConfig
} from '../../types/cricket';
import { AdSensePlacementPreview, PreviewSlotKey } from './AdSensePlacementPreview';
import { AdSenseSlotStatsPanel } from './AdSenseSlotStatsPanel';
import { fetchMonetizationConfig, updateMonetizationConfig } from '../../services/api';
import { saveStoredSponsorMedia } from '../../utils/mediaStorage';
import { useContent } from '../../context/ContentContext';
import { saveSiteConfigToFirestore, uploadImageAsset } from '../../services/firebaseContentService';
import {
  buildAdsTxtContent,
  extractAdSenseSnippet,
  getEffectiveSlotMode,
  isValidAdSlotId,
  isValidPublisherId,
  normalizePublisherId,
  toAdsTxtPublisherRecord
} from '../../utils/adsense';
import {
  DollarSign,
  Save,
  CheckCircle2,
  AlertTriangle,
  Megaphone,
  LayoutTemplate,
  Globe,
  ExternalLink,
  Eye,
  EyeOff,
  Upload,
  Smartphone,
  Trash2,
  Code2,
  Copy,
  Check,
  FileText,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FlaskConical
} from 'lucide-react';

interface StudioMonetizationPanelProps {
  adminPin: string;
  isAuthorized: boolean;
}

type AdSlotKey = 'topBanner' | 'inContent' | 'footerBanner' | 'mobileBanner';

const EMPTY_SLOT: AdSlotConfig = {
  enabled: true,
  slotId: '',
  adFormat: 'auto',
  adSource: 'auto',
  imageUrl: '',
  linkUrl: '',
  title: ''
};

const EMPTY_CONFIG: MonetizationConfig = {
  adsEnabled: true,
  adsensePublisherId: '',
  adsenseAutoAds: true,
  adsenseTestMode: false,
  adsenseHidePlaceholders: false,
  adsTxtCustomLines: '',
  slots: {
    topBanner: { ...EMPTY_SLOT, adFormat: 'auto' },
    inContent: { ...EMPTY_SLOT, adFormat: 'auto' },
    footerBanner: { ...EMPTY_SLOT, adFormat: 'auto' },
    mobileBanner: { ...EMPTY_SLOT, adFormat: 'horizontal' }
  },
  sponsor: {
    enabled: true,
    name: 'Official Broadcast Partner',
    tagline: 'Sponsor your brand across every live delivery',
    logoUrl: '',
    imageUrl: '',
    linkUrl: ''
  },
  siteName: 'Live Cricket HD',
  contactEmail: 'contact@livecrickethd.com',
  updatedAt: Date.now()
};

const SLOT_DESCRIPTIONS: Array<{
  key: AdSlotKey;
  label: string;
  hint: string;
  recommendedFormat: string;
  accent: string;
  isMobile?: boolean;
}> = [
  {
    key: 'topBanner',
    label: '1. Top Banner (Website)',
    hint: 'Broadcast header ke neeche (728×90 / Responsive Leaderboard).',
    recommendedFormat: 'horizontal or auto',
    accent: 'text-sky-400'
  },
  {
    key: 'inContent',
    label: '2. In-Content Ad (Website)',
    hint: 'Scorecard aur Highlights ke darmiyan dikhta hai.',
    recommendedFormat: 'auto or rectangle',
    accent: 'text-indigo-400'
  },
  {
    key: 'footerBanner',
    label: '3. Footer Banner (Website)',
    hint: 'Player statistics table ke neeche footer se pehle.',
    recommendedFormat: 'horizontal or auto',
    accent: 'text-amber-400'
  },
  {
    key: 'mobileBanner',
    label: '4. Mobile App Ad (Android / Phone)',
    hint: 'Mobile App (?view=android) ke bottom par dikhta hai (320×50).',
    recommendedFormat: 'horizontal',
    accent: 'text-emerald-400',
    isMobile: true
  }
];

const AD_FORMAT_OPTIONS: Array<{ value: AdSlotFormat; label: string }> = [
  { value: 'auto', label: 'Auto (Responsive)' },
  { value: 'horizontal', label: 'Horizontal (728×90 / 320×50)' },
  { value: 'rectangle', label: 'Rectangle (300×250)' },
  { value: 'vertical', label: 'Vertical (Skyscraper)' }
];

export const StudioMonetizationPanel: React.FC<StudioMonetizationPanelProps> = ({
  adminPin,
  isAuthorized
}) => {
  const { isFirebaseAdmin, setBackupMonetization, mergeMonetization } = useContent();
  const [config, setConfig] = useState<MonetizationConfig>(EMPTY_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // AdSense Smart Paste & UI states
  const [showGlobalPaste, setShowGlobalPaste] = useState(false);
  const [globalSnippetInput, setGlobalSnippetInput] = useState('');
  const [openSlotPaste, setOpenSlotPaste] = useState<Record<AdSlotKey, boolean>>({
    topBanner: false,
    inContent: false,
    footerBanner: false,
    mobileBanner: false
  });
  const [slotSnippetInput, setSlotSnippetInput] = useState<Record<AdSlotKey, string>>({
    topBanner: '',
    inContent: '',
    footerBanner: '',
    mobileBanner: ''
  });
  const [openCustomBanner, setOpenCustomBanner] = useState<Record<AdSlotKey, boolean>>({
    topBanner: false,
    inContent: false,
    footerBanner: false,
    mobileBanner: false
  });
  const [showExtraAdsTxt, setShowExtraAdsTxt] = useState(false);
  const [copiedAdsTxt, setCopiedAdsTxt] = useState(false);
  const [selectedPreviewSlot, setSelectedPreviewSlot] = useState<PreviewSlotKey | null>(null);
  const slotCardRefs = useRef<Partial<Record<AdSlotKey, HTMLDivElement | null>>>({});

  const handleSelectPreviewSlot = (slotKey: PreviewSlotKey) => {
    setSelectedPreviewSlot(slotKey);
    slotCardRefs.current[slotKey]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  useEffect(() => {
    let mounted = true;
    fetchMonetizationConfig()
      .then((res) => {
        const merged = mergeMonetization(res);
        if (mounted && merged) {
          setConfig({
            ...EMPTY_CONFIG,
            ...merged,
            adsenseAutoAds: merged.adsenseAutoAds !== undefined ? merged.adsenseAutoAds : true,
            adsenseTestMode: Boolean(merged.adsenseTestMode),
            adsenseHidePlaceholders: Boolean(merged.adsenseHidePlaceholders),
            adsTxtCustomLines: merged.adsTxtCustomLines || '',
            slots: {
              topBanner: { ...EMPTY_SLOT, adFormat: 'auto', ...(merged.slots?.topBanner || {}) },
              inContent: { ...EMPTY_SLOT, adFormat: 'auto', ...(merged.slots?.inContent || {}) },
              footerBanner: { ...EMPTY_SLOT, adFormat: 'auto', ...(merged.slots?.footerBanner || {}) },
              mobileBanner: { ...EMPTY_SLOT, adFormat: 'horizontal', ...(merged.slots?.mobileBanner || {}) }
            }
          });
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [mergeMonetization]);

  const normalizedPubId = useMemo(
    () => normalizePublisherId(config.adsensePublisherId || ''),
    [config.adsensePublisherId]
  );
  const pubIdValid = useMemo(() => isValidPublisherId(normalizedPubId), [normalizedPubId]);
  const adsTxtRecord = useMemo(() => toAdsTxtPublisherRecord(normalizedPubId), [normalizedPubId]);
  const fullAdsTxtPreview = useMemo(
    () => buildAdsTxtContent(normalizedPubId, config.adsTxtCustomLines),
    [normalizedPubId, config.adsTxtCustomLines]
  );

  const slotStatusSummary = useMemo(() => {
    const keys: AdSlotKey[] = ['topBanner', 'inContent', 'footerBanner', 'mobileBanner'];
    let adsenseCount = 0;
    let customCount = 0;
    keys.forEach((k) => {
      const mode = getEffectiveSlotMode(config.slots[k], normalizedPubId, config.adsEnabled);
      if (mode === 'adsense') adsenseCount += 1;
      if (mode === 'custom_image' || mode === 'custom_promo') customCount += 1;
    });
    return { adsenseCount, customCount };
  }, [config.slots, normalizedPubId, config.adsEnabled]);

  const persistConfig = async (nextConfig: MonetizationConfig, successMsg: string) => {
    setIsSaving(true);
    setFeedback(null);
    const cleanedConfig: MonetizationConfig = {
      ...nextConfig,
      adsensePublisherId: normalizePublisherId(nextConfig.adsensePublisherId || '')
    };

    try {
      saveStoredSponsorMedia({
        logoUrl: cleanedConfig.sponsor.logoUrl,
        imageUrl: cleanedConfig.sponsor.imageUrl
      });
      const updated = await updateMonetizationConfig(cleanedConfig, adminPin);
      setConfig({
        ...EMPTY_CONFIG,
        ...updated,
        slots: {
          topBanner: { ...EMPTY_SLOT, adFormat: 'auto', ...(updated.slots?.topBanner || {}) },
          inContent: { ...EMPTY_SLOT, adFormat: 'auto', ...(updated.slots?.inContent || {}) },
          footerBanner: { ...EMPTY_SLOT, adFormat: 'auto', ...(updated.slots?.footerBanner || {}) },
          mobileBanner: { ...EMPTY_SLOT, adFormat: 'horizontal', ...(updated.slots?.mobileBanner || {}) }
        }
      });
      setBackupMonetization(updated);
      if (isFirebaseAdmin) {
        await saveSiteConfigToFirestore(updated);
      }
      setFeedback({
        text: isFirebaseAdmin
          ? `${successMsg} (Firebase Cloud par Web aur Mobile App users ke liye live sync ho gaya!)`
          : `${successMsg} (Global cloud sync ke liye upar Google Admin Sign-In active rakhein.)`,
        type: 'success'
      });
    } catch (err: any) {
      setFeedback({
        text: err.message || 'Settings save nahi ho sakin',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExtractGlobalAdSense = () => {
    const parsed = extractAdSenseSnippet(globalSnippetInput);
    if (!parsed.publisherId) {
      setFeedback({
        text: 'Code mein valid Google AdSense Publisher ID (ca-pub-XXXXXXXXXXXXXXXX) nahi mila.',
        type: 'error'
      });
      return;
    }
    setConfig((prev) => ({
      ...prev,
      adsEnabled: true,
      adsensePublisherId: parsed.publisherId || prev.adsensePublisherId
    }));
    setGlobalSnippetInput('');
    setShowGlobalPaste(false);
    setFeedback({
      text: `Publisher ID (${parsed.publisherId}) extract ho gaya! Ab Save & Publish All par click karein.`,
      type: 'success'
    });
  };

  const handleExtractSlotSnippet = (slotKey: AdSlotKey) => {
    const raw = slotSnippetInput[slotKey] || '';
    const parsed = extractAdSenseSnippet(raw);
    if (!parsed.slotId && !parsed.publisherId) {
      setFeedback({
        text: 'Paste kiye gaye code mein data-ad-slot ya ca-pub ID nahi mila.',
        type: 'error'
      });
      return;
    }

    setConfig((prev) => {
      const current = prev.slots[slotKey] || EMPTY_SLOT;
      return {
        ...prev,
        adsEnabled: true,
        adsensePublisherId: parsed.publisherId || prev.adsensePublisherId,
        slots: {
          ...prev.slots,
          [slotKey]: {
            ...current,
            enabled: true,
            slotId: parsed.slotId || current.slotId,
            adFormat: parsed.adFormat || current.adFormat || 'auto',
            adSource: parsed.slotId ? 'adsense' : current.adSource || 'auto'
          }
        }
      };
    });

    setSlotSnippetInput((prev) => ({ ...prev, [slotKey]: '' }));
    setOpenSlotPaste((prev) => ({ ...prev, [slotKey]: false }));
    setFeedback({
      text: `AdSense Ad Unit extract ho gaya${parsed.slotId ? ` (Slot: ${parsed.slotId})` : ''}! Save & Publish All click karein.`,
      type: 'success'
    });
  };

  const handleCopyAdsTxt = async () => {
    try {
      await navigator.clipboard.writeText(fullAdsTxtPreview);
      setCopiedAdsTxt(true);
      setTimeout(() => setCopiedAdsTxt(false), 2000);
    } catch {
      setFeedback({ text: 'Clipboard copy blocked — text manually select karke copy karein.', type: 'error' });
    }
  };

  const handleUploadSponsorAsset = async (target: 'logo' | 'banner', file?: File) => {
    if (!file || !isAuthorized) return;
    setUploadingAsset(`sponsor_${target}`);
    setFeedback(null);
    try {
      const uploaded = await uploadImageAsset(
        file,
        'sponsors',
        `sponsor_${target}`,
        adminPin,
        target === 'logo' ? 256 : 720
      );

      const updatedConfig: MonetizationConfig = {
        ...config,
        updatedAt: Date.now(),
        sponsor: {
          ...config.sponsor,
          ...(target === 'logo' ? { logoUrl: uploaded.url } : { imageUrl: uploaded.url })
        }
      };
      setConfig(updatedConfig);
      saveStoredSponsorMedia({
        logoUrl: target === 'logo' ? uploaded.dataUrl : updatedConfig.sponsor.logoUrl,
        imageUrl: target === 'banner' ? uploaded.dataUrl : updatedConfig.sponsor.imageUrl
      });
      await persistConfig(
        updatedConfig,
        `${target === 'logo' ? 'Sponsor Logo' : 'Sponsor Banner'} upload aur save ho gaya!`
      );
    } catch (err: any) {
      setFeedback({ text: err.message || 'Upload failed', type: 'error' });
    } finally {
      setUploadingAsset(null);
    }
  };

  const handleUploadSlotBanner = async (slotKey: AdSlotKey, file?: File) => {
    if (!file || !isAuthorized) return;
    setUploadingAsset(slotKey);
    setFeedback(null);
    try {
      const uploaded = await uploadImageAsset(
        file,
        'ads',
        `ad_${slotKey}`,
        adminPin,
        slotKey === 'mobileBanner' ? 640 : 960
      );
      const currentSlot = config.slots[slotKey] || EMPTY_SLOT;
      const updatedConfig: MonetizationConfig = {
        ...config,
        adsEnabled: true,
        updatedAt: Date.now(),
        slots: {
          ...config.slots,
          [slotKey]: {
            ...currentSlot,
            enabled: true,
            adSource: 'custom',
            imageUrl: uploaded.url
          }
        }
      };
      setConfig(updatedConfig);
      await persistConfig(updatedConfig, 'Custom Ad Banner upload & publish ho gaya!');
    } catch (err: any) {
      setFeedback({ text: err.message || 'Ad banner upload failed', type: 'error' });
    } finally {
      setUploadingAsset(null);
    }
  };

  const updateSlotField = (slotKey: AdSlotKey, patch: Partial<AdSlotConfig>) => {
    setConfig((prev) => ({
      ...prev,
      slots: {
        ...prev.slots,
        [slotKey]: {
          ...(prev.slots[slotKey] || EMPTY_SLOT),
          ...patch
        }
      }
    }));
  };

  if (!isAuthorized) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
        Loading AdSense &amp; monetization configuration...
      </div>
    );
  }

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

      {/* Top Control Status & Save Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`px-2.5 py-1 rounded-lg font-bold border ${
              !config.adsEnabled
                ? 'bg-slate-800 text-slate-400 border-slate-700'
                : config.adsenseTestMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
            }`}
          >
            Ads: {!config.adsEnabled ? 'OFF' : config.adsenseTestMode ? 'TEST MODE' : 'LIVE ON'}
          </span>
          <span
            className={`px-2.5 py-1 rounded-lg font-mono font-semibold border tabular-nums ${
              pubIdValid
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
          >
            {pubIdValid ? normalizedPubId : 'AdSense ID: Not Set'}
          </span>
          <span className="px-2.5 py-1 rounded-lg font-mono bg-slate-950 text-slate-300 border border-slate-800 tabular-nums">
            AdSense Slots: {slotStatusSummary.adsenseCount}/4
          </span>
          {slotStatusSummary.customCount > 0 && (
            <span className="px-2.5 py-1 rounded-lg font-mono bg-slate-950 text-amber-300 border border-slate-800 tabular-nums">
              Custom Banners: {slotStatusSummary.customCount}/4
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(config.adsenseTestMode)}
            onClick={() =>
              setConfig((prev) => ({ ...prev, adsenseTestMode: !prev.adsenseTestMode }))
            }
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all whitespace-nowrap shrink-0 ${
              config.adsenseTestMode
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-amber-400/50 hover:text-amber-200'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>{config.adsenseTestMode ? 'Test Mode: ON' : 'Test Mode: OFF'}</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              const next = { ...config, adsEnabled: !config.adsEnabled };
              setConfig(next);
              persistConfig(
                next,
                `Master Ads ${next.adsEnabled ? 'ON (Live)' : 'OFF (Hidden)'} kar diya gaya!`
              );
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all whitespace-nowrap shrink-0 disabled:opacity-50 ${
              config.adsEnabled
                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-600/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            {config.adsEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{config.adsEnabled ? 'Ads: ON' : 'Ads: OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => persistConfig(config, 'Google AdSense & Ads settings save ho gayi!')}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg flex items-center gap-1.5 transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save & Publish All'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Google AdSense Account Setup & ads.txt */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                Google AdSense Setup (Website + Mobile App)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Apna AdSense Publisher ID (<code className="text-slate-300">ca-pub-...</code>) ya Google AdSense code paste karein — Auto Ads, Head verification aur <code className="text-slate-300">/ads.txt</code> khud set ho jayega.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowGlobalPaste((prev) => !prev)}
            className="px-3 py-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{showGlobalPaste ? 'Close Code Paste' : 'Paste AdSense <script> Code'}</span>
          </button>
        </div>

        {/* Optional Smart Paste Box for Full AdSense Script/Meta */}
        {showGlobalPaste && (
          <div className="bg-slate-950 border border-sky-500/35 rounded-xl p-4 space-y-2.5">
            <div className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Google AdSense se mila &lt;script&gt; ya &lt;meta&gt; code yahan paste karein:</span>
            </div>
            <textarea
              rows={3}
              value={globalSnippetInput}
              onChange={(e) => setGlobalSnippetInput(e.target.value)}
              placeholder='<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456" crossorigin="anonymous"></script>'
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowGlobalPaste(false);
                  setGlobalSnippetInput('');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExtractGlobalAdSense}
                className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
              >
                Extract Publisher ID
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Publisher ID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-7 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-200">
                1. Google AdSense Publisher ID
              </label>
              {config.adsensePublisherId.trim() && (
                <span
                  className={`text-[11px] font-mono font-semibold flex items-center gap-1 ${
                    pubIdValid ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {pubIdValid ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Valid Publisher ID
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" /> Format: ca-pub-16-digits
                    </>
                  )}
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="ca-pub-1234567890123456"
              value={config.adsensePublisherId}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, adsensePublisherId: e.target.value }))
              }
              onBlur={() =>
                setConfig((prev) => ({
                  ...prev,
                  adsensePublisherId: normalizePublisherId(prev.adsensePublisherId)
                }))
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <p className="text-[11px] text-slate-400">
              AdSense Dashboard → Account → Account information mein Publisher ID (<code className="text-slate-300">pub-...</code> ya <code className="text-slate-300">ca-pub-...</code>) milta hai.
            </p>
          </div>

          {/* Step 2: Live ads.txt Quick Card */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live /ads.txt Verification</span>
              </span>
              <a
                href="/ads.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <span>Open /ads.txt</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-[11px] font-mono text-slate-300 break-all">
              {adsTxtRecord || 'Enter Publisher ID to generate ads.txt line...'}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleCopyAdsTxt}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 border border-slate-700"
              >
                {copiedAdsTxt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedAdsTxt ? 'Copied!' : 'Copy ads.txt'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowExtraAdsTxt((prev) => !prev)}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                <span>Extra lines</span>
                {showExtraAdsTxt ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {showExtraAdsTxt && (
              <textarea
                rows={2}
                placeholder="Optional extra ads.txt lines (one per line)"
                value={config.adsTxtCustomLines || ''}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, adsTxtCustomLines: e.target.value }))
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            )}
          </div>
        </div>

        {/* Step 3: Global AdSense Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={config.adsenseAutoAds !== false}
            onClick={() =>
              setConfig((prev) => ({ ...prev, adsenseAutoAds: !(prev.adsenseAutoAds !== false) }))
            }
            className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 ${
              config.adsenseAutoAds !== false
                ? 'bg-sky-950/30 border-sky-500/45'
                : 'bg-slate-950 border-slate-800'
            }`}
          >
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Auto Ads &amp; Verification</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Site ke &lt;head&gt; mein AdSense meta tag aur Auto Ads script automatic lagata hai.
              </p>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                config.adsenseAutoAds !== false
                  ? 'bg-sky-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {config.adsenseAutoAds !== false ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={Boolean(config.adsenseTestMode)}
            onClick={() =>
              setConfig((prev) => ({ ...prev, adsenseTestMode: !prev.adsenseTestMode }))
            }
            className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 ${
              config.adsenseTestMode
                ? 'bg-amber-950/35 border-amber-400/60'
                : 'bg-slate-950 border-slate-800'
            }`}
          >
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                <span>Test Mode</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Preview aur live slots par amber &quot;Test Ad&quot; label + <code className="text-slate-300">data-adtest=&quot;on&quot;</code> dikhata hai; production ke liye OFF karein.
              </p>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                config.adsenseTestMode
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {config.adsenseTestMode ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={Boolean(config.adsenseHidePlaceholders)}
            onClick={() =>
              setConfig((prev) => ({
                ...prev,
                adsenseHidePlaceholders: !prev.adsenseHidePlaceholders
              }))
            }
            className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 ${
              config.adsenseHidePlaceholders
                ? 'bg-emerald-950/30 border-emerald-500/45'
                : 'bg-slate-950 border-slate-800'
            }`}
          >
            <div>
              <div className="text-xs font-bold text-white">Hide Empty &quot;Ad Space&quot;</div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Khali slots par dashed &quot;Ad Space&quot; box chhupayein (sirf filled ads dikhenge).
              </p>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                config.adsenseHidePlaceholders
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {config.adsenseHidePlaceholders ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* VISUAL PLACEMENT PREVIEW: Dummy Ad Containers */}
      <AdSensePlacementPreview
        config={config}
        selectedSlot={selectedPreviewSlot}
        onSelectSlot={handleSelectPreviewSlot}
        onToggleTestMode={() =>
          setConfig((prev) => ({ ...prev, adsenseTestMode: !prev.adsenseTestMode }))
        }
      />

      {/* SLOT PERFORMANCE & FILL RATE ESTIMATES */}
      <AdSenseSlotStatsPanel
        config={config}
        selectedSlot={selectedPreviewSlot}
        onSelectSlot={handleSelectPreviewSlot}
      />

      {/* SECTION 2: 4 AdSense & Custom Ad Slots */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">
              AdSense Ad Units &amp; Banner Placements (4 Slots)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Har jagah ke liye AdSense ka <code className="text-slate-300">&lt;ins&gt;</code> code paste karein ya Slot ID + Format choose karein. Direct image/link banner bhi laga sakte hain.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SLOT_DESCRIPTIONS.map((meta) => {
            const slot = config.slots[meta.key] || EMPTY_SLOT;
            const isUploadingThis = uploadingAsset === meta.key;
            const effectiveMode = getEffectiveSlotMode(slot, normalizedPubId, config.adsEnabled);
            const hasValidSlot = isValidAdSlotId(slot.slotId);
            const isCustomExpanded =
              openCustomBanner[meta.key] || Boolean(slot.imageUrl || (slot.title && slot.linkUrl));
            const isSelectedCard = selectedPreviewSlot === meta.key;

            const statusBadge =
              effectiveMode === 'adsense'
                ? config.adsenseTestMode
                  ? { label: 'Test Ad', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/45' }
                  : { label: 'AdSense Live', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' }
                : effectiveMode === 'custom_image' || effectiveMode === 'custom_promo'
                ? { label: 'Custom Banner', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' }
                : effectiveMode === 'disabled'
                ? { label: 'Off', cls: 'bg-slate-800 text-slate-400 border-slate-700' }
                : { label: 'Empty', cls: 'bg-slate-800 text-slate-300 border-slate-700' };

            return (
              <div
                key={meta.key}
                ref={(el) => {
                  slotCardRefs.current[meta.key] = el;
                }}
                onClick={() => setSelectedPreviewSlot(meta.key)}
                onFocus={() => setSelectedPreviewSlot(meta.key)}
                className={`bg-slate-950/90 border rounded-xl p-4 space-y-3 transition-all ${
                  isSelectedCard
                    ? 'border-sky-500 ring-1 ring-sky-500/40'
                    : 'border-slate-800'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    {meta.isMobile ? (
                      <Smartphone className={`w-4 h-4 ${meta.accent}`} />
                    ) : (
                      <LayoutTemplate className={`w-4 h-4 ${meta.accent}`} />
                    )}
                    <span>{meta.label}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusBadge.cls}`}>
                      {statusBadge.label}
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slot.enabled}
                        onChange={(e) =>
                          updateSlotField(meta.key, { enabled: e.target.checked })
                        }
                        className="rounded border-slate-700 accent-emerald-500"
                      />
                      <span>Active</span>
                    </label>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  {meta.hint} <span className="text-slate-500">({meta.recommendedFormat})</span>
                </p>

                {/* Ad Source Mode */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-300">Ad Mode:</span>
                  <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                    {(
                      [
                        { id: 'auto', label: 'Auto' },
                        { id: 'adsense', label: 'AdSense' },
                        { id: 'custom', label: 'Custom' }
                      ] as Array<{ id: AdSlotSource; label: string }>
                    ).map((opt) => {
                      const active = (slot.adSource || 'auto') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateSlotField(meta.key, { adSource: opt.id })}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                            active
                              ? 'bg-sky-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* AdSense Slot ID + Format + Paste Snippet */}
                <div className="space-y-2 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-sky-300">Google AdSense Unit</span>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSlotPaste((prev) => ({ ...prev, [meta.key]: !prev[meta.key] }))
                      }
                      className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
                    >
                      <Code2 className="w-3 h-3" />
                      <span>{openSlotPaste[meta.key] ? 'Hide Paste' : 'Paste <ins> Code'}</span>
                    </button>
                  </div>

                  {openSlotPaste[meta.key] && (
                    <div className="bg-slate-900 border border-sky-500/35 rounded-lg p-2.5 space-y-2">
                      <textarea
                        rows={3}
                        value={slotSnippetInput[meta.key]}
                        onChange={(e) =>
                          setSlotSnippetInput((prev) => ({
                            ...prev,
                            [meta.key]: e.target.value
                          }))
                        }
                        placeholder='<ins class="adsbygoogle" data-ad-client="ca-pub-..." data-ad-slot="1234567890" data-ad-format="auto"></ins>'
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-[11px] font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleExtractSlotSnippet(meta.key)}
                          className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold"
                        >
                          Apply Unit Code
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        AdSense Slot ID {hasValidSlot && <span className="text-emerald-400">✓</span>}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1234567890"
                        value={slot.slotId}
                        onChange={(e) =>
                          updateSlotField(meta.key, { slotId: e.target.value.replace(/\s+/g, '') })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        Ad Format
                      </label>
                      <select
                        value={slot.adFormat || (meta.isMobile ? 'horizontal' : 'auto')}
                        onChange={(e) =>
                          updateSlotField(meta.key, { adFormat: e.target.value as AdSlotFormat })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                      >
                        {AD_FORMAT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Custom Image / Promo Fallback Toggle */}
                <div className="pt-1 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenCustomBanner((prev) => ({
                        ...prev,
                        [meta.key]: !isCustomExpanded
                      }))
                    }
                    className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-400 hover:text-slate-200 py-0.5"
                  >
                    <span>Custom Banner / Direct Link (Optional)</span>
                    {isCustomExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {isCustomExpanded && (
                    <div className="mt-2.5 space-y-2.5">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-semibold text-slate-400">
                          Custom Banner Image (Upload ya URL)
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="url"
                            placeholder="https://example.com/ad-banner.png"
                            value={slot.imageUrl || ''}
                            onChange={(e) =>
                              updateSlotField(meta.key, { imageUrl: e.target.value })
                            }
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                          <label className="cursor-pointer px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1 shrink-0">
                            <Upload className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{isUploadingThis ? '...' : 'Upload'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingAsset !== null}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadSlotBanner(meta.key, f);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          {slot.imageUrl && (
                            <button
                              type="button"
                              onClick={() => updateSlotField(meta.key, { imageUrl: '' })}
                              title="Remove image"
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-slate-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {slot.imageUrl && (
                        <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-900 h-14 flex items-center justify-center">
                          <img
                            src={slot.imageUrl}
                            alt={`${meta.label} Preview`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                            Promo Title (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Join Live Offer"
                            value={slot.title || ''}
                            onChange={(e) =>
                              updateSlotField(meta.key, { title: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                            Ad Click Destination URL
                          </label>
                          <input
                            type="url"
                            placeholder="https://your-offer-link.com"
                            value={slot.linkUrl || ''}
                            onChange={(e) =>
                              updateSlotField(meta.key, { linkUrl: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sponsor Banner Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                Custom Sponsor Banner (Website + Mobile App)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Promote a direct sponsor with their logo, banner image, and clickable destination link across Web &amp; Mobile App.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              const next = {
                ...config,
                sponsor: { ...config.sponsor, enabled: !config.sponsor.enabled }
              };
              setConfig(next);
              persistConfig(
                next,
                `Sponsor Banner ${next.sponsor.enabled ? 'ON (Live)' : 'OFF'} ho gaya!`
              );
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all shrink-0 disabled:opacity-50 ${
              config.sponsor.enabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            {config.sponsor.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span>{config.sponsor.enabled ? 'Sponsor Banner: ON' : 'Sponsor Banner: OFF'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Sponsor Name</label>
            <input
              type="text"
              placeholder="e.g. Acme Sports Network"
              value={config.sponsor.name}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  sponsor: { ...prev.sponsor, name: e.target.value }
                }))
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Sponsor Tagline</label>
            <input
              type="text"
              placeholder="e.g. Official Match Day Partner"
              value={config.sponsor.tagline}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  sponsor: { ...prev.sponsor, tagline: e.target.value }
                }))
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Sponsor Logo (Upload ya URL)</label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://example.com/logo.png"
                value={config.sponsor.logoUrl}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    sponsor: { ...prev.sponsor, logoUrl: e.target.value }
                  }))
                }
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <label className="cursor-pointer px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 flex items-center gap-1.5 shrink-0">
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>{uploadingAsset === 'sponsor_logo' ? '...' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingAsset !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadSponsorAsset('logo', f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Sponsor Banner Image (Upload ya URL)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://example.com/banner-728x90.jpg"
                value={config.sponsor.imageUrl}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    sponsor: { ...prev.sponsor, imageUrl: e.target.value }
                  }))
                }
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <label className="cursor-pointer px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 flex items-center gap-1.5 shrink-0">
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>{uploadingAsset === 'sponsor_banner' ? '...' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingAsset !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadSponsorAsset('banner', f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>Sponsor Click Destination Link URL</span>
            </label>
            <input
              type="url"
              placeholder="https://sponsor-website.com"
              value={config.sponsor.linkUrl}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  sponsor: { ...prev.sponsor, linkUrl: e.target.value }
                }))
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {(config.sponsor.logoUrl || config.sponsor.imageUrl) && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="text-[11px] font-mono text-slate-400 uppercase">Asset Preview</div>
            <div className="flex flex-wrap items-center gap-4">
              {config.sponsor.logoUrl && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Logo:</span>
                  <img
                    src={config.sponsor.logoUrl}
                    alt="Sponsor Logo Preview"
                    className="h-10 w-10 rounded-lg object-contain bg-white p-1 border border-slate-700"
                  />
                </div>
              )}
              {config.sponsor.imageUrl && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Banner:</span>
                  <img
                    src={config.sponsor.imageUrl}
                    alt="Sponsor Banner Preview"
                    className="h-12 max-w-xs rounded-lg object-cover border border-slate-700"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Site & Legal Info (Required for AdSense Approval: Privacy Policy & Contact page) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">
              Legal &amp; Contact Details (AdSense Approval: Privacy Policy / Contact)
            </h3>
            <p className="text-xs text-slate-400">
              Displayed on the public Privacy Policy, Terms, Contact pages, and Mobile App Info tab.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Site / Brand Name</label>
            <input
              type="text"
              value={config.siteName}
              onChange={(e) => setConfig((prev) => ({ ...prev, siteName: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Contact Email</label>
            <input
              type="email"
              value={config.contactEmail}
              onChange={(e) => setConfig((prev) => ({ ...prev, contactEmail: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 font-mono text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => persistConfig(config, 'Google AdSense & Monetization settings save ho gayi!')}
          disabled={isSaving}
          className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving Settings...' : 'Save AdSense & Ads Settings'}</span>
        </button>
      </div>
    </div>
  );
};
