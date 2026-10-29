import { ensureDatabaseMode, getPool } from '../src/lib/server/db';
import { postgres, validateEnvironment } from '../src/lib/server/environment';
async function main() {
  try {
    validateEnvironment();
    await ensureDatabaseMode();
    console.log('Database mode accepted.');
  } catch {
    process.exitCode = 1;
  } finally {
    if (postgres)
      try {
        await getPool().end();
      } catch {}
  }
}
void main();
