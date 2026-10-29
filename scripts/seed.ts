import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getMigrations } from 'better-auth/db/migration';
import { auth } from '../src/lib/server/auth';
import { databasePath, getDb, getPool, migrateBusiness } from '../src/lib/server/db';
import { postgres, publicDemo, maintenance } from '../src/lib/server/environment';
import { products } from '../src/data/products';
import { mutate, requestDetail } from '../src/lib/server/workspace';
import type { Actor, Role } from '../src/types/workspace';
import { readCredentials, writeCredentials, type DemoCredential } from './demo-credentials';
import {
  presentationUsers,
  presentationRequests,
  presentationVersion,
} from '../src/data/presentation';
async function main() {
  const presentation = process.env.DEMO_PROFILE === 'presentation' || postgres;
  if (
    postgres &&
    (!maintenance ||
      !['demo', 'public-demo'].includes(process.env.APP_MODE || '') ||
      process.env.ALATAU_DB_TASK !== 'seed' ||
      process.env.DEMO_SEED_CONFIRM !== 'fictional-data-only')
  )
    throw new Error('Explicit cloud demo seed confirmation required.');
  if (!postgres && (process.env.APP_MODE !== 'demo' || !databasePath.endsWith('demo.sqlite')))
    throw new Error('Seed is restricted to APP_MODE=demo and a *demo.sqlite database.');
  if (presentation && !postgres && databasePath !== resolve('.local/presentation-demo.sqlite'))
    throw new Error('Presentation seed is restricted to its separate presentation-demo.sqlite.');
  if (!postgres) {
    const migrations = await getMigrations(auth.options);
    await migrations.runMigrations();
    await migrateBusiness();
  }
  const db = getDb();
  const credentialsPath = resolve(
    process.env.DEMO_CREDENTIALS_PATH ||
      (postgres ? '.local/cloud-credentials.json' : '.local/demo-credentials.json'),
  );
  if (
    postgres &&
    !(await db.prepare("SELECT value FROM app_meta WHERE key='cloudSeedStarted'").get())
  ) {
    const count = (await db.prepare('SELECT count(*) AS n FROM user').get()) as { n: string };
    const products = (await db.prepare('SELECT count(*) AS n FROM products').get()) as {
      n: string;
    };
    if (Number(count.n) || Number(products.n))
      throw new Error('Refusing to seed a nonempty unmarked database.');
    if (existsSync(credentialsPath))
      throw new Error('Use a new credentials path for a new cloud database.');
    await db.prepare("INSERT INTO app_meta VALUES('cloudSeedStarted','1')").run();
  }
  if (await db.prepare("SELECT value FROM app_meta WHERE key='seedComplete'").get()) {
    if (
      presentation &&
      !(await db.prepare("SELECT value FROM app_meta WHERE key='presentationVersion'").get())
    )
      throw new Error(
        'Existing database is not a presentation dataset. No records were overwritten.',
      );
    console.log(
      'Demo already initialized. Existing changes preserved. Credentials: ' + credentialsPath,
    );
    return;
  }
  const names = [
    'Line 01',
    'Forma 02',
    'Terra 03',
    'Studio 04',
    'Nord 05',
    'Contour 06',
    'Fort 07',
    'Walnut 08',
    'Sense 09',
    'Pure 10',
    'Axis 11',
    'Atelier 12',
  ];
  await db.transaction(async () => {
    for (let i = 0; i < 12; i++) {
      const source = products[i % 4];
      const id = `d${String(i + 1).padStart(2, '0')}`;
      if (await db.prepare('SELECT id FROM products WHERE id=?').get(id)) continue;
      const p = {
        ...source,
        id,
        name: names[i],
        slug: i < 4 ? source.slug : names[i].toLowerCase().replace(' ', '-'),
        sku: `AD-DEMO-${String(i + 1).padStart(2, '0')}`,
        price: source.price + (i < 4 ? 0 : i * 2500),
      };
      const at = new Date().toISOString();
      await db
        .prepare('INSERT INTO products VALUES(?,?,?,?,?,?,?)')
        .run(id, p.slug, p.sku, JSON.stringify(p), 0, at, at);
      for (const width of p.widths)
        await db
          .prepare('INSERT INTO variants VALUES(?,?,?,?,?,?,1)')
          .run(
            `${id}-${width}`,
            id,
            width,
            p.height,
            p.price,
            i === 11 ? 'DEMO_ORDER' : 'DEMO_AVAILABLE',
          );
    }
  })();
  const credentials: DemoCredential[] = existsSync(credentialsPath)
    ? readCredentials(credentialsPath)
    : [];
  const seedUsers: [string, Role, string][] = presentation
    ? presentationUsers
    : [
        ['admin', 'ADMIN', 'Демо администратор'],
        ['seller-a', 'SELLER', 'Продавец А'],
        ['seller-b', 'SELLER', 'Продавец Б'],
        ['buyer-a', 'BUYER', 'Покупатель А'],
        ['buyer-b', 'BUYER', 'Покупатель Б'],
      ];
  mkdirSync(dirname(credentialsPath), { recursive: true });
  for (const [key, role, name] of seedUsers) {
    const email = `${key}@alatau.demo`;
    let row = (await db.prepare('SELECT id FROM user WHERE email=?').get(email)) as
      | {
          id: string;
        }
      | undefined;
    if (!row) {
      const password = randomBytes(18).toString('base64url');
      const created = await auth.api.signUpEmail({ body: { email, password, name } });
      row = { id: created.user.id };
      credentials.push({ id: row.id, role, name, email, password });
      writeCredentials(credentialsPath, credentials);
    }
    await db.prepare('UPDATE user SET role=? WHERE id=?').run(role, row.id);
    await db.prepare('DELETE FROM session WHERE userId=?').run(row.id);
  }
  const actor = async (key: string) =>
    (await db
      .prepare('SELECT id,name,email,role,phone,active FROM user WHERE email=?')
      .get(`${key}@alatau.demo`)) as Actor;
  const admin = await actor('admin');
  const sellerA = await actor('seller-a');
  const sellerB = await actor('seller-b');
  await db.transaction(async () => {
    if (!(await db.prepare("SELECT value FROM app_meta WHERE key='seedRequests'").get())) {
      for (let i = 0; i < 5; i++) {
        const buyer = await actor(i % 2 ? 'buyer-b' : 'buyer-a');
        const seller = i % 2 ? sellerB : sellerA;
        const result = await mutate(buyer, {
          action: 'createRequest',
          lines: presentation
            ? [presentationRequests[i].line]
            : [
                {
                  variantId: `d0${(i % 4) + 1}-${products[i % 4].widths[0]}`,
                  quantity: i + 1,
                  frame: true,
                  hardware: true,
                  installation: i % 2 === 0,
                },
              ],
          note: presentation
            ? presentationRequests[i].note
            : 'Демонстрационная заявка. Не является реальным обращением в магазин.',
        });
        const id = result.id as string;
        if (i > 0)
          await mutate(admin, {
            action: 'assign',
            requestId: id,
            sellerId: seller.id,
            revision: (await requestDetail(admin, id)).revision,
          });
        if (i >= 2 && i <= 3)
          await mutate(seller, {
            action: 'quote',
            requestId: id,
            revision: (await requestDetail(seller, id)).revision,
          });
        if (i === 3)
          await mutate(seller, {
            action: 'status',
            requestId: id,
            status: 'COMPLETED',
            revision: (await requestDetail(seller, id)).revision,
          });
        if (i === 4)
          await mutate(buyer, {
            action: 'status',
            requestId: id,
            status: 'CANCELLED',
            revision: (await requestDetail(buyer, id)).revision,
          });
        if (i === 1 || i === 2)
          await mutate(seller, {
            action: 'comment',
            requestId: id,
            text: presentation
              ? presentationRequests[i].comment
              : 'Внутренний демонстрационный комментарий — покупателю не виден.',
          });
      }
      await db.prepare("INSERT INTO app_meta VALUES('seedRequests','1')").run();
    }
    if (presentation)
      await db
        .prepare("INSERT INTO app_meta VALUES('presentationVersion',?)")
        .run(presentationVersion);
    await db.prepare("INSERT INTO app_meta VALUES('seedComplete','1')").run();
    if (publicDemo) await db.prepare("INSERT INTO app_meta VALUES('publicDemo','cloud-v1')").run();
  })();
  console.log(
    'Demo initialized: 12 products, 5 accounts, 5 requests. Credentials saved locally: ' +
      credentialsPath,
  );
}
main()
  .then(async () => {
    if (postgres) await getPool().end();
  })
  .catch((error: unknown) => {
    if (process.env.ALATAU_TEST_PROVIDER === 'postgres')
      console.error(
        error instanceof Error
          ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]')
          : 'Unknown test seed error',
      );
    console.error(
      'Seed failed. Check environment and dedicated empty database; secrets are not logged.',
    );
    process.exit(1);
  });
