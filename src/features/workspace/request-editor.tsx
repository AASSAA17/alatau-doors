'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import { formatPrice, formatDate } from '@/lib/utils';
import { workspaceRequest } from '@/lib/workspace-client';
import { LineEditor } from './line-editor';
import { Feedback, useFeedback } from './shared';
import type {
  Actor,
  AdminProduct,
  LineInput,
  RequestDetail,
  StoreSettings,
} from '@/types/workspace';
export function RequestEditor({
  actor,
  detail,
  products,
  settings,
  sellers,
}: {
  actor: Actor;
  detail: RequestDetail;
  products: AdminProduct[];
  settings: StoreSettings;
  sellers: Pick<Actor, 'id' | 'name'>[];
}) {
  const t = useTranslations('Workspace');
  const locale = useLocale();
  const router = useRouter();
  const f = useFeedback();
  const [lines, setLines] = useState<LineInput[]>(detail.items);
  const [comment, setComment] = useState('');
  const staff = actor.role !== 'BUYER';
  const closed = ['COMPLETED', 'CANCELLED'].includes(detail.status);
  const date = (at: string) => formatDate(at, locale, true);
  async function act(action: string, extra: Record<string, unknown> = {}) {
    f.setBusy(true);
    f.setError('');
    f.setSuccess('');
    try {
      await workspaceRequest({
        action,
        requestId: detail.id,
        ...(action === 'comment' ? {} : { revision: detail.revision }),
        ...extra,
      });
      f.setSuccess(t('saved'));
      setComment('');
      router.refresh();
    } catch (e) {
      f.setError((e as Error).message);
    } finally {
      f.setBusy(false);
    }
  }
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">
            {t('requestNumber')} #{String(detail.number).padStart(4, '0')}
          </p>
          <h1>{t('requestDetail')}</h1>
        </div>
        <span className={`status-badge status-${detail.status}`}>
          {t(`statuses.${detail.status}`)}
        </span>
      </div>
      <Feedback error={f.error} success={f.success} />
      <div className="request-overview panel">
        <div>
          <h2>{t('buyer')}</h2>
          <p>{detail.buyer.name}</p>
          <p>{detail.buyer.email}</p>
          <p>{detail.buyer.phone || t('phoneMissing')}</p>
        </div>
        <div>
          <h2>{t('seller')}</h2>
          <p>{detail.sellerName || t('notAssigned')}</p>
          <small>
            {t('createdAt')}: {date(detail.createdAt)}
          </small>
        </div>
      </div>
      {detail.note && (
        <div className="panel">
          <h2>{t('requestNote')}</h2>
          <p className="preserve-lines">{detail.note}</p>
        </div>
      )}
      {actor.role === 'ADMIN' && !closed && (
        <form
          className="panel workspace-form"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void act('assign', { sellerId: data.get('sellerId') });
          }}
        >
          <h2>{t('assignment')}</h2>
          <label>
            {t('seller')}
            <select name="sellerId" defaultValue={detail.sellerId || ''} required>
              <option value="" disabled>
                {t('chooseSeller')}
              </option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" disabled={f.busy}>
            {t('assign')}
          </button>
        </form>
      )}
      <section className="panel">
        <h2>{t('positions')}</h2>
        {staff && !closed ? (
          <>
            <LineEditor
              lines={lines}
              onChange={setLines}
              products={products}
              settings={settings}
              disabled={f.busy}
            />
            <div className="form-actions">
              <button
                className="secondary-button"
                disabled={f.busy || !lines.length || detail.status === 'NEW'}
                onClick={() => void act('items', { lines })}
              >
                {t('savePositions')}
              </button>
              <button
                className="primary-button"
                disabled={
                  f.busy ||
                  detail.status !== 'IN_PROGRESS' ||
                  JSON.stringify(lines) !== JSON.stringify(detail.items)
                }
                onClick={() => void act('quote')}
              >
                {t('publishQuote')}
              </button>
            </div>
            <p className="workspace-note">{t('saveBeforeQuote')}</p>
          </>
        ) : (
          <ul className="request-positions">
            {detail.items.map((line, i) => {
              const product = products.find((p) => p.variants.some((v) => v.id === line.variantId));
              const variant = product?.variants.find((v) => v.id === line.variantId);
              return (
                <li key={i}>
                  <strong>
                    {product?.name || t('archived')} · {variant?.width} × {variant?.height}
                  </strong>
                  <span>
                    {t('quantity')}: {line.quantity}
                  </span>
                  <span>
                    {(['frame', 'hardware', 'installation'] as const)
                      .filter((k) => line[k])
                      .map((k) => t(k))
                      .join(', ') || t('leafOnly')}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="panel quote-panel">
        <h2>{t('quotes')}</h2>
        <p className="workspace-note">{t('snapshotNote')}</p>
        {detail.quotes.length ? (
          detail.quotes.map((q) => (
            <details key={q.id} open={q.version === detail.quotes[0].version}>
              <summary>
                {t('quoteVersion')} {q.version} · {formatPrice(q.total, locale)}
              </summary>
              <p>
                {q.authorName} · {date(q.createdAt)}
              </p>
              <div className="table-scroll responsive-table-wrap">
                <table className="workspace-table responsive-table quote-table" role="table">
                  <thead>
                    <tr>
                      <th>{t('position')}</th>
                      <th>{t('configuration')}</th>
                      <th>{t('quantity')}</th>
                      <th>{t('unitPrice')}</th>
                      <th>{t('total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.lines.map((l, i) => (
                      <tr key={i}>
                        <td data-label={t('position')}>
                          {l.name}
                          <small>
                            {l.sku} · {l.width} × {l.height}
                          </small>
                        </td>
                        <td data-label={t('configuration')}>
                          <small>
                            {t('leafOnly')}: {formatPrice(l.basePrice, locale)}
                            {l.frame && (
                              <>
                                <br />
                                {t('frame')}: {formatPrice(l.framePrice, locale)}
                              </>
                            )}
                            {l.hardware && (
                              <>
                                <br />
                                {t('hardware')}: {formatPrice(l.hardwarePrice, locale)}
                              </>
                            )}
                            {l.installation && (
                              <>
                                <br />
                                {t('installation')}: {formatPrice(l.installationPrice, locale)}
                              </>
                            )}
                          </small>
                        </td>
                        <td data-label={t('quantity')}>{l.quantity}</td>
                        <td data-label={t('unitPrice')}>{formatPrice(l.unitPrice, locale)}</td>
                        <td data-label={t('total')}>{formatPrice(l.total, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="quote-total" data-testid="saved-quote-total">
                {t('total')}: <strong>{formatPrice(q.total, locale)}</strong>
              </p>
            </details>
          ))
        ) : (
          <p>{t('quotePending')}</p>
        )}
      </section>
      {!closed && (
        <section className="panel">
          <h2>{t('actions')}</h2>
          <div className="form-actions">
            {staff && detail.status === 'QUOTED' && (
              <>
                <button
                  className="primary-button"
                  disabled={f.busy}
                  onClick={() => void act('status', { status: 'COMPLETED' })}
                >
                  {t('completeRequest')}
                </button>
                <button
                  className="secondary-button"
                  disabled={f.busy}
                  onClick={() => void act('status', { status: 'IN_PROGRESS' })}
                >
                  {t('reviseQuote')}
                </button>
              </>
            )}
            <button
              className="danger-button"
              disabled={f.busy}
              onClick={() => {
                if (window.confirm(t('cancelConfirm'))) void act('status', { status: 'CANCELLED' });
              }}
            >
              {t('cancelRequest')}
            </button>
          </div>
          <p className="workspace-note">{t('workflowNote')}</p>
        </section>
      )}
      <section className="panel">
        <h2>{t('publicHistory')}</h2>
        <ol className="history-list">
          {detail.events.map((e) => (
            <li key={e.id}>
              <span className="history-dot" />
              <div>
                <strong>
                  {t(`events.${e.kind}`)} · {t(`statuses.${e.status}`)}
                </strong>
                <p>
                  {e.authorName} · {date(e.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      {staff && (
        <section className="panel internal-comments">
          <h2>{t('internalComments')}</h2>
          <p className="workspace-note">{t('internalNote')}</p>
          {detail.comments?.map((c) => (
            <article key={c.id}>
              <p className="preserve-lines">{c.text}</p>
              <small>
                {c.authorName} · {date(c.createdAt)}
              </small>
            </article>
          ))}
          {!closed && (
            <form
              className="workspace-form"
              onSubmit={(e) => {
                e.preventDefault();
                void act('comment', { text: comment });
              }}
            >
              <label>
                {t('comment')}
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                  maxLength={3000}
                />
              </label>
              <button className="secondary-button" disabled={f.busy || !comment.trim()}>
                {t('addComment')}
              </button>
            </form>
          )}
        </section>
      )}
    </>
  );
}
