'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import type { GuestInquiry } from '@/lib/server/guest-inquiries';
export function GuestInbox({ items, sellers, admin }: { items: GuestInquiry[]; sellers: { id: string; name: string }[]; admin: boolean }) {
  const t = useTranslations('Guest'), w = useTranslations('Workspace'), router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <section className="guest-inbox"><h2>{t('inbox')}</h2><p className="workspace-note">{t('inboxNote')}</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    {!items.length && <p>{t('empty')}</p>}
    {items.map((item) => <article className="workspace-panel" key={item.id}>
      <h3>{item.name}</h3><p>{item.contact}</p><p className="guest-message">{item.note}</p>
      <small>{item.createdAt.slice(0, 10)} · {item.id.slice(0, 8)}</small>
      <form className="workspace-form" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setError('');
        const data = new FormData(event.currentTarget);
        try {
          const response = await fetch('/api/guest', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, revision: item.revision,
            status: data.get('status'), sellerId: admin ? data.get('sellerId') || null : item.sellerId }) });
          if (!response.ok) setError(t(response.status === 409 ? 'conflict' : 'failed'));
          router.refresh();
        } catch { setError(t('failed')); } finally { setBusy(false); }
      }}>
        {admin && <label>{w('seller')}<select name="sellerId" defaultValue={item.sellerId || ''} key={item.id + item.revision + 'seller'}>
          <option value="">{w('notAssigned')}</option>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
        </select></label>}
        <label>{w('status')}<select name="status" defaultValue={item.status} key={item.id + item.revision}>
          {['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((status) => <option key={status} value={status}>{w('statuses.' + status)}</option>)}
        </select></label>
        <button className="secondary-button" disabled={busy}>{t('save')}</button>
      </form>
    </article>)}
  </section>;
}
