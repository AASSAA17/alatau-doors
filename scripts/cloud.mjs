import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
const command = process.argv[2];
if (!['migrate', 'seed', 'accounts'].includes(command))
  throw new Error('Expected migrate, seed or accounts.');
if (existsSync('.env.cloud.local')) process.loadEnvFile('.env.cloud.local');
if (process.env.VERCEL) throw new Error('Maintenance commands must run outside deployment builds.');
if (process.env.DATABASE_PROVIDER !== 'postgres' || process.env.APP_MODE !== 'public-demo')
  throw new Error('Configure the separate PostgreSQL public-demo environment.');
if (command !== 'accounts' && !process.env.DATABASE_URL_UNPOOLED)
  throw new Error('Direct owner connection is required for explicit maintenance.');
const env = {
  ...process.env,
  ALATAU_DB_TASK: command === 'accounts' ? '' : command,
  DATABASE_URL:
    command === 'accounts' ? process.env.DATABASE_URL : process.env.DATABASE_URL_UNPOOLED,
  DEMO_CREDENTIALS_PATH: process.env.DEMO_CREDENTIALS_PATH || '.local/cloud-credentials.json',
};
const script =
  command === 'migrate'
    ? 'cloud-migrate.ts'
    : command === 'seed'
      ? 'seed.ts'
      : 'show-demo-accounts.ts';
const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/' + script], {
  env,
  stdio: 'inherit',
  windowsHide: true,
});
child.on('exit', (code) => (process.exitCode = code ?? 1));
