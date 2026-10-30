'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth-client';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { Feedback, SignOutButton, useFeedback } from './shared';
import { authDestination } from './auth-navigation';
type State = {signedIn: boolean; enabled?: boolean; verified?: boolean; role?: string; required?: boolean; emailRequired?:boolean; emailVerified?:boolean};
export function MfaSecurity({ challenge = false }: {challenge?: boolean}) {
  const t = useTranslations('AccountSecurity'); const w = useTranslations('Workspace'); const router = useRouter(); const f = useFeedback();
  const [state, setState] = useState<State | null>(null);
  const [setup, setSetup] = useState<{secret: string; codes: string[]} | null>(null);
  const [backup, setBackup] = useState(false);
  const {setError} = f;
  useEffect(() => { let active = true; fetch('/api/account/security', {cache:'no-store'}).then(r => {if (!r.ok) throw new Error(); return r.json();}).then(s => {if (active) setState(s);}).catch(() => {if (active) setError('SERVER_ERROR');}); return () => {active=false;}; }, [setError]);
  const needsSetup = state?.signedIn && state.required && !state.enabled;
  const needsEmail = state?.signedIn && state.emailRequired && !state.emailVerified;
  const ready = state?.signedIn && (!state.required || (state.enabled && state.verified));
  return <section className="auth-card">
    <p className="eyebrow">ALATAU DOORS</p><h1>{t('mfaTitle')}</h1><p>{t('mfaNote')}</p>
    {!state && <p role="status">{w('saving')}</p>}
    {needsEmail ? <Link className="primary-button" href="/verify-email">{t('verifyTitle')}</Link> : ready ? <><p>{t(state.required ? 'mfaReady' : 'accountReady')}</p><Link className="primary-button" href={state.role === 'ADMIN' ? '/admin' : state.role === 'SELLER' ? '/seller' : '/account'}>{t('continue')}</Link></> :
      state && (state.signedIn || challenge) && <>
        {needsSetup && !setup ? <form className="workspace-form" onSubmit={async e => {
          e.preventDefault(); f.setBusy(true); f.setError(''); const data = new FormData(e.currentTarget);
          try {
            const result = await authClient.twoFactor.enable({password:String(data.get('password')), method:'totp'}, {headers:{'x-mfa-enrollment':String(data.get('enrollment'))}});
            if (result.error) throw new Error(result.error.code === 'MFA_ENROLLMENT_REQUIRED' ? 'MFA_ENROLLMENT_REQUIRED' : 'AUTH_FAILED');
            if (!result.data || !('totpURI' in result.data)) throw new Error('SERVER_ERROR');
            const secret = new URL(result.data.totpURI).searchParams.get('secret');
            if (!secret) throw new Error('SERVER_ERROR');
            setSetup({secret, codes:result.data.backupCodes});
          } catch(error) {f.setError((error as Error).message);} finally {f.setBusy(false);}
        }}>
          <p>{t('enrollmentNote')}</p>
          <label>{t('enrollmentCode')}<input name="enrollment" type="password" autoComplete="off" minLength={32} maxLength={128} required/></label>
          <label>{w('password')}<input name="password" type="password" autoComplete="current-password" required/></label>
          <button className="primary-button" disabled={f.busy}>{t('startSetup')}</button>
        </form> : <>
          {setup && <div className="security-material"><p>{t('manualSetup')}</p><code className="security-secret">{setup.secret}</code><p>{t('backupNote')}</p><ul>{setup.codes.map(code => <li key={code}><code>{code}</code></li>)}</ul></div>}
          <form className="workspace-form" onSubmit={async e => {
            e.preventDefault(); f.setBusy(true); f.setError(''); const data = new FormData(e.currentTarget);
            try {
              const result = backup && !setup
                ? await authClient.twoFactor.verifyBackupCode({code:String(data.get('code')), trustDevice:false})
                : await authClient.twoFactor.verifyTotp({code:String(data.get('code')), trustDevice:false});
              if (result.error) throw new Error(result.error.status === 429 ? 'RATE_LIMIT' : 'INVALID_MFA_CODE');
              setSetup(null); router.push(await authDestination()); router.refresh();
            } catch(error) {f.setError((error as Error).message);} finally {f.setBusy(false);}
          }}>
            {setup && <label className="security-ack"><input type="checkbox" required/>{t('savedCodes')}</label>}
            <label>{t(backup && !setup ? 'backupCode' : 'totpCode')}<input name="code" autoComplete="one-time-code" inputMode={backup ? 'text' : 'numeric'} pattern={backup ? undefined : '[0-9]{6}'} maxLength={64} required/></label>
            <button className="primary-button" disabled={f.busy}>{t('confirmCode')}</button>
          </form>
          {!setup && <button className="text-link" type="button" onClick={() => {setBackup(!backup); f.setError('');}}>{t(backup ? 'useTotp' : 'useBackup')}</button>}
        </>}
      </>}
    <Feedback error={f.error}/><p><Link className="text-link" href="/sign-in">{w('signIn')}</Link></p>
    {state?.signedIn && <SignOutButton/>}
  </section>;
}
