import { randomBytes } from 'node:crypto';
import { getDb, getPool } from '../src/lib/server/db';
import { tokenDigest } from '../src/lib/server/auth-mail';
import { maintenance, postgres } from '../src/lib/server/environment';
import { staffRole } from '../src/lib/server/auth-policy';
async function main() {
  if (!process.stdout.isTTY || !maintenance || process.env.VERCEL) throw new Error('Use a private interactive operator terminal.');
  const email = process.argv[2];
  if (!email) throw new Error('Pass the staff email as the argument.');
  const user = await getDb().prepare('SELECT id,role,active,emailVerified,twoFactorEnabled FROM user WHERE email=?').get(email) as
    {id:string;role:string;active:boolean;emailVerified:boolean;twoFactorEnabled:boolean}|undefined;
  if (!user?.active || !staffRole(user.role) || !user.emailVerified || user.twoFactorEnabled) throw new Error('Staff must be active, email verified, and not yet enrolled.');
  const token=randomBytes(32).toString('base64url');
  await getDb().prepare('INSERT INTO mfa_enrollments(userId,tokenHash,expiresAt) VALUES(?,?,?) ON CONFLICT(userId) DO UPDATE SET tokenHash=excluded.tokenHash,expiresAt=excluded.expiresAt')
    .run(user.id,tokenDigest(token),Date.now()+15*60_000);
  console.log('One-time MFA enrollment code (15 minutes). Share privately with this account owner only:\n'+token);
}
main().catch(()=>{console.error('MFA enrollment grant failed. Check operator mode, terminal, verified email and staff status.');process.exitCode=1;}).finally(async()=>{if(postgres)await getPool().end();});
