import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import { getSettings } from '@/lib/server/products';
export async function ContactSection() {
    const t = await getTranslations('Storefront');
    const locale = await getLocale();
    const s = (await getSettings());
    const fields = [
        ['phone', s.phone], ['email', s.email],
        ['address', locale === 'kk' ? s.addressKk : s.addressRu],
        ['hours', locale === 'kk' ? s.hoursKk : s.hoursRu],
    ].filter(([, value]) => value.trim());
    return (<section className="contact-section shell" id="contacts">
      <div>
        <p className="eyebrow">ALATAU DOORS / {t('contacts')}</p>
        <h2>{t('contactsTitle')}</h2>
        <p>{t('contactsText')}</p>
        <Link className="primary-button" href="/selection">
          {t('requestLink')} ↗
        </Link>
      </div>
      {fields.length ? <dl>
        {fields.map(([key, value]) => (<div key={key}>
            <dt>{t(key)}</dt>
            <dd>{value}</dd>
          </div>))}
      </dl> : <div className="contact-placeholder"><h3>{t('contactsPendingTitle')}</h3><p>{t('contactsPendingText')}</p></div>}
    </section>);
}
