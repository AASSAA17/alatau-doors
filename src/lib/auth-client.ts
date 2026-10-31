'use client';
import { createAuthClient } from 'better-auth/react';
import { twoFactorClient, emailOTPClient, inferAdditionalFields } from 'better-auth/client/plugins';
import type { auth } from './server/auth';
export const authClient = createAuthClient({ plugins: [twoFactorClient(), emailOTPClient(), inferAdditionalFields<typeof auth>()] });
