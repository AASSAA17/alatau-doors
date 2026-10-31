'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import { formatPrice, formatDate } from '@/lib/utils';
import { workspaceRequest } from '@/lib/workspace-client';
import type { Actor, RequestDetail } from '@/types/workspace';
import { Feedback, useFeedback } from './shared';

export function DemoPayment({actor, detail}: {actor:Actor; detail:RequestDetail}) {
  const t = useTranslations('DemoPayment'), locale = useLocale(), router = useRouter();
  const f = useFeedback();
  const [confirmed, setConfirmed] = useState(false);
  const quote = detail.quotes[0];
  const receipt = detail.payments.find(payment => payment.quoteId === quote?.id);
  if (!detail.demoPaymentsEnabled && !detail.payments.length) return null;
  const available = detail.demoPaymentsEnabled && actor.role === 'BUYER' && detail.status === 'QUOTED' && quote && !receipt;
  return <section className="panel" aria-labelledby="demo-payment-heading" data-testid="demo-payment">
    <h2 id="demo-payment-heading">{t('title')}</h2>
    <p className="workspace-note">{t('note')}</p>
    <p role="status"><strong>{t(receipt ? 'paid' : quote ? 'unpaid' : 'waiting')}</strong></p>
    {quote && <p>{t('quote', {version:quote.version})}: <strong>{formatPrice(quote.total, locale)}</strong></p>}
    {receipt && <p>{t('receiptDate')}: {formatDate(receipt.createdAt, locale, true)}<br/><small>{t('locked')}</small></p>}
    {detail.status === 'CANCELLED' && receipt && <p>{t('cancelled')}</p>}
    {available && <form className="workspace-form" onSubmit={async event => {
      event.preventDefault(); f.setBusy(true); f.setError('');
      try {
        await workspaceRequest({action:'demoPay', requestId:detail.id, quoteId:quote.id, revision:detail.revision, confirm:true});
        setConfirmed(false); router.refresh();
      } catch (error) { f.setError((error as Error).message); }
      finally { f.setBusy(false); }
    }}>
      <label className="demo-payment-confirm"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/><span>{t('confirm')}</span></label>
      <button className="primary-button" disabled={f.busy || !confirmed}>{t(f.busy ? 'processing' : 'pay')}</button>
    </form>}
    <Feedback error={f.error}/>
    <p className="workspace-note">{t('workflow')}</p>
  </section>;
}
