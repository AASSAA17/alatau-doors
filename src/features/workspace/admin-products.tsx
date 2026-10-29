'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import { workspaceRequest } from '@/lib/workspace-client';
import { formatPrice } from '@/lib/utils';
import { Feedback, useFeedback } from './shared';
import type { AdminProduct, DoorVariant } from '@/types/workspace';

export function AdminProducts({ products }: { products: AdminProduct[] }) {
  const t = useTranslations('Workspace');
  const locale = useLocale();
  const [editing, setEditing] = useState<AdminProduct | null | undefined>();
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">ADMIN / ALATAU DOORS</p>
          <h1>{t('products')}</h1>
          <p>{t('catalogAdminNote')}</p>
        </div>
        <button className="primary-button" onClick={() => setEditing(null)}>
          {t('newProduct')} +
        </button>
      </div>
      {editing !== undefined ? (
        <ProductForm
          key={editing?.id || 'new'}
          product={editing}
          onClose={() => setEditing(undefined)}
        />
      ) : (
        <div className="table-scroll responsive-table-wrap">
          <table className="workspace-table responsive-table product-admin-table" role="table">
            <thead>
              <tr>
                <th>{t('model')}</th>
                <th>{t('sku')}</th>
                <th>{t('basePrice')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td data-label={t('model')}>
                    {p.name}
                    <small>{p.slug}</small>
                  </td>
                  <td data-label={t('sku')}>{p.sku}</td>
                  <td data-label={t('basePrice')}>{formatPrice(p.price, locale)}</td>
                  <td data-label={t('status')}>{t(p.archived ? 'archived' : 'active')}</td>
                  <td data-label={t('actions')}>
                    <button className="text-link" onClick={() => setEditing(p)}>
                      {t('edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
function ProductForm({ product, onClose }: { product: AdminProduct | null; onClose: () => void }) {
  const t = useTranslations('Workspace');
  const router = useRouter();
  const f = useFeedback();
  const [variants, setVariants] = useState<Partial<DoorVariant>[]>(
    product?.variants || [
      { width: 800, height: 2100, price: 100000, stock: 'DEMO_ORDER', active: true },
    ],
  );
  function change(index: number, patch: Partial<DoorVariant>) {
    setVariants(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }
  return (
    <form
      className="panel workspace-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const str = (key: string) => String(data.get(key) || '');
        const localized = (key: string) => ({ ru: str(`${key}.ru`), kk: str(`${key}.kk`) });
        f.setBusy(true);
        f.setError('');
        try {
          await workspaceRequest({
            action: 'product',
            ...(product ? { id: product.id } : {}),
            data: {
              name: str('name'),
              slug: str('slug'),
              sku: str('sku'),
              category: str('category'),
              image: str('image'),
              finish: localized('finish'),
              material: localized('material'),
              ...(str('coating.ru') || str('coating.kk') ? {coating:localized('coating')} : {}),
              description: localized('description'),
              collection: str('collection'),
              color: str('color'),
              archived: data.get('archived') === 'on',
              variants: variants.map((v) => ({
                ...(v.id ? { id: v.id } : {}),
                width: v.width,
                height: v.height,
                price: v.price,
                stock: v.stock,
                active: v.active,
              })),
            },
          });
          router.refresh();
          onClose();
        } catch (e) {
          f.setError((e as Error).message);
        } finally {
          f.setBusy(false);
        }
      }}
    >
      <h2>{t(product ? 'editProduct' : 'newProduct')}</h2>
      <div className="form-grid">
        {[
          ['name', 'model'],
          ['slug', 'slug'],
          ['sku', 'sku'],
          ['collection', 'collection'],
        ].map(([key, label]) => (
          <label key={key}>
            {t(label)}
            <input
              name={key}
              defaultValue={product?.[key as 'name' | 'slug' | 'sku' | 'collection'] || ''}
              required
              maxLength={100}
            />
          </label>
        ))}
        <label>
          {t('category')}
          <select name="category" defaultValue={product?.category || 'interior'}>
            <option value="interior">{t('interior')}</option>
            <option value="entrance">{t('entrance')}</option>
          </select>
        </label>
        <label>
          {t('image')}
          <select name="image" defaultValue={product?.image || '/images/oak.webp'}>
            {['oak', 'ivory', 'graphite', 'hero'].map((n) => (
              <option key={n} value={`/images/${n}.webp`}>
                {t(`images.${n}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('color')}
          <input name="color" type="color" defaultValue={product?.color || '#bfa17b'} />
        </label>
        <label className="check-label">
          <input type="checkbox" name="archived" defaultChecked={product?.archived || false} />
          {t('archiveProduct')}
        </label>
      </div>
      {(['finish', 'material', 'coating', 'description'] as const).map((key) => (
        <div className="form-grid" key={key}>
          {(['ru', 'kk'] as const).map((locale) => (
            <label key={locale}>
              {t(key)} · {locale === 'ru' ? 'RU' : 'ҚАЗ'}
              {key === 'description' ? (
                <textarea
                  name={`${key}.${locale}`}
                  defaultValue={product?.[key]?.[locale] || ''}
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={3}
                />
              ) : (
                <input
                  name={`${key}.${locale}`}
                  defaultValue={product?.[key]?.[locale] || ''}
                  required={key !== 'coating'}
                  maxLength={120}
                />
              )}
            </label>
          ))}
        </div>
      ))}
      <h2>{t('variants')}</h2>
      <p className="workspace-note">{t('variantsNote')}</p>
      {variants.map((v, i) => (
        <fieldset className="variant-edit" key={v.id || i}>
          <legend>
            {t('variant')} {i + 1}
          </legend>
          <div className="form-grid">
            <label>
              {t('width')}
              <input
                type="number"
                min={400}
                max={1600}
                value={v.width}
                required
                onChange={(e) => change(i, { width: Number(e.target.value) })}
              />
            </label>
            <label>
              {t('height')}
              <input
                type="number"
                min={1800}
                max={3000}
                value={v.height}
                required
                onChange={(e) => change(i, { height: Number(e.target.value) })}
              />
            </label>
            <label>
              {t('basePrice')}
              <input
                type="number"
                min={0}
                max={10000000}
                value={v.price}
                required
                onChange={(e) => change(i, { price: Number(e.target.value) })}
              />
            </label>
            <label>
              {t('demoStock')}
              <select
                value={v.stock}
                onChange={(e) => change(i, { stock: e.target.value as DoorVariant['stock'] })}
              >
                {['DEMO_AVAILABLE', 'DEMO_ORDER', 'DEMO_UNAVAILABLE'].map((s) => (
                  <option key={s} value={s}>
                    {t(`stock.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={v.active}
                onChange={(e) => change(i, { active: e.target.checked })}
              />
              {t('variantActive')}
            </label>
            <button
              type="button"
              className="danger-link"
              disabled={variants.length === 1}
              onClick={() => setVariants(variants.filter((_, index) => index !== i))}
            >
              {t('removeVariant')}
            </button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        className="secondary-button"
        disabled={variants.length >= 12}
        onClick={() =>
          setVariants([
            ...variants,
            { width: 900, height: 2100, price: 100000, stock: 'DEMO_ORDER', active: true },
          ])
        }
      >
        {t('addVariant')} +
      </button>
      <Feedback error={f.error} />
      <div className="form-actions">
        <button disabled={f.busy} className="primary-button">
          {t('save')}
        </button>
        <button type="button" className="secondary-button" onClick={onClose}>
          {t('close')}
        </button>
      </div>
    </form>
  );
}
