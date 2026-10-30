'use client';
import { useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { workspaceRequest } from '@/lib/workspace-client';
import { Feedback, useFeedback } from './shared';
import { LineEditor } from './line-editor';
import { WhatsAppPreview } from './whatsapp-preview';
import { guestDraftKey, appendSelection } from '@/lib/selection-client';
import type { Actor, AdminProduct, LineInput, StoreSettings } from '@/types/workspace';
type SelectionProps = {
  actor: Actor | null;
  initialLines: LineInput[];
  products: AdminProduct[];
  settings: StoreSettings;
};
const subscribe = () => () => {};
const getGuestSnapshot = () => { try { return localStorage.getItem(guestDraftKey) || '[]'; } catch { return '[]'; } };
const getServerSnapshot = () => '[]';
function readGuestLines(raw: string, products: AdminProduct[]): LineInput[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length > 30) throw new Error('INVALID_INPUT');
  const ids = new Set(products.flatMap((p) => p.variants.filter(v => v.active).map((v) => v.id)));
  return parsed.filter(l => l && ids.has(l.variantId) && Number.isInteger(l.quantity) && l.quantity >= 1 && l.quantity <= 20 && ['frame','hardware','installation'].every(k => typeof l[k] === 'boolean'));
}
export function Selection(props: SelectionProps) {
  const raw = useSyncExternalStore(subscribe, getGuestSnapshot, getServerSnapshot);
  let initialLines = props.initialLines;
  if (!props.actor) { try { initialLines = readGuestLines(raw, props.products); } catch { initialLines = []; } }
  return <SelectionForm key={props.actor?.id || raw} {...props} initialLines={initialLines} />;
}
function SelectionForm({
  actor,
  initialLines,
  products,
  settings,
}: SelectionProps) {
  const t = useTranslations('Workspace');
  const router = useRouter();
  const f = useFeedback();
  const [lines, setLines] = useState(initialLines);
  const [note, setNote] = useState('');
  async function save(create: boolean) {
    f.setError('');
    f.setSuccess('');
    f.setBusy(true);
    try {
      if (!actor) {
        localStorage.setItem(guestDraftKey, JSON.stringify(lines));
        f.setSuccess(t('guestSaved'));
        return;
      }
      if (create) {
        const result = await workspaceRequest<{ id: string }>({
          action: 'createRequest',
          lines,
          note,
        });
        localStorage.removeItem(guestDraftKey);
        router.push(`/requests/${result.id}`);
      } else {
        await workspaceRequest({ action: 'draft', lines });
        f.setSuccess(t('saved'));
      }
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
          <p className="eyebrow">ALATAU DOORS</p>
          <h1>{t('selection')}</h1>
          <p>{t('selectionIntro')}</p>
        </div>
        <Link className="text-link" href="/catalog">
          {t('backCatalog')} ↗
        </Link>
      </div>
      {actor && actor.role !== 'BUYER' ? (
        <p className="panel">{t('buyerOnly')}</p>
      ) : (
        <form
          className="panel workspace-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save(true);
          }}
        >
          {actor && <div className="form-actions">
            <button
              type="button"
              className="text-link"
              disabled={f.busy}
              onClick={async () => {
                f.setBusy(true);
                try {
                  const merged = appendSelection(lines, readGuestLines(localStorage.getItem(guestDraftKey) || '[]', products));
                  await workspaceRequest({action:'draft',lines:merged});
                  setLines(merged);
                  localStorage.removeItem(guestDraftKey);
                  f.setSuccess(t('guestLoaded'));
                } catch (error) { f.setError((error as Error).message); }
                finally { f.setBusy(false); }
              }}
            >
              {t('loadGuestDraft')}
            </button>
          </div>}
          <LineEditor
            lines={lines}
            onChange={setLines}
            products={products}
            settings={settings}
            disabled={f.busy}
          />
          <label>
            {t('requestNote')}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={3}
            />
          </label>
          <p className="workspace-note">{t('requestDemoNote')}</p>
          <WhatsAppPreview lines={lines} products={products} settings={settings} />
          <Feedback error={f.error} success={f.success} />
          <div className="form-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={f.busy}
              onClick={() => void save(false)}
            >
              {t('saveDraft')}
            </button>
            {actor ? (
              <button className="primary-button" disabled={f.busy || !lines.length}>
                {t('createRequest')}
              </button>
            ) : (
                <><Link className="primary-button" href="/sign-in?returnTo=selection" onClick={() => localStorage.setItem(guestDraftKey, JSON.stringify(lines))}>
                {t('signInToRequest')}
              </Link>
                <Link className="text-link" href="/guest-request">{t('guestRequest')}</Link></>
            )}
          </div>
        </form>
      )}
    </>
  );
}
