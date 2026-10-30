// Server-only configuration; only the readiness boolean reaches the sign-in UI.
export const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export function validateGoogleConfiguration() {
  if (Boolean(process.env.GOOGLE_CLIENT_ID) !== Boolean(process.env.GOOGLE_CLIENT_SECRET))
    throw new Error('Configure both Google OAuth credentials, or neither.');
}
