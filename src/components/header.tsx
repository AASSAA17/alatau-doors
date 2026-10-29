'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Heart,
  MapPin,
  Menu,
  Search,
  X,
  UserRound,
  ClipboardList,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { useFavorites } from '@/store/favorites';
import { useSessionState } from '@/store/session';

export function Header() {
  const t = useTranslations('Common');
  const w = useTranslations('Workspace');
  const actor = useSessionState((s) => s.actor);
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const count = useFavorites((s) => s.ids.length);
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open]);
  const links = [
    ['/', 'home'],
    ['/catalog', 'catalog'],
    ['/door-finder', 'finder'],
    ['/contacts', 'contacts'],
  ] as const;
  return (
    <>
      <div className="demo-bar">
        <span>{t('demo')}</span>
        <span className="demo-dot">DEMO / 01</span>
      </div>
      <header className="site-header">
        <div className="header-main shell">
          <Link href="/" className="brand" aria-label="Alatau Doors" onClick={() => setOpen(false)}>
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>
              ALATAU<span className="brand-sub">D O O R S</span>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label={t('navigation')}>
            {links.map(([href, key]) => (
              <Link key={key} href={href} className={pathname === href ? 'nav-active' : ''}>
                {t(key)}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link
              href="/selection"
              className="icon-button selection-link"
              aria-label={w('selection')}
            >
              <ClipboardList size={20} />
            </Link>
            <div className="locale-switch" aria-label={t('language')}>
              {(['ru', 'kk'] as const).map((lang) => (
                <Link
                  key={lang}
                  href={{ pathname, query: Object.fromEntries(searchParams.entries()) }}
                  locale={lang}
                  lang={lang}
                  aria-current={locale === lang ? 'true' : undefined}
                  className={locale === lang ? 'active' : ''}
                >
                  {lang === 'ru' ? 'RU' : 'ҚАЗ'}
                </Link>
              ))}
            </div>
            <Link
              href="/catalog#search"
              className="icon-button search-link"
              aria-label={t('search')}
            >
              <Search size={20} />
            </Link>
            <Link
              href="/favorites"
              className="icon-button"
              aria-label={`${t('favorites')} (${count})`}
            >
              <Heart size={20} />
              {count > 0 && <span className="count-dot">{count}</span>}
            </Link>
            <Link
              href={
                actor?.role === 'ADMIN'
                  ? '/admin'
                  : actor?.role === 'SELLER'
                    ? '/seller'
                    : actor
                      ? '/account'
                      : '/sign-in'
              }
              className="account-link"
              aria-label={w(actor ? 'account' : 'signIn')}
            >
              <UserRound size={20} />
              <span>{w(actor ? 'account' : 'signIn')}</span>
            </Link>
            <button
              ref={menuButton}
              type="button"
              className="icon-button mobile-menu-button"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={t(open ? 'closeMenu' : 'menu')}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-menu" className="mobile-nav" aria-label={t('navigation')}>
            {links.map(([href, key]) => (
              <Link key={key} href={href} onClick={() => setOpen(false)}>
                {t(key)}
                <ArrowUpRight size={18} />
              </Link>
            ))}
            <Link href="/selection" onClick={()=>setOpen(false)}>{t('selection')}<ArrowUpRight size={18}/></Link>
            <span>
              <MapPin size={14} />
              {t('city')}
            </span>
          </nav>
        )}
      </header>
    </>
  );
}
