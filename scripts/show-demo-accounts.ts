import { readCredentials } from './demo-credentials';
if (process.env.VERCEL || !['demo', 'public-demo'].includes(process.env.APP_MODE || ''))
  throw new Error('Demo credentials are available only to a local demo operator.');
// Explicit local operator command. No HTTP route exposes credentials.
console.table(
  readCredentials(process.env.DEMO_CREDENTIALS_PATH || '.local/demo-credentials.json').map(
    ({ role, email, password }) => ({ role, email, password }),
  ),
);
