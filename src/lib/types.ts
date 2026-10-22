export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  position: number;
  active: boolean;
};
export type Variant = {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  color: string;
  design: string;
  price: number | null;
  stock: number;
  active: boolean;
};
export type Media = {
  id: string;
  product_id: string;
  url: string;
  storage_key: string | null;
  type: 'image' | 'video';
  position: number;
  is_primary: boolean;
};
export type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  category_id: string | null;
  short_description: string;
  description: string;
  price: number;
  sale_price: number | null;
  active: boolean;
  featured: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  variants: Variant[];
  product_media: Media[];
};
export type Settings = {
  business_name: string;
  description: string;
  logo_url?: string;
  whatsapp: string;
  phone?: string;
  email?: string;
  address?: string;
  currency: string;
  country: string;
  delivery_fee: number | null;
  free_delivery_threshold: number | null;
  city_fees: Record<string, number>;
  delivery_enabled: boolean;
  checkout_enabled: boolean;
  hero_title: string;
  hero_text: string;
  promotion: string;
  policies: string;
  instagram?: string;
  facebook?: string;
};
export type Customer = {
  name: string;
  phone: string;
  whatsapp?: string;
  province: string;
  city: string;
  area: string;
  address: string;
  instructions?: string;
  notes?: string;
};
export type CartItem = {
  variant_id: string;
  product_id: string;
  name: string;
  slug: string;
  variant: string;
  sku: string;
  quantity: number;
  expected_price: number;
  image?: string;
  stock: number;
};
export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  sku: string;
  variant: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};
export const statuses = [
  'pending_confirmation',
  'confirmed',
  'preparing',
  'dispatched',
  'delivered',
  'cancelled',
] as const;
export type Order = {
  id: string;
  reference: string;
  customer: Customer;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  currency: string;
  payment_status: 'unpaid' | 'paid' | 'refunded';
  status: (typeof statuses)[number];
  internal_notes: string;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
};
