import { betterAuth } from 'better-auth';
import { emailOTP, magicLink, phoneNumber } from 'better-auth/plugins';
import { deliverLoginEmail, deliverSms, verifySms, markDeliveryFailure } from './passwordless-delivery';
import { privateKey } from './entry-limits';
import { sharedDemoAccount } from './public-demo';
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
  plugins: [
    emailOTP({ otpLength: 6, expiresIn: 300, allowedAttempts: 3, storeOTP: { hash: async (otp) => privateKey(otp) },
      sendVerificationOTP: async ({ email, otp, type }, ctx) => {
        if (type !== 'sign-in') throw new Error('UNSUPPORTED_PURPOSE');
        try { await deliverLoginEmail(email, otp, 'code', ctx?.headers?.get('x-alatau-locale') || 'ru'); }
        catch { markDeliveryFailure(); throw new Error('DELIVERY_FAILED'); }
      } }),
    magicLink({ expiresIn: 600, storeToken: 'hashed', sendMagicLink: async ({ email, url }, ctx) => {
      // Put the bearer token in a fragment. A deliberate button click redeems it;
      // mail scanners and browser history/referrers never receive a GET login token.
      const source = new URL(url);
      const locale = ctx?.headers?.get('x-alatau-locale') === 'kk' ? 'kk' : 'ru';
      const target = new URL(`/${locale}/email-link`, authOrigin);
      target.hash = source.searchParams.toString();
      await deliverLoginEmail(email, target.toString(), 'link', locale);
    } }),
    phoneNumber({ requireVerification: true, allowedAttempts: 3,
      phoneNumberValidator: (value) => /^\+7[67]\d{9}$/.test(value),
      sendOTP: async ({ phoneNumber }) => deliverSms(phoneNumber),
      verifyOTP: async ({ phoneNumber, code }) => verifySms(phoneNumber, code),
      signUpOnVerification: { getTempEmail: (phone) => `${privateKey(phone)}@phone.invalid`, getTempName: () => 'Покупатель / Сатып алушы' },
    }),
  ],
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
            { active?: boolean; role?: string; email?: string; emailVerified?: boolean; phoneNumberVerified?: boolean } | null | undefined;
          if (context?.path.startsWith('/callback/') &&
              (user?.role !== 'BUYER' || !user.emailVerified)) return false;
          if (['/sign-in/email-otp', '/magic-link/verify', '/phone-number/verify'].includes(context?.path || '') &&
              (user?.role !== 'BUYER' || sharedDemoAccount(user.email || '') || (context?.path === '/phone-number/verify' ? !user.phoneNumberVerified : !user.emailVerified))) return false;
          return user?.active ? { data: session } : false;
        },
      },
    },
    user: {
      create: {
        before: async (user, context) => {
          if (context?.path.startsWith('/callback/') || ['/sign-in/email-otp', '/magic-link/verify', '/phone-number/verify'].includes(context?.path || '')) {
            if (context?.path !== '/phone-number/verify' && !user.emailVerified) return false;
            // Share the existing daily registration quota with password signup.
            const { demoLimit } = await import('./public-demo');
            await demoLimit('registrations-global', 10, 86400);
          }
          return { data: { ...user, role: 'BUYER', active: true, phone: context?.path === '/phone-number/verify' ? String((user as { phoneNumber?: string }).phoneNumber || '') : '' } };
        },
      },
    },
  },
});
