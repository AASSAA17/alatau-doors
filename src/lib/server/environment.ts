export const publicDemo = process.env.APP_MODE === 'public-demo';
export const postgres = process.env.DATABASE_PROVIDER === 'postgres';
export const maintenance =
  !process.env.VERCEL && ['migrate', 'seed'].includes(process.env.ALATAU_DB_TASK || '');
export function validateEnvironment() {
  if (!['demo', 'public-demo', 'production'].includes(process.env.APP_MODE || ''))
    throw new Error('An explicit application mode is required.');
  if (
    process.env.DATABASE_PROVIDER &&
    !['sqlite', 'postgres'].includes(process.env.DATABASE_PROVIDER)
  )
    throw new Error('Unsupported database provider.');
  if (publicDemo && !postgres) throw new Error('Public demo requires PostgreSQL.');
  if (
    process.env.VERCEL &&
    (!postgres ||
      !['public-demo', 'production'].includes(process.env.APP_MODE || '') ||
      process.env.ALATAU_DB_TASK)
  )
    throw new Error('Invalid hosted database mode.');
  if ((process.env.APP_MODE === 'production' || (process.env.VERCEL && process.env.AUTH_SECURITY === 'required')) && (process.env.AUTH_MAIL_PROVIDER !== 'resend' ||
      !process.env.RESEND_API_KEY || !process.env.AUTH_MAIL_FROM))
    throw new Error('Configure the verified authentication mail sender before deploying account security.');
  if (postgres) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
    const url = new URL(process.env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol))
      throw new Error('Invalid database protocol.');
    const local = ['127.0.0.1', 'localhost'].includes(url.hostname) && !process.env.VERCEL;
    if (!local && !['require', 'verify-full'].includes(url.searchParams.get('sslmode') || ''))
      throw new Error('Remote PostgreSQL requires verified TLS.');
    if (process.env.APP_MODE === 'demo' && !local)
      throw new Error('Local demo mode cannot use a remote database.');
  }
  if (publicDemo || process.env.APP_MODE === 'production') {
    const origin = new URL(process.env.BETTER_AUTH_URL || '');
    if (origin.protocol !== 'https:' || origin.origin !== process.env.BETTER_AUTH_URL)
      throw new Error('An exact HTTPS auth origin is required.');
  }
}
