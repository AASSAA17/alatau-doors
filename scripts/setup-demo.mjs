import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
mkdirSync('.local', { recursive: true });
if (!existsSync('.env.local')) {
  writeFileSync(
    '.env.local',
    `APP_MODE=demo\nDATABASE_PATH=.local/alatau-demo.sqlite\nBETTER_AUTH_URL=http://localhost:3000\nBETTER_AUTH_SECRET=${randomBytes(48).toString('base64url')}\n`,
    { mode: 0o600 },
  );
}
process.loadEnvFile('.env.local');
const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed.ts'], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(result.status ?? 1);
