import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

const command = process.argv[2];
const configPath = resolve('.local/presentation-config.json');
const databasePath = resolve('.local/presentation-demo.sqlite');
if (!['setup', 'dev', 'start', 'accounts', 'capture', 'capture-completion'].includes(command)) throw new Error('Expected setup, dev, start, accounts, capture or capture-completion.');
if (!existsSync(configPath)) {
  if (command !== 'setup') throw new Error('Run npm run presentation:setup first.');
  if (existsSync(databasePath)) throw new Error('Presentation database exists without its configuration. Restore its configuration; no data was reset.');
  mkdirSync('.local', {recursive:true});
  writeFileSync(configPath, JSON.stringify({secret:randomBytes(48).toString('base64url')},null,2), {mode:0o600});
}
const {secret} = JSON.parse(readFileSync(configPath,'utf8'));
if (typeof secret !== 'string' || secret.length < 32) throw new Error('Invalid presentation configuration.');
const env = {...process.env, APP_MODE:'demo', DATABASE_PROVIDER:'sqlite', ALATAU_DB_TASK:'', DATABASE_PATH:databasePath, BETTER_AUTH_SECRET:secret, BETTER_AUTH_URL:'http://127.0.0.1:3200', DEMO_CREDENTIALS_PATH:resolve('.local/presentation-credentials.json'), DEMO_PROFILE:'presentation', CAPTURE_SCOPE:command==='capture-completion'?'completion':'original'};
if (command !== 'setup' && !existsSync(databasePath)) throw new Error('Run npm run presentation:setup first.');
const args = command === 'setup' ? ['--import','tsx','scripts/seed.ts']
  : command === 'accounts' ? ['--import','tsx','scripts/show-demo-accounts.ts']
  : command.startsWith('capture') ? ['--import','tsx','scripts/capture-presentation.ts']
  : ['node_modules/next/dist/bin/next',command,'--hostname','127.0.0.1','--port','3200'];
const child = spawn(process.execPath,args,{env,stdio:'inherit',windowsHide:true});
process.on('SIGINT',()=>child.kill());
process.on('SIGTERM',()=>child.kill());
child.on('error',()=>{ console.error('Could not launch presentation command.'); process.exitCode=1; });
child.on('exit',(code)=>{process.exitCode=code??1;});
