'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import { workspaceRequest } from '@/lib/workspace-client';
import { Feedback, useFeedback } from './shared';
import type { Actor } from '@/types/workspace';
export function AdminUsers({
  users,
  restricted = false,
}: {
  users: Actor[];
  restricted?: boolean;
}) {
  const t = useTranslations('Workspace');
  const router = useRouter();
  const [selected, setSelected] = useState<Actor | null | undefined>();
  const f = useFeedback();
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h1>{t('users')}</h1>
          <p>{t(restricted ? 'publicUsersNote' : 'usersNote')}</p>
        </div>
        {!restricted && (
          <button className="primary-button" onClick={() => setSelected(null)}>
            {t('createUser')} +
          </button>
        )}
      </div>
      {selected !== undefined && (
        <form
          key={selected?.id || 'new'}
          className="panel workspace-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            f.setBusy(true);
            f.setError('');
            try {
              const values = { name: data.get('name'), role: data.get('role') };
              await workspaceRequest(
                selected
                  ? {
                      action: 'user',
                      id: selected.id,
                      ...values,
                      phone: data.get('phone'),
                      active: data.get('active') === 'on',
                    }
                  : {
                      action: 'createUser',
                      ...values,
                      email: data.get('email'),
                      password: data.get('password'),
                    },
              );
              setSelected(undefined);
              router.refresh();
            } catch (e) {
              f.setError((e as Error).message);
            } finally {
              f.setBusy(false);
            }
          }}
        >
          <h2>{t(selected ? 'editUser' : 'createUser')}</h2>
          <div className="form-grid">
            <label>
              {t('name')}
              <input
                name="name"
                defaultValue={selected?.name}
                required
                minLength={2}
                maxLength={100}
              />
            </label>
            <label>
              {t('role')}
              <select name="role" defaultValue={selected?.role || 'BUYER'}>
                {(restricted ? ['BUYER'] : ['BUYER', 'SELLER', 'ADMIN']).map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            {selected ? (
              <>
                <label>
                  {t('phone')}
                  <input name="phone" type="tel" defaultValue={selected.phone} maxLength={30} />
                </label>
                <label className="check-label">
                  <input type="checkbox" name="active" defaultChecked={Boolean(selected.active)} />
                  {t('accountActive')}
                </label>
              </>
            ) : (
              <>
                <label>
                  {t('email')}
                  <input name="email" type="email" required autoComplete="off" />
                </label>
                <label>
                  {t('initialPassword')}
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
              </>
            )}
          </div>
          <Feedback error={f.error} />
          <div className="form-actions">
            <button disabled={f.busy} className="primary-button">
              {t('save')}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelected(undefined)}
            >
              {t('close')}
            </button>
          </div>
        </form>
      )}
      <div className="table-scroll responsive-table-wrap">
        <table className="workspace-table responsive-table user-admin-table" role="table">
          <thead>
            <tr>
              <th>{t('name')}</th>
              <th>{t('email')}</th>
              <th>{t('role')}</th>
              <th>{t('status')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td data-label={t('name')}>{u.name}</td>
                <td data-label={t('email')}>{u.email}</td>
                <td data-label={t('role')}>{t(`roles.${u.role}`)}</td>
                <td data-label={t('status')}>{t(u.active ? 'active' : 'blocked')}</td>
                <td data-label={t('actions')}>
                  {(!restricted || u.role === 'BUYER') && (
                    <button className="text-link" onClick={() => setSelected(u)}>
                      {t('edit')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
