import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import { formatPrice } from '@/lib/utils';
import { FavoriteButton } from '@/features/favorites/favorite-button';
import type { Locale, Product } from '@/types/product';
export async function ProductCard({ product }: { product: Product }) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations('Common');
  return (
    <article className="product-card" data-testid="product-card">
      <div className="product-image-wrap">
        <Link
          href={`/product/${product.slug}`}
          className="product-image-link"
          aria-label={`${product.name} — ${product.finish[locale]}`}
        >
          <Image
            src={product.image}
            alt={`${product.name}, ${product.finish[locale]} — ${t('visualization')}`}
            fill
            sizes="(max-width: 600px) 45vw, (max-width: 1000px) 40vw, 25vw"
            className="product-image"
            style={{ objectPosition: product.image === '/images/hero.webp' ? '76% center' : 'center' }}
          />
        </Link>
        <span className="product-collection">{product.collection}</span>
        <FavoriteButton id={product.id} />
      </div>
      <div className="product-meta">
        <div>
          <p className="product-finish">{product.finish[locale]}</p>
          <Link href={`/product/${product.slug}`} className="product-title">
            {product.name}
            <ArrowUpRight size={19} />
          </Link>
        </div>
        <span
          className="color-swatch"
          style={{ backgroundColor: product.color }}
          aria-hidden="true"
        />
      </div>
      <div className="product-price">
        <span>{formatPrice(product.price, locale)}</span>
        <small>{t('perLeaf')}</small>
      </div>
    </article>
  );
}
