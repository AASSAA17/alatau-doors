'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
export function ImageUpload({ value, onChange, onBusy }: { value: string; onChange: (value: string) => void; onBusy: (busy: boolean) => void }) {
  const t = useTranslations('ProductMedia');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="product-media-upload">
    <Image src={value} alt={t('preview')} width={160} height={180} unoptimized style={{ objectFit: 'cover', borderRadius: 6 }} />
    <label>{t('upload')}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      setError('');
      if (file.size > 4 * 1024 * 1024) { setError('tooLarge'); return; }
      setBusy(true); onBusy(true);
      try {
        const response = await fetch('/api/media', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
        const result = await response.json();
        if (!response.ok) { setError(result.code === 'MEDIA_FULL' ? 'full' : result.code === 'RATE_LIMIT' ? 'rate' : 'failed'); return; }
        onChange(result.url);
      } catch { setError('failed'); }
      finally { setBusy(false); onBusy(false); }
    }} /></label>
    <small>{t('hint')}</small>
    {busy && <p role="status">{t('busy')}</p>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
  </div>;
}
