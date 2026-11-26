import React, { useEffect, useRef, useState } from 'react';
import { AdSlotConfig } from '../../types/cricket';
import { ExternalLink } from 'lucide-react';
import { getEffectiveSlotMode, normalizePublisherId } from '../../utils/adsense';

interface AdSlotProps {
  placement: 'top' | 'in-content' | 'footer' | 'mobile';
  adsEnabled: boolean;
  publisherId?: string;
  slotConfig?: AdSlotConfig;
  compact?: boolean;
  adTestMode?: boolean;
  hidePlaceholder?: boolean;
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

const PLACEMENT_META = {
  top: {
    label: 'Top Banner',
    dimensions: '728×90 / 320×50',
    wrapperClass: 'w-full max-w-4xl mx-auto',
    boxClass: 'h-14 sm:h-[72px]'
  },
  'in-content': {
    label: 'In-Content Ad',
    dimensions: 'Responsive Display',
    wrapperClass: 'w-full max-w-4xl mx-auto',
    boxClass: 'min-h-[84px] sm:min-h-[100px]'
  },
  footer: {
    label: 'Footer Banner',
    dimensions: '728×90 / 320×50',
    wrapperClass: 'w-full max-w-4xl mx-auto',
    boxClass: 'min-h-[68px] sm:min-h-[90px]'
  },
  mobile: {
    label: 'Mobile App Ad',
    dimensions: '320×50 Mobile',
    wrapperClass: 'w-full mx-auto',
    boxClass: 'h-12'
  }
} as const;

let injectedPublisherId: string | null = null;

export function ensureAdSenseScript(publisherId: string) {
  if (typeof document === 'undefined' || !publisherId) return;
  const cleanId = normalizePublisherId(publisherId);
  if (!/^ca-pub-\d{10,20}$/.test(cleanId)) return;

  const existing = document.querySelector<HTMLScriptElement>(
    'script[data-adsense-script="true"]'
  );
  if (existing && injectedPublisherId === cleanId) {
    return;
  }
  if (existing) {
    existing.remove();
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cleanId)}`;
  script.crossOrigin = 'anonymous';
  script.setAttribute('data-adsense-script', 'true');
  document.head.appendChild(script);
  injectedPublisherId = cleanId;
}

export function syncAdSenseHeadTags(options: {
  publisherId?: string;
  allowPublicAds: boolean;
  loadScript: boolean;
}) {
  if (typeof document === 'undefined') return;
  const cleanId = normalizePublisherId(options.publisherId || '');
  const hasValidPub = /^ca-pub-\d{10,20}$/.test(cleanId);

  const existingMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="google-adsense-account"][data-adsense-meta="true"]'
  );
  if (!options.allowPublicAds || !hasValidPub) {
    existingMeta?.remove();
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-adsense-script="true"]'
    );
    if (existingScript) {
      existingScript.remove();
      injectedPublisherId = null;
    }
    return;
  }

  if (existingMeta) {
    if (existingMeta.content !== cleanId) {
      existingMeta.content = cleanId;
    }
  } else {
    const meta = document.createElement('meta');
    meta.name = 'google-adsense-account';
    meta.content = cleanId;
    meta.setAttribute('data-adsense-meta', 'true');
    document.head.appendChild(meta);
  }

  if (options.loadScript) {
    ensureAdSenseScript(cleanId);
  } else {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-adsense-script="true"]'
    );
    if (existingScript) {
      existingScript.remove();
      injectedPublisherId = null;
    }
  }
}

export const AdSlot: React.FC<AdSlotProps> = ({
  placement,
  adsEnabled,
  publisherId = '',
  slotConfig,
  compact = false,
  adTestMode = false,
  hidePlaceholder = false
}) => {
  const insRef = useRef<HTMLModElement | null>(null);
  const pushedKeyRef = useRef<string>('');
  const [imgError, setImgError] = useState(false);

  const customImageUrl = (slotConfig?.imageUrl || '').trim();
  const customLinkUrl = (slotConfig?.linkUrl || '').trim();
  const customTitle = (slotConfig?.title || '').trim();

  useEffect(() => {
    setImgError(false);
  }, [customImageUrl]);

  const effectiveSlotConfig = imgError && slotConfig
    ? { ...slotConfig, imageUrl: '' }
    : slotConfig;

  const cleanPubId = normalizePublisherId(publisherId);
  const cleanSlotId = (slotConfig?.slotId || '').trim();
  const adFormat = slotConfig?.adFormat || (placement === 'mobile' ? 'horizontal' : 'auto');
  const slotMode = getEffectiveSlotMode(effectiveSlotConfig, cleanPubId, adsEnabled);
  const isLiveAdSenseConfigured = slotMode === 'adsense';

  useEffect(() => {
    if (!isLiveAdSenseConfigured) return;

    ensureAdSenseScript(cleanPubId);

    const pushKey = `${cleanPubId}:${cleanSlotId}:${placement}:${adFormat}:${adTestMode ? 'test' : 'live'}`;
    if (pushedKeyRef.current === pushKey) return;
    if (insRef.current?.getAttribute('data-adsbygoogle-status')) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedKeyRef.current = pushKey;
    } catch (err) {
      console.debug('AdSense slot push skipped:', err);
    }
  }, [isLiveAdSenseConfigured, cleanPubId, cleanSlotId, placement, adFormat, adTestMode]);

  if (slotMode === 'disabled') {
    return null;
  }

  const meta = PLACEMENT_META[placement];
  const effectiveBoxClass = compact ? 'h-12' : meta.boxClass;

  // 1. Custom Uploaded / Linked Banner Ad
  if (slotMode === 'custom_image' && customImageUrl) {
    const inner = (
      <div
        className={`relative w-full ${
          compact ? 'h-12' : placement === 'in-content' ? 'min-h-[84px] max-h-36' : 'h-16 sm:h-24'
        } rounded-xl overflow-hidden border border-amber-400/35 bg-slate-950 shadow-lg group`}
      >
        <img
          src={customImageUrl}
          alt={customTitle || `${meta.label} Advertisement`}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
        <span className="absolute top-1 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-amber-300 border border-amber-400/30 text-[9px] font-score font-bold uppercase tracking-wider">
          AD
        </span>
        {customTitle && (
          <div className="absolute inset-x-0 bottom-0 px-2.5 py-1 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-white truncate">{customTitle}</span>
            {customLinkUrl && <ExternalLink className="w-3 h-3 text-amber-300 shrink-0" />}
          </div>
        )}
      </div>
    );

    return (
      <div className={meta.wrapperClass} aria-label={`Sponsored Ad - ${meta.label}`}>
        {customLinkUrl ? (
          <a
            href={customLinkUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="block w-full focus:outline-none"
          >
            {inner}
          </a>
        ) : (
          inner
        )}
      </div>
    );
  }

  // 2. Custom Text Promo Ad
  if (slotMode === 'custom_promo' && customTitle && customLinkUrl) {
    return (
      <a
        href={customLinkUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={`${meta.wrapperClass} block focus:outline-none`}
        aria-label={`Sponsored Promo - ${customTitle}`}
      >
        <div
          className={`${effectiveBoxClass} w-full rounded-xl border border-amber-400/70 dark:border-amber-400/40 bg-gradient-to-r from-amber-50 via-white to-sky-50 dark:from-amber-500/15 dark:via-slate-900/95 dark:to-sky-500/15 px-3 py-1.5 flex items-center justify-between gap-2.5 shadow-sm dark:shadow-md hover:border-amber-500 dark:hover:border-amber-400/70 transition-colors`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/40 text-[9px] font-score font-bold uppercase shrink-0">
              AD
            </span>
            <span className="text-xs font-bold text-slate-950 dark:text-white truncate">{customTitle}</span>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider shrink-0">
            <span>Open</span>
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </a>
    );
  }

  // 3. Google AdSense Unit
  if (isLiveAdSenseConfigured) {
    const insKey = `${cleanPubId}_${cleanSlotId}_${adFormat}_${adTestMode ? 'test' : 'live'}`;
    const responsiveFlag = adFormat === 'auto' || adFormat === 'horizontal' ? 'true' : 'false';

    return (
      <div
        className={`${meta.wrapperClass} overflow-hidden rounded-xl border ${
          adTestMode
            ? 'border-dashed border-amber-500/80 bg-amber-50/85 dark:border-amber-400/75 dark:bg-amber-950/25'
            : 'border-slate-300 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/50'
        }`}
        aria-label={`${adTestMode ? 'Test Ad' : 'Advertisement'} - ${meta.label}`}
      >
        {(!compact || adTestMode) && (
          <div
            className={`text-[9px] font-mono uppercase tracking-widest text-center py-0.5 border-b flex items-center justify-center gap-1.5 ${
              adTestMode
                ? 'bg-amber-100/90 text-amber-900 border-amber-300 dark:bg-amber-950/75 dark:text-amber-300 dark:border-amber-500/40 font-bold'
                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-950/60 dark:text-slate-500 dark:border-slate-800/50'
            }`}
          >
            {adTestMode ? (
              <>
                <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black">
                  Test Ad
                </span>
                <span>Verification Mode (data-adtest)</span>
              </>
            ) : (
              <span>Advertisement</span>
            )}
          </div>
        )}
        <div className={`w-full flex items-center justify-center ${effectiveBoxClass}`}>
          <ins
            key={insKey}
            ref={insRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%' }}
            data-ad-client={cleanPubId}
            data-ad-slot={cleanSlotId}
            data-ad-format={adFormat}
            data-full-width-responsive={responsiveFlag}
            {...(adTestMode ? { 'data-adtest': 'on' } : {})}
          />
        </div>
      </div>
    );
  }

  if (hidePlaceholder) {
    return null;
  }

  // 4. Placeholder box clearly labeled "Ad Space"
  return (
    <div
      className={meta.wrapperClass}
      aria-label={`Ad Space - ${meta.label}`}
    >
      <div
        className={`${effectiveBoxClass} w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/60 px-3 py-1.5 flex items-center justify-between gap-2.5 transition-colors`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-[9px] font-mono font-bold uppercase tracking-wider shrink-0">
            AD
          </span>
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-300 tracking-wide truncate">
              Ad Space
            </span>
            {!compact && (
              <span className="text-[10px] font-mono text-slate-600 dark:text-slate-500 truncate">
                {meta.label}
              </span>
            )}
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-950/70 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-800/80 shrink-0">
          {meta.dimensions}
        </span>
      </div>
    </div>
  );
};
