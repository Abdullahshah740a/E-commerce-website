import { z } from 'zod';
import { normalizePhone } from './commerce';
import { statuses } from './types';
const text = (max = 500) => z.string().trim().max(max);
const phone = text(30)
  .transform(normalizePhone)
  .refine(
    Boolean,
    'Enter a valid phone number including the country code, or a Pakistani mobile number.',
  );
const amount = z.number().int().min(0).max(100000000);
export const customerSchema = z.object({
  name: text(100).min(2),
  phone,
  whatsapp: z.union([z.literal(''), phone]).optional(),
  province: text(100).min(2),
  city: text(100).min(2),
  area: text(150).min(2),
  address: text(500).min(10),
  instructions: text(500).optional(),
  notes: text(1000).optional(),
});
export const checkoutSchema = z
  .object({
    idempotency_key: z.uuid(),
    customer: customerSchema,
    items: z
      .array(
        z.object({
          variant_id: z.uuid(),
          quantity: z.number().int().min(1).max(99),
          expected_price: amount,
        }),
      )
      .min(1)
      .max(30),
  })
  .refine(
    (v) => new Set(v.items.map((i) => i.variant_id)).size === v.items.length,
    'Duplicate variants are not allowed',
  );
const slug = text(150).regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'Use lowercase words separated by hyphens',
);
export const variantSchema = z.object({
  id: z.uuid().optional(),
  sku: text(100).min(1),
  size: text(100),
  color: text(100),
  design: text(100),
  price: amount.nullable(),
  stock: z.number().int().min(0).max(1000000),
  expected_stock: z.number().int().min(0).max(1000000).optional(),
  active: z.boolean(),
});
export const productSchema = z
  .object({
    id: z.uuid().optional(),
    name: text(180).min(2),
    slug,
    sku: text(100).min(1),
    category_id: z.union([z.uuid(), z.literal('')]),
    short_description: text(400),
    description: text(10000),
    price: amount,
    sale_price: amount.nullable(),
    active: z.boolean(),
    featured: z.boolean(),
    tags: z.array(text(50)).max(30),
    variants: z.array(variantSchema).min(1).max(100),
  })
  .refine(
    (p) => p.sale_price === null || p.sale_price < p.price,
    'Sale price must be below regular price',
  )
  .refine(
    (p) => new Set(p.variants.map((v) => v.sku)).size === p.variants.length,
    'Variant SKUs must be unique',
  );
const safeUrl = z.union([z.literal(''), z.url().startsWith('https://')]);
export const settingsSchema = z
  .object({
    business_name: text(100).min(2),
    description: text(500),
    logo_url: safeUrl.optional(),
    whatsapp: z.union([z.literal(''), text(20).regex(/^[1-9]\d{7,14}$/)]),
    phone: text(30).optional(),
    email: z.union([z.literal(''), z.email()]).optional(),
    address: text(500).optional(),
    currency: z.enum(['PKR']),
    country: z.enum(['Pakistan']),
    delivery_fee: amount.nullable(),
    free_delivery_threshold: amount.nullable(),
    city_fees: z.record(z.string().trim().min(1).max(100), amount),
    delivery_enabled: z.boolean(),
    checkout_enabled: z.boolean(),
    hero_title: text(120).min(2),
    hero_text: text(500),
    promotion: text(250),
    policies: text(10000),
    instagram: safeUrl.optional(),
    facebook: safeUrl.optional(),
  })
  .refine(
    (s) => !s.checkout_enabled || (s.delivery_fee !== null && s.delivery_enabled),
    'Configure delivery fees before accepting orders',
  );
export const categorySchema = z.object({
  id: z.uuid().optional(),
  name: text(100).min(2),
  slug,
  description: text(500),
  image_url: safeUrl.nullable(),
  position: z.number().int().min(0).max(10000),
  active: z.boolean(),
});
export const orderUpdateSchema = z.object({
  id: z.uuid(),
  status: z.enum(statuses),
  payment_status: z.enum(['unpaid', 'paid', 'refunded']),
  internal_notes: text(5000),
});
