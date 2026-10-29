'use client';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFavorites } from '@/store/favorites';
import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
export function FavoritesGrid({ cards }: { cards: { id: string; node: React.ReactNode }[] }) {
  const t = useTranslations('Favorites');
  const c = useTranslations('Common');
  const ids = useFavorites((s) => s.ids);
  const clear = useFavorites((s) => s.clear);
  const saved = cards.filter((card) => ids.includes(card.id));
  return saved.length ? (
    <>
      <div className="catalog-result-summary">
        <span aria-live="polite">{t('count', { count: saved.length })}</span>
        <button type="button" className="text-link" onClick={clear}>
          {t('clear')}
        </button>
      </div>
      <div className="product-grid">
        {saved.map((card) => (
          <div key={card.id}>{card.node}</div>
        ))}
      </div>
    </>
  ) : (
    <div className="empty-state">
      <Heart size={44} strokeWidth={1} />
      <h2>{t('emptyTitle')}</h2>
      <p>{t('emptyText')}</p>
      <Button asChild className="primary-button">
        <Link href="/catalog">{c('viewCatalog')} ↗</Link>
      </Button>
    </div>
  );
}
