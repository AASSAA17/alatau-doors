import { getMigrations } from 'better-auth/db/migration';
import { auth } from '../src/lib/server/auth';
import { migrateBusiness } from '../src/lib/server/db';
async function main() {
    const migrations = await getMigrations(auth.options);
    await migrations.runMigrations();
    (await migrateBusiness());
    console.log('Database migrations complete.');
}
main().catch(() => {
    console.error('Migration failed. Check database path and server environment.');
    process.exit(1);
});
