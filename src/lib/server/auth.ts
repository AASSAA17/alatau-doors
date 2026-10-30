import { betterAuth } from 'better-auth';
import { verifyGoogleIdToken, type GoogleProfile } from 'better-auth/social-providers';
import { authDatabase } from './db';
import { publicDemo, validateEnvironment } from './environment';
import { googleConfigured, validateGoogleConfiguration } from './google-auth';
validateEnvironment();
validateGoogleConfiguration();
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
  logger: { disabled: true },
  onAPIError: { errorURL: `${authOrigin}/ru/sign-in?google=error` },
  socialProviders: googleConfigured ? {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      prompt: 'select_account',
      accessType: 'online',
      includeGrantedScopes: false,
      getUserInfo: async (tokens) => {
        if (!tokens.idToken) return null;
        const profile = await verifyGoogleIdToken({ token: tokens.idToken, audience: process.env.GOOGLE_CLIENT_ID! });
        if (!profile || typeof profile.sub !== 'string' || typeof profile.email !== 'string' || profile.email_verified !== true) return null;
        return { user: { name: typeof profile.name === 'string' ? profile.name : 'Google buyer',
          email: profile.email, emailVerified: true }, data: profile as unknown as GoogleProfile };
      },
    },
  } : {},
  account: {
    // Existing password accounts must not be silently claimed through a matching email.
    accountLinking: { enabled: false },
    encryptOAuthTokens: true,
  },
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
      '/sign-in/social': { window: 60, max: 10 },
    },
  },
  databaseHooks: {
    account: {
      // ID tokens contain profile claims and are only needed during the callback.
      create: { before: async (account) => ({ data: { ...account, idToken: null } }) },
      update: { before: async (account) => ({ data: { ...account, idToken: null } }) },
    },
    session: {
      create: {
        before: async (session, context) => {
          // Better Auth's adapter follows its current transaction, including signup.
          const user = (await context?.context.internalAdapter.findUserById(session.userId)) as
            { active?: boolean; role?: string; emailVerified?: boolean } | null | undefined;
          if (context?.path.startsWith('/callback/') &&
              (user?.role !== 'BUYER' || !user.emailVerified)) return false;
          return user?.active ? { data: session } : false;
        },
      },
    },
    user: {
      create: {
        before: async (user, context) => {
          if (context?.path.startsWith('/callback/')) {
            if (!user.emailVerified) return false;
            // Share the existing daily registration quota with password signup.
            const { demoLimit } = await import('./public-demo');
            await demoLimit('registrations-global', 10, 86400);
          }
          return { data: { ...user, role: 'BUYER', active: true, phone: '' } };
        },
      },
    },
  },
});
