'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { previewSelection } from '@/lib/pricing';
import { formatPrice } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';
import type { AdminProduct, LineInput, StoreSettings } from '@/types/workspace';

export function WhatsAppPreview({lines, products, settings}: {lines: LineInput[]; products: AdminProduct[]; settings: StoreSettings}) {
  const t = useTranslations('Preview');
  const w = useTranslations('Workspace');
  const locale = useLocale();
  const [feedback, setFeedback] = useState<{text:string; ok:boolean} | null>(null);
  const result = previewSelection(lines, products, settings);
  const text = [t('demo'), ...result.items.map((item, i) => {
    if (!item) return `${i+1}. ${t('unavailable')}`;
    const options = (['frame','hardware','installation'] as const).filter(key => item[key]).map(key => w(key));
    return `${i+1}. ${item.name} · ${item.width} × ${item.height} ${t('mm')}\n${w('quantity')}: ${item.quantity}\n${w('configuration')}: ${[t('leaf'),...options].join(', ')}\n${w('unitPrice')}: ${formatPrice(item.unitPrice,locale)} · ${w('total')}: ${formatPrice(item.total,locale)}`;
  }), `${w('previewTotal')}: ${result.total === null ? t('unavailable') : formatPrice(result.total,locale)}`, t('status')].join('\n\n');
  return <section className="message-preview" aria-labelledby="preview-title">
    <h2 id="preview-title">{t('title')}</h2><p>{t('intro')}</p>
    {!lines.length ? <p>{t('empty')} <Link href="/door-finder" className="text-link">{t('choose')} ↗</Link></p> : <>
      <label>{t('message')}<textarea data-testid="whatsapp-message" readOnly value={text} rows={12} onFocus={e=>e.currentTarget.select()} /></label>
      <button type="button" className="secondary-button" onClick={async()=>{
        try { await navigator.clipboard.writeText(text); setFeedback({text,ok:true}); }
        catch { setFeedback({text,ok:false}); }
      }}>{t('copy')}</button>
      <p role="status" aria-live="polite">{feedback?.text === text ? t(feedback.ok ? 'copied' : 'manual') : t('manualHint')}</p>
    </>}
  </section>;
}
