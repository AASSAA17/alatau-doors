import { z } from 'zod';
const short = z.string().trim().min(1).max(120);
export const lineSchema = z
  .object({
    variantId: z.string().min(1).max(100),
    quantity: z.number().int().min(1).max(20),
    frame: z.boolean(),
    hardware: z.boolean(),
    installation: z.boolean(),
  })
  .strict();
export const linesSchema = z.array(lineSchema).min(1).max(30);
export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[+\d\s()\-]*$/),
  })
  .strict();
export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.email().max(254),
    password: z.string().min(12).max(128),
  })
  .strict();
export const settingsSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .max(40)
      .regex(/^[+\d\s()\-]*$/),
    email: z.union([z.literal(''), z.email().max(254)]),
    addressRu: z.string().trim().max(300),
    addressKk: z.string().trim().max(300),
    hoursRu: z.string().trim().max(200),
    hoursKk: z.string().trim().max(200),
    framePrice: z.number().int().min(0).max(10000000),
    hardwarePrice: z.number().int().min(0).max(10000000),
    installationPrice: z.number().int().min(0).max(10000000),
  })
  .strict();
const localized = z.object({ ru: short, kk: short }).strict();
export const productSchema = z
  .object({
    name: short,
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    sku: short,
    category: z.enum(['interior', 'entrance']),
    image: z.enum([
      '/images/hero.webp',
      '/images/oak.webp',
      '/images/ivory.webp',
      '/images/graphite.webp',
    ]).or(z.string().regex(/^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)),
    finish: localized,
    material: localized,
    coating: localized.optional(),
    description: z
      .object({ ru: z.string().trim().min(5).max(2000), kk: z.string().trim().min(5).max(2000) })
      .strict(),
    collection: short,
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    archived: z.boolean(),
    variants: z
      .array(
        z
          .object({
            id: z.string().max(100).optional(),
            width: z.number().int().min(400).max(1600),
            height: z.number().int().min(1800).max(3000),
            price: z.number().int().min(0).max(10000000),
            stock: z.enum(['DEMO_AVAILABLE', 'DEMO_ORDER', 'DEMO_UNAVAILABLE']),
            active: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();
export const mutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('profile'), ...profileSchema.shape }).strict(),
  z
    .object({ action: z.literal('favorite'), productId: z.string().max(100), saved: z.boolean() })
    .strict(),
  z.object({ action: z.literal('clearFavorites') }).strict(),
  z.object({ action: z.literal('draft'), lines: z.array(lineSchema).max(30) }).strict(),
  z
    .object({
      action: z.literal('createRequest'),
      lines: linesSchema,
      note: z.string().trim().max(2000),
    })
    .strict(),
  z
    .object({
      action: z.literal('assign'),
      requestId: z.string(),
      sellerId: z.string(),
      revision: z.number().int(),
    })
    .strict(),
  z
    .object({
      action: z.literal('items'),
      requestId: z.string(),
      lines: linesSchema,
      revision: z.number().int(),
    })
    .strict(),
  z
    .object({ action: z.literal('quote'), requestId: z.string(), revision: z.number().int() })
    .strict(),
  z
    .object({
      action: z.literal('status'),
      requestId: z.string(),
      status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
      revision: z.number().int(),
    })
    .strict(),
  z
    .object({
      action: z.literal('comment'),
      requestId: z.string(),
      text: z.string().trim().min(1).max(3000),
    })
    .strict(),
  z
    .object({ action: z.literal('product'), id: z.string().optional(), data: productSchema })
    .strict(),
  z
    .object({
      action: z.literal('user'),
      id: z.string(),
      name: z.string().trim().min(2).max(100),
      phone: z.string().max(30),
      role: z.enum(['BUYER', 'SELLER', 'ADMIN']),
      active: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal('createUser'),
      name: z.string().trim().min(2).max(100),
      email: z.email().max(254),
      password: z.string().min(12).max(128),
      role: z.enum(['BUYER', 'SELLER', 'ADMIN']),
    })
    .strict(),
  z.object({ action: z.literal('settings'), data: settingsSchema }).strict(),
]);
export type Mutation = z.infer<typeof mutationSchema>;
