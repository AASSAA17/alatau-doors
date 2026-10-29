import { betterAuth } from 'better-auth';
import { authDatabase } from './db';
import { publicDemo, validateEnvironment } from './environment';
validateEnvironment();
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32)
  throw new Error(
    'Set BETTER_AUTH_SECRET (32+ characters). Run npm run setup:demo for a local demo.',
  );
export const authOrigin = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
if (process.env.APP_MODE === 'production' && !authOrigin.startsWith('https://'))
  throw new Error('Production requires an explicit HTTPS BETTER_AUTH_URL.');
export const trustedOrigins =
  process.env.APP_MODE === 'demo'
    ? [...new Set([authOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'])]
    : [authOrigin];
export const auth = betterAuth({
  appName: 'Alatau Doors',
  secret,
  baseURL: authOrigin,
  database: authDatabase(),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: true, defaultValue: 'BUYER', input: false },
      active: { type: 'boolean', required: true, defaultValue: true, input: false },
      phone: { type: 'string', required: false, defaultValue: '', input: false },
    },
  },
  session: {
    expiresIn: publicDemo ? 60 * 60 * 12 : 60 * 60 * 24 * 7,
    cookieCache: { enabled: false },
  },
  advanced: {
    useSecureCookies: authOrigin.startsWith('https:'),
    defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: process.env.APP_MODE === 'demo' ? 1000 : 200,
    customRules: {
      '/sign-in/email': { window: 60, max: process.env.APP_MODE === 'demo' ? 60 : 10 },
      '/sign-up/email': { window: 60, max: 15 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session, context) => {
          // Better Auth's adapter follows its current transaction, including signup.
          const user = (await context?.context.internalAdapter.findUserById(session.userId)) as
            { active?: boolean } | null | undefined;
          return user?.active ? { data: session } : false;
        },
      },
    },
    user: {
      create: {
        before: async (user) => ({ data: { ...user, role: 'BUYER', active: true, phone: '' } }),
      },
    },
  },
});
