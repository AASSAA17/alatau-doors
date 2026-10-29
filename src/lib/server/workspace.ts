import { randomUUID } from 'node:crypto';
import { getDb, authTimestamp } from './db';
import { fail, requireRole } from './access';
import { auth } from './auth';
import { demoWritePolicy } from './public-demo';
import { priceLine } from '@/lib/pricing';
import { getSettings, readProducts, saveProduct } from './products';
import type { Mutation } from './schemas';
import type {
  Actor,
  LineInput,
  Quote,
  QuoteLine,
  RequestDetail,
  RequestStatus,
  RequestSummary,
} from '@/types/workspace';
const now = () => new Date().toISOString();
const summarySql = `SELECT r.*,b.name AS buyerName,s.name AS sellerName FROM requests r JOIN user b ON b.id=r.buyerId LEFT JOIN user s ON s.id=r.sellerId`;
function scope(actor: Actor) {
  return actor.role === 'ADMIN'
    ? { sql: '1=1', values: [] }
    : actor.role === 'SELLER'
      ? { sql: 'r.sellerId=?', values: [actor.id] }
      : { sql: 'r.buyerId=?', values: [actor.id] };
}
export async function listRequests(actor: Actor): Promise<RequestSummary[]> {
  const filter = scope(actor);
  return (await getDb()
    .prepare(`${summarySql} WHERE ${filter.sql} ORDER BY r.number DESC LIMIT 200`)
    .all(...filter.values)) as RequestSummary[];
}
async function accessRequest(actor: Actor, id: string) {
  const filter = scope(actor);
  const row = (await getDb()
    .prepare(`${summarySql} WHERE r.id=? AND ${filter.sql}`)
    .get(id, ...filter.values)) as
    | (RequestSummary & {
        note: string;
      })
    | undefined;
  if (!row) fail('NOT_FOUND', 404);
  return row;
}
async function readItems(id: string): Promise<LineInput[]> {
  const rows = (await getDb()
    .prepare(
      'SELECT variantId,quantity,frame,hardware,installation FROM request_items WHERE requestId=? ORDER BY rowid',
    )
    .all(id)) as LineInput[];
  return rows.map((r) => ({
    ...r,
    frame: Boolean(r.frame),
    hardware: Boolean(r.hardware),
    installation: Boolean(r.installation),
  }));
}
export async function requestDetail(actor: Actor, id: string): Promise<RequestDetail> {
  const row = await accessRequest(actor, id);
  const db = getDb();
  const buyer = (await db
    .prepare('SELECT name,email,phone FROM user WHERE id=?')
    .get(row.buyerId)) as RequestDetail['buyer'];
  const quotes = (
    (await db
      .prepare(
        'SELECT id,version,total,payload,createdAt,authorName FROM quotes WHERE requestId=? ORDER BY version DESC',
      )
      .all(id)) as (Omit<Quote, 'lines'> & {
      payload: string;
    })[]
  ).map(({ payload, ...q }) => ({ ...q, lines: JSON.parse(payload) as QuoteLine[] }));
  const events = (await db
    .prepare(
      'SELECT id,kind,status,authorName,createdAt FROM request_events WHERE requestId=? ORDER BY rowid',
    )
    .all(id)) as RequestDetail['events'];
  // Do not fetch internal comments for buyers, including SSR/JSON/RSC responses.
  const comments =
    actor.role !== 'BUYER'
      ? ((await db
          .prepare(
            'SELECT id,text,authorName,createdAt FROM internal_comments WHERE requestId=? ORDER BY rowid',
          )
          .all(id)) as RequestDetail['comments'])
      : undefined;
  return {
    ...row,
    buyer: { ...buyer, phone: buyer.phone || '' },
    items: await readItems(id),
    quotes,
    events,
    ...(comments ? { comments } : {}),
  };
}
export async function calculate(lines: LineInput[]): Promise<{
  lines: QuoteLine[];
  total: number;
}> {
  const settings = await getSettings();
  const db = getDb();
  const ids = [...new Set(lines.map((line) => line.variantId))];
  if (!ids.length) fail('INVALID_INPUT');
  const variants = (await db
    .prepare(
      `SELECT v.*,p.payload FROM variants v JOIN products p ON p.id=v.productId WHERE v.id IN (${ids.map(() => '?').join(',')}) AND v.active=1 AND p.archived=0`,
    )
    .all(...ids)) as {
    id: string;
    width: number;
    height: number;
    price: number;
    stock: string;
    payload: string;
  }[];
  const snapshots = lines.map((line) => {
    const v = variants.find((v) => v.id === line.variantId);
    if (!v || v.stock === 'DEMO_UNAVAILABLE') fail('UNAVAILABLE_VARIANT');
    const p = JSON.parse(v.payload) as {
      name: string;
      sku: string;
    };
    return {
      ...line,
      name: p.name,
      sku: p.sku,
      width: v.width,
      height: v.height,
      ...priceLine(line, v.price, settings),
    };
  });
  return { lines: snapshots, total: snapshots.reduce((sum, l) => sum + l.total, 0) };
}
async function event(actor: Actor, id: string, kind: string, status: RequestStatus) {
  await getDb()
    .prepare('INSERT INTO request_events VALUES(?,?,?,?,?,?,?)')
    .run(randomUUID(), id, kind, status, actor.id, actor.name, now());
}
async function audit(actor: Actor, action: string, targetId: string) {
  await getDb()
    .prepare('INSERT INTO audit_log VALUES(?,?,?,?,?)')
    .run(randomUUID(), actor.id, action, targetId, now());
}
async function writeItems(id: string, lines: LineInput[]) {
  const db = getDb();
  await db.prepare('DELETE FROM request_items WHERE requestId=?').run(id);
  for (const line of lines)
    await db
      .prepare('INSERT INTO request_items VALUES(?,?,?,?,?,?,?)')
      .run(
        randomUUID(),
        id,
        line.variantId,
        line.quantity,
        +line.frame,
        +line.hardware,
        +line.installation,
      );
}
function editable(row: RequestSummary, revision: number) {
  if (['COMPLETED', 'CANCELLED'].includes(row.status)) fail('REQUEST_CLOSED', 409);
  if (row.revision !== revision) fail('STALE_RECORD', 409);
}
async function updateRequest(id: string, status: RequestStatus) {
  await getDb()
    .prepare('UPDATE requests SET status=?,revision=revision+1,updatedAt=? WHERE id=?')
    .run(status, now(), id);
}
export async function favoriteIds(userId: string): Promise<string[]> {
  return (
    (await getDb().prepare('SELECT productId FROM favorites WHERE userId=?').all(userId)) as {
      productId: string;
    }[]
  ).map((r) => r.productId);
}
export async function readDraft(userId: string): Promise<LineInput[]> {
  const row = (await getDb().prepare('SELECT payload FROM drafts WHERE userId=?').get(userId)) as
    | {
        payload: string;
      }
    | undefined;
  return row ? JSON.parse(row.payload) : [];
}
export async function users() {
  return (await getDb()
    .prepare('SELECT id,name,email,role,phone,active FROM user ORDER BY name')
    .all()) as Actor[];
}
export async function mutate(actor: Actor, input: Mutation): Promise<Record<string, unknown>> {
  const db = getDb();
  if (input.action === 'createUser') {
    await demoWritePolicy(actor, input);
    requireRole(actor, ['ADMIN']);
    if (await db.prepare('SELECT id FROM user WHERE lower(email)=lower(?)').get(input.email))
      fail('EMAIL_EXISTS', 409);
    const created = await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
    });
    await db.transaction(async () => {
      await db.prepare('UPDATE user SET role=? WHERE id=?').run(input.role, created.user.id);
      await db.prepare('DELETE FROM session WHERE userId=?').run(created.user.id);
      await audit(actor, 'createUser', created.user.id);
    })();
    return { id: created.user.id };
  }
  return await db.transaction(async (): Promise<Record<string, unknown>> => {
    const current = (await db.prepare('SELECT role,active FROM user WHERE id=?').get(actor.id)) as
      { role: string; active: boolean } | undefined;
    if (!current?.active || current.role !== actor.role) fail('FORBIDDEN', 403);
    await demoWritePolicy(actor, input);
    switch (input.action) {
      case 'profile':
        await db
          .prepare('UPDATE user SET name=?,phone=?,updatedAt=? WHERE id=?')
          .run(input.name, input.phone, authTimestamp(), actor.id);
        return { ok: true };
      case 'favorite': {
        requireRole(actor, ['BUYER']);
        if (
          input.saved &&
          !(await db
            .prepare('SELECT id FROM products WHERE id=? AND archived=0')
            .get(input.productId))
        )
          fail('NOT_FOUND', 404);
        if (input.saved)
          await db
            .prepare('INSERT OR IGNORE INTO favorites VALUES(?,?)')
            .run(actor.id, input.productId);
        else
          await db
            .prepare('DELETE FROM favorites WHERE userId=? AND productId=?')
            .run(actor.id, input.productId);
        return { ids: await favoriteIds(actor.id) };
      }
      case 'clearFavorites':
        requireRole(actor, ['BUYER']);
        await db.prepare('DELETE FROM favorites WHERE userId=?').run(actor.id);
        return { ids: [] };
      case 'draft':
        requireRole(actor, ['BUYER']);
        if (input.lines.length) await calculate(input.lines);
        await db
          .prepare(
            'INSERT INTO drafts VALUES(?,?,?) ON CONFLICT(userId) DO UPDATE SET payload=excluded.payload,updatedAt=excluded.updatedAt',
          )
          .run(actor.id, JSON.stringify(input.lines), now());
        return { ok: true };
      case 'createRequest': {
        requireRole(actor, ['BUYER']);
        await calculate(input.lines);
        const id = randomUUID();
        const at = now();
        await db
          .prepare(
            'INSERT INTO requests(id,buyerId,status,note,createdAt,updatedAt) VALUES(?,?,?,?,?,?)',
          )
          .run(id, actor.id, 'NEW', input.note, at, at);
        await writeItems(id, input.lines);
        await event(actor, id, 'CREATED', 'NEW');
        await db.prepare('DELETE FROM drafts WHERE userId=?').run(actor.id);
        return { id };
      }
      case 'assign': {
        requireRole(actor, ['ADMIN']);
        const row = await accessRequest(actor, input.requestId);
        editable(row, input.revision);
        if (
          !(await db
            .prepare("SELECT id FROM user WHERE id=? AND role='SELLER' AND active=1")
            .get(input.sellerId))
        )
          fail('INVALID_SELLER');
        await db.prepare('UPDATE requests SET sellerId=? WHERE id=?').run(input.sellerId, row.id);
        const status = row.status === 'NEW' ? 'IN_PROGRESS' : row.status;
        await updateRequest(row.id, status);
        await event(actor, row.id, 'ASSIGNED', status);
        await audit(actor, 'assign', row.id);
        return { ok: true };
      }
      case 'items': {
        requireRole(actor, ['SELLER', 'ADMIN']);
        const row = await accessRequest(actor, input.requestId);
        editable(row, input.revision);
        if (row.status === 'NEW') fail('ASSIGN_FIRST');
        await calculate(input.lines);
        await writeItems(row.id, input.lines);
        await updateRequest(row.id, 'IN_PROGRESS');
        await event(actor, row.id, 'ITEMS_UPDATED', 'IN_PROGRESS');
        return { ok: true };
      }
      case 'quote': {
        requireRole(actor, ['SELLER', 'ADMIN']);
        const row = await accessRequest(actor, input.requestId);
        editable(row, input.revision);
        if (row.status !== 'IN_PROGRESS' || !row.sellerId) fail('INVALID_TRANSITION', 409);
        const result = await calculate(await readItems(row.id));
        const version = (
          (await db
            .prepare('SELECT coalesce(max(version),0)+1 AS version FROM quotes WHERE requestId=?')
            .get(row.id)) as {
            version: number;
          }
        ).version;
        await db
          .prepare('INSERT INTO quotes VALUES(?,?,?,?,?,?,?,?)')
          .run(
            randomUUID(),
            row.id,
            version,
            result.total,
            JSON.stringify(result.lines),
            actor.id,
            actor.name,
            now(),
          );
        await updateRequest(row.id, 'QUOTED');
        await event(actor, row.id, 'QUOTED', 'QUOTED');
        return { total: result.total, version };
      }
      case 'status': {
        const row = await accessRequest(actor, input.requestId);
        editable(row, input.revision);
        if (actor.role === 'BUYER' && input.status !== 'CANCELLED') fail('FORBIDDEN', 403);
        if (input.status === 'COMPLETED' && row.status !== 'QUOTED')
          fail('INVALID_TRANSITION', 409);
        if (input.status === 'IN_PROGRESS' && row.status !== 'QUOTED')
          fail('INVALID_TRANSITION', 409);
        await updateRequest(row.id, input.status);
        await event(actor, row.id, 'STATUS', input.status);
        return { ok: true };
      }
      case 'comment': {
        requireRole(actor, ['SELLER', 'ADMIN']);
        const row = await accessRequest(actor, input.requestId);
        if (['COMPLETED', 'CANCELLED'].includes(row.status)) fail('REQUEST_CLOSED', 409);
        await db
          .prepare('INSERT INTO internal_comments VALUES(?,?,?,?,?,?)')
          .run(randomUUID(), row.id, actor.id, actor.name, input.text, now());
        return { ok: true };
      }
      case 'product': {
        requireRole(actor, ['ADMIN']);
        const id = await saveProduct(input.id, input.data);
        await audit(actor, 'product', id);
        return { id };
      }
      case 'user': {
        requireRole(actor, ['ADMIN']);
        const target = (await db
          .prepare('SELECT id,role,active FROM user WHERE id=?')
          .get(input.id)) as Actor | undefined;
        if (!target) fail('NOT_FOUND', 404);
        if (target.id === actor.id && (!input.active || input.role !== 'ADMIN')) fail('SELF_LOCK');
        if (
          target.role === 'ADMIN' &&
          target.active &&
          (!input.active || input.role !== 'ADMIN') &&
          (
            (await db
              .prepare("SELECT count(*) AS n FROM user WHERE role='ADMIN' AND active=1")
              .get()) as {
              n: number;
            }
          ).n <= 1
        )
          fail('LAST_ADMIN');
        await db
          .prepare('UPDATE user SET name=?,phone=?,role=?,active=?,updatedAt=? WHERE id=?')
          .run(input.name, input.phone, input.role, input.active, authTimestamp(), input.id);
        if (target.role !== input.role || Boolean(target.active) !== input.active)
          await db.prepare('DELETE FROM session WHERE userId=?').run(input.id);
        await audit(actor, 'user', input.id);
        return { ok: true };
      }
      case 'settings':
        requireRole(actor, ['ADMIN']);
        await db
          .prepare('UPDATE store_settings SET payload=? WHERE id=1')
          .run(JSON.stringify(input.data));
        await audit(actor, 'settings', '1');
        return { ok: true };
    }
  })();
}
export async function readWorkspace(actor: Actor, resource: string, id?: string) {
  if (resource === 'requests') return { requests: await listRequests(actor) };
  if (resource === 'request' && id) return await requestDetail(actor, id);
  if (resource === 'draft') {
    requireRole(actor, ['BUYER']);
    return { lines: await readDraft(actor.id) };
  }
  if (resource === 'favorites') {
    requireRole(actor, ['BUYER']);
    return { ids: await favoriteIds(actor.id) };
  }
  if (resource === 'users') {
    requireRole(actor, ['ADMIN']);
    return { users: await users() };
  }
  if (resource === 'products') {
    requireRole(actor, ['ADMIN']);
    return { products: await readProducts(true) };
  }
  if (resource === 'settings') {
    requireRole(actor, ['ADMIN']);
    return await getSettings();
  }
  fail('NOT_FOUND', 404);
}
