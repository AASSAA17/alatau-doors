import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import { listRequests } from '@/lib/server/workspace';
import { WorkspaceShell } from './shell';
import type { Actor } from '@/types/workspace';
import { formatDate } from '@/lib/utils';
import { listGuests } from '@/lib/server/guest-inquiries';
import { getDb } from '@/lib/server/db';
import { GuestInbox } from './guest-inbox';
export async function Dashboard({ actor, locale }: {
    actor: Actor;
    locale: string;
}) {
    const t = await getTranslations('Workspace');
    const requests = (await listRequests(actor));
    const guests = actor.role === 'BUYER' ? [] : await listGuests(actor);
    const sellers = actor.role === 'ADMIN' ? await getDb().prepare("SELECT id,name FROM user WHERE role='SELLER' AND active=1 ORDER BY name").all() as { id: string; name: string }[] : [];
    return (<WorkspaceShell actor={actor}>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">{t(`roles.${actor.role}`)}</p>
          <h1>{t('requests')}</h1>
          <p>
            {t(actor.role === 'SELLER'
            ? 'assignedOnly'
            : actor.role === 'BUYER'
                ? 'ownOnly'
                : 'allRequests')}
          </p>
        </div>
        {actor.role === 'BUYER' && (<Link className="primary-button" href="/selection">
            {t('newRequest')} +
          </Link>)}
      </div>
      <section className="workflow-explanation" aria-label={t('workflowTitle')}><p>{t('workflowTitle')}</p><ol className="workflow-sequence">
        {['NEW', 'IN_PROGRESS', 'QUOTED', 'COMPLETED'].map((s, i) => (<li key={s}>
            {i + 1}. {t(`statuses.${s}`)}
          </li>))}
      </ol><p className="workspace-note">{t('cancellationOutcome')}</p></section>
      <p className="workspace-note">{t('workflowNote')}</p>
      {requests.length ? (<div className="table-scroll responsive-table-wrap">
          <table className="workspace-table responsive-table request-list-table" role="table">
            <thead>
              <tr>
                <th>{t('requestNumber')}</th>
                {actor.role !== 'BUYER' && <th>{t('buyer')}</th>}
                <th>{t('status')}</th>
                <th>{t('seller')}</th>
                <th>{t('updatedAt')}</th>
                <th>
                  <span className="sr-only">{t('open')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (<tr key={r.id}>
                  <td data-label={t('requestNumber')}>
                    <Link href={`/requests/${r.id}`}>#{String(r.number).padStart(4, '0')}</Link>
                  </td>
                  {actor.role !== 'BUYER' && <td data-label={t('buyer')}>{r.buyerName}</td>}
                  <td data-label={t('status')}>
                    <span className={`status-badge status-${r.status}`}>
                      {t(`statuses.${r.status}`)}
                    </span>
                  </td>
                  <td data-label={t('seller')}>{r.sellerName || t('notAssigned')}</td>
                  <td data-label={t('updatedAt')}>
                    {formatDate(r.updatedAt, locale)}
                  </td>
                  <td data-label={t('actions')}>
                    <Link href={`/requests/${r.id}`} className="text-link">
                      {t('open')} ↗
                    </Link>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>) : (<div className="workspace-empty">{t('noRequests')}</div>)}
      {actor.role !== 'BUYER' && <GuestInbox items={guests} sellers={sellers} admin={actor.role === 'ADMIN'}/>}
    </WorkspaceShell>);
}
