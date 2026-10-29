import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { fail } from './access';
import { normalizeSpecifications } from '@/lib/product-specifications';
import type { Product } from '@/types/product';
import type { AdminProduct, DoorVariant, StoreSettings } from '@/types/workspace';
import type { z } from 'zod';
import type { productSchema } from './schemas';
type ProductRow = {
  id: string;
  slug: string;
  sku: string;
  payload: string;
  archived: number;
};
export async function getVariants(
  productId?: string,
  includeInactive = false,
): Promise<DoorVariant[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT * FROM variants WHERE ${includeInactive ? '1=1' : 'active=1'} ${productId ? 'AND productId=?' : ''} ORDER BY width`,
    )
    .all(...(productId ? [productId] : []))) as DoorVariant[];
  return rows.map((v) => ({ ...v, active: Boolean(v.active) }));
}
export async function readProducts(includeArchived = false): Promise<AdminProduct[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT * FROM products ${includeArchived ? '' : 'WHERE archived=0'} ORDER BY createdAt,id`,
    )
    .all()) as ProductRow[];
  const allVariants = await getVariants(undefined, includeArchived);
  return rows
    .map((row) => {
      const variants = allVariants.filter((v) => v.productId === row.id);
      const data = normalizeSpecifications(JSON.parse(row.payload) as Product);
      return {
        ...data,
        id: row.id,
        slug: row.slug,
        sku: row.sku,
        archived: Boolean(row.archived),
        variants,
        widths: [...new Set(variants.filter((v) => v.active).map((v) => v.width))],
        price: variants.some((v) => v.active)
          ? Math.min(...variants.filter((v) => v.active).map((v) => v.price))
          : data.price,
      };
    })
    .filter((p) => includeArchived || p.variants.some((v) => v.active));
}
export async function getSettings(): Promise<StoreSettings> {
  return JSON.parse(
    (
      (await getDb().prepare('SELECT payload FROM store_settings WHERE id=1').get()) as {
        payload: string;
      }
    ).payload,
  );
}
export async function saveProduct(id: string | undefined, data: z.infer<typeof productSchema>) {
  const db = getDb();
  const productId = id || randomUUID();
  const now = new Date().toISOString();
  if (id && !(await db.prepare('SELECT id FROM products WHERE id=?').get(id)))
    fail('NOT_FOUND', 404);
  if (!data.archived && !data.variants.some((v) => v.active)) fail('ACTIVE_VARIANT_REQUIRED');
  if (
    new Set(data.variants.filter((v) => v.id).map((v) => v.id)).size !==
    data.variants.filter((v) => v.id).length
  )
    fail('INVALID_INPUT');
  for (const variant of data.variants)
    if (
      variant.id &&
      !(await db
        .prepare('SELECT id FROM variants WHERE id=? AND productId=?')
        .get(variant.id, productId))
    )
      fail('INVALID_VARIANT');
  const payload = {
    ...data,
    id: productId,
    demo: true,
    widths: data.variants.map((v) => v.width),
    height: data.variants[0].height,
    price: Math.min(...data.variants.map((v) => v.price)),
  };
  await db
    .prepare(
      'INSERT INTO products(id,slug,sku,payload,archived,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,sku=excluded.sku,payload=excluded.payload,archived=excluded.archived,updatedAt=excluded.updatedAt',
    )
    .run(productId, data.slug, data.sku, JSON.stringify(payload), +data.archived, now, now);
  await db.prepare('UPDATE variants SET active=0 WHERE productId=?').run(productId);
  for (const v of data.variants)
    await db
      .prepare(
        'INSERT INTO variants(id,productId,width,height,price,stock,active) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET width=excluded.width,height=excluded.height,price=excluded.price,stock=excluded.stock,active=excluded.active',
      )
      .run(v.id || randomUUID(), productId, v.width, v.height, v.price, v.stock, +v.active);
  return productId;
}
