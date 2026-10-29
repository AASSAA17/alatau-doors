'use client';
import { useLocale, useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/utils';
import { previewSelection } from '@/lib/pricing';
import type { AdminProduct, LineInput, StoreSettings } from '@/types/workspace';
export function LineEditor({
  lines,
  onChange,
  products,
  settings,
  disabled = false,
}: {
  lines: LineInput[];
  onChange: (lines: LineInput[]) => void;
  products: AdminProduct[];
  settings: StoreSettings;
  disabled?: boolean;
}) {
  const t = useTranslations('Workspace');
  const locale = useLocale();
  const variants = products.flatMap((p) =>
    p.variants.map((v) => ({ ...v, name: p.name, archived: p.archived })),
  );
  const first = variants.find((v) => v.active && !v.archived && v.stock !== 'DEMO_UNAVAILABLE');
  function update(index: number, patch: Partial<LineInput>) {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  const { total } = previewSelection(lines, products, settings);
  return (
    <div className="line-editor">
      <div className="line-list">
        {lines.map((line, index) => (
          <fieldset
            className="line-item"
            data-testid="request-line"
            key={index}
            disabled={disabled}
          >
            <legend>
              {t('position')} {index + 1}
            </legend>
            <div className="line-inputs">
              <label>
                {t('modelVariant')}
                <select
                  value={line.variantId}
                  onChange={(e) => update(index, { variantId: e.target.value })}
                >
                  {!variants.some((v) => v.id === line.variantId) && (
                    <option value={line.variantId}>{t('unavailable')}</option>
                  )}
                  {variants.map((v) => (
                    <option
                      key={v.id}
                      value={v.id}
                      disabled={!v.active || v.archived || v.stock === 'DEMO_UNAVAILABLE'}
                    >
                      {v.name} · {v.width} × {v.height} · {formatPrice(v.price, locale)}
                      {!v.active || v.archived ? ' · ' + t('archived') : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('quantity')}
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={line.quantity}
                  onChange={(e) =>
                    update(index, {
                      quantity: Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                    })
                  }
                />
              </label>
            </div>
            <div className="option-checks">
              {(['frame', 'hardware', 'installation'] as const).map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={line[key]}
                    onChange={(e) => update(index, { [key]: e.target.checked })}
                  />
                  <span>
                    {t(key)} <small>+{formatPrice(settings[`${key}Price`], locale)}</small>
                  </span>
                </label>
              ))}
            </div>
            <button
              className="danger-link"
              type="button"
              onClick={() => onChange(lines.filter((_, i) => i !== index))}
            >
              {t('removePosition')}
            </button>
          </fieldset>
        ))}
      </div>
      {!disabled && (
        <button
          className="secondary-button"
          type="button"
          disabled={!first || lines.length >= 30}
          onClick={() => {
            if (first)
              onChange([
                ...lines,
                {
                  variantId: first.id,
                  quantity: 1,
                  frame: false,
                  hardware: false,
                  installation: false,
                },
              ]);
          }}
        >
          {t('addPosition')} +
        </button>
      )}
      <div className="selection-total">
        <span>{t('previewTotal')}</span>
        <strong>{total === null ? t('unavailable') : formatPrice(total, locale)}</strong>
      </div>
      <p className="workspace-note">{t('priceDisclaimer')}</p>
    </div>
  );
}
