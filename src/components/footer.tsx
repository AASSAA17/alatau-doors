'use client';
import { useTranslations } from 'next-intl';
import { ArrowUpRight } from 'lucide-react';
import { Link, usePathname } from '@/lib/i18n/navigation';
export function Footer() {
  const t = useTranslations('Common');
  const w = useTranslations('Workspace');
  const pathname = usePathname();
  if (/^\/(account|admin|seller|requests|selection|favorites|sign-in|sign-up)(\/|$)/.test(pathname)) return (
    <footer className="workspace-footer"><div className="shell"><Link href="/" className="footer-brand">ALATAU DOORS</Link><nav aria-label={t('navigation')}><Link href="/catalog">{t('catalog')}</Link><Link href="/contacts">{w('contacts')}</Link><Link href="/privacy">{w('privacy')}</Link></nav><p>{t('demoProject')}</p></div></footer>
  );
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer-main">
          <div>
            <Link href="/" className="footer-brand">
              ALATAU DOORS
            </Link>
            <p>{t('footerText')}</p>
            <span className="eyebrow">{t('city')}</span>
          </div>
          <div className="footer-links">
            <Link href="/door-finder">{t('finder')}<ArrowUpRight size={16}/></Link>
            <Link href="/selection">{t('selection')}<ArrowUpRight size={16}/></Link>
            <Link href="/about">{t('about')}<ArrowUpRight size={16}/></Link>
            <Link href="/projects">{t('ideas')}<ArrowUpRight size={16}/></Link>
            <Link href="/account">
              {w('account')}
              <ArrowUpRight size={16} />
            </Link>
            <Link href="/contacts">
              {w('contacts')}
              <ArrowUpRight size={16} />
            </Link>
            <span className="eyebrow">{t('navigation')}</span>
            <Link href="/catalog">
              {t('allDoors')}
              <ArrowUpRight size={16} />
            </Link>
            <Link href="/catalog/interior">
              {t('interior')}
              <ArrowUpRight size={16} />
            </Link>
            <Link href="/catalog/entrance">
              {t('entrance')}
              <ArrowUpRight size={16} />
            </Link>
            <Link href="/favorites">
              {t('favorites')}
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="footer-disclaimer">
            <span className="eyebrow">{t('demoProject')}</span>
            <p>{t('footerNote')}</p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>{t('copyright')}</span>
          <Link href="/privacy">{w('privacy')}</Link>
          <span>DESIGNED AROUND YOUR SPACE</span>
        </div>
      </div>
    </footer>
  );
}
