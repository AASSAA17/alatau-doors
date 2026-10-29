'use client';
import { useState } from 'react';
import { Heart, Minus, Plus, Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useFavorites } from '@/store/favorites';
import { formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types/product';
import { useSessionState } from '@/store/session';
import { addToSelection } from '@/lib/selection-client';
import { Link } from '@/lib/i18n/navigation';
import { Feedback } from '@/features/workspace/shared';
export function ProductOptions({ product }: { product: Product }) {
  const t = useTranslations('Product');
  const c = useTranslations('Common');
  const locale = useLocale();
  const w = useTranslations('Workspace');
  const actor = useSessionState((s) => s.actor);
  const loading = useSessionState((s) => s.loading);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const [variantId, setVariantId] = useState(product.variants?.find(v => v.active)?.id);
  const [quantity, setQuantity] = useState(1);
  const active = useFavorites((s) => s.ids.includes(product.id));
  const toggle = useFavorites((s) => s.toggle);
  const variant = product.variants?.find((v) => v.id === variantId && v.active);
  const width = variant?.width ?? product.widths[0];
  const unitPrice = variant?.price ?? product.price;
  async function add() {
    setAdding(true);
    setError('');
    try {
      if (!variant) throw new Error('UNAVAILABLE_VARIANT');
      await addToSelection(actor, {variantId: variant.id, quantity, frame:false, hardware:false, installation:false});
      setAdded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }
  return (
    <div className="product-options">
      <fieldset>
        <legend>
          {t('width')} <span>/ {t('unit')}</span>
        </legend>
        <div className="width-options">
          {product.variants?.filter(v => v.active).map((option) => (
            <label key={option.id} className={variantId === option.id ? 'selected' : ''}>
              <input
                type="radio"
                name="width"
                value={option.id}
                checked={variantId === option.id}
                onChange={() => setVariantId(option.id)}
              />
              <span>{option.width}{product.variants?.filter(v => v.active && v.width === option.width).length !== 1 ? ` × ${option.height}` : ''}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="quantity-row">
        <span>{t('quantity')}</span>
        <div className="quantity-stepper">
          <button
            type="button"
            disabled={quantity === 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label={t('minus')}
          >
            <Minus size={16} />
          </button>
          <output aria-live="polite">{quantity}</output>
          <button
            type="button"
            disabled={quantity === 20}
            onClick={() => setQuantity((q) => Math.min(20, q + 1))}
            aria-label={t('plus')}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
      <div className="subtotal">
        <span>
          {t('estimate')}
          <small>
            {width} × {variant?.height ?? product.height} {t('unit')} · {quantity} × {formatPrice(unitPrice, locale)}
          </small>
        </span>
        <output data-testid="subtotal" aria-live="polite">
          {formatPrice(unitPrice * quantity, locale)}
        </output>
      </div>
      {variant && (
        <p className="stock-note">
          {w(`stock.${variant.stock}`)}
        </p>
      )}
      <div className="product-purchase-actions"><button
        type="button"
        className="primary-button favorite-wide"
        disabled={
          adding ||
          loading ||
          !variant ||
          variant.stock === 'DEMO_UNAVAILABLE' ||
          Boolean(actor && actor.role !== 'BUYER')
        }
        onClick={() => void add()}
      >
        {w('addToSelection')}
      </button>
      <Button
        type="button"
        className="secondary-button product-save-button"
        onClick={() => toggle(product.id)}
        aria-label={active ? t('added') : c('addFavorite')}
        title={active ? t('added') : c('addFavorite')}
        aria-pressed={active}
        disabled={loading||Boolean(actor&&actor.role!=='BUYER')}
      >
        {active ? <Check size={18} /> : <Heart size={18} />}
      </Button>
      </div>
      {added && <Link href="/selection" className="text-link">{w('addedToSelection')} ↗</Link>}
      <Feedback error={error} />
    </div>
  );
}
