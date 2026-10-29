'use client';
import { useRef, useState, useTransition } from 'react';
import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter, Link } from '@/lib/i18n/navigation';
import type { Category } from '@/types/product';

export function CatalogControls({ category, children }: { category?: Category; children: React.ReactNode }) {
  const t = useTranslations('Catalog');
  const c = useTranslations('Common');
  const query = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  function navigate() {
    if (!form.current) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form.current))
      if (String(value).trim()) params.set(key, String(value).trim());
    startTransition(() => router.replace(`${pathname}${params.size ? '?' + params.toString() : ''}`, { scroll: false }));
  }
  return (
    <div className="catalog-layout" aria-busy={pending}>
      <form ref={form} id="catalog-filter-form" key={`form-${query.toString()}`} className="catalog-toolbar" onSubmit={(e) => { e.preventDefault(); navigate(); }}>
        <div className="catalog-search">
          <label className="sr-only" htmlFor="search">{t('searchLabel')}</label>
          <Search size={19} aria-hidden="true" />
          <input id="search" name="q" type="search" defaultValue={query.get('q') ?? ''} placeholder={t('searchPlaceholder')} maxLength={100} />
          <button type="submit" className="search-button" disabled={pending}>{t('searchButton')}</button>
        </div>
        <div className="catalog-toolbar-bottom">
          <button type="button" className="mobile-filter-toggle secondary-button" aria-expanded={open} aria-controls="catalog-filter-panel" onClick={() => setOpen(!open)}><SlidersHorizontal size={17}/>{t('filters')}<ChevronDown size={16}/></button>
          <label className="catalog-sort"><span>{t('sort')}</span><select name="sort" defaultValue={query.get('sort') ?? ''} onChange={navigate} disabled={pending}><option value="">{t('recommended')}</option><option value="price-asc">{t('priceAsc')}</option><option value="price-desc">{t('priceDesc')}</option><option value="name">{t('name')}</option></select></label>
          {query.size > 0 && <Link href={pathname} className="reset-filters">{t('reset')}</Link>}
        </div>
      </form>
      <aside id="catalog-filter-panel" className={`catalog-filter-panel ${open ? 'is-open' : ''}`} key={`filters-${query.toString()}`} aria-label={t('filters')}>
        <h2><SlidersHorizontal size={18}/>{t('filters')}</h2>
        <fieldset disabled={pending}>
          {!category && <label><span>{t('category')}</span><select name="category" form="catalog-filter-form" defaultValue={query.get('category') ?? ''} onChange={navigate}><option value="">{c('allDoors')}</option><option value="interior">{c('interior')}</option><option value="entrance">{c('entrance')}</option></select></label>}
          <label><span>{t('budget')}</span><select name="maxPrice" form="catalog-filter-form" defaultValue={query.get('maxPrice') ?? ''} onChange={navigate}><option value="">{t('anyBudget')}</option><option value="100000">{t('under100')}</option><option value="150000">{t('under150')}</option><option value="250000">{t('under250')}</option></select></label>
        </fieldset>
        <p>{t('filterHint')}</p>
      </aside>
      <div className="catalog-results">{children}</div>
    </div>
  );
}
