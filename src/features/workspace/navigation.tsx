'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/i18n/navigation';

export function WorkspaceNavigation({ links }: { links: string[][] }) {
  const t = useTranslations('Workspace');
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);
  return <div className="workspace-navigation">
    <button ref={button} type="button" className="workspace-menu-toggle" aria-expanded={open} aria-controls="workspace-menu" onClick={() => setOpen(!open)}>{t('workspaceNavigation')}<ChevronDown size={18}/></button>
    <nav id="workspace-menu" className={open ? 'is-open' : ''} aria-label={t('workspaceNavigation')}>
      {links.map(([href, key]) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} onClick={() => setOpen(false)}>{t(key)}</Link>)}
    </nav>
  </div>;
}
